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
  paid: boolean
  resume: ResumeMeta | null
}

interface AccountRow {
  user_id: string
  username: string
  username_lower: string
  password: string
  recovery_code: string
  created_at: string
  paid: number
  resume_filename: string | null
  resume_original_name: string | null
  resume_size: number | null
  resume_uploaded_at: string | null
}

// 付款凭证（个人收款码无法自动到账，用户上传截图后由站长人工审核）
export type ProofStatus = 'pending' | 'approved' | 'rejected'

export interface PaymentProof {
  id: string
  user_id: string
  filename: string
  size: number
  status: ProofStatus
  reject_reason: string
  created_at: string
  reviewed_at: string | null
}

interface PaymentProofRow {
  id: string
  user_id: string
  filename: string
  size: number
  status: ProofStatus
  reject_reason: string | null
  created_at: string
  reviewed_at: string | null
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

  // ---- 轻量迁移（幂等）：付费门槛上线 ----
  const columns = database.prepare('PRAGMA table_info(accounts)').all() as Array<{ name: string }>
  if (!columns.some((c) => c.name === 'paid')) {
    database.exec('ALTER TABLE accounts ADD COLUMN paid INTEGER NOT NULL DEFAULT 0')
    // 既有账号全部视为已开通（老用户免费）；此后新注册默认 0
    database.exec('UPDATE accounts SET paid = 1')
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS payment_proofs (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      filename      TEXT NOT NULL,
      size          INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      reject_reason TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL,
      reviewed_at   TEXT
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
    paid: row.paid === 1,
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
    paid: false,
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

// 删除账号：仅站长管理接口调用，返回被删记录数（0 表示账号不存在）
export async function deleteAccount(userId: string): Promise<number> {
  const info = db().prepare('DELETE FROM accounts WHERE user_id = ?').run(userId)
  return Number(info.changes)
}

export async function resetPassword(userId: string, password: string): Promise<void> {
  const info = db()
    .prepare("UPDATE accounts SET password = ?, recovery_code = '' WHERE user_id = ?")
    .run(password, userId)
  if (Number(info.changes) === 0) throw new AccountError('account_missing', '账号不存在。')
}

// ---- 付款凭证：上传 / 查询 / 站长审核 ----

function proofRowToRecord(row: PaymentProofRow): PaymentProof {
  return {
    id: row.id,
    user_id: row.user_id,
    filename: row.filename,
    size: row.size,
    status: row.status,
    reject_reason: row.reject_reason ?? '',
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
  }
}

function newProofId(): string {
  return `p_${crypto.randomBytes(9).toString('base64url')}`
}

// 某账号最新一条凭证（前端据此显示 待审核 / 已拒绝）
export async function getLatestProof(userId: string): Promise<PaymentProof | null> {
  const row = db()
    .prepare('SELECT * FROM payment_proofs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(userId) as PaymentProofRow | undefined
  return row ? proofRowToRecord(row) : null
}

export async function hasPendingProof(userId: string): Promise<boolean> {
  const row = db()
    .prepare('SELECT 1 FROM payment_proofs WHERE user_id = ? AND status = ? LIMIT 1')
    .get(userId, 'pending')
  return Boolean(row)
}

export async function createProof(input: {
  userId: string
  filename: string
  size: number
}): Promise<PaymentProof> {
  const record: PaymentProof = {
    id: newProofId(),
    user_id: input.userId,
    filename: input.filename,
    size: input.size,
    status: 'pending',
    reject_reason: '',
    created_at: new Date().toISOString(),
    reviewed_at: null,
  }
  db()
    .prepare(
      `INSERT INTO payment_proofs
         (id, user_id, filename, size, status, reject_reason, created_at, reviewed_at)
       VALUES
         (@id, @user_id, @filename, @size, @status, @reject_reason, @created_at, NULL)`,
    )
    .run({
      id: record.id,
      user_id: record.user_id,
      filename: record.filename,
      size: record.size,
      status: record.status,
      reject_reason: record.reject_reason,
      created_at: record.created_at,
    })
  return record
}

export interface AdminProofItem extends PaymentProof {
  username: string
}

// 站长审核队列：默认只看待审核；可传 status 拉全部
export async function listProofsForAdmin(filter: ProofStatus | 'all' = 'pending'): Promise<AdminProofItem[]> {
  const sql =
    filter === 'all'
      ? `SELECT pp.*, a.username AS username
           FROM payment_proofs pp JOIN accounts a ON a.user_id = pp.user_id
          ORDER BY (pp.status = 'pending') DESC, pp.created_at DESC`
      : `SELECT pp.*, a.username AS username
           FROM payment_proofs pp JOIN accounts a ON a.user_id = pp.user_id
          WHERE pp.status = ?
          ORDER BY pp.created_at ASC`
  const rows = (filter === 'all' ? db().prepare(sql).all() : db().prepare(sql).all(filter)) as unknown as Array<
    PaymentProofRow & { username: string }
  >
  return rows.map((r) => ({ ...proofRowToRecord(r), username: r.username }))
}

export async function findProofById(proofId: string): Promise<PaymentProof | null> {
  const row = db().prepare('SELECT * FROM payment_proofs WHERE id = ?').get(proofId) as
    | PaymentProofRow
    | undefined
  return row ? proofRowToRecord(row) : null
}

// 通过：凭证置 approved，同时把对应账号 paid=1（单事务，保证一致）
export async function approveProof(proofId: string): Promise<number> {
  const database = db()
  let affected = 0
  database.exec('BEGIN')
  try {
    const info = database
      .prepare("UPDATE payment_proofs SET status = 'approved', reviewed_at = ? WHERE id = ? AND status = 'pending'")
      .run(new Date().toISOString(), proofId)
    affected = Number(info.changes)
    if (affected > 0) {
      const proof = database.prepare('SELECT user_id FROM payment_proofs WHERE id = ?').get(proofId) as
        | { user_id: string }
        | undefined
      if (proof) database.prepare('UPDATE accounts SET paid = 1 WHERE user_id = ?').run(proof.user_id)
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return affected
}

// 拒绝：记录原因，用户可重新上传；不改变 paid
export async function rejectProof(proofId: string, reason: string): Promise<number> {
  const info = db()
    .prepare(
      "UPDATE payment_proofs SET status = 'rejected', reject_reason = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'",
    )
    .run(reason.slice(0, 200), new Date().toISOString(), proofId)
  return Number(info.changes)
}

// 站长手动设置开通状态（备用：私下转账后直接开通/收回）
export async function setAccountPaid(userId: string, paid: boolean): Promise<number> {
  const info = db().prepare('UPDATE accounts SET paid = ? WHERE user_id = ?').run(paid ? 1 : 0, userId)
  return Number(info.changes)
}

export class AccountError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
