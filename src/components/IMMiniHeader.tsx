// 工作台顶栏：品牌、全局功能导航与状态操作合并为一行。
import { Bell, Volume2, VolumeX, Plus } from 'lucide-react'
import { useApp } from '@/store/app'
import { useNavigate } from 'react-router-dom'
import { IMTopNav } from './IMTopNav'

export function IMMiniHeader() {
  const muted = useApp((s) => s.imMuted)
  const setMuted = useApp((s) => s.setIMMuted)
  const unread = 0
  const markAll = useApp((s) => s.markAllNotifRead)
  const nav = useNavigate()

  return (
    <div className="h-11 px-2 flex items-center gap-2 border-b border-line bg-surface shrink-0">
      <div
        className="flex items-center gap-1.5 px-2 h-7 rounded hover:bg-surface-2 cursor-pointer min-w-0"
        onClick={() => nav('/')}
        title="回工作台主页"
      >
        <div className="w-5 h-5 rounded bg-gradient-to-br from-brand to-brand/70 text-white text-[10px] font-bold flex items-center justify-center">F</div>
        <div className="min-w-0 hidden sm:block">
          <div className="text-xs font-medium truncate">FDE-X Desktop</div>
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar px-2">
        <div className="min-w-max mx-auto w-fit">
          <IMTopNav />
        </div>
      </div>

      <button
        className="btn-ghost h-7 w-7 p-0 relative"
        title={muted ? 'IM 已静音,点击恢复' : 'IM 在线,点击静音'}
        onClick={() => setMuted(!muted)}
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        {muted && <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent-amber" />}
      </button>
      <button
        className="btn-ghost h-7 w-7 p-0 relative"
        title="通知中心"
        onClick={() => { markAll(); togglePanelBriefing() }}
      >
        <Bell size={14} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 text-[9px] px-1 rounded-full bg-accent-red text-white">
            {unread}
          </span>
        )}
      </button>
      <button
        className="btn-ghost h-7 px-2 text-xs flex items-center gap-1"
        title="新建"
        onClick={() => useApp.getState().togglePanel('im', 'full')}
      >
        <Plus size={12} /> 新建
      </button>
    </div>
  )
}

// 通知 → 默认弹出早报页作为通知落点
function togglePanelBriefing() {
  useApp.getState().togglePanel('briefing', 'full')
}
