import type { ReactNode } from 'react'
import styles from './StateView.module.css'

interface StateViewProps {
  title: string
  description: ReactNode
  /** 操作区，通常为一个或多个返回 / 导航链接 */
  actions?: ReactNode
}

/**
 * 统一的回退 / 空状态视图：居中卡片。
 * 用于 404、资源不存在、数据尚未生成等需要明确提示并给出恢复入口的场景。
 */
export default function StateView({ title, description, actions }: StateViewProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.icon} aria-hidden>
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
          <path d="M8.8 11h4.4M11 8.8v4.4" />
        </svg>
      </span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  )
}
