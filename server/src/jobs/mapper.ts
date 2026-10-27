import type { BitableRecord } from '../feishu/bitable.js'
import { toDateText, toOptions, toText, toUrl } from '../feishu/fields.js'

// 27届实习&校招总表 → 岗位池行模型（网申聚合信息，无状态、无评分）

export interface FeishuJobItem {
  record_id: string
  company: string
  job_title: string
  city: string | null
  industry: string | null
  recruit_type: string | null
  company_nature: string | null
  target: string | null
  degree: string | null
  updated_at: string | null
  deadline: string | null
  apply_url: string | null
  announcement_url: string | null
  note: string | null
}

export interface JobQuery {
  keyword?: string
  target?: string
  degree?: string
  city?: string
  nature?: string
  recruitType?: string
  bigTech?: boolean
  // 仅保留 N 天内截止（含今天）的岗位；undefined/0 表示不按截止时间过滤
  deadlineWithin?: number
  // 仅保留最近 N 天内有「网申更新」的岗位；undefined/0 表示不按更新时间过滤
  updatedWithin?: number
}

// 网申截止快捷窗口（天），同时作为接口白名单与 meta 下发口径
export const DEADLINE_WINDOW_OPTIONS = [3, 7, 15, 30] as const

// 网申新增快捷窗口（天）：基于「网申更新」DateTime 字段，筛选最近有更新（≈近期仍在活跃招聘）的岗位
export const UPDATED_WINDOW_OPTIONS = [3, 7, 14] as const

// 企业性质快捷分组：原表实际数据里「外企 / 外企/合资 / 合资」与「事业单位 / 社会机构 / 社会组织」
// 语义同源，按组合并为一个筛选项。飞书多选字段 contains 传多值是 any-of 语义，可直接一条条件直筛。
export const NATURE_GROUPS: Record<string, readonly string[]> = {
  central: ['央国企'],
  bank: ['银行'],
  private: ['民企'],
  foreign: ['外企', '外企/合资', '合资'],
  institution: ['事业单位', '社会机构', '社会组织'],
}

// 招聘类型白名单：直接对应原表「招聘类型」选项
export const RECRUIT_TYPE_OPTIONS = [
  '秋招',
  '秋招提前批',
  '日常实习',
  '暑期实习',
  '春招补招',
  '校园大使',
] as const

// 名企大厂口径：互联网 + 科技 / 智能终端 / 新能源头部公司，按公司名关键词匹配
// （飞书 filter 不支持 AND 套 OR，开启大厂时只能先按其他条件拉候选再在服务端内存过滤）。
// 关键词需先过排除表，避免子串误命中：京东→京东方、阿里→阿里斯顿、中兴→中兴财光华等。
export const BIG_TECH_KEYWORDS = [
  '腾讯', '阿里巴巴', '阿里', '字节跳动', '字节', '百度', '京东', '美团', '拼多多', '网易',
  '小米', '快手', '哔哩哔哩', 'B站', '滴滴', '携程', '小红书', '蚂蚁集团', '菜鸟',
  '华为', '荣耀', '大疆', '中兴', '联想', '三星', '索尼', '台积电',
  '理想汽车', '蔚来', '小鹏', '比亚迪', '宁德时代',
  '微软', '谷歌', 'Google', '亚马逊', 'Amazon', '苹果', 'Apple', '英特尔', '英伟达', 'NVIDIA',
  'IBM', '甲骨文', 'Oracle', 'SAP',
  '商汤', '旷视', '科大讯飞',
]

const BIG_TECH_EXCLUDE = ['京东方', '阿里斯顿', '中兴财']

export function isBigTechCompany(company: string | null | undefined): boolean {
  if (!company) return false
  if (BIG_TECH_EXCLUDE.some((keyword) => company.includes(keyword))) return false
  return BIG_TECH_KEYWORDS.some((keyword) => company.includes(keyword))
}

export function mapJobRecords(records: BitableRecord[]): FeishuJobItem[] {
  return records
    .map((record) => {
      const f = record.fields
      return {
        record_id: record.record_id,
        company: toText(f['公司名称']),
        job_title: toText(f['招聘岗位']),
        city: toOptions(f['工作地点']).join('、') || null,
        industry: toOptions(f['公司行业'])[0] ?? null,
        recruit_type: toOptions(f['招聘类型'])[0] ?? null,
        company_nature: toOptions(f['企业性质'])[0] ?? null,
        target: toOptions(f['招聘对象']).join('、') || null,
        degree: toOptions(f['学历'])[0] ?? null,
        updated_at: toDateText(f['网申更新']),
        deadline: toText(f['网申截止']) || null,
        apply_url: toUrl(f['投递链接']),
        announcement_url: toUrl(f['网申公告']),
        note: toText(f['备注']) || null,
      }
    })
    .filter((item) => item.company || item.job_title)
}

