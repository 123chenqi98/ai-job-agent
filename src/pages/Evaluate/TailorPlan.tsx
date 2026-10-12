import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SectionCard from '@/components/common/SectionCard'
import PaymentWall from '@/components/PaymentWall'
import { useAccount } from '@/auth/AuthProvider'
import { getAppConfig, tailorResume } from '@/data/resumeRepository'
import type { AppConfig, TailoredExperience, TailoredPlan } from '@/types/resume'
import EvaluateTabs from './EvaluateTabs'
import AccessNotice, { useResumeReady } from './EvaluateGate'
import shared from './Evaluate.module.css'
import styles from './TailorPlan.module.css'

const DRAFT_KEY = 'ai-job-agent:tailor-draft:v1'
const RESULT_KEY = 'ai-job-agent:tailor-result:v1'

interface Draft {
  company?: string
  title?: string
  jd?: string
  note?: string
}

interface StoredResult {
  engine: string
  generated_at: string
  ai_remaining?: number
  plan: TailoredPlan
  company?: string
  title?: string
}

function loadDraft(): Draft {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as Partial<Draft>
    return {
      company: typeof p.company === 'string' ? p.company : '',
      title: typeof p.title === 'string' ? p.title : '',
      jd: typeof p.jd === 'string' ? p.jd : '',
      note: typeof p.note === 'string' ? p.note : '',
    }
  } catch {
    return {}
  }
}

function loadResult(): StoredResult | null {
  try {
    const raw = window.sessionStorage.getItem(RESULT_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<StoredResult>
    if (!p.plan) return null
    return p as StoredResult
  } catch {
    return null
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '生成失败，请稍后重试。'
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(ta)
    return ok
  }
}

// 把结构化方案拼装为用户模板要求的四段式 Markdown，供一键复制
function planToMarkdown(plan: TailoredPlan, meta: { company?: string; title?: string }): string {
  const lines: string[] = []
  const head = [meta.company, meta.title].filter(Boolean).join(' · ')
  if (head) lines.push(`# 定向简历优化方案 · ${head}`, '')

  lines.push('【岗位拆解】')
  lines.push('**该岗位最关键的能力要求：**')
  plan.job_analysis.key_requirements.forEach((x, i) => lines.push(`${i + 1}. ${x}`))
  lines.push('', `**JD 高频数据分析关键词：** ${plan.job_analysis.keywords.join('、')}`)
  lines.push('', `**偏好候选人画像：** ${plan.job_analysis.candidate_profile}`)
  lines.push('', '**简历中已接近「数据分析岗位语言」的内容：**')
  plan.job_analysis.close_points.forEach((x) => lines.push(`- ${x}`))
  lines.push('', '**做过事、但当前表达不像数据分析的内容：**')
  plan.job_analysis.weak_expression.forEach((x) => lines.push(`- ${x}`))

  const stratList = (title: string, items: string[]) => {
    lines.push('', `**${title}**`)
    items.forEach((x) => lines.push(`- ${x}`))
  }
  lines.push('', '【改写策略】')
  stratList('适合改写成「数据驱动」表达的经历：', plan.rewrite_strategy.data_driven_experiences)
  stratList('应补充分析方法 / 对象 / 指标 / 结果的 bullet：', plan.rewrite_strategy.bullets_to_enhance)
  stratList('应突出「发现问题—分析原因—提出方案—推动落地」链路的经历：', plan.rewrite_strategy.closed_loop)
  lines.push('', `**应自然融入的技能词与关键词：** ${plan.rewrite_strategy.keywords_to_integrate.join('、')}`)
  stratList('可弱化或删除的无关内容：', plan.rewrite_strategy.content_to_deemphasize)

  const expBlock = (exps: TailoredExperience[]) => {
    exps.forEach((e) => {
      const name = [e.org, e.title].filter(Boolean).join(' · ')
      lines.push(`### ${name}${e.period ? `（${e.period}）` : ''}`)
      e.bullets.forEach((b) => lines.push(`- ${b}`))
      lines.push('')
    })
  }
  lines.push('', '【优化后简历】')
  if (plan.tailored_resume.positioning) lines.push(`**个人定位：** ${plan.tailored_resume.positioning}`, '')
  if (plan.tailored_resume.education.length) {
    lines.push('### 教育背景')
    plan.tailored_resume.education.forEach((x) => lines.push(`- ${x}`))
    lines.push('')
  }
  if (plan.tailored_resume.internships.length) {
    lines.push('### 实习经历')
    expBlock(plan.tailored_resume.internships)
  }
  if (plan.tailored_resume.projects.length) {
    lines.push('### 项目经历')
    expBlock(plan.tailored_resume.projects)
  }
  if (plan.tailored_resume.skills.length) {
    lines.push('### 专业技能')
    plan.tailored_resume.skills.forEach((x) => lines.push(`- ${x}`))
    lines.push('')
  }
  if (plan.tailored_resume.self_evaluation.length) {
    lines.push('### 自我评价')
    plan.tailored_resume.self_evaluation.forEach((x) => lines.push(`- ${x}`))
    lines.push('')
  }

  lines.push('【补充建议】')
  stratList('投更强数据分析岗还缺的能力证据：', plan.suggestions.missing_evidence)
  stratList('最值得后续补充量化结果的项目 / 经历：', plan.suggestions.quantify_targets)
  stratList('面试时最适合重点展开的经历：', plan.suggestions.interview_focus)

  return lines.join('\n')
}

function StringList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  if (items.length === 0) return <p className={styles.muted}>模型未给出相关内容。</p>
  if (ordered) {
    return (
      <ol className={styles.orderedList}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ol>
    )
  }
  return (
    <ul className={styles.bulletList}>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  )
}

