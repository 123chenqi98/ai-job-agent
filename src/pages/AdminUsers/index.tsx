import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '@/auth/AuthProvider'
import { fetchAdminUsers, revealAdminPasswords } from '@/auth/authClient'
import type { AdminUserItem } from '@/types/resume'
import styles from './AdminUsers.module.css'

// 站长用户管理：列表默认不含密码；输入站长本人登录密码后口令通过，
// 密码仍默认打码，逐行点击眼睛按需揭示。

type ListState = 'loading' | 'unauthorized' | 'forbidden' | 'error' | 'ready'

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {open ? null : <path d="M4 4l16 16" />}
    </svg>
  )
}

function PasswordCell({
  password,
  revealed,
  onToggle,
}: {
  password: string | null
  revealed: boolean
  onToggle: () => void
}) {
  if (password === null) {
    return (
      <span className={styles.lockedDots} title="需先输入站长口令解锁">
        ••••••••
      </span>
    )
  }
  return (
    <span className={styles.passwordBox}>
      <span className={revealed ? styles.passwordText : styles.passwordDots}>
        {revealed ? password : '••••••••'}
      </span>
      <button
        type="button"
        className={styles.eyeButton}
        onClick={onToggle}
        title={revealed ? '隐藏密码' : '显示密码'}
        aria-label={revealed ? '隐藏密码' : '显示密码'}
      >
        <EyeIcon open={revealed} />
      </button>
    </span>
  )
}

export default function AdminUsers() {
  const { loading: authLoading } = useAccount()
  const [listState, setListState] = useState<ListState>('loading')
  const [users, setUsers] = useState<AdminUserItem[]>([])

  const [passwordInput, setPasswordInput] = useState('')
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState('')
  const [passwordMap, setPasswordMap] = useState<Record<string, string>>({})
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

  const unlocked = Object.keys(passwordMap).length > 0

  async function loadUsers() {
    setListState('loading')
    const result = await fetchAdminUsers()
    if (result.ok) {
      setUsers(result.users)
      setListState('ready')
      return
    }
    if (result.status === 401) setListState('unauthorized')
    else if (result.status === 403 || result.status === 404) setListState('forbidden')
    else setListState('error')
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  async function handleUnlock() {
    if (!passwordInput || revealing) return
    setRevealing(true)
    setRevealError('')
    const result = await revealAdminPasswords(passwordInput)
    setRevealing(false)
    if (result.ok) {
      const map: Record<string, string> = {}
      for (const u of result.users) map[u.user_id] = u.password
      setPasswordMap(map)
      setRevealedIds(new Set())
      setPasswordInput('')
      return
    }
    setRevealError(result.msg)
  }

  function lockAgain() {
    setPasswordMap({})
    setRevealedIds(new Set())
    setRevealError('')
  }

  function toggleReveal(uid: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function resumeCell(u: AdminUserItem) {
    if (!u.has_resume) return <span className={styles.muted}>未上传</span>
    return (
      <span className={styles.resumeOk}>
        已上传{u.resume_size ? ` · ${formatSize(u.resume_size)}` : ''}
      </span>
    )
  }

  if (authLoading || listState === 'loading') {
    return <div className={styles.stateBlock}>正在加载用户列表…</div>
  }

  if (listState === 'unauthorized') {
    return (
      <div className={styles.stateBlock}>
        <p className={styles.stateTitle}>请先登录站长账号</p>
        <p className={styles.stateDesc}>用户管理仅对站长开放，登录后即可访问。</p>
        <Link className={styles.stateLink} to="/resume">
          前往登录
        </Link>
      </div>
    )
  }

  if (listState === 'forbidden') {
    return (
      <div className={styles.stateBlock}>
        <p className={styles.stateTitle}>无访问权限</p>
        <p className={styles.stateDesc}>用户管理仅站长账号可见，当前账号无权访问此页面。</p>
        <Link className={styles.stateLink} to="/">
          返回工作台
        </Link>
      </div>
    )
  }

  if (listState === 'error') {
    return (
      <div className={styles.stateBlock}>
        <p className={styles.stateTitle}>用户列表加载失败</p>
        <button type="button" className={styles.retryButton} onClick={() => void loadUsers()}>
          重新加载
        </button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>用户管理</h1>
        <span className={styles.countPill}>共 {users.length} 个账号</span>
      </div>

      <div className={styles.unlockCard}>
        {unlocked ? (
          <div className={styles.unlockedRow}>
            <span className={styles.unlockedText}>已解锁：点击每行密码旁的眼睛查看，离开页面自动失效。</span>
            <button type="button" className={styles.lockButton} onClick={lockAgain}>
              重新锁定
            </button>
          </div>
        ) : (
          <>
            <p className={styles.unlockTitle}>查看账号密码</p>
            <p className={styles.unlockDesc}>
              请再次输入站长账号的登录密码；口令仅本次会话有效，10 分钟内最多尝试 5 次。
            </p>
            <div className={styles.unlockRow}>
              <input
                type="password"
                className={styles.passwordInput}
                placeholder="站长登录密码"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleUnlock()
                }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.unlockButton}
                disabled={!passwordInput || revealing}
                onClick={() => void handleUnlock()}
              >
                {revealing ? '验证中…' : '解锁密码'}
              </button>
            </div>
            {revealError ? <p className={styles.errorText}>{revealError}</p> : null}
          </>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>账号名</th>
              <th>注册时间</th>
              <th>简历</th>
              <th>密码</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td className={styles.usernameCell}>{u.username}</td>
                <td className={styles.timeCell}>{formatTime(u.created_at)}</td>
                <td>{resumeCell(u)}</td>
                <td>
                  <PasswordCell
                    password={unlocked ? passwordMap[u.user_id] ?? '' : null}
                    revealed={revealedIds.has(u.user_id)}
                    onToggle={() => toggleReveal(u.user_id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cardList}>
        {users.map((u) => (
          <div key={u.user_id} className={styles.userCard}>
            <div className={styles.cardTop}>
              <span className={styles.cardUsername}>{u.username}</span>
              {resumeCell(u)}
            </div>
            <div className={styles.cardRow}>
              <span className={styles.cardLabel}>注册时间</span>
              <span>{formatTime(u.created_at)}</span>
            </div>
            <div className={styles.cardRow}>
              <span className={styles.cardLabel}>密码</span>
              <PasswordCell
                password={unlocked ? passwordMap[u.user_id] ?? '' : null}
                revealed={revealedIds.has(u.user_id)}
                onToggle={() => toggleReveal(u.user_id)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
