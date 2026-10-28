import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AccountStatus } from '@/types/resume'
import { fetchAccountStatus } from './authClient'

// 账号状态全局入口：挂在常驻布局层，路由切换不丢失；null 表示首屏状态尚未返回
interface AuthContextValue {
  status: AccountStatus | null
  loading: boolean
  refresh: () => Promise<AccountStatus>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus | null>(null)

  const refresh = useCallback(async () => {
    const next = await fetchAccountStatus()
    setStatus(next)
    return next
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({ status, loading: status === null, refresh }),
    [status, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}

// 便捷派生：登录态 / 简历态（加载中按 false 处理，页面应自行处理 loading）
export function useAccount() {
  const { status, loading, refresh } = useAuth()
  const logged = status?.logged === true
  return {
    status,
    loading,
    logged,
    userId: logged ? status.user_id : null,
    username: logged ? status.username : null,
    hasResume: logged ? status.has_resume : false,
    aiRemaining: logged ? status.ai_remaining : null,
    isOwner: logged ? status.is_owner === true : false,
    refresh,
  }
}
