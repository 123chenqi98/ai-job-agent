// 简历规则画像：不依赖大模型的确定性抽取（rule@v2）。
// 通用策略：
//   1) 识别分节标题（剥离 PUA 图标与空格），兼容「标题在前 / 内容在前」两种 PDF 文本顺序；
//   2) 经历条目以「日期区间行」为锚点，兼容 2024年09月、2024.09、2024-09 等格式；
//   3) bullet 支持 • 符号、「标签：」与常见动词开头，PDF 硬换行自动拼接；
//   4) 日期行堆叠、bullet 集中在后且无逐段标记时，bullet 作为段落级 loose bullets 保留，不强行错配。

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

export interface RuleExperience {
  org: string | null
  title: string
  period: string
  bullets: string[]
}

export interface RuleProfile {
  name: string | null
  target: string | null
  phone: string | null
  email: string | null
  links: string[]
  politics: string | null
  education: RuleEducation[]
  skill_groups: Array<{ name: string; detail: string }>
  skill_keywords: string[]
  internships: RuleExperience[]
  work_experiences: RuleExperience[]
  projects: RuleExperience[]
  // 简历未逐段标注归属时的段落级实习要点
  internship_bullets: string[]
  awards: string[]
  metrics: string[]
  evaluations: string[]
}

type SectionKey =
  | 'education'
  | 'internship'
  | 'work'
  | 'project'
  | 'skills'
  | 'awards'
  | 'evaluation'
  | 'other'

const PRIVATE_USE_CHARS = /[-]/g
const BULLET_PREFIX = /^[•·▪◦*]\s*/
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE_RE = /1[3-9](?:\d[-\s]?){9}/
const LINK_RE = /https?:\/\/[^\s）)]+/g
const SKILL_NAME = /(SQL|Python|BI|统计|业务分析|机器学习|AI|大模型|Excel|数据|可视化)/

// 日期区间：2024年09月 - 2027年06月 / 2024.09 ~ 至今 / 2024-09 – 2026-08
const DATE_RE =
  /(20\d{2})[年.\-/](\d{1,2})月?\s*[~～到至–—-]{1,2}\s*(至今|(?:20\d{2})[年.\-/](?:\d{1,2})月?)/

// 「标签：内容」式开头（标签 2–12 字）
const LABEL_COLON = /^([^：:]{2,12})\s*[：:]\s*(.*)$/
// 无标签、以常见动词/语义词开头的新 bullet
const LEAD_KEYWORD =
  /^(参与|负责|独立|根据|结合|针对|协助|完成|梳理|牵头|主导|跟进|支持|优化|提升|搭建|基于|运用|围绕|依托|采用|开展|落地|通过|推动|保障|精选|月均|每周|累计)/

// 项目段落重置标记：出现「项目链接」即指向下一个项目的内容
const PROJECT_RESET = /^项目链接/

const METRIC_RE =
  /(\d+(\.\d+)?\s*(\+|%|pp|个百分点|万|亿|条|项|个|份|人|家|次|套|组|类|名|张|页|期|版|城市|分钟|小时)|\d+\+|提升|提高|下降|降低|缩短|减少|缩减|增长|贡献率|达成率)/

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

// 分节标题归一化后 -> 语义；含个别 PDF 抽取残缺的标题别名（如「经」= 项目经验）
const SECTION_TITLES: Record<string, SectionKey> = {
  教育背景: 'education',
  教育经历: 'education',
  实习经历: 'internship',
  实习经验: 'internship',
  实习: 'internship',
  正式工作经历: 'work',
  正式工作经验: 'work',
  工作经历: 'work',
  工作经验: 'work',
  项目经历: 'project',
  项目经验: 'project',
  项目: 'project',
  经: 'project',
  专业技能: 'skills',
  技能专长: 'skills',
  技能: 'skills',
  荣誉奖项: 'awards',
  获奖经历: 'awards',
  获奖: 'awards',
  奖项: 'awards',
  荣誉: 'awards',
  自我评价: 'evaluation',
  个人评价: 'evaluation',
  校园经历: 'other',
}

function matchSectionTitle(rawLine: string): SectionKey | null {
  const normalized = rawLine.replace(PRIVATE_USE_CHARS, '').replace(/\s/g, '')
  if (!normalized || normalized.length > 8) return null
  return SECTION_TITLES[normalized] ?? null
}

