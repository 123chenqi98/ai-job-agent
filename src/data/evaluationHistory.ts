import type { InterviewPrep, JdMatch } from '@/types/resume'

// 岗位评估历史：仅存本机 localStorage，不入仓库、不写飞书；上限 30 条，同一岗位重复评估覆盖更新

export interface EvalRecord {
  id: string
  company?: string
  title?: string
  jd: string
  score: number
  level: JdMatch['level']
  decision: string
  deal_pass: number
  deal_fail: number
  source: 'single' | 'batch'
  created_at: string
  match: JdMatch
  prep?: InterviewPrep
}

const STORAGE_KEY = 'ai-job-agent:eval-history:v1'
const LIMIT = 30

export function makeEvalId(
  company: string | undefined,
  title: string | undefined,
  jd: string,
): string {
  const raw = `${company ?? ''}|${title ?? ''}|${jd.slice(0, 2000)}`
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  return `eval-${(hash >>> 0).toString(36)}`
}

function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.min(100, Math.round(num)))
}

function strArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
}

// 旧版本地数据可能来自未做结构兜底的模型输出；读取时统一加固，防止历史脏数据打崩渲染
function sanitizeRecord(raw: Partial<EvalRecord>): EvalRecord | null {
  if (!raw || typeof raw.jd !== 'string' || !raw.match || typeof raw.match !== 'object') return null
  const m = raw.match as Partial<JdMatch>
  const match: JdMatch = {
    score: clampScore(m.score),
    level: m.level === 'high' || m.level === 'low' ? m.level : 'medium',
    decision: typeof m.decision === 'string' ? m.decision : '',
    deal_breakers: Array.isArray(m.deal_breakers)
      ? m.deal_breakers.map((g) => ({
          item: String(g?.item ?? ''),
          status: g?.status === 'pass' || g?.status === 'fail' ? g.status : 'unknown',
          note: String(g?.note ?? ''),
        }))
      : [],
    dimension_scores: Array.isArray(m.dimension_scores)
      ? m.dimension_scores.map((d) => ({
          key:
            d?.key === 'hard_gate' || d?.key === 'experience' || d?.key === 'direction'
              ? d.key
              : 'skill',
          label: String(d?.label ?? ''),
          score: clampScore(d?.score),
          reason: String(d?.reason ?? ''),
        }))
      : [],
    matched: Array.isArray(m.matched)
      ? m.matched.map((x) => ({ point: String(x?.point ?? ''), evidence: String(x?.evidence ?? '') }))
      : [],
    gaps: Array.isArray(m.gaps)
      ? m.gaps.map((x) => ({ gap: String(x?.gap ?? ''), suggestion: String(x?.suggestion ?? '') }))
      : [],
    conclusion: typeof m.conclusion === 'string' ? m.conclusion : '',
  }
  const dealPass = match.deal_breakers.filter((g) => g.status === 'pass').length
  const dealFail = match.deal_breakers.filter((g) => g.status === 'fail').length
  return {
    id: typeof raw.id === 'string' ? raw.id : makeEvalId(raw.company, raw.title, raw.jd),
    company: typeof raw.company === 'string' ? raw.company : undefined,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    jd: raw.jd,
    score: match.score,
    level: match.level,
    decision: match.decision,
    deal_pass: typeof raw.deal_pass === 'number' ? raw.deal_pass : dealPass,
    deal_fail: typeof raw.deal_fail === 'number' ? raw.deal_fail : dealFail,
    source: raw.source === 'batch' ? 'batch' : 'single',
    created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
    match,
    prep: sanitizePrep(raw.prep),
  }
}

function sanitizePrep(value: unknown): InterviewPrep | undefined {
  if (!value || typeof value !== 'object') return undefined
  const p = value as Partial<InterviewPrep>
  return {
    overview: typeof p.overview === 'string' ? p.overview : '',
    questions: Array.isArray(p.questions)
      ? p.questions.map((q) => ({
          category:
            q.category === 'project' || q.category === 'behavioral' ? q.category : 'technical',
          question: String(q.question ?? ''),
          difficulty: q.difficulty === 'high' || q.difficulty === 'low' ? q.difficulty : 'mid',
          answer_points: strArray(q.answer_points) as string[],
          resume_anchor: String(q.resume_anchor ?? ''),
        }))
      : [],
    topics_to_review: strArray(p.topics_to_review) as string[],
    questions_to_ask: strArray(p.questions_to_ask) as string[],
  }
}

function readAll(): EvalRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Partial<EvalRecord>>
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeRecord).filter((r): r is EvalRecord => r !== null)
  } catch {
    return []
  }
}

