import type { BitableRecord } from '../feishu/bitable.js'
import { toDateText, toOptions, toText } from '../feishu/fields.js'

// 飞书投递看板表 → 工作台统一卡片模型（只读，不改动原始数据）

export type BoardColumn = 'todo' | 'ready' | 'applied' | 'written_test' | 'interview' | 'closed'

export interface FeishuApplicationItem {
  record_id: string
  company: string
  job_title: string
  raw_status: string
  column: BoardColumn
  result: 'offer' | 'rejected' | null
  applied_at: string | null
  interview_at: string | null
  offer_at: string | null
  channel: string | null
  city: string | null
  industry: string | null
  recruit_type: string | null
  jd: string | null
  interview_question: string | null
  review: string | null
  note: string | null
}

// 飞书表里该选项的实际文案即「已投递/待筛选」，同时兼容拆分为两态的表
const APPLIED_STATUSES = new Set(['已投递/待筛选', '已投递', '待筛选'])
const INTERVIEW_STATUSES = new Set(['初面', '二面', '三面', '终面完成', '等通知', '已面试待结果'])
const OFFER_STATUSES = new Set(['已拿 offer', '待入职', '已入职'])
const REJECTED_STATUSES = new Set(['简历初筛未通过', '面试未通过', '流程终止', '已拒 offer（主动放弃）'])

function firstOption(value: unknown): string | null {
  return toOptions(value)[0] ?? null
}

// 将飞书原始「状态」选项归并到看板 6 列
function mapStatus(raw: string): { column: BoardColumn; result: 'offer' | 'rejected' | null } {
  const status = raw.trim()
  if (APPLIED_STATUSES.has(status)) return { column: 'applied', result: null }
  if (INTERVIEW_STATUSES.has(status)) return { column: 'interview', result: null }
  if (OFFER_STATUSES.has(status)) return { column: 'closed', result: 'offer' }
  if (REJECTED_STATUSES.has(status)) return { column: 'closed', result: 'rejected' }
  // 状态留空或出现未识别选项（如表里的脏选项），统一落到待评估
  return { column: 'todo', result: null }
}

function truncate(text: string | null, max = 600): string | null {
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function mapBoardRecords(records: BitableRecord[]): FeishuApplicationItem[] {
  return records
    .map((record) => {
      const f = record.fields
      const rawStatus = toText(f['状态'])
      const { column, result } = mapStatus(rawStatus)

      return {
        record_id: record.record_id,
        company: toText(f['公司名称']),
        job_title: toText(f['投递岗位']),
        raw_status: rawStatus,
        column,
        result,
        applied_at: toDateText(f['投递时间']),
        interview_at: toDateText(f['面试日期']),
        offer_at: toDateText(f['offer发放时间']),
        channel: firstOption(f['投递渠道']),
        city: firstOption(f['工作地点']),
        industry: firstOption(f['公司行业']),
        recruit_type: firstOption(f['招聘类型']),
        jd: truncate(toText(f['岗位JD核心要求']) || null),
        interview_question: truncate(toText(f['核心面试问题']) || null),
        review: truncate(toText(f['面试复盘总结']) || null),
        note: truncate(toText(f['备注']) || null),
      }
    })
    .filter(
      // 过滤作品链接等非投递工具行：既无岗位名称也无投递状态的记录不进入看板
      (item) => item.company && (item.job_title || item.raw_status),
    )
}
