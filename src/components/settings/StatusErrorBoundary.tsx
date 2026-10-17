import { Component, type ReactNode } from 'react'
import { ContractError } from '@/components/settings/core-connection'

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
    const message = error instanceof ContractError ? error.message : `运行时状态格式不对：${error.message}`
    return (
      <div role="alert" className="rounded-kit-lg border border-kit-line bg-kit-card p-4 text-kit-sm text-kit-ink">
        <p>{message}</p>
        <p className="mt-2 text-kit-secondary">恢复建议：请重新执行 pnpm dev 后再打开这一页。</p>
      </div>
    )
  }
}
