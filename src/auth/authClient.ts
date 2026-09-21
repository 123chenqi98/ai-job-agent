import type {
  AccountStatus,
  AdminPaymentItem,
  AdminUserItem,
  AdminUserWithPassword,
  LoginResponse,
  PaymentProofState,
  RegisterResponse,
  ResumeUploadResponse,
} from '@/types/resume'

// 多用户账号通道：登录态由服务端 HttpOnly Cookie（aj_session，7 天）维护。
// 前端不接触任何密码哈希，只负责提交与读取状态。

export interface ApiFailure {
  ok: false
  status: number
  msg: string
  retryAfter?: number
}

export type ApiResult<T> = ({ ok: true } & T) | ApiFailure

async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, status: 0, msg: '网络异常，请检查连接后重试。' }
  }
  const json = (await res.json().catch(() => null)) as ({ msg?: string; retry_after?: number } & Partial<T>) | null
  if (res.ok && json) return { ok: true, ...(json as T) }
  return {
    ok: false,
    status: res.status,
    msg: json?.msg ?? (res.status === 429 ? '操作过于频繁，请稍后再试。' : '请求失败，请重试。'),
    retryAfter: typeof json?.retry_after === 'number' ? json.retry_after : undefined,
  }
}

async function getJson<T>(path: string): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(path)
  } catch {
    return { ok: false, status: 0, msg: '网络异常，请检查连接后重试。' }
  }
  const json = (await res.json().catch(() => null)) as ({ msg?: string; retry_after?: number } & Partial<T>) | null
  if (res.ok && json) return { ok: true, ...(json as T) }
  return {
    ok: false,
    status: res.status,
    msg: json?.msg ?? (res.status === 404 ? '页面不存在。' : '请求失败，请重试。'),
    retryAfter: typeof json?.retry_after === 'number' ? json.retry_after : undefined,
  }
}

export function fetchAccountStatus(signal?: AbortSignal): Promise<AccountStatus> {
  return fetch('/api/account/status', { signal })
    .then((res) => res.json() as Promise<AccountStatus>)
    .catch(() => ({ logged: false }) as AccountStatus)
}

export function register(username: string, password: string): Promise<ApiResult<RegisterResponse>> {
  return postJson<RegisterResponse>('/api/account/register', { username, password })
}

export function login(username: string, password: string): Promise<ApiResult<LoginResponse>> {
  return postJson<LoginResponse>('/api/account/login', { username, password })
}

export async function logout(): Promise<void> {
  await fetch('/api/account/logout', { method: 'POST' }).catch(() => undefined)
}

export function recover(
  username: string,
  recoveryCode: string,
  newPassword: string,
): Promise<ApiResult<{ msg: string }>> {
  return postJson('/api/account/recover', {
    username,
    recovery_code: recoveryCode,
    new_password: newPassword,
  })
}

// 简历上传走 multipart/form-data；服务端二次校验 PDF 头与可解析性
export async function uploadResume(file: File): Promise<ApiResult<ResumeUploadResponse>> {
  const form = new FormData()
  form.append('file', file)
  let res: Response
  try {
    res = await fetch('/api/account/resume', { method: 'POST', body: form })
  } catch {
    return { ok: false, status: 0, msg: '网络异常，上传失败，请重试。' }
  }
  const json = (await res.json().catch(() => null)) as ({ msg?: string } & Partial<ResumeUploadResponse>) | null
  if (res.ok && json) return json as ApiResult<ResumeUploadResponse>
  return { ok: false, status: res.status, msg: json?.msg ?? '上传失败，请重试。' }
}

// 站长用户管理：列表接口默认不含密码，密码仅在 reveal 口令通过后一次性下发
export async function fetchAdminUsers(): Promise<ApiResult<{ users: AdminUserItem[] }>> {
  return getJson<{ users: AdminUserItem[] }>('/api/admin/users')
}

export function revealAdminPasswords(
  password: string,
): Promise<ApiResult<{ users: AdminUserWithPassword[] }>> {
  return postJson<{ users: AdminUserWithPassword[] }>('/api/admin/reveal', { password })
}

// 站长删除账号：服务端连带删除其简历文件；禁止删除自己（返回 400）
export function deleteAdminUser(userId: string): Promise<ApiResult<{ deleted: string }>> {
  return fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
    .then(async (res) => {
      const json = (await res.json().catch(() => null)) as
        | ({ msg?: string; deleted?: string } & Partial<{ deleted: string }>)
        | null
      if (res.ok && json) return { ok: true as const, deleted: json.deleted ?? '' }
      return {
        ok: false as const,
        status: res.status,
        msg: json?.msg ?? '删除失败，请重试。',
      }
    })
    .catch(() => ({ ok: false as const, status: 0, msg: '网络异常，删除失败，请重试。' }))
}

export async function deleteResume(): Promise<ApiResult<{ has_resume: boolean }>> {
  try {
    const res = await fetch('/api/account/resume', { method: 'DELETE' })
    const json = (await res.json().catch(() => null)) as { msg?: string; has_resume?: boolean } | null
    if (res.ok) return { ok: true, has_resume: json?.has_resume ?? false }
    return { ok: false, status: res.status, msg: json?.msg ?? '删除失败，请重试。' }
  } catch {
    return { ok: false, status: 0, msg: '网络异常，请重试。' }
  }
}

// ---- 付费开通 ----

export function fetchPayment(): Promise<
  ApiResult<{ paid: boolean; proof: PaymentProofState | null }>
> {
  return getJson('/api/account/payment')
}

export async function uploadPaymentProof(
  file: File,
): Promise<ApiResult<{ proof: PaymentProofState }>> {
  const form = new FormData()
  form.append('file', file)
  let res: Response
  try {
    res = await fetch('/api/account/payment-proof', { method: 'POST', body: form })
  } catch {
    return { ok: false, status: 0, msg: '网络异常，上传失败，请重试。' }
  }
  const json = (await res.json().catch(() => null)) as
    | ({ msg?: string } & Partial<{ proof: PaymentProofState }>)
    | null
  if (res.ok && json?.proof) return { ok: true, proof: json.proof }
  return { ok: false, status: res.status, msg: json?.msg ?? '上传失败，请重试。' }
}

// ---- 站长：凭证审核 ----

export function fetchAdminPayments(
  status: 'pending' | 'all' = 'pending',
): Promise<ApiResult<{ proofs: AdminPaymentItem[] }>> {
  return getJson(`/api/admin/payments?status=${status}`)
}

export function approveAdminPayment(id: string): Promise<ApiResult<Record<string, never>>> {
  return postJson(`/api/admin/payments/${encodeURIComponent(id)}/approve`, {})
}

export function rejectAdminPayment(
  id: string,
  reason: string,
): Promise<ApiResult<Record<string, never>>> {
  return postJson(`/api/admin/payments/${encodeURIComponent(id)}/reject`, { reason })
}
