// 顶部导航：AI 固定为主工作区；IM、早报、计划等统一控制右侧功能面板。
import {
  Newspaper, ClipboardList, Folder, Database,
  Plug, Wand2, Brain, Settings, Command, MessageCircleMore, X,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const ICON: Record<string, LucideIcon> = {
  MessageCircleMore, Newspaper, ClipboardList, Folder, Database,
  Plug, Wand2, Brain, Settings,
}

const ACCENT_RING: Record<string, string> = {
  'bg-slate-700': 'ring-slate-700',
  'bg-amber-500': 'ring-amber-500',
  'bg-blue-500': 'ring-blue-500',
  'bg-emerald-500': 'ring-emerald-500',
  'bg-cyan-500': 'ring-cyan-500',
  'bg-rose-500': 'ring-rose-500',
  'bg-indigo-500': 'ring-indigo-500',
  'bg-fuchsia-500': 'ring-fuchsia-500',
  'bg-slate-500': 'ring-slate-500',
}

export function IMTopNav() {
  const panels = useApp((state) => state.panels)
  const floating = useApp((state) => state.floating)
  const togglePanel = useApp((state) => state.togglePanel)
  const closePanel = useApp((state) => state.closePanel)
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
        const isFloating = Boolean(floating[panel.view])
        const badge = panel.badge
        const titleParts = [panel.label]
        if (panel.id === 'im') titleParts.push('AI 可自动调用')
        else if (panel.pinned) titleParts.push('默认钉住')
        if (isActive) titleParts.push('当前打开')
        else if (isOpen) titleParts.push('已停靠')
        if (isFloating) titleParts.push('浮窗中')
        if (panel.dirty) titleParts.push('有未保存内容')
        return (
          <div key={panel.id} className="relative group">
            <button
              type="button"
              onClick={() => panel.id === 'im' && !isActive ? openIMPanel() : togglePanel(panel.id, isActive ? 'tab' : 'full')}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs transition-colors',
                isActive && ['ring-2', ACCENT_RING[panel.accent] || 'ring-slate-500'],
                isOpen
                  ? 'bg-surface text-ink shadow-sm font-medium'
                  : 'text-ink-muted hover:bg-surface hover:text-ink',
              )}
              title={titleParts.join(' · ')}
            >
              <Icon size={12} />
              <span className="hidden md:inline">{panel.label}</span>
              {panel.dirty && <span className="w-1.5 h-1.5 rounded-full bg-accent-amber" title="有未保存的改动" />}
              {!!badge && badge > 0 && (
                <span className="min-w-3.5 h-3.5 px-1 rounded-full bg-accent-red text-white text-[9px] flex items-center justify-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
            {isOpen && (
              <button
                type="button"
                className="absolute -top-0.5 -right-0.5 z-10 w-3.5 h-3.5 rounded-full bg-ink/70 hover:bg-accent-red text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                title={`关闭${panel.label}`}
                aria-label={`关闭${panel.label}`}
                onClick={(event) => {
                  event.stopPropagation()
                  closePanel(panel.id)
                }}
              >
                <X size={9} strokeWidth={2.5} />
              </button>
            )}
          </div>
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
