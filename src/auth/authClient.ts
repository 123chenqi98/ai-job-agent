// 访问门禁的前端通道：登录态由服务端 HttpOnly Cookie 维护，前端只感知「是否已授权」
// 任何数据接口收到 401 时派发该事件，由 AuthGate 统一切回登录页

export const AUTH_CHANGED_EVENT = 'aj:auth-changed'

export interface AuthStatus {
  enabled: boolean
  authed: boolean
}

export function emitAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export async function fetchAuthStatus(signal?: AbortSignal): Promise<AuthStatus | null> {
  try {
    const res = await fetch('/api/auth/status', { signal })
    if (!res.ok) return null
    return (await res.json()) as AuthStatus
  } catch {
    // 后端未启动等网络错误：返回 null，由调用方降级放行（各页面保留原有错误提示）
    return null
  }
}

export async function login(password: string): Promise<{ ok: true } | { ok: false; status: number; msg: string; retryAfter?: number }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const json = (await res.json().catch(() => null)) as { msg?: string; retry_after?: number } | null
  if (res.ok) return { ok: true }
  return {
    ok: false,
    status: res.status,
    msg: json?.msg ?? (res.status === 429 ? '尝试过于频繁，请稍后再试。' : '登录失败，请重试。'),
    retryAfter: typeof json?.retry_after === 'number' ? json.retry_after : undefined,
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    emitAuthChanged()
  }
}

// 数据请求出口共用：业务接口的 401 一律触发全局门禁（登录接口自身除外）
export function notifyUnauthorized(path: string): void {
  if (path.includes('/api/auth/')) return
  emitAuthChanged()
}
