import { useEffect, useRef, useState } from 'react'
import SectionCard from '@/components/common/SectionCard'
import PaymentWall from '@/components/PaymentWall'
import { useAccount } from '@/auth/AuthProvider'
import { matchJd } from '@/data/resumeRepository'
import { makeEvalId, saveEvalRecord } from '@/data/evaluationHistory'
import type { JdMatch } from '@/types/resume'
import EvaluateReport from './EvaluateReport'
import EvaluateTabs from './EvaluateTabs'
import AccessNotice, { useResumeReady } from './EvaluateGate'
import styles from './Evaluate.module.css'

const MAX_JOBS = 6
const CONCURRENCY = 3
const BATCH_DRAFT_KEY = 'ai-job-agent:eval-batch-draft:v1'

const SAMPLE_JOBS: Array<{ company: string; title: string; jd: string }> = [
  {
    company: '某头部互联网公司',
    title: '数据分析师（校招）',
    jd: '岗位职责：1. 负责核心业务的日常经营分析，搭建并维护指标体系，监控业务异动并完成归因；2. 支持产品与运营的AB实验设计、样本量评估与显著性检验，输出决策建议；3. 通过SQL进行多表关联、窗口函数等复杂取数，产出专题分析报告；4. 协同业务方搭建BI看板，推动数据治理与口径统一。任职要求：1. 本科及以上学历，统计、数学、计算机、数据科学等相关专业，2027届毕业生优先；2. 熟练掌握SQL，熟悉Hive，具备Python数据处理能力；3. 熟悉假设检验、AB实验、回归分析等统计方法；4. 有互联网大厂数据分析实习经历者优先，有用户增长或经营分析经验者优先；5. 良好的业务敏感度与沟通表达能力。',
  },
  {
    company: '某连锁零售集团',
    title: '商业数据分析师（BI 方向）',
    jd: '岗位职责：1. 负责销售、门店与会员主题的常规报表体系建设，保障数据按时产出；2. 对接业务部门的取数与专题分析需求，输出经营周报与月报；3. 使用 Tableau / Power BI 搭建可视化看板并维护指标口径；4. 协助促销活动的效果复盘。任职要求：1. 本科及以上学历，专业不限，统计学、信息管理优先；2. 1-2 年以上数据分析或 BI 相关经验，优秀应届生亦可；3. 熟练使用 SQL 与 Excel（数据透视、函数），掌握至少一种主流 BI 工具；4. 具备良好的业务理解与跨部门沟通能力，工作细致；5. 能接受每月一次的周末值班出报表。',
  },
  {
    company: '某自动驾驶科技公司',
    title: '数据挖掘工程师（算法方向）',
    jd: '岗位职责：1. 负责大规模用户行为与车辆数据的挖掘、特征工程与预测建模；2. 设计并落地召回、排序相关算法并持续优化线上指标。任职要求：1. 硕士及以上学历，计算机、人工智能相关专业，3 年以上算法工作经验；2. 精通 Scala/Spark，有 TB 级分布式数据处理经验；3. 深入掌握深度学习、推荐系统或 NLP，在顶会/顶刊发表过论文者优先；4. 有 Kaggle 等数据竞赛国家级以上奖项优先；5. 工作地点北京，要求全职到岗，不接受实习转正。',
  },
]

interface BatchItem {
  id: number
  company: string
  title: string
  jd: string
  status: 'idle' | 'running' | 'done' | 'error' | 'skipped'
  match?: JdMatch
  generatedAt?: string
  error?: string
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '评估失败'
}

function levelText(level: JdMatch['level']): string {
  if (level === 'high') return '高匹配'
  if (level === 'medium') return '中匹配'
  return '低匹配'
}

function scoreToneClass(score: number): string {
  if (score >= 80) return styles.toneSuccess
  if (score >= 60) return styles.toneWarning
  return styles.toneDanger
}

let idSeed = 1

function createItem(seed?: { company: string; title: string; jd: string }): BatchItem {
  return {
    id: (idSeed += 1),
    company: seed?.company ?? '',
    title: seed?.title ?? '',
    jd: seed?.jd ?? '',
    status: 'idle',
  }
}

