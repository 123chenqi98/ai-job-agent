import crypto from 'node:crypto'

// 账号密码 / 恢复码的 scrypt 哈希：格式 scrypt$<saltHex>$<hashHex>

const SCRYPT_KEYLEN = 64
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(secret, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifySecret(secret: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'hex')
  const expected = Buffer.from(parts[2], 'hex')
  if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) return false
  let actual: Buffer
  try {
    actual = crypto.scryptSync(secret, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)
  } catch {
    return false
  }
  return crypto.timingSafeEqual(actual, expected)
}

// 一次性恢复码：去掉易混字符（0/O/1/I/L）的 10 位 base32，分组展示
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function generateRecoveryCode(): string {
  const bytes = crypto.randomBytes(10)
  const code = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('')
  return `${code.slice(0, 5)}-${code.slice(5)}`
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}
