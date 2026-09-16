import { useEffect, useRef, useState } from 'react'
import SectionCard from '@/components/common/SectionCard'
import StateView from '@/components/common/StateView'
import FeishuJobTable from '@/components/FeishuJobTable'
import { DEFAULT_JOB_FILTER, useJobsStore, type JobFilter } from '@/state/WorkbenchStore'
import styles from './JobPool.module.css'

const ONBOARD_KEY = 'ai-job-agent:onboard-dismissed:v1'

// 一键过滤：方向写入关键词（匹配公司名/岗位名），城市写入城市精确匹配
const DIRECTION_CHIPS = ['数据分析', '商业分析', '数据运营', '产品经理', '运营', '算法']
const CITY_CHIPS = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉']

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

export default function JobPool() {
  const {
    bootstrapStatus,
    bootstrapError,
    meta,
    items,
    total,
    hasMore,
    filter: activeFilter,
    keywordInput,
    cityInput,
    searching,
    loadingMore,
    listError,
    syncedAt,
    ensureBootstrap,
    bootstrap,
    searchJobs,
    loadMoreJobs,
    resetFilters,
    setKeywordInput,
    setCityInput,
  } = useJobsStore()

  // 仅在本会话首次进入岗位池时拉取；之后切换导航回来直接展示缓存，筛选与列表原样保留
  useEffect(() => {
    ensureBootstrap()
  }, [ensureBootstrap])

  // 无限滚动：底部哨兵进入视口（提前 320px）即自动拉下一页，无需手动点「加载更多」
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore && !searching) {
          void loadMoreJobs()
        }
      },
      { rootMargin: '320px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, searching, items.length, loadMoreJobs])

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

  // 下拉框变化即时查询，关键词 / 城市以输入框当前值为准
  const searchFromControls = (patch: Partial<JobFilter>) => {
    void searchJobs({
      keyword: keywordInput.trim(),
      city: cityInput.trim(),
      target: activeFilter.target,
      degree: activeFilter.degree,
      ...patch,
    })
  }

  // 快捷 chips：点方向 / 城市即替换对应维度并立即查询，其余维度保持不变
  const applyChip = (patch: { keyword?: string; city?: string }) => {
    const next: JobFilter = { ...activeFilter, ...patch }
    if (patch.keyword !== undefined) setKeywordInput(patch.keyword)
    if (patch.city !== undefined) setCityInput(patch.city)
    void searchJobs(next)
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
          hint: '招聘对象为「27届」的岗位，也是当前默认口径',
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
    activeFilter.keyword !== DEFAULT_JOB_FILTER.keyword ||
    activeFilter.target !== DEFAULT_JOB_FILTER.target ||
    activeFilter.degree !== DEFAULT_JOB_FILTER.degree ||
    activeFilter.city !== DEFAULT_JOB_FILTER.city
  const remaining = Math.max(total - items.length, 0)
  const loading = bootstrapStatus === 'loading'
  const error = bootstrapStatus === 'error' ? bootstrapError : null

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
            》：默认展示 27 届岗位，可按公司、岗位、学历与城市筛选；点「立即投递」在新标签打开官方网申页。
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshButton}
            disabled={searching || loadingMore}
            onClick={() => void searchJobs(activeFilter)}
          >
            {searching ? '同步中…' : '刷新同步'}
          </button>
          {syncedAt ? (
            <span className={styles.syncMeta}>缓存数据 · 最近同步：{formatSyncTime(syncedAt)}</span>
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
        <div className={styles.chipPanel}>
          <div className={styles.chipRow}>
            <span className={styles.chipLabel}>方向</span>
            <div className={styles.chips}>
              <button
                type="button"
                className={
                  activeFilter.keyword === ''
                    ? `${styles.chip} ${styles.chipActive}`
                    : styles.chip
                }
                onClick={() => applyChip({ keyword: '' })}
              >
                全部
              </button>
              {DIRECTION_CHIPS.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className={
                    activeFilter.keyword === kw
                      ? `${styles.chip} ${styles.chipActive}`
                      : styles.chip
                  }
                  onClick={() => applyChip({ keyword: kw })}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.chipRow}>
            <span className={styles.chipLabel}>城市</span>
            <div className={styles.chips}>
              <button
                type="button"
                className={
                  activeFilter.city === ''
                    ? `${styles.chip} ${styles.chipActive}`
                    : styles.chip
                }
                onClick={() => applyChip({ city: '' })}
              >
                全部
              </button>
              {CITY_CHIPS.map((city) => (
                <button
                  key={city}
                  type="button"
                  className={
                    activeFilter.city === city
                      ? `${styles.chip} ${styles.chipActive}`
                      : styles.chip
                  }
                  onClick={() => applyChip({ city })}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
        </div>
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
          关键词同时匹配「公司名称」与「招聘岗位」；城市按飞书「工作地点」选项精确匹配；筛选与排序（按网申更新倒序）均在飞书服务端执行。切换导航不会清空筛选，仅点「刷新同步」才重新拉取。
        </p>
      </SectionCard>

      {listError ? (
        <div className={styles.errorBanner}>
          <span>{listError}</span>
          <button
            type="button"
            className={styles.bannerRetry}
            onClick={() => void searchJobs(activeFilter)}
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
                恢复默认（27 届）
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

      {items.length > 0 ? (
        <div className={styles.loadMoreWrap}>
          <div ref={sentinelRef} className={styles.scrollSentinel} aria-hidden="true" />
          {loadingMore ? (
            <span className={styles.loadState}>
              <span className={styles.miniSpinner} aria-hidden="true" />
              正在加载更多岗位…
            </span>
          ) : hasMore ? (
            <span className={styles.loadHint}>向下滚动自动加载（还有 {remaining} 个）</span>
          ) : (
            <span className={styles.loadDone}>已加载全部 {total} 个岗位</span>
          )}
        </div>
      ) : null}

      <p className={styles.note}>
        数据来源：飞书多维表格《{meta?.source ?? '27届实习&校招总表'}
        》，经本地只读服务单向读取，工作台不向飞书写入任何内容；列表按「网申更新」倒序、每页 20
        条。「立即投递 / 公告」为飞书表中登记的外部链接，将在新标签打开官方页面，工作台不代填表单、不执行自动投递；投递状态与进展请在「投递看板」查看。
      </p>
    </div>
  )
}
