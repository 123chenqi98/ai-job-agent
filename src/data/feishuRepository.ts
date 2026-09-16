import type {
  FeishuBoardResponse,
  FeishuJobQuery,
  FeishuJobsMeta,
  FeishuJobsResponse,
} from '@/types/feishu'

// 飞书只读数据出口：前端统一经本地服务 /api 代理访问，凭证只保存在服务端

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { signal })
  } catch (err) {
    // 请求被主动取消（如 StrictMode 双挂载的清理）时透传 AbortError，交由调用方忽略
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    throw new Error('本地只读服务未启动，请在项目目录运行 npm run dev:all 后重试。')
  }

  const json = (await res.json().catch(() => null)) as
    | ({ error?: string; msg?: string; code?: number } & Partial<T>)
    | null

  if (!res.ok || !json || json.error) {
    const detail = json?.msg ? `：${json.msg}` : ''
    if (res.status === 403) {
      throw new Error(
        `飞书授权失败（${json?.code ?? res.status}）${detail}。请确认应用已加为表格协作者，且已发布包含只读权限的新版本。`,
      )
    }
    throw new Error(`读取飞书数据失败（HTTP ${res.status}）${detail}`)
  }

  return json as T
}

export function getFeishuBoard(signal?: AbortSignal): Promise<FeishuBoardResponse> {
  return getJson<FeishuBoardResponse>('/api/board', signal)
}

export function getFeishuJobs(
  query: FeishuJobQuery,
  signal?: AbortSignal,
): Promise<FeishuJobsResponse> {
  const params = new URLSearchParams()
  if (query.keyword?.trim()) params.set('q', query.keyword.trim())
  if (query.target) params.set('target', query.target)
  if (query.degree) params.set('degree', query.degree)
  if (query.city?.trim()) params.set('city', query.city.trim())
  if (query.nature) params.set('nature', query.nature)
  if (query.recruitType) params.set('recruit_type', query.recruitType)
  if (query.bigTech) params.set('big_tech', '1')
  if (query.pageToken) params.set('page_token', query.pageToken)
  const suffix = params.toString()
  return getJson<FeishuJobsResponse>(`/api/jobs${suffix ? `?${suffix}` : ''}`, signal)
}

export function getFeishuJobsMeta(signal?: AbortSignal): Promise<FeishuJobsMeta> {
  return getJson<FeishuJobsMeta>('/api/jobs/meta', signal)
}
