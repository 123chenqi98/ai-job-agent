import { config } from '../config.js'
import { getTenantAccessToken } from './token.js'

// 飞书 OpenAPI 业务错误（code !== 0），保留 code 便于前端按缺权限等场景提示
export class FeishuApiError extends Error {
  code: number
  data: unknown

  constructor(code: number, msg: string, data?: unknown) {
    super(msg)
    this.name = 'FeishuApiError'
    this.code = code
    this.data = data
  }
}

interface RequestOptions {
  query?: Record<string, string | number | undefined>
  body?: unknown
}

// 统一请求入口：自动注入 tenant_access_token、拼 query、按飞书 code 抛错
export async function feishuRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH',
  pathname: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = await getTenantAccessToken()
  const url = new URL(`${config.feishu.baseUrl}/open-apis${pathname}`)
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const json = await res.json()
  if (json.code !== 0) {
    throw new FeishuApiError(json.code as number, json.msg as string, json.data)
  }
  return json.data as T
}
