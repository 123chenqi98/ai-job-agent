import type { JdMatch } from '@/types/resume'

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
}

const STORAGE_KEY = 'ai-job-agent:eval-history:v1'
const LIMIT = 30

function stableId(company: string | undefined, title: string | undefined, jd: string): string {
  const raw = `${company ?? ''}|${title ?? ''}|${jd.slice(0, 2000)}`
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  return `eval-${(hash >>> 0).toString(36)}`
}

function readAll(): EvalRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as EvalRecord[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((r) => r && typeof r.score === 'number' && r.match)
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

export function saveEvalRecord(input: {
  company?: string
  title?: string
  jd: string
  match: JdMatch
  source: 'single' | 'batch'
  createdAt?: string
}): EvalRecord {
  const record: EvalRecord = {
    id: stableId(input.company, input.title, input.jd),
    company: input.company,
    title: input.title,
    jd: input.jd,
    score: input.match.score,
    level: input.match.level,
    decision: input.match.decision,
    deal_pass: (input.match.deal_breakers ?? []).filter((g) => g.status === 'pass').length,
    deal_fail: (input.match.deal_breakers ?? []).filter((g) => g.status === 'fail').length,
    source: input.source,
    created_at: input.createdAt ?? new Date().toISOString(),
    match: input.match,
  }
  writeAll(upsert(readAll(), record))
  return record
}

export function saveEvalRecords(
  inputs: Array<{ company?: string; title?: string; jd: string; match: JdMatch }>,
): void {
  if (inputs.length === 0) return
  const now = new Date().toISOString()
  let records = readAll()
  inputs.forEach((input) => {
    const record: EvalRecord = {
      id: stableId(input.company, input.title, input.jd),
      company: input.company,
      title: input.title,
      jd: input.jd,
      score: input.match.score,
      level: input.match.level,
      decision: input.match.decision,
      deal_pass: (input.match.deal_breakers ?? []).filter((g) => g.status === 'pass').length,
      deal_fail: (input.match.deal_breakers ?? []).filter((g) => g.status === 'fail').length,
      source: 'batch',
      created_at: now,
      match: input.match,
    }
    records = upsert(records, record)
  })
  writeAll(records)
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
  return TITLE_KEYWORDS.some((k) => x.includes(k) && y.includes(k))
}

export function findEvalForJob(
  company: string | null | undefined,
  jobTitle: string | null | undefined,
): EvalRecord | null {
  const records = listEvalRecords()
  const hit = records.find((r) => {
    if (!r.company || !company || !companyMatch(r.company, company)) return false
    if (!r.title || !jobTitle) return true
    return titleMatch(r.title, jobTitle)
  })
  return hit ?? null
}
