import type { NextFunction, Request, Response } from 'express'

// 进程内按 IP 固定窗口限频：AI 接口每次都会真实消耗火山方舟 token，
// 网站公开访问必须有最低成本的防刷保护；重启 PM2 即清空计数，可接受。
interface RateLimitOptions {
  windowMs: number
  max: number
}

interface Bucket {
  resetAt: number
  count: number
}

export function createIpRateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>()

  // 周期性清理过期桶，避免 Map 随访客 IP 无限增长
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }, options.windowMs)
  ;(timer as { unref?: () => void }).unref?.()

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now()
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { resetAt: now + options.windowMs, count: 1 })
      next()
      return
    }
    if (bucket.count >= options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      res.status(429).json({
        error: 'rate_limited',
        msg: `操作过于频繁，请 ${retryAfter} 秒后再试。`,
        retry_after: retryAfter,
      })
      return
    }
    bucket.count += 1
    next()
  }
}
