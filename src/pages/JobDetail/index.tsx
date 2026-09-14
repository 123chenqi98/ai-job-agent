import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  APPLICATION_STATUS_META,
  DECISION_META,
  JOB_CATEGORY_META,
  JOB_SOURCE_META,
  MATCH_LEVEL_META,
} from '@/constants'
import { getJobDetail } from '@/data/repository'
import ActionRecommendationCard from '@/components/ActionRecommendationCard'
import RiskTagList from '@/components/RiskTagList'
import ScoreBreakdown from '@/components/ScoreBreakdown'
import SectionCard from '@/components/common/SectionCard'
import StateView from '@/components/common/StateView'
import Tag, { type TagTone } from '@/components/common/Tag'
import styles from './JobDetail.module.css'

const STATUS_TONE: Record<string, TagTone> = {
  todo: 'neutral',
  ready: 'warning',
  applied: 'neutral',
  written_test: 'primary',
  interview: 'primary',
  offer: 'success',
  rejected: 'danger',
}

const SCORE_NUM_CLASS: Record<'high' | 'medium' | 'low', string> = {
  high: styles.scoreHigh,
  medium: styles.scoreMid,
  low: styles.scoreLow,
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value ?? '—'}</span>
    </div>
  )
}

function SkillGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.skillGroup}>
      <span className={styles.skillGroupLabel}>{label}</span>
      <div className={styles.skillTags}>{children}</div>
    </div>
  )
}

export default function JobDetail() {
  const { jobId = '' } = useParams<{ jobId: string }>()
  const bundle = getJobDetail(jobId)

  // 回退态：找不到岗位时给出明确可恢复的提示，而非空白页
  if (!bundle) {
    return (
      <StateView
        title="未找到该岗位"
        description={
          <>
            岗位 ID「{jobId}」不存在或已被归档，请返回岗位池重新选择。
          </>
        }
        actions={<Link to="/jobs">← 返回岗位池</Link>}
      />
    )
  }

  const { job, match, application, suggestion } = bundle
  const levelMeta = MATCH_LEVEL_META[match.match_level]
  const decisionMeta = DECISION_META[match.decision]

  return (
    <div className={styles.page}>
      <Link to="/jobs" className={styles.backLink}>
        ← 返回岗位池
      </Link>

      <header className={styles.header}>
        <div>
          <div className={styles.company}>{job.company_name}</div>
          <h1 className={styles.title}>{job.job_title}</h1>
          <div className={styles.tagLine}>
            <Tag tone="neutral">{JOB_CATEGORY_META[job.job_category].label}</Tag>
            <Tag tone="neutral">{job.city}</Tag>
            <Tag tone="neutral">{JOB_SOURCE_META[job.source_type].label}</Tag>
            <Tag tone={STATUS_TONE[application.apply_status]}>
              {APPLICATION_STATUS_META[application.apply_status].label}
            </Tag>
          </div>
        </div>
        <div className={styles.headerScore}>
          <span className={`${styles.headerScoreNum} ${SCORE_NUM_CLASS[match.match_level]}`}>
            {match.final_match_score}
          </span>
          <span className={styles.headerScoreTotal}>/ 100</span>
          <Tag tone={levelMeta.tone}>{levelMeta.label}</Tag>
        </div>
      </header>

      {/* AI 一句话结论 */}
      <div className={styles.conclusion}>
        <span className={styles.conclusionBadge}>AI 结论</span>
        <p className={styles.conclusionText}>{match.one_line_conclusion}</p>
      </div>

      {/* 基础信息 */}
      <SectionCard title="基础信息">
        <div className={styles.infoGrid}>
          <InfoItem label="公司 / 部门" value={`${job.company_name} · ${job.department_name}`} />
          <InfoItem label="岗位方向" value={JOB_CATEGORY_META[job.job_category].label} />
          <InfoItem label="工作城市" value={job.city} />
          <InfoItem
            label="每周出勤"
            value={job.intern_days_per_week ? `${job.intern_days_per_week} 天 / 周` : '—'}
          />
          <InfoItem
            label="实习时长"
            value={job.intern_months ? `${job.intern_months} 个月` : '—'}
          />
          <InfoItem label="学历要求" value={job.degree_requirement} />
          <InfoItem label="毕业要求" value={job.graduation_requirement} />
          <InfoItem label="投递渠道" value={application.apply_channel} />
          <InfoItem
            label="来源链接"
            value={
              <a href={job.source_url} target="_blank" rel="noreferrer">
                查看原始 JD
              </a>
            }
          />
          <InfoItem label="更新时间" value={job.updated_at} />
        </div>
      </SectionCard>

      <div className={styles.columns}>
        <div className={styles.mainCol}>
          {/* JD 摘要 */}
          <SectionCard title="JD 结构化摘要">
            <p className={styles.jdSummary}>{job.jd_summary}</p>
            <div className={styles.jdLists}>
              <div>
                <h4 className={styles.listTitle}>岗位职责</h4>
                <ul className={styles.bulletList}>
                  {job.responsibility_summary.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className={styles.listTitle}>任职要求</h4>
                <ul className={styles.bulletList}>
                  {job.requirement_summary.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className={styles.skillGroups}>
              <SkillGroup label="必备技能">
                {job.must_have_skills.map((s) => (
                  <Tag key={s} tone="primary">
                    {s}
                  </Tag>
                ))}
              </SkillGroup>
              <SkillGroup label="加分技能">
                {job.nice_to_have_skills.map((s) => (
                  <Tag key={s} tone="neutral">
                    {s}
                  </Tag>
                ))}
              </SkillGroup>
              <SkillGroup label="业务关键词">
                {job.business_keywords.map((s) => (
                  <Tag key={s} tone="neutral">
                    {s}
                  </Tag>
                ))}
              </SkillGroup>
              <SkillGroup label="工具关键词">
                {job.tool_keywords.map((s) => (
                  <Tag key={s} tone="neutral">
                    {s}
                  </Tag>
                ))}
              </SkillGroup>
            </div>
          </SectionCard>

          {/* 可解释评分 */}
          <SectionCard
            title="匹配评分拆解"
            extra={<Tag tone={decisionMeta.tone}>{decisionMeta.label}</Tag>}
          >
            <ScoreBreakdown
              components={match.score_components}
              finalScore={match.final_match_score}
            />
          </SectionCard>
        </div>

        <aside className={styles.sideCol}>
          {/* 风险提示 */}
          <SectionCard title="风险提示">
            <RiskTagList risks={job.risk_flags} />
          </SectionCard>

          {/* 建议动作 */}
          <SectionCard title="建议动作">
            <ActionRecommendationCard
              decision={match.decision}
              decisionReason={match.decision_reason}
              strengths={match.strengths}
              improvements={match.improvement_suggestions}
              jobId={job.job_id}
              hasSuggestion={Boolean(suggestion)}
            />
          </SectionCard>
        </aside>
      </div>
    </div>
  )
}
