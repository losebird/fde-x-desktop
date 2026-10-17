import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class StatusErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const error = this.state.error
    if (!error) return this.props.children
    return (
      <div role="alert" className="rounded-kit-lg border border-kit-line bg-kit-card p-4 text-kit-sm text-kit-ink">
        <p>运行状态不完整，这一页暂时显示不了。</p>
      </div>
    )
  }
}
