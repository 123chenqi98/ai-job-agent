import type { ReactNode } from 'react'
import styles from './SectionCard.module.css'

interface SectionCardProps {
  title?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

// 通用卡片容器：可选标题与右上角操作区，统一工作台卡片样式
export default function SectionCard({
  title,
  extra,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section className={`${styles.card} ${className ?? ''}`}>
      {title || extra ? (
        <header className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : null}
          {extra ? <div className={styles.extra}>{extra}</div> : null}
        </header>
      ) : null}
      <div className={`${styles.body} ${bodyClassName ?? ''}`}>{children}</div>
    </section>
  )
}
