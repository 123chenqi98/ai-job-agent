// 简历规则画像：不依赖大模型的确定性抽取。
// 说明：该简历 PDF 的文本流中 4 段实习的时间行集中在前、bullet 集中在后，
// 无法在规则层把每条 bullet 可靠归属到具体实习段；精确归属由 P4 的 AI 画像完成。

export interface RuleEducation {
  school: string
  major: string | null
  degree: string | null
  period: string
  graduation_year: number | null
  gpa: string | null
  rank: string | null
  highlights: string[]
}

export interface ExperienceHead {
  period: string
  title: string
}

export interface RuleProfile {
  name: string | null
  target: string | null
  phone: string | null
  email: string | null
  links: string[]
  politics: string | null
  education: RuleEducation | null
  skill_groups: Array<{ name: string; detail: string }>
  skill_keywords: string[]
  internships: ExperienceHead[]
  projects: ExperienceHead[]
  internship_bullets: string[]
  project_bullets: string[]
  metrics: string[]
  evaluations: string[]
}

type LineKind = 'head' | 'bullet' | 'label' | 'plain'

interface MergedLine {
  kind: LineKind
  text: string
}

const PERIOD_PREFIX =
  /^(20\d{2})[-.](\d{1,2})\s*[~～–-]\s*(至今|20\d{2}[-.]\d{1,2})\s+(.+)$/
const BULLET_PREFIX = /^[•·▪◦]\s*/
const LABEL_PREFIX = /^(项目链接|项目描述|项目成果)\s*[：:]?/
// PDF 章节大标题常带私有使用区（PUA）图标字符，需独立成行，避免被并入上一条 bullet
const SECTION_TITLE_RE = new RegExp(
  '^[\\ue000-\\uf8ff\\s]*(个人信息|求职意向|实习经验|工作经历|项目经验|专业技能|教育背景|自我评价|荣誉奖项|校园经历)[\\ue000-\\uf8ff\\s]*$',
)
const PRIVATE_USE_CHARS = new RegExp('[\\ue000-\\uf8ff]', 'g')
const SKILL_NAME = /(SQL|Python|BI|统计|业务分析|机器学习|AI|大模型|Excel)/
const PHONE_RE = /1[3-9]\d{9}/
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/
const LINK_RE = /https?:\/\/[^\s）)]+/g
const METRIC_RE =
  /(\d+(\.\d+)?\s*(\+|%|pp|个百分点|万|亿|条|项|个|份|人|家|次|套|组|类|名|城市|分钟|小时)|提升|提高|下降|降低|缩短|减少|缩减|增长|贡献率|达成率)/

// 数据分析方向技能词典：仅输出在简历中真实命中的词
const SKILL_DICTIONARY = [
  'Hive SQL',
  'SQL',
  'Python',
  'Pandas',
  'NumPy',
  'Matplotlib',
  'Seaborn',
  'sklearn',
  'XGBoost',
  'LightGBM',
  'SHAP',
  'K-Means',
  'RFM',
  'Quick BI',
  'Tableau',
  'Power BI',
  '观远 BI',
  'FineBI',
  'A/B',
  'AB实验',
  't检验',
  '假设检验',
  '漏斗分析',
  'Text-to-SQL',
  'LLM',
  'AI Agent',
  'Prompt',
  'Excel',
  'VLOOKUP',
  'XLOOKUP',
  'SUMIFS',
  '数据清洗',
  '数据可视化',
  '指标体系',
  '用户分群',
  '埋点',
  'GMV',
  '机器学习',
]

function mergeLines(rawLines: string[]): MergedLine[] {
  const merged: MergedLine[] = []
  for (const raw of rawLines) {
    const text = raw.trim()
    if (!text) continue
    if (BULLET_PREFIX.test(text)) {
      merged.push({ kind: 'bullet', text: text.replace(BULLET_PREFIX, '').trim() })
    } else if (PERIOD_PREFIX.test(text)) {
      merged.push({ kind: 'head', text })
    } else if (LABEL_PREFIX.test(text)) {
      merged.push({ kind: 'label', text })
    } else if (SECTION_TITLE_RE.test(text)) {
      merged.push({ kind: 'plain', text: text.replace(PRIVATE_USE_CHARS, '').trim() })
    } else if (merged.length > 0 && (merged[merged.length - 1].kind === 'bullet' || merged[merged.length - 1].kind === 'label')) {
      // PDF 把一个条目断成多行：续行并入上一条
      merged[merged.length - 1].text += text
    } else {
      merged.push({ kind: 'plain', text })
    }
  }
  return merged
}

function splitPeriodHead(text: string): { period: string; title: string } | null {
  const match = text.match(PERIOD_PREFIX)
  if (!match) return null
  const end = match[3] === '至今' ? '至今' : match[3].replace('-', '.')
  return { period: `${match[1]}.${match[2]} ~ ${end}`, title: match[4].trim() }
}

function extractMetrics(bullets: string[]): string[] {
  const clauses: string[] = []
  for (const bullet of bullets) {
    for (const clause of bullet.split(/[；;。]/)) {
      const trimmed = clause.trim()
      if (trimmed.length < 6 || trimmed.length > 80) continue
      if (/\d/.test(trimmed) && METRIC_RE.test(trimmed)) {
        clauses.push(trimmed)
      }
    }
  }
  return Array.from(new Set(clauses)).slice(0, 14)
}

