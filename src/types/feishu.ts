// 飞书只读接口返回的领域模型，字段与 server/src/boards/mapper.ts 保持一致

export type FeishuBoardColumn =
  | 'todo'
  | 'ready'
  | 'applied'
  | 'written_test'
  | 'interview'
  | 'closed'

export interface FeishuApplicationItem {
  record_id: string
  company: string
  job_title: string
  raw_status: string
  column: FeishuBoardColumn
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

export interface FeishuBoardResponse {
  source: string
  table: string | null
  generated_at: string
  total: number
  items: FeishuApplicationItem[]
}

// 岗位池（27届网申总表）
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

export interface FeishuJobQuery {
  keyword?: string
  target?: string
  degree?: string
  city?: string
  pageToken?: string
}

export interface FeishuJobsResponse {
  source: string
  total: number
  has_more: boolean
  page_token?: string
  items: FeishuJobItem[]
}

export interface FeishuJobsMeta {
  source: string
  filters: { target: string[]; degree: string[] }
  totals: { all: number; target27: number; bachelor: number }
}
