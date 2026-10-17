import clsx from 'clsx'
import { kitFocus } from '@/components/surface/classes'

export function SurfaceSegmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ id: T; label: string }>
  disabled?: boolean
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-kit bg-kit-sunken p-0.5" role="tablist">
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            className={clsx(
              'rounded-[6px] px-2.5 py-1 text-kit-sm transition-[background-color,color,box-shadow] duration-kit-fast ease-kit',
              kitFocus,
              'disabled:cursor-not-allowed disabled:opacity-50',
              selected ? 'bg-kit-card font-medium text-kit-ink shadow-kit' : 'text-kit-secondary hover:text-kit-ink',
            )}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
