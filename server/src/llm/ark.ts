import { config } from '../config.js'

// 火山方舟（豆包）OpenAI 兼容 Chat Completions 客户端
// 文档：POST {ARK_BASE_URL}/api/v3/chat/completions

export class LlmApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'LlmApiError'
  }
}

export function isArkConfigured(): boolean {
  return Boolean(config.ark.apiKey && config.ark.model)
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  jsonMode?: boolean
  temperature?: number
  timeoutMs?: number
}

async function chatCompletion(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  if (!isArkConfigured()) {
    throw new LlmApiError('火山方舟未配置：请在 server/.env 设置 ARK_API_KEY 与 ARK_MODEL', 503)
  }

  const body: Record<string, unknown> = {
    model: config.ark.model,
    messages,
    temperature: options.temperature ?? 0.3,
    thinking: { type: 'disabled' },
  }
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  let res: Response
  try {
    res = await fetch(`${config.ark.baseUrl}/api/v3/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ark.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new LlmApiError('豆包响应超时（90s），请稍后重试', 504)
    }
    throw new LlmApiError(
      `调用火山方舟失败：${error instanceof Error ? error.message : String(error)}`,
      502,
    )
  }

  const payload = (await res.json().catch(() => null)) as
    | { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> }
    | null

  if (!res.ok || !payload) {
    const message = payload?.error?.message ?? `HTTP ${res.status}`
    throw new LlmApiError(`豆包接口返回错误：${message}`, res.status === 401 || res.status === 403 ? 403 : 502, payload)
  }

  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new LlmApiError('豆包返回内容为空', 502)
  return content
}

/** 要求模型严格输出 JSON 对象；对 ```json 围栏做兜底剥离 */
export async function chatJson<T>(system: string, user: string): Promise<T> {
  const raw = await chatCompletion(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { jsonMode: true, temperature: 0.2 },
  )
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new LlmApiError('豆包返回不是合法 JSON，已拒绝透传', 502, cleaned.slice(0, 200))
  }
}
