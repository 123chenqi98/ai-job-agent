import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

// 账号会话：HMAC 签名的 HttpOnly Cookie（payload 含 uid + 过期时间），7 天有效。
// 另含按 IP 的登录失败锁定与 requireUser 鉴权中间件。

export const SESSION_COOKIE_NAME = 'aj_session'
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

function issueToken(secret: string, userId: string): string {
  const payload = base64url(JSON.stringify({ uid: userId, exp: Date.now() + COOKIE_MAX_AGE_MS }))
  return `${payload}.${sign(payload, secret)}`
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const piece of header.split(';')) {
    const idx = piece.indexOf('=')
    if (idx < 0) continue
    if (piece.slice(0, idx).trim() === name) return decodeURIComponent(piece.slice(idx + 1).trim())
  }
  return null
}

function resolveToken(token: string | null, secret: string): string | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (sign(payload, secret) !== signature) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: string
      exp?: number
    }
    if (typeof claims.uid === 'string' && typeof claims.exp === 'number' && claims.exp > Date.now()) {
      return claims.uid
    }
  } catch {
    return null
  }
  return null
}

export function setSessionCookie(req: Request, res: Response, secret: string, userId: string): void {
  const secure = req.secure ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(issueToken(secret, userId))}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE_MS / 1000}`,
  )
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  )
}

// ---- 登录失败锁定（按 IP，与旧门禁同规则） ----

interface FailureRecord {
  count: number
  lockUntil: number
}
const failureByIp = new Map<string, FailureRecord>()

export function precheckLoginLock(req: Request, res: Response): boolean {
  const record = failureByIp.get(req.ip ?? 'unknown')
  if (record && record.lockUntil > Date.now()) {
    const retryAfter = Math.ceil((record.lockUntil - Date.now()) / 1000)
    res.status(429).json({
      error: 'locked',
      msg: `失败次数过多，请 ${Math.ceil(retryAfter / 60)} 分钟后再试。`,
      retry_after: retryAfter,
    })
    return true
  }
  return false
}

export function recordLoginFailure(req: Request, res: Response): void {
  const ip = req.ip ?? 'unknown'
  const now = Date.now()
  const prev = failureByIp.get(ip)
  const lockExpired = Boolean(prev && prev.lockUntil !== 0 && prev.lockUntil <= now)
  const current = lockExpired
    ? { count: 1, lockUntil: 0 }
    : { count: (prev?.count ?? 0) + 1, lockUntil: prev?.lockUntil ?? 0 }
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
    error: 'bad_credentials',
    msg: `账号名或密码错误，还可尝试 ${MAX_FAILURES - current.count} 次。`,
    remaining: MAX_FAILURES - current.count,
  })
}

export function clearLoginFailures(req: Request): void {
  failureByIp.delete(req.ip ?? 'unknown')
}

// ---- 鉴权中间件 ----

export function readUserId(req: Request, secret: string): string | null {
  return resolveToken(readCookie(req, SESSION_COOKIE_NAME), secret)
}

export function requireUser(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = resolveToken(readCookie(req, SESSION_COOKIE_NAME), secret)
    if (!userId) {
      res.status(401).json({ error: 'unauthorized', msg: '请先登录账号。' })
      return
    }
    req.userId = userId
    next()
  }
}
