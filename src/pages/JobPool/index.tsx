import { useCallback, useEffect, useRef, useState } from 'react'
import SectionCard from '@/components/common/SectionCard'
import StateView from '@/components/common/StateView'
import FeishuJobTable from '@/components/FeishuJobTable'
import { getFeishuJobs, getFeishuJobsMeta } from '@/data/feishuRepository'
import type {
  FeishuJobItem,
  FeishuJobQuery,
  FeishuJobsMeta,
  FeishuJobsResponse,
} from '@/types/feishu'
import styles from './JobPool.module.css'

interface SearchFilter {
  keyword: string
  target: string
  degree: string
  city: string
}

const EMPTY_FILTER: SearchFilter = { keyword: '', target: '', degree: '', city: '' }

const ONBOARD_KEY = 'ai-job-agent:onboard-dismissed:v1'

const ONBOARD_STEPS = [
  {
    title: '筛选岗位',
    desc: '按公司 / 岗位关键词、届别、学历、城市过滤飞书总表，服务端分页，每次 20 条。',
  },
  {
    title: 'AI 评估',
    desc: '点行内「评估」带入公司与岗位名，粘贴完整 JD 后由豆包对照本机简历出投递报告。',
  },
  {
    title: '面试准备',
    desc: '报告内含硬门槛核对、四维评分、命中证据与缺口，还可一键生成面试题与答题要点。',
  },
  {
    title: '看板追踪',
    desc: '投递进展在「投递看板」按状态跟踪；评估过的岗位会在卡片上显示匹配分与报告入口。',
  },
]

function formatSyncTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function toQuery(filter: SearchFilter, pageToken?: string): FeishuJobQuery {
  return {
    keyword: filter.keyword || undefined,
    target: filter.target || undefined,
    degree: filter.degree || undefined,
    city: filter.city || undefined,
    pageToken,
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '读取飞书数据失败，请稍后重试。'
}

export default function JobPool() {
  const [meta, setMeta] = useState<FeishuJobsMeta | null>(null)
  const [items, setItems] = useState<FeishuJobItem[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextToken, setNextToken] = useState('')
  const [activeFilter, setActiveFilter] = useState<SearchFilter>(EMPTY_FILTER)
  const [keywordInput, setKeywordInput] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)
  const [onboardVisible, setOnboardVisible] = useState(() => {
    try {
      return window.localStorage.getItem(ONBOARD_KEY) !== '1'
    } catch {
      return true
    }
  })

  const dismissOnboard = () => {
    setOnboardVisible(false)
    try {
      window.localStorage.setItem(ONBOARD_KEY, '1')
    } catch {
      // 隐私模式静默降级：仅本次会话隐藏
    }
  }

  // 列表请求共用一个中断器：发起新查询时取消上一个在途请求（含 StrictMode 双挂载）
  const listAbortRef = useRef<AbortController | null>(null)

  const applyPage = useCallback((page: FeishuJobsResponse, append: boolean) => {
    setItems((prev) => {
      if (!append) return page.items
      const seen = new Set(prev.map((i) => i.record_id))
      return [...prev, ...page.items.filter((i) => !seen.has(i.record_id))]
    })
    setTotal(page.total)
    setHasMore(page.has_more)
    setNextToken(page.page_token ?? '')
    setSyncedAt(new Date())
  }, [])

  // 首屏（及失败重试 / 手动刷新）：元信息与首页数据并行拉取
  const bootstrap = useCallback(async () => {
    listAbortRef.current?.abort()
    const controller = new AbortController()
    listAbortRef.current = controller
    setLoading(true)
    setError(null)
    setListError(null)
    try {
      const [metaRes, page] = await Promise.all([
        getFeishuJobsMeta(controller.signal),
        getFeishuJobs({}, controller.signal),
      ])
      setMeta(metaRes)
      applyPage(page, false)
      setActiveFilter(EMPTY_FILTER)
      setKeywordInput('')
      setCityInput('')
    } catch (err) {
      if (isAbortError(err)) return
      setError(errorMessage(err))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [applyPage])

  useEffect(() => {
    void bootstrap()
    return () => listAbortRef.current?.abort()
  }, [bootstrap])

  // 筛选 / 刷新：回到第一页并替换列表
  const runSearch = useCallback(
    async (next: SearchFilter) => {
      listAbortRef.current?.abort()
      const controller = new AbortController()
      listAbortRef.current = controller
      setSearching(true)
      setLoadingMore(false)
      setListError(null)
      try {
        const page = await getFeishuJobs(toQuery(next), controller.signal)
        applyPage(page, false)
        setActiveFilter(next)
        getFeishuJobsMeta()
          .then(setMeta)
          .catch(() => undefined)
      } catch (err) {
        if (isAbortError(err)) return
        setListError(errorMessage(err))
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    },
    [applyPage],
  )

  // 下拉框变化即时查询，关键词 / 城市以输入框当前值为准
  const searchFromControls = (patch: Partial<SearchFilter>) => {
    void runSearch({
      keyword: keywordInput.trim(),
      city: cityInput.trim(),
      target: activeFilter.target,
      degree: activeFilter.degree,
      ...patch,
    })
  }

  const resetFilters = () => {
    setKeywordInput('')
    setCityInput('')
    void runSearch(EMPTY_FILTER)
  }

  // 加载更多：沿当前筛选条件追加下一页
  const loadMore = async () => {
    if (!hasMore || !nextToken || loadingMore || searching) return
    const controller = new AbortController()
    listAbortRef.current = controller
    setLoadingMore(true)
    setListError(null)
    try {
      const page = await getFeishuJobs(toQuery(activeFilter, nextToken), controller.signal)
      applyPage(page, true)
    } catch (err) {
      if (isAbortError(err)) return
      setListError(errorMessage(err))
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false)
    }
  }

  const statCards = meta
    ? [
        {
          key: 'all',
          label: '在招岗位总数',
          value: meta.totals.all,
          hint: '飞书总表全量口径，含校招与日常实习',
          tone: styles.tonePrimary,
        },
        {
          key: 'target27',
          label: '27 届岗位',
          value: meta.totals.target27,
          hint: '招聘对象为「27届」的岗位',
          tone: styles.toneSuccess,
        },
        {
          key: 'bachelor',
          label: '本科起可投',
          value: meta.totals.bachelor,
          hint: '学历要求为「本科起」的岗位',
          tone: styles.toneWarning,
        },
      ]
    : []

  const hasActiveFilter =
    activeFilter.keyword !== '' ||
    activeFilter.target !== '' ||
    activeFilter.degree !== '' ||
    activeFilter.city !== ''
  const remaining = Math.max(total - items.length, 0)

  if (loading) {
    return (
      <div className={styles.page}>
        <StateView
          title="正在同步飞书岗位数据…"
          description="正在通过本地只读服务读取 27 届实习 & 校招总表，请稍候。"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <StateView
          title="飞书岗位数据同步失败"
          description={
            <>
              {error}
              <br />
              排查顺序：① 本地只读服务已启动（npm run dev:all）；②
              应用已加为该多维表协作者；③ 最新版本（含只读权限）已发布。
            </>
          }
          actions={
            <button type="button" className={styles.retryButton} onClick={() => void bootstrap()}>
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
          <h1 className={styles.title}>岗位池</h1>
          <p className={styles.subtitle}>
            只读浏览飞书《{meta?.source ?? '27届实习&校招总表'}
            》：按公司、岗位、届别、学历与城市筛选网申信息，点击「投递」在新标签打开官方页面。
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshButton}
            disabled={searching || loadingMore}
            onClick={() => void runSearch(activeFilter)}
          >
            刷新同步
          </button>
          {syncedAt ? (
            <span className={styles.syncMeta}>最近同步：{formatSyncTime(syncedAt)}</span>
          ) : null}
        </div>
      </header>

      {onboardVisible ? (
        <section className={styles.onboard}>
          <div className={styles.onboardHead}>
            <div>
              <h2 className={styles.onboardTitle}>第一次使用？四步走完整条求职动线</h2>
              <p className={styles.onboardSub}>
                飞书数据只读不回写；AI 只在你主动点击时触发；评估历史与草稿仅保存在本机浏览器。
              </p>
            </div>
            <button type="button" className={styles.onboardClose} onClick={dismissOnboard}>
              知道了，收起 ×
            </button>
          </div>
          <ol className={styles.onboardSteps}>
            {ONBOARD_STEPS.map((step, idx) => (
              <li key={step.title} className={styles.onboardStep}>
                <span className={styles.onboardStepNo}>{idx + 1}</span>
                <span className={styles.onboardStepText}>
                  <span className={styles.onboardStepTitle}>{step.title}</span>
                  <span className={styles.onboardStepDesc}>{step.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className={styles.statsGrid}>
        {statCards.map((card) => (
          <div key={card.key} className={styles.statCard}>
            <span className={styles.statLabel}>{card.label}</span>
            <span className={`${styles.statValue} ${card.tone}`}>{card.value}</span>
            <span className={styles.statHint}>{card.hint}</span>
          </div>
        ))}
      </div>

      <SectionCard>
        <form
          className={styles.filterRow}
          onSubmit={(e) => {
            e.preventDefault()
            searchFromControls({})
          }}
        >
          <input
            className={styles.filterInput}
            placeholder="搜索公司名 / 岗位名，如：数据分析"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
          />
          <input
            className={`${styles.filterInput} ${styles.cityInput}`}
            placeholder="城市，如：北京"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={activeFilter.target}
            onChange={(e) => searchFromControls({ target: e.target.value })}
          >
            <option value="">全部届别</option>
            {meta?.filters.target.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={activeFilter.degree}
            onChange={(e) => searchFromControls({ degree: e.target.value })}
          >
            <option value="">全部学历</option>
            {meta?.filters.degree.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <button type="submit" className={styles.searchButton} disabled={searching}>
            查询
          </button>
          <button
            type="button"
            className={styles.resetButton}
            disabled={searching || !hasActiveFilter}
            onClick={resetFilters}
          >
            重置
          </button>
        </form>
        <p className={styles.filterHint}>
          关键词同时匹配「公司名称」与「招聘岗位」；城市按飞书「工作地点」选项精确匹配；筛选与排序（按网申更新倒序）均在飞书服务端执行。
        </p>
      </SectionCard>

      {listError ? (
        <div className={styles.errorBanner}>
          <span>{listError}</span>
          <button
            type="button"
            className={styles.bannerRetry}
            onClick={() => void runSearch(activeFilter)}
          >
            重试本次查询
          </button>
        </div>
      ) : null}

      {items.length === 0 && !listError ? (
        <StateView
          title="没有符合条件的岗位"
          description="尝试减少关键词或放宽届别、学历、城市筛选条件；岗位数据以飞书总表为准。"
          actions={
            hasActiveFilter ? (
              <button type="button" className={styles.retryButton} onClick={resetFilters}>
                清除全部筛选
              </button>
            ) : undefined
          }
        />
      ) : (
        <SectionCard
          title="岗位列表"
          bodyClassName={styles.tableBody}
          extra={
            <span className={styles.resultMeta}>
              {searching ? '查询中…' : `共 ${total} 个，已展示 ${items.length} 个`}
            </span>
          }
        >
          <FeishuJobTable items={items} />
        </SectionCard>
      )}

      {hasMore && items.length > 0 ? (
        <div className={styles.loadMoreWrap}>
          <button
            type="button"
            className={styles.loadMoreButton}
            disabled={loadingMore || searching}
            onClick={() => void loadMore()}
          >
            {loadingMore ? '加载中…' : `加载更多（还有 ${remaining} 个）`}
          </button>
        </div>
      ) : null}

      <p className={styles.note}>
        数据来源：飞书多维表格《{meta?.source ?? '27届实习&校招总表'}
        》，经本地只读服务单向读取，工作台不向飞书写入任何内容；列表按「网申更新」倒序、每页 20
        条。「投递 / 公告」为飞书表中登记的外部链接，将在新标签打开官方页面，工作台不代填表单、不执行自动投递；投递状态与进展请在「投递看板」查看。
      </p>
    </div>
  )
}
