import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 配置固定从 server/.env 读取，与前端工程隔离
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../')
dotenv.config({ path: path.join(serverDir, '.env') })

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`缺少环境变量 ${name}，请参照 server/.env.example 配置 server/.env`)
  return value
}

function normalizeBaseUrl(raw: string): string {
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
  return withProtocol.replace(/\/+$/, '')
}

export const config = {
  feishu: {
    appId: required('FEISHU_APP_ID'),
    appSecret: required('FEISHU_APP_SECRET'),
    baseUrl: normalizeBaseUrl(process.env.FEISHU_BASE_URL || 'open.feishu.cn'),
    wikiNode: required('FEISHU_WIKI_NODE'),
    boardTableId: required('FEISHU_BOARD_TABLE_ID'),
    jobsTableId: process.env.FEISHU_JOBS_TABLE_ID || '',
  },
  // 本地简历 PDF：默认 server/data/resume.pdf，可用 RESUME_PDF_PATH 覆盖
  resume: {
    pdfPath: process.env.RESUME_PDF_PATH
      ? path.resolve(process.env.RESUME_PDF_PATH)
      : path.join(serverDir, 'data', 'resume.pdf'),
  },
  // 火山方舟豆包：可选配置，缺失时 AI 相关接口返回 503，不影响其他功能
  ark: {
    apiKey: process.env.ARK_API_KEY || '',
    model: process.env.ARK_MODEL || '',
    baseUrl: normalizeBaseUrl(process.env.ARK_BASE_URL || 'ark.cn-beijing.volces.com'),
  },
  // 账号会话：AUTH_SECRET 用于对登录 Cookie（aj_session）做 HMAC 签名
  auth: {
    secret: process.env.AUTH_SECRET || '',
  },
  port: Number(process.env.PORT || 8787),
}
