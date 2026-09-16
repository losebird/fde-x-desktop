// Stage Manager 风格的舞台 modal。中央舞台,一次只显示一个,可拖、可最小化回缩略图、可撕出为独立浮窗。
import { ReactNode, useEffect, useRef, useState } from 'react'
import { X, Minus, ExternalLink, GripHorizontal } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import type { SidePanelItem } from '@/store/app'

// 模块级变量:记录拖拽起点 X / 方向 / 起始宽度
let __stageStartX = 0
let __stageStartW = 0
let __stageDir: 'left' | 'right' = 'right'

export function StageModal({
  item,
  children,
}: {
  item: SidePanelItem
  children: ReactNode
}) {
  const togglePanel = useApp((s) => s.togglePanel)
  const closePanel = useApp((s) => s.closePanel)
  const setPanelState = useApp((s) => s.setPanelState)
  const setPanelWidth = useApp((s) => s.setPanelWidth)
  const setPanelDirty = useApp((s) => s.setPanelDirty)
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelState(item.id, 'tab')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item.id, setPanelState])

  // 拖拽左侧 / 右侧手柄调整宽度
  useEffect(() => {
    if (!dragging) return
    const getX = (ev: MouseEvent | TouchEvent) =>
      'touches' in ev
        ? (ev.touches?.[0]?.clientX ?? 0)
        : (ev as MouseEvent).clientX ?? 0
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = getX(ev)
      const dx = clientX - __stageStartX
      const next = __stageStartW + (__stageDir === 'left' ? -dx * 2 : dx * 2)
      const clamped = Math.max(360, Math.min(1280, next))
      setPanelWidth(item.id, clamped)
    }
    const onUp = () => {
      setDragging(false)
    }
    window.addEventListener('mousemove', onMove as any)
    window.addEventListener('touchmove', onMove as any, { passive: false })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove as any)
      window.removeEventListener('touchmove', onMove as any)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, item.id, setPanelWidth])

  if (item.state !== 'full' && item.state !== 'half') return null
  // half 态下宽度 = 60% width
  const width = item.state === 'half' ? Math.round(item.width * 0.6) : item.width

  const startDrag = (dir: 'left' | 'right') => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const x = 'touches' in e.nativeEvent
      ? (e.nativeEvent as TouchEvent).touches?.[0]?.clientX ?? 0
      : (e.nativeEvent as MouseEvent).clientX
    __stageStartX = x
    __stageStartW = item.width
    __stageDir = dir
    setDragging(true)
  }

  return (
    <div
      className="absolute inset-0 z-40 pointer-events-none"
      aria-modal
      role="dialog"
    >
      {/* 背景半透明遮罩,提示舞台被选中 */}
      <div className="absolute inset-0 bg-ink/10 pointer-events-auto" onClick={() => setPanelState(item.id, 'tab')} />

      <div
        ref={ref}
        className={clsx(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto',
          'bg-surface rounded-xl shadow-2xl border border-line overflow-hidden',
          'flex flex-col relative',
        )}
        style={{ width, maxWidth: '92vw', height: '84vh' }}
      >
        {/* 左侧拖拽手柄 */}
        <div
          onMouseDown={startDrag('left')}
          onTouchStart={startDrag('left')}
          className={clsx('resize-handle resize-handle-h absolute top-0 left-0 h-full cursor-ew-resize z-10', dragging && 'dragging')}
          style={{ width: 6 }}
          title="拖拽调整宽度"
        />
        {/* 右侧拖拽手柄 */}
        <div
          onMouseDown={startDrag('right')}
          onTouchStart={startDrag('right')}
          className={clsx('resize-handle resize-handle-h absolute top-0 right-0 h-full cursor-ew-resize z-10', dragging && 'dragging')}
          style={{ width: 6 }}
          title="拖拽调整宽度"
        />
        {/* 舞台标题 */}
        <div className="h-11 px-3 border-b border-line flex items-center gap-2 shrink-0 bg-surface-2">
          <div className={clsx('w-1 self-stretch my-1.5 rounded-full', item.accent)} />
          <div className="text-sm font-medium">{item.label}</div>
          {item.dirty && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">未保存</span>}
          <div className="flex-1" />
          <button
            className="p-1.5 rounded hover:bg-line text-ink-muted"
            title="最小化到缩略图(tab 态)"
            onClick={() => setPanelState(item.id, 'tab')}
          >
            <Minus size={14} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-line text-ink-muted"
            title="撕出为独立浮窗(完整工作台模式)"
            onClick={() => {
              // 关闭舞台打开全屏路由
              closePanel(item.id)
              const routeMap: Record<SidePanelItem['view'], string> = {
                im: '/im', briefing: '/briefing', plan: '/plan', files: '/files', data: '/data',
                mcp: '/mcp', skills: '/skills', memory: '/memory', settings: '/settings',
              }
              window.history.pushState({}, '', routeMap[item.view])
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
          >
            <ExternalLink size={14} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-line text-ink-muted"
            title="关闭(ESC)"
            onClick={() => {
              closePanel(item.id)
              setPanelDirty(item.id, undefined)
            }}
          >
            <X size={14} />
          </button>
          <span className="hidden md:flex items-center gap-1 text-[10px] text-ink-subtle ml-1">
            <GripHorizontal size={10} /> drag · 状态全展
          </span>
        </div>

        {/* 舞台主体 */}
        <div className="flex-1 min-h-0 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