// 构造飞书 search 过滤条件。
// 飞书 filter 仅支持单层 and/or：有关键词且有结构化筛选时，关键词只匹配岗位名称；
// 仅有关键词时用 or 同时匹配公司名与岗位名。
// 工作地点是多选项（一条岗位常选「北京、上海、…」多个城市），必须用 contains
// 「包含该选项」，is 精确匹配会把多城市岗位全部漏掉。
export function buildJobFilter(query: JobQuery): unknown {
  const keyword = query.keyword?.trim()
  const facets = [
    { field: '招聘对象', values: [query.target?.trim()], operator: 'is' },
    { field: '学历', values: [query.degree?.trim()], operator: 'is' },
    { field: '工作地点', values: [query.city?.trim()], operator: 'contains' },
    { field: '企业性质', values: query.nature ? NATURE_GROUPS[query.nature] : undefined, operator: 'contains' },
    { field: '招聘类型', values: query.recruitType ? [query.recruitType] : undefined, operator: 'contains' },
  ]
    .map((c) => ({ ...c, values: (c.values ?? []).filter((v): v is string => Boolean(v)) }))
    .filter((c) => c.values.length > 0)

  if (keyword) {
    if (facets.length > 0) {
      return {
        conjunction: 'and',
        conditions: [
          { field_name: '招聘岗位', operator: 'contains', value: [keyword] },
          ...facets.map((c) => ({
            field_name: c.field,
            operator: c.operator,
            value: c.values,
          })),
        ],
      }
    }
    return {
      conjunction: 'or',
      conditions: [
        { field_name: '招聘岗位', operator: 'contains', value: [keyword] },
        { field_name: '公司名称', operator: 'contains', value: [keyword] },
      ],
    }
  }
  if (facets.length > 0) {
    return {
      conjunction: 'and',
      conditions: facets.map((c) => ({
        field_name: c.field,
        operator: c.operator,
        value: c.values,
      })),
    }
  }
  return undefined
}

// 默认按「网申更新」倒序
export const JOB_SORT = [{ field_name: '网申更新', desc: true }]

// ---- 网申截止窗口过滤 ----
// 飞书「网申截止」是手填文本字段：77% 为「招满即止」，约 21% 为 YYYY/M/D，
// 另有双斜杠、中文年月日、年月粘连、月日连写等手误。无法精确到日的（招满即止、
// 尽快投递、6月底、6月上旬、无年份的 6月18日 等）一律视为无确定日期，不纳入窗口。

const DAY_MS = 86_400_000
const ROLLING_DEADLINE_RE = /招满|滚动|长期|常年|尽快|额满|持续招聘/

// 以 UTC 日序号表达日期，规避服务器时区差异（北京日历日 = UTC+8）
function toDayNumber(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  // 拒绝 2026/2/31 这类溢出日期
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return Math.floor(date.getTime() / DAY_MS)
}

// 把「网申截止」原文解析为 UTC 日序号；解析不出确定日期返回 null
export function parseDeadlineDay(raw: string | null | undefined): number | null {
  if (!raw) return null
  const text = String(raw).trim()
  if (!text || ROLLING_DEADLINE_RE.test(text)) return null

  // 收集全部可能的 (年,月,日) 候选，逐个做真实日期校验，首个合法者生效
  const candidates: Array<[number, number, number]> = []

  // a) 年月日齐全：2026/10/28、2026-10-28、2026年10月28日、2026/10//31（双斜杠手误）
  const full = text.match(/(\d{4})\s*[年/\-.,]+\s*(\d{1,2})\s*[月/\-.,]*\s*(\d{1,2})/)
  if (full) candidates.push([Number(full[1]), Number(full[2]), Number(full[3])])

  // b) 年份与月份粘连：202612/25、202610/9
  const gluedYear = text.match(/(\d{4})(\d{2})\s*[/\-.,]\s*(\d{1,2})/)
  if (gluedYear) candidates.push([Number(gluedYear[1]), Number(gluedYear[2]), Number(gluedYear[3])])

  // c) 月份与日期连写：2026/1119 → 11 月 19 日（前两位不是合法月份时按 1 位月份拆）
  const gluedMd = text.match(/(\d{4})\s*[/\-.,]\s*(\d{4})\s*日?\s*$/)
  if (gluedMd) {
    const year = Number(gluedMd[1])
    const md = gluedMd[2]
    const twoDigitMonth = Number(md.slice(0, 2))
    if (twoDigitMonth >= 1 && twoDigitMonth <= 12) {
      candidates.push([year, twoDigitMonth, Number(md.slice(2))])
    } else {
      candidates.push([year, Number(md.slice(0, 1)), Number(md.slice(1))])
    }
  }

  for (const [year, month, day] of candidates) {
    // 过滤明显的历史/未来脏数据（表为 26-27 届秋招，合理年份 2025-2028）
    if (year < 2025 || year > 2028) continue
    const dayNumber = toDayNumber(year, month, day)
    if (dayNumber !== null) return dayNumber
  }
  return null
}

