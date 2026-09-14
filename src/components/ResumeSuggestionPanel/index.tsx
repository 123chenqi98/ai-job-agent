import { useState } from 'react'
import type { ResumeSuggestion } from '@/types'
import Tag from '@/components/common/Tag'
import styles from './ResumeSuggestionPanel.module.css'

interface ResumeSuggestionPanelProps {
  suggestion: ResumeSuggestion
  /** 通过经历 ID 解析「经历标题 · 组织」，用于建议强化经历的展示 */
  resolveExperienceName: (experienceId: string) => string
}

function ColumnHeader({ index, title, hint }: { index: string; title: string; hint?: string }) {
  return (
    <div className={styles.columnHeader}>
      <span className={styles.columnIndex}>{index}</span>
      <div>
        <h3 className={styles.columnTitle}>{title}</h3>
        {hint ? <p className={styles.columnHint}>{hint}</p> : null}
      </div>
    </div>
  )
}

export default function ResumeSuggestionPanel({
  suggestion,
  resolveExperienceName,
}: ResumeSuggestionPanelProps) {
  const [activeVersion, setActiveVersion] = useState<'A' | 'B'>(
    suggestion.versions[0]?.version_key ?? 'A',
  )
  const active = suggestion.versions.find((v) => v.version_key === activeVersion)

  return (
    <div className={styles.wrapper}>
      <div className={styles.threeColumns}>
        {/* 左栏：岗位需求 */}
        <section className={styles.column}>
          <ColumnHeader index="01" title="岗位需求" hint="从 JD 结构化提取" />
          <ul className={styles.reqList}>
            {suggestion.requirement_summary.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
          <div className={styles.subBlock}>
            <h4 className={styles.subTitle}>必补 / 推荐关键词</h4>
            <div className={styles.keywordWrap}>
              {suggestion.priority_keywords.map((kw) => (
                <Tag key={kw} tone="primary">
                  {kw}
                </Tag>
              ))}
            </div>
          </div>
        </section>

        {/* 中栏：当前简历 */}
        <section className={styles.column}>
          <ColumnHeader index="02" title="当前简历" hint="覆盖与强化建议" />
          <div className={styles.subBlock}>
            <h4 className={styles.subTitle}>应保留内容</h4>
            <ul className={styles.keepList}>
              {suggestion.keep_points.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div className={styles.subBlock}>
            <h4 className={styles.subTitle}>建议强化的经历</h4>
            <ul className={styles.strengthenList}>
              {suggestion.strengthen_experiences.map((s) => (
                <li key={s.experience_id}>
                  <div className={styles.expName}>
                    {resolveExperienceName(s.experience_id)}
                  </div>
                  <p className={styles.expReason}>{s.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 右栏：改写建议 */}
        <section className={styles.column}>
          <ColumnHeader index="03" title="改写建议" hint="原句 → 建议改写" />
          <ul className={styles.bulletList}>
            {suggestion.rewrite_bullets.map((b) => (
              <li key={b.bullet_id} className={styles.bulletItem}>
                <div className={styles.originalBox}>
                  <span className={styles.bulletTag}>原句</span>
                  <p className={styles.originalText}>{b.original}</p>
                </div>
                <div className={styles.suggestedBox}>
                  <span className={styles.bulletTag}>建议改写</span>
                  <p className={styles.suggestedText}>{b.suggested}</p>
                </div>
                <p className={styles.bulletReason}>{b.reason}</p>
              </li>
            ))}
          </ul>
          {suggestion.missing_points.length > 0 ? (
            <div className={styles.missingBox}>
              <h4 className={styles.subTitle}>当前缺失点</h4>
              <ul className={styles.missingList}>
                {suggestion.missing_points.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      {/* 版本方案 */}
      <section className={styles.versionCard}>
        <div className={styles.versionHead}>
          <h3 className={styles.versionCardTitle}>推荐简历版本</h3>
          <div className={styles.versionTabs}>
            {suggestion.versions.map((v) => (
              <button
                key={v.version_key}
                type="button"
                className={
                  v.version_key === activeVersion
                    ? `${styles.versionTab} ${styles.versionTabActive}`
                    : styles.versionTab
                }
                onClick={() => setActiveVersion(v.version_key)}
              >
                版本 {v.version_key}
              </button>
            ))}
          </div>
        </div>
        {active ? (
          <div className={styles.versionBody}>
            <div className={styles.versionNameRow}>
              <span className={styles.versionName}>{active.version_name}</span>
              <Tag tone="primary">{active.positioning}</Tag>
            </div>
            <p className={styles.versionSummary}>{active.summary}</p>
          </div>
        ) : null}
      </section>
    </div>
  )
}
