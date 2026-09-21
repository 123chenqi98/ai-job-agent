import crypto from 'node:crypto'
import express from 'express'
import { promises as fs } from 'node:fs'
import multer from 'multer'
import path from 'node:path'
import { config } from './config.js'
import { FeishuApiError } from './feishu/client.js'
import {
  listFields,
  resolveApp,
  searchAllRecords,
  searchRecords,
} from './feishu/bitable.js'
import { mapBoardRecords } from './boards/mapper.js'
import {
  buildJobFilter,
  isBigTechCompany,
  JOB_SORT,
  mapJobRecords,
  NATURE_GROUPS,
  RECRUIT_TYPE_OPTIONS,
  type FeishuJobItem,
  type JobQuery,
} from './jobs/mapper.js'
import { parseResumePdf } from './resume/pdf.js'
import { extractRuleProfile } from './resume/profile.js'
import { buildAiProfile, buildInterviewPrep, matchJd, rewriteBullets } from './resume/ai.js'
import { isArkConfigured, LlmApiError } from './llm/ark.js'
import { createIpRateLimit } from './rateLimit.js'
import {
  clearLoginFailures,
  clearSessionCookie,
  precheckLoginLock,
  readUserId,
  recordLoginFailure,
  requireUser,
  setSessionCookie,
} from './accounts/session.js'
import {
  AccountError,
  clearResume,
  createAccount,
  findById,
  findByUsername,
  listAccounts,
  resetPassword,
  setResume,
} from './accounts/store.js'
import { generateRecoveryCode, normalizeRecoveryCode } from './accounts/password.js'
import { checkAiQuota, getAiRemaining, recordAiUsage } from './accounts/aiQuota.js'

const app = express()
// 线上在 Nginx HTTPS 反代之后：信任首层代理以正确识别 req.secure / 客户端 IP（Cookie Secure 与限次依赖）
app.set('trust proxy', 1)
app.use(express.json({ limit: '1mb' }))

// 多用户账号体系：岗位池 / 看板公开浏览；简历与 AI 能力按账号严格隔离，
// 每人只能读到自己的简历；会话 Cookie 由 HMAC(AUTH_SECRET) 签名。
const authSecret = config.auth.secret

// 简历文件目录：server/data/resumes/<uid>.pdf（server/data/ 已在 .gitignore）
const RESUMES_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../data/resumes')
await fs.mkdir(RESUMES_DIR, { recursive: true })

function resumePathFor(userId: string): string {
  return path.join(RESUMES_DIR, `${userId}.pdf`)
}

// ---- 账号注册 / 登录 / 恢复限频（按 IP 兜底，防恶意注册与撞库） ----
const registerIpLimit = createIpRateLimit({ windowMs: 60 * 60 * 1000, max: 10 })
const recoverIpLimit = createIpRateLimit({ windowMs: 60 * 60 * 1000, max: 10 })

const USERNAME_RE = /^[\p{L}\p{N}_-]{3,20}$/u

function readCredentials(body: unknown): { username: string; password: string } | null {
  const source = (body ?? {}) as { username?: unknown; password?: unknown }
  const username = typeof source.username === 'string' ? source.username.trim() : ''
  const password = typeof source.password === 'string' ? source.password : ''
  if (!USERNAME_RE.test(username) || password.length < 6 || password.length > 64) return null
  return { username, password }
}

// 岗位池筛选项：原表选项较脏（混入届别/企业性质），这里给出面向校招的常用白名单
const TARGET_OPTIONS = ['27届', '27届-29届', '26届-27届', '26届', '26届-29届']
const DEGREE_OPTIONS = ['本科起', '硕士起', '博士起', '专科起', '不限学历']
// 企业性质分组（key 与 mapper.ts 的 NATURE_GROUPS 对齐）与大厂口径说明，随 meta 下发驱动 UI
const NATURE_OPTION_META = [
  { key: 'central', label: '央国企' },
  { key: 'bank', label: '银行' },
  { key: 'private', label: '民企' },
  { key: 'foreign', label: '外企/合资' },
  { key: 'institution', label: '事业单位' },
]
const BIG_TECH_META = {
  label: '名企大厂',
  note: '互联网 / 科技名企口径（约 50 家，含 BAT、字节、华为、小米、新能源新势力等），按公司名匹配，口径可随时增删',
}

