// 右侧吸附工作台面板。显示当前 activePanel,可拖拽左侧边缘调整宽度。
import { X, Minus, GripHorizontal, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { useApp } from '@/store/app'
import type { SidePanelItem } from '@/store/app'
import { PanelContent } from './PanelContent'

let __panelStartX = 0
let __panelStartW = 0
let __dragging = false

function iframeDragShield(on: boolean) {
  if (on) document.body.setAttribute('data-floating-drag', '1')
  else document.body.removeAttribute('data-floating-drag')
}

function panelMaxWidth(overlay: boolean) {
  return overlay ? 1280 : Math.max(400, Math.min(1280, window.innerWidth - 728))
}

export function StagePanel({ item, overlay }: { item?: SidePanelItem; overlay?: boolean }) {
  const closePanel = useApp((s) => s.closePanel)
  const setPanelState = useApp((s) => s.setPanelState)
  const setPanelWidth = useApp((s) => s.setPanelWidth)
  const setPanelDirty = useApp((s) => s.setPanelDirty)
  const openFloating = useApp((s) => s.openFloating)
  const [dragging, setDragging] = useState(false)

  // 面板最大宽度:overlay 不受视口限制;吸附模式给主区至少 640px，并扣掉最右功能栏 88px
  const maxW = overlay ? 1280 : Math.max(400, Math.min(1280, (typeof window !== 'undefined' ? window.innerWidth : 1440) - 728))

  const panelId = item?.id
  const overlayMode = Boolean(overlay)
  useEffect(() => {
    if (!dragging || !panelId) return
    const onMove = (event: PointerEvent) => {
      if (!__dragging) return
      const next = __panelStartW + (__panelStartX - event.clientX)
      setPanelWidth(panelId, Math.max(360, Math.min(panelMaxWidth(overlayMode), next)))
    }
    const onUp = () => {
      __dragging = false
      iframeDragShield(false)
      setDragging(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onUp)
    }
  }, [dragging, overlayMode, panelId, setPanelWidth])

  if (!item || (item.state !== 'full' && item.state !== 'half')) return null

  const detach = () => {
    if (!item) return
    const view = item.view
    const label = item.label
    // 把当前 panel 退到 tab(保留入口),同时撕出为独立浮窗
    setPanelState(item.id, 'tab')
    // 默认占视口约 82% × 84%，让计划/文件/AI 等内容无需二次放大即可使用。
    const width = Math.min(1180, Math.max(420, Math.round(window.innerWidth * 0.82)))
    const height = Math.min(820, Math.max(360, Math.round(window.innerHeight * 0.84)))
    openFloating(view, {
      width,
      height,
      x: Math.max(16, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(16, Math.round((window.innerHeight - height) / 2)),
    })
    // eslint-disable-next-line no-console
    console.info(`[StagePanel] 撕出 · ${label} → 独立浮窗`)
  }

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    __panelStartX = e.clientX
    __panelStartW = item.width
    __dragging = true
    iframeDragShield(true)
    setDragging(true)
  }

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!__dragging) return
    const next = __panelStartW + (__panelStartX - e.clientX)
    setPanelWidth(item.id, Math.max(360, Math.min(maxW, next)))
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    __dragging = false
    iframeDragShield(false)
    setDragging(false)
  }

  return (
    <div
      className={clsx(
        'border-l border-line bg-surface flex flex-col shrink-0 min-w-0 relative',
        overlay
          ? 'absolute top-0 bottom-0 right-0 z-30 shadow-[-12px_0_32px_rgba(0,0,0,0.18)]'
          : 'h-full z-20 shadow-[-4px_0_16px_rgba(0,0,0,0.03)]',
      )}
      style={{ width: item.width }}
    >
      <div
        onPointerDown={startDrag}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={clsx('absolute inset-y-0 z-40 cursor-ew-resize touch-none', dragging && 'bg-brand/10')}
        style={{ left: -4, width: 12 }}
        title="拖拽调整宽度"
      />
      {/* 标题栏 */}
      <div className="h-11 px-3 border-b border-line flex items-center gap-2 shrink-0 bg-surface-2">
        <div className={clsx('w-1 self-stretch my-1.5 rounded-full', item.accent)} />
        <div className="text-sm font-medium">{item.label}</div>
        {item.dirty && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">未保存</span>}
        <div className="flex-1" />
        <button
          className="p-1.5 rounded hover:bg-line text-ink-muted"
          title="最小化到缩略图栈"
          onClick={() => setPanelState(item.id, 'tab')}
        >
          <Minus size={14} />
        </button>
        <button
          className="p-1.5 rounded hover:bg-line text-ink-muted"
          title="撕出为独立浮窗(可拖拽 / 缩放)"
          onClick={detach}
        >
          <ExternalLink size={14} />
        </button>
        <button
          className="p-1.5 rounded hover:bg-line text-ink-muted"
          title="关闭"
          onClick={() => { closePanel(item.id); setPanelDirty(item.id, undefined) }}
        >
          <X size={14} />
        </button>
        <span className="hidden md:flex items-center gap-1 text-[10px] text-ink-subtle ml-1">
          <GripHorizontal size={10} /> 拖拽
        </span>
      </div>

      {/* 内容区(relative 定位,拖拽手柄放这里) */}
      <div className={clsx(
        'flex-1 min-h-0 bg-surface-2/30',
        item.view === 'im' || item.view === 'memory' ? 'overflow-hidden' : 'overflow-auto',
      )}>
        <PanelContent item={item} />
      </div>
    </div>
  )
}
