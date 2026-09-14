import { useEffect, useMemo, useState } from 'react'
import { getFeishuBoard } from '@/data/feishuRepository'
import type { FeishuApplicationItem, FeishuBoardResponse } from '@/types/feishu'
import { BOARD_COLUMNS } from '@/constants'
import FeishuBoard from '@/components/FeishuBoard'
import type { FeishuBoardGroup } from '@/components/FeishuBoard'
import StateView from '@/components/common/StateView'
import styles from './ApplicationBoard.module.css'

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
  const [data, setData] = useState<FeishuBoardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getFeishuBoard()
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取飞书数据失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    getFeishuBoard(controller.signal)
      .then((response) => setData(response))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : '读取飞书数据失败，请稍后重试。')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const items: FeishuApplicationItem[] = useMemo(() => data?.items ?? [], [data])

  const groups: FeishuBoardGroup[] = useMemo(
    () =>
      BOARD_COLUMNS.map((column) => ({
        column: column.key,
        label: column.label,
        items: items.filter((item) => item.column === column.key),
      })),
    [items],
  )

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

  if (loading) {
    return (
      <div className={styles.page}>
        <StateView title="正在同步飞书数据…" description="正在通过本地只读服务读取你的投递多维表格，请稍候。" />
      </div>
    )
  }

  if (error) {
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
            <button type="button" className={styles.retryButton} onClick={load}>
              重新同步
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>投递看板</h1>
          <p className={styles.subtitle}>
            共 {items.length} 条投递记录，按飞书表「状态」自动归入 6 列；记录与状态均在飞书中维护。
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.refreshButton} onClick={load}>
            刷新同步
          </button>
          {data?.generated_at ? (
            <span className={styles.syncMeta}>最近同步：{formatSyncTime(data.generated_at)}</span>
          ) : null}
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
