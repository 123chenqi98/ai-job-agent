import { useEffect, useState, type FormEvent } from 'react'
import { login } from './authClient'
import styles from './AuthGate.module.css'

interface LoginPageProps {
  onSuccess: () => void
}

// 简历页内的局部解锁卡片（非全屏、不遮挡侧栏）：仅「我的简历」原文需要密码
export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockRemain, setLockRemain] = useState(0)

  // 服务端锁定时本地倒计时，到点自动解除输入禁用
  useEffect(() => {
    if (lockRemain <= 0) return
    const timer = window.setInterval(() => {
      setLockRemain((prev) => Math.max(prev - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [lockRemain])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting || lockRemain > 0) return
    setSubmitting(true)
    setError(null)
    const result = await login(password)
    setSubmitting(false)
    if (result.ok) {
      setPassword('')
      onSuccess()
      return
    }
    setError(result.msg)
    if (result.status === 429 && result.retryAfter) setLockRemain(result.retryAfter)
  }

  const locked = lockRemain > 0
  const remainText =
    lockRemain >= 60 ? `${Math.ceil(lockRemain / 60)} 分钟` : `${lockRemain} 秒`

  return (
    <div className={styles.embedded}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <span className={styles.brandMark}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h1 className={styles.title}>简历访问验证</h1>
        <p className={styles.subtitle}>
          岗位池与投递看板公开可看；这一页是你的私人简历原文，输入密码后即可查看，7 天内无需重复输入。
        </p>

        <input
          className={styles.input}
          type="password"
          autoComplete="current-password"
          placeholder="简历访问密码"
          value={password}
          disabled={locked}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <div className={styles.error}>{locked ? `${error}（剩余 ${remainText}）` : error}</div> : null}

        <button type="submit" className={styles.submit} disabled={submitting || locked || password.length === 0}>
          {submitting ? '验证中…' : locked ? `已锁定（${remainText}）` : '查看简历'}
        </button>

        <p className={styles.hint}>验证后 7 天内免重复输入；连续输错 5 次将临时锁定 15 分钟。</p>
      </form>
    </div>
  )
}
