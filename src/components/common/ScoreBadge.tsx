import styles from './ScoreBadge.module.css'
import type { TagTone } from './Tag'

interface ScoreBadgeProps {
  score: number
  tone?: Exclude<TagTone, 'primary' | 'neutral'>
  /** 分数下方的小字说明，如「高推荐」 */
  caption?: string
}

const toneClass = {
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
} as const

// 匹配分徽章：圆形数字 + 可选等级说明，颜色由调用方按 match_level 传入
export default function ScoreBadge({
  score,
  tone = 'warning',
  caption,
}: ScoreBadgeProps) {
  return (
    <div className={`${styles.badge} ${toneClass[tone]}`}>
      <span className={styles.score}>{score}</span>
      {caption ? <span className={styles.caption}>{caption}</span> : null}
    </div>
  )
}