// 大厂模式必须全量拉取候选再内存过滤：按「除大厂外的筛选条件」缓存过滤结果 5 分钟，
// 避免每次无限滚动翻页都重拉全表；缓存仅保存映射后的轻量行模型
const BIG_TECH_PAGE_SIZE = 20
const BIG_TECH_FETCH_LIMIT = 8000
const BIG_TECH_CACHE_TTL_MS = 5 * 60 * 1000
const bigTechCache = new Map<string, { at: number; items: FeishuJobItem[] }>()

function bigTechCacheKey(query: JobQuery): string {
  return [
    query.keyword?.trim() ?? '',
    query.target?.trim() ?? '',
    query.degree?.trim() ?? '',
    query.city?.trim() ?? '',
    query.nature ?? '',
    query.recruitType ?? '',
  ].join('|')
}

async function loadBigTechItems(
  appToken: string,
  tableId: string,
  query: JobQuery,
): Promise<FeishuJobItem[]> {
  const key = bigTechCacheKey(query)
  const cached = bigTechCache.get(key)
  if (cached && Date.now() - cached.at < BIG_TECH_CACHE_TTL_MS) {
    return cached.items
  }
  const records = await searchAllRecords(appToken, tableId, {
    limit: BIG_TECH_FETCH_LIMIT,
    filter: buildJobFilter(query),
    sort: JOB_SORT,
  })
  const items = mapJobRecords(records).filter((item) => isBigTechCompany(item.company))
  bigTechCache.set(key, { at: Date.now(), items })
  if (bigTechCache.size > 20) {
    const oldest = bigTechCache.keys().next().value
    if (oldest) bigTechCache.delete(oldest)
  }
  return items
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-job-agent-server' })
})

// 前端能力探测：仅暴露 AI 是否已配置，不泄露任何密钥
app.get('/api/config', (_req, res) => {
  res.json({
    ark_configured: Boolean(config.ark.apiKey && config.ark.model),
  })
})

// ---- 账号会话状态：前端首屏据此渲染 注册/登录/上传/已上传 四态 ----
async function resolveStatusUser(req: express.Request) {
  const uid = readUserId(req, authSecret)
  return uid ? await findById(uid) : null
}

app.get('/api/account/status', async (req, res) => {
  const account = await resolveStatusUser(req)
  if (!account) {
    res.json({ logged: false, ark_configured: Boolean(config.ark.apiKey && config.ark.model) })
    return
  }
  res.json({
    logged: true,
    username: account.username,
    has_resume: Boolean(account.resume),
    resume: account.resume,
    ai_remaining: getAiRemaining(account.user_id),
    is_owner: Boolean(config.auth.ownerUserId && account.user_id === config.auth.ownerUserId),
  })
})

// 注册：账号名 + 密码；成功即登录并下发一次性恢复码（仅本次可见）
app.post('/api/account/register', registerIpLimit, async (req, res) => {
  const creds = readCredentials(req.body)
  if (!creds) {
    res.status(400).json({
      error: 'invalid_input',
      msg: '账号名需 3–20 位（字母/数字/中文/下划线/减号），密码 6–64 位。',
    })
    return
  }
  const recoveryCode = generateRecoveryCode()
  try {
    const account = await createAccount({
      username: creds.username,
      password: creds.password,
      recoveryCode: normalizeRecoveryCode(recoveryCode),
    })
    setSessionCookie(req, res, authSecret, account.user_id)
    res.status(201).json({
      ok: true,
      username: account.username,
      recovery_code: recoveryCode,
      msg: '注册成功，请妥善保存恢复码（忘记密码时唯一找回方式）。',
    })
  } catch (error) {
    if (error instanceof AccountError && error.code === 'username_taken') {
      res.status(409).json({ error: 'username_taken', msg: error.message })
      return
    }
    throw error
  }
})

// 登录：失败 5 次按 IP 锁 15 分钟
app.post('/api/account/login', async (req, res) => {
  if (precheckLoginLock(req, res)) return
  const creds = readCredentials(req.body)
  if (!creds) {
    recordLoginFailure(req, res)
    return
  }
  const account = await findByUsername(creds.username)
  if (!account || account.password !== creds.password) {
    recordLoginFailure(req, res)
    return
  }
  clearLoginFailures(req)
  setSessionCookie(req, res, authSecret, account.user_id)
  res.json({ ok: true, username: account.username, has_resume: Boolean(account.resume) })
})

