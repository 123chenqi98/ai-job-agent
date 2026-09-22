/* ============================================================
 * 领域类型定义
 * 字段口径对齐产品方案 product_plan.md「核心字段设计」
 * 命名保持与数据表一致的 snake_case，便于未来直接映射后端
 * ============================================================ */

/* ---------- 枚举与字面量联合 ---------- */

/** 岗位来源渠道 */
export type JobSourceType = 'official' | 'nowcoder' | 'referral' | 'other'

/** 岗位方向 */
export type JobCategory =
  | 'data_analysis' // 数据分析
  | 'bi' // 商业智能 / BI
  | 'business_analysis' // 商业分析
  | 'data_science' // 数据科学 / 算法分析
  | 'data_engineering' // 数据开发
  | 'other'

/** 岗位在岗位池中的评估状态 */
export type JobEvaluationStatus = 'pending' | 'evaluated' | 'archived'

/**
 * 投递状态（字段口径）
 * todo 待评估 / ready 待投递 / applied 已投递 /
 * written_test 笔试 / interview 面试 / offer 录用 / rejected 回绝
 */
export type ApplicationStatus =
  | 'todo'
  | 'ready'
  | 'applied'
  | 'written_test'
  | 'interview'
  | 'offer'
  | 'rejected'

/** 看板列：offer 与 rejected 同属「结束」列 */
export type BoardColumnKey =
  | 'todo'
  | 'ready'
  | 'applied'
  | 'written_test'
  | 'interview'
  | 'closed'

/** 匹配 / 推荐等级 */
export type MatchLevel = 'high' | 'medium' | 'low'

/** 决策建议 */
export type Decision =
  | 'apply_now' // 直接投递
  | 'revise_then_apply' // 先改简历再投
  | 'wait' // 暂缓观察
  | 'drop' // 放弃

/** 风险类型 */
export type RiskType =
  | 'grade' // 年级 / 毕业年份
  | 'schedule' // 出勤时间 / 实习时长
  | 'skill_gap' // 技术缺口
  | 'location' // 城市 / 出勤方式
  | 'degree' // 学历
  | 'language' // 语言
  | 'other'

export type RiskLevel = 'high' | 'medium' | 'low'

/** 经历类型 */
export type ExperienceType =
  | 'internship'
  | 'project'
  | 'competition'
  | 'research'
  | 'campus'
  | 'other'

/** 成果可佐证强度 */
export type ProofLevel = 'strong' | 'medium' | 'weak'

/** 跟进记录类型 */
export type FollowUpType =
  | 'apply'
  | 'written_test'
  | 'interview'
  | 'feedback'
  | 'note'

/* ---------- 评分相关 ---------- */

/** 五个评分维度的字段名（与 MatchResult 扁平字段对应） */
export type ScoreDimension =
  | 'hard_gate_score'
  | 'skill_match_score'
  | 'experience_relevance_score'
  | 'growth_value_score'
  | 'application_cost_score'

/** 单个维度的评分与岗位个性化解释，用于「可解释 AI」拆解 */
export interface ScoreComponent {
  key: ScoreDimension
  label: string
  score: number // 0 - 100
  weight: number // 权重；投递成本为扣分项，取负值
  explanation: string // 该岗位在此维度的打分依据
}

/** 结构化风险项 */
export interface RiskFlag {
  type: RiskType
  level: RiskLevel
  label: string
  description?: string
}

/* ---------- 1. 岗位主表 Job ---------- */

export interface Job {
  job_id: string
  source_type: JobSourceType
  source_url: string
  company_name: string
  department_name: string
  job_title: string
  job_category: JobCategory
  city: string
  intern_days_per_week: number | null
  intern_months: number | null
  degree_requirement: string
  graduation_requirement: string
  jd_raw_text: string
  jd_summary: string
  responsibility_summary: string[]
  requirement_summary: string[]
  must_have_skills: string[]
  nice_to_have_skills: string[]
  business_keywords: string[]
  tool_keywords: string[]
  risk_flags: RiskFlag[]
  status: JobEvaluationStatus
  created_at: string
  updated_at: string
}

/* ---------- 2. 候选人画像 CandidateProfile ---------- */

export interface CandidateProfile {
  candidate_id: string
  target_direction: string
  preferred_cities: string[]
  available_days_per_week: number
  available_months: number
  degree_level: string
  graduation_year: number
  core_skills: string[]
  tool_skills: string[]
  industry_interest: string[]
  must_avoid_conditions: string[]
  resume_master_id: string
}