// 北京日历日（UTC+8）对应的 UTC 日序号——窗口锚点，全链路统一使用
export function beijingTodayDay(now: number = Date.now()): number {
  return Math.floor((now + 8 * 3_600_000) / DAY_MS)
}

// 是否落在「今天起 N 天内（含今天、含第 N 天）」；已截止或无确定日期均不命中
export function isWithinDeadline(
  deadlineDay: number | null,
  withinDays: number,
  todayDay: number = beijingTodayDay(),
): boolean {
  if (deadlineDay === null) return false
  const diff = deadlineDay - todayDay
  return diff >= 0 && diff <= withinDays
}

// 截止窗口内的结果按截止日升序（最紧急在前）；同截止日保持原顺序稳定
export function sortJobsByDeadlineAsc(items: FeishuJobItem[]): FeishuJobItem[] {
  return [...items]
    .map((item, index) => ({ item, index, day: parseDeadlineDay(item.deadline) }))
    .sort((a, b) => {
      if (a.day === null && b.day === null) return a.index - b.index
      if (a.day === null) return 1
      if (b.day === null) return -1
      if (a.day !== b.day) return a.day - b.day
      return a.index - b.index
    })
    .map((entry) => entry.item)
}

// 截止模式的飞书候选预过滤。「网申截止」是文本字段：contains 仅接受单值，
// 且 filter 不支持 AND 套 OR，无法把「facets AND (月份词1 OR 月份词2)」一次下推。
// 故截止模式单独发 OR(月份词) 请求，把候选从全表 1.1w+ 收敛到窗口覆盖月份的约 1k 条
// （3 页内）；facet/关键词与精确窗口改在内存按同一口径判定，预过滤只负责缩小候选。
//
// 词模式按全表普查（11128 条/2464 条含可解析日期）做过完备性校验：只要原文能被
// parseDeadlineDay 解析出窗口内日期，就必须至少命中一个词，否则该岗位会在候选层漏掉。
// 短横线/逗号日期在全表为 0 条，故不下推对应词（解析器仍兼容，未来出现时仅候选层漏召回）。
export function buildDeadlinePrefilter(
  withinDays: number,
  now: number = Date.now(),
): {
  conjunction: 'or'
  conditions: Array<{ field_name: string; operator: 'contains'; value: string[] }>
} {
  const todayDay = beijingTodayDay(now)
  const words = new Set<string>()
  for (let offset = 0; offset <= withinDays; offset++) {
    const date = new Date((todayDay + offset) * DAY_MS)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + 1
    words.add(`${year}/${month}`) // 2026/10/28、2026/10//31（双斜杠手误）、2026/1119（月日连写）
    words.add(`${year}.${month}`) // 2026.10.31（点分日期，实测窗口内存在，斜杠词无法覆盖）
    words.add(`${year}年${month}`) // 2026年11月30日；不带「月」字，兼容「2026年11.30」类手误
    words.add(`/${month}/`) // 2026年/10/31（年与月之间多斜杠，年月前缀词均不命中）
    if (month >= 10) words.add(`${year}${month}`) // 202610/9（年月粘连，仅两位月份可能出现）
  }
  return {
    conjunction: 'or',
    conditions: [...words].map((word) => ({
      field_name: '网申截止',
      operator: 'contains',
      value: [word],
    })),
  }
}