app.post('/api/account/logout', (_req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

// 忘记密码：账号名 + 注册时的一次性恢复码 + 新密码；恢复码用过即失效
app.post('/api/account/recover', recoverIpLimit, async (req, res) => {
  const source = (req.body ?? {}) as { username?: unknown; recovery_code?: unknown; new_password?: unknown }
  const username = typeof source.username === 'string' ? source.username.trim() : ''
  const recoveryCode = typeof source.recovery_code === 'string' ? normalizeRecoveryCode(source.recovery_code) : ''
  const newPassword = typeof source.new_password === 'string' ? source.new_password : ''
  if (!USERNAME_RE.test(username) || recoveryCode.length < 8 || newPassword.length < 6 || newPassword.length > 64) {
    res.status(400).json({ error: 'invalid_input', msg: '账号名、恢复码或新密码格式不正确。' })
    return
  }
  const account = await findByUsername(username)
  if (!account || !account.recovery_code || account.recovery_code !== recoveryCode) {
    res.status(401).json({ error: 'bad_recovery', msg: '账号名或恢复码错误。' })
    return
  }
  await resetPassword(account.user_id, newPassword)
  setSessionCookie(req, res, authSecret, account.user_id)
  res.json({ ok: true, msg: '密码已重置，恢复码已失效。' })
})

// ---- 站长用户管理：仅 OWNER_USER_ID 指定的账号可访问 ----

// 已登录但非站长一律返回 404，不暴露管理接口的存在（未登录由 requireUser 返回 401）
function requireOwner(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (!config.auth.ownerUserId || req.userId !== config.auth.ownerUserId) {
    res.status(404).json({ error: 'not_found', msg: '页面不存在。' })
    return
  }
  next()
}

// 站长口令 = q1cheng 的登录密码；常量时间比对，避免计时侧信道
function verifyOwnerPassword(input: string, stored: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(stored)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// 口令尝试按 IP 严格限频：10 分钟 5 次，防止对站长密码在线爆破
const adminRevealLimit = createIpRateLimit({ windowMs: 10 * 60 * 1000, max: 5 })

function publicUserView(a: {
  user_id: string
  username: string
  created_at: string
  resume: { size: number } | null
}) {
  return {
    user_id: a.user_id,
    username: a.username,
    created_at: a.created_at,
    has_resume: Boolean(a.resume),
    resume_size: a.resume?.size ?? null,
  }
}

// 用户列表：不含任何密码
app.get(
  '/api/admin/users',
  requireUser(authSecret),
  requireOwner,
  async (_req, res) => {
    const accounts = await listAccounts()
    res.json({ users: accounts.map(publicUserView) })
  },
)

// 解锁密码：必须再次输入站长本人登录密码，通过后才下发各账号明文密码
app.post(
  '/api/admin/reveal',
  requireUser(authSecret),
  adminRevealLimit,
  requireOwner,
  async (req, res) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const owner = await findById(req.userId!)
    if (!owner || !password || !verifyOwnerPassword(password, owner.password)) {
      res.status(401).json({
        error: 'bad_admin_password',
        msg: '站长口令错误，请输入当前站长账号的登录密码。',
      })
      return
    }
    const accounts = await listAccounts()
    res.json({
      users: accounts.map((a) => ({ ...publicUserView(a), password: a.password })),
    })
  },
)

// ---- 简历上传：PDF、≤10MB；先落临时文件，校验 PDF 头 + 可解析后再 rename 覆盖 ----
const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: RESUMES_DIR,
    filename: (req, _file, cb) => {
      cb(null, `${req.userId}.${crypto.randomBytes(4).toString('hex')}.tmp.pdf`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('仅支持 PDF 文件'))
  },
})

app.post('/api/account/resume', requireUser(authSecret), (req, res) => {
  resumeUpload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      const msg = uploadError.message.includes('PDF')
        ? '仅支持 PDF 格式简历。'
        : uploadError.message.includes('File too large')
          ? '简历不能超过 10MB。'
          : '上传失败，请重试。'
      res.status(400).json({ error: 'upload_failed', msg })
      return
    }
    const userId = req.userId!
    const file = (req as express.Request & { file?: Express.Multer.File }).file
    if (!file) {
      res.status(400).json({ error: 'no_file', msg: '请选择要上传的 PDF 简历。' })
      return
    }
    try {
      const head = await fs.readFile(file.path, encodingNone())
      if (!head.subarray(0, 5).toString('latin1').startsWith('%PDF-')) {
        throw new Error('bad_pdf')
      }
      // 完整解析一次：拒绝加密/损坏 PDF，避免后续 AI 链路才报错
      await parseResumePdf(file.path)
      await fs.rename(file.path, resumePathFor(userId))
      const originalName = file.originalname || 'resume.pdf'
      await setResume(userId, {
        filename: `${userId}.pdf`,
        original_name: Buffer.from(originalName, 'latin1').toString('utf8'),
        size: file.size,
        uploaded_at: new Date().toISOString(),
      })
      res.json({ ok: true, has_resume: true, size: file.size })
    } catch (error) {
      await fs.rm(file.path, { force: true }).catch(() => undefined)
      const msg = (error as Error).message === 'bad_pdf' ? '文件不是有效的 PDF，请重新导出后上传。' : 'PDF 无法解析（可能已加密或已损坏）。'
      res.status(400).json({ error: 'invalid_pdf', msg })
    }
  })
})

