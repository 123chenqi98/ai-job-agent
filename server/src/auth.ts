import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

// 单用户访问门禁：密码以 scrypt 哈希形式配置在 server/.env（ACCESS_PASSWORD_HASH），
// 登录通过后下发 HMAC 签名的 HttpOnly Cookie；未配置哈希时门禁不启用（本地开发免登录）。

export const AUTH_COOKIE_NAME = 'aj_auth'

const SCRYPT_KEYLEN = 64
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000

// 哈希格式：scrypt$<saltHex>$<hashHex>
function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'hex')
  const expected = Buffer.from(parts[2], 'hex')
  if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) return false
  let actual: Buffer
  try {
    actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)
  } catch {
    return false
  }
  return crypto.timingSafeEqual(actual, expected)
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

function issueToken(secret: string): string {
  const payload = base64url(JSON.stringify({ exp: Date.now() + COOKIE_MAX_AGE_MS }))
  return `${payload}.${sign(payload, secret)}`
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const piece of header.split(';')) {
    const idx = piece.indexOf('=')
    if (idx < 0) continue
    const key = piece.slice(0, idx).trim()
    if (key === name) return decodeURIComponent(piece.slice(idx + 1).trim())
  }
  return null
}

export function isTokenValid(token: string | null, secret: string): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  const expected = sign(payload, secret)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number }
    return typeof claims.exp === 'number' && claims.exp > Date.now()
  } catch {
    return false
  }
}

interface FailureRecord {
  count: number
  lockUntil: number
}

const failureByIp = new Map<string, FailureRecord>()

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function setAuthCookie(req: Request, res: Response, token: string): void {
  // 经 Nginx HTTPS 反代时 req.secure 依赖 trust proxy；本地 http 开发不带 Secure
  const secure = req.secure ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE_MS / 1000}`,
  )
}

function clearAuthCookie(res: Response): void {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
}

export interface AuthOptions {
  passwordHash: string
  secret: string
}

export function createAuthGate(options: AuthOptions) {
  const enabled = Boolean(options.passwordHash && options.secret)

  const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    if (!enabled) {
      next()
      return
    }
    const token = readCookie(req, AUTH_COOKIE_NAME)
    if (isTokenValid(token, options.secret)) {
      next()
      return
    }
    res.status(401).json({ error: 'unauthorized', msg: '请先输入访问密码。' })
  }

  const handleStatus = (req: Request, res: Response): void => {
    if (!enabled) {
      res.json({ enabled: false, authed: true })
      return
    }
    const token = readCookie(req, AUTH_COOKIE_NAME)
    res.json({ enabled: true, authed: isTokenValid(token, options.secret) })
  }

  const handleLogin = (req: Request, res: Response): void => {
    if (!enabled) {
      res.json({ ok: true })
      return
    }
    const ip = clientIp(req)
    const record = failureByIp.get(ip)
    const now = Date.now()
    if (record && record.lockUntil > now) {
      const retryAfter = Math.ceil((record.lockUntil - now) / 1000)
      res.status(429).json({
        error: 'locked',
        msg: `失败次数过多，请 ${Math.ceil(retryAfter / 60)} 分钟后再试。`,
        retry_after: retryAfter,
      })
      return
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (password.length < 6 || password.length > 128 || !verifyPassword(password, options.passwordHash)) {
      // 仅当「曾经锁定且锁已过期」时把计数归零重计；lockUntil=0 表示从未锁定，保持累计
      const lockExpired = Boolean(record && record.lockUntil !== 0 && record.lockUntil <= now)
      const current = lockExpired
        ? { count: 1, lockUntil: 0 }
        : {
            count: (record?.count ?? 0) + 1,
            lockUntil: record?.lockUntil ?? 0,
          }
      if (current.count >= MAX_FAILURES) current.lockUntil = now + LOCK_MS
      failureByIp.set(ip, current)
      if (current.lockUntil > now) {
        res.status(429).json({
          error: 'locked',
          msg: `连续失败 ${MAX_FAILURES} 次，已锁定 15 分钟。`,
          retry_after: LOCK_MS / 1000,
        })
        return
      }
      res.status(401).json({
        error: 'bad_password',
        msg: `访问密码错误，还可尝试 ${MAX_FAILURES - current.count} 次。`,
        remaining: MAX_FAILURES - current.count,
      })
      return
    }

    failureByIp.delete(ip)
    setAuthCookie(req, res, issueToken(options.secret))
    res.json({ ok: true })
  }

  const handleLogout = (_req: Request, res: Response): void => {
    clearAuthCookie(res)
    res.json({ ok: true })
  }

  return { enabled, requireAuth, handleStatus, handleLogin, handleLogout }
}

// 生成 scrypt 密码哈希，供写入 server/.env：node --import tsx server/src/auth.ts <password>
if (process.argv[1] && process.argv[1].endsWith('auth.ts')) {
  const password = process.argv[2]
  if (!password) {
    console.error('用法：tsx server/src/auth.ts <password>')
    process.exit(1)
  }
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)
  console.log(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}`)
}
