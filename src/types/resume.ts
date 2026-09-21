// 简历模块接口模型，字段与 server/src/resume 保持一致（snake_case）

export interface ResumeSource {
  file_name: string
  pages: number
  size_bytes: number
  updated_at: string
  parsed_at: string
  engine: string
}

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

export interface ResumeResponse {
  source: ResumeSource
  profile: RuleProfile
  full_text: string
}

export interface AppConfig {
  ark_configured: boolean
}

// ---- P4 豆包模型 ----

export interface AiExperience {
  period: string
  org: string
  title: string
  bullets: string[]
}

export interface AiProfile {
  summary: string
  target_roles: string[]
  core_competencies: string[]
  hard_skills: string[]
  tools: string[]
  strengths: string[]
  weaknesses: string[]
  experience_map: AiExperience[]
}

export interface AiProfileResponse {
  engine: string
  generated_at: string
  ai_remaining?: number
  profile: AiProfile
}

export interface JdDimension {
  key: 'hard_gate' | 'skill' | 'experience' | 'direction'
  label: string
  score: number
  reason: string
}

export interface DealBreaker {
  item: string
  status: 'pass' | 'fail' | 'unknown'
  note: string
}

export interface JdMatch {
  score: number
  level: 'high' | 'medium' | 'low'
  decision: string
  deal_breakers: DealBreaker[]
  dimension_scores: JdDimension[]
  matched: Array<{ point: string; evidence: string }>
  gaps: Array<{ gap: string; suggestion: string }>
  conclusion: string
}

export interface JdMatchResponse {
  engine: string
  generated_at: string
  ai_remaining?: number
  match: JdMatch
}

export interface BulletRewriteItem {
  original: string
  version_a: string
  version_b: string
  reason: string
}

export interface BulletRewrites {
  coverage_score: number
  keywords_to_cover: string[]
  rewrites: BulletRewriteItem[]
  new_bullets: string[]
  tips: string[]
}

export interface BulletRewritesResponse {
  engine: string
  generated_at: string
  ai_remaining?: number
  rewrites: BulletRewrites
}

export interface InterviewQuestion {
  category: 'technical' | 'project' | 'behavioral'
  question: string
  difficulty: 'high' | 'mid' | 'low'
  answer_points: string[]
  resume_anchor: string
}

export interface InterviewPrep {
  overview: string
  questions: InterviewQuestion[]
  topics_to_review: string[]
  questions_to_ask: string[]
}

export interface InterviewPrepResponse {
  engine: string
  generated_at: string
  ai_remaining?: number
  prep: InterviewPrep
}

export interface JdJobMeta {
  company?: string
  title?: string
}

// ---- 多用户账号 ----

export interface AccountResumeMeta {
  filename: string
  original_name: string
  size: number
  uploaded_at: string
}

export type AccountStatus =
  | { logged: false; ark_configured?: boolean }
  | {
      logged: true
      username: string
      has_resume: boolean
      resume: AccountResumeMeta | null
      ai_remaining: number
    }

export interface RegisterResponse {
  ok: true
  username: string
  recovery_code: string
  msg: string
}

export interface LoginResponse {
  ok: true
  username: string
  has_resume: boolean
}

export interface ResumeUploadResponse {
  ok: true
  has_resume: boolean
  size: number
}

// AI 响应统一附带剩余次数（服务端新增字段，旧字段保持不变）
export interface AiUsageMeta {
  ai_remaining?: number
}
