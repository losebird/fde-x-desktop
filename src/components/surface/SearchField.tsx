import clsx from 'clsx'
import { Search } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { SurfaceInput } from '@/components/surface/Field'

export function SurfaceSearch({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-kit-tertiary" />
      <SurfaceInput {...props} className={clsx('pl-8', className)} />
    </div>
  )
}
