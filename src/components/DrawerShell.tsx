// 抽屉外壳:从右滑出,带标题栏 + 关闭 + 折叠按钮。可选 size。
import { type ReactNode } from 'react'
import { X, Minus } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  onCollapse?: () => void
  className?: string
  children: ReactNode
}

export function DrawerShell({ title, subtitle, onClose, onCollapse, className, children }: Props) {
  return (
    <div className={clsx('h-full bg-white border-l border-neutral-200 flex flex-col', className)}>
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center gap-3 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-neutral-900 truncate">{title}</div>
          {subtitle && <div className="text-xs text-neutral-500 truncate mt-0.5">{subtitle}</div>}
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="折叠"
            className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500"
          >
            <Minus size={14} />
          </button>
        )}
        <button
          onClick={onClose}
          title="关闭"
          className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </div>
  )
}
