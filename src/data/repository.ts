/* ============================================================
 * 数据访问层（Repository）
 * 页面只允许通过本文件读取数据，不直接 import mock。
 * 当前从内存 mock 同步返回；未来接入真实后端时，
 * 只需把这些函数改为请求 API（可平滑改为 async），页面结构无需变动。
 * ============================================================ */

import { BOARD_COLUMNS } from '@/constants'
import { applications } from '@/mock/applications'
import { candidateProfile, experienceLibrary } from '@/mock/candidate'
import { jobs } from '@/mock/jobs'
import { matchResults } from '@/mock/matchResults'
import { resumeSuggestions } from '@/mock/resumeSuggestions'
import type {
  ApplicationRecord,
  ApplicationStatus,
  BoardColumnKey,
  Decision,
  ExperienceItem,
  Job,
  JobDetailBundle,
  JobPoolItem,
  MatchResult,
  ResumeSuggestion,
} from '@/types'

/* ---------- 内存索引（mock 专用，接后端后删除） ---------- */

const matchByJob = new Map<string, MatchResult>(
  matchResults.map((m) => [m.job_id, m]),
)
const applicationByJob = new Map<string, ApplicationRecord>(
  applications.map((a) => [a.job_id, a]),
)
const suggestionByJob = new Map<string, ResumeSuggestion>(
  resumeSuggestions.map((s) => [s.job_id, s]),
)
const experienceById = new Map<string, ExperienceItem>(
  experienceLibrary.map((e) => [e.experience_id, e]),
)

/* ---------- 派生规则：是否需要定制简历 / 下一步动作 ---------- */

/** 决策为「先改简历再投」即需要定制简历 */
export function needsCustomizedResume(decision: Decision): boolean {
  return decision === 'revise_then_apply'
}

/**
 * 下一步动作：优先依据当前投递状态，未投递时回退到匹配决策。
 * 输出为标准化短标签，供岗位池表格 / 看板卡片直接展示。
 */
export function deriveNextAction(
  decision: Decision,
  status: ApplicationStatus,
): string {
  switch (status) {
    case 'interview':
      return '准备面试'
    case 'written_test':
      return '参加笔试'
    case 'applied':
      return '跟进投递进度'
    case 'offer':
      return '确认 Offer'
    case 'rejected':
      return '复盘并归档'
    case 'ready':
    case 'todo':
    default:
      switch (decision) {
        case 'apply_now':
          return '立即投递'
        case 'revise_then_apply':
          return '先定制简历'
        case 'wait':
          return '暂缓观察'
        case 'drop':
          return '放弃'
        default:
          return '待评估'
      }
  }
}

/* ---------- 组装聚合视图 ---------- */

function toPoolItem(job: Job): JobPoolItem | null {
  const match = matchByJob.get(job.job_id)
  const application = applicationByJob.get(job.job_id)
  if (!match || !application) return null
  return {
    job,
    match,
    application,
    needs_customized_resume: needsCustomizedResume(match.decision),
    next_action: deriveNextAction(match.decision, application.apply_status),
  }
}

/* ---------- 对外查询接口 ---------- */

export function getCandidateProfile() {
  return candidateProfile
}

export function getExperiences(): ExperienceItem[] {
  return experienceLibrary
}

export function getJobs(): Job[] {
  return jobs
}

export function getJobById(jobId: string): Job | undefined {
  return jobs.find((j) => j.job_id === jobId)
}

export function getMatchByJobId(jobId: string): MatchResult | undefined {
  return matchByJob.get(jobId)
}

export function getApplicationByJobId(
  jobId: string,
): ApplicationRecord | undefined {
  return applicationByJob.get(jobId)
}

export function getResumeSuggestionByJobId(
  jobId: string,
): ResumeSuggestion | undefined {
  return suggestionByJob.get(jobId)
}

/** 岗位池列表：聚合岗位 / 匹配 / 投递，默认按匹配总分降序 */
export function getJobPoolItems(): JobPoolItem[] {
  return jobs
    .map(toPoolItem)
    .filter((item): item is JobPoolItem => item !== null)
    .sort(
      (a, b) => b.match.final_match_score - a.match.final_match_score,
    )
}

/** 岗位详情聚合：岗位 + 匹配 + 投递 + 简历建议 + 相关经历 */
export function getJobDetail(jobId: string): JobDetailBundle | null {
  const job = getJobById(jobId)
  const match = matchByJob.get(jobId)
  const application = applicationByJob.get(jobId)
  if (!job || !match || !application) return null

  const suggestion = suggestionByJob.get(jobId) ?? null
  const related_experiences = suggestion
    ? suggestion.strengthen_experiences
        .map((s) => experienceById.get(s.experience_id))
        .filter((e): e is ExperienceItem => Boolean(e))
    : []

  return { job, match, application, suggestion, related_experiences }
}

/** 看板分组：按看板列（待评估 / 待投递 / 已投递 / 笔试 / 面试 / 结束）归组 */
export function getBoardGroups(): Array<{
  column: BoardColumnKey
  label: string
  items: JobPoolItem[]
}> {
  const poolItems = getJobPoolItems()
  return BOARD_COLUMNS.map((column) => ({
    column: column.key,
    label: column.label,
    items: poolItems.filter((item) =>
      column.statuses.includes(item.application.apply_status),
    ),
  }))
}
