import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getFeishuBoard, getFeishuJobs, getFeishuJobsMeta } from '@/data/feishuRepository'
import type {
  FeishuBoardResponse,
  FeishuJobItem,
  FeishuJobQuery,
  FeishuJobsMeta,
  FeishuJobsResponse,
} from '@/types/feishu'

// 工作台级数据缓存：Provider 挂在常驻 Layout 上，切换侧栏导航时页面卸载但缓存不丢，
// 因此筛选条件、已加载列表、看板数据都能保留；数据只在首次进入与手动「刷新同步」时请求。

export interface JobFilter {
  keyword: string
  target: string
  degree: string
  city: string
}

// 岗位池首次进入的默认口径：优先展示 27 届目标岗位，而不是全量 6731 条
export const DEFAULT_JOB_FILTER: JobFilter = {
  keyword: '',
  target: '27届',
  degree: '',
  city: '',
}

type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error'

interface JobsStore {
  bootstrapStatus: AsyncStatus
  bootstrapError: string | null
  meta: FeishuJobsMeta | null
  items: FeishuJobItem[]
  total: number
  hasMore: boolean
  filter: JobFilter
  keywordInput: string
  cityInput: string
  searching: boolean
  loadingMore: boolean
  listError: string | null
  syncedAt: Date | null
  ensureBootstrap: () => void
  bootstrap: () => Promise<void>
  searchJobs: (next: JobFilter) => Promise<void>
  loadMoreJobs: () => Promise<void>
  resetFilters: () => void
  setKeywordInput: (value: string) => void
  setCityInput: (value: string) => void
}

interface BoardStore {
  status: AsyncStatus
  error: string | null
  data: FeishuBoardResponse | null
  refreshing: boolean
  refreshError: string | null
  ensureLoaded: () => void
  refresh: () => Promise<void>
}

