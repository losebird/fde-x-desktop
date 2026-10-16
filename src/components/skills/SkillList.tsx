import { ChevronRight } from 'lucide-react'
import { SurfaceSwitch } from '@/components/surface'
import type { SkillBagItem } from '@/lib/runtime-api'

export function SkillList({
  rows,
  selected,
  busy,
  onOpen,
  onToggle,
}: {
  rows: SkillBagItem[]
  selected: string
  busy: boolean
  onOpen: (id: string) => void
  onToggle: (row: SkillBagItem, enabled: boolean) => void
}) {
  return (
    <div className="overflow-hidden rounded-kit-lg border border-kit-line bg-kit-card">
      {rows.map((row) => {
        const manageable = row.origin === 'catalog' && Boolean(row.path)
        const on = row.modelInvocable !== false
        return (
          <div key={row.id} className="flex items-center gap-2 border-b border-kit-line px-3 py-2.5 last:border-b-0">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-kit py-0.5 text-left hover:bg-kit-muted"
              aria-current={selected === row.id ? 'true' : undefined}
              onClick={() => onOpen(row.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-kit font-medium text-kit-ink">{row.name}</span>
                <span className="block truncate text-kit-meta text-kit-secondary">
                  {row.description || (row.methods?.length ? row.methods.join(' · ') : (row.modelInvocable === false ? '停用' : '技能'))}
                </span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-kit-tertiary" />
            </button>
            {manageable ? (
              <SurfaceSwitch
                bare
                checked={on}
                disabled={busy}
                label={on ? `停用 ${row.name}` : `启用 ${row.name}`}
                onCheckedChange={(next) => onToggle(row, next)}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
