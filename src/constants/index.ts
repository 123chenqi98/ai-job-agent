/* ============================================================
 * 展示口径常量：枚举值 -> 中文标签 / 配色语义 / 看板列
 * 所有页面统一从这里取文案，避免散落在各组件中
 * ============================================================ */

import type {
  ApplicationStatus,
  BoardColumnKey,
  Decision,
  ExperienceType,
  FollowUpType,
  JobCategory,
  JobSourceType,
  MatchLevel,
  ProofLevel,
  RiskLevel,
  RiskType,
  ScoreDimension,
} from '@/types'

interface LabelMeta {
  label: string
}

/** 岗位方向 */
export const JOB_CATEGORY_META: Record<JobCategory, LabelMeta> = {
  data_analysis: { label: '数据分析' },
  bi: { label: 'BI / 商业智能' },
  business_analysis: { label: '商业分析' },
  data_science: { label: '数据科学' },
  data_engineering: { label: '数据开发' },
  other: { label: '其他' },
}

/** 岗位来源 */
export const JOB_SOURCE_META: Record<JobSourceType, LabelMeta> = {
  official: { label: '官网网申' },
  nowcoder: { label: '牛客' },
  referral: { label: '内推' },
  other: { label: '其他' },
}

/** 投递状态 */
export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  LabelMeta & { column: BoardColumnKey }
> = {
  todo: { label: '待评估', column: 'todo' },
  ready: { label: '待投递', column: 'ready' },
  applied: { label: '已投递', column: 'applied' },
  written_test: { label: '笔试', column: 'written_test' },
  interview: { label: '面试', column: 'interview' },
  offer: { label: 'Offer', column: 'closed' },
  rejected: { label: '已回绝', column: 'closed' },
}

/** 看板列定义（顺序即展示顺序） */
export const BOARD_COLUMNS: Array<{
  key: BoardColumnKey
  label: string
  statuses: ApplicationStatus[]
}> = [
  { key: 'todo', label: '待评估', statuses: ['todo'] },
  { key: 'ready', label: '待投递', statuses: ['ready'] },
  { key: 'applied', label: '已投递', statuses: ['applied'] },
  { key: 'written_test', label: '笔试', statuses: ['written_test'] },
  { key: 'interview', label: '面试', statuses: ['interview'] },
  { key: 'closed', label: '结束', statuses: ['offer', 'rejected'] },
]

/** 推荐 / 匹配等级（tone 对应通用标签配色） */
export const MATCH_LEVEL_META: Record<
  MatchLevel,
  LabelMeta & { tone: 'success' | 'warning' | 'danger' }
> = {
  high: { label: '高推荐', tone: 'success' },
  medium: { label: '中推荐', tone: 'warning' },
  low: { label: '低推荐', tone: 'danger' },
}

/** 决策建议 */
export const DECISION_META: Record<
  Decision,
  LabelMeta & { tone: 'primary' | 'success' | 'warning' | 'danger' }
> = {
  apply_now: { label: '建议直接投递', tone: 'success' },
  revise_then_apply: { label: '先改简历再投', tone: 'primary' },
  wait: { label: '暂缓观察', tone: 'warning' },
  drop: { label: '不建议投入', tone: 'danger' },
}

/** 风险类型 */
export const RISK_TYPE_META: Record<RiskType, LabelMeta> = {
  grade: { label: '年级风险' },
  schedule: { label: '时间风险' },
  skill_gap: { label: '技术缺口' },
  location: { label: '出勤风险' },
  degree: { label: '学历风险' },
  language: { label: '语言风险' },
  other: { label: '其他风险' },
}

/** 风险等级配色 */
export const RISK_LEVEL_META: Record<
  RiskLevel,
  LabelMeta & { tone: 'danger' | 'warning' | 'neutral' }
> = {
  high: { label: '高', tone: 'danger' },
  medium: { label: '中', tone: 'warning' },
  low: { label: '低', tone: 'neutral' },
}

/** 经历类型 */
export const EXPERIENCE_TYPE_META: Record<ExperienceType, LabelMeta> = {
  internship: { label: '实习经历' },
  project: { label: '项目经历' },
  competition: { label: '竞赛经历' },
  research: { label: '科研经历' },
  campus: { label: '校园经历' },
  other: { label: '其他经历' },
}

/** 佐证强度 */
export const PROOF_LEVEL_META: Record<ProofLevel, LabelMeta> = {
  strong: { label: '强佐证' },
  medium: { label: '中佐证' },
  weak: { label: '弱佐证' },
}

/** 跟进记录类型（用于看板卡片的跟进时间线 / 最近节点） */
export const FOLLOW_UP_TYPE_META: Record<
  FollowUpType,
  LabelMeta & { tone: 'primary' | 'success' | 'warning' | 'neutral' }
> = {
  apply: { label: '投递', tone: 'primary' },
  written_test: { label: '笔试', tone: 'warning' },
  interview: { label: '面试', tone: 'success' },
  feedback: { label: '反馈', tone: 'neutral' },
  note: { label: '备注', tone: 'neutral' },
}

/** 评分维度口径（权重与产品方案公式一致；成本为扣分项） */
export const SCORE_DIMENSION_META: Record<
  ScoreDimension,
  LabelMeta & { weight: number; isPenalty?: boolean }
> = {
  hard_gate_score: { label: '硬门槛分', weight: 0.35 },
  skill_match_score: { label: '技能匹配分', weight: 0.25 },
  experience_relevance_score: { label: '经历相关分', weight: 0.2 },
  growth_value_score: { label: '成长收益分', weight: 0.15 },
  application_cost_score: {
    label: '投递成本分',
    weight: 0.05,
    isPenalty: true,
  },
}

/** 总分区间文案口径，对齐产品方案「决策映射规则」 */
export const SCORE_BAND: Array<{
  min: number
  label: string
  hint: string
}> = [
  { min: 85, label: '优先投递', hint: '建议立即投递' },
  { min: 70, label: '小改后投', hint: '建议先小改简历后投递' },
  { min: 55, label: '观察补齐', hint: '建议观察，除非补齐关键信息' },
  { min: 0, label: '暂不优先', hint: '不建议优先投入时间' },
]