function normalizePeriod(match: RegExpMatchArray): string {
  const start = `${match[1]}.${match[2].padStart(2, '0')}`
  if (match[3] === '至今') return `${start} ~ 至今`
  const end = match[3].match(/(20\d{2})[年.\-/](\d{1,2})/)
  if (!end) return start
  return `${start} ~ ${end[1]}.${end[2].padStart(2, '0')}`
}

function splitOrgTitle(headline: string): { org: string | null; title: string } {
  // 「项目名 角色A&角色B」式：末尾 token 含 &，前面是项目名
  const ampMatch = headline.match(/^(.*?)\s+(\S+[&＆]\S+)$/)
  if (ampMatch && ampMatch[1]) {
    return { org: null, title: `${ampMatch[1].trim()}（${ampMatch[2].replace('＆', '&').trim()}）` }
  }

  const roleMatch = headline.match(
    /(实习生|工程师|分析师|设计师|设计|插画师|剪辑师|经理|主管|助理|负责人|研究员|专员|顾问|视觉组|道具组|线索设计|开发)/,
  )
  if (roleMatch && roleMatch.index !== undefined) {
    const before = headline.slice(0, roleMatch.index)
    const cut = before.lastIndexOf(' ')
    if (cut > 0) {
      return {
        org: headline.slice(0, cut).trim() || null,
        title: headline.slice(cut + 1).trim(),
      }
    }
  }
  const dashMatch = headline.match(/\s+[-–—]\s+/)
  if (dashMatch && dashMatch.index !== undefined) {
    return {
      org: headline.slice(0, dashMatch.index).trim(),
      title: headline.slice(dashMatch.index + dashMatch[0].length).trim(),
    }
  }
  return { org: null, title: headline }
}

function makeEntry(dateLine: string, match: RegExpMatchArray): RuleExperience {
  const headline = (
    dateLine.slice(0, match.index) + dateLine.slice((match.index ?? 0) + match[0].length)
  )
    .replace(/^[\s|｜:：-]+|[\s|｜:：-]+$/g, '')
    .trim()
  const { org, title } = splitOrgTitle(headline)
  return { org, title: title || headline || '未识别职位', period: normalizePeriod(match), bullets: [] }
}

interface RawSection {
  key: SectionKey
  lines: string[]
}

// 依据分节标题把全文切成「标题 -> 行集合」，自动识别内容在标题之前 / 之后
function splitSections(
  lines: string[],
  headerEnd: number,
): { header: string[]; sections: RawSection[] } {
  const headings: Array<{ index: number; key: SectionKey }> = []
  lines.forEach((line, index) => {
    const key = matchSectionTitle(line)
    if (key && key !== 'other') headings.push({ index, key })
  })

  // 文本顺序约定：首个标题与首个日期行谁先出现。
  // 标题先于日期 -> 内容在标题之后（常见排版）；日期先于标题 -> 内容在标题之前。
  let firstDateIndexGlobal = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (DATE_RE.test(lines[i]!)) {
      firstDateIndexGlobal = i
      break
    }
  }
  const firstHeadingIndex = headings[0]?.index ?? -1
  const contentBeforeHeading =
    firstDateIndexGlobal !== -1 &&
    (firstHeadingIndex === -1 || firstDateIndexGlobal < firstHeadingIndex)

  const buckets = new Map<SectionKey, string[]>()
  const append = (key: SectionKey, from: number, to: number) => {
    if (to <= from) return
    const bucket = buckets.get(key)
    const slice = lines.slice(from, to)
    if (bucket) bucket.push(...slice)
    else buckets.set(key, slice)
  }

  if (contentBeforeHeading) {
    // 块在标题之前；首个块（标题之前）除头部外归第一个标题
    const first = headings[0]
    if (first) append(first.key, headerEnd, first.index)
    headings.forEach((h, i) => {
      if (i === 0) return
      append(h.key, headings[i - 1]!.index + 1, h.index)
    })
  } else {
    // 块在标题之后；末尾块归最后一个标题
    headings.forEach((h, i) => {
      const next = i === headings.length - 1 ? lines.length : headings[i + 1]!.index
      append(h.key, h.index + 1, next)
    })
  }

  const sections: RawSection[] = Array.from(buckets, ([key, sectionLines]) => ({
    key,
    lines: sectionLines,
  }))
  return { header: lines.slice(0, headerEnd), sections }
}

