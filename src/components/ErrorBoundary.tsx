import React from 'react'

type Props = { children: React.ReactNode }
type State = { error: Error | null; info: string }

/**
 * 出问题时不让整屏白掉——把错误显示出来，用户可以直接复制反馈。
 * 界面本身不依赖任何外部资源，出错时依旧可读。
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 仅本地记录，不上报
    console.error('[shiro] render error:', error, info.componentStack)
    this.setState({ info: String(info.componentStack || '') })
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#0a1a2f', background: '#e8eff8', height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, background: '#e4474d', borderRadius: 999 }} />
          <strong style={{ fontSize: 15 }}>界面渲染出错 / Render error</strong>
        </div>
        <div style={{ background: '#fff', border: '1px solid #d6e2f2', padding: 12, marginBottom: 12, fontSize: 13 }}>
          {String(error.message || error)}
        </div>
        <div style={{ fontSize: 12, color: '#7a8fae', marginBottom: 8 }}>
          把下面这段复制给作者可以帮助定位问题（不含任何个人信息）：
        </div>
        <pre
          style={{
            background: '#08182c',
            color: '#cfe2ff',
            padding: 12,
            fontSize: 11,
            lineHeight: 1.6,
            overflow: 'auto',
            border: '1px solid #16325c'
          }}
        >
          {info || String(error.stack || '')}
        </pre>
        <button
          onClick={() => this.setState({ error: null, info: '' })}
          style={{
            marginTop: 12,
            padding: '7px 14px',
            background: '#1e5fd1',
            color: '#fff',
            border: 'none',
            fontSize: 13,
            cursor: 'pointer'
          }}
        >
          重试 / Retry
        </button>
      </div>
    )
  }
}
