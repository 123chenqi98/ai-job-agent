import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// 轻量账号存储：100 人规模无需数据库，JSON 文件 + 原子落盘。
// 单进程 Node 下 Map 为权威状态，启动时加载一次，每次变更后 tmp+rename 持久化。

export interface ResumeMeta {
  filename: string
  original_name: string
  size: number
  uploaded_at: string
}

export interface AccountRecord {
  user_id: string
  username: string
  username_lower: string
  password_hash: string
  recovery_hash: string
  created_at: string
  resume: ResumeMeta | null
}

interface StoreShape {
  version: 1
  accounts: AccountRecord[]
}

const DATA_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data')
const STORE_PATH = path.join(DATA_DIR, 'accounts.json')

let cache: Map<string, AccountRecord> | null = null
let writeChain: Promise<void> = Promise.resolve()

async function load(): Promise<Map<string, AccountRecord>> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as StoreShape
    cache = new Map((parsed.accounts ?? []).map((a) => [a.user_id, a]))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    cache = new Map()
  }
  return cache
}

function persist(): void {
  const snapshot: StoreShape = {
    version: 1,
    accounts: cache ? [...cache.values()] : [],
  }
  const payload = JSON.stringify(snapshot, null, 2)
  // 串行化写入，避免并发请求互相覆盖；tmp+rename 保证 accounts.json 不会写坏
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const tmp = path.join(DATA_DIR, `.accounts.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`)
    await fs.writeFile(tmp, payload, 'utf8')
    await fs.rename(tmp, STORE_PATH)
  })
  void writeChain.catch(() => undefined)
}

function newUserId(): string {
  return `u_${crypto.randomBytes(9).toString('base64url')}`
}

export async function createAccount(input: {
  username: string
  passwordHash: string
  recoveryHash: string
}): Promise<AccountRecord> {
  const accounts = await load()
  const username = input.username.trim()
  const lower = username.toLowerCase()
  if ([...accounts.values()].some((a) => a.username_lower === lower)) {
    throw new AccountError('username_taken', '该账号名已被使用，换一个试试。')
  }
  const record: AccountRecord = {
    user_id: newUserId(),
    username,
    username_lower: lower,
    password_hash: input.passwordHash,
    recovery_hash: input.recoveryHash,
    created_at: new Date().toISOString(),
    resume: null,
  }
  accounts.set(record.user_id, record)
  persist()
  return record
}

export async function findByUsername(username: string): Promise<AccountRecord | null> {
  const accounts = await load()
  return (
    [...accounts.values()].find((a) => a.username_lower === username.trim().toLowerCase()) ?? null
  )
}

export async function findById(userId: string): Promise<AccountRecord | null> {
  const accounts = await load()
  return accounts.get(userId) ?? null
}

export async function setResume(userId: string, meta: ResumeMeta): Promise<void> {
  const accounts = await load()
  const record = accounts.get(userId)
  if (!record) throw new AccountError('account_missing', '账号不存在。')
  record.resume = meta
  persist()
}

export async function clearResume(userId: string): Promise<void> {
  const accounts = await load()
  const record = accounts.get(userId)
  if (!record) throw new AccountError('account_missing', '账号不存在。')
  record.resume = null
  persist()
}

export async function resetPassword(userId: string, passwordHash: string): Promise<void> {
  const accounts = await load()
  const record = accounts.get(userId)
  if (!record) throw new AccountError('account_missing', '账号不存在。')
  record.password_hash = passwordHash
  // 恢复码一次性，用过即失效（清空哈希）
  record.recovery_hash = ''
  persist()
}

export class AccountError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
