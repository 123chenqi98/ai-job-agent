// 简历访问解锁通道：网站默认公开，仅「我的简历」原文需要密码；
// 登录态由服务端 HttpOnly Cookie 维护（7 天有效），前端只负责提交密码。

export async function login(
  password: string,
): Promise<{ ok: true } | { ok: false; status: number; msg: string; retryAfter?: number }> {
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
    msg: json?.msg ?? (res.status === 429 ? '尝试过于频繁，请稍后再试。' : '验证失败，请重试。'),
    retryAfter: typeof json?.retry_after === 'number' ? json.retry_after : undefined,
  }
}

// 主动上锁：清除 7 天免密 Cookie，回到密码卡片（共用电脑场景）
export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
}
