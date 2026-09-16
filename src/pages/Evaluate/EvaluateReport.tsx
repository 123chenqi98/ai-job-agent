import type { DealBreaker, JdMatch } from '@/types/resume'
import InterviewPrepPanel from './InterviewPrepPanel'
import styles from './Evaluate.module.css'

function scoreToneClass(score: number): string {
  if (score >= 80) return styles.toneSuccess
  if (score >= 60) return styles.toneWarning
  return styles.toneDanger
}

function levelText(level: JdMatch['level']): string {
  if (level === 'high') return '高匹配'
  if (level === 'medium') return '中匹配'
  return '低匹配'
}

function GateRow({ gate }: { gate: DealBreaker }) {
  const toneClass =
    gate.status === 'pass'
      ? styles.gatePass
      : gate.status === 'fail'
        ? styles.gateFail
        : styles.gateUnknown
  const icon = gate.status === 'pass' ? '✓' : gate.status === 'fail' ? '✕' : '?'
  const label = gate.status === 'pass' ? '满足' : gate.status === 'fail' ? '不满足' : '未写明'
  return (
    <li className={`${styles.gateRow} ${toneClass}`}>
      <span className={styles.gateIcon}>{icon}</span>
      <div className={styles.gateBody}>
        <div className={styles.gateHead}>
          <span className={styles.gateItem}>{gate.item}</span>
          <span className={styles.gateStatus}>{label}</span>
        </div>
        <p className={styles.gateNote}>{gate.note}</p>
      </div>
    </li>
  )
}

export default function EvaluateReport({
  match,
  company,
  title,
  jd,
  generatedAt,
  recordId,
}: {
  match: JdMatch
  company?: string
  title?: string
  jd: string
  generatedAt: string
  recordId: string
}) {
  const hasFail = match.deal_breakers.some((g) => g.status === 'fail')
  const time = new Date(generatedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return (
    <article className={styles.report}>
      <header className={`${styles.verdict} ${hasFail ? styles.verdictDanger : scoreToneClass(match.score)}`}>
        <div className={styles.verdictScoreWrap}>
          <span className={styles.verdictScore}>{match.score}</span>
          <div className={styles.verdictMeta}>
            <span className={styles.verdictLevel}>{levelText(match.level)}</span>
            <span className={styles.verdictScale}>满分 100</span>
          </div>
        </div>
        <div className={styles.verdictMain}>
          <div className={styles.verdictJob}>
            {[company, title].filter(Boolean).join(' · ') || '目标岗位'}
          </div>
          <div className={styles.verdictDecision}>
            {hasFail ? '存在硬门槛不满足 · ' : ''}
            {match.decision}
          </div>
          <p className={styles.verdictConclusion}>{match.conclusion}</p>
        </div>
      </header>

      <section className={styles.reportSection}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIndex}>01</span>
          硬门槛核对（Deal-breakers）
        </h3>
        {match.deal_breakers.length === 0 ? (
          <p className={styles.muted}>JD 未写明硬性门槛。</p>
        ) : (
          <ul className={styles.gateList}>
            {match.deal_breakers.map((gate, idx) => (
              <GateRow key={idx} gate={gate} />
            ))}
          </ul>
        )}
      </section>

      <section className={styles.reportSection}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIndex}>02</span>
          四维评分拆解
        </h3>
        <div className={styles.dimensionGrid}>
          {match.dimension_scores.map((dim) => (
            <div key={dim.key} className={styles.dimensionCard}>
              <div className={styles.dimensionTop}>
                <span className={styles.dimensionLabel}>{dim.label}</span>
                <span className={`${styles.dimensionScore} ${scoreToneClass(dim.score)}`}>
                  {dim.score}
                </span>
              </div>
              <div className={styles.dimensionTrack}>
                <div
                  className={`${styles.dimensionBar} ${scoreToneClass(dim.score)}`}
                  style={{ width: `${Math.min(100, Math.max(0, dim.score))}%` }}
                />
              </div>
              <p className={styles.dimensionReason}>{dim.reason}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.reportSection}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIndex}>03</span>
          命中点与简历证据
        </h3>
        {match.matched.length === 0 ? (
          <p className={styles.muted}>模型未给出明确命中点。</p>
        ) : (
          <ul className={styles.evidenceList}>
            {match.matched.map((item, idx) => (
              <li key={idx} className={styles.evidenceRow}>
                <span className={styles.evidencePoint}>{item.point}</span>
                <span className={styles.evidenceText}>{item.evidence}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.reportSection}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIndex}>04</span>
          缺口与补救建议
        </h3>
        {match.gaps.length === 0 ? (
          <p className={styles.muted}>未识别到明显缺口。</p>
        ) : (
          <ul className={styles.gapList}>
            {match.gaps.map((item, idx) => (
              <li key={idx} className={styles.gapRow}>
                <span className={styles.gapPoint}>{item.gap}</span>
                <span className={styles.gapText}>{item.suggestion}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InterviewPrepPanel jd={jd} company={company} title={title} recordId={recordId} />

      <footer className={styles.reportFooter}>
        <span>评估时间 {time}</span>
        <span>评分由豆包依据本机简历事实生成，证据均可在简历原文核对，仅供投递决策参考。</span>
      </footer>
    </article>
  )
}
