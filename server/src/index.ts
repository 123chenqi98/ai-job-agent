import express from 'express'
import { config } from './config.js'
import { createAuthGate } from './auth.js'
import { FeishuApiError } from './feishu/client.js'
import {
  listFields,
  resolveApp,
  searchAllRecords,
  searchRecords,
} from './feishu/bitable.js'
import { mapBoardRecords } from './boards/mapper.js'
import { buildJobFilter, JOB_SORT, mapJobRecords, type JobQuery } from './jobs/mapper.js'
import { parseResumePdf } from './resume/pdf.js'
import { extractRuleProfile } from './resume/profile.js'
import { buildAiProfile, buildInterviewPrep, matchJd, rewriteBullets } from './resume/ai.js'
import { isArkConfigured, LlmApiError } from './llm/ark.js'

const app = express()
// 线上在 Nginx HTTPS 反代之后：信任首层代理以正确识别 req.secure / 客户端 IP（Cookie Secure 与限次依赖）
app.set('trust proxy', 1)
app.use(express.json({ limit: '1mb' }))

// 访问门禁：未配置 ACCESS_PASSWORD_HASH 时不启用，本地开发零感知
const authGate = createAuthGate({
  passwordHash: config.auth.passwordHash,
  secret: config.auth.secret,
})

app.get('/api/auth/status', authGate.handleStatus)
app.post('/api/auth/login', authGate.handleLogin)
app.post('/api/auth/logout', authGate.handleLogout)
// 其余所有数据接口（简历 / 岗位 / 看板 / AI）一律需要登录 Cookie
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next()
  authGate.requireAuth(req, res, next)
})

// 岗位池筛选项：原表选项较脏（混入届别/企业性质），这里给出面向校招的常用白名单
const TARGET_OPTIONS = ['27届', '27届-29届', '26届-27届', '26届', '26届-29届']
const DEGREE_OPTIONS = ['本科起', '硕士起', '博士起', '专科起', '不限学历']

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-job-agent-server' })
})

// 前端能力探测：仅暴露 AI 是否已配置，不泄露任何密钥
app.get('/api/config', (_req, res) => {
  res.json({
    ark_configured: Boolean(config.ark.apiKey && config.ark.model),
  })
})

// 只读：本地简历 PDF → 文本 + 规则画像（不发送任何外部服务）
app.get('/api/resume', async (_req, res) => {
  try {
    const { parsed, mtime, size } = await parseResumePdf(config.resume.pdfPath)
    res.json({
      source: {
        file_name: 'resume.pdf',
        pages: parsed.pages.length,
        size_bytes: size,
        updated_at: mtime.toISOString(),
        parsed_at: new Date().toISOString(),
        engine: 'pdfjs-3.11 + rule@v1',
      },
      profile: extractRuleProfile(parsed),
      full_text: parsed.fullText,
    })
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      res.status(404).json({
        error: 'resume_not_found',
        msg: `未找到简历文件：${config.resume.pdfPath}。请把简历 PDF 放到该路径，或在 server/.env 配置 RESUME_PDF_PATH。`,
      })
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: 'resume_parse_error', msg: message })
  }
})

// ---- P4：火山方舟豆包增强（凭证未配置时统一 503，不影响其他接口） ----

function arkNotConfigured(res: express.Response): void {
  res.status(503).json({
    error: 'ark_not_configured',
    msg: '未配置火山方舟凭证，请在 server/.env 设置 ARK_API_KEY 与 ARK_MODEL（推理接入点 ep-xxx）后重启本地服务。',
  })
}

