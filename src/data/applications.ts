import type {
  UserApplication,
  UserApplicationStats,
  UserApplicationStatus,
} from '@/types'

// 用户私有投递记录 API：按 user_id 隔离，仅登录用户可访问自己的数据

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new Error('网络请求失败，请检查服务是否启动。')
  }
  const json = (await res.json().catch(() => null)) as
    | ({ error?: string; msg?: string } & Partial<T>)
    | null
  if (!res.ok || !json || json.error) {
    const detail = json?.msg ? `：${json.msg}` : ''
    const err = new Error(`请求失败（HTTP ${res.status}）${detail}`) as Error & {
      status?: number
    }
    err.status = res.status
    throw err
  }
  return json as T
}

export function listApplications(): Promise<{ items: UserApplication[] }> {
  return requestJson<{ items: UserApplication[] }>('/api/applications')
}

export function getApplicationStats(): Promise<UserApplicationStats> {
  return requestJson<UserApplicationStats>('/api/applications/stats')
}

export function createApplication(input: {
  company: string
  job_title: string
  job_url?: string
  status?: UserApplicationStatus
  note?: string
}): Promise<UserApplication> {
  return requestJson<UserApplication>('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateApplication(
  id: string,
  input: {
    company?: string
    job_title?: string
    job_url?: string
    status?: UserApplicationStatus
    note?: string
  },
): Promise<UserApplication> {
  return requestJson<UserApplication>(`/api/applications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteApplication(id: string): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(`/api/applications/${id}`, {
    method: 'DELETE',
  })
}