function asSkillGroup(line: MergedLine): { name: string; detail: string } | null {
  if (line.kind !== 'bullet') return null
  const match = line.text.match(/^([^：:]{2,20})[：:](.+)$/)
  if (!match) return null
  const name = match[1].trim()
  if (!SKILL_NAME.test(name)) return null
  return { name, detail: match[2].trim() }
}

export function extractRuleProfile(parsed: { pages: string[]; fullText: string }): RuleProfile {
  const text = parsed.fullText
  const pageLines = parsed.pages.map((page) => mergeLines(page.split('\n')))
  const firstPage = pageLines[0] ?? []
  const secondPage = pageLines[1] ?? []

  // 实习 / 项目抬头：第 1 页日期行是实习，第 2 页日期行（排除教育行）是项目
  const internships: ExperienceHead[] = []
  for (const line of firstPage) {
    if (line.kind !== 'head') continue
    const head = splitPeriodHead(line.text)
    if (head) internships.push(head)
  }

  const projects: ExperienceHead[] = []
  let educationHeadIndex = -1
  let educationHeadText = ''
  secondPage.forEach((line, index) => {
    if (line.kind !== 'head') return
    if (/大学|学院/.test(line.text)) {
      educationHeadIndex = index
      educationHeadText = line.text
    } else {
      const head = splitPeriodHead(line.text)
      if (head) projects.push(head)
    }
  })

  // 技能组与项目 bullet：教育行之前的 bullet
  const skillGroups: Array<{ name: string; detail: string }> = []
  const projectBullets: string[] = []
  secondPage.forEach((line, index) => {
    if (index >= educationHeadIndex && educationHeadIndex >= 0) return
    if (line.kind !== 'bullet') return
    const group = asSkillGroup(line)
    if (group) skillGroups.push(group)
    else projectBullets.push(line.text)
  })

  // 自我评价：教育行之后的非技能 bullet
  const evaluations: string[] = []
  if (educationHeadIndex >= 0) {
    for (let i = educationHeadIndex + 1; i < secondPage.length; i += 1) {
      const line = secondPage[i]
      if (line.kind === 'bullet' && !asSkillGroup(line)) evaluations.push(line.text)
    }
  }

  // 实习 bullet：第 1 页全部普通 bullet（本简历中技能组均在第 2 页）
  const internshipBullets = firstPage
    .filter((line) => line.kind === 'bullet' && !asSkillGroup(line))
    .map((line) => line.text)

  // 教育
  let education: RuleEducation | null = null
  if (educationHeadText) {
    const head = splitPeriodHead(educationHeadText)
    const rest = head?.title ?? ''
    const schoolMatch = rest.match(/^(.+?(大学|学院))/)
    const school = schoolMatch ? schoolMatch[1].trim() : rest
    const degree = rest.match(/(本科|硕士|博士|研究生)/)?.[1] ?? null
    const afterSchool = rest.slice(school.length)
    const major = afterSchool.replace(/[（(].*?[）)]/g, '').trim() || null
    const gpa = text.match(/GPA\s*([\d.]+)\s*\/\s*([\d.]+)/i)?.[0].replace(/GPA\s*/i, '') ?? null
    const rank = text.match(/专业前\s*\d+%/)?.[0] ?? null
    // 教育行之后连续的 plain 行均为荣誉/竞赛信息（可能被 PDF 断成多行），遇到 bullet 即止
    const honorLines: string[] = []
    for (let i = educationHeadIndex + 1; i < secondPage.length; i += 1) {
      if (secondPage[i].kind === 'plain') honorLines.push(secondPage[i].text)
      else break
    }
    // PDF 断行伪影会把中文词切成两半并留下空格，仅消除中文与中文之间的空格
    const honorsLine = honorLines.join(' ').replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1')
    const highlights = honorsLine
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s && !/GPA/.test(s))
      .slice(0, 5)
    education = {
      school,
      major,
      degree,
      period: head?.period ?? '',
      graduation_year: head ? Number(head.period.split('~')[1].replace(/[^\d]/g, '').slice(0, 4)) : null,
      gpa,
      rank,
      highlights,
    }
  }

  // 头部字段
  const targetLine = text.split('\n').find((l) => l.includes('求职意向'))
  const target = targetLine?.split(/[：:]/).slice(1).join(':').trim() || null
  const politics = text.match(/政治面貌\s*[：:]\s*([^\s]+)/)?.[1] ?? null
  const nameLine = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^[\u4e00-\u9fa5](\s|　)?[\u4e00-\u9fa5]$/.test(l))
  const name = nameLine ? nameLine.replace(/\s|　/g, '') : null
  const links = Array.from(new Set(text.match(LINK_RE) ?? []))

  // 技能词典命中：按首次出现位置排序
  const skillKeywords = SKILL_DICTIONARY.filter((kw) => text.includes(kw)).sort(
    (a, b) => text.indexOf(a) - text.indexOf(b),
  )

  return {
    name,
    target,
    phone: text.match(PHONE_RE)?.[0] ?? null,
    email: text.match(EMAIL_RE)?.[0] ?? null,
    links,
    politics,
    education,
    skill_groups: skillGroups,
    skill_keywords: skillKeywords,
    internships,
    projects,
    internship_bullets: internshipBullets,
    project_bullets: projectBullets,
    metrics: extractMetrics([...internshipBullets, ...projectBullets]),
    evaluations,
  }
}
