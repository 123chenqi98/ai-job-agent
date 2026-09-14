import { Link } from 'react-router-dom'
import type {
  BoardColumnKey,
  FollowUpType,
  JobPoolItem,
  MatchLevel,
} from '@/types'
import {
  DECISION_META,
  FOLLOW_UP_TYPE_META,
  JOB_CATEGORY_META,
  MATCH_LEVEL_META,
} from '@/constants'
import ScoreBadge from '@/components/common/ScoreBadge'
import Tag from '@/components/common/Tag'
import type { TagTone } from '@/components/common/Tag'
import styles from './StatusBoard.module.css'

export interface BoardGroup {
  column: BoardColumnKey
  label: string
  items: JobPoolItem[]
}

interface StatusBoardProps {
  groups: BoardGroup[]
}

/** 匹配等级 → 分数徽章配色 */
const SCORE_TONE: Record<MatchLevel, 'success' | 'warning' | 'danger'> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
}

/** 看板列 → 列头计数点配色 */
const COLUMN_ACCENT: Record<BoardColumnKey, string> = {
  todo: styles.accentNeutral,
  ready: styles.accentPrimary,
  applied: styles.accentPrimary,
  written_test: styles.accentWarning,
  interview: styles.accentSuccess,
  closed: styles.accentNeutral,
}

/** 跟进类型 → 圆点配色 */
const FOLLOW_DOT: Record<FollowUpType, string> = {
  apply: styles.dotPrimary,
  written_test: styles.dotWarning,
  interview: styles.dotSuccess,
  feedback: styles.dotNeutral,
  note: styles.dotNeutral,
}

/** 日期精简为 MM/DD */
function shortDate(value: string | null): string {
  if (!value) return ''
  return value.slice(5).replace('-', '/')
}

/** 按投递状态取卡片主节点文案；未投递阶段与决策标签重复，返回 null 不重复展示 */
function getMilestone(item: JobPoolItem): { text: string; tone: TagTone } | null {
  const { application: a } = item
  switch (a.apply_status) {
    case 'offer':
      return { text: a.result ?? '获得 Offer', tone: 'success' }
    case 'rejected':
      return { text: a.result ?? '流程结束', tone: 'danger' }
    case 'interview':
      return {
        text: a.interview_round > 0 ? `第 ${a.interview_round} 轮面试` : '面试中',
        tone: 'success',
      }
    case 'written_test':
      return {
        text: a.written_test_time
          ? `笔试安排在 ${shortDate(a.written_test_time)}`
          : '笔试待安排',
        tone: 'warning',
      }
    case 'applied':
      return {
        text: a.apply_time ? `已投递 · ${shortDate(a.apply_time)}` : '已投递',
        tone: 'primary',
      }
    default:
      return null
  }
}

function BoardCard({ item }: { item: JobPoolItem }) {
  const { job, match, application: a } = item
  const decisionMeta = DECISION_META[match.decision]
  const milestone = getMilestone(item)
  const latestFollowUp = a.follow_ups[a.follow_ups.length - 1]
  const isClosed = a.apply_status === 'offer' || a.apply_status === 'rejected'

  const cardClass = [
    styles.card,
    a.apply_status === 'offer' ? styles.cardOffer : '',
    a.apply_status === 'rejected' ? styles.cardRejected : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Link to={`/jobs/${job.job_id}`} className={cardClass}>
      <div className={styles.cardTop}>
        <span className={styles.company}>{job.company_name}</span>
        <ScoreBadge
          score={match.final_match_score}
          tone={SCORE_TONE[match.match_level]}
          caption={MATCH_LEVEL_META[match.match_level].label}
        />
      </div>

      <h4 className={styles.jobTitle}>{job.job_title}</h4>

      <div className={styles.tagRow}>
        <Tag tone="neutral">{job.city}</Tag>
        <Tag tone="neutral">
          {JOB_CATEGORY_META[job.job_category].label}
        </Tag>
        <Tag tone={decisionMeta.tone}>{decisionMeta.label}</Tag>
      </div>

      {milestone ? (
        <div className={styles.milestone}>
          <Tag tone={milestone.tone}>{milestone.text}</Tag>
        </div>
      ) : null}

      <p className={styles.feedback}>{a.latest_feedback}</p>

      {latestFollowUp ? (
        <div className={styles.followUp}>
          <span
            className={`${styles.followDot} ${FOLLOW_DOT[latestFollowUp.type]}`}
          />
          <div className={styles.followBody}>
            <div className={styles.followHead}>
              <span className={styles.followType}>
                {FOLLOW_UP_TYPE_META[latestFollowUp.type].label}
              </span>
              <span className={styles.followDate}>
                {shortDate(latestFollowUp.time)}
              </span>
            </div>
            <p className={styles.followContent}>{latestFollowUp.content}</p>
          </div>
        </div>
      ) : null}

      <div className={styles.cardFooter}>
        <span>{a.apply_channel}</span>
        {a.resume_version_used ? (
          <span className={styles.resumeVersion}>{a.resume_version_used}</span>
        ) : (
          <span className={styles.resumeVersion}>未投递</span>
        )}
      </div>

      {isClosed ? (
        <div className={styles.nextAction}>
          {a.apply_status === 'offer' ? '待办：' : '复盘：'}
          {a.follow_up_action}
        </div>
      ) : (
        <div className={styles.nextAction}>
          下一步：{a.follow_up_action}
        </div>
      )}
    </Link>
  )
}

export default function StatusBoard({ groups }: StatusBoardProps) {
  return (
    <div className={styles.board}>
      {groups.map((group) => (
        <section key={group.column} className={styles.column}>
          <header className={styles.columnHeader}>
            <span
              className={`${styles.columnDot} ${COLUMN_ACCENT[group.column]}`}
            />
            <h3 className={styles.columnTitle}>{group.label}</h3>
            <span className={styles.countPill}>{group.items.length}</span>
          </header>

          <div className={styles.cardList}>
            {group.items.length > 0 ? (
              group.items.map((item) => (
                <BoardCard key={item.job.job_id} item={item} />
              ))
            ) : (
              <div className={styles.empty}>暂无岗位</div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