function loadDraftItems(): BatchItem[] {
  try {
    const raw = window.sessionStorage.getItem(BATCH_DRAFT_KEY)
    if (!raw) return [createItem(), createItem()]
    const parsed = JSON.parse(raw) as Array<{ company?: unknown; title?: unknown; jd?: unknown }>
    if (!Array.isArray(parsed) || parsed.length === 0) return [createItem(), createItem()]
    return parsed.slice(0, MAX_JOBS).map((row) =>
      createItem({
        company: typeof row.company === 'string' ? row.company : '',
        title: typeof row.title === 'string' ? row.title : '',
        jd: typeof row.jd === 'string' ? row.jd : '',
      }),
    )
  } catch {
    return [createItem(), createItem()]
  }
}

export default function BatchEvaluate() {
  const [items, setItems] = useState<BatchItem[]>(() => loadDraftItems())
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<number | null>(null)
  const [cancelledNote, setCancelledNote] = useState(false)
  const resumeReady = useResumeReady()
  const { loading: accountLoading, logged, paid, refresh: refreshAccount } = useAccount()
  const abortRef = useRef<AbortController | null>(null)
  const reportRef = useRef<HTMLDivElement | null>(null)

  // 录入内容随会话留存：切 Tab / 刷新后岗位与 JD 不丢（评估结果本身已入本地历史）
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        BATCH_DRAFT_KEY,
        JSON.stringify(items.map((it) => ({ company: it.company, title: it.title, jd: it.jd }))),
      )
    } catch {
      // sessionStorage 不可用时静默降级
    }
  }, [items])

  // 离开页面中止仍在跑的批量请求
  useEffect(() => () => abortRef.current?.abort(), [])

  // 下钻展开报告后平滑滚动定位
  useEffect(() => {
    if (selectedId == null) return
    const timer = window.setTimeout(() => {
      reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [selectedId])

  const patchItem = (id: number, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const updateField = (id: number, field: 'company' | 'title' | 'jd', value: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }

  const removeItem = (id: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.id !== id)))
  }

  const fillSamples = () => {
    const hasContent = items.some((it) => it.company.trim() || it.title.trim() || it.jd.trim())
    if (hasContent && !window.confirm('填入示例将覆盖当前录入的岗位列表，确定继续？')) return
    idSeed = 0
    setItems(SAMPLE_JOBS.map((s) => createItem(s)))
    setFormError(null)
    setFinished(false)
    setCancelledNote(false)
    setSelectedId(null)
  }

  const runAll = async () => {
    if (!resumeReady.ready) return
    if (items.some((it) => it.jd.trim().length < 30)) {
      setFormError('每个岗位都需要粘贴完整 JD（至少 30 字），请检查后再开始。')
      return
    }
    setFormError(null)
    setCancelledNote(false)
    const controller = new AbortController()
    abortRef.current = controller
    const snapshot = items.map((it) => ({ ...it }))
    setItems(snapshot.map((it) => ({ ...it, status: 'idle' as const, match: undefined, generatedAt: undefined, error: undefined })))
    setRunning(true)
    setFinished(false)
    setSelectedId(null)

    let cursor = 0
    let doneCount = 0
    const worker = async () => {
      while (cursor < snapshot.length) {
        if (controller.signal.aborted) break
        const item = snapshot[cursor]
        cursor += 1
        patchItem(item.id, { status: 'running' })
        try {
          const res = await matchJd(
            item.jd.trim(),
            {
              company: item.company.trim() || undefined,
              title: item.title.trim() || undefined,
            },
            controller.signal,
          )
          if (controller.signal.aborted) {
            patchItem(item.id, { status: 'skipped' })
            break
          }
          patchItem(item.id, { status: 'done', match: res.match, generatedAt: res.generated_at })
          // 每条完成立即落库：中途取消 / 关页也不丢已烧 token 得到的结果
          saveEvalRecord({
            company: item.company.trim() || undefined,
            title: item.title.trim() || undefined,
            jd: item.jd.trim(),
            match: res.match,
            source: 'batch',
          })
          doneCount += 1
        } catch (err) {
          if (controller.signal.aborted || isAbortError(err)) {
            patchItem(item.id, { status: 'skipped' })
          } else {
            patchItem(item.id, { status: 'error', error: errorText(err) })
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, snapshot.length) }, () => worker()))
    const aborted = controller.signal.aborted
    setRunning(false)
    setCancelledNote(aborted && doneCount > 0)
    // 取消时只要有已完成项也进入排名页保留结果；全未完成则回到录入态
    setFinished(doneCount > 0)
  }

  const cancelAll = () => {
    abortRef.current?.abort()
    setRunning(false)
  }

  // 失败项单条重跑：不重跑其他岗位，成功后即时入库并入排名
  const retryOne = async (id: number) => {
    if (!resumeReady.ready) return
    const target = items.find((it) => it.id === id)
    if (!target || target.jd.trim().length < 30) return
    const controller = new AbortController()
    abortRef.current = controller
    setRetryingId(id)
    patchItem(id, { status: 'running', error: undefined })
    try {
      const res = await matchJd(
        target.jd.trim(),
        { company: target.company.trim() || undefined, title: target.title.trim() || undefined },
        controller.signal,
      )
      patchItem(id, { status: 'done', match: res.match, generatedAt: res.generated_at })
      saveEvalRecord({
        company: target.company.trim() || undefined,
        title: target.title.trim() || undefined,
        jd: target.jd.trim(),
        match: res.match,
        source: 'batch',
      })
    } catch (err) {
      if (!isAbortError(err)) patchItem(id, { status: 'error', error: errorText(err) })
    } finally {
      setRetryingId(null)
    }
  }

  const backToEdit = () => {
    setFinished(false)
    setSelectedId(null)
    setItems((prev) => prev.map((it) => ({ ...it, status: 'idle', match: undefined, generatedAt: undefined, error: undefined })))
  }

  // 排名：分数降序，同分保持录入顺序（以稳定 id 做次序 tie-break，结果与 id 绑定）
  const ranked = items
    .filter((it) => it.match)
    .slice()
    .sort((a, b) => b.match!.score - a.match!.score || a.id - b.id)
  const failedItems = items.filter((it) => it.status === 'error')
  const doneCount = items.filter((it) => it.status === 'done').length
  const selected = items.find((it) => it.id === selectedId) ?? null

  if (!accountLoading && logged && !paid) {
    return <PaymentWall onAccessChanged={() => refreshAccount()} />
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>岗位评估</h1>
        <p className={styles.subtitle}>
          一次录入多个目标岗位，豆包并发评估后按匹配分生成排名短名单，帮你把有限的投递时间分配给最值得投的机会。
        </p>
        <EvaluateTabs />
      </header>

      {!finished ? (
        <SectionCard
          title="批量录入岗位"
          extra={
            <span className={styles.batchCount}>
              {items.length}/{MAX_JOBS}
            </span>
          }
        >
          {!resumeReady.ready && resumeReady.reason ? <AccessNotice /> : null}
          <div className={styles.batchList}>
            {items.map((item, index) => (
              <div key={item.id} className={styles.batchItem}>
                <div className={styles.batchItemHead}>
                  <span className={styles.batchItemIndex}>岗位 {index + 1}</span>
                  {!running && items.length > 1 ? (
                    <button type="button" className={styles.batchRemove} onClick={() => removeItem(item.id)}>
                      删除
                    </button>
                  ) : null}
                  {running ? (
                    <span className={styles.batchStatus}>
                      {item.status === 'running' && (
                        <>
                          <span className={styles.miniSpinner} />
                          评估中…
                        </>
                      )}
                      {item.status === 'done' && <span className={styles.statusDone}>✓ 完成</span>}
                      {item.status === 'error' && <span className={styles.statusFail}>失败</span>}
                      {(item.status === 'idle' || item.status === 'skipped') && '等待中'}
                    </span>
                  ) : null}
                </div>
                <div className={styles.inputRow}>
                  <input
                    className={styles.companyInput}
                    placeholder="公司名（可选）"
                    disabled={running}
                    value={item.company}
                    onChange={(e) => updateField(item.id, 'company', e.target.value)}
                  />
                  <input
                    className={styles.titleInput}
                    placeholder="岗位名（可选）"
                    disabled={running}
                    value={item.title}
                    onChange={(e) => updateField(item.id, 'title', e.target.value)}
                  />
                </div>
                <textarea
                  className={styles.jdInput}
                  rows={4}
                  disabled={running}
                  placeholder="粘贴该岗位完整 JD（至少 30 字）"
                  value={item.jd}
                  onChange={(e) => updateField(item.id, 'jd', e.target.value)}
                />
                {item.status === 'error' ? <div className={styles.errorBox}>{item.error}</div> : null}
              </div>
            ))}
          </div>

          {!running ? (
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void runAll()}
                disabled={items.length === 0}
              >
                并发生成排名（{CONCURRENCY} 路）
              </button>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setItems((prev) => (prev.length >= MAX_JOBS ? prev : [...prev, createItem()]))}
                disabled={items.length >= MAX_JOBS}
              >
                添加岗位
              </button>
              <button type="button" className={styles.ghostButton} onClick={fillSamples}>
                填入 3 个示例岗位
              </button>
            </div>
          ) : (
            <div className={styles.actionRow}>
              <span className={styles.batchProgress}>
                已完成 {doneCount}/{items.length}
              </span>
              <button type="button" className={styles.ghostButton} onClick={cancelAll}>
                取消评估
              </button>
            </div>
          )}
          {formError ? <div className={styles.errorBox}>{formError}</div> : null}
          <p className={styles.batchFootnote}>
            单次最多 {MAX_JOBS} 个岗位；每个岗位独立调用豆包，单条失败不影响其他结果。
          </p>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="匹配排名短名单"
            extra={<span className={styles.batchCount}>{ranked.length} 个可投岗位</span>}
          >
            <ul className={styles.rankList}>
              {ranked.map((item, index) => {
                const gates = item.match!.deal_breakers ?? []
                const passCount = gates.filter((g) => g.status === 'pass').length
                const failCount = gates.filter((g) => g.status === 'fail').length
                const active = selectedId === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`${styles.rankCard} ${active ? styles.rankCardActive : ''}`}
                      onClick={() => setSelectedId(active ? null : item.id)}
                    >
                      <span className={styles.rankNo}>#{index + 1}</span>
                      <span className={`${styles.rankScore} ${scoreToneClass(item.match!.score)}`}>
                        {item.match!.score}
                      </span>
                      <span className={styles.rankBody}>
                        <span className={styles.rankJob}>
                          {[item.company, item.title].filter(Boolean).join(' · ') || `岗位 ${index + 1}`}
                        </span>
                        <span className={styles.rankMeta}>
                          {levelText(item.match!.level)} · {item.match!.decision}
                          {gates.length > 0 ? ` · 硬门槛 ${passCount}✓${failCount > 0 ? ` ${failCount}✕` : ''}` : ''}
                        </span>
                      </span>
                      <span className={styles.rankChevron}>{active ? '收起' : '查看报告'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {cancelledNote ? (
              <p className={styles.batchFailNote}>
                评估已取消，已完成的 {ranked.length} 个结果已保留并自动存入本地评估历史；未评估的岗位可修改列表后重新发起。
              </p>
            ) : null}
            {failedItems.length > 0 ? (
              <div className={styles.failList}>
                <p className={styles.batchFailNote}>{failedItems.length} 个岗位评估失败，可单独重试：</p>
                <ul className={styles.rankList}>
                  {failedItems.map((it) => (
                    <li key={it.id} className={styles.failItem}>
                      <span className={styles.rankJob}>
                        {[it.company, it.title].filter(Boolean).join(' · ') || '未命名岗位'}
                      </span>
                      <span className={styles.failReason}>{it.error}</span>
                      <button
                        type="button"
                        className={styles.retryButton}
                        disabled={retryingId === it.id}
                        onClick={() => void retryOne(it.id)}
                      >
                        {retryingId === it.id ? '重试中…' : '重试该岗位'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className={styles.actionRow}>
              <button type="button" className={styles.primaryButton} onClick={() => void runAll()}>
                重新评估全部
              </button>
              <button type="button" className={styles.ghostButton} onClick={backToEdit}>
                修改岗位列表
              </button>
            </div>
          </SectionCard>

          {selected?.match ? (
            <div ref={reportRef}>
              <EvaluateReport
                match={selected.match}
                company={selected.company}
                title={selected.title}
                jd={selected.jd}
                generatedAt={selected.generatedAt ?? ''}
                recordId={makeEvalId(
                  selected.company.trim() || undefined,
                  selected.title.trim() || undefined,
                  selected.jd.trim(),
                )}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
