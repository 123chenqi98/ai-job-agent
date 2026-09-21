import { useRef, useState, type DragEvent } from 'react'
import { uploadResume } from '@/auth/authClient'
import styles from './MyResume.module.css'

// 简历上传：拖拽 / 点选 PDF；客户端先校验类型与 10MB 体积，服务端再校验 PDF 头与可解析性。
// ResumeUploadForm 同时服务「无简历引导」与「更换简历」两个场景。

const MAX_SIZE = 10 * 1024 * 1024

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function ResumeUploadForm({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickFile = (file: File | null | undefined) => {
    setError(null)
    if (!file) return
    if (!isPdf(file)) {
      setError('仅支持 PDF 格式，请重新导出简历。')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('文件超过 10MB，请压缩或重新导出后上传。')
      return
    }
    setPicked(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    pickFile(event.dataTransfer.files?.[0])
  }

  const submit = async () => {
    if (!picked) return
    setBusy(true)
    setError(null)
    const result = await uploadResume(picked)
    setBusy(false)
    if (result.ok) onUploaded()
    else setError(result.msg)
  }

  return (
    <div className={styles.uploadForm}>
      <div
        className={dragging ? `${styles.dropZone} ${styles.dropZoneActive}` : styles.dropZone}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        {picked ? (
          <div className={styles.dropPicked}>
            <span className={styles.dropName}>{picked.name}</span>
            <span className={styles.dropSize}>{(picked.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        ) : (
          <div className={styles.dropPicked}>
            <span className={styles.dropName}>点击选择或把简历 PDF 拖到这里</span>
            <span className={styles.dropSize}>PDF · 不超过 10MB</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>

      {error ? <div className={styles.accessError}>{error}</div> : null}

      <div className={styles.uploadActions}>
        <button
          type="button"
          className={styles.accessSubmit}
          disabled={!picked || busy}
          onClick={submit}
        >
          {busy ? '上传并解析中…' : '上传简历'}
        </button>
        {picked && !busy ? (
          <button type="button" className={styles.textButton} onClick={() => setPicked(null)}>
            重新选择
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default function ResumeUploadCard({
  onUploaded,
  onLogout,
}: {
  onUploaded: () => void
  onLogout: () => void
}) {
  return (
    <div className={styles.accessWrap}>
      <div className={styles.accessCard}>
        <span className={styles.accessBrand}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
            <path d="M13 3v6h6" />
          </svg>
        </span>
        <h2 className={styles.accessTitle}>上传你的简历</h2>
        <p className={styles.accessSubtitle}>
          所有 AI 分析（岗位匹配、简历改写、面试准备）都会基于这份简历。文件加密存储于独立目录，仅你本人可读取。
        </p>
        <ResumeUploadForm onUploaded={onUploaded} />
        <div className={styles.accessSwitch}>
          <button type="button" onClick={onLogout}>退出登录，换个账号</button>
        </div>
      </div>
    </div>
  )
}
