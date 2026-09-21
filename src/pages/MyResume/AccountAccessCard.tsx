import { useState, type FormEvent } from 'react'
import {
  login,
  recover,
  register,
  type ApiFailure,
} from '@/auth/authClient'
import styles from './MyResume.module.css'

// 未登录态的账号入口：登录 / 注册 / 忘记密码 三模式卡片。
// 注册成功后强制停留展示一次性恢复码，确认保存后才进入。

type Mode = 'login' | 'register' | 'recover'

interface Props {
  onAuthed: () => void
}

function failureText(result: ApiFailure): string {
  return result.msg
}

export default function AccountAccessCard({ onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registeredCode, setRegisteredCode] = useState<string | null>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        const result = await login(username, password)
        if (result.ok) onAuthed()
        else setError(failureText(result))
      } else if (mode === 'register') {
        if (password !== confirm) {
          setError('两次输入的密码不一致。')
          return
        }
        const result = await register(username, password)
        if (result.ok) setRegisteredCode(result.recovery_code)
        else setError(failureText(result))
      } else {
        const result = await recover(username, recoveryCode, password)
        if (result.ok) onAuthed()
        else setError(failureText(result))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.accessWrap}>
      <div className={styles.accessCard}>
        <span className={styles.accessBrand}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l1.7 4.6L18.3 10l-4.6 1.7L12 16.3l-1.7-4.6L5.7 10l4.6-1.4z" />
          </svg>
        </span>

        {registeredCode ? (
          <>
            <h2 className={styles.accessTitle}>注册成功，请保存恢复码</h2>
            <p className={styles.accessSubtitle}>
              这是忘记密码时<strong>唯一</strong>的找回方式，页面关闭后将无法再次查看，请立刻截图或抄录到安全位置。
            </p>
            <div className={styles.recoveryBox}>{registeredCode}</div>
            <button type="button" className={styles.accessSubmit} onClick={onAuthed}>
              我已保存，进入我的简历
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.accessTitle}>
              {mode === 'login' ? '登录账号' : mode === 'register' ? '注册我的账号' : '找回密码'}
            </h2>
            <p className={styles.accessSubtitle}>
              每人一个独立空间：你上传的简历与 AI 分析只有自己可见，其他用户（包括站长）都无法查看。
            </p>

            <form className={styles.accessForm} onSubmit={handleSubmit}>
              <label className={styles.fieldLabel}>账号名</label>
              <input
                className={styles.accessInput}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3–20 位：字母 / 数字 / 中文 / _ / -"
                autoComplete="username"
                disabled={busy}
              />

              {mode === 'recover' ? (
                <>
                  <label className={styles.fieldLabel}>恢复码</label>
                  <input
                    className={styles.accessInput}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="注册时保存的恢复码（连字符可省略）"
                    autoComplete="one-time-code"
                    disabled={busy}
                  />
                </>
              ) : null}

              <label className={styles.fieldLabel}>
                {mode === 'recover' ? '新密码' : '密码'}
              </label>
              <input
                className={styles.accessInput}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6–64 位"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={busy}
              />

              {mode === 'register' ? (
                <>
                  <label className={styles.fieldLabel}>确认密码</label>
                  <input
                    className={styles.accessInput}
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    disabled={busy}
                  />
                </>
              ) : null}

              {error ? <div className={styles.accessError}>{error}</div> : null}

              <button type="submit" className={styles.accessSubmit} disabled={busy}>
                {busy
                  ? '请稍候…'
                  : mode === 'login'
                    ? '登录'
                    : mode === 'register'
                      ? '注册并进入'
                      : '重置密码并登录'}
              </button>
            </form>

            <div className={styles.accessSwitch}>
              {mode === 'login' ? (
                <>
                  <button type="button" onClick={() => switchMode('register')}>没有账号？去注册</button>
                  <button type="button" onClick={() => switchMode('recover')}>忘记密码</button>
                </>
              ) : (
                <button type="button" onClick={() => switchMode('login')}>已有账号，返回登录</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
