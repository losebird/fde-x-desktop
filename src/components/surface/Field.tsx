import clsx from 'clsx'
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { kitControl } from '@/components/surface/classes'

export function SurfaceField({
  label,
  hint,
  error,
  children,
}: {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block min-w-0">
      {label ? <div className="mb-1.5 text-kit-sm font-medium text-kit-ink">{label}</div> : null}
      {children}
      {error ? <div className="mt-1.5 text-kit-sm text-kit-danger">{error}</div> : null}
      {!error && hint ? <div className="mt-1.5 text-kit-meta text-kit-secondary">{hint}</div> : null}
    </label>
  )
}

export const SurfaceInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SurfaceInput({
  className,
  ...props
}, ref) {
  return <input ref={ref} className={clsx(kitControl, 'h-8', className)} {...props} />
})

export const SurfaceTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function SurfaceTextarea({
  className,
  ...props
}, ref) {
  return <textarea ref={ref} className={clsx(kitControl, 'min-h-20 py-2 leading-5', className)} {...props} />
})

export const SurfaceSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function SurfaceSelect({
  className,
  children,
  ...props
}, ref) {
  return (
    <select ref={ref} className={clsx(kitControl, 'h-8 pr-8', className)} {...props}>
      {children}
    </select>
  )
})
