// 顶部导航：AI 固定为主工作区；IM、早报、计划等统一控制右侧功能面板。
import {
  Newspaper, ClipboardList, Folder, Database,
  Plug, Wand2, Brain, Settings, Command, MessageCircleMore,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const ICON: Record<string, LucideIcon> = {
  MessageCircleMore, Newspaper, ClipboardList, Folder, Database,
  Plug, Wand2, Brain, Settings,
}

export function IMTopNav() {
  const panels = useApp((state) => state.panels)
  const togglePanel = useApp((state) => state.togglePanel)
  const openIMPanel = useApp((state) => state.openIMPanel)
  const setPaletteOpen = useApp((state) => state.setPaletteOpen)

  return (
    <div className="flex items-center gap-1.5 h-9 px-1.5 bg-surface-2 rounded-full border border-line">
      <WorkspaceSwitcher />
      <div className="w-px h-4 bg-line mx-0.5" />
      {panels.map((panel) => {
        const Icon = ICON[panel.icon] ?? ClipboardList
        const isOpen = panel.state !== 'closed'
        const isActive = panel.state === 'full' || panel.state === 'half'
        const badge = panel.badge
        return (
          <button
            key={panel.id}
            type="button"
            onClick={() => panel.id === 'im' && !isActive ? openIMPanel() : togglePanel(panel.id, isActive ? 'tab' : 'full')}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs transition-colors',
              isOpen
                ? 'bg-surface text-ink shadow-sm font-medium'
                : 'text-ink-muted hover:bg-surface hover:text-ink',
            )}
            title={`${panel.label}${panel.id === 'im' ? ' · AI 可自动调用' : panel.pinned ? ' · 默认钉住' : ''}`}
          >
            <Icon size={12} />
            <span className="hidden md:inline">{panel.label}</span>
            {!!badge && badge > 0 && (
              <span className="min-w-3.5 h-3.5 px-1 rounded-full bg-accent-red text-white text-[9px] flex items-center justify-center">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        )
      })}
      <div className="w-px h-4 bg-line mx-1" />
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs text-ink-muted hover:bg-surface hover:text-ink"
        title="⌘+K 全局搜"
      >
        <Command size={12} />
        <kbd className="kbd !text-[10px] !py-0 !px-1">⌘K</kbd>
      </button>
    </div>
  )
}
