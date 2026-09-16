// 撕出式独立浮窗:可拖拽头部移动、可从右下角缩放、可关闭、可聚焦置顶。
// 数据来源 store.floating,从 store.openFloating(view, opts) 创建。
// 关闭只关浮窗(不影响 panels 状态),所以用户可以同时保留侧栏 tab 和浮窗。
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Minus, Maximize2, GripVertical } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { PanelContent } from './PanelContent'
import type { SidePanelItem } from '@/store/app'

// 浮窗的最小尺寸和最小可见边距(防止拖出屏外后找不回)
const MIN_W = 420
const MIN_H = 360
const EDGE = 32

type DragKind = 'move' | 'resize' | null

export function FloatingPanel() {
  const floating = useApp((s) => s.floating)
  const closeFloating = useApp((s) => s.closeFloating)
  const setFloatingBox = useApp((s) => s.setFloatingBox)
  const focusFloating = useApp((s) => s.focusFloating)
  const panels = useApp((s) => s.panels)
  const closePanel = useApp((s) => s.closePanel)
  const [drag, setDrag] = useState<DragKind>(null)
  const dragRef = useRef<{ kind: DragKind; startX: number; startY: number; x: number; y: number; w: number; h: number }>({
    kind: null, startX: 0, startY: 0, x: 0, y: 0, w: 0, h: 0,
  })

  useEffect(() => {
    if (!drag) return
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (dragRef.current.kind === 'move') {
        const vw = window.innerWidth
        const vh = window.innerHeight
        const nextX = Math.max(EDGE - dragRef.current.w + 100, Math.min(vw - EDGE, dragRef.current.x + dx))
        const nextY = Math.max(0, Math.min(vh - 28, dragRef.current.y + dy))
        setFloatingBox({ x: nextX, y: nextY })
      } else if (dragRef.current.kind === 'resize') {
        const nextW = Math.max(MIN_W, Math.min(window.innerWidth - dragRef.current.x - EDGE, dragRef.current.w + dx))
        const nextH = Math.max(MIN_H, Math.min(window.innerHeight - dragRef.current.y - 28, dragRef.current.h + dy))
        setFloatingBox({ width: nextW, height: nextH })
      }
    }
    const onUp = () => setDrag(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, setFloatingBox])

  if (!floating) return null

  const panelMeta = panels.find((p) => p.view === floating.panelId)
  const label = panelMeta?.label ?? floating.panelId
  const accent = panelMeta?.accent ?? 'bg-slate-500'

  const startDrag = (kind: DragKind) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    focusFloating()
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      x: floating.x,
      y: floating.y,
      w: floating.width,
      h: floating.height,
    }
    setDrag(kind)
  }

  const toggleMaximize = () => {
    if (!floating) return
    // 若当前未最大化,最大化;反之恢复
    const isMax = floating.x <= 8 && floating.y <= 8 && floating.width >= window.innerWidth - 16
    if (isMax) {
      setFloatingBox({ x: 80, y: 80, width: 800, height: 600 })
    } else {
      setFloatingBox({ x: 12, y: 12, width: window.innerWidth - 24, height: window.innerHeight - 60 })
    }
  }

  const item: SidePanelItem = panelMeta ?? {
    id: floating.panelId,
    label,
    icon: 'Folder',
    emoji: '',
    accent,
    state: 'full',
    width: floating.width,
    view: floating.panelId,
  }

  const node = (
    <div
      role="dialog"
      aria-label={`浮窗 · ${label}`}
      onMouseDown={() => focusFloating()}
      className="fixed rounded-xl bg-surface border border-line shadow-2xl flex flex-col overflow-hidden"
      style={{
        left: floating.x,
        top: floating.y,
        width: floating.width,
        height: floating.height,
        zIndex: floating.zIndex,
      }}
    >
      {/* 标题栏(拖拽区) */}
      <div
        onMouseDown={startDrag('move')}
        onDoubleClick={toggleMaximize}
        className="h-10 px-3 border-b border-line flex items-center gap-2 cursor-move select-none bg-surface-2 shrink-0"
      >
        <GripVertical size={12} className="text-ink-subtle" />
        <div className={clsx('w-1 self-stretch my-1.5 rounded-full', accent)} />
        <div className="text-sm font-medium">{label}</div>
        <span className="text-[10px] text-ink-subtle ml-1 px-1.5 py-0.5 rounded bg-line/60">浮窗</span>
        <div className="flex-1" />
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); closeFloating() }}
          className="p-1.5 rounded hover:bg-line text-ink-muted"
          title="隐藏浮窗(保留 tab)"
        >
          <Minus size={14} />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); toggleMaximize() }}
          className="p-1.5 rounded hover:bg-line text-ink-muted"
          title="最大化 / 还原"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); closeFloating(); closePanel(floating.panelId) }}
          className="p-1.5 rounded hover:bg-line text-ink-muted"
          title="关闭(同时关掉 tab)"
        >
          <X size={14} />
        </button>
      </div>

      {/* 内容 */}
      <div className={clsx('flex-1 min-h-0', item.view === 'im' || item.view === 'memory' ? 'overflow-hidden' : 'overflow-auto')}>
        <PanelContent item={item} />
      </div>

      {/* 右下角缩放手柄 */}
      <div
        onMouseDown={startDrag('resize')}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10"
        title="拖拽缩放"
      >
        <svg viewBox="0 0 16 16" className="absolute inset-0 text-ink-subtle">
          <path d="M14 14 L8 14 M14 14 L14 8 M14 14 L10 14 M14 14 L14 10" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}