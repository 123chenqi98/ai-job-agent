import { RISK_LEVEL_META, RISK_TYPE_META } from '@/constants'
import type { RiskFlag, RiskLevel } from '@/types'
import Tag, { type TagTone } from '@/components/common/Tag'
import styles from './RiskTagList.module.css'

interface RiskTagListProps {
  risks: RiskFlag[]
}

const LEVEL_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 }

const LEVEL_TONE: Record<RiskLevel, TagTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
}

const LEVEL_BAR_CLASS: Record<RiskLevel, string> = {
  high: styles.barHigh,
  medium: styles.barMid,
  low: styles.barLow,
}

// 结构化风险列表：按高 / 中 / 低排序，空列表给明确的「无风险」结论
export default function RiskTagList({ risks }: RiskTagListProps) {
  if (risks.length === 0) {
    return (
      <div className={styles.safe}>
        <span className={styles.safeDot} />
        未识别到明显硬门槛或关键风险，可按正常流程推进。
      </div>
    )
  }

  const sorted = [...risks].sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
  )

  return (
    <ul className={styles.list}>
      {sorted.map((risk, idx) => (
        <li
          key={`${risk.type}-${idx}`}
          className={`${styles.item} ${LEVEL_BAR_CLASS[risk.level]}`}
        >
          <div className={styles.itemHead}>
            <span className={styles.riskLabel}>{risk.label}</span>
            <Tag tone={LEVEL_TONE[risk.level]}>
              {RISK_LEVEL_META[risk.level].label}风险
            </Tag>
          </div>
          <p className={styles.meta}>
            {RISK_TYPE_META[risk.type].label}
          </p>
          {risk.description ? (
            <p className={styles.description}>{risk.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