/* ---------- 3. 经历素材库 ExperienceItem ---------- */

export interface ExperienceItem {
  experience_id: string
  experience_type: ExperienceType
  title: string
  organization: string
  time_range: string
  summary: string
  tags: string[]
  metrics: string[]
  related_skills: string[]
  related_domains: string[]
  proof_level: ProofLevel
  resume_ready_bullets: string[]
}

/* ---------- 4. 匹配结果 MatchResult ---------- */

export interface MatchResult {
  match_id: string
  job_id: string
  candidate_id: string
  hard_gate_score: number
  skill_match_score: number
  experience_relevance_score: number
  growth_value_score: number
  application_cost_score: number
  final_match_score: number
  match_level: MatchLevel
  decision: Decision
  /** 一句话结论 */
  one_line_conclusion: string
  /** 优势点 */
  strengths: string[]
  decision_reason: string
  improvement_suggestions: string[]
  /** 5 维评分拆解（含解释） */
  score_components: ScoreComponent[]
  generated_at: string
}

/* ---------- 5. 简历建议 ResumeSuggestion ---------- */

/** 单条 bullet 改写建议 */
export interface BulletRewrite {
  bullet_id: string
  original: string
  suggested: string
  reason: string
  related_experience_id?: string
}

/** 建议强化的经历项 */
export interface StrengthenExperience {
  experience_id: string
  reason: string
}

/** 简历版本方案 */
export interface ResumeVersion {
  version_key: 'A' | 'B'
  version_name: string
  positioning: string
  summary: string
}

export type ResumeSuggestionStatus =
  | 'draft'
  | 'generated'
  | 'finalized'

export interface ResumeSuggestion {
  suggestion_id: string
  job_id: string
  resume_master_id: string
  /** 当前简历覆盖度 0 - 100 */
  coverage_score: number
  /** 当前岗位需求摘要 */
  requirement_summary: string[]
  /** 应保留内容 */
  keep_points: string[]
  /** 建议强化的经历 */
  strengthen_experiences: StrengthenExperience[]
  /** 建议改写的 bullet */
  rewrite_bullets: BulletRewrite[]
  /** 必补 / 推荐关键词 */
  priority_keywords: string[]
  /** 当前缺失点 */
  missing_points: string[]
  /** 推荐版本方案 */
  versions: ResumeVersion[]
  status: ResumeSuggestionStatus
  generated_at: string
}

/* ---------- 6. 投递跟进 ApplicationRecord ---------- */

export interface FollowUpRecord {
  record_id: string
  time: string
  type: FollowUpType
  content: string
}

export interface ApplicationRecord {
  tracking_id: string
  job_id: string
  apply_channel: string
  apply_status: ApplicationStatus
  resume_version_used: string | null
  apply_time: string | null
  written_test_time: string | null
  interview_round: number
  latest_feedback: string
  result: string | null
  follow_up_action: string
  follow_ups: FollowUpRecord[]
}

/* ---------- 前端聚合视图类型 ---------- */

/** 岗位池列表行：岗位 + 匹配 + 投递信息的聚合（数据访问层组装） */
export interface JobPoolItem {
  job: Job
  match: MatchResult
  application: ApplicationRecord
  /** 是否需要定制简历 */
  needs_customized_resume: boolean
  /** 下一步动作（由决策与投递状态派生） */
  next_action: string
}

/** 岗位详情聚合 */
export interface JobDetailBundle {
  job: Job
  match: MatchResult
  application: ApplicationRecord
  suggestion: ResumeSuggestion | null
  related_experiences: ExperienceItem[]
}

/* ---------- 用户私有投递记录（server/src/applications） ---------- */

/** 用户投递记录状态（不同于飞书看板的 ApplicationStatus，无 todo/ready） */
export type UserApplicationStatus =
  | 'applied'
  | 'written_test'
  | 'interview'
  | 'offer'
  | 'rejected'

/** 用户私有投递记录：按 user_id 隔离，每位用户只看到自己的 */
export interface UserApplication {
  id: string
  user_id: string
  company: string
  job_title: string
  job_url: string
  status: UserApplicationStatus
  note: string
  applied_at: string
  updated_at: string
}

export interface UserApplicationStats {
  total: number
  applied: number
  written_test: number
  interview: number
  offer: number
  rejected: number
  recent: UserApplication[]
}
