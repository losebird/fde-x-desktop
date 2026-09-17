import { useState } from 'react'
import type { ContextPack } from '@/lib/context-pack'
import { contextChipSummary } from '@/lib/context-pack'

type Props = {
  pack: ContextPack | null
  warnings: string[]
  omit: Set<string>
  onToggleOmit: (key: string) => void
}

export function ContextChips({ pack, warnings, omit, onToggleOmit }: Props) {
  const [open, setOpen] = useState(false)
  const summary = contextChipSummary(pack, warnings)
  if (!summary) return null
  const muted = warnings.includes('memory_engine_not_ready') || warnings.some((w) => w.endsWith('_timeout'))
  const items: Array<{ key: string; label: string }> = []
  if (pack?.memory?.hits?.length) {
    pack.memory.hits.forEach((hit, index) => {
      items.push({ key: `memory:hit:${hit.id || index}`, label: `记忆：${hit.excerpt.slice(0, 40)}` })
    })
  }
  if (pack?.memory?.precedents?.length) {
    pack.memory.precedents.forEach((row, index) => {
      items.push({ key: `memory:prec:${row.id || index}`, label: `先例：${row.title}` })
    })
  }
  if (pack?.tasks?.today?.length) {
    pack.tasks.today.forEach((task) => {
      items.push({ key: `tasks:${task.id}`, label: `待办：${task.title}` })
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="px-2 py-1 text-[11px] rounded border border-line bg-white text-ink hover:border-brand"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={muted ? 'text-ink-subtle' : ''}>{summary}</span>
      </button>
      {open && items.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 bg-white border border-line rounded-md shadow-lg py-1 min-w-52 z-30 max-h-48 overflow-auto">
          {items.map((item) => {
            const scopeKey = item.key.split(':')[0]
            const off = omit.has(scopeKey) || omit.has(item.key)
            return (
              <button
                key={item.key}
                type="button"
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-2"
                onClick={() => onToggleOmit(scopeKey)}
              >
                {off ? '（已取消）' : ''}{item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
