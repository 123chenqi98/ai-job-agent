import crypto from 'node:crypto'

// 账号密码按站长要求以明文存储，登录 / 找回时由路由直接比对，无需哈希。
// 这里只负责生成一次性恢复码：去掉易混字符（0/O/1/I/L）的 10 位 base32，分组展示。

const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function generateRecoveryCode(): string {
  const bytes = crypto.randomBytes(10)
  const code = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('')
  return `${code.slice(0, 5)}-${code.slice(5)}`
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}
