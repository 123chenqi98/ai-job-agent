import { useRef, useState } from 'react'
import { buildInterviewPrep } from '@/data/resumeRepository'
import { getEvalRecord, saveEvalPrep } from '@/data/evaluationHistory'
import type { InterviewPrep, InterviewQuestion } from '@/types/resume'
import styles from './Evaluate.module.css'

const CATEGORY_LABEL: Record<InterviewQuestion['category'], string> = {
  technical: '技术/方法题',
  project: '简历项目追问',
  behavioral: '行为面问题',
}

const DIFFICULTY_LABEL: Record<InterviewQuestion['difficulty'], string> = {
  high: '高频/难题',
  mid: '中等',
  low: '基础',
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export default function InterviewPrepPanel({
  jd,
  company,
  title,
  recordId,
}: {
  jd: string
  company?: string
  title?: string
  recordId: string
}) {
  // 面试准备包随评估记录持久化：回看历史 / 批量页重新展开时直接呈现，不重复调用豆包
  const [prep, setPrep] = useState<InterviewPrep | null>(
    () => getEvalRecord(recordId)?.prep ?? null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const res = await buildInterviewPrep(
        jd,
        { company, title },
        controller.signal,
      )
      if (!controller.signal.aborted) {
        setPrep(res.prep)
        saveEvalPrep(recordId, res.prep)
      }
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err instanceof Error ? err.message : '生成失败，请稍后重试。')
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const groups: Array<InterviewQuestion['category']> = ['technical', 'project', 'behavioral']

  return (
    <section className={styles.reportSection}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIndex}>05</span>
        面试准备包
      </h3>

      {!prep && !loading ? (
        <div className={styles.interviewEntry}>
          <p className={styles.interviewIntro}>
            基于该 JD 与你的简历，豆包预测 8–10 个高概率面试题（技术/项目追问/行为面），逐题给出可调用的简历素材与答题要点，并附临面复习清单与反问面试官建议。
          </p>
          <button type="button" className={styles.primaryButton} onClick={() => void generate()}>
            生成面试准备包（约 20–40 秒）
          </button>
          {error ? <div className={styles.errorBox}>{error}</div> : null}
        </div>
      ) : null}

      {loading ? (
        <div className={styles.loadingBlock}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>正在以面试官视角出题并结合简历组织答题要点…</p>
        </div>
      ) : null}

      {prep && !loading ? (
        <div className={styles.interviewResult}>
          <p className={styles.interviewOverview}>{prep.overview}</p>

          {groups.map((cat) => {
            const qs = prep.questions.filter((q) => q.category === cat)
            if (qs.length === 0) return null
            return (
              <div key={cat} className={styles.interviewGroup}>
                <h4 className={styles.interviewGroupTitle}>
                  {CATEGORY_LABEL[cat]}
                  <span className={styles.interviewGroupCount}>{qs.length} 题</span>
                </h4>
                <ol className={styles.questionList}>
                  {qs.map((q, idx) => (
                    <li key={idx} className={styles.questionItem}>
                      <div className={styles.questionHead}>
                        <span className={styles.questionText}>{q.question}</span>
                        <span
                          className={`${styles.difficultyTag} ${
                            q.difficulty === 'high'
                              ? styles.difficultyHigh
                              : q.difficulty === 'mid'
                                ? styles.difficultyMid
                                : styles.difficultyLow
                          }`}
                        >
                          {DIFFICULTY_LABEL[q.difficulty]}
                        </span>
                      </div>
                      <div className={styles.anchorBox}>简历素材：{q.resume_anchor}</div>
                      <ul className={styles.answerPoints}>
                        {q.answer_points.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}

          <div className={styles.interviewBottomGrid}>
            <div className={styles.interviewBottomCard}>
              <h5 className={styles.interviewBottomTitle}>临面复习主题</h5>
              <div className={styles.reviewChips}>
                {prep.topics_to_review.map((t, i) => (
                  <span key={i} className={styles.reviewChip}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.interviewBottomCard}>
              <h5 className={styles.interviewBottomTitle}>可以反问面试官</h5>
              <ul className={styles.askList}>
                {prep.questions_to_ask.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          </div>

          <button type="button" className={styles.ghostButton} onClick={() => void generate()}>
            重新生成
          </button>
        </div>
      ) : null}
    </section>
  )
}
