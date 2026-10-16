import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { kitFocus } from '@/components/surface/classes'

export function SurfaceDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/30 animate-kit-overlay" />
        <Dialog.Content className={`fixed left-1/2 top-[12%] z-[81] ${wide ? 'w-[min(560px,calc(100vw-32px))]' : 'w-[min(440px,calc(100vw-32px))]'} max-h-[min(720px,calc(100vh-48px))] -translate-x-1/2 overflow-y-auto rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit-pop animate-kit-in`}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-kit-title font-semibold text-kit-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-kit-sm text-kit-secondary">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className={`rounded-kit p-1 text-kit-tertiary hover:bg-kit-muted hover:text-kit-ink ${kitFocus}`} aria-label="关闭">
              <X size={14} />
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
