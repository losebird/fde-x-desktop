import clsx from 'clsx'
import type { ReactNode } from 'react'

export function SurfaceGroup({
  title,
  hint,
  children,
  footer,
}: {
  title?: string
  hint?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="min-w-0">
      {title ? <h3 className="mb-1.5 px-0.5 text-kit-sm font-medium text-kit-secondary">{title}</h3> : null}
      {hint ? <p className="mb-2 max-w-prose px-0.5 text-kit-sm leading-5 text-kit-secondary">{hint}</p> : null}
      <div className="divide-y divide-kit-line overflow-hidden rounded-kit-lg border border-kit-line bg-kit-card">
        {children}
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </section>
  )
}

export function SurfaceGroupRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={clsx('px-4 py-3', className)}>{children}</div>
}
