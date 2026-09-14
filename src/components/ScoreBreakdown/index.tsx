import type { ScoreComponent } from '@/types'
import styles from './ScoreBreakdown.module.css'

interface ScoreBreakdownProps {
  components: ScoreComponent[]
  finalScore: number
}

/** 单项评分配色：非扣分项分越高越好；投递成本为扣分项，分越高越差 */
function barTone(component: ScoreComponent): 'high' | 'mid' | 'low' {
  const s = component.score
  if (component.weight < 0) {
    if (s <= 20) return 'high'
    if (s <= 50) return 'mid'
    return 'low'
  }
  if (s >= 80) return 'high'
  if (s >= 60) return 'mid'
  return 'low'
}

const TONE_CLASS = {
  high: styles.barHigh,
  mid: styles.barMid,
  low: styles.barLow,
} as const

// 可解释评分拆解：5 维分数条 + 权重 + 加权贡献 + 岗位个性化解释
export default function ScoreBreakdown({
  components,
  finalScore,
}: ScoreBreakdownProps) {
  // 按固定维度顺序展示（与产品方案一致）
  const ordered = [...components].sort((a, b) => {
    const order = [
      'hard_gate_score',
      'skill_match_score',
      'experience_relevance_score',
      'growth_value_score',
      'application_cost_score',
    ]
    return order.indexOf(a.key) - order.indexOf(b.key)
  })

  const weightedSum = ordered.reduce(
    (sum, c) => sum + c.score * c.weight,
    0,
  )

  return (
    <div className={styles.wrapper}>
      <div className={styles.summary}>
        <div>
          <span className={styles.finalScore}>{finalScore}</span>
          <span className={styles.finalTotal}> / 100</span>
        </div>
        <p className={styles.formula}>
          总分 = 0.35 × 硬门槛 + 0.25 × 技能 + 0.20 × 经历 + 0.15 × 成长 − 0.05
          × 成本
        </p>
      </div>

      <ul className={styles.list}>
        {ordered.map((c) => {
          const contribution = c.score * c.weight
          const weightPercent = Math.round(Math.abs(c.weight) * 100)
          return (
            <li key={c.key} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.dimLabel}>{c.label}</span>
                <span className={styles.weight}>
                  {c.weight < 0 ? '扣分权重' : '权重'} {weightPercent}%
                </span>
                <span className={styles.scoreText}>
                  {c.score}
                  <span className={styles.scoreTotal}> / 100</span>
                </span>
              </div>
              <div className={styles.track}>
                <div
                  className={`${styles.bar} ${TONE_CLASS[barTone(c)]}`}
                  style={{ width: `${c.score}%` }}
                />
              </div>
              <p className={styles.explanation}>{c.explanation}</p>
              <p className={styles.contribution}>
                加权贡献：{c.weight < 0 ? '−' : '+'}
                {Math.abs(contribution).toFixed(1)} 分
              </p>
            </li>
          )
        })}
      </ul>

      <p className={styles.checkline}>
        5 维加权合计 {weightedSum.toFixed(1)} 分，四舍五入后为总分{' '}
        {finalScore} 分。
      </p>
    </div>
  )
}