// 丢弃条目末尾的版面碎词（如单独成行的「合作」，其后紧跟下一个日期行）
function dropTrailingFragments(rawLines: string[], dateIndexes: Set<number>): string[] {
  return rawLines.filter((line, i) => {
    const text = line.trim()
    if (!/^[一-龥]{2,3}$/.test(text)) return true
    for (let j = i + 1; j < rawLines.length; j += 1) {
      const other = rawLines[j]!.trim()
      if (!other) continue
      return !dateIndexes.has(j)
    }
    return true
  })
}

// 将一段原文行切分为 bullet 数组
function segmentBullets(rawLines: string[]): string[] {
  const bullets: string[] = []
  let current: string | null = null

  const push = () => {
    if (current && current.trim()) bullets.push(current.trim())
    current = null
  }

  for (const raw of rawLines) {
    const text = raw.trim()
    if (!text) continue
    if (PROJECT_RESET.test(text)) continue

    let working = text
    if (BULLET_PREFIX.test(working)) working = working.replace(BULLET_PREFIX, '').trim()

    const labelMatch = working.match(LABEL_COLON)
    const isLabelStart = labelMatch !== null
    const isBracketStart = working.startsWith('【')
    const isKeywordStart = LEAD_KEYWORD.test(working)
    // 上一条以未闭合标点结尾（PDF 换行多发生在逗号处）：动词行按续行处理
    const previousOpen = current !== null && /[，、,（(]$/.test(current)

    if (isLabelStart || isBracketStart || (isKeywordStart && !previousOpen)) push()
    if (isKeywordStart && previousOpen) {
      current += working
      continue
    }

    if (isLabelStart) {
      const label = labelMatch![1]!
      let content = labelMatch![2]!.trim()
      if (label === '项目描述' || label === '项目成果') {
        if (content) current = content
        // 空的「项目成果：」等待后续 • bullet
        else current = null
      } else {
        // 保留有信息量的标签（如「激励设计：…」）
        current = content ? `${label}：${content}` : label
      }
    } else if (current === null) {
      current = working
    } else {
      current += working
    }
  }
  push()
  return bullets
}

// 经历类分节解析
function parseExperience(rawLines: string[]): { entries: RuleExperience[]; loose: string[] } {
  const dateIndexes = new Set<number>()
  rawLines.forEach((line, i) => {
    if (DATE_RE.test(line)) dateIndexes.add(i)
  })
  const lines = dropTrailingFragments(rawLines, dateIndexes)

  const positions: number[] = []
  lines.forEach((line, i) => {
    if (DATE_RE.test(line)) positions.push(i)
  })

  const entries: RuleExperience[] = positions.map((pos) => {
    const match = lines[pos]!.match(DATE_RE)!
    return makeEntry(lines[pos]!, match)
  })

  // 每段日期行之后、到下一日期行的内容区间
  const groups: string[][] = positions.map((pos, i) => {
    const end = i === positions.length - 1 ? lines.length : positions[i + 1]!
    return lines.slice(pos + 1, end)
  })

  let emptyEntries: number[] = entries
    .map((_, i) => i)
    .filter((i) => groups[i]!.every((l) => !l.trim()))

  // 空条目构成前缀、内容全部集中在末尾：属于「日期行堆叠 + 集中描述」版面
  if (emptyEntries.length > 0 && emptyEntries.length < entries.length) {
    const isPrefix = emptyEntries.every((idx, i) => idx === i)
    if (isPrefix) emptyEntries = entries.map((_, i) => i)
  }

  if (emptyEntries.length === 0) {
    entries.forEach((entry, i) => {
      entry.bullets = segmentBullets(groups[i]!)
    })
    return { entries, loose: [] }
  }

  // 本身已有内容、且不属于堆叠前缀的条目，直接保留
  entries.forEach((entry, i) => {
    if (!emptyEntries.includes(i)) entry.bullets = segmentBullets(groups[i]!)
  })

  // 堆叠日期行：收集所有空条目区间的集中内容
  const bulk: string[] = []
  groups.forEach((group, i) => {
    if (emptyEntries.includes(i)) bulk.push(...group)
  })

  const resetIndexes: number[] = []
  bulk.forEach((line, i) => {
    if (PROJECT_RESET.test(line.trim())) resetIndexes.push(i)
  })

  if (resetIndexes.length > 0) {
    // 按「项目链接」把集中内容切给各空条目
    const segments: string[][] = []
    resetIndexes.forEach((pos, i) => {
      const end = i === resetIndexes.length - 1 ? bulk.length : resetIndexes[i + 1]!
      segments.push(bulk.slice(pos, end))
    })
    segments.forEach((segment, i) => {
      const entryIndex = emptyEntries[i]
      if (entryIndex !== undefined) entries[entryIndex]!.bullets = segmentBullets(segment)
    })
    return { entries, loose: [] }
  }

  if (emptyEntries.length >= 2) {
    // 无法逐段归属：集中要点保留为段落级 loose bullets
    return { entries, loose: segmentBullets(bulk) }
  }

  const only = emptyEntries[0]!
  entries[only]!.bullets = segmentBullets(bulk)
  return { entries, loose: [] }
}

function parseEducation(rawLines: string[]): RuleEducation[] {
  const positions: number[] = []
  rawLines.forEach((line, i) => {
    if (DATE_RE.test(line)) positions.push(i)
  })

  return positions.map((pos, i) => {
    const line = rawLines[pos]!
    const match = line.match(DATE_RE)!
    const end = i === positions.length - 1 ? rawLines.length : positions[i + 1]!
    const restLines = rawLines.slice(pos + 1, end)
    const headline = (line.slice(0, match.index) + line.slice((match.index ?? 0) + match[0].length))
      .replace(/^[\s|｜:：-]+|[\s|｜:：-]+$/g, '')
      .trim()

    const tokens = headline.split(/\s+/).filter(Boolean)
    const schoolToken = tokens.find((t) => /大学|学院/.test(t))
    const school = schoolToken ?? tokens[0] ?? headline
    const degree = headline.match(/(博士|硕士|研究生|本科)/)?.[0] ?? null
    const majorTokens = tokens
      .filter((t) => t !== schoolToken)
      .map((t) => t.replace(/[（(](?:博士|硕士|研究生|本科)[）)]/g, '').trim())
      .filter(Boolean)
    const major = majorTokens.join(' ').replace(/[（(].*?[）)]/g, '').trim() || null

    const sectionText = restLines.join('')
    const gpa = sectionText.match(/GPA\s*([\d.]+\s*\/\s*[\d.]+)/i)?.[1]?.replace(/\s/g, '') ?? null
    const rank = sectionText.match(/专业前\s*\d+%/)?.[0] ?? null

    // 荣誉/竞赛行：可能被 PDF 断成多行，先消中文间空格再按 | 切分
    const repaired = restLines
      .join('')
      .replace(/GPA\s*[\d./]+/i, '')
      .replace(/专业前\s*\d+%/, '')
      .replace(/[（(]\s*[）)]/g, '')
      .replace(/^竞赛奖项\s*[：:]\s*/, '')
      .replace(/([一-龥])\s+(?=[一-龥])/g, '$1')
    const highlights = repaired
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8)

    const gradYear = match[3] === '至今' ? null : Number(match[3].match(/20\d{2}/)?.[0] ?? null)

    return {
      school,
      major,
      degree,
      period: normalizePeriod(match),
      graduation_year: gradYear,
      gpa,
      rank,
      highlights,
    }
  })
}

