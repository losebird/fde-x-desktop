import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function SurfaceEmpty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-kit-muted text-kit-secondary">
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <div className="text-kit-title font-medium text-kit-ink">{title}</div>
      {body ? <p className="mt-1 max-w-sm text-kit-sm leading-5 text-kit-secondary">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function SurfaceGuide({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-kit-lg border border-dashed border-kit-line-strong bg-kit-muted px-4 py-4">
      <div className="text-kit-title font-medium text-kit-ink">{title}</div>
      <p className="mt-1 text-kit-sm leading-5 text-kit-secondary">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
