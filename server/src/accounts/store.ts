import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// 账号存储：Node 内置 SQLite（node:sqlite，需 --experimental-sqlite）。
// 单文件数据库 server/data/accounts.db，WAL 模式提升并发，事务提交即落盘。
// 说明：按站长要求，password 与 recovery_code 均以明文直接存储。

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
  password: string
  recovery_code: string
  created_at: string
  resume: ResumeMeta | null
}

interface AccountRow {
  user_id: string
  username: string
  username_lower: string
  password: string
  recovery_code: string
  created_at: string
  resume_filename: string | null
  resume_original_name: string | null
  resume_size: number | null
  resume_uploaded_at: string | null
}

const DATA_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data')
const DB_PATH = path.join(DATA_DIR, 'accounts.db')

let dbInstance: DatabaseSync | null = null

function db(): DatabaseSync {
  if (dbInstance) return dbInstance
  mkdirSync(DATA_DIR, { recursive: true })
  const database = new DatabaseSync(DB_PATH)
  database.exec('PRAGMA journal_mode = WAL')
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      user_id              TEXT PRIMARY KEY,
      username             TEXT NOT NULL,
      username_lower       TEXT NOT NULL UNIQUE,
      password             TEXT NOT NULL,
      recovery_code        TEXT NOT NULL DEFAULT '',
      created_at           TEXT NOT NULL,
      resume_filename      TEXT,
      resume_original_name TEXT,
      resume_size          INTEGER,
      resume_uploaded_at   TEXT
    );
  `)
  dbInstance = database
  return database
}

function rowToRecord(row: AccountRow): AccountRecord {
  const resume =
    row.resume_filename && row.resume_original_name && row.resume_size != null && row.resume_uploaded_at
      ? {
          filename: row.resume_filename,
          original_name: row.resume_original_name,
          size: row.resume_size,
          uploaded_at: row.resume_uploaded_at,
        }
      : null
  return {
    user_id: row.user_id,
    username: row.username,
    username_lower: row.username_lower,
    password: row.password,
    recovery_code: row.recovery_code,
    created_at: row.created_at,
    resume,
  }
}

function newUserId(): string {
  return `u_${crypto.randomBytes(9).toString('base64url')}`
}

export async function createAccount(input: {
  username: string
  password: string
  recoveryCode: string
}): Promise<AccountRecord> {
  const username = input.username.trim()
  const lower = username.toLowerCase()
  const database = db()
  const taken = database.prepare('SELECT 1 FROM accounts WHERE username_lower = ?').get(lower)
  if (taken) {
    throw new AccountError('username_taken', '该账号名已被使用，换一个试试。')
  }
  const record: AccountRecord = {
    user_id: newUserId(),
    username,
    username_lower: lower,
    password: input.password,
    recovery_code: input.recoveryCode,
    created_at: new Date().toISOString(),
    resume: null,
  }
  try {
    database
      .prepare(
        `INSERT INTO accounts
           (user_id, username, username_lower, password, recovery_code, created_at,
            resume_filename, resume_original_name, resume_size, resume_uploaded_at)
         VALUES
           (@user_id, @username, @username_lower, @password, @recovery_code, @created_at,
            NULL, NULL, NULL, NULL)`,
      )
      .run({
        user_id: record.user_id,
        username: record.username,
        username_lower: record.username_lower,
        password: record.password,
        recovery_code: record.recovery_code,
        created_at: record.created_at,
      })
  } catch (error) {
    if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new AccountError('username_taken', '该账号名已被使用，换一个试试。')
    }
    throw error
  }
  return record
}

export async function findByUsername(username: string): Promise<AccountRecord | null> {
  const row = db()
    .prepare('SELECT * FROM accounts WHERE username_lower = ?')
    .get(username.trim().toLowerCase()) as AccountRow | undefined
  return row ? rowToRecord(row) : null
}

export async function findById(userId: string): Promise<AccountRecord | null> {
  const row = db().prepare('SELECT * FROM accounts WHERE user_id = ?').get(userId) as
    | AccountRow
    | undefined
  return row ? rowToRecord(row) : null
}

// 列出全部账号：仅站长管理接口使用，按注册时间升序，返回完整记录（含明文密码，由路由决定是否下发）
export async function listAccounts(): Promise<AccountRecord[]> {
  const rows = db()
    .prepare('SELECT * FROM accounts ORDER BY created_at ASC')
    .all() as unknown as AccountRow[]
  return rows.map(rowToRecord)
}

export async function setResume(userId: string, meta: ResumeMeta): Promise<void> {
  const info = db()
    .prepare(
      `UPDATE accounts
         SET resume_filename = ?, resume_original_name = ?, resume_size = ?, resume_uploaded_at = ?
       WHERE user_id = ?`,
    )
    .run(meta.filename, meta.original_name, meta.size, meta.uploaded_at, userId)
  if (Number(info.changes) === 0) throw new AccountError('account_missing', '账号不存在。')
}

export async function clearResume(userId: string): Promise<void> {
  const info = db()
    .prepare(
      `UPDATE accounts
         SET resume_filename = NULL, resume_original_name = NULL, resume_size = NULL,
             resume_uploaded_at = NULL
       WHERE user_id = ?`,
    )
    .run(userId)
  if (Number(info.changes) === 0) throw new AccountError('account_missing', '账号不存在。')
}

export async function resetPassword(userId: string, password: string): Promise<void> {
  const info = db()
    .prepare("UPDATE accounts SET password = ?, recovery_code = '' WHERE user_id = ?")
    .run(password, userId)
  if (Number(info.changes) === 0) throw new AccountError('account_missing', '账号不存在。')
}

export class AccountError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
