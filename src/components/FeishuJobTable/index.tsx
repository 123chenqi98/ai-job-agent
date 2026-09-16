import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Tag from '@/components/common/Tag'
import { findEvalForJob } from '@/data/evaluationHistory'
import type { FeishuJobItem } from '@/types/feishu'
import styles from './FeishuJobTable.module.css'

interface FeishuJobTableProps {
  items: FeishuJobItem[]
}

type DeadlineTone = 'normal' | 'urgent' | 'expired' | 'rolling'

function parseDate(raw: string): Date | null {
  const matched = raw.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)
  if (!matched) return null
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

// 截止时间视觉分层：7 天内临期橙色、已过期灰色划线、「招满即止/滚动招聘」中性标签
function deadlineView(raw: string | null): { text: string; tone: DeadlineTone } {
  if (!raw) return { text: '—', tone: 'normal' }
  const text = raw.trim()
  if (/招满|滚动|长期|常年/.test(text)) return { text, tone: 'rolling' }
  const date = parseDate(text)
  if (!date) return { text, tone: 'normal' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return { text, tone: 'expired' }
  if (days <= 7) return { text, tone: 'urgent' }
  return { text, tone: 'normal' }
}

function formatUpdated(raw: string | null): string | null {
  if (!raw) return null
  const date = parseDate(raw)
  if (!date) return raw
  return `${date.getMonth() + 1}/${date.getDate()} 更新`
}

function scoreToneClass(score: number): string {
  if (score >= 80) return styles.scoreHigh
  if (score >= 60) return styles.scoreMid
  return styles.scoreLow
}

const deadlineToneClass: Record<DeadlineTone, string> = {
  normal: styles.deadlineNormal,
  urgent: styles.deadlineUrgent,
  expired: styles.deadlineExpired,
  rolling: styles.deadlineRolling,
}

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

export default function FeishuJobTable({ items }: FeishuJobTableProps) {
  // 每行角标都需扫一遍本地评估历史，统一按列表数据记忆化，避免渲染期重复读 localStorage
  const evalByRow = useMemo(
    () => items.map((item) => findEvalForJob(item.company, item.job_title)),
    [items],
  )
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colCompany}>公司 / 行业</th>
            <th>招聘岗位</th>
            <th className={styles.colCity}>地点</th>
            <th className={styles.colMeta}>届别</th>
            <th className={styles.colMeta}>学历</th>
            <th className={styles.colDeadline}>网申截止</th>
            <th className={styles.colAction}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const deadline = deadlineView(item.deadline)
            const updated = formatUpdated(item.updated_at)
            const evalRecord = evalByRow[index]
            return (
              <tr key={item.record_id}>
                <td>
                  <div className={styles.company}>{item.company || '—'}</div>
                  {item.industry ? <div className={styles.companySub}>{item.industry}</div> : null}
                </td>
                <td>
                  <div className={styles.jobTitle} title={item.job_title}>
                    {item.job_title || '—'}
                  </div>
                  <div className={styles.tagRow}>
                    {item.recruit_type ? <Tag tone="primary">{item.recruit_type}</Tag> : null}
                    {item.company_nature ? <Tag tone="neutral">{item.company_nature}</Tag> : null}
                    {evalRecord ? (
                      <Link
                        className={styles.evalBadge}
                        to={`/evaluate/history?id=${encodeURIComponent(evalRecord.id)}`}
                        title={`本机已评估：${evalRecord.score} 分（${evalRecord.decision}），点击回看报告`}
                      >
                        已评估 <span className={scoreToneClass(evalRecord.score)}>{evalRecord.score}</span>
                      </Link>
                    ) : null}
                  </div>
                  {item.note ? (
                    <div className={styles.noteLine} title={item.note}>
                      {item.note}
                    </div>
                  ) : null}
                </td>
                <td className={styles.muted} data-label="地点">
                  {item.city || '—'}
                </td>
                <td className={styles.muted} data-label="届别">
                  {item.target || '—'}
                </td>
                <td className={styles.muted} data-label="学历">
                  {item.degree || '—'}
                </td>
                <td data-label="网申截止">
                  <div className={`${styles.deadline} ${deadlineToneClass[deadline.tone]}`}>
                    {deadline.text}
                  </div>
                  {updated ? <div className={styles.updated}>{updated}</div> : null}
                </td>
                <td>
                  <div className={styles.actions}>
                    {item.apply_url ? (
                      <a
                        className={styles.btnApply}
                        href={item.apply_url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        立即投递
                        <ExternalIcon />
                      </a>
                    ) : (
                      <span className={`${styles.btnApply} ${styles.btnApplyDisabled}`}>
                        暂无投递链接
                      </span>
                    )}
                    <div className={styles.actionSub}>
                      <Link
                        className={styles.btnEval}
                        to={`/evaluate?company=${encodeURIComponent(item.company || '')}&title=${encodeURIComponent(item.job_title || '')}`}
                      >
                        评估
                      </Link>
                      {item.announcement_url ? (
                        <a
                          className={styles.btnAnnounce}
                          href={item.announcement_url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          公告
                        </a>
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
