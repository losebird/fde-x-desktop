import clsx from 'clsx'
import {
  workflowToolCopy,
  workflowToolTier,
  type WorkflowToolTier,
} from '@/lib/workflow-tool-copy'

export interface WorkflowToolOption {
  name: string
  tier: string
}

const TIER_ORDER: WorkflowToolTier[] = ['read', 'propose', 'danger', 'wait']

export function WorkflowToolPicker({
  tools,
  selected,
  pendingDanger,
  note,
  onToggle,
  onConfirmDanger,
  onCancelDanger,
}: {
  tools: WorkflowToolOption[]
  selected: string[]
  pendingDanger: string | null
  note: string
  onToggle: (name: string, tier: WorkflowToolTier, checked: boolean) => void
  onConfirmDanger: () => void
  onCancelDanger: () => void
}) {
  const chosen = new Set(selected)
  return (
    <div>
      <div className="text-xs text-ink-muted">{workflowToolCopy.pickerLabel}</div>
      {pendingDanger && (
        <div className="mt-2 border border-red-200 bg-red-50 p-3">
          <div className="text-sm text-accent-red font-mono">{pendingDanger}</div>
          <div className="mt-1 text-sm text-accent-red">{workflowToolCopy.dangerConfirm}</div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn" onClick={onCancelDanger}>{workflowToolCopy.cancelDanger}</button>
            <button type="button" className="btn text-accent-red" onClick={onConfirmDanger}>{workflowToolCopy.confirmDanger}</button>
          </div>
        </div>
      )}
      <div className="mt-2 max-h-52 overflow-y-auto border border-line rounded p-2 space-y-3">
        {TIER_ORDER.map((tier) => {
          const rows = tools.filter((row) => workflowToolTier(row.tier) === tier)
          if (rows.length === 0) return null
          const danger = tier === 'danger'
          const waiting = tier === 'wait'
          return (
            <div key={tier}>
              <div className={clsx('text-[11px] mb-1', danger && 'text-accent-red', waiting && 'text-accent-amber', !danger && !waiting && 'text-ink-muted')}>
                {workflowToolCopy.tier[tier]}
              </div>
              <div className="space-y-1">
                {rows.map((row) => (
                  <label key={row.name} className={clsx('flex items-center gap-2 text-xs font-mono', danger && 'text-accent-red', waiting && 'text-accent-amber')}>
                    <input
                      type="checkbox"
                      checked={chosen.has(row.name)}
                      onChange={(event) => onToggle(row.name, tier, event.target.checked)}
                    />
                    <span>{row.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {note && <div className="mt-2 text-xs text-accent-red">{note}</div>}
    </div>
  )
}
