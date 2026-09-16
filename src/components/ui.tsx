import type { ReactNode } from 'react'
import clsx from 'clsx'

export function PageTitle({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div data-page-title="true" className="flex items-end justify-between gap-4 mb-6">
      <div data-page-title-text="true" className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div data-page-title-actions="true" className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function SectionTitle({
  title, count, right,
}: { title: string; count?: number; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        {typeof count === 'number' && (
          <span className="text-xs text-ink-subtle">{count}</span>
        )}
      </div>
      {right}
    </div>
  )
}

export function Card({
  children, className,
}: { children: ReactNode; className?: string }) {
  return <div className={clsx('card p-4', className)}>{children}</div>
}

export function Stat({
  label, value, delta, hint, unit,
}: {
  label: string; value: ReactNode; delta?: number; hint?: string; unit?: string
}) {
  const isUp = typeof delta === 'number' && delta > 0
  const isDown = typeof delta === 'number' && delta < 0
  return (
    <div className="card p-4 min-w-0">
      <div className="text-xs text-ink-muted truncate">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5 min-w-0">
        <div className="text-2xl font-semibold tabular-nums truncate min-w-0">{value}</div>
        {unit && <div className="text-sm text-ink-muted shrink-0">{unit}</div>}
      </div>
      {typeof delta === 'number' && (
        <div className={clsx(
          'mt-1.5 text-xs flex items-center gap-1 flex-wrap min-w-0',
          isUp && 'text-accent-red',
          isDown && 'text-accent-teal',
          !isUp && !isDown && 'text-ink-muted',
        )}>
          <span className="shrink-0">{isUp ? '↑' : isDown ? '↓' : '·'} {Math.abs(delta * 100).toFixed(1)}%</span>
          {hint && <span className="text-ink-subtle break-words">· {hint}</span>}
        </div>
      )}
      {!delta && hint && (
        <div className="mt-1.5 text-xs text-ink-muted break-words">{hint}</div>
      )}
    </div>
  )
}

export function Tag({
  kind = 'default', children,
}: { kind?: 'default' | 'red' | 'amber' | 'blue' | 'purple' | 'teal' | 'green'; children: ReactNode }) {
  const styles: Record<string, string> = {
    default: 'bg-surface-2 text-ink-muted border border-line',
    red:    'bg-red-50 text-accent-red border border-red-100',
    amber:  'bg-amber-50 text-accent-amber border border-amber-100',
    blue:   'bg-blue-50 text-accent-blue border border-blue-100',
    purple: 'bg-purple-50 text-accent-purple border border-purple-100',
    teal:   'bg-teal-50 text-accent-teal border border-teal-100',
    green:  'bg-brand-soft text-brand border border-brand/30',
  }
  return <span className={clsx('tag', styles[kind])}>{children}</span>
}

export function Empty({
  title, hint, action,
}: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-base font-medium">{title}</div>
      {hint && <div className="text-sm text-ink-muted mt-1.5">{hint}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
