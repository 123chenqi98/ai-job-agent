import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import SectionCard from '@/components/common/SectionCard'
import StateView from '@/components/common/StateView'
import { listEvalRecords, type EvalRecord } from '@/data/evaluationHistory'
import { useBoardStore, useJobsStore } from '@/state/WorkbenchStore'
import type { FeishuApplicationItem, FeishuJobItem } from '@/types/feishu'
import styles from './Dashboard.module.css'

// 今日工作台：不新增任何接口，数字全部派生自看板缓存、岗位池缓存与本机评估历史
// 首页预热后，再进入岗位池 / 看板都是瞬时展示（WorkbenchStore 跨导航缓存）

const URGENT_WINDOW_DAYS = 14
const URGENT_LIMIT = 5
const FOCUS_LIMIT = 5
const EVAL_LIMIT = 3

function IconPool() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M3 12h18" />
    </svg>
  )
}

function IconEval() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}

function IconBoard() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M15 4v7" />
    </svg>
  )
}

function IconResume() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
      <path d="M13 3v6h6" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function IconInterview() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </svg>
  )
}

function IconFollow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function IconOffer() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13.2 8 22l4-2.2L16 22l-1-8.8" />
    </svg>
  )
}

function IconTrend() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M21 7v6h-6" />
    </svg>
  )
}

// 截止文案形如 2026/10/17、2026-10-17，提取出日期；「招满即止」等返回 null
function parseDeadline(text: string | null): Date | null {
  if (!text) return null
  const matched = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!matched) return null
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function daysLeft(deadline: Date): number {
  return Math.round((deadline.getTime() - startOfToday().getTime()) / 86_400_000)
}

function formatMd(text: string | null): string {
  if (!text) return ''
  const matched = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  return matched ? `${Number(matched[2])}/${Number(matched[3])}` : text
}

function formatEvalDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function scoreTone(score: number): string {
  if (score >= 85) return styles.scoreHigh
  if (score >= 70) return styles.scoreMid
  return styles.scoreLow
}

interface FocusRow {
  item: FeishuApplicationItem
  kind: 'interview' | 'follow'
}

interface UrgentRow {
  item: FeishuJobItem
  days: number
}

