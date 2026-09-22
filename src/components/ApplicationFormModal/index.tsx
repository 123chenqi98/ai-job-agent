import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createApplication,
  updateApplication,
} from '@/data/applications'
import type {
  UserApplication,
  UserApplicationStatus,
} from '@/types'
import { splitJobTitles } from './splitJobs'
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
  /** 该公司在岗位池行中的可选岗位列表（已拆分）；不传则按编辑值兜底 */
  jobOptions?: string[]
  /** 编辑模式下传入已有记录 */
  editing?: UserApplication | null
  onClose: () => void
  onSaved: (record: UserApplication) => void
}

/* 可搜索下拉单选：岗位较多时可输入关键词过滤，必须选定一个才能保存 */
function JobSelect({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    searchRef.current?.focus()
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, query])

  return (
    <div className={styles.jobSelect} ref={rootRef}>
      <button
        type="button"
        className={`${styles.jobSelectTrigger} ${value ? '' : styles.jobSelectPlaceholder}`}
        onClick={() => {
          setOpen((v) => !v)
          setQuery('')
        }}
      >
        <span className={styles.jobSelectValue}>{value || '请选择岗位'}</span>
        <span className={styles.jobSelectCaret}>▾</span>
      </button>
      {open ? (
        <div className={styles.jobSelectPanel}>
          <input
            ref={searchRef}
            className={styles.jobSelectSearch}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入关键词搜索岗位"
          />
          <div className={styles.jobSelectList}>
            {filtered.length === 0 ? (
              <div className={styles.jobSelectEmpty}>没有匹配的岗位</div>
            ) : (
              filtered.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={`${styles.jobSelectOption} ${
                    opt === value ? styles.jobSelectOptionActive : ''
                  }`}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function ApplicationFormModal({
  defaultValues,
  jobOptions,
  editing,
  onClose,
  onSaved,
}: ApplicationFormModalProps) {
  const [company, setCompany] = useState(editing?.company ?? defaultValues?.company ?? '')
  const [jobTitle, setJobTitle] = useState(editing?.job_title ?? '')
  const [jobUrl, setJobUrl] = useState(editing?.job_url ?? defaultValues?.job_url ?? '')
  const [status, setStatus] = useState<UserApplicationStatus>(editing?.status ?? 'applied')
  const [note, setNote] = useState(editing?.note ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 下拉选项：优先用表格行传入的岗位列表；编辑模式下保证当前岗位在选项中
  const options = useMemo(() => {
    const base = jobOptions ?? (defaultValues?.job_title ? splitJobTitles(defaultValues.job_title) : [])
    if (editing?.job_title && !base.includes(editing.job_title)) {
      return [editing.job_title, ...base]
    }
    return base
  }, [jobOptions, defaultValues?.job_title, editing?.job_title])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!company.trim()) {
      setError('公司名称不能为空。')
      return
    }
    if (!jobTitle) {
      setError('请从下拉列表中选择一个具体岗位。')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        company: company.trim(),
        job_title: jobTitle,
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
          <div className={styles.field}>
            <span className={styles.label}>
              岗位名称 <span className={styles.required}>*</span>
            </span>
            <JobSelect options={options} value={jobTitle} onChange={setJobTitle} />
            <span className={styles.fieldHint}>下拉选择该公司的具体岗位，必选后才能保存</span>
          </div>
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
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting || !jobTitle}
              title={!jobTitle ? '请先选择岗位' : undefined}
            >
              {submitting ? '保存中…' : editing ? '保存修改' : '保存投递'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
