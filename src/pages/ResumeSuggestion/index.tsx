import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { JOB_CATEGORY_META } from '@/constants'
import { getExperiences, getJobDetail } from '@/data/repository'
import ResumeSuggestionPanel from '@/components/ResumeSuggestionPanel'
import StateView from '@/components/common/StateView'
import Tag from '@/components/common/Tag'
import styles from './ResumeSuggestion.module.css'

export default function ResumeSuggestion() {
  const { jobId = '' } = useParams<{ jobId: string }>()
  const bundle = getJobDetail(jobId)
  const experiences = useMemo(() => getExperiences(), [])

  const experienceNameMap = useMemo(() => {
    const map = new Map<string, string>()
    experiences.forEach((e) =>
      map.set(e.experience_id, `${e.title} · ${e.organization}`),
    )
    return map
  }, [experiences])

  if (!bundle) {
    return (
      <StateView
        title="未找到该岗位"
        description={
          <>岗位 ID「{jobId}」不存在或已被归档，无法生成简历建议。</>
        }
        actions={<Link to="/jobs">← 返回岗位池</Link>}
      />
    )
  }

  const { job, suggestion } = bundle

  if (!suggestion) {
    return (
      <StateView
        title="该岗位尚未生成简历建议"
        description={
          <>
            当前原型仅为示例岗位「字节跳动 · 数据分析实习生」内置了完整简历建议，「{job.company_name} · {job.job_title}
            」暂未生成。可返回岗位详情查看匹配评分，后续版本将支持一键生成。
          </>
        }
        actions={<Link to={`/jobs/${jobId}`}>← 返回岗位详情</Link>}
      />
    )
  }

  const resolveExperienceName = (id: string) =>
    experienceNameMap.get(id) ?? id

  return (
    <div className={styles.page}>
      <Link to={`/jobs/${jobId}`} className={styles.backLink}>
        ← 返回岗位详情
      </Link>

      <header className={styles.header}>
        <div>
          <div className={styles.company}>{job.company_name}</div>
          <h1 className={styles.title}>{job.job_title} · 简历定制建议</h1>
          <div className={styles.tagLine}>
            <Tag tone="neutral">{JOB_CATEGORY_META[job.job_category].label}</Tag>
            <Tag tone="neutral">{job.city}</Tag>
            <Tag tone="primary">岗位定制版</Tag>
          </div>
        </div>

        <div className={styles.coverageCard}>
          <div className={styles.coverageHead}>
            <span className={styles.coverageLabel}>当前简历覆盖度</span>
            <span className={styles.coverageValue}>
              {suggestion.coverage_score}
              <span className={styles.coverageTotal}>%</span>
            </span>
          </div>
          <div className={styles.coverageTrack}>
            <div
              className={styles.coverageBar}
              style={{ width: `${suggestion.coverage_score}%` }}
            />
          </div>
          <p className={styles.coverageHint}>
            按岗位必备技能与经历要求估算，剩余缺口见右侧「当前缺失点」。
          </p>
        </div>
      </header>

      <ResumeSuggestionPanel
        suggestion={suggestion}
        resolveExperienceName={resolveExperienceName}
      />

      <p className={styles.note}>
        数据来源：本地 Mock 简历建议；改写建议依据岗位 JD 与经历素材库匹配生成，仅用于原型演示，不构成真实投递承诺。
      </p>
    </div>
  )
}
