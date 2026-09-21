import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SectionCard from '@/components/common/SectionCard'
import StateView from '@/components/common/StateView'
import PaymentWall from '@/components/PaymentWall'
import { useAccount } from '@/auth/AuthProvider'
import { getAppConfig, matchJd } from '@/data/resumeRepository'
import { makeEvalId, saveEvalRecord } from '@/data/evaluationHistory'
import type { AppConfig, JdMatch, JdMatchResponse } from '@/types/resume'
import EvaluateReport from './EvaluateReport'
import EvaluateTabs from './EvaluateTabs'
import AccessNotice, { useResumeReady } from './EvaluateGate'
import styles from './Evaluate.module.css'

const SAMPLE_JD =
  '岗位职责：1. 负责核心业务的日常经营分析，搭建并维护指标体系，监控业务异动并完成归因；2. 支持产品与运营的AB实验设计、样本量评估与显著性检验，输出决策建议；3. 通过SQL进行多表关联、窗口函数等复杂取数，产出专题分析报告；4. 协同业务方搭建BI看板，推动数据治理与口径统一。任职要求：1. 本科及以上学历，统计、数学、计算机、数据科学等相关专业，2027届毕业生优先；2. 熟练掌握SQL，熟悉Hive，具备Python数据处理能力；3. 熟悉假设检验、AB实验、回归分析等统计方法；4. 有互联网大厂数据分析实习经历者优先，有用户增长或经营分析经验者优先；5. 良好的业务敏感度与沟通表达能力。'

const DRAFT_KEY = 'ai-job-agent:eval-draft:v1'
const RESULT_KEY = 'ai-job-agent:eval-last-result:v1'

interface Draft {
  company?: string
  title?: string
  jd?: string
}

type EvalResult = JdMatchResponse & { company?: string; title?: string; jd: string; recordId: string }

