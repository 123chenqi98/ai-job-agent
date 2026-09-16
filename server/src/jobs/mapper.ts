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
}

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
