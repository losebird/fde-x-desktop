import * as Switch from '@radix-ui/react-switch'
import clsx from 'clsx'
import { kitFocus } from '@/components/surface/classes'

function SwitchControl({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <Switch.Root
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className={clsx(
        'relative mt-0.5 h-[18px] w-8 shrink-0 rounded-full bg-kit-line-strong',
        'transition-colors duration-kit ease-kit data-[state=checked]:bg-kit-brand',
        kitFocus,
        'disabled:cursor-not-allowed',
      )}
    >
      <Switch.Thumb className="block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-kit ease-kit data-[state=unchecked]:translate-x-[2px] data-[state=checked]:translate-x-[16px]" />
    </Switch.Root>
  )
}

export function SurfaceSwitch({
  checked,
  onCheckedChange,
  disabled,
  label,
  hint,
  bare,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  label: string
  hint?: string
  bare?: boolean
}) {
  if (bare) {
    return (
      <SwitchControl
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        label={label}
      />
    )
  }
  return (
    <label className={clsx('flex items-start justify-between gap-3 py-2', disabled && 'opacity-60')}>
      <span className="min-w-0">
        <span className="block text-kit text-kit-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-kit-meta text-kit-secondary">{hint}</span> : null}
      </span>
      <SwitchControl
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        label={label}
      />
    </label>
  )
}
