import type { NextFunction, Request, Response } from 'express'

// AI 调用配额：每账号每天 10 次（按北京时间自然日）。
// checkAiQuota 只做拦截，recordAiUsage 在 AI 成功返回后才计数——参数错误 / AI 服务故障不消耗。

export const AI_DAILY_LIMIT = 10

interface UsageBucket {
  date: string
  count: number
}
const usage = new Map<string, UsageBucket>()

// 北京时间自然日 key（UTC+8），不依赖服务器时区
export function todayKey(now = Date.now()): string {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function getAiRemaining(userId: string, now = Date.now()): number {
  const bucket = usage.get(userId)
  if (!bucket || bucket.date !== todayKey(now)) return AI_DAILY_LIMIT
  return Math.max(0, AI_DAILY_LIMIT - bucket.count)
}

export function recordAiUsage(userId: string, now = Date.now()): number {
  const date = todayKey(now)
  const prev = usage.get(userId)
  const bucket = !prev || prev.date !== date ? { date, count: 1 } : { date, count: prev.count + 1 }
  usage.set(userId, bucket)
  return getAiRemaining(userId, now)
}

export function checkAiQuota(req: Request, res: Response, next: NextFunction): void {
  if (!req.userId) {
    res.status(401).json({ error: 'unauthorized', msg: '请先登录账号。' })
    return
  }
  const remaining = getAiRemaining(req.userId)
  if (remaining <= 0) {
    res.status(429).json({
      error: 'ai_quota_exhausted',
      msg: '今日 AI 次数（10 次）已用完，明天 0 点重置。',
    })
    return
  }
  next()
}