// 与 buildJobFilter 完全等价的内存谓词：截止预过滤请求已被月份 OR 组占用，
// 其余 facet / 关键词不能再下推飞书，统一在候选集上按同一口径过滤，避免两端口径漂移。
export function jobRecordMatchesQuery(record: BitableRecord, query: JobQuery): boolean {
  const f = record.fields
  const keyword = query.keyword?.trim() ?? ''
  const target = query.target?.trim() ?? ''
  const degree = query.degree?.trim() ?? ''
  const city = query.city?.trim() ?? ''
  const recruitType = query.recruitType?.trim() ?? ''

  // 单选用 is（选项精确相等），多选用 contains（包含该选项）；内存侧统一为「选项数组包含」
  if (target && !toOptions(f['招聘对象']).includes(target)) return false
  if (degree && !toOptions(f['学历']).includes(degree)) return false
  if (city && !toOptions(f['工作地点']).includes(city)) return false
  if (query.nature) {
    const group = NATURE_GROUPS[query.nature]
    if (group && !toOptions(f['企业性质']).some((option) => group.includes(option))) return false
  }
  if (recruitType && !toOptions(f['招聘类型']).includes(recruitType)) return false

  if (keyword) {
    // 与 buildJobFilter 一致：存在任一结构化 facet 时关键词只匹配岗位名，否则公司/岗位二选一
    const hasFacets = Boolean(target || degree || city || query.nature || recruitType)
    const inJobTitle = toText(f['招聘岗位']).includes(keyword)
    if (hasFacets) return inJobTitle
    return inJobTitle || toText(f['公司名称']).includes(keyword)
  }
  return true
}

// ---- 网申更新（新增）窗口 ----
// 「网申更新」是飞书 DateTime 字段（毫秒时间戳），mapJobRecords 已通过 toDateText 转成
// 北京日历日字符串 YYYY-MM-DD。窗口按北京日历日计算：今天算作第 0 天，含今天、含第 N 天。

// 把 toDateText 产出的北京日历日字符串还原为 UTC 日序号，与 beijingTodayDay 同口径
function dayFromBeijingDateText(text: string | null | undefined): number | null {
  if (!text) return null
  const matched = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matched) return null
  return toDayNumber(Number(matched[1]), Number(matched[2]), Number(matched[3]))
}

// 是否落在「最近 N 天内有更新（含今天）」；无更新时间或未来时间均不命中
export function isWithinUpdated(
  updatedText: string | null | undefined,
  withinDays: number,
  todayDay: number = beijingTodayDay(),
): boolean {
  const updatedDay = dayFromBeijingDateText(updatedText)
  if (updatedDay === null) return false
  const diff = todayDay - updatedDay
  return diff >= 0 && diff <= withinDays
}

// 仅有「网申新增」筛选、无截止筛选时，结果按更新时间倒序（最新在前）
export function sortJobsByUpdatedDesc(items: FeishuJobItem[]): FeishuJobItem[] {
  return [...items]
    .map((item, index) => ({ item, index, day: dayFromBeijingDateText(item.updated_at) }))
    .sort((a, b) => {
      if (a.day === null && b.day === null) return a.index - b.index
      if (a.day === null) return 1
      if (b.day === null) return -1
      return b.day - a.day
    })
    .map((entry) => entry.item)
}

// 「网申新增」模式的飞书候选预过滤。
// DateTime 字段原生支持 isGreater（注意 isGreaterEqual 不支持日期字段），可把候选从全表
// 1.1w+ 直接收敛到窗口内（约百条级），再在内存做精确判定与排序。
// 日期字段 value 必须为 ["ExactDate", "<毫秒时间戳>"]，时间戳会被转为文档时区当天零点；
// 实测 isGreater 于「第 N 天 00:00」不包含当天，故阈值再向前放宽 1 天多拉一批候选，
// 精确窗口由内存 isWithinUpdated 兜底，避免边界漏召回。
export function buildUpdatedPrefilter(
  withinDays: number,
  now: number = Date.now(),
): {
  conjunction: 'and'
  conditions: Array<{ field_name: string; operator: 'isGreater'; value: string[] }>
} {
  const todayDay = beijingTodayDay(now)
  const thresholdDay = todayDay - withinDays - 1
  const thresholdMs = thresholdDay * DAY_MS - 8 * 3_600_000
  return {
    conjunction: 'and',
    conditions: [
      {
        field_name: '网申更新',
        operator: 'isGreater',
        value: ['ExactDate', String(thresholdMs)],
      },
    ],
  }
}
