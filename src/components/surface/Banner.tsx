import clsx from 'clsx'
import type { ReactNode } from 'react'

const tones = {
  info: 'border-kit-line bg-kit-info-soft text-kit-ink',
  warn: 'border-transparent bg-kit-warn-soft text-kit-warn',
  danger: 'border-transparent bg-kit-danger-soft text-kit-danger',
  quiet: 'border-kit-line bg-kit-muted text-kit-secondary',
} as const

export function SurfaceBanner({
  tone = 'quiet',
  children,
}: {
  tone?: keyof typeof tones
  children: ReactNode
}) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={clsx('rounded-kit border px-3 py-2 text-kit-sm leading-5', tones[tone])}>
      {children}
    </div>
  )
}
