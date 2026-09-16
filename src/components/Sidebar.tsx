import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ListTodo, Calendar, Folder, MessageSquare, Bot,
  MessageCircle, BarChart3, Plug, Sparkles, Brain, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'

const NAV = [
  { to: '/',             label: '早报',      icon: LayoutDashboard, group: '日常' },
  { to: '/tasks',        label: '任务',      icon: ListTodo,        group: '日常' },
  { to: '/schedule',     label: '日程',      icon: Calendar,        group: '日常' },
  { to: '/files',        label: '文件',      icon: Folder,          group: '资源' },
  { to: '/ai',           label: 'AI 对话',   icon: MessageSquare,   group: '协作' },
  { to: '/agents',       label: 'Agent',     icon: Bot,             group: '协作' },
  { to: '/im',           label: 'IM',        icon: MessageCircle,   group: '协作' },
  { to: '/data',         label: '业务应用',   icon: BarChart3,       group: '运营' },
  { to: '/mcp',          label: 'MCP 管理',  icon: Plug,            group: '扩展' },
  { to: '/skills',       label: 'Skills',    icon: Sparkles,        group: '扩展' },
  { to: '/memory',       label: '记忆',      icon: Brain,           group: '设置' },
  { to: '/settings',     label: '设置',      icon: Settings,        group: '设置' },
] as const

export default function Sidebar() {
  const collapsed = useApp((s) => s.sidebarCollapsed)
  const toggle = useApp((s) => s.toggleSidebar)
  const ws = useApp((s) => s.workspaces)
  const activeWs = useApp((s) => s.activeWorkspaceId)
  const setWs = useApp((s) => s.setActiveWorkspace)
  const notifs = useApp((s) => s.notifications.filter((n) => !n.read).length)

  const groups = ['日常', '资源', '协作', '运营', '扩展', '设置'] as const

  return (
    <aside
      className={clsx(
        'shrink-0 border-r border-line bg-surface flex flex-col transition-all duration-200',
        collapsed ? 'w-[56px]' : 'w-[240px]',
      )}
    >
      {/* 头部 / 工作区切换 */}
      <div className="px-3 py-3 border-b border-line">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-ink text-white flex items-center justify-center text-sm font-semibold">W</div>
              <div>
                <div className="text-sm font-medium leading-none">Workstation</div>
                <div className="text-[11px] text-ink-muted mt-0.5">scene#39 · 母版</div>
              </div>
            </div>
            <button className="btn-ghost p-1" onClick={toggle} aria-label="折叠侧栏">
              <ChevronLeft size={16} />
            </button>
          </div>
        ) : (
          <button className="btn-ghost p-1 mx-auto block" onClick={toggle} aria-label="展开侧栏">
            <ChevronRight size={16} />
          </button>
        )}

        {!collapsed && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wider text-ink-subtle mb-1.5">当前工作区</div>
            <select
              className="input text-sm"
              value={activeWs}
              onChange={(e) => setWs(e.target.value)}
            >
              {ws.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.emoji}  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {groups.map((g) => (
          <div key={g} className="mb-2">
            {!collapsed && (
              <div className="px-2 mb-1 text-[10px] uppercase tracking-wider text-ink-subtle">{g}</div>
            )}
            <div className="flex flex-col gap-0.5">
              {NAV.filter((n) => n.group === g).map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    clsx('nav-item', isActive && 'nav-item-active', collapsed && 'justify-center px-0')
                  }
                  title={collapsed ? n.label : undefined}
                >
                  <n.icon size={16} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{n.label}</span>
                      {n.to === '/' && notifs > 0 && (
                        <span className="text-[10px] px-1.5 rounded-full bg-accent-red text-white">{notifs}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* 底: 用户区 */}
      {!collapsed && (
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center text-xs">我</div>
            <div className="min-w-0">
              <div className="text-sm leading-none truncate">我</div>
              <div className="text-[11px] text-ink-muted mt-0.5 truncate">@zxz · 已登录</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
