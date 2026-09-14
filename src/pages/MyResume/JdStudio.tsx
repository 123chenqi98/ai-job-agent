import { useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { matchJd, rewriteBullets } from '@/data/resumeRepository'
import type {
  BulletRewrites,
  JdJobMeta,
  JdMatch,
} from '@/types/resume'
import styles from './MyResume.module.css'

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '请求失败，请稍后重试。'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      document.body.removeChild(ta)
    }
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }
  return (
    <button type="button" className={styles.copyButton} onClick={copy}>
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function scoreTone(score: number): string {
  if (score >= 80) return styles.toneSuccess
  if (score >= 60) return styles.toneWarning
  return styles.toneDanger
}

function MatchResultView({ match }: { match: JdMatch }) {
  return (
    <div className={styles.resultBlock}>
      <div className={styles.matchHead}>
        <div className={styles.matchScoreWrap}>
          <span className={`${styles.matchScore} ${scoreTone(match.score)}`}>{match.score}</span>
          <span className={styles.matchScoreTotal}>/100</span>
        </div>
        <div className={styles.matchDecision}>
          <span className={styles.decisionText}>{match.decision}</span>
          <span className={styles.matchConclusion}>{match.conclusion}</span>
        </div>
      </div>

      <div className={styles.dimensionList}>
        {match.dimension_scores.map((dim) => (
          <div key={dim.key} className={styles.dimensionRow}>
            <div className={styles.dimensionTop}>
              <span className={styles.dimensionLabel}>{dim.label}</span>
              <span className={styles.dimensionScore}>{dim.score}</span>
            </div>
            <div className={styles.dimensionTrack}>
              <div
                className={`${styles.dimensionBar} ${scoreTone(dim.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, dim.score))}%` }}
              />
            </div>
            <p className={styles.dimensionReason}>{dim.reason}</p>
          </div>
        ))}
      </div>

      <div className={styles.matchColumns}>
        <div className={styles.matchColumn}>
          <h4 className={styles.matchColumnTitleHit}>命中点（附简历证据）</h4>
          {match.matched.length === 0 ? (
            <p className={styles.mutedText}>模型未给出明确命中点。</p>
          ) : (
            <ul className={styles.evidenceList}>
              {match.matched.map((item, idx) => (
                <li key={idx}>
                  <span className={styles.evidencePoint}>{item.point}</span>
                  <span className={styles.evidenceText}>{item.evidence}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.matchColumn}>
          <h4 className={styles.matchColumnTitleGap}>缺口与补救建议</h4>
          {match.gaps.length === 0 ? (
            <p className={styles.mutedText}>未识别到明显缺口。</p>
          ) : (
            <ul className={styles.evidenceList}>
              {match.gaps.map((item, idx) => (
                <li key={idx}>
                  <span className={styles.evidencePoint}>{item.gap}</span>
                  <span className={styles.evidenceText}>{item.suggestion}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function RewriteResultView({ rewrites }: { rewrites: BulletRewrites }) {
  return (
    <div className={styles.resultBlock}>
      <div className={styles.coverageRow}>
        <span className={styles.coverageLabel}>简历对该 JD 的覆盖度</span>
        <div className={styles.coverageTrack}>
          <div
            className={`${styles.coverageBar} ${scoreTone(rewrites.coverage_score)}`}
            style={{ width: `${Math.min(100, Math.max(0, rewrites.coverage_score))}%` }}
          />
        </div>
        <span className={styles.coverageValue}>{rewrites.coverage_score}%</span>
      </div>

      {rewrites.keywords_to_cover.length > 0 ? (
        <div className={styles.keywordRow}>
          <span className={styles.keywordCaption}>JD 关键词：</span>
          {rewrites.keywords_to_cover.map((kw) => (
            <span key={kw} className={styles.keywordChip}>
              {kw}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.rewriteList}>
        {rewrites.rewrites.map((item, idx) => (
          <div key={idx} className={styles.rewriteCard}>
            <div className={styles.rewriteOriginal}>
              <span className={styles.rewriteTagMuted}>原句</span>
              <span>{item.original}</span>
            </div>
            <div className={styles.rewriteVersionA}>
              <div className={styles.rewriteVersionHead}>
                <span className={styles.rewriteTagA}>A · 岗位定向</span>
                <CopyButton text={item.version_a} />
              </div>
              <p>{item.version_a}</p>
            </div>
            <div className={styles.rewriteVersionB}>
              <div className={styles.rewriteVersionHead}>
                <span className={styles.rewriteTagB}>B · 量化强化</span>
                <CopyButton text={item.version_b} />
              </div>
              <p>{item.version_b}</p>
            </div>
            <p className={styles.rewriteReason}>改写理由：{item.reason}</p>
          </div>
        ))}
      </div>

      {rewrites.new_bullets.length > 0 ? (
        <div className={styles.tipsBlock}>
          <h4 className={styles.tipsTitle}>可基于现有事实新增的表述</h4>
          <ul className={styles.tipsList}>
            {rewrites.new_bullets.map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rewrites.tips.length > 0 ? (
        <div className={styles.tipsBlock}>
          <h4 className={styles.tipsTitle}>投递定制建议</h4>
          <ul className={styles.tipsList}>
            {rewrites.tips.map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default function JdStudio({ arkConfigured }: { arkConfigured: boolean }) {
  const [searchParams] = useSearchParams()
  const [company, setCompany] = useState(() => searchParams.get('company') ?? '')
  const [title, setTitle] = useState(() => searchParams.get('title') ?? '')
  const [jd, setJd] = useState(() => searchParams.get('jd') ?? '')
  const [match, setMatch] = useState<JdMatch | null>(null)
  const [rewrites, setRewrites] = useState<BulletRewrites | null>(null)
  const [loadingMatch, setLoadingMatch] = useState(false)
  const [loadingRewrite, setLoadingRewrite] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // 从评估报告「去改写简历」带 JD 跳转过来时，定位到本模块并提示
  // JdStudio 在简历异步解析完成后才挂载，挂载当刻整页高度已定，
  // 故在 useLayoutEffect（绘制前）即时定位最稳；滚动容器是布局中
  // overflow:auto 的内容面板（窗口本身不滚动）
  useLayoutEffect(() => {
    if (!searchParams.get('jd')) return
    const scrollToPanel = () => {
      const el = rootRef.current
      if (!el) return
      let node: HTMLElement | null = el.parentElement
      while (node) {
        const overflowY = window.getComputedStyle(node).overflowY
        if (overflowY === 'auto' || overflowY === 'scroll') break
        node = node.parentElement
      }
      if (node) {
        const elTop = el.getBoundingClientRect().top
        const nodeTop = node.getBoundingClientRect().top
        node.scrollTop += elTop - nodeTop - 16
      } else {
        el.scrollIntoView({ block: 'start' })
      }
    }
    scrollToPanel()
    // 兜底：抵消极个别晚到的布局变化
    const timer = window.setTimeout(scrollToPanel, 350)
    return () => window.clearTimeout(timer)
    // 仅首次带参进入时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const jobMeta: JdJobMeta = {
    company: company.trim() || undefined,
    title: title.trim() || undefined,
  }

  const run = async (mode: 'match' | 'rewrite') => {
    if (jd.trim().length < 30) {
      setError('请粘贴完整 JD（至少 30 字），过短无法做可靠分析。')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    try {
      if (mode === 'match') {
        setLoadingMatch(true)
        const res = await matchJd(jd.trim(), jobMeta, controller.signal)
        setMatch(res.match)
      } else {
        setLoadingRewrite(true)
        const res = await rewriteBullets(jd.trim(), jobMeta, controller.signal)
        setRewrites(res.rewrites)
      }
    } catch (err) {
      if (!isAbortError(err)) setError(errorText(err))
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMatch(false)
        setLoadingRewrite(false)
      }
    }
  }

  if (!arkConfigured) {
    return (
      <div className={styles.aiNotice}>
        <h3 className={styles.aiNoticeTitle}>JD 精分析与简历改写（需配置豆包）</h3>
        <p className={styles.aiNoticeText}>
          在 <code>server/.env</code> 补全 <code>ARK_API_KEY</code> 与{' '}
          <code>ARK_MODEL</code>（火山方舟推理接入点 ep-xxx）后重启服务，即可粘贴完整 JD
          获得可解释匹配评分、命中证据、缺口建议与 A/B 两版 bullet 改写。
        </p>
      </div>
    )
  }

  return (
    <div className={styles.jdStudio} ref={rootRef}>
      {searchParams.get('jd') ? (
        <div className={styles.jdPrefillHint}>
          已从「岗位评估」带入这条 JD，可直接生成定向改写；如需更换，粘贴覆盖即可。
        </div>
      ) : null}
      <div className={styles.jdInputRow}>
        <input
          className={styles.jdCompanyInput}
          placeholder="公司名（可选）"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <input
          className={styles.jdTitleInput}
          placeholder="岗位名（可选）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <textarea
        className={styles.jdTextarea}
        placeholder="把目标岗位的完整 JD 粘贴到这里（岗位职责 + 任职要求），点击下方按钮开始分析。"
        rows={7}
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />
      <div className={styles.jdActions}>
        <button
          type="button"
          className={styles.jdPrimaryButton}
          disabled={loadingMatch || loadingRewrite}
          onClick={() => void run('match')}
        >
          {loadingMatch ? '分析中…' : '匹配分析'}
        </button>
        <button
          type="button"
          className={styles.jdSecondaryButton}
          disabled={loadingMatch || loadingRewrite}
          onClick={() => void run('rewrite')}
        >
          {loadingRewrite ? '生成中…' : '生成简历改写 A/B'}
        </button>
        <span className={styles.jdCounter}>{jd.trim().length} 字</span>
      </div>

      {error ? <div className={styles.jdError}>{error}</div> : null}
      {match ? <MatchResultView match={match} /> : null}
      {rewrites ? <RewriteResultView rewrites={rewrites} /> : null}
    </div>
  )
}
