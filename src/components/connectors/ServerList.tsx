import { ChevronRight } from 'lucide-react'
import { SurfaceSwitch } from '@/components/surface'
import type { McpServerV2 } from '@/lib/runtime-api'
import { statusLabel, transportLabel } from '@/components/connectors/draft'

function dotClass(status: McpServerV2['status']) {
  if (status === 'loaded') return 'bg-kit-brand'
  if (status === 'failed') return 'bg-kit-danger'
  if (status === 'disabled') return 'bg-kit-line-strong'
  return 'bg-kit-warn'
}

function rowHint(row: McpServerV2) {
  const via = transportLabel(row.transport)
  if (row.status === 'failed' || row.status === 'disabled' || row.status === 'needs-reload') {
    return `${via} · ${statusLabel(row.status)}`
  }
  return `${via} · ${row.tools.length} 个工具`
}

export function ServerList({
  rows,
  selected,
  busy,
  onOpen,
  onEnabled,
}: {
  rows: McpServerV2[]
  selected: string
  busy: boolean
  onOpen: (serverName: string) => void
  onEnabled: (serverName: string, enabled: boolean) => void
}) {
  return (
    <div className="overflow-hidden rounded-kit-lg border border-kit-line bg-kit-card">
      {rows.map((row) => {
        const on = !row.disabled && row.status !== 'disabled'
        return (
          <div key={row.serverName} className="flex items-center gap-2 border-b border-kit-line px-3 py-2.5 last:border-b-0">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-kit py-0.5 text-left hover:bg-kit-muted"
              aria-current={selected === row.serverName ? 'true' : undefined}
              onClick={() => onOpen(row.serverName)}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass(row.status)}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-kit font-medium text-kit-ink">{row.serverName}</span>
                <span className="block truncate text-kit-meta text-kit-secondary">{rowHint(row)}</span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-kit-tertiary" />
            </button>
            <SurfaceSwitch
              bare
              checked={on}
              disabled={busy}
              label={on ? `停用 ${row.serverName}` : `启用 ${row.serverName}`}
              onCheckedChange={(next) => onEnabled(row.serverName, next)}
            />
          </div>
        )
      })}
    </div>
  )
}
