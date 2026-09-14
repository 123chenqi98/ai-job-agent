import { Link, useNavigate } from 'react-router-dom'
import {
  APPLICATION_STATUS_META,
  JOB_CATEGORY_META,
  MATCH_LEVEL_META,
} from '@/constants'
import type { ApplicationStatus, JobPoolItem } from '@/types'
import ScoreBadge from '@/components/common/ScoreBadge'
import Tag, { type TagTone } from '@/components/common/Tag'
import styles from './JobTable.module.css'

/** 投递状态 → 标签配色 */
const STATUS_TONE: Record<ApplicationStatus, TagTone> = {
  todo: 'neutral',
  ready: 'warning',
  applied: 'neutral',
  written_test: 'primary',
  interview: 'primary',
  offer: 'success',
  rejected: 'danger',
}

interface JobTableProps {
  items: JobPoolItem[]
}

export default function JobTable({ items }: JobTableProps) {
  const navigate = useNavigate()

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colJob}>岗位</th>
            <th>城市</th>
            <th>方向</th>
            <th className={styles.colScore}>匹配分</th>
            <th>推荐等级</th>
            <th>当前状态</th>
            <th>定制简历</th>
            <th>下一步动作</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className={styles.empty}>
                没有符合筛选条件的岗位，试试放宽筛选或重置。
              </td>
            </tr>
          ) : (
            items.map(({ job, match, application, needs_customized_resume, next_action }) => {
              const levelMeta = MATCH_LEVEL_META[match.match_level]
              return (
                <tr
                  key={job.job_id}
                  className={styles.row}
                  onClick={() => navigate(`/jobs/${job.job_id}`)}
                >
                  <td>
                    <div className={styles.company}>{job.company_name}</div>
                    <Link
                      className={styles.jobTitle}
                      to={`/jobs/${job.job_id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {job.job_title}
                    </Link>
                    <div className={styles.department}>{job.department_name}</div>
                  </td>
                  <td>{job.city}</td>
                  <td>
                    <Tag tone="neutral">
                      {JOB_CATEGORY_META[job.job_category].label}
                    </Tag>
                  </td>
                  <td>
                    <ScoreBadge
                      score={match.final_match_score}
                      tone={levelMeta.tone}
                    />
                  </td>
                  <td>
                    <Tag tone={levelMeta.tone}>{levelMeta.label}</Tag>
                  </td>
                  <td>
                    <Tag tone={STATUS_TONE[application.apply_status]}>
                      {APPLICATION_STATUS_META[application.apply_status].label}
                    </Tag>
                  </td>
                  <td>
                    {needs_customized_resume ? (
                      <Tag tone="warning">需定制</Tag>
                    ) : (
                      <Tag tone="neutral">通用即可</Tag>
                    )}
                  </td>
                  <td>
                    <Tag tone="primary">{next_action}</Tag>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
