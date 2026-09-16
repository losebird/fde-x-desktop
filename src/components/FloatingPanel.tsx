// 撕出式独立浮窗:可拖拽头部移动、可从右下角缩放、可关闭、可聚焦置顶。
// 数据来源 store.floating,从 store.openFloating(view, opts) 创建。
// 关闭只关浮窗(不影响 panels 状态),所以用户可以同时保留侧栏 tab 和浮窗。
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Minus, Maximize2, GripVertical } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { PanelContent } from './PanelContent'
import type { FloatingBox, SidePanelItem } from '@/store/app'

// 浮窗的最小尺寸和最小可见边距(防止拖出屏外后找不回)
const MIN_W = 420
const MIN_H = 360
const EDGE = 32

type DragKind = 'move' | 'resize' | null

let floatingDragSessions = 0

function beginFloatingDrag() {
  floatingDragSessions += 1
  document.body.setAttribute('data-floating-drag', '1')
}

function endFloatingDragSession() {
  floatingDragSessions = Math.max(0, floatingDragSessions - 1)
  if (floatingDragSessions === 0) document.body.removeAttribute('data-floating-drag')
}

function clampBox(box: FloatingBox): FloatingBox {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.max(MIN_W, Math.min(box.width, vw - EDGE))
  const height = Math.max(MIN_H, Math.min(box.height, vh - 28))
  const x = Math.max(EDGE - width + 100, Math.min(box.x, vw - EDGE))
  const y = Math.max(0, Math.min(box.y, vh - 28))
  return { ...box, x, y, width, height }
}

function FloatingWindow({
  view,
  box,
  panelMeta,
}: {
  view: SidePanelItem['view']
  box: FloatingBox
  panelMeta?: SidePanelItem
}) {
  const closeFloating = useApp((s) => s.closeFloating)
  const setFloatingBox = useApp((s) => s.setFloatingBox)
  const focusFloating = useApp((s) => s.focusFloating)
  const closePanel = useApp((s) => s.closePanel)
  const [drag, setDrag] = useState<DragKind>(null)
  const dragRef = useRef<{
    kind: DragKind
    startX: number
    startY: number
    x: number
    y: number
    w: number
    h: number
  }>({ kind: null, startX: 0, startY: 0, x: 0, y: 0, w: 0, h: 0 })

  const label = panelMeta?.label ?? view
  const accent = panelMeta?.accent ?? 'bg-slate-500'

  const draggingRef = useRef(false)

  const stopDrag = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    dragRef.current.kind = null
    setDrag(null)
    endFloatingDragSession()
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (dragRef.current.kind === 'move') {
        const vw = window.innerWidth
        const vh = window.innerHeight
        const nextX = Math.max(EDGE - dragRef.current.w + 100, Math.min(vw - EDGE, dragRef.current.x + dx))
        const nextY = Math.max(0, Math.min(vh - 28, dragRef.current.y + dy))
        setFloatingBox(view, { x: nextX, y: nextY })
      } else if (dragRef.current.kind === 'resize') {
        const nextW = Math.max(MIN_W, Math.min(window.innerWidth - dragRef.current.x - EDGE, dragRef.current.w + dx))
        const nextH = Math.max(MIN_H, Math.min(window.innerHeight - dragRef.current.y - 28, dragRef.current.h + dy))
        setFloatingBox(view, { width: nextW, height: nextH })
      }
    }
    const onBlur = () => stopDrag()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onBlur)
    }
  }, [drag, setFloatingBox, view])

  const finishPointer = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    stopDrag()
  }

  const startDrag = (kind: DragKind) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    focusFloating(view)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      x: box.x,
      y: box.y,
      w: box.width,
      h: box.height,
    }
    draggingRef.current = true
    beginFloatingDrag()
    setDrag(kind)
  }

  const toggleMaximize = () => {
    const isMax = box.x <= 8 && box.y <= 8 && box.width >= window.innerWidth - 16
    if (isMax) {
      setFloatingBox(view, { x: 80, y: 80, width: 800, height: 600 })
    } else {
      setFloatingBox(view, { x: 12, y: 12, width: window.innerWidth - 24, height: window.innerHeight - 60 })
    }
  }

  const item: SidePanelItem = panelMeta ?? {
    id: view,
    label,
    icon: 'Folder',
    emoji: '',
    accent,
    state: 'full',
    width: box.width,
    view,
  }

  return (
    <div
      role="dialog"
      aria-label={`浮窗 · ${label}`}
      onPointerDown={() => focusFloating(view)}
      className="fixed rounded-xl bg-surface border border-line shadow-2xl flex flex-col overflow-hidden"
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        zIndex: box.zIndex,
      }}
    >
      <div
        data-floating-title
        onPointerDown={startDrag('move')}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onDoubleClick={toggleMaximize}
        className="h-10 px-3 border-b border-line flex items-center gap-2 cursor-move select-none bg-surface-2 shrink-0 touch-none"
      >
        <GripVertical size={12} className="text-ink-subtle" />
        <div className={clsx('w-1 self-stretch my-1.5 rounded-full', accent)} />
        <div className="text-sm font-medium">{label}</div>
        <span className="text-[10px] text-ink-subtle ml-1 px-1.5 py-0.5 rounded bg-line/60">浮窗</span>
        <div className="flex-1" />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); closeFloating(view) }}
          className="p-1.5 rounded hover:bg-line text-ink-muted"
          title="隐藏浮窗(保留 tab)"
        >
          <Minus size={14} />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); toggleMaximize() }}
          className="p-1.5 rounded hover:bg-line text-ink-muted"
          title="最大化 / 还原"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); closeFloating(view); closePanel(view) }}
          className="p-1.5 rounded hover:bg-line text-ink-muted"
          title="关闭(同时关掉 tab)"
        >
          <X size={14} />
        </button>
      </div>

      <div className={clsx('flex-1 min-h-0', item.view === 'im' || item.view === 'memory' ? 'overflow-hidden' : 'overflow-auto')}>
        <PanelContent item={item} />
      </div>

      <div
        onPointerDown={startDrag('resize')}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10 touch-none"
        title="拖拽缩放"
      >
        <svg viewBox="0 0 16 16" className="absolute inset-0 text-ink-subtle">
          <path d="M14 14 L8 14 M14 14 L14 8 M14 14 L10 14 M14 14 L14 10" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </div>
    </div>
  )
}

export function FloatingPanel() {
  const floating = useApp((s) => s.floating)
  const setFloatingBox = useApp((s) => s.setFloatingBox)
  const panels = useApp((s) => s.panels)

  useEffect(() => {
    const onResize = () => {
      const entries = Object.entries(floating) as [SidePanelItem['view'], FloatingBox][]
      for (const [view, box] of entries) {
        if (!box) continue
        const next = clampBox(box)
        if (next.x !== box.x || next.y !== box.y || next.width !== box.width || next.height !== box.height) {
          setFloatingBox(view, next)
        }
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [floating, setFloatingBox])

  const entries = Object.entries(floating) as [SidePanelItem['view'], FloatingBox][]
  if (!entries.length) return null

  return createPortal(
    <>
      {entries.map(([view, box]) => (
        <FloatingWindow
          key={view}
          view={view}
          box={box}
          panelMeta={panels.find((p) => p.view === view)}
        />
      ))}
    </>,
    document.body,
  )
}
