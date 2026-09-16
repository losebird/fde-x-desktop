// 可拖拽侧边栏。鼠标按住 6px 的 handle 横向拖动,松开持久化到 store。
// 用法:<ResizablePanel side="right" width={w} onResize={setW} min={280} max={1200}>{children}</ResizablePanel>
import { useCallback, useRef, type ReactNode } from 'react'
import clsx from 'clsx'

interface Props {
  side?: 'right' | 'left'
  width: number
  onResize: (w: number) => void
  min?: number
  max?: number
  className?: string
  children: ReactNode
}

export function ResizablePanel({ side = 'right', width, onResize, min = 280, max = 1200, className, children }: Props) {
  const startX = useRef(0)
  const startW = useRef(0)
  const dragging = useRef(false)

  const onDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startX.current = e.clientX
      startW.current = width
      dragging.current = true
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return
        const dx = ev.clientX - startX.current
        // 右栏:往左拖 dx<0 → 宽度增加
        // 左栏:往右拖 dx>0 → 宽度增加
        const next = side === 'right' ? startW.current - dx : startW.current + dx
        onResize(Math.max(min, Math.min(max, next)))
      }
      const onUp = () => {
        dragging.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [width, onResize, side, min, max],
  )

  return (
    <div className={clsx('relative flex-shrink-0', className)} style={{ width }}>
      {children}
      <div
        onMouseDown={onDown}
        className={clsx(
          'absolute top-0 bottom-0 w-1.5 cursor-col-resize z-20 group',
          side === 'right' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
        )}
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-neutral-200 group-hover:bg-emerald-400 transition-colors" />
      </div>
    </div>
  )
}
