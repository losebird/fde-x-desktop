import { Search, Bell, Volume2, VolumeX, Plus } from 'lucide-react'
import { useApp } from '@/store/app'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

export default function Header() {
  const muted = useApp((s) => s.imMuted)
  const setMuted = useApp((s) => s.setIMMuted)
  const unread = useApp((s) => s.notifications.filter((n) => !n.read).length)
  const markAll = useApp((s) => s.markAllNotifRead)
  const nav = useNavigate()
  const [q, setQ] = useState('')

  return (
    <header className="h-12 border-b border-line bg-surface flex items-center px-4 gap-3 shrink-0">
      <WorkspaceSwitcher />
      <div className="w-px h-4 bg-line" />
      <div className="relative flex-1 max-w-[520px]">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
        <input
          className="input pl-8 pr-16 h-8"
          placeholder="搜索任务、文件、Agent、记忆…(模拟)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-ink-subtle">
          <span className="kbd">⌘</span><span className="kbd">K</span>
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          className="btn-ghost h-8 w-8 p-0 relative"
          title={muted ? 'IM 静音中,点击恢复' : 'IM 在线,点击静音'}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {muted && (
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent-amber" />
          )}
        </button>

        <button
          className="btn-ghost h-8 w-8 p-0 relative"
          title="通知"
          onClick={() => { markAll(); nav('/') }}
        >
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 text-[10px] px-1 rounded-full bg-accent-red text-white">
              {unread}
            </span>
          )}
        </button>

        <button className="btn h-8" title="新建(模拟)">
          <Plus size={14} /> 新建
        </button>
      </div>
    </header>
  )
}