function SubBlock({
  title,
  tone,
  items,
  chips = false,
  ordered = false,
}: {
  title: string
  tone: 'blue' | 'amber' | 'plain'
  items: string[]
  chips?: boolean
  ordered?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div className={styles.subBlock}>
      <h4 className={`${styles.subTitle} ${styles[`tone_${tone}`]}`}>{title}</h4>
      {chips ? (
        <div className={styles.chipRow}>
          {items.map((x, i) => (
            <span key={i} className={styles.chip}>
              {x}
            </span>
          ))}
        </div>
      ) : (
        <StringList items={items} ordered={ordered} />
      )}
    </div>
  )
}

function ExperienceView({ exps }: { exps: TailoredExperience[] }) {
  if (exps.length === 0) return <p className={styles.muted}>未输出相关经历。</p>
  return (
    <div className={styles.expList}>
      {exps.map((e, i) => (
        <div key={i} className={styles.expItem}>
          <div className={styles.expHead}>
            <span className={styles.expName}>
              {[e.org, e.title].filter(Boolean).join(' · ')}
            </span>
            {e.period ? <span className={styles.expPeriod}>{e.period}</span> : null}
          </div>
          {e.bullets.length ? (
            <ul className={styles.bulletList}>
              {e.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function PlanReport({ result }: { result: StoredResult }) {
  const { plan } = result
  const [copied, setCopied] = useState(false)
  const md = planToMarkdown(plan, { company: result.company, title: result.title })

  const doCopy = async () => {
    const ok = await copyText(md)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div className={styles.report}>
      <div className={styles.reportToolbar}>
        <span className={styles.reportMeta}>
          生成于 {new Date(result.generated_at).toLocaleString('zh-CN', { hour12: false })} · 仅基于你的简历事实，未虚构经历
        </span>
        <button type="button" className={styles.copyAllBtn} onClick={() => void doCopy()}>
          {copied ? '已复制完整方案' : '复制完整方案（Markdown）'}
        </button>
      </div>

      <SectionCard
        title={
          <span className={styles.cardTitle}>
            <span className={styles.stepNo}>Step 1</span>岗位拆解
          </span>
        }
      >
        {plan.job_analysis.candidate_profile ? (
          <p className={styles.profileLine}>{plan.job_analysis.candidate_profile}</p>
        ) : null}
        <SubBlock title="该岗位最关键的能力要求" tone="blue" items={plan.job_analysis.key_requirements} ordered />
        <SubBlock title="JD 高频数据分析关键词" tone="plain" items={plan.job_analysis.keywords} chips />
        <div className={styles.twoCol}>
          <SubBlock title="已接近「数据分析语言」的内容" tone="blue" items={plan.job_analysis.close_points} />
          <SubBlock title="做过事但表达不像数据分析" tone="amber" items={plan.job_analysis.weak_expression} />
        </div>
      </SectionCard>

      <SectionCard
        title={
          <span className={styles.cardTitle}>
            <span className={styles.stepNo}>Step 2</span>改写策略
          </span>
        }
      >
        <SubBlock title="适合改写成「数据驱动」表达的经历" tone="blue" items={plan.rewrite_strategy.data_driven_experiences} />
        <SubBlock title="应补分析方法 / 对象 / 指标 / 结果的 bullet" tone="amber" items={plan.rewrite_strategy.bullets_to_enhance} />
        <SubBlock title="突出「发现问题—分析原因—提出方案—推动落地」链路" tone="blue" items={plan.rewrite_strategy.closed_loop} />
        <SubBlock title="应自然融入的技能词与关键词" tone="plain" items={plan.rewrite_strategy.keywords_to_integrate} chips />
        <SubBlock title="可弱化或删除的无关内容" tone="amber" items={plan.rewrite_strategy.content_to_deemphasize} />
      </SectionCard>

      <SectionCard
        title={
          <span className={styles.cardTitle}>
            <span className={styles.stepNo}>Step 3</span>优化后简历
          </span>
        }
        extra={
          <button type="button" className={styles.copyMiniBtn} onClick={() => void copyText(md.split('【优化后简历】')[1]?.split('【补充建议】')[0]?.trim() ?? '')}>
            复制简历
          </button>
        }
      >
        {plan.tailored_resume.positioning ? <p className={styles.positioning}>{plan.tailored_resume.positioning}</p> : null}
        <SubBlock title="教育背景" tone="plain" items={plan.tailored_resume.education} />
        <div className={styles.resumeGroup}>
          <h4 className={styles.groupTitle}>实习经历（按岗位相关度排序）</h4>
          <ExperienceView exps={plan.tailored_resume.internships} />
        </div>
        <div className={styles.resumeGroup}>
          <h4 className={styles.groupTitle}>项目经历</h4>
          <ExperienceView exps={plan.tailored_resume.projects} />
        </div>
        <SubBlock title="专业技能" tone="plain" items={plan.tailored_resume.skills} chips />
        {plan.tailored_resume.self_evaluation.length ? (
          <SubBlock title="自我评价" tone="plain" items={plan.tailored_resume.self_evaluation} />
        ) : null}
      </SectionCard>

      <SectionCard
        title={
          <span className={styles.cardTitle}>
            <span className={styles.stepNo}>Step 4</span>补充建议
          </span>
        }
      >
        <SubBlock title="投更强数据分析岗还缺的能力证据" tone="amber" items={plan.suggestions.missing_evidence} />
        <SubBlock title="最值得后续补充量化结果的项目 / 经历" tone="blue" items={plan.suggestions.quantify_targets} />
        <SubBlock title="面试时最适合重点展开的经历" tone="blue" items={plan.suggestions.interview_focus} />
      </SectionCard>
    </div>
  )
}

export default function TailorPlan() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const initialDraft = loadDraft()
  const [company, setCompany] = useState(initialDraft.company ?? '')
  const [title, setTitle] = useState(initialDraft.title ?? '')
  const [jd, setJd] = useState(initialDraft.jd ?? '')
  const [note, setNote] = useState(initialDraft.note ?? '')
  const [result, setResult] = useState<StoredResult | null>(() => loadResult())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gateVisible, setGateVisible] = useState(false)
  const resumeReady = useResumeReady()
  const { loading: accountLoading, logged, paid, aiRemaining, refresh: refreshAccount } = useAccount()
  const abortRef = useRef<AbortController | null>(null)
  const reportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ company, title, jd, note }))
    } catch {
      // 静默降级
    }
  }, [company, title, jd, note])

  useEffect(() => {
    const controller = new AbortController()
    getAppConfig(controller.signal)
      .then(setConfig)
      .catch((err) => {
        if (!isAbortError(err)) setConfigError(errorText(err))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (result && !loading) {
      window.requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }, [result, loading])

  const run = async () => {
    if (resumeReady.reason !== null && !resumeReady.ready) {
      setGateVisible(true)
      return
    }
    if (jd.trim().length < 30) {
      setError('请粘贴完整 JD（至少 30 字），过短无法做可靠的定向优化。')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const meta = { company: company.trim() || undefined, title: title.trim() || undefined }
      const res = await tailorResume(jd.trim(), meta, note.trim(), controller.signal)
      if (!controller.signal.aborted) {
        const stored: StoredResult = { ...res, ...meta }
        setResult(stored)
        try {
          window.sessionStorage.setItem(RESULT_KEY, JSON.stringify(stored))
        } catch {
          // 静默降级
        }
        await refreshAccount()
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

  if (configError) {
    return (
      <div className={shared.page}>
        <SectionCard>
          <p className={styles.muted}>{configError}</p>
        </SectionCard>
      </div>
    )
  }

  if (!accountLoading && logged && !paid) {
    return <PaymentWall onAccessChanged={() => refreshAccount()} />
  }

  const arkConfigured = config?.ark_configured ?? false

  return (
    <div className={shared.page}>
      <header className={shared.header}>
        <h1 className={shared.title}>定向简历方案</h1>
        <p className={shared.subtitle}>
          粘贴目标岗位 JD，资深数据招聘视角按「岗位拆解 → 改写策略 → 优化后简历 → 补充建议」四步，把你的真实经历改写成更匹配数据分析岗的投递版本；只用简历事实，不虚构经历与数据。
        </p>
        <EvaluateTabs />
      </header>

      <SectionCard title="目标岗位输入">
        {!arkConfigured ? (
          <div className={shared.notConfigured}>
            <h3 className={shared.notConfiguredTitle}>尚未配置豆包凭证</h3>
            <p className={shared.notConfiguredText}>
              在 <code>server/.env</code> 补全 <code>ARK_API_KEY</code> 与 <code>ARK_MODEL</code>（推理接入点
              ep-xxx）后重启服务，即可生成定向简历方案。
            </p>
          </div>
        ) : (
          <div className={shared.inputPanel}>
            <div className={shared.inputRow}>
              <input
                className={shared.companyInput}
                placeholder="公司名（可选，如：字节跳动）"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <input
                className={shared.titleInput}
                placeholder="岗位 / 业务方向（可选，如：商业分析-经营分析）"
                value={title}
                onChange={(e) => setTitle(e.target.title)}
              />
            </div>
            <textarea
              className={shared.jdInput}
              rows={8}
              placeholder="把目标岗位的完整 JD 粘贴到这里（岗位职责 + 任职要求）。方案会结合你已上传的简历生成，无需重复粘贴简历。"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
            <textarea
              className={styles.noteInput}
              rows={3}
              placeholder="补充说明（可选）：如内推渠道、最想突出的经历、目标团队侧重等。注：此处新提到但简历没有的事实不会被写成已发生经历。"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {!resumeReady.ready ? (
              resumeReady.reason ? <AccessNotice /> : null
            ) : gateVisible ? (
              <AccessNotice onClose={() => setGateVisible(false)} />
            ) : null}
            <div className={shared.actionRow}>
              <button type="button" className={shared.primaryButton} disabled={loading} onClick={() => void run()}>
                {loading ? '豆包生成中（约 20–60 秒）…' : '生成定向简历方案'}
              </button>
              {typeof aiRemaining === 'number' ? (
                <span className={styles.quotaHint}>今日剩余 AI 次数：{aiRemaining}</span>
              ) : null}
              <span className={shared.counter}>{jd.trim().length} 字</span>
              <span className={shared.draftHint}>草稿自动留存于本机浏览器</span>
            </div>
            {error ? <div className={shared.errorBox}>{error}</div> : null}
          </div>
        )}
      </SectionCard>

      {loading ? (
        <SectionCard>
          <div className={shared.loadingBlock}>
            <div className={shared.spinner} />
            <p className={shared.loadingText}>
              正在拆解 JD 能力要求、把你的经历改写为数据分析表达并产出整份优化简历，内容较多，通常需要 20–60 秒，请稍候…
            </p>
          </div>
        </SectionCard>
      ) : result ? (
        <div ref={reportRef}>
          <PlanReport result={result} />
        </div>
      ) : (
        <SectionCard>
          <div className={shared.emptyHint}>
            <h3 className={shared.emptyTitle}>定向简历方案包含什么</h3>
            <ul className={shared.emptyList}>
              <li>Step 1 岗位拆解：关键能力要求、JD 高频关键词、偏好画像，以及你简历中「像 / 不像数据分析」的表达</li>
              <li>Step 2 改写策略：哪些经历改成数据驱动表达、哪些 bullet 要补方法与指标、哪些弱化</li>
              <li>Step 3 优化后简历：按相关度重排的实习 / 项目与整份可投递文案，支持一键复制</li>
              <li>Step 4 补充建议：还缺的能力证据、值得补量化结果的项目、面试重点展开的经历</li>
            </ul>
            <p className={shared.emptyFootnote}>
              需要先做投递可行性判断，可先使用
              <Link to="/evaluate" className={shared.inlineLink}>
                单岗位评估
              </Link>
              。
            </p>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
