import { SurfaceButton } from '@/components/surface/Button'
import { SurfaceGroup, SurfaceGroupRow } from '@/components/surface/Group'
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
        hint="本机核心账户。工作区数量是本机壳。"
      />
      <SurfaceGroup title="工作台向导">
        <SurfaceGroupRow>
          <p className="text-kit-sm leading-5 text-kit-secondary">第一次打开应用时会带着走一遍早报、计划、IM、文件、业务、连接器、技能、记忆和会话。这里只在以后想重看时用。</p>
          <div className="mt-3">
            <SurfaceButton onClick={() => window.dispatchEvent(new Event('fde-x-tour-open'))}>再走一遍</SurfaceButton>
          </div>
        </SurfaceGroupRow>
      </SurfaceGroup>
      <SurfaceGroup title="工作区">
        <SurfaceGroupRow>
          <div className="text-kit text-kit-ink">{ws.length} 个</div>
          <div className="mt-3 flex flex-wrap gap-2">
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
        </SurfaceGroupRow>
      </SurfaceGroup>
    </div>
  )
}
