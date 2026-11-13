import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { kitFocus } from '@/components/surface/classes'

export function SurfaceNav({
  value,
  onChange,
  items,
  layout = 'stack',
}: {
  value: string
  onChange: (id: string) => void
  items: Array<{ id: string; label: string; icon?: LucideIcon }>
  layout?: 'stack' | 'wrap'
}) {
  return (
    <nav
      className={clsx(
        'rounded-kit-lg border border-kit-line bg-kit-sunken p-1',
        layout === 'wrap' ? 'grid grid-cols-4 gap-1' : 'flex flex-col gap-0.5',
      )}
      aria-label="分类"
    >
      {items.map((item) => {
        const selected = item.id === value
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            className={clsx(
              'flex items-center gap-1.5 rounded-kit text-left text-kit-sm font-medium',
              'transition-[background-color,color,box-shadow] duration-kit-fast ease-kit',
              kitFocus,
              layout === 'wrap' ? 'min-h-9 flex-col justify-center gap-1 px-1 py-2 text-center sm:flex-row sm:px-2' : 'w-full px-2.5 py-2',
              selected
                ? 'bg-kit-brand text-white shadow-kit'
                : 'text-kit-secondary hover:bg-kit-card hover:text-kit-ink',
            )}
            onClick={() => onChange(item.id)}
          >
            {Icon ? <Icon size={layout === 'wrap' ? 16 : 15} strokeWidth={selected ? 2 : 1.75} /> : null}
            <span className="max-w-full truncate leading-none">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
