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
export function buildJobFilter(query: JobQuery): unknown {
  const keyword = query.keyword?.trim()
  const facets = [
    { field: '招聘对象', value: query.target?.trim() },
    { field: '学历', value: query.degree?.trim() },
    { field: '工作地点', value: query.city?.trim() },
  ].filter((c) => c.value)

  if (keyword) {
    if (facets.length > 0) {
      return {
        conjunction: 'and',
        conditions: [
          { field_name: '招聘岗位', operator: 'contains', value: [keyword] },
          ...facets.map((c) => ({
            field_name: c.field,
            operator: 'is',
            value: [c.value as string],
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
        operator: 'is',
        value: [c.value as string],
      })),
    }
  }
  return undefined
}

// 默认按「网申更新」倒序
export const JOB_SORT = [{ field_name: '网申更新', desc: true }]
