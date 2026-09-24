import { formatSheetCellValue, type PreviewChange } from '@/lib/biz-sheet-display'

export function PreviewChangesList({
  changes,
  emptyMessage = '没有可展示的变更内容。',
  onPick,
}: {
  changes: PreviewChange[]
  emptyMessage?: string
  onPick?: (field: string, id: string) => void
}) {
  if (!changes.length) {
    return <div className="text-sm text-ink-muted">{emptyMessage}</div>
  }
  return (
    <div className="border border-line divide-y divide-line">
      {changes.map((change) => (
        <div key={change.label} className="px-3 py-2.5">
          <div className="text-xs text-ink-muted">{change.label}</div>
          {change.unbound ? (
            <div className="mt-1 text-amber-800">{change.hint || '这一格对不上'}</div>
          ) : change.from !== undefined && change.to !== undefined ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-ink-muted line-through">{change.from}</span>
              <span className="text-ink-subtle">→</span>
              <span className="text-ink font-medium">{change.to}</span>
            </div>
          ) : change.to !== undefined ? (
            <div className="mt-1 text-ink font-medium">{change.to}</div>
          ) : (
            <div className="mt-1 text-ink">{change.value ?? '—'}</div>
          )}
          {change.picks && change.picks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {change.picks.map((pick) => (
                <button
                  key={pick.id}
                  type="button"
                  className="btn !py-0.5 !text-[11px]"
                  onClick={() => onPick?.(change.field || '', pick.id)}
                >
                  {pick.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function rollbackChangesFromAudit(
  changes: Array<{ label?: string; field?: string; key?: string; from?: unknown; to?: unknown }>,
) {
  return changes.map((item) => {
    const label = String(item.label || item.field || item.key || '').trim() || '字段'
    const from = formatSheetCellValue(item.to)
    const to = formatSheetCellValue(item.from)
    if (from === to) return null
    return { label, from, to }
  }).filter(Boolean) as PreviewChange[]
}
