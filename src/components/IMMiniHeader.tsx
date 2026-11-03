// 工作台顶栏：品牌、全局功能导航与状态操作合并为一行。
import { Volume2, VolumeX } from 'lucide-react'
import { useApp } from '@/store/app'
import { useNavigate } from 'react-router-dom'
import { CreateMenu } from './CreateMenu'
import { IMTopNav } from './IMTopNav'
import { NotifyInbox } from './NotifyInbox'

export function IMMiniHeader() {
  const muted = useApp((s) => s.imMuted)
  const setMuted = useApp((s) => s.setIMMuted)
  const nav = useNavigate()

  return (
    <div className="h-11 px-2 flex items-center gap-2 border-b border-line bg-surface shrink-0">
      <div
        className="flex items-center gap-1.5 px-2 h-7 rounded hover:bg-surface-2 cursor-pointer min-w-0"
        onClick={() => nav('/')}
        title="回工作台主页"
      >
        <img src="/brand/logo.svg" alt="FDE-X" className="h-5 w-auto max-w-[140px] object-contain object-left" />
      </div>

      <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar px-2">
        <div className="min-w-max mx-auto w-fit">
          <IMTopNav />
        </div>
      </div>

      <button
        className="btn-ghost h-7 w-7 p-0 relative"
        title={muted ? '通知已关，投递照常' : '通知开着，点击只关提示'}
        onClick={() => setMuted(!muted)}
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        {muted && <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent-amber" />}
      </button>
      <NotifyInbox />
      <CreateMenu />
    </div>
  )
}
