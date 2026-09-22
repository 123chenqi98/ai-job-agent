import { useCallback, useEffect, useMemo, useState } from 'react'
import ApplicationFormModal from '@/components/ApplicationFormModal'
import StateView from '@/components/common/StateView'
import { useAccount } from '@/auth/AuthProvider'
import {
  deleteApplication,
  listApplications,
  updateApplication,
} from '@/data/applications'
import type { UserApplication, UserApplicationStatus } from '@/types'
import styles from './ApplicationBoard.module.css'

const COLUMNS: Array<{
  key: UserApplicationStatus
  label: string
  accent: 'primary' | 'warning' | 'success' | 'danger'
}> = [
  { key: 'applied', label: '已投递', accent: 'primary' },
  { key: 'written_test', label: '笔试中', accent: 'warning' },
  { key: 'interview', label: '面试中', accent: 'success' },
  { key: 'offer', label: 'Offer', accent: 'success' },
  { key: 'rejected', label: '已回绝', accent: 'danger' },
]

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export default function ApplicationBoard() {
  const { logged } = useAccount()
  const [items, setItems] = useState<UserApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<UserApplication | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listApplications()
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取投递记录失败。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (logged) void load()
  }, [logged, load])

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除这条投递记录吗？')) return
    try {
      await deleteApplication(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败。')
    }
  }

  const handleStatusChange = async (id: string, status: UserApplicationStatus) => {
    try {
      const updated = await updateApplication(id, { status })
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '更新状态失败。')
    }
  }

  const grouped = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      items: items.filter((i) => i.status === col.key),
    }))
  }, [items])

  if (!logged) {
    return (
      <div className={styles.page}>
        <StateView title="请先登录" description="登录后即可查看和管理你自己的投递看板。" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <StateView title="正在加载投递看板…" description="读取你的投递记录。" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <StateView
          title="加载失败"
          description={error}
          actions={
            <button type="button" className={styles.refreshButton} onClick={() => void load()}>
              重试
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>投递看板</h1>
          <p className={styles.subtitle}>
            共 {items.length} 条投递记录，仅你本人可见；从岗位池点「加入投递」即可记录，在此跟踪进度。
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshButton}
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? '加载中…' : '刷新'}
          </button>
        </div>
      </header>

      {actionError ? (
        <div className={styles.actionError} onClick={() => setActionError(null)}>
          {actionError}（点击关闭）
        </div>
      ) : null}

      {items.length === 0 ? (
        <StateView
          title="还没有投递记录"
          description="去「岗位池」找到心仪岗位，点「加入投递」即可记录并跟踪进度。"
        />
      ) : (
        <div className={styles.board}>
          {grouped.map((col) => (
            <div key={col.key} className={`${styles.column} ${styles[`accent_${col.accent}`]}`}>
              <div className={styles.columnHeader}>
                <span className={styles.columnLabel}>{col.label}</span>
                <span className={styles.columnCount}>{col.items.length}</span>
              </div>
              <div className={styles.columnBody}>
                {col.items.map((item) => (
                  <div key={item.id} className={styles.card}>
                    <div className={styles.cardHead}>
                      <span className={styles.cardCompany}>{item.company}</span>
                      <select
                        className={styles.cardStatus}
                        value={item.status}
                        onChange={(e) =>
                          void handleStatusChange(item.id, e.target.value as UserApplicationStatus)
                        }
                        title="切换状态"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.cardTitle}>{item.job_title}</div>
                    {item.note ? <div className={styles.cardNote}>{item.note}</div> : null}
                    <div className={styles.cardMeta}>
                      <span>投递 {formatDate(item.applied_at)}</span>
                      {item.job_url ? (
                        <a
                          className={styles.cardLink}
                          href={item.job_url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          网申链接
                        </a>
                      ) : null}
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.cardEditBtn}
                        onClick={() => setEditing(item)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className={styles.cardDeleteBtn}
                        onClick={() => void handleDelete(item.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className={styles.note}>
        投递记录按账号隔离存储在本地服务器 SQLite，仅你本人可见；工作台不执行自动投递，
        「立即投递」仅打开官方网申页面。
      </p>

      {editing ? (
        <ApplicationFormModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(record) => {
            setItems((prev) => prev.map((i) => (i.id === record.id ? record : i)))
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}
