import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SectionCard from '@/components/common/SectionCard'
import StateView from '@/components/common/StateView'
import {
  clearEvalRecords,
  listEvalRecords,
  removeEvalRecord,
  type EvalRecord,
} from '@/data/evaluationHistory'
import EvaluateReport from './EvaluateReport'
import EvaluateTabs from './EvaluateTabs'
import styles from './Evaluate.module.css'

function formatTime(iso: string): string {
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

function scoreToneClass(score: number): string {
  if (score >= 80) return styles.toneSuccess
  if (score >= 60) return styles.toneWarning
  return styles.toneDanger
}

function levelText(level: EvalRecord['level']): string {
  if (level === 'high') return '高匹配'
  if (level === 'medium') return '中匹配'
  return '低匹配'
}

export default function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const deepId = searchParams.get('id')
  const [records, setRecords] = useState<EvalRecord[]>(() => listEvalRecords())
  // 从投递看板「评估报告」带 ?id= 进入时自动展开对应记录
  const [selectedId, setSelectedId] = useState<string | null>(deepId)
  const [deepDismissed, setDeepDismissed] = useState(false)
  const reportRef = useRef<HTMLDivElement | null>(null)

  const dismissDeepMiss = () => {
    setDeepDismissed(true)
    setSelectedId(null)
    setSearchParams({}, { replace: true })
  }

  // 展开记录后平滑滚动到报告（深链直达与手动展开均生效）
  useEffect(() => {
    if (!selectedId) return
    const timer = window.setTimeout(() => {
      reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [selectedId])

  const refresh = () => setRecords(listEvalRecords())

  const handleRemove = (id: string) => {
    removeEvalRecord(id)
    if (selectedId === id) setSelectedId(null)
    refresh()
  }

  const handleClear = () => {
    if (records.length === 0) return
    if (window.confirm(`确定清空全部 ${records.length} 条本地评估历史吗？此操作不可撤销。`)) {
      clearEvalRecords()
      setSelectedId(null)
      refresh()
    }
  }

  const selected = records.find((r) => r.id === selectedId) ?? null
  const deepMiss = Boolean(deepId && !deepDismissed && !records.some((r) => r.id === deepId))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>岗位评估</h1>
        <p className={styles.subtitle}>
          评估完成的岗位自动沉淀在本机浏览器（localStorage），可随时回看完整报告与面试准备；数据不上传、不写入飞书，清除浏览器数据即删除。
        </p>
        <EvaluateTabs />
      </header>

      {deepMiss ? (
        <div className={styles.deepMiss} role="alert">
          <div>
            <strong>找不到链接对应的评估记录</strong>
            评估历史只保存在当前浏览器本机；换设备、清除过浏览器数据，或打开的是别人分享的链接时，这条记录不会存在。
          </div>
          <div className={styles.deepMissActions}>
            <button type="button" className={styles.deepMissButton} onClick={dismissDeepMiss}>
              知道了
            </button>
            <Link to="/evaluate" className={`${styles.deepMissButton} ${styles.deepMissPrimary}`}>
              去评估一个岗位
            </Link>
          </div>
        </div>
      ) : null}

      {records.length === 0 ? (
        <SectionCard>
          <StateView
            title="还没有评估历史"
            description={
              <>
                在「单岗位评估」粘贴 JD 生成报告，或在「批量评估与排名」一次评估多个岗位后，结果会自动保存在这里。
              </>
            }
            actions={
              <Link to="/evaluate" className={styles.primaryButton}>
                去评估一个岗位
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="本地评估历史"
            extra={
              <div className={styles.historyExtra}>
                <span className={styles.batchCount}>{records.length} 条 · 仅存本机</span>
                <button type="button" className={styles.batchRemove} onClick={handleClear}>
                  清空全部
                </button>
              </div>
            }
          >
            <ul className={styles.rankList}>
              {records.map((record, index) => {
                const active = selectedId === record.id
                return (
                  <li key={record.id}>
                    <div
                      className={`${styles.rankCard} ${active ? styles.rankCardActive : ''} ${styles.historyCard}`}
                    >
                      <button
                        type="button"
                        className={styles.historyMain}
                        onClick={() => setSelectedId(active ? null : record.id)}
                      >
                        <span className={styles.rankNo}>#{index + 1}</span>
                        <span className={`${styles.rankScore} ${scoreToneClass(record.score)}`}>
                          {record.score}
                        </span>
                        <span className={styles.rankBody}>
                          <span className={styles.rankJob}>
                            {[record.company, record.title].filter(Boolean).join(' · ') || '未命名岗位'}
                          </span>
                          <span className={styles.rankMeta}>
                            {levelText(record.level)} · {record.decision}
                            {record.deal_pass + record.deal_fail > 0
                              ? ` · 硬门槛 ${record.deal_pass}✓${record.deal_fail > 0 ? ` ${record.deal_fail}✕` : ''}`
                              : ''}
                            {' · '}
                            {record.source === 'batch' ? '批量评估' : '单岗位'} · {formatTime(record.created_at)}
                          </span>
                        </span>
                        <span className={styles.rankChevron}>{active ? '收起' : '查看报告'}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.historyDelete}
                        onClick={() => handleRemove(record.id)}
                      >
                        删除
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          {selected ? (
            <div ref={reportRef}>
              <EvaluateReport
                match={selected.match}
                company={selected.company}
                title={selected.title}
                jd={selected.jd}
                generatedAt={selected.created_at}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
