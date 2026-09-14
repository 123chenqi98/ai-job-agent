import { Link } from 'react-router-dom'
import { DECISION_META } from '@/constants'
import type { Decision } from '@/types'
import Tag from '@/components/common/Tag'
import styles from './ActionRecommendationCard.module.css'

interface ActionRecommendationCardProps {
  decision: Decision
  decisionReason: string
  strengths: string[]
  improvements: string[]
  jobId: string
  hasSuggestion: boolean
}

// 4 类候选动作，当前决策高亮，其余置灰
const DECISION_ORDER: Decision[] = [
  'apply_now',
  'revise_then_apply',
  'wait',
  'drop',
]

export default function ActionRecommendationCard({
  decision,
  decisionReason,
  strengths,
  improvements,
  jobId,
  hasSuggestion,
}: ActionRecommendationCardProps) {
  const meta = DECISION_META[decision]

  return (
    <div className={styles.wrapper}>
      <div className={styles.stepRow}>
        {DECISION_ORDER.map((d) => {
          const active = d === decision
          return (
            <div
              key={d}
              className={`${styles.step} ${active ? styles.stepActive : ''}`}
            >
              {DECISION_META[d].label}
            </div>
          )
        })}
      </div>

      <div className={styles.decisionLine}>
        <Tag tone={meta.tone}>当前建议：{meta.label}</Tag>
      </div>
      <p className={styles.reason}>{decisionReason}</p>

      <div className={styles.block}>
        <h4 className={styles.blockTitle}>优势点</h4>
        <ul className={styles.list}>
          {strengths.map((s, idx) => (
            <li key={idx} className={styles.strengthItem}>
              {s}
            </li>
          ))}
        </ul>
      </div>

      {improvements.length > 0 ? (
        <div className={styles.block}>
          <h4 className={styles.blockTitle}>改进 / 准备建议</h4>
          <ul className={styles.list}>
            {improvements.map((s, idx) => (
              <li key={idx} className={styles.improveItem}>
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.actions}>
        {hasSuggestion ? (
          <Link
            to={`/jobs/${jobId}/resume`}
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            查看岗位简历建议
          </Link>
        ) : (
          <button
            type="button"
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled
            title="原型当前仅为 job-001 内置了简历建议数据"
          >
            暂无简历建议数据
          </button>
        )}
        <Link to="/board" className={`${styles.button} ${styles.buttonGhost}`}>
          前往投递看板
        </Link>
      </div>
    </div>
  )
}
