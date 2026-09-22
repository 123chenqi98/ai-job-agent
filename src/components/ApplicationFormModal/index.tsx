import { useEffect, useState } from 'react'
import {
  createApplication,
  updateApplication,
} from '@/data/applications'
import type {
  UserApplication,
  UserApplicationStatus,
} from '@/types'
import styles from './ApplicationFormModal.module.css'

const STATUS_OPTIONS: Array<{ value: UserApplicationStatus; label: string }> = [
  { value: 'applied', label: '已投递' },
  { value: 'written_test', label: '笔试中' },
  { value: 'interview', label: '面试中' },
  { value: 'offer', label: '已获 Offer' },
  { value: 'rejected', label: '已回绝' },
]

interface ApplicationFormModalProps {
  /** 预填值：从岗位卡片带入 */
  defaultValues?: {
    company: string
    job_title: string
    job_url?: string
  }
  /** 编辑模式下传入已有记录 */
  editing?: UserApplication | null
  onClose: () => void
  onSaved: (record: UserApplication) => void
}

export default function ApplicationFormModal({
  defaultValues,
  editing,
  onClose,
  onSaved,
}: ApplicationFormModalProps) {
  const [company, setCompany] = useState(editing?.company ?? defaultValues?.company ?? '')
  const [jobTitle, setJobTitle] = useState(editing?.job_title ?? defaultValues?.job_title ?? '')
  const [jobUrl, setJobUrl] = useState(editing?.job_url ?? defaultValues?.job_url ?? '')
  const [status, setStatus] = useState<UserApplicationStatus>(editing?.status ?? 'applied')
  const [note, setNote] = useState(editing?.note ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!company.trim() || !jobTitle.trim()) {
      setError('公司名称与岗位名称不能为空。')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        company: company.trim(),
        job_title: jobTitle.trim(),
        job_url: jobUrl.trim(),
        status,
        note: note.trim(),
      }
      const record = editing
        ? await updateApplication(editing.id, payload)
        : await createApplication(payload)
      onSaved(record)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{editing ? '编辑投递记录' : '加入投递'}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>公司名称</span>
            <input
              className={styles.input}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="如：字节跳动"
              autoFocus
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>岗位名称</span>
            <input
              className={styles.input}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="如：数据分析师"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>投递状态</span>
            <select
              className={styles.input}
              value={status}
              onChange={(e) => setStatus(e.target.value as UserApplicationStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>投递链接（可选）</span>
            <input
              className={styles.input}
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="网申页面 URL"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>备注（可选）</span>
            <textarea
              className={styles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：内推码 xxx、笔试时间等"
              rows={3}
            />
          </label>
          {error ? <div className={styles.error}>{error}</div> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              取消
            </button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? '保存中…' : editing ? '保存修改' : '保存投递'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
