import { chatJson } from '../llm/ark.js'

// 豆包任务的输出模型（snake_case，与前端 src/types/resume.ts 对齐）

export interface AiExperience {
  period: string
  org: string
  title: string
  bullets: string[]
}

export interface AiProfile {
  summary: string
  target_roles: string[]
  core_competencies: string[]
  hard_skills: string[]
  tools: string[]
  strengths: string[]
  weaknesses: string[]
  experience_map: AiExperience[]
}

export interface JdDimension {
  key: 'hard_gate' | 'skill' | 'experience' | 'direction'
  label: string
  score: number
  reason: string
}

// 硬否决项：JD 中出现的硬性门槛逐条核对，pass=满足 fail=不满足 unknown=JD 未写明
export interface DealBreaker {
  item: string
  status: 'pass' | 'fail' | 'unknown'
  note: string
}

export interface JdMatch {
  score: number
  level: 'high' | 'medium' | 'low'
  decision: string
  deal_breakers: DealBreaker[]
  dimension_scores: JdDimension[]
  matched: Array<{ point: string; evidence: string }>
  gaps: Array<{ gap: string; suggestion: string }>
  conclusion: string
}

export interface InterviewQuestion {
  category: 'technical' | 'project' | 'behavioral'
  question: string
  difficulty: 'high' | 'mid' | 'low'
  answer_points: string[]
  // 答这道题应调用的简历素材（实习/项目/技能），必须来自简历事实
  resume_anchor: string
}

export interface InterviewPrep {
  overview: string
  questions: InterviewQuestion[]
  topics_to_review: string[]
  questions_to_ask: string[]
}

export interface BulletRewriteItem {
  original: string
  version_a: string
  version_b: string
  reason: string
}

export interface BulletRewrites {
  coverage_score: number
  keywords_to_cover: string[]
  rewrites: BulletRewriteItem[]
  new_bullets: string[]
  tips: string[]
}

const FACT_RULES =
  '铁律：只能依据简历中明确出现的事实作答，禁止编造任何公司、项目、指标数字、奖项或经历；信息不足时给空数组或如实说明。全部使用简体中文。严格只输出一个 JSON 对象，不要输出任何解释或 markdown。'

// ---- 输出结构兜底 ----
// 模型偶发漏字段 / 把数组输出成字符串 / 分数越界；前端直接 .map 会整站白屏，
// 这里在服务端统一归一化为接口契约（只做结构修正，不编造内容）。
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => asString(v)).filter((v) => v.trim())
  if (typeof value === 'string') return value ? [value] : []
  return []
}