function writeAll(records: EvalRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, LIMIT)))
  } catch {
    // localStorage 不可用（隐私模式/配额）时静默降级，不影响评估主流程
  }
}

export function listEvalRecords(): EvalRecord[] {
  return readAll().sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

function upsert(records: EvalRecord[], record: EvalRecord): EvalRecord[] {
  const rest = records.filter((r) => r.id !== record.id)
  return [record, ...rest].slice(0, LIMIT)
}

function buildRecord(input: {
  company?: string
  title?: string
  jd: string
  match: JdMatch
  source: 'single' | 'batch'
  createdAt?: string
  prep?: InterviewPrep
}, existing: EvalRecord | undefined): EvalRecord {
  return {
    id: makeEvalId(input.company, input.title, input.jd),
    company: input.company,
    title: input.title,
    jd: input.jd,
    score: input.match.score,
    level: input.match.level,
    decision: input.match.decision,
    deal_pass: (input.match.deal_breakers ?? []).filter((g) => g.status === 'pass').length,
    deal_fail: (input.match.deal_breakers ?? []).filter((g) => g.status === 'fail').length,
    source: input.source,
    created_at: input.createdAt ?? existing?.created_at ?? new Date().toISOString(),
    match: input.match,
    // 同一岗位（id 相同）重新评估时，已生成的面试准备包仍对应该 JD，予以保留
    prep: input.prep ?? existing?.prep,
  }
}

export function saveEvalRecord(input: {
  company?: string
  title?: string
  jd: string
  match: JdMatch
  source: 'single' | 'batch'
  createdAt?: string
  prep?: InterviewPrep
}): EvalRecord {
  const records = readAll()
  const id = makeEvalId(input.company, input.title, input.jd)
  const record = buildRecord(input, records.find((r) => r.id === id))
  writeAll(upsert(records, record))
  return record
}

export function saveEvalRecords(
  inputs: Array<{ company?: string; title?: string; jd: string; match: JdMatch }>,
): void {
  if (inputs.length === 0) return
  const now = new Date().toISOString()
  let records = readAll()
  inputs.forEach((input) => {
    const id = makeEvalId(input.company, input.title, input.jd)
    const record = buildRecord(
      { ...input, source: 'batch', createdAt: now },
      records.find((r) => r.id === id),
    )
    records = upsert(records, record)
  })
  writeAll(records)
}

export function getEvalRecord(id: string): EvalRecord | null {
  return readAll().find((r) => r.id === id) ?? null
}

// 面试准备包生成后挂到既有评估记录上，回看历史时不必重复烧 token
export function saveEvalPrep(id: string, prep: InterviewPrep): void {
  const records = readAll()
  const target = records.find((r) => r.id === id)
  if (!target) return
  writeAll(upsert(records, { ...target, prep }))
}

export function removeEvalRecord(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id))
}

export function clearEvalRecords(): void {
  writeAll([])
}

// ---- 看板联动：按公司+岗位匹配历史评估 ----

function normalize(value: string): string {
  return value.replace(/[\s（）()【】[\]\-·]/g, '').toLowerCase()
}

function companyMatch(a: string, b: string): boolean {
  const strip = (s: string) =>
    s.replace(/(股份|有限|责任|公司|集团|控股|科技|信息技术|网络技术|互联网)/g, '')
  const x = strip(normalize(a))
  const y = strip(normalize(b))
  return x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x))
}

const TITLE_KEYWORDS = [
  '数据分析',
  '商业分析',
  '经营分析',
  'bi',
  '数据科学',
  '算法',
  '机器学习',
  '报表',
  '可视化',
  '运营',
  '产品',
  '市场',
]

function titleMatch(a: string, b: string): boolean {
  const x = normalize(a)
  const y = normalize(b)
  if (x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x))) return true
  // 单词关键词（如「产品」「运营」）容易把产品经理挂到产品运营上：
  // 只有双方至少共享 2 个方向词时才认定同一岗位，宁可漏挂不可张冠李戴
  const shared = TITLE_KEYWORDS.filter((k) => x.includes(k) && y.includes(k))
  return shared.length >= 2
}

export function findEvalForJob(
  company: string | null | undefined,
  jobTitle: string | null | undefined,
): EvalRecord | null {
  const records = listEvalRecords()
  const hit = records.find((r) => {
    if (!r.company || !company || !companyMatch(r.company, company)) return false
    // 公司同名但岗位名缺失时无法安全归属（如同一公司评估过多个岗位），不展示角标
    if (!r.title || !jobTitle) return false
    return titleMatch(r.title, jobTitle)
  })
  return hit ?? null
}
