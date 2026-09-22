import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// 投递记录存储：按 user_id 隔离，每位用户只看到自己的投递进展。

export type ApplicationStatus =
  | 'applied' // 已投递
  | 'written_test' // 笔试中
  | 'interview' // 面试中
  | 'offer' // 已获 Offer
  | 'rejected' // 已回绝

export interface ApplicationRecord {
  id: string
  user_id: string
  company: string
  job_title: string
  job_url: string
  status: ApplicationStatus
  note: string
  applied_at: string
  updated_at: string
}

interface ApplicationRow {
  id: string
  user_id: string
  company: string
  job_title: string
  job_url: string
  status: ApplicationStatus
  note: string
  applied_at: string
  updated_at: string
}

export const VALID_STATUSES: ApplicationStatus[] = [
  'applied',
  'written_test',
  'interview',
  'offer',
  'rejected',
]

const DATA_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data')
const DB_PATH = path.join(DATA_DIR, 'accounts.db')

let dbInstance: DatabaseSync | null = null

function db(): DatabaseSync {
  if (dbInstance) return dbInstance
  mkdirSync(DATA_DIR, { recursive: true })
  const database = new DatabaseSync(DB_PATH)
  database.exec('PRAGMA journal_mode = WAL')
  database.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      company     TEXT NOT NULL,
      job_title   TEXT NOT NULL,
      job_url     TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'applied',
      note        TEXT NOT NULL DEFAULT '',
      applied_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
  `)
  dbInstance = database
  return database
}

function rowToRecord(row: ApplicationRow): ApplicationRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    company: row.company,
    job_title: row.job_title,
    job_url: row.job_url,
    status: row.status,
    note: row.note,
    applied_at: row.applied_at,
    updated_at: row.updated_at,
  }
}

function newApplicationId(): string {
  return `a_${crypto.randomBytes(9).toString('base64url')}`
}

export interface CreateApplicationInput {
  userId: string
  company: string
  job_title: string
  job_url?: string
  status?: ApplicationStatus
  note?: string
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<ApplicationRecord> {
  const now = new Date().toISOString()
  const record: ApplicationRecord = {
    id: newApplicationId(),
    user_id: input.userId,
    company: input.company.trim(),
    job_title: input.job_title.trim(),
    job_url: (input.job_url ?? '').trim(),
    status: input.status ?? 'applied',
    note: (input.note ?? '').trim(),
    applied_at: now,
    updated_at: now,
  }
  db()
    .prepare(
      `INSERT INTO applications
         (id, user_id, company, job_title, job_url, status, note, applied_at, updated_at)
       VALUES
         (@id, @user_id, @company, @job_title, @job_url, @status, @note, @applied_at, @updated_at)`,
    )
    .run({
      id: record.id,
      user_id: record.user_id,
      company: record.company,
      job_title: record.job_title,
      job_url: record.job_url,
      status: record.status,
      note: record.note,
      applied_at: record.applied_at,
      updated_at: record.updated_at,
    })
  return record
}

export async function listApplications(userId: string): Promise<ApplicationRecord[]> {
  const rows = db()
    .prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY updated_at DESC')
    .all(userId) as unknown as ApplicationRow[]
  return rows.map(rowToRecord)
}

export async function findApplicationById(
  id: string,
): Promise<ApplicationRecord | null> {
  const row = db()
    .prepare('SELECT * FROM applications WHERE id = ?')
    .get(id) as unknown as ApplicationRow | undefined
  return row ? rowToRecord(row) : null
}

export interface UpdateApplicationInput {
  company?: string
  job_title?: string
  job_url?: string
  status?: ApplicationStatus
  note?: string
}

export async function updateApplication(
  id: string,
  userId: string,
  input: UpdateApplicationInput,
): Promise<ApplicationRecord | null> {
  const existing = await findApplicationById(id)
  if (!existing || existing.user_id !== userId) return null

  const now = new Date().toISOString()
  const updated: ApplicationRecord = {
    ...existing,
    company: input.company?.trim() ?? existing.company,
    job_title: input.job_title?.trim() ?? existing.job_title,
    job_url: input.job_url?.trim() ?? existing.job_url,
    status: input.status ?? existing.status,
    note: input.note?.trim() ?? existing.note,
    updated_at: now,
  }

  db()
    .prepare(
      `UPDATE applications SET
         company = @company,
         job_title = @job_title,
         job_url = @job_url,
         status = @status,
         note = @note,
         updated_at = @updated_at
       WHERE id = @id AND user_id = @user_id`,
    )
    .run({
      id: updated.id,
      user_id: userId,
      company: updated.company,
      job_title: updated.job_title,
      job_url: updated.job_url,
      status: updated.status,
      note: updated.note,
      updated_at: updated.updated_at,
    })
  return updated
}

export async function deleteApplication(
  id: string,
  userId: string,
): Promise<boolean> {
  const result = db()
    .prepare('DELETE FROM applications WHERE id = ? AND user_id = ?')
    .run(id, userId)
  return (result.changes ?? 0) > 0
}

export interface ApplicationStats {
  total: number
  applied: number
  written_test: number
  interview: number
  offer: number
  rejected: number
  recent: ApplicationRecord[]
}

export async function getApplicationStats(userId: string): Promise<ApplicationStats> {
  const items = await listApplications(userId)
  const count = (s: ApplicationStatus) => items.filter((i) => i.status === s).length
  return {
    total: items.length,
    applied: count('applied'),
    written_test: count('written_test'),
    interview: count('interview'),
    offer: count('offer'),
    rejected: count('rejected'),
    recent: items.slice(0, 5),
  }
}
