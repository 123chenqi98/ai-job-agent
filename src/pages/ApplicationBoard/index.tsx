import { useEffect, useMemo, useRef } from 'react'
import type { BoardColumnKey } from '@/types'
import type { FeishuApplicationItem } from '@/types/feishu'
import { BOARD_COLUMNS } from '@/constants'
import FeishuBoard from '@/components/FeishuBoard'
import type { FeishuBoardAccent, FeishuBoardGroup } from '@/components/FeishuBoard'
import StateView from '@/components/common/StateView'
import { useBoardStore } from '@/state/WorkbenchStore'
import styles from './ApplicationBoard.module.css'

/** 各进行中列的列头配色；「结束」列不单列，改由 Offer / 已回绝两个分组承担 */
const COLUMN_ACCENT: Partial<Record<BoardColumnKey, FeishuBoardAccent>> = {
  todo: 'neutral',
  ready: 'neutral',
  applied: 'primary',
  written_test: 'warning',
  interview: 'success',
}

interface InsightItem {
  value: number
  label: string
  hint: string
  tone: string
}

function formatSyncTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function ApplicationBoard() {
  const { status, error, data, refreshing, refreshError, ensureLoaded, refresh } = useBoardStore()
  const pageRef = useRef<HTMLDivElement>(null)
  const overviewRef = useRef<HTMLDivElement>(null)

  // 仅本会话首次进入看板时拉取；切换导航回来直接展示缓存，手动「刷新同步」才重新请求
  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  // 实时测量信息总览高度并写入 CSS 变量，列头行据此吸顶在总览正下方；
  // 窄屏（≤960px）洞察卡换行导致总览变高时也能自动跟随，不能写死像素。
  useEffect(() => {
    const page = pageRef.current
    const overview = overviewRef.current
    if (!page || !overview) return
    const update = () => {
      page.style.setProperty('--overview-stuck-height', `${overview.offsetHeight}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(overview)
    return () => observer.disconnect()
  }, [])

  const items: FeishuApplicationItem[] = useMemo(() => data?.items ?? [], [data])

  // 进行中列保持与 BOARD_COLUMNS 一致；「结束」列按结果拆成 Offer / 已回绝两个独立分组
  const groups: FeishuBoardGroup[] = useMemo(() => {
    const activeGroups = BOARD_COLUMNS.filter((column) => column.key !== 'closed').map((column) => ({
      column: column.key,
      label: column.label,
      accent: COLUMN_ACCENT[column.key] ?? 'neutral',
      items: items.filter((item) => item.column === column.key),
    }))
    const closedItems = items.filter((item) => item.column === 'closed')
    const offerItems = closedItems.filter((item) => item.result === 'offer')
    // result 非 offer 的结束记录统一归入「已回绝」，保证任何结束态卡片都不丢失
    const rejectedItems = closedItems.filter((item) => item.result !== 'offer')
    return [
      ...activeGroups,
      { column: 'offer' as const, label: 'Offer', accent: 'success' as const, items: offerItems },
      {
        column: 'rejected' as const,
        label: '已回绝',
        accent: 'danger' as const,
        items: rejectedItems,
      },
    ]
  }, [items])

  // 三个运营洞察均由飞书真实状态实时派生
  const insights: InsightItem[] = useMemo(() => {
    const appliedPending = items.filter((i) => i.column === 'applied').length
    const interviewing = items.filter((i) => i.column === 'interview').length
    const offerCount = items.filter((i) => i.result === 'offer').length
    return [
      {
        value: appliedPending,
        label: '已投待跟进',
        hint: '飞书状态为「已投递/待筛选」，等待筛选回应',
        tone: styles.insightPrimary,
      },
      {
        value: interviewing,
        label: '面试中',
        hint: '处于初面至终面、等通知阶段，需重点跟进',
        tone: styles.insightWarning,
      },
      {
        value: offerCount,
        label: '已拿 Offer',
        hint: '飞书状态为已拿 offer / 待入职 / 已入职',
        tone: styles.insightSuccess,
      },
    ]
  }, [items])

  // 首次加载且没有缓存数据时才占全屏；手动刷新保留旧看板，只让按钮进入 loading 态
  if (status === 'loading' && !data) {
    return (
      <div className={styles.page}>
        <StateView title="正在同步飞书数据…" description="正在通过本地只读服务读取你的投递多维表格，请稍候。" />
      </div>
    )
  }

  if (status === 'error' && !data) {
    return (
      <div className={styles.page}>
        <StateView
          title="飞书数据同步失败"
          description={
            <>
              {error}
              <br />
              排查顺序：① 本地只读服务已启动（npm run dev:all）；② 应用已加为该多维表协作者；③ 最新版本（含只读权限）已发布。
            </>
          }
          actions={
            <button type="button" className={styles.retryButton} onClick={() => ensureLoaded()}>
              重新同步
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.page} ref={pageRef}>
      <div className={styles.overview} ref={overviewRef}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>投递看板</h1>
            <p className={styles.subtitle}>
              共 {items.length} 条投递记录，按飞书表「状态」自动分列，Offer 与已回绝各自独立成列；记录与状态均在飞书中维护。
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.refreshButton}
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              {refreshing ? '同步中…' : '刷新同步'}
            </button>
            {data?.generated_at ? (
              <span className={styles.syncMeta}>缓存数据 · 最近同步：{formatSyncTime(data.generated_at)}</span>
            ) : null}
            {refreshError ? <span className={styles.refreshError}>刷新失败：{refreshError}</span> : null}
          </div>
        </header>

        <section className={styles.insightRow}>
          {insights.map((it) => (
            <div key={it.label} className={styles.insightCard}>
              <span className={`${styles.insightValue} ${it.tone}`}>{it.value}</span>
              <div className={styles.insightText}>
                <div className={styles.insightLabel}>{it.label}</div>
                <div className={styles.insightHint}>{it.hint}</div>
              </div>
            </div>
          ))}
        </section>
      </div>

      {items.length === 0 ? (
        <StateView
          title="飞书表中暂无投递记录"
          description="在飞书多维表格中新增投递行并填写「状态」后，点击右上角「刷新同步」即可出现在看板。"
        />
      ) : (
        <FeishuBoard groups={groups} />
      )}

      <p className={styles.note}>
        数据来源：飞书多维表格《{data?.source}
        {data?.table ? ` / ${data.table}` : ''}
        》，经本地只读服务单向同步，工作台不向飞书写入任何内容；投递、改状态、写复盘请直接在飞书表中操作。工作台不执行自动投递。
      </p>
    </div>
  )
}
