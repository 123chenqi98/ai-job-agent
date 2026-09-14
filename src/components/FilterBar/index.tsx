import {
  APPLICATION_STATUS_META,
  JOB_CATEGORY_META,
} from '@/constants'
import type { ApplicationStatus, JobCategory } from '@/types'
import styles from './FilterBar.module.css'

/** 岗位池筛选条件（关键词同时匹配公司 / 岗位 / 部门） */
export interface PoolFilters {
  keyword: string
  category: JobCategory | 'all'
  city: string // 'all' 或具体城市
  status: ApplicationStatus | 'all'
  minScore: number // 匹配分下限
}

export const defaultPoolFilters: PoolFilters = {
  keyword: '',
  category: 'all',
  city: 'all',
  status: 'all',
  minScore: 0,
}

const SCORE_OPTIONS = [
  { value: 0, label: '全部匹配分' },
  { value: 85, label: '85 分及以上（优先投递）' },
  { value: 70, label: '70 分及以上（值得改投）' },
  { value: 55, label: '55 分及以上' },
]

interface FilterBarProps {
  value: PoolFilters
  cities: string[]
  resultCount: number
  onChange: (next: PoolFilters) => void
  onReset: () => void
}

export default function FilterBar({
  value,
  cities,
  resultCount,
  onChange,
  onReset,
}: FilterBarProps) {
  const patch = (partial: Partial<PoolFilters>) =>
    onChange({ ...value, ...partial })

  return (
    <div className={styles.bar}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="filter-keyword">
          关键词
        </label>
        <input
          id="filter-keyword"
          className={styles.input}
          type="text"
          placeholder="公司 / 岗位 / 部门"
          value={value.keyword}
          onChange={(e) => patch({ keyword: e.target.value })}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="filter-category">
          岗位方向
        </label>
        <select
          id="filter-category"
          className={styles.select}
          value={value.category}
          onChange={(e) =>
            patch({ category: e.target.value as JobCategory | 'all' })
          }
        >
          <option value="all">全部方向</option>
          {Object.entries(JOB_CATEGORY_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="filter-city">
          城市
        </label>
        <select
          id="filter-city"
          className={styles.select}
          value={value.city}
          onChange={(e) => patch({ city: e.target.value })}
        >
          <option value="all">全部城市</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="filter-status">
          投递状态
        </label>
        <select
          id="filter-status"
          className={styles.select}
          value={value.status}
          onChange={(e) =>
            patch({ status: e.target.value as ApplicationStatus | 'all' })
          }
        >
          <option value="all">全部状态</option>
          {Object.entries(APPLICATION_STATUS_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="filter-score">
          匹配分
        </label>
        <select
          id="filter-score"
          className={styles.select}
          value={value.minScore}
          onChange={(e) => patch({ minScore: Number(e.target.value) })}
        >
          {SCORE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.footer}>
        <span className={styles.count}>命中 {resultCount} 个岗位</span>
        <button type="button" className={styles.reset} onClick={onReset}>
          重置筛选
        </button>
      </div>
    </div>
  )
}