function parseSkills(rawLines: string[]): Array<{ name: string; detail: string }> {
  const groups: Array<{ name: string; detail: string }> = []
  for (const line of rawLines) {
    const text = line.trim().replace(BULLET_PREFIX, '')
    const match = text.match(/^([^：:]{2,16})[：:](.+)$/)
    if (!match) continue
    const name = match[1]!.trim()
    if (SKILL_NAME.test(name)) groups.push({ name, detail: match[2]!.trim() })
  }
  return groups
}

function extractMetrics(bullets: string[]): string[] {
  const clauses: string[] = []
  for (const bullet of bullets) {
    for (const clause of bullet.split(/[；;。]/)) {
      const trimmed = clause.trim()
      if (trimmed.length < 6 || trimmed.length > 80) continue
      if (/\d/.test(trimmed) && METRIC_RE.test(trimmed)) {
        clauses.push(trimmed.replace(/[，、,\s]+$/, ''))
      }
    }
  }
  return Array.from(new Set(clauses)).slice(0, 16)
}

function parseHeader(headerLines: string[]): {
  name: string | null
  target: string | null
  phone: string | null
  email: string | null
  links: string[]
  politics: string | null
  headerSkills: string[]
} {
  const headerText = headerLines.join('\n')

  const nameLine = headerLines
    .map((l) => l.trim())
    .find((l) => {
      if (/[：:，。、/（）()《》【】]/.test(l)) return false
      const compact = l.replace(/\s/g, '')
      return /^[一-龥A-Za-z.·]{2,5}$/.test(compact)
    })
  const name = nameLine ? nameLine.replace(/\s/g, '') : null

  const target =
    headerText.match(/求职意向\s*[：:]\s*([^\n]+)/)?.[1]?.trim() || null
  const politics = headerText.match(/政治面貌\s*[：:]\s*([一-龥]{2,6})/)?.[1] ?? null
  const phone = headerText.match(PHONE_RE)?.[0].replace(/[-\s]/g, '') ?? null
  const email = headerText.match(EMAIL_RE)?.[0] ?? null
  const links = Array.from(new Set(headerText.match(LINK_RE) ?? []))
  const skillMatch = headerText.match(/熟练使用\s*([^。；\n]+)/)
  const headerSkills = skillMatch
    ? skillMatch[1].split(/[、,，/]|\s+/).map((s) => s.trim()).filter((s) => s && s.length <= 12)
    : []

  return { name, target, phone, email, links, politics, headerSkills }
}

