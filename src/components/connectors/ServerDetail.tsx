import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { SurfaceBanner, SurfaceButton } from '@/components/surface'
import type { McpServerV2 } from '@/lib/runtime-api'
import { commandLine, statusLabel, toolLabel, transportLabel } from '@/components/connectors/draft'

export function ServerDetail({
  row,
  resourceTools,
  showBack,
  busy,
  health,
  onBack,
  onTest,
  onEdit,
  onDelete,
  onEnabled,
}: {
  row: McpServerV2 | null
  resourceTools: string[]
  showBack: boolean
  busy: boolean
  health: string
  onBack: () => void
  onTest: (serverName: string) => void
  onEdit: (row: McpServerV2) => void
  onDelete: (serverName: string) => void
  onEnabled: (serverName: string, enabled: boolean) => void
}) {
  const [menu, setMenu] = useState(false)
  const [confirming, setConfirming] = useState(false)
  if (!row) {
    return (
      <div className="rounded-kit-lg border border-dashed border-kit-line px-4 py-8 text-center text-kit-sm text-kit-secondary">
        {showBack ? (
          <div className="mb-3">
            <SurfaceButton size="sm" variant="ghost" onClick={onBack}>
              <ChevronLeft size={14} /> 返回
            </SurfaceButton>
          </div>
        ) : null}
        选一台服务器查看工具和连接结果。
      </div>
    )
  }
  const resources = resourceTools.filter((name) => name.includes(row.serverName))
  const on = !row.disabled && row.status !== 'disabled'
  return (
    <div className="rounded-kit-lg border border-kit-line bg-kit-card px-3 py-3">
      <div className="flex items-center gap-2">
        {showBack ? (
          <SurfaceButton size="sm" variant="ghost" onClick={onBack}>
            <ChevronLeft size={14} /> 返回
          </SurfaceButton>
        ) : null}
        <div className="min-w-0 flex-1 truncate text-kit-title font-semibold text-kit-ink">{row.serverName}</div>
        <SurfaceButton size="sm" disabled={busy} onClick={() => onTest(row.serverName)}>测试连接</SurfaceButton>
        <div className="relative">
          <SurfaceButton size="sm" variant="ghost" aria-expanded={menu} aria-haspopup="menu" onClick={() => { setMenu((open) => !open); setConfirming(false) }}>
            更多
          </SurfaceButton>
          {menu ? (
            <div role="menu" className="absolute right-0 z-10 mt-1 w-36 rounded-kit border border-kit-line bg-kit-card p-1 shadow-kit">
              <button type="button" role="menuitem" className="block w-full rounded-kit px-2 py-1.5 text-left text-kit-sm hover:bg-kit-muted" onClick={() => { setMenu(false); onEdit(row) }}>
                编辑
              </button>
              <button type="button" role="menuitem" className="block w-full rounded-kit px-2 py-1.5 text-left text-kit-sm text-kit-danger hover:bg-kit-danger-soft" onClick={() => { setMenu(false); setConfirming(true) }}>
                删除
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 text-kit-sm text-kit-secondary">{statusLabel(row.status)} · {transportLabel(row.transport)}</div>
      {commandLine(row) ? <div className="mt-1 break-all font-mono text-kit-meta text-kit-ink">{commandLine(row)}</div> : null}
      {confirming ? (
        <div className="mt-3">
          <SurfaceBanner tone="warn">删除后，这台服务器会从档案里去掉。</SurfaceBanner>
          <div className="mt-2 flex justify-end gap-2">
            <SurfaceButton size="sm" onClick={() => setConfirming(false)}>取消</SurfaceButton>
            <SurfaceButton size="sm" variant="danger" disabled={busy} onClick={() => onDelete(row.serverName)}>删除</SurfaceButton>
          </div>
        </div>
      ) : null}
      <div className="mt-3 border-t border-kit-line pt-3">
        <div className="text-kit-sm font-medium text-kit-ink">工具 {row.tools.length}</div>
        {row.tools.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.tools.map((name) => (
              <span key={name} className="rounded-kit bg-kit-muted px-2 py-0.5 text-kit-meta text-kit-ink">{toolLabel(row.serverName, name)}</span>
            ))}
          </div>
        ) : <div className="mt-1 text-kit-sm text-kit-secondary">还没有工具。</div>}
      </div>
      <div className="mt-3 border-t border-kit-line pt-3">
        <div className="text-kit-sm font-medium text-kit-ink">资源 {resources.length}</div>
        {resources.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {resources.map((name) => (
              <span key={name} className="rounded-kit bg-kit-muted px-2 py-0.5 text-kit-meta text-kit-ink">{toolLabel(row.serverName, name)}</span>
            ))}
          </div>
        ) : <div className="mt-1 text-kit-sm text-kit-secondary">这一场会话还没有资源。</div>}
      </div>
      {health ? (
        <div className="mt-3 border-t border-kit-line pt-3 text-kit-sm text-kit-secondary">{health}</div>
      ) : null}
      <div className="mt-3">
        <SurfaceButton size="sm" variant="quiet" disabled={busy} onClick={() => onEnabled(row.serverName, !on)}>
          {on ? '停用' : '启用'}
        </SurfaceButton>
      </div>
    </div>
  )
}