export default function Dashboard() {
  const {
    bootstrapStatus,
    bootstrapError,
    items: jobItems,
    meta,
    ensureBootstrap,
    bootstrap,
  } = useJobsStore()
  const { data: board, status: boardStatus, error: boardError, ensureLoaded, refresh } =
    useBoardStore()

  // 首次进入工作台即预热两份缓存，之后切到岗位池 / 看板不再请求
  useEffect(() => {
    ensureBootstrap()
    ensureLoaded()
  }, [ensureBootstrap, ensureLoaded])

  // 评估历史仅在本机浏览器，每次进入页面时读取最新
  const recentEvals = useMemo<EvalRecord[]>(() => listEvalRecords().slice(0, EVAL_LIMIT), [])

  const boardItems = board?.items ?? []
  const interviewItems = useMemo(
    () => boardItems.filter((item) => item.column === 'interview'),
    [boardItems],
  )
  const followItems = useMemo(
    () => boardItems.filter((item) => item.column === 'applied' || item.column === 'written_test'),
    [boardItems],
  )
  const offerCount = useMemo(
    () => boardItems.filter((item) => item.result === 'offer').length,
    [boardItems],
  )

  const focusRows = useMemo<FocusRow[]>(
    () => [
      ...interviewItems.map((item) => ({ item, kind: 'interview' as const })),
      ...followItems.map((item) => ({ item, kind: 'follow' as const })),
    ].slice(0, FOCUS_LIMIT),
    [interviewItems, followItems],
  )

  const urgentRows = useMemo<UrgentRow[]>(() => {
    const rows: UrgentRow[] = []
    for (const item of jobItems) {
      const deadline = parseDeadline(item.deadline)
      if (!deadline) continue
      const days = daysLeft(deadline)
      if (days >= 0 && days <= URGENT_WINDOW_DAYS) rows.push({ item, days })
    }
    return rows.sort((a, b) => a.days - b.days).slice(0, URGENT_LIMIT)
  }, [jobItems])

  const todayText = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const headline =
    interviewItems.length > 0
      ? `${interviewItems.length} 个岗位正在面试流程中，今天优先准备面试`
      : followItems.length > 0
        ? `${followItems.length} 个已投岗位在等回应，今天可以跟进一轮`
        : boardItems.length > 0
          ? '流程里的岗位都在推进中，去岗位池看看有没有新机会'
          : '从岗位池开始，走完「筛选 → 评估 → 投递 → 追踪」闭环'

  const kpis = [
    {
      key: 'interview',
      label: '面试中',
      value: interviewItems.length,
      hint: '面试流程中的岗位',
      cardTone: styles.toneViolet,
      icon: <IconInterview />,
      to: '/board',
    },
    {
      key: 'follow',
      label: '跟进中',
      value: followItems.length,
      hint: '已投递 / 笔试，等待回应',
      cardTone: styles.tonePrimary,
      icon: <IconFollow />,
      to: '/board',
    },
    {
      key: 'offer',
      label: 'Offer',
      value: offerCount,
      hint: '已拿到 Offer 的岗位',
      cardTone: styles.toneSuccess,
      icon: <IconOffer />,
      to: '/board',
    },
    {
      key: 'jobs27',
      label: '27 届在招',
      value: meta?.totals.target27 ?? '—',
      hint: '飞书总表 27 届口径',
      cardTone: styles.toneIndigo,
      icon: <IconTrend />,
      to: '/jobs',
    },
  ]

  const initialLoading =
    boardStatus === 'loading' && !board && bootstrapStatus === 'loading' && jobItems.length === 0

  if (initialLoading) {
    return (
      <div className={styles.page}>
        <StateView title="正在准备今日工作台…" description="正在同步岗位池与投递看板数据，请稍候。" />
      </div>
    )
  }

  const showStarter = boardItems.length === 0 && recentEvals.length === 0

  return (
    <div className={styles.page}>
      <header className={styles.hero} style={{ animationDelay: '0ms' }}>
        <div>
          <p className={styles.heroDate}>{todayText}</p>
          <h1 className={styles.heroTitle}>今日工作台</h1>
          <p className={styles.heroHeadline}>{headline}</p>
        </div>
        <Link to="/jobs" className={styles.heroCta}>
          去岗位池看看
          <IconArrow />
        </Link>
      </header>

      {bootstrapStatus === 'error' && bootstrapError ? (
        <div className={styles.dataWarn} role="alert">
          <div className={styles.dataWarnBody}>
            <span className={styles.dataWarnTitle}>岗位池数据暂时没同步成功</span>
            <span>下方「27 届在招」与「临近截止」可能不完整，看板数据不受影响。原因：{bootstrapError}</span>
          </div>
          <button type="button" className={styles.dataWarnAction} onClick={() => void bootstrap()}>
            重新同步
          </button>
        </div>
      ) : null}

      {boardStatus === 'error' && boardError ? (
        <div className={styles.dataWarn} role="alert">
          <div className={styles.dataWarnBody}>
            <span className={styles.dataWarnTitle}>投递看板暂时没同步成功</span>
            <span>下方面试 / 跟进 / Offer 统计可能显示为 0，岗位池数据不受影响。原因：{boardError}</span>
          </div>
          <button type="button" className={styles.dataWarnAction} onClick={() => void refresh()}>
            重新同步
          </button>
        </div>
      ) : null}

      {showStarter ? (
        <section className={styles.starter}>
          <div className={styles.starterText}>
            <strong>还没有任何投递记录</strong>
            <span>
              先在岗位池按方向和城市筛选，AI 对照你的本机简历出投递报告，投出去之后到看板追踪进展。
            </span>
          </div>
          <Link to="/jobs" className={styles.starterButton}>
            开始找岗位
          </Link>
        </section>
      ) : null}

      <div className={styles.statsGrid}>
        {kpis.map((kpi, index) => (
          <Link
            key={kpi.key}
            to={kpi.to}
            className={`${styles.statCard} ${kpi.cardTone}`}
            style={{ animationDelay: `${120 + index * 70}ms` }}
          >
            <span className={styles.statTop}>
              <span className={styles.statLabel}>{kpi.label}</span>
              <span className={styles.statIcon}>{kpi.icon}</span>
            </span>
            <span className={styles.statValue}>{kpi.value}</span>
            <span className={styles.statHint}>{kpi.hint}</span>
          </Link>
        ))}
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.leftCol}>
          <SectionCard title="今日重点跟进" extra={<Link to="/board" className={styles.moreLink}>看板全量</Link>}>
            {focusRows.length === 0 ? (
              <p className={styles.emptyText}>
                暂无在跟进的投递。从岗位池投递后，这里会把面试中和等待回应的岗位排到最前面。
              </p>
            ) : (
              <ul className={styles.focusList}>
                {focusRows.map(({ item, kind }) => (
                  <li key={item.record_id}>
                    <Link to="/board" className={styles.focusRow}>
                      <span className={styles.focusMain}>
                        <span className={styles.focusName}>
                          {item.company}
                          <span className={styles.focusJob}>{item.job_title}</span>
                        </span>
                      </span>
                      <span className={styles.focusMeta}>
                        <span className={kind === 'interview' ? styles.tagInterview : styles.tagFollow}>
                          {kind === 'interview'
                            ? `面试${item.interview_at ? ` · ${formatMd(item.interview_at)}` : ''}`
                            : `投递于 ${formatMd(item.applied_at) || '—'}`}
                        </span>
                        {item.city ? <span className={styles.focusCity}>{item.city}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="临近截止"
            extra={<Link to="/jobs" className={styles.moreLink}>去岗位池筛选</Link>}
          >
            {urgentRows.length === 0 ? (
              <p className={styles.emptyText}>
                最近更新的岗位多为「招满即止」，暂无明确截止日在 {URGENT_WINDOW_DAYS} 天内的岗位。
              </p>
            ) : (
              <>
                <ul className={styles.urgentList}>
                  {urgentRows.map(({ item, days }) => (
                    <li key={item.record_id} className={styles.urgentRow}>
                      <span className={styles.focusName}>
                        {item.company}
                        <span className={styles.focusJob}>{item.job_title}</span>
                      </span>
                      <span className={styles.urgentMeta}>
                        <span
                          className={
                            days <= 3 ? styles.deadlineDanger : days <= 7 ? styles.deadlineWarn : styles.deadlineNormal
                          }
                        >
                          {days === 0 ? '今天截止' : `还剩 ${days} 天`}
                        </span>
                        {item.apply_url ? (
                          <a
                            href={item.apply_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={styles.applyLink}
                          >
                            立即投递
                          </a>
                        ) : (
                          <Link to="/jobs" className={styles.applyLink}>
                            去查看
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className={styles.scopeNote}>
                  口径：岗位池默认缓存中最近更新的 20 个 27 届岗位；完整筛选请到岗位池。
                </p>
              </>
            )}
          </SectionCard>
        </div>

        <div className={styles.rightCol}>
          <SectionCard
            title="最近 AI 评估"
            extra={<Link to="/evaluate/history" className={styles.moreLink}>全部历史</Link>}
          >
            {recentEvals.length === 0 ? (
              <div className={styles.evalEmpty}>
                <span>还没有评估记录，贴一段 JD 就能出投递报告。</span>
                <Link to="/evaluate" className={styles.evalCta}>去评估一个岗位</Link>
              </div>
            ) : (
              <ul className={styles.evalList}>
                {recentEvals.map((record) => (
                  <li key={record.id}>
                    <Link
                      to={`/evaluate/history?id=${encodeURIComponent(record.id)}`}
                      className={styles.evalRow}
                    >
                      <span className={styles.evalHead}>
                        <span className={styles.evalName}>
                          {record.company || '未命名'}
                          {record.title ? <span className={styles.focusJob}>{record.title}</span> : null}
                        </span>
                        <span className={`${styles.evalScore} ${scoreTone(record.score)}`}>
                          {record.score}
                        </span>
                      </span>
                      <span className={styles.evalDecision}>{record.decision}</span>
                      <span className={styles.evalDate}>{formatEvalDate(record.created_at)} 评估</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="快捷入口">
            <div className={styles.quickGrid}>
              <Link to="/jobs" className={`${styles.quickItem} ${styles.qiPrimary}`}>
                <span className={styles.quickIcon}><IconPool /></span>
                <span>逛岗位池</span>
              </Link>
              <Link to="/evaluate" className={`${styles.quickItem} ${styles.qiViolet}`}>
                <span className={styles.quickIcon}><IconEval /></span>
                <span>评估岗位</span>
              </Link>
              <Link to="/board" className={`${styles.quickItem} ${styles.qiTeal}`}>
                <span className={styles.quickIcon}><IconBoard /></span>
                <span>投递看板</span>
              </Link>
              <Link to="/resume" className={`${styles.quickItem} ${styles.qiIndigo}`}>
                <span className={styles.quickIcon}><IconResume /></span>
                <span>我的简历</span>
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