function clampScore(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(0, Math.min(100, Math.round(num)))
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function normalizeProfile(raw: unknown): AiProfile {
  const r = asRecord(raw)
  const exp = Array.isArray(r.experience_map) ? r.experience_map : []
  return {
    summary: asString(r.summary),
    target_roles: asStringArray(r.target_roles),
    core_competencies: asStringArray(r.core_competencies),
    hard_skills: asStringArray(r.hard_skills),
    tools: asStringArray(r.tools),
    strengths: asStringArray(r.strengths),
    weaknesses: asStringArray(r.weaknesses),
    experience_map: exp.map((item) => {
      const e = asRecord(item)
      return {
        period: asString(e.period),
        org: asString(e.org),
        title: asString(e.title),
        bullets: asStringArray(e.bullets),
      }
    }),
  }
}

const DIMENSION_KEYS = ['hard_gate', 'skill', 'experience', 'direction'] as const
const DEAL_STATUSES = ['pass', 'fail', 'unknown'] as const

function normalizeMatch(raw: unknown): JdMatch {
  const r = asRecord(raw)
  const dimensions = Array.isArray(r.dimension_scores) ? r.dimension_scores : []
  return {
    score: clampScore(r.score),
    level: asEnum(r.level, ['high', 'medium', 'low'] as const, 'medium'),
    decision: asString(r.decision),
    deal_breakers: (Array.isArray(r.deal_breakers) ? r.deal_breakers : []).map((item) => {
      const d = asRecord(item)
      return {
        item: asString(d.item),
        status: asEnum(d.status, DEAL_STATUSES, 'unknown'),
        note: asString(d.note),
      }
    }),
    dimension_scores: dimensions
      .map((item) => {
        const d = asRecord(item)
        return {
          key: asEnum(d.key, DIMENSION_KEYS, 'skill'),
          label: asString(d.label),
          score: clampScore(d.score),
          reason: asString(d.reason),
        }
      })
      .slice(0, 4),
    matched: (Array.isArray(r.matched) ? r.matched : []).map((item) => {
      const m = asRecord(item)
      return { point: asString(m.point), evidence: asString(m.evidence) }
    }),
    gaps: (Array.isArray(r.gaps) ? r.gaps : []).map((item) => {
      const g = asRecord(item)
      return { gap: asString(g.gap), suggestion: asString(g.suggestion) }
    }),
    conclusion: asString(r.conclusion),
  }
}

function normalizeRewrites(raw: unknown): BulletRewrites {
  const r = asRecord(raw)
  return {
    coverage_score: clampScore(r.coverage_score),
    keywords_to_cover: asStringArray(r.keywords_to_cover),
    rewrites: (Array.isArray(r.rewrites) ? r.rewrites : []).map((item) => {
      const w = asRecord(item)
      return {
        original: asString(w.original),
        version_a: asString(w.version_a),
        version_b: asString(w.version_b),
        reason: asString(w.reason),
      }
    }),
    new_bullets: asStringArray(r.new_bullets),
    tips: asStringArray(r.tips),
  }
}

const QUESTION_CATEGORIES = ['technical', 'project', 'behavioral'] as const
const DIFFICULTIES = ['high', 'mid', 'low'] as const

function normalizeInterviewPrep(raw: unknown): InterviewPrep {
  const r = asRecord(raw)
  return {
    overview: asString(r.overview),
    questions: (Array.isArray(r.questions) ? r.questions : []).map((item) => {
      const q = asRecord(item)
      return {
        category: asEnum(q.category, QUESTION_CATEGORIES, 'technical'),
        question: asString(q.question),
        difficulty: asEnum(q.difficulty, DIFFICULTIES, 'mid'),
        answer_points: asStringArray(q.answer_points),
        resume_anchor: asString(q.resume_anchor),
      }
    }),
    topics_to_review: asStringArray(r.topics_to_review),
    questions_to_ask: asStringArray(r.questions_to_ask),
  }
}

export async function buildAiProfile(resumeText: string): Promise<AiProfile> {
  const system = [
    '你是资深数据分析师求职教练，负责把简历原文结构化为候选人画像。',
    FACT_RULES,
    'JSON 结构：',
    '{',
    '  "summary": "一句话定位（不超过60字）",',
    '  "target_roles": ["适合投递的岗位方向"],',
    '  "core_competencies": ["3-6项核心业务/分析能力"],',
    '  "hard_skills": ["硬技能，如SQL/AB实验/指标体系"],',
    '  "tools": ["具体工具，如Hive/Tableau/Pandas"],',
    '  "strengths": ["3-5条简历亮点，需可被原文佐证"],',
    '  "weaknesses": ["3-5条针对数据分析校招的客观短板与改进建议"],',
    '  "experience_map": [{"period":"时间段","org":"公司/学校/项目归属","title":"岗位/项目名","bullets":["归属到该经历的量化要点"]}]',
    '}',
    'experience_map 需把简历中的 bullet 尽量准确归属到对应实习/项目；分数与数字必须来自原文。',
  ].join('\n')
  return normalizeProfile(await chatJson<unknown>(system, `简历原文：\n\n${resumeText}`))
}

export async function matchJd(
  resumeText: string,
  jdText: string,
  jobMeta?: { company?: string; title?: string },
): Promise<JdMatch> {
  const system = [
    '你是严格的招聘匹配评估器，依据候选人简历与目标岗位 JD 做可解释匹配评分，输出一份岗位评估报告。',
    FACT_RULES,
    '先做硬否决项核对：deal_breakers 逐条提取 JD 的硬性门槛（如毕业届别、学历、专业、工作年限/实习时长、城市/出勤、语言、证件等），对照简历判定 pass（满足）/fail（不满足）/unknown（JD 未写明或简历无法判断），note 用简历事实说明依据；JD 没写硬门槛时给空数组。',
    '评分要求：score 为 0-100 整数；四个维度各打 0-100：hard_gate 硬门槛、skill 技能、experience 经历相关度、direction 方向/业务匹配。',
    '若存在任一 fail 的硬否决项，score 不得高于 55 且 decision 只能是「谨慎投递」；matched 每条必须给出简历中的具体证据；gaps 必须给出可执行的补救建议（如缺经历时如何用现有经历迁移表达）。',
    'decision 从「强烈建议投递 / 建议投递 / 补强后投递 / 谨慎投递」中择一；level 为 high/medium/low。',
    'JSON 结构：',
    '{"score":0,"level":"high|medium|low","decision":"...","deal_breakers":[{"item":"门槛项，如 2027届毕业","status":"pass|fail|unknown","note":"判定依据"}],"dimension_scores":[{"key":"hard_gate","label":"硬门槛","score":0,"reason":"..."}],"matched":[{"point":"命中要求","evidence":"简历证据"}],"gaps":[{"gap":"缺口","suggestion":"补救建议"}],"conclusion":"120字内总体结论"}',
  ].join('\n')
  const metaLine = jobMeta?.company || jobMeta?.title
    ? `目标岗位：${[jobMeta.company, jobMeta.title].filter(Boolean).join(' · ')}\n`
    : ''
  return normalizeMatch(
    await chatJson<unknown>(system, `${metaLine}JD 原文：\n${jdText}\n\n候选人简历：\n\n${resumeText}`),
  )
}

export async function rewriteBullets(
  resumeText: string,
  jdText: string,
  jobMeta?: { company?: string; title?: string },
): Promise<BulletRewrites> {
  const system = [
    '你是简历优化专家，基于候选人真实经历与目标岗位 JD，产出定向简历改写。',
    FACT_RULES,
    '改写要求：original 必须逐字摘自简历；version_a 为「岗位定向版」，自然融入 JD 关键词但不堆砌；version_b 为「量化强化版」，把数字与业务结果前置、STAR 结构；每条 reason 不超过40字。',
    'rewrites 最多 5 条，优先选与 JD 最相关、且原句量化不足的经历。new_bullets 只能对简历已有事实换角度重述，严禁虚构经历。coverage_score 为 0-100 整数。',
    'JSON 结构：',
    '{"coverage_score":0,"keywords_to_cover":["JD中应在简历体现的关键词"],"rewrites":[{"original":"简历原句","version_a":"定向版","version_b":"量化版","reason":"改写理由"}],"new_bullets":["基于现有事实可新增的表述"],"tips":["2-4条投递该岗位的定制建议"]}',
  ].join('\n')
  const metaLine = jobMeta?.company || jobMeta?.title
    ? `目标岗位：${[jobMeta.company, jobMeta.title].filter(Boolean).join(' · ')}\n`
    : ''
  return normalizeRewrites(
    await chatJson<unknown>(
      system,
      `${metaLine}JD 原文：\n${jdText}\n\n候选人简历：\n\n${resumeText}`,
    ),
  )
}

export async function buildInterviewPrep(
  resumeText: string,
  jdText: string,
  jobMeta?: { company?: string; title?: string },
): Promise<InterviewPrep> {
  const system = [
    '你是资深数据分析师面试官与求职教练，依据目标岗位 JD 与候选人真实简历，生成个性化面试准备包。',
    FACT_RULES,
    '出题要求：questions 共 8-10 题，覆盖三类 category：technical（岗位硬技能/统计/SQL/业务方法，4-5 题）、project（针对简历具体实习/项目的追问，含指标口径与项目难点，2-3 题）、behavioral（行为面，如冲突/失败/为什么投这个岗位，2 题）。',
    '每题 difficulty 为 high/mid/low；answer_points 给 3-5 条答题要点，须结合候选人真实背景组织，project/behavioral 类必须引用简历中真实的公司、项目或数字，禁止编造经历；resume_anchor 指明该题应调用简历中的哪段素材（技术题写「通用：xx技能」即可）。',
    'topics_to_review 给 3-6 个临面前应复习的主题；questions_to_ask 给 3-5 条候选人可反问面试官的问题（团队/业务/成长）。overview 用 80 字内概括该岗位面试的准备重心。',
    'JSON 结构：',
    '{"overview":"...","questions":[{"category":"technical|project|behavioral","question":"...","difficulty":"high|mid|low","answer_points":["要点"],"resume_anchor":"简历素材锚点"}],"topics_to_review":["..."],"questions_to_ask":["..."]}',
  ].join('\n')
  const metaLine = jobMeta?.company || jobMeta?.title
    ? `目标岗位：${[jobMeta.company, jobMeta.title].filter(Boolean).join(' · ')}\n`
    : ''
  return normalizeInterviewPrep(
    await chatJson<unknown>(
      system,
      `${metaLine}JD 原文：\n${jdText}\n\n候选人简历：\n\n${resumeText}`,
    ),
  )
}
