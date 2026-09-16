// AI-first 工具缩略图栈：AI 主工作区常驻，IM 与其他功能面板统一显示在工具区。
import {
  Newspaper, ClipboardList, Folder, Database,
  Plug, Wand2, Brain, Settings, X, MessageCircleMore,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'

const ICONS: Record<string, LucideIcon> = {
  MessageCircleMore, Newspaper, ClipboardList, Folder, Database,
  Plug, Wand2, Brain, Settings,
}

export function ThumbnailStack() {
  const panels = useApp((state) => state.panels)
  const floating = useApp((state) => state.floating)
  const togglePanel = useApp((state) => state.togglePanel)
  const closePanel = useApp((state) => state.closePanel)
  const visible = panels.filter((panel) => panel.state !== 'closed')

  return (
    <aside className="w-[88px] border-l border-line bg-surface-2 shrink-0 flex flex-col" aria-label="工作区工具">
      <div className="h-11 border-b border-line flex items-center justify-center text-[10px] font-semibold text-ink-muted tracking-[0.16em]">
        FDE-X
      </div>

      <div className="px-2 pt-3 pb-1 text-center text-[9px] uppercase tracking-[0.12em] text-ink-subtle">功能</div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {visible.map((panel) => {
          const Icon = ICONS[panel.icon] ?? Folder
          const isActive = panel.state === 'full' || panel.state === 'half'
          const isFloating = Boolean(floating[panel.view])
          const badge = panel.badge
          const titleParts = [panel.label]
          if (isFloating) titleParts.push('（浮窗中）')
          if (panel.dirty) titleParts.push('（有未保存内容）')
          return (
            <div
              key={panel.id}
              className={clsx(
                'w-full rounded-lg overflow-hidden text-left relative group transition-all duration-150',
                isActive
                  ? 'bg-surface border-2 border-brand shadow-sm ring-2 ring-brand/20'
                  : 'bg-surface border border-line hover:border-ink-muted hover:shadow-sm',
              )}
              title={titleParts.join('')}
            >
              <button
                className="absolute top-0.5 right-0.5 z-10 w-4 h-4 rounded-full bg-ink/70 hover:bg-accent-red text-white flex items-center justify-center"
                title={`关闭${panel.label}`}
                aria-label={`关闭${panel.label}`}
                onClick={(event) => {
                  event.stopPropagation()
                  closePanel(panel.id)
                }}
              >
                <X size={9} strokeWidth={2.5} />
              </button>
              <button className="w-full text-left" onClick={() => togglePanel(panel.id, isActive ? 'tab' : 'full')}>
                <div className="h-12 relative overflow-hidden bg-gradient-to-br from-surface-2 to-surface">
                  <div className="h-2 flex items-center gap-0.5 px-1.5 border-b border-line/60">
                    <span className="w-1 h-1 rounded-full bg-accent-red/60" />
                    <span className="w-1 h-1 rounded-full bg-accent-amber/60" />
                    <span className="w-1 h-1 rounded-full bg-brand/60" />
                  </div>
                  <div className="px-2 pt-1.5 space-y-0.5">
                    <div className="h-1 w-3/4 rounded bg-ink-subtle/30" />
                    <div className="h-1 w-2/3 rounded bg-ink-subtle/20" />
                    <div className="h-1 w-1/2 rounded bg-ink-subtle/20" />
                  </div>
                  <div className={clsx('absolute right-1 bottom-1 w-1.5 h-1.5 rounded-full', panel.accent)} />
                </div>
                <div className="px-1.5 py-1 flex items-center gap-1">
                  <Icon size={10} className="text-ink-muted shrink-0" />
                  <span className="text-[10px] truncate flex-1">{panel.label}</span>
                  {!!badge && badge > 0 && (
                    <span className="px-1 min-w-3.5 h-3.5 rounded-full bg-accent-red text-white text-[8px] flex items-center justify-center font-medium">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  {panel.dirty && <span className="w-1.5 h-1.5 rounded-full bg-accent-amber" title="有未保存的改动" />}
                </div>
              </button>
            </div>
          )
        })}
        {visible.length === 0 && (
          <div className="px-1 py-3 text-center text-[9px] leading-4 text-ink-subtle">从顶栏打开功能</div>
        )}
      </div>
      <div className="border-t border-line py-2 px-1 text-center">
        <span className="text-[10px] text-ink-subtle">⌘K</span>
      </div>
    </aside>
  )
}
