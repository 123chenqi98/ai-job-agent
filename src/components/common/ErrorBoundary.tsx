import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// 全站兜底：单个页面渲染异常（如 AI 返回结构缺字段）不再整站白屏，
// 给出可理解的错误卡与「刷新页面」出口
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] 页面渲染异常：', error, info.componentStack)
  }

  private reload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div
        style={{
          margin: '24px auto',
          maxWidth: 560,
          padding: '32px 28px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-danger-border)',
          borderRadius: 14,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-danger)' }}>
          页面渲染出了点问题
        </div>
        <p
          style={{
            margin: '10px 0 20px',
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--color-text-secondary)',
          }}
        >
          数据可能临时异常。你的投递记录与评估历史都没有丢失，刷新页面即可恢复；如反复出现，请稍后再试。
        </p>
        <button
          type="button"
          onClick={this.reload}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          刷新页面
        </button>
      </div>
    )
  }
}