function encodingNone(): { encoding: null } {
  return { encoding: null }
}

// 删除简历：文件与元信息一并清除
app.delete('/api/account/resume', requireUser(authSecret), async (req, res) => {
  const userId = req.userId!
  await fs.rm(resumePathFor(userId), { force: true }).catch(() => undefined)
  await clearResume(userId)
  res.json({ ok: true, has_resume: false })
})

// 下载自己的原始 PDF（前端预览/留存用）；他人 uid 路径无法猜到且有鉴权
app.get('/api/account/resume/file', requireUser(authSecret), async (req, res) => {
  const userId = req.userId!
  const account = await findById(userId)
  const filePath = resumePathFor(userId)
  if (!account?.resume) {
    res.status(404).json({ error: 'resume_not_found', msg: '你还没有上传简历。' })
    return
  }
  res.download(filePath, account.resume.original_name, (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({ error: 'resume_not_found', msg: '简历文件不存在，请重新上传。' })
    }
  })
})

// 只读：当前登录用户的简历 PDF → 文本 + 规则画像（不发送任何外部服务）
app.get('/api/resume', requireUser(authSecret), async (req, res) => {
  const userId = req.userId!
  try {
    const filePath = resumePathFor(userId)
    const { parsed, mtime, size } = await parseResumePdf(filePath)
    const account = await findById(userId)
    res.json({
      source: {
        file_name: account?.resume?.original_name ?? 'resume.pdf',
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
        msg: '你还没有上传简历，请先在本页上传 PDF。',
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

// AI 接口：必须登录 + 已上传本人简历；每账号每天 10 次，另有按 IP 兜底防刷豆包账单
const aiIpFallback = createIpRateLimit({ windowMs: 10 * 60 * 1000, max: 30 })
const aiGuards = [requireUser(authSecret), aiIpFallback, checkAiQuota]

// AI 深度画像：豆包把简历结构化为能力/亮点/短板/经历归属
app.post('/api/resume/ai-profile', ...aiGuards, async (req, res) => {
  if (!isArkConfigured()) {
    arkNotConfigured(res)
    return
  }
  try {
    const { parsed } = await parseResumePdf(resumePathFor(req.userId!))
    const profile = await buildAiProfile(parsed.fullText)
    const remaining = recordAiUsage(req.userId!)
    res.json({ engine: config.ark.model, generated_at: new Date().toISOString(), ai_remaining: remaining, profile })
  } catch (error) {
    sendAiError(res, error)
  }
})

// JD 精匹配：粘贴完整 JD，输出可解释评分、命中证据与缺口
app.post('/api/resume/match', ...aiGuards, async (req, res) => {
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
    const { parsed } = await parseResumePdf(resumePathFor(req.userId!))
    const match = await matchJd(parsed.fullText, jd.slice(0, 6000), pickJobMeta(req.body))
    const remaining = recordAiUsage(req.userId!)
    res.json({ engine: config.ark.model, generated_at: new Date().toISOString(), ai_remaining: remaining, match })
  } catch (error) {
    sendAiError(res, error)
  }
})

// 定向 bullet 改写：A 岗位定向版 + B 量化强化版
app.post('/api/resume/rewrite', ...aiGuards, async (req, res) => {
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
    const { parsed } = await parseResumePdf(resumePathFor(req.userId!))
    const rewrites = await rewriteBullets(parsed.fullText, jd.slice(0, 6000), pickJobMeta(req.body))
    const remaining = recordAiUsage(req.userId!)
    res.json({ engine: config.ark.model, generated_at: new Date().toISOString(), ai_remaining: remaining, rewrites })
  } catch (error) {
    sendAiError(res, error)
  }
})

// 面试准备包：JD + 简历生成预测面试题、答题要点与反问清单
app.post('/api/resume/interview-prep', ...aiGuards, async (req, res) => {
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
    const { parsed } = await parseResumePdf(resumePathFor(req.userId!))
    const prep = await buildInterviewPrep(parsed.fullText, jd.slice(0, 6000), pickJobMeta(req.body))
    const remaining = recordAiUsage(req.userId!)
    res.json({ engine: config.ark.model, generated_at: new Date().toISOString(), ai_remaining: remaining, prep })
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

// 面向用户展示的飞书节点名：去掉多维表复制时自动追加的「副本」等内部编辑痕迹
function friendlyNodeTitle(title: string): string {
  const cleaned = title.trim().replace(/[\s·\-—_]*副本+\s*$/, '').trim()
  return cleaned || title
}

// 只读：飞书面经看板表 → 工作台投递看板数据（含状态归并，不写回飞书）
app.get('/api/board', async (_req, res) => {
  try {
    const resolved = await resolveApp()
    const records = await searchAllRecords(resolved.appToken, config.feishu.boardTableId, {
      limit: 500,
    })
    const items = mapBoardRecords(records)
    res.json({
      source: friendlyNodeTitle(resolved.node.title),
      table: resolved.tables.find((t) => t.tableId === config.feishu.boardTableId)?.title ?? null,
      generated_at: new Date().toISOString(),
      total: items.length,
      items,
    })
  } catch (error) {
    handleFeishuError(error, res)
  }
})

// 只读：27届网申总表 → 岗位池分页查询
// 关键词 / 届别 / 学历 / 城市 / 企业性质 / 招聘类型直接走飞书 filter；
// 名企大厂因飞书不支持 AND 套 OR，改为「其他条件拉候选 + 公司名单内存过滤 + 内存分页」
app.get('/api/jobs', async (req, res) => {
  try {
    const resolved = await resolveApp()
    const natureRaw = typeof req.query.nature === 'string' ? req.query.nature : ''
    const recruitRaw = typeof req.query.recruit_type === 'string' ? req.query.recruit_type : ''
    const query: JobQuery = {
      keyword: typeof req.query.q === 'string' ? req.query.q : undefined,
      target: typeof req.query.target === 'string' ? req.query.target : undefined,
      degree: typeof req.query.degree === 'string' ? req.query.degree : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      nature: NATURE_GROUPS[natureRaw] ? natureRaw : undefined,
      recruitType: (RECRUIT_TYPE_OPTIONS as readonly string[]).includes(recruitRaw)
        ? recruitRaw
        : undefined,
      bigTech: req.query.big_tech === '1',
    }
    const source = friendlyNodeTitle(resolved.node.title)

    if (query.bigTech) {
      const allItems = await loadBigTechItems(resolved.appToken, config.feishu.jobsTableId, query)
      // 大厂模式下 page_token 即下一页起始偏移（飞书原生 token 不适用内存结果集）
      const offset = Number.parseInt(
        typeof req.query.page_token === 'string' ? req.query.page_token : '0',
        10,
      )
      const start = Number.isFinite(offset) && offset > 0 ? Math.min(offset, allItems.length) : 0
      const pageItems = allItems.slice(start, start + BIG_TECH_PAGE_SIZE)
      const nextOffset = start + pageItems.length
      res.json({
        source,
        total: allItems.length,
        has_more: nextOffset < allItems.length,
        page_token: nextOffset < allItems.length ? String(nextOffset) : undefined,
        items: pageItems,
      })
      return
    }

    const pageToken = typeof req.query.page_token === 'string' ? req.query.page_token : undefined
    const page = await searchRecords(resolved.appToken, config.feishu.jobsTableId, {
      pageSize: BIG_TECH_PAGE_SIZE,
      pageToken,
      filter: buildJobFilter(query),
      sort: JOB_SORT,
    })
    res.json({
      source,
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
      source: friendlyNodeTitle(resolved.node.title),
      filters: {
        target: TARGET_OPTIONS,
        degree: DEGREE_OPTIONS,
        nature: NATURE_OPTION_META,
        recruitType: RECRUIT_TYPE_OPTIONS,
        bigTech: BIG_TECH_META,
      },
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

// 全局兜底：Express 5 会把异步路由抛出的拒绝转发到这里，统一返回 JSON（避免默认 HTML 错页）
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error)
  res.status(500).json({ error: 'server_error', msg: message })
})

app.listen(config.port, () => {
  console.log(`[server] 飞书只读服务已启动：:${config.port}`)
})
