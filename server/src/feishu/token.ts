import { config } from '../config.js'

// tenant_access_token 在有效期内复用，过期前 2 分钟主动刷新
let cache: { token: string; expireAt: number } = { token: '', expireAt: 0 }

export async function getTenantAccessToken(): Promise<string> {
  if (cache.token && cache.expireAt - Date.now() > 120_000) {
    return cache.token
  }

  const res = await fetch(`${config.feishu.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: config.feishu.appId, app_secret: config.feishu.appSecret }),
  })
  const data = await res.json()
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`获取 tenant_access_token 失败：code=${data.code} msg=${data.msg}`)
  }

  cache = {
    token: data.tenant_access_token as string,
    expireAt: Date.now() + (data.expire as number) * 1000,
  }
  return cache.token
}
