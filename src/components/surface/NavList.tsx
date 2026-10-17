import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { kitFocus } from '@/components/surface/classes'

export function SurfaceNav({
  value,
  onChange,
  items,
}: {
  value: string
  onChange: (id: string) => void
  items: Array<{ id: string; label: string; icon?: LucideIcon }>
}) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="分类">
      {items.map((item) => {
        const selected = item.id === value
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            className={clsx(
              'flex w-full items-center gap-2 rounded-kit px-2 py-1.5 text-left text-kit-sm',
              'transition-colors duration-kit-fast ease-kit',
              kitFocus,
              selected ? 'bg-kit-brand-soft font-medium text-kit-brand-ink' : 'text-kit-secondary hover:bg-kit-muted hover:text-kit-ink',
            )}
            onClick={() => onChange(item.id)}
          >
            {Icon ? <Icon size={14} strokeWidth={1.75} /> : null}
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
