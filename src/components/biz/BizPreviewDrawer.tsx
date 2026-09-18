import { Loader2, X } from 'lucide-react'
import { PreviewChangesList } from '@/components/biz/PreviewChangesList'
import { buildPreviewSummary, normalizeSheetColumns, type SheetRow } from '@/lib/biz-sheet-display'

type Props = {
  sheet: Record<string, unknown>
  canWrite: boolean
  loading?: boolean
  gateReason?: string
  originalRow?: SheetRow
  columns?: Array<{ key: string; label?: string }>
  onClose: () => void
  onConfirm: () => void
}

export function BizPreviewDrawer({
  sheet,
  canWrite,
  loading,
  gateReason,
  originalRow,
  columns,
  onClose,
  onConfirm,
}: Props) {
  const summary = buildPreviewSummary(sheet, {
    originalRow,
    columns: columns?.length ? columns : normalizeSheetColumns(sheet.columns),
  })

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-line shadow-lg z-40 flex flex-col">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{summary.title}</div>
          {summary.subtitle && <div className="text-xs text-ink-muted mt-0.5">{summary.subtitle}</div>}
        </div>
        <button type="button" className="btn !py-1 shrink-0" onClick={onClose} aria-label="关闭预览">
          <X size={14} />
          <span className="ml-1">关闭</span>
        </button>
      </div>

      <div className="p-4 flex-1 overflow-auto space-y-4 text-sm">
        <div className="rounded border border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted">
          操作：<span className="text-ink">{summary.action}</span>
          {summary.kind ? <> · 业务型：<span className="text-ink">{summary.kind}</span></> : null}
        </div>

        <PreviewChangesList changes={summary.changes} />
      </div>

      <div className="p-4 border-t border-line space-y-2">
        {!canWrite && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2">
            {gateReason || '当前预览不允许写入，请先在 AI 会话获取写入令牌。'}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" disabled={loading} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-brand flex-1"
            disabled={!canWrite || loading}
            title={canWrite ? '' : (gateReason || '当前令牌不允许写入')}
            onClick={onConfirm}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : '确认过账'}
          </button>
        </div>
      </div>
    </div>
  )
}