function toQuery(filter: JobFilter, pageToken?: string): FeishuJobQuery {
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

const JobsContext = createContext<JobsStore | null>(null)
const BoardContext = createContext<BoardStore | null>(null)

export function WorkbenchDataProvider({ children }: { children: ReactNode }) {
  // ---- 岗位池切片 ----
  const [bootstrapStatus, setBootstrapStatus] = useState<AsyncStatus>('idle')
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [meta, setMeta] = useState<FeishuJobsMeta | null>(null)
  const [items, setItems] = useState<FeishuJobItem[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState<JobFilter>(DEFAULT_JOB_FILTER)
  const [keywordInput, setKeywordInput] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)

  const listAbortRef = useRef<AbortController | null>(null)
  const bootingRef = useRef(false)
  const bootedRef = useRef(false)
  const searchingRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const filterRef = useRef<JobFilter>(DEFAULT_JOB_FILTER)
  const pageTokenRef = useRef('')
  const hasMoreRef = useRef(false)

  const applyPage = useCallback((page: FeishuJobsResponse, append: boolean) => {
    setItems((prev) => {
      if (!append) return page.items
      const seen = new Set(prev.map((i) => i.record_id))
      return [...prev, ...page.items.filter((i) => !seen.has(i.record_id))]
    })
    setTotal(page.total)
    setHasMore(page.has_more)
    setSyncedAt(new Date())
    pageTokenRef.current = page.page_token ?? ''
    hasMoreRef.current = page.has_more
  }, [])

  const bootstrap = useCallback(async () => {
    if (bootingRef.current) return
    bootingRef.current = true
    listAbortRef.current?.abort()
    const controller = new AbortController()
    listAbortRef.current = controller
    setBootstrapStatus('loading')
    setBootstrapError(null)
    setListError(null)
    try {
      const [metaRes, page] = await Promise.all([
        getFeishuJobsMeta(controller.signal),
        getFeishuJobs(toQuery(DEFAULT_JOB_FILTER), controller.signal),
      ])
      setMeta(metaRes)
      applyPage(page, false)
      filterRef.current = DEFAULT_JOB_FILTER
      setFilter(DEFAULT_JOB_FILTER)
      setKeywordInput('')
      setCityInput('')
      bootedRef.current = true
      setBootstrapStatus('ready')
    } catch (err) {
      if (isAbortError(err)) return
      setBootstrapError(errorMessage(err))
      setBootstrapStatus('error')
    } finally {
      bootingRef.current = false
    }
  }, [applyPage])

  const ensureBootstrap = useCallback(() => {
    if (bootedRef.current || bootingRef.current) return
    void bootstrap()
  }, [bootstrap])

  const searchJobs = useCallback(
    async (next: JobFilter) => {
      listAbortRef.current?.abort()
      const controller = new AbortController()
      listAbortRef.current = controller
      searchingRef.current = true
      setSearching(true)
      setListError(null)
      try {
        const page = await getFeishuJobs(toQuery(next), controller.signal)
        applyPage(page, false)
        filterRef.current = next
        setFilter(next)
        getFeishuJobsMeta()
          .then(setMeta)
          .catch(() => undefined)
      } catch (err) {
        if (isAbortError(err)) return
        setListError(errorMessage(err))
      } finally {
        if (listAbortRef.current === controller) {
          searchingRef.current = false
          setSearching(false)
        }
      }
    },
    [applyPage],
  )

  const loadMoreJobs = useCallback(async () => {
    if (!hasMoreRef.current || !pageTokenRef.current) return
    if (searchingRef.current || loadingMoreRef.current) return
    const controller = new AbortController()
    listAbortRef.current = controller
    loadingMoreRef.current = true
    setLoadingMore(true)
    setListError(null)
    try {
      const page = await getFeishuJobs(
        toQuery(filterRef.current, pageTokenRef.current),
        controller.signal,
      )
      applyPage(page, true)
    } catch (err) {
      if (isAbortError(err)) return
      setListError(errorMessage(err))
    } finally {
      if (listAbortRef.current === controller) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }, [applyPage])

  const resetFilters = useCallback(() => {
    setKeywordInput('')
    setCityInput('')
    void searchJobs(DEFAULT_JOB_FILTER)
  }, [searchJobs])

  const jobsStore = useMemo<JobsStore>(
    () => ({
      bootstrapStatus,
      bootstrapError,
      meta,
      items,
      total,
      hasMore,
      filter,
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
    }),
    [
      bootstrapStatus,
      bootstrapError,
      meta,
      items,
      total,
      hasMore,
      filter,
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
    ],
  )

  // ---- 投递看板切片 ----
  const [boardStatus, setBoardStatus] = useState<AsyncStatus>('idle')
  const [boardError, setBoardError] = useState<string | null>(null)
  const [boardData, setBoardData] = useState<FeishuBoardResponse | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const boardAbortRef = useRef<AbortController | null>(null)
  const boardLoadingRef = useRef(false)
  const boardLoadedRef = useRef(false)

  const ensureLoaded = useCallback(() => {
    if (boardLoadedRef.current || boardLoadingRef.current) return
    boardLoadingRef.current = true
    boardAbortRef.current?.abort()
    const controller = new AbortController()
    boardAbortRef.current = controller
    setBoardStatus('loading')
    setBoardError(null)
    getFeishuBoard(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setBoardData(response)
        setBoardStatus('ready')
        boardLoadedRef.current = true
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setBoardError(errorMessage(err))
        setBoardStatus('error')
      })
      .finally(() => {
        boardLoadingRef.current = false
      })
  }, [])

  const refresh = useCallback(async () => {
    const controller = new AbortController()
    boardAbortRef.current = controller
    setRefreshing(true)
    setRefreshError(null)
    try {
      const response = await getFeishuBoard(controller.signal)
      setBoardData(response)
      boardLoadedRef.current = true
      setBoardStatus('ready')
      setBoardError(null)
    } catch (err) {
      if (isAbortError(err)) return
      setRefreshError(errorMessage(err))
    } finally {
      setRefreshing(false)
    }
  }, [])

  const boardStore = useMemo<BoardStore>(
    () => ({
      status: boardStatus,
      error: boardError,
      data: boardData,
      refreshing,
      refreshError,
      ensureLoaded,
      refresh,
    }),
    [boardStatus, boardError, boardData, refreshing, refreshError, ensureLoaded, refresh],
  )

  return (
    <JobsContext.Provider value={jobsStore}>
      <BoardContext.Provider value={boardStore}>{children}</BoardContext.Provider>
    </JobsContext.Provider>
  )
}

export function useJobsStore(): JobsStore {
  const ctx = useContext(JobsContext)
  if (!ctx) throw new Error('useJobsStore 必须在 WorkbenchDataProvider 内使用')
  return ctx
}

export function useBoardStore(): BoardStore {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoardStore 必须在 WorkbenchDataProvider 内使用')
  return ctx
}
