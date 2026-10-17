import { Slot } from '@radix-ui/react-slot'
import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'
import { kitFocus } from '@/components/surface/classes'

type Variant = 'primary' | 'quiet' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'border-transparent bg-kit-brand text-white hover:bg-kit-brand-ink',
  quiet: 'border-kit-line bg-kit-card text-kit-ink hover:bg-kit-muted',
  ghost: 'border-transparent bg-transparent text-kit-secondary hover:bg-kit-muted hover:text-kit-ink',
  danger: 'border-kit-line bg-kit-card text-kit-danger hover:bg-kit-danger-soft',
}

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-kit-sm',
  md: 'h-8 px-3 text-kit',
}

export function SurfaceButton({
  variant = 'quiet',
  size = 'md',
  className,
  asChild = false,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      type={asChild ? undefined : type}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-kit border font-medium',
        'transition-[background-color,color,border-color,box-shadow] duration-kit ease-kit',
        kitFocus,
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
