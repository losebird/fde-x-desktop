import { Loader2, X } from 'lucide-react'
import { PreviewChangesList, rollbackChangesFromAudit } from '@/components/biz/PreviewChangesList'
import type { PreviewChange } from '@/lib/biz-sheet-display'

type Props = {
  kind: string
  recordNo: string
  action: string
  changes: PreviewChange[]
  loading?: boolean
  error?: string
  onClose: () => void
  onConfirm: () => void
}

export function BizRollbackConfirmDrawer({
  kind,
  recordNo,
  action,
  changes,
  loading,
  error,
  onClose,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-line shadow-lg z-40 flex flex-col">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">回退确认</div>
          <div className="text-xs text-ink-muted mt-0.5">
            将恢复{kind ? ` ${kind}` : ''}{recordNo ? ` ${recordNo}` : ''} 的字段
          </div>
        </div>
        <button type="button" className="btn !py-1 shrink-0" onClick={onClose} aria-label="关闭回退确认">
          <X size={14} />
          <span className="ml-1">关闭</span>
        </button>
      </div>

      <div className="p-4 flex-1 overflow-auto space-y-4 text-sm">
        <div className="rounded border border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted">
          原操作：<span className="text-ink">{action}</span>
          {kind ? <> · 业务型：<span className="text-ink">{kind}</span></> : null}
        </div>
        <div className="text-xs text-ink-muted">以下字段将从当前值写回为历史值（仅列有差异的字段）：</div>
        <PreviewChangesList changes={changes} />
      </div>

      <div className="p-4 border-t border-line space-y-2">
        {error && (
          <div className="text-xs text-accent-red bg-red-50 border border-red-200 px-3 py-2">{error}</div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" disabled={loading} onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-brand flex-1" disabled={loading || !changes.length} onClick={onConfirm}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : '确认回退并写回'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function rollbackDrawerChanges(
  auditChanges: Array<{ label?: string; field?: string; key?: string; from?: unknown; to?: unknown }>,
  serverRollback?: Array<{ label?: string; field?: string; from?: unknown; to?: unknown }>,
) {
  if (Array.isArray(serverRollback) && serverRollback.length) {
    return serverRollback.map((item) => ({
      label: String(item.label || item.field || '').trim() || '字段',
      from: String(item.from ?? '—'),
      to: String(item.to ?? '—'),
    }))
  }
  return rollbackChangesFromAudit(auditChanges)
}
