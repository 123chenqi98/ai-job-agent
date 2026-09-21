import { useEffect, useRef, useState } from 'react'
import { fetchPayment, uploadPaymentProof } from '@/auth/authClient'
import type { PaymentProofState } from '@/types/resume'
import styles from './PaymentWall.module.css'

// 付费门槛：展示 ¥1.66 微信收款码，用户付款后上传截图，站长审核通过后开通。
// 仅作引导与凭证提交；真正的访问拦截在服务端（402），绕过此组件也无法使用。

type GateState = 'loading' | 'form' | 'pending' | 'ready'

export default function PaymentWall({
  onAccessChanged,
}: {
  onAccessChanged: () => Promise<unknown> | unknown
}) {
  const [gate, setGate] = useState<GateState>('loading')
  const [proof, setProof] = useState<PaymentProofState | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function syncFromServer() {
    const result = await fetchPayment()
    if (result.ok) {
      if (result.paid) {
        setGate('ready')
        await onAccessChanged()
        return
      }
      setProof(result.proof)
      setGate(result.proof?.status === 'pending' ? 'pending' : 'form')
      return
    }
    setError(result.msg)
    setGate('form')
  }

  useEffect(() => {
    void syncFromServer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePickFile(file: File | undefined) {
    if (!file || uploading) return
    setError('')
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setError('仅支持 JPG / PNG 格式的付款截图。')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('截图不能超过 5MB。')
      return
    }
    setUploading(true)
    const result = await uploadPaymentProof(file)
    setUploading(false)
    if (result.ok) {
      setProof(result.proof)
      setGate('pending')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setError(result.msg)
  }

  if (gate === 'loading') {
    return <div className={styles.stateBlock}>正在确认开通状态…</div>
  }

  return (
    <div className={styles.wall}>
      <div className={styles.badge}>开通后解锁</div>
      <h1 className={styles.title}>简历上传与 AI 解析</h1>
      <p className={styles.lead}>
        一次性支付 <strong className={styles.price}>¥1.66</strong>，即可上传简历并使用 AI
        岗位匹配、简历改写与面试准备。岗位池与投递看板始终免费。
      </p>

      <div className={styles.body}>
        <div className={styles.qrBox}>
          <img
            className={styles.qr}
            src="/wechat-pay.jpg"
            alt="微信支付 ¥1.66 收款码"
            width="280"
            height="280"
          />
          <p className={styles.qrHint}>微信扫码支付 ¥1.66</p>
        </div>

        <div className={styles.steps}>
          <ol className={styles.stepList}>
            <li>用微信扫描左侧二维码完成支付（金额 ¥1.66）。</li>
            <li>对支付成功页面截图，确保能看到金额与时间。</li>
            <li>在下方上传截图，站长审核通过后自动开通。</li>
          </ol>

          {gate === 'pending' ? (
            <div className={styles.pendingBox}>
              <p className={styles.pendingTitle}>已收到你的凭证，正在等待审核</p>
              <p className={styles.pendingDesc}>
                站长核对到账后即为你开通，通常很快。可稍后点下方按钮刷新查看。
              </p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void syncFromServer()}
              >
                刷新开通状态
              </button>
            </div>
          ) : (
            <div className={styles.uploadBox}>
              {proof?.status === 'rejected' ? (
                <p className={styles.rejectText}>
                  上一张凭证未通过审核{proof.reject_reason ? `：${proof.reject_reason}` : ''}
                  ，请核对后重新上传。
                </p>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className={styles.fileInput}
                onChange={(e) => void handlePickFile(e.target.files?.[0])}
              />
              <button
                type="button"
                className={styles.primaryButton}
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? '上传中…' : '选择并上传付款截图'}
              </button>
              <p className={styles.muted}>支持 JPG / PNG，大小不超过 5MB。</p>
            </div>
          )}

          {error ? <p className={styles.errorText}>{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
