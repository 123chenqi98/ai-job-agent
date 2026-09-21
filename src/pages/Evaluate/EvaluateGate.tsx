import { Link } from 'react-router-dom'
import { useAccount } from '@/auth/AuthProvider'
import styles from './Evaluate.module.css'

// AI 能力门禁提示：未登录 / 已登录未上传简历两种状态的引导卡；ready（已登录且有简历）时不渲染。
// 同时导出 useResumeReady 供各触发按钮做前置拦截，避免把请求发到服务端才被拒。

export function useResumeReady(): { ready: boolean; reason: 'login' | 'upload' | null } {
  const { loading, logged, hasResume } = useAccount()
  if (loading) return { ready: false, reason: null }
  if (!logged) return { ready: false, reason: 'login' }
  if (!hasResume) return { ready: false, reason: 'upload' }
  return { ready: true, reason: null }
}

export default function AccessNotice({ onClose }: { onClose?: () => void }) {
  const { loading, logged, hasResume } = useAccount()
  if (loading) return null
  if (logged && hasResume) return null

  return (
    <div className={styles.gateNotice}>
      {!logged ? (
        <>
          <h3 className={styles.gateTitle}>登录后即可使用 AI 岗位评估</h3>
          <p className={styles.gateText}>
            AI 会基于<strong>你本人</strong>的简历做硬门槛核对与匹配评分。每人独立账号，简历互不可见；注册只需 30 秒。
          </p>
        </>
      ) : (
        <>
          <h3 className={styles.gateTitle}>先上传简历，才能开始评估</h3>
          <p className={styles.gateText}>
            尚未检测到你的简历 PDF。上传后 AI 即可对照你的真实背景输出评分、证据与缺口；文件仅你本人可见。
          </p>
        </>
      )}
      <div className={styles.gateActions}>
        <Link to="/resume" className={styles.gateButton}>
          {!logged ? '去登录 / 注册' : '去上传简历'}
        </Link>
        {onClose ? (
          <button type="button" className={styles.gateGhost} onClick={onClose}>
            稍后再说
          </button>
        ) : null}
      </div>
    </div>
  )
}
