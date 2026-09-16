import { useCallback, useEffect, useRef, useState } from 'react'
import { logout } from '@/auth/authClient'
import LoginPage from '@/auth/LoginPage'
import SectionCard from '@/components/common/SectionCard'
import StateView from '@/components/common/StateView'
import {
  generateAiProfile,
  getAppConfig,
  getResume,
} from '@/data/resumeRepository'
import type {
  AiProfile,
  AppConfig,
  ResumeResponse,
} from '@/types/resume'
import JdStudio from './JdStudio'
import styles from './MyResume.module.css'

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : '读取简历失败，请稍后重试。'
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function ChipList({ items, tone }: { items: string[]; tone?: 'plain' | 'blue' }) {
  if (items.length === 0) return <span className={styles.mutedText}>—</span>
  return (
    <div className={styles.chipRow}>
      {items.map((item, idx) => (
        <span
          key={`${item}-${idx}`}
          className={tone === 'blue' ? styles.chipBlue : styles.chip}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function AiProfileView({ profile }: { profile: AiProfile }) {
  return (
    <div className={styles.aiResult}>
      <p className={styles.aiSummary}>{profile.summary}</p>

      <div className={styles.aiField}>
        <h4 className={styles.aiFieldLabel}>目标方向</h4>
        <ChipList items={profile.target_roles} tone="blue" />
      </div>
      <div className={styles.aiField}>
        <h4 className={styles.aiFieldLabel}>核心能力</h4>
        <ChipList items={profile.core_competencies} />
      </div>
      <div className={styles.aiField}>
        <h4 className={styles.aiFieldLabel}>硬技能 / 工具</h4>
        <ChipList items={[...profile.hard_skills, ...profile.tools]} tone="blue" />
      </div>

      <div className={styles.aiTwoCol}>
        <div>
          <h4 className={styles.aiFieldLabelHit}>简历亮点</h4>
          <ul className={styles.bulletList}>
            {profile.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className={styles.aiFieldLabelWarn}>客观短板与建议</h4>
          <ul className={styles.bulletListWarn}>
            {profile.weaknesses.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {profile.experience_map.length > 0 ? (
        <div className={styles.aiField}>
          <h4 className={styles.aiFieldLabel}>经历归属（AI 按上下文重排）</h4>
          <div className={styles.aiTimeline}>
            {profile.experience_map.map((exp, idx) => (
              <div key={idx} className={styles.aiTimelineItem}>
                <div className={styles.aiTimelineHead}>
                  <span className={styles.aiTimelineTitle}>
                    {exp.org} · {exp.title}
                  </span>
                  <span className={styles.aiTimelinePeriod}>{exp.period}</span>
                </div>
                <ul className={styles.aiTimelineBullets}>
                  {exp.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function MyResume() {
  const [resume, setResume] = useState<ResumeResponse | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  const [aiProfile, setAiProfile] = useState<AiProfile | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const [configRes, resumeRes] = await Promise.all([
        getAppConfig(controller.signal),
        getResume(controller.signal),
      ])
      setConfig(configRes)
      setResume(resumeRes)
    } catch (err) {
      if (isAbortError(err)) return
      if ((err as { status?: number }).status === 401) {
        setLocked(true)
        return
      }
      setError(errorText(err))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const runAiProfile = async () => {
    aiAbortRef.current?.abort()
    const controller = new AbortController()
    aiAbortRef.current = controller
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await generateAiProfile(controller.signal)
      setAiProfile(res.profile)
    } catch (err) {
      if (!isAbortError(err)) setAiError(errorText(err))
    } finally {
      if (!controller.signal.aborted) setAiLoading(false)
    }
  }

  const handleLock = async () => {
    await logout()
    setResume(null)
    setAiProfile(null)
    setLocked(true)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <StateView title="正在解析本地简历…" description="正在读取 server/data/resume.pdf 的文本层，请稍候。" />
      </div>
    )
  }

  if (locked) {
    return (
      <div className={styles.page}>
        <LoginPage
          onSuccess={() => {
            setLocked(false)
            void load()
          }}
        />
      </div>
    )
  }

  if (error || !resume) {
    return (
      <div className={styles.page}>
        <StateView
          title="简历解析失败"
          description={
            <>
              {error}
              <br />
              请确认简历 PDF 已放到 server/data/resume.pdf，或在 server/.env 配置 RESUME_PDF_PATH，并运行 npm run dev:all。
            </>
          }
          actions={
            <button type="button" className={styles.retryButton} onClick={() => void load()}>
              重新解析
            </button>
          }
        />
      </div>
    )
  }

  const { profile, source } = resume
  const arkConfigured = config?.ark_configured ?? false

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>我的简历</h1>
          <p className={styles.subtitle}>
            简历 PDF 在本机解析为结构化画像，作为岗位匹配与定向改写的事实来源；飞书岗位数据不会回写。
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.refreshButton} onClick={() => void load()}>
            重新解析
          </button>
          <button
            type="button"
            className={styles.lockButton}
            title="立即清除本机解锁状态，下次查看需重新输入密码"
            onClick={() => void handleLock()}
          >
            锁定简历
          </button>
          <span className={styles.syncMeta}>
            {source.file_name} · {source.pages} 页 · {formatTime(source.parsed_at)}
          </span>
        </div>
      </header>

      <div className={styles.overviewGrid}>
        <SectionCard>
          <div className={styles.identityCard}>
            <div className={styles.identityName}>{profile.name ?? '未识别姓名'}</div>
            <div className={styles.identityTarget}>{profile.target ?? '—'}</div>
            <dl className={styles.infoList}>
              <div>
                <dt>电话</dt>
                <dd>{profile.phone ?? '—'}</dd>
              </div>
              <div>
                <dt>邮箱</dt>
                <dd>{profile.email ?? '—'}</dd>
              </div>
              <div>
                <dt>政治面貌</dt>
                <dd>{profile.politics ?? '—'}</dd>
              </div>
              <div>
                <dt>作品链接</dt>
                <dd>
                  {profile.links.length === 0
                    ? '—'
                    : profile.links.map((link) => (
                        <a
                          key={link}
                          className={styles.inlineLink}
                          href={link}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {link.replace(/^https?:\/\//, '')}
                        </a>
                      ))}
                </dd>
              </div>
            </dl>
          </div>
        </SectionCard>

        {profile.education ? (
          <SectionCard title="教育背景">
            <div className={styles.eduSchool}>{profile.education.school}</div>
            <div className={styles.eduMajor}>
              {[profile.education.major, profile.education.degree].filter(Boolean).join(' · ')}
            </div>
            <dl className={styles.infoList}>
              <div>
                <dt>在读时间</dt>
                <dd>{profile.education.period}</dd>
              </div>
              <div>
                <dt>毕业年份</dt>
                <dd>{profile.education.graduation_year ?? '—'}</dd>
              </div>
              <div>
                <dt>GPA</dt>
                <dd>
                  {profile.education.gpa ?? '—'}
                  {profile.education.rank ? `（${profile.education.rank}）` : ''}
                </dd>
              </div>
            </dl>
            {profile.education.highlights.length > 0 ? (
              <ul className={styles.eduHighlights}>
                {profile.education.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : null}
          </SectionCard>
        ) : null}
      </div>

      <SectionCard title="实习经历">
        <div className={styles.timelineList}>
          {profile.internships.map((exp, idx) => (
            <div key={idx} className={styles.timelineItem}>
              <span className={styles.timelinePeriod}>{exp.period}</span>
              <span className={styles.timelineTitle}>{exp.title}</span>
            </div>
          ))}
        </div>
        <p className={styles.sectionFootnote}>
          规则画像按时间行识别出 {profile.internships.length} 段实习；具体 bullet
          的段落归属见下方 AI 深度画像。
        </p>
      </SectionCard>

      <SectionCard title="项目经历">
        <div className={styles.timelineList}>
          {profile.projects.map((exp, idx) => (
            <div key={idx} className={styles.timelineItem}>
              <span className={styles.timelinePeriod}>{exp.period}</span>
              <span className={styles.timelineTitle}>{exp.title}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="专业技能">
        <div className={styles.skillGroupList}>
          {profile.skill_groups.map((group) => (
            <div key={group.name} className={styles.skillGroupRow}>
              <span className={styles.skillGroupName}>{group.name}</span>
              <span className={styles.skillGroupDetail}>{group.detail}</span>
            </div>
          ))}
        </div>
        <h4 className={styles.subLabel}>技能词命中（确定性匹配）</h4>
        <ChipList items={profile.skill_keywords} tone="blue" />
      </SectionCard>

      <SectionCard title="量化成果摘录">
        <ul className={styles.metricList}>
          {profile.metrics.map((m, idx) => (
            <li key={idx}>{m}</li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="AI 深度画像（火山方舟豆包）">
        {!arkConfigured ? (
          <div className={styles.aiNotice}>
            <h3 className={styles.aiNoticeTitle}>尚未配置豆包凭证</h3>
            <p className={styles.aiNoticeText}>
              在 <code>server/.env</code> 补全 <code>ARK_API_KEY</code> 与{' '}
              <code>ARK_MODEL</code>（推理接入点 ep-xxx）后重启服务，即可生成能力画像、亮点短板与经历归属。
            </p>
          </div>
        ) : !aiProfile ? (
          <div className={styles.aiEntry}>
            <p className={styles.aiEntryText}>
              点击后，简历全文将发送至火山方舟豆包进行一次性结构化分析（本机不会保存模型返回之外的任何数据）。
            </p>
            <button
              type="button"
              className={styles.jdPrimaryButton}
              disabled={aiLoading}
              onClick={() => void runAiProfile()}
            >
              {aiLoading ? '豆包分析中…' : '生成 AI 深度画像'}
            </button>
            {aiError ? <div className={styles.jdError}>{aiError}</div> : null}
          </div>
        ) : (
          <>
            <AiProfileView profile={aiProfile} />
            <button
              type="button"
              className={styles.refreshButton}
              disabled={aiLoading}
              onClick={() => void runAiProfile()}
            >
              {aiLoading ? '重新分析中…' : '重新生成'}
            </button>
          </>
        )}
      </SectionCard>

      <SectionCard title="JD 精分析与定向改写">
        <JdStudio arkConfigured={arkConfigured} />
      </SectionCard>

      <SectionCard title="自我评价">
        <ul className={styles.bulletList}>
          {profile.evaluations.map((e, idx) => (
            <li key={idx}>{e}</li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="解析原文（透明核对）">
        <details>
          <summary className={styles.rawSummary}>展开查看 PDF 抽取的原始文本（{resume.full_text.length} 字）</summary>
          <pre className={styles.rawText}>{resume.full_text}</pre>
        </details>
      </SectionCard>

      <p className={styles.note}>
        解析引擎：{source.engine}。简历文件仅保存在本机 server/data/（已加入 .gitignore）；规则画像完全在本地生成，只有点击「AI
        深度画像 / 匹配分析 / 简历改写」时，简历文本与所粘贴 JD 才会经本地服务发送给火山方舟豆包，工作台不向飞书写入、不执行自动投递。
      </p>
    </div>
  )
}