export function extractRuleProfile(parsed: { pages: string[]; fullText: string }): RuleProfile {
  const lines = parsed.fullText.split('\n')

  const firstHeading = lines.findIndex((l) => matchSectionTitle(l) !== null)
  const firstDate = lines.findIndex((l) => DATE_RE.test(l))
  const headerEnd = Math.min(
    firstHeading === -1 ? Number.MAX_SAFE_INTEGER : firstHeading,
    firstDate === -1 ? Number.MAX_SAFE_INTEGER : firstDate,
  )

  const { header, sections } = splitSections(lines, headerEnd)
  const headerInfo = parseHeader(header)

  const educationSection = sections.find((s) => s.key === 'education')
  const internshipSection = sections.find((s) => s.key === 'internship')
  const workSection = sections.find((s) => s.key === 'work')
  const projectSection = sections.find((s) => s.key === 'project')
  const skillSection = sections.find((s) => s.key === 'skills')
  const awardSection = sections.find((s) => s.key === 'awards')
  const evaluationSection = sections.find((s) => s.key === 'evaluation')

  const education = educationSection ? parseEducation(educationSection.lines) : []
  const internshipResult = internshipSection
    ? parseExperience(internshipSection.lines)
    : { entries: [], loose: [] }
  const workResult = workSection ? parseExperience(workSection.lines) : { entries: [], loose: [] }
  const projectResult = projectSection ? parseExperience(projectSection.lines) : { entries: [], loose: [] }
  const skillGroups = skillSection ? parseSkills(skillSection.lines) : []
  const awards = awardSection ? segmentBullets(awardSection.lines) : []
  const evaluations = evaluationSection ? segmentBullets(evaluationSection.lines) : []

  const allBullets = [
    ...internshipResult.entries.flatMap((e) => e.bullets),
    ...internshipResult.loose,
    ...workResult.entries.flatMap((e) => e.bullets),
    ...projectResult.entries.flatMap((e) => e.bullets),
  ]

  const dictionaryHits = SKILL_DICTIONARY.filter((kw) => parsed.fullText.includes(kw)).sort(
    (a, b) => parsed.fullText.indexOf(a) - parsed.fullText.indexOf(b),
  )
  const skillKeywords = Array.from(new Set([...dictionaryHits, ...headerInfo.headerSkills]))

  return {
    name: headerInfo.name,
    target: headerInfo.target,
    phone: headerInfo.phone,
    email: headerInfo.email,
    links: headerInfo.links,
    politics: headerInfo.politics,
    education,
    skill_groups: skillGroups,
    skill_keywords: skillKeywords,
    internships: internshipResult.entries,
    work_experiences: workResult.entries,
    projects: projectResult.entries,
    internship_bullets: internshipResult.loose,
    awards,
    metrics: extractMetrics(allBullets),
    evaluations,
  }
}