function sendAiError(res: express.Response, error: unknown): void {
  if (error instanceof LlmApiError) {
    res.status(error.status).json({ error: 'ark_api_error', code: error.status, msg: error.message })
    return
  }
  const nodeError = error as NodeJS.ErrnoException
  if (nodeError?.code === 'ENOENT') {
    res.status(404).json({ error: 'resume_not_found', msg: '未找到简历 PDF，无法进行 AI 分析。' })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  res.status(500).json({ error: 'ai_task_error', msg: message })
}

function pickJobMeta(body: unknown): { company?: string; title?: string } {
  const source = (body ?? {}) as { job?: unknown }
  const job = (source.job ?? {}) as Record<string, unknown>
  return {
    company: typeof job.company === 'string' ? job.company.slice(0, 80) : undefined,
    title: typeof job.title === 'string' ? job.title.slice(0, 80) : undefined,
  }
}

// AI 深度画像：豆包把简历结构化为能力/亮点/短板/经历归属
app.post('/api/resume/ai-profile', async (_req, res) => {
  if (!isArkConfigured()) {
    arkNotConfigured(res)
    return
  }
  try {
    const { parsed } = await parseResumePdf(config.resume.pdfPath)
    const profile = await buildAiProfile(parsed.fullText)
    res.json({ engine: config.ark.model, generated_at: new Date().toISOString(), profile })
  } catch (error) {
    sendAiError(res, error)
  }
})

// JD 精匹配：粘贴完整 JD，输出可解释评分、命中证据与缺口
app.post('/api/resume/match', async (req, res) => {
  if (!isArkConfigured()) {
    arkNotConfigured(res)
    return
  }
  const jd = typeof req.body?.jd === 'string' ? req.body.jd.trim() : ''
  if (jd.length < 30) {
    res.status(400).json({ error: 'invalid_jd', msg: '请粘贴完整 JD（至少 30 字），过短无法做可靠匹配。' })
    return
  }
  try {
    const { parsed } = await parseResumePdf(config.resume.pdfPath)
    const match = await matchJd(parsed.fullText, jd.slice(0, 6000), pickJobMeta(req.body))
    res.json({ engine: config.ark.model, generated_at: new Date().toISOString(), match })
  } catch (error) {
    sendAiError(res, error)
  }
})

// 定向 bullet 改写：A 岗位定向版 + B 量化强化版
app.post('/api/resume/rewrite', async (req, res) => {
  if (!isArkConfigured()) {
    arkNotConfigured(res)
    return
  }
  const jd = typeof req.body?.jd === 'string' ? req.body.jd.trim() : ''
  if (jd.length < 30) {
    res.status(400).json({ error: 'invalid_jd', msg: '请粘贴完整 JD（至少 30 字）后再生成改写建议。' })
    return
  }
  try {
    const { parsed } = await parseResumePdf(config.resume.pdfPath)
    const rewrites = await rewriteBullets(parsed.fullText, jd.slice(0, 6000), pickJobMeta(req.body))
    res.json({ engine: config.ark.model, generated_at: new Date().toISOString(), rewrites })
  } catch (error) {
    sendAiError(res, error)
  }
})

// 面试准备包：JD + 简历生成预测面试题、答题要点与反问清单
app.post('/api/resume/interview-prep', async (req, res) => {
  if (!isArkConfigured()) {
    arkNotConfigured(res)
    return
  }
  const jd = typeof req.body?.jd === 'string' ? req.body.jd.trim() : ''
  if (jd.length < 30) {
    res.status(400).json({ error: 'invalid_jd', msg: '请粘贴完整 JD（至少 30 字）后再生成面试准备。' })
    return
  }
  try {
    const { parsed } = await parseResumePdf(config.resume.pdfPath)
    const prep = await buildInterviewPrep(parsed.fullText, jd.slice(0, 6000), pickJobMeta(req.body))
    res.json({ engine: config.ark.model, generated_at: new Date().toISOString(), prep })
  } catch (error) {
    sendAiError(res, error)
  }
})

// 探活接口：验证授权、输出内嵌表清单与看板表字段、样例记录
app.get('/api/feishu/meta', async (_req, res) => {
  try {
    const resolved = await resolveApp()
    const boardTable = resolved.tables.find((t) => t.tableId === config.feishu.boardTableId)
    const fields = await listFields(resolved.appToken, config.feishu.boardTableId)
    const firstPage = await searchRecords(resolved.appToken, config.feishu.boardTableId, {
      pageSize: 3,
    })

    res.json({
      workbookTitle: resolved.node.title,
      boardTable,
      allTables: resolved.tables,
      total: firstPage.total,
      fields,
      sampleRecords: firstPage.items,
    })
  } catch (error) {
    handleFeishuError(error, res)
  }
})

// 只读：飞书面经看板表 → 工作台投递看板数据（含状态归并，不写回飞书）
app.get('/api/board', async (_req, res) => {
  try {
    const resolved = await resolveApp()
    const records = await searchAllRecords(resolved.appToken, config.feishu.boardTableId, 500)
    const items = mapBoardRecords(records)
    res.json({
      source: resolved.node.title,
      table: resolved.tables.find((t) => t.tableId === config.feishu.boardTableId)?.title ?? null,
      generated_at: new Date().toISOString(),
      total: items.length,
      items,
    })
  } catch (error) {
    handleFeishuError(error, res)
  }
})

// 只读：27届网申总表 → 岗位池分页查询（关键词 / 届别 / 学历 / 城市，服务端过滤排序）
app.get('/api/jobs', async (req, res) => {
  try {
    const resolved = await resolveApp()
    const query: JobQuery = {
      keyword: typeof req.query.q === 'string' ? req.query.q : undefined,
      target: typeof req.query.target === 'string' ? req.query.target : undefined,
      degree: typeof req.query.degree === 'string' ? req.query.degree : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
    }
    const pageToken = typeof req.query.page_token === 'string' ? req.query.page_token : undefined
    const page = await searchRecords(resolved.appToken, config.feishu.jobsTableId, {
      pageSize: 20,
      pageToken,
      filter: buildJobFilter(query),
      sort: JOB_SORT,
    })
    res.json({
      source: resolved.node.title,
      total: page.total,
      has_more: page.hasMore,
      page_token: page.pageToken,
      items: mapJobRecords(page.items),
    })
  } catch (error) {
    handleFeishuError(error, res)
  }
})

// 岗位池元信息：筛选白名单 + 全量 / 27届 / 本科口径总数
app.get('/api/jobs/meta', async (_req, res) => {
  try {
    const resolved = await resolveApp()
    const [all, target27, bachelor] = await Promise.all([
      searchRecords(resolved.appToken, config.feishu.jobsTableId, { pageSize: 1 }),
      searchRecords(resolved.appToken, config.feishu.jobsTableId, {
        pageSize: 1,
        filter: {
          conjunction: 'and',
          conditions: [{ field_name: '招聘对象', operator: 'is', value: ['27届'] }],
        },
      }),
      searchRecords(resolved.appToken, config.feishu.jobsTableId, {
        pageSize: 1,
        filter: {
          conjunction: 'and',
          conditions: [{ field_name: '学历', operator: 'is', value: ['本科起'] }],
        },
      }),
    ])
    res.json({
      source: resolved.node.title,
      filters: { target: TARGET_OPTIONS, degree: DEGREE_OPTIONS },
      totals: {
        all: all.total,
        target27: target27.total,
        bachelor: bachelor.total,
      },
    })
  } catch (error) {
    handleFeishuError(error, res)
  }
})

function handleFeishuError(error: unknown, res: express.Response): void {
  if (error instanceof FeishuApiError) {
    // 99991672：应用缺少对应 API 权限；131006：文档未授权给应用
    const status = error.code === 99991672 || error.code === 131006 ? 403 : 502
    res.status(status).json({
      error: 'feishu_api_error',
      code: error.code,
      msg: error.message,
    })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  res.status(500).json({ error: 'server_error', msg: message })
}

app.listen(config.port, () => {
  console.log(`[server] 飞书只读服务已启动：:${config.port}`)
})
