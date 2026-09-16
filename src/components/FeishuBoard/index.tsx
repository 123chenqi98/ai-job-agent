import { useRef, type UIEvent } from 'react'
import { Link } from 'react-router-dom'
import Tag from '@/components/common/Tag'
import type { TagTone } from '@/components/common/Tag'
import type { FeishuApplicationItem, FeishuBoardColumn } from '@/types/feishu'
import { findEvalForJob } from '@/data/evaluationHistory'
// 飞书看板与 Mock 看板视觉完全一致，直接复用既有看板样式，避免样式碎片
import styles from '@/components/StatusBoard/StatusBoard.module.css'

/** 展示用分组键：在数据列基础上，把「结束」列拆成 offer / rejected 两列 */
export type FeishuBoardGroupKey = FeishuBoardColumn | 'offer' | 'rejected'

export type FeishuBoardAccent = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

export interface FeishuBoardGroup {
  column: FeishuBoardGroupKey
  label: string
  items: FeishuApplicationItem[]
  accent: FeishuBoardAccent
}

const ACCENT_DOT_CLASS: Record<FeishuBoardAccent, string> = {
  primary: styles.accentPrimary,
  success: styles.accentSuccess,
  warning: styles.accentWarning,
  danger: styles.accentDanger,
  neutral: styles.accentNeutral,
}

/** 日期精简为 MM/DD */
function shortDate(value: string | null): string {
  if (!value) return ''
  return value.slice(5).replace('-', '/')
}

/** 右上角状态标签：结束列区分 Offer / 回绝，其余列显示飞书原始状态 */
function statusTag(item: FeishuApplicationItem): { text: string; tone: TagTone } {
  if (item.result === 'offer') return { text: 'Offer', tone: 'success' }
  if (item.result === 'rejected') return { text: '已回绝', tone: 'danger' }
  if (item.column === 'applied') return { text: item.raw_status || '已投递', tone: 'primary' }
  if (item.column === 'interview') return { text: item.raw_status || '面试中', tone: 'success' }
  if (item.column === 'written_test') return { text: '笔试', tone: 'warning' }
  return { text: item.raw_status || '待评估', tone: 'neutral' }
}

/** 卡片主节点：优先展示面试 / Offer 日期，其次投递日期 */
function milestone(item: FeishuApplicationItem): { text: string; tone: TagTone } | null {
  if (item.interview_at) return { text: `面试 ${shortDate(item.interview_at)}`, tone: 'success' }
  if (item.offer_at) return { text: `Offer ${shortDate(item.offer_at)}`, tone: 'success' }
  if (item.applied_at && item.column === 'applied') {
    return { text: `已投递 · ${shortDate(item.applied_at)}`, tone: 'primary' }
  }
  return null
}

function evalToneClass(score: number): string {
  if (score >= 80) return styles.evalHigh
  if (score >= 60) return styles.evalMid
  return styles.evalLow
}

function FeishuCard({ item }: { item: FeishuApplicationItem }) {
  const tag = statusTag(item)
  const node = milestone(item)
  const detail = item.review || item.note
  const evalRecord = findEvalForJob(item.company, item.job_title)
  const metaTags = [item.city, item.recruit_type, item.industry].filter(
    (v): v is string => Boolean(v),
  )

  const cardClass = [
    styles.card,
    item.result === 'offer' ? styles.cardOffer : '',
    item.result === 'rejected' ? styles.cardRejected : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cardClass}>
      <div className={styles.cardTop}>
        <span className={styles.company}>{item.company}</span>
        <Tag tone={tag.tone}>{tag.text}</Tag>
      </div>

      <h4 className={styles.jobTitle}>{item.job_title || '（未填写岗位名称）'}</h4>

      {evalRecord ? (
        <Link
          to={`/evaluate/history?id=${encodeURIComponent(evalRecord.id)}`}
          className={styles.evalBadge}
          title="来自本机岗位评估历史，点击回看完整报告与面试准备"
        >
          <span className={`${styles.evalScore} ${evalToneClass(evalRecord.score)}`}>
            {evalRecord.score}
          </span>
          <span className={styles.evalDecision}>{evalRecord.decision}</span>
          <span className={styles.evalLink}>评估报告 ›</span>
        </Link>
      ) : null}

      {metaTags.length > 0 ? (
        <div className={styles.tagRow}>
          {metaTags.map((text) => (
            <Tag key={text} tone="neutral">
              {text}
            </Tag>
          ))}
        </div>
      ) : null}

      {node ? (
        <div className={styles.milestone}>
          <Tag tone={node.tone}>{node.text}</Tag>
        </div>
      ) : null}

      {detail ? <p className={styles.feedback}>{detail}</p> : null}

      <div className={styles.cardFooter}>
        <span>{item.channel || '渠道未填'}</span>
        <span className={styles.resumeVersion}>
          {item.applied_at ? `投递于 ${item.applied_at}` : '投递日期未填'}
        </span>
      </div>
    </div>
  )
}

export default function FeishuBoard({ groups }: { groups: FeishuBoardGroup[] }) {
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  // 列头行与卡片体是两个独立的横向滚动容器：任一容器横向滚动时把 scrollLeft 同步给另一个，
  // 保证吸顶列名与下方列始终对齐；syncingRef 防止程序化赋值回灌触发递归。
  const handleScroll = (source: 'header' | 'body') => (event: UIEvent<HTMLDivElement>) => {
    if (syncingRef.current) return
    const target = source === 'header' ? bodyScrollRef.current : headerScrollRef.current
    if (!target) return
    syncingRef.current = true
    target.scrollLeft = event.currentTarget.scrollLeft
    requestAnimationFrame(() => {
      syncingRef.current = false
    })
  }

  return (
    <div className={styles.boardWrap}>
      <div
        ref={headerScrollRef}
        className={styles.headerScroller}
        onScroll={handleScroll('header')}
      >
        <div className={styles.headerTrack}>
          {groups.map((group) => (
            <div key={group.column} className={styles.headerCell}>
              <span className={`${styles.columnDot} ${ACCENT_DOT_CLASS[group.accent]}`} />
              <h3 className={styles.columnTitle}>{group.label}</h3>
              <span className={styles.countPill}>{group.items.length}</span>
            </div>
          ))}
        </div>
      </div>

      <div ref={bodyScrollRef} className={styles.bodyScroller} onScroll={handleScroll('body')}>
        <div className={styles.bodyTrack}>
          {groups.map((group) => (
            <section key={group.column} className={styles.column}>
              <div className={styles.cardList}>
                {group.items.length > 0 ? (
                  group.items.map((item) => <FeishuCard key={item.record_id} item={item} />)
                ) : (
                  <div className={styles.empty}>暂无记录</div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
