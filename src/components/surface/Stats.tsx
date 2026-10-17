import type { ReactNode } from 'react'

export function SurfaceStats({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; hint?: string }>
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-kit-lg border border-kit-line bg-kit-card px-3 py-2.5 shadow-kit">
          <div className="truncate text-kit-meta text-kit-secondary">{item.label}</div>
          <div className="mt-1 truncate text-kit-stat font-semibold tabular-nums text-kit-ink">{item.value}</div>
          {item.hint ? <div className="mt-0.5 truncate text-kit-meta text-kit-tertiary">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  )
}
