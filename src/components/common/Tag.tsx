import type { ReactNode } from 'react'
import styles from './Tag.module.css'

export type TagTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

interface TagProps {
  tone?: TagTone
  children: ReactNode
}

const toneClass: Record<TagTone, string> = {
  neutral: styles.neutral,
  primary: styles.primary,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
}

// 通用语义色标签，文案由调用方通过展示口径常量提供
export default function Tag({ tone = 'neutral', children }: TagProps) {
  return (
    <span className={`${styles.tag} ${toneClass[tone]}`}>{children}</span>
  )
}
