import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AUTH_CHANGED_EVENT, fetchAuthStatus } from './authClient'
import LoginPage from './LoginPage'
import styles from './AuthGate.module.css'

type GatePhase = 'checking' | 'locked' | 'ready'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<GatePhase>('checking')

  const check = useCallback(async () => {
    const status = await fetchAuthStatus()
    // 状态接口不可达（如本地后端未启动）时不锁死页面，交由各页面原有错误态处理
    if (!status) {
      setPhase('ready')
      return
    }
    setPhase(status.enabled && !status.authed ? 'locked' : 'ready')
  }, [])

  useEffect(() => {
    void check()
    const onChange = () => void check()
    window.addEventListener(AUTH_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onChange)
  }, [check])

  if (phase === 'locked') {
    return <LoginPage onSuccess={() => void check()} />
  }

  if (phase === 'checking') {
    return (
      <div className={styles.screen}>
        <span className={styles.spinner} aria-label="正在校验登录状态" />
      </div>
    )
  }

  return <>{children}</>
}