function loadLastResult(): EvalResult | null {
  try {
    const raw = window.sessionStorage.getItem(RESULT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<EvalResult>
    if (!parsed.match || typeof parsed.jd !== 'string') return null
    const company = typeof parsed.company === 'string' ? parsed.company : undefined
    const title = typeof parsed.title === 'string' ? parsed.title : undefined
    return {
      engine: typeof parsed.engine === 'string' ? parsed.engine : '',
      generated_at: typeof parsed.generated_at === 'string' ? parsed.generated_at : '',
      match: parsed.match as JdMatch,
      company,
      title,
      jd: parsed.jd,
      recordId: makeEvalId(company, title, parsed.jd),
    }
  } catch {
    return null
  }
}

function loadDraft(): Draft {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Draft
    return {
      company: typeof parsed.company === 'string' ? parsed.company : '',
      title: typeof parsed.title === 'string' ? parsed.title : '',
      jd: typeof parsed.jd === 'string' ? parsed.jd : '',
    }
  } catch {
    return {}
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '评估失败，请稍后重试。'
}

export default function Evaluate() {
  const [searchParams] = useSearchParams()
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [company, setCompany] = useState(() => loadDraft().company ?? '')
  const [title, setTitle] = useState(() => loadDraft().title ?? '')
  const [jd, setJd] = useState(() => loadDraft().jd ?? '')
  const [result, setResult] = useState<EvalResult | null>(() => loadLastResult())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 会话过期等情况下前端状态滞后，服务端 401/404 时强制再亮一次门禁卡
  const [gateVisible, setGateVisible] = useState(false)
  const resumeReady = useResumeReady()
  const { loading: accountLoading, logged, paid, refresh: refreshAccount } = useAccount()
  const abortRef = useRef<AbortController | null>(null)
  const reportRef = useRef<HTMLDivElement | null>(null)

  // 离开页面时中止仍在等待的评估，避免不可见的请求继续占用豆包配额
  useEffect(() => () => abortRef.current?.abort(), [])

  // 草稿留存：刷新 / 切换 Tab 回来都不丢输入
  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ company, title, jd }))
    } catch {
      // sessionStorage 不可用时静默降级
    }
  }, [company, title, jd])

  // 从岗位池「评估」入口带入公司/岗位（仅预填，JD 仍需粘贴）
  useEffect(() => {
    const qCompany = searchParams.get('company')
    const qTitle = searchParams.get('title')
    if (qCompany) setCompany(qCompany)
    if (qTitle) setTitle(qTitle)
    // 仅在首次带参进入时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    getAppConfig(controller.signal)
      .then(setConfig)
      .catch((err) => {
        if (!isAbortError(err)) setConfigError(errorText(err))
      })
    return () => controller.abort()
  }, [])

  const runMatch = async () => {
    if (resumeReady.reason !== null && !resumeReady.ready) {
      setGateVisible(true)
      return
    }
    if (jd.trim().length < 30) {
      setError('请粘贴完整 JD（至少 30 字），过短无法做可靠评估。')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const meta = {
        company: company.trim() || undefined,
        title: title.trim() || undefined,
      }
      const res: JdMatchResponse = await matchJd(jd.trim(), meta, controller.signal)
      if (!controller.signal.aborted) {
        const saved = saveEvalRecord({ ...meta, jd: jd.trim(), match: res.match, source: 'single' })
        const next: EvalResult = { ...res, ...meta, jd: jd.trim(), recordId: saved.id }
        setResult(next)
        try {
          window.sessionStorage.setItem(RESULT_KEY, JSON.stringify(next))
        } catch {
          // sessionStorage 不可用时静默降级
        }
      }
    } catch (err) {
      if (!isAbortError(err)) {
        const status = (err as { status?: number }).status
        if (status === 402) {
          await refreshAccount()
        } else if (status === 401 || status === 404) {
          setGateVisible(true)
          setError(null)
        } else {
          setError(errorText(err))
        }
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const cancelMatch = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  // 报告生成后平滑滚动定位到结果
  useEffect(() => {
    if (result && !loading) {
      window.requestAnimationFrame(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [result, loading])

  if (configError) {
    return (
      <div className={styles.page}>
        <StateView title="本地服务不可用" description={configError} />
      </div>
    )
  }

  if (!accountLoading && logged && !paid) {
    return <PaymentWall onAccessChanged={() => refreshAccount()} />
  }

  const arkConfigured = config?.ark_configured ?? false

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>岗位评估</h1>
        <p className={styles.subtitle}>
          粘贴目标岗位完整 JD，豆包对照你的简历做硬门槛核对与四维可解释评分，输出一份「AI 分析、你来决策」的投递评估报告。
        </p>
        <EvaluateTabs />
      </header>

      <SectionCard title="岗位与 JD 输入">
        {!config ? (
          <div className={styles.notConfigured}>
            <p className={styles.notConfiguredText}>正在读取服务配置…</p>
          </div>
        ) : !arkConfigured ? (
          <div className={styles.notConfigured}>
            <h3 className={styles.notConfiguredTitle}>尚未配置豆包凭证</h3>
            <p className={styles.notConfiguredText}>
              在 <code>server/.env</code> 补全 <code>ARK_API_KEY</code> 与 <code>ARK_MODEL</code>（推理接入点
              ep-xxx）后重启服务，即可生成岗位评估报告。
            </p>
          </div>
        ) : (
          <div className={styles.inputPanel}>
            <div className={styles.inputRow}>
              <input
                className={styles.companyInput}
                placeholder="公司名（可选）"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <input
                className={styles.titleInput}
                placeholder="岗位名（可选）"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <textarea
              className={styles.jdInput}
              rows={8}
              placeholder="把目标岗位的完整 JD 粘贴到这里（岗位职责 + 任职要求）。评估时 JD 与你的简历文本会经服务端发送给豆包。"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
            {!resumeReady.ready ? (
              resumeReady.reason ? <AccessNotice /> : null
            ) : gateVisible ? (
              <AccessNotice onClose={() => setGateVisible(false)} />
            ) : null}
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={loading}
                onClick={() => void runMatch()}
              >
                {loading ? '豆包评估中（约 10–40 秒）…' : '生成评估报告'}
              </button>
              {loading ? (
                <button type="button" className={styles.ghostButton} onClick={cancelMatch}>
                  取消评估
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => {
                    const hasContent = Boolean(company.trim() || title.trim() || jd.trim())
                    if (
                      hasContent &&
                      !window.confirm('填入示例将覆盖当前已填写的公司 / 岗位 / JD，确定继续？')
                    ) {
                      return
                    }
                    setCompany('某头部互联网公司')
                    setTitle('数据分析师（校招）')
                    setJd(SAMPLE_JD)
                  }}
                >
                  填入示例 JD
                </button>
              )}
              <span className={styles.counter}>{jd.trim().length} 字</span>
              <span className={styles.draftHint}>草稿自动留存于本机浏览器</span>
            </div>
            {error ? <div className={styles.errorBox}>{error}</div> : null}
          </div>
        )}
      </SectionCard>

      {loading ? (
        <SectionCard>
          <div className={styles.loadingBlock}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>
              正在逐条核对硬门槛、四个维度打分并从简历中提取证据，通常需要 10–40 秒，请稍候…
            </p>
          </div>
        </SectionCard>
      ) : result ? (
        <div ref={reportRef}>
          <EvaluateReport
            match={result.match}
            company={result.company}
            title={result.title}
            jd={result.jd}
            generatedAt={result.generated_at}
            recordId={result.recordId}
          />
        </div>
      ) : null}

      {!loading && !result && arkConfigured ? (
        <SectionCard>
          <div className={styles.emptyHint}>
            <h3 className={styles.emptyTitle}>评估报告包含什么</h3>
            <ul className={styles.emptyList}>
              <li>0–100 总分与投递决策（强烈建议投递 / 建议投递 / 补强后投递 / 谨慎投递）</li>
              <li>硬门槛逐条核对：学历、届别、技能等要求是否满足，不满足项一票降档</li>
              <li>硬门槛 / 技能 / 经历 / 方向 四维评分与理由</li>
              <li>每条命中点附简历原文证据；每个缺口附可执行补救建议；还可一键生成面试准备包</li>
            </ul>
            <p className={styles.emptyFootnote}>
              报告只做决策支持，不会自动投递；需要定向改写简历，可前往
              <Link
                to={jd.trim() ? `/resume?jd=${encodeURIComponent(jd.trim())}` : '/resume'}
                className={styles.inlineLink}
              >
                我的简历
              </Link>
              使用 A/B 改写。
            </p>
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}
