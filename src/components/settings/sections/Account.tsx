import { SurfaceButton } from '@/components/surface/Button'
import { HostNsPanel } from '@/components/settings/HostNsPanel'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

export function AccountSection() {
  const ws = useApp((s) => s.workspaces)
  const resetDemo = useApp((s) => s.resetDemo)
  return (
    <div className="space-y-4">
      <HostNsPanel
        home="account"
        title="账户"
        hint="Host 账本。工作区数量是本机壳。"
      />
      <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
        <div className="text-kit-meta text-kit-secondary">工作区</div>
        <div className="mt-1 text-kit text-kit-ink">{ws.length} 个</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <SurfaceButton
            onClick={() => {
              const raw = window.localStorage.getItem('scene-39-workstation') || '{}'
              const blob = new Blob([raw], { type: 'application/json' })
              const link = document.createElement('a')
              link.href = URL.createObjectURL(blob)
              link.download = 'fde-x-shell.json'
              link.click()
              URL.revokeObjectURL(link.href)
            }}
          >
            导出账户数据
          </SurfaceButton>
          <SurfaceButton
            variant="danger"
            onClick={() => {
              void runtimeApi.disconnectAi().catch(() => undefined)
              resetDemo()
            }}
          >
            注销账户
          </SurfaceButton>
        </div>
      </section>
    </div>
  )
}
