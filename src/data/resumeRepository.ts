import type {
  AiProfileResponse,
  AppConfig,
  BulletRewritesResponse,
  InterviewPrepResponse,
  JdJobMeta,
  JdMatchResponse,
  ResumeResponse,
} from '@/types/resume'

// 简历数据出口：规则画像在本机解析；AI 分析仅在用户点击时才经本地服务转发至火山方舟

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { signal, ...init })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    throw new Error('本地只读服务未启动，请在项目目录运行 npm run dev:all 后重试。')
  }

  const json = (await res.json().catch(() => null)) as
    | ({ error?: string; msg?: string } & Partial<T>)
    | null

  if (!res.ok || !json || json.error) {
    const detail = json?.msg ? `：${json.msg}` : ''
    // 简历原文 401：抛出可识别错误，由「我的简历」页显示局部解锁卡片（不做全局跳转）
    if (res.status === 401) {
      const err = new Error(json?.msg ?? '查看简历需要访问密码') as Error & { status?: number }
      err.status = 401
      throw err
    }
    if (res.status === 503) {
      throw new Error(`火山方舟未配置${detail || '，请在 server/.env 补全 ARK_API_KEY 与 ARK_MODEL 后重启服务。'}`)
    }
    throw new Error(`请求失败（HTTP ${res.status}）${detail}`)
  }
  return json as T
}

export function getAppConfig(signal?: AbortSignal): Promise<AppConfig> {
  return requestJson<AppConfig>('/api/config', undefined, signal)
}

export function getResume(signal?: AbortSignal): Promise<ResumeResponse> {
  return requestJson<ResumeResponse>('/api/resume', undefined, signal)
}

export function generateAiProfile(signal?: AbortSignal): Promise<AiProfileResponse> {
  return requestJson<AiProfileResponse>(
    '/api/resume/ai-profile',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    signal,
  )
}

export function matchJd(
  jd: string,
  job: JdJobMeta | undefined,
  signal?: AbortSignal,
): Promise<JdMatchResponse> {
  return requestJson<JdMatchResponse>(
    '/api/resume/match',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd, job }),
    },
    signal,
  )
}

export function rewriteBullets(
  jd: string,
  job: JdJobMeta | undefined,
  signal?: AbortSignal,
): Promise<BulletRewritesResponse> {
  return requestJson<BulletRewritesResponse>(
    '/api/resume/rewrite',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd, job }),
    },
    signal,
  )
}

export function buildInterviewPrep(
  jd: string,
  job: JdJobMeta | undefined,
  signal?: AbortSignal,
): Promise<InterviewPrepResponse> {
  return requestJson<InterviewPrepResponse>(
    '/api/resume/interview-prep',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd, job }),
    },
    signal,
  )
}
