import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import { beginCreate, type CreateMouth } from '@/lib/create-mouth'

const ITEMS: Array<{ kind: CreateMouth; label: string; hint: string }> = [
  { kind: 'session', label: '新会话', hint: '当前工作区开一条 AI 会话' },
  { kind: 'task', label: '新建任务', hint: '写进计划待办' },
  { kind: 'event', label: '新建事件', hint: '写进计划日程' },
  { kind: 'workflow', label: '新建工作流', hint: '写进计划工作流' },
  { kind: 'app', label: '创建应用', hint: '在业务应用里生成' },
]

export function CreateMenu() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ right: 8, top: 44, maxHeight: 360 })

  useEffect(() => {
    if (!open) return
    const position = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const top = rect.bottom + 6
      setMenuPos({
        right: Math.max(8, window.innerWidth - rect.right),
        top,
        maxHeight: Math.max(240, window.innerHeight - top - 8),
      })
    }
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    position()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        className="btn-ghost h-7 px-2 text-xs flex items-center gap-1"
        title="新建"
        aria-label="新建"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={12} /> 新建
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed w-72 bg-surface border border-line rounded-lg shadow-pop py-1.5 flex flex-col overflow-hidden"
          style={{ right: menuPos.right, top: menuPos.top, zIndex: 10000, maxHeight: menuPos.maxHeight }}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-subtle shrink-0">新建</div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {ITEMS.map((item) => (
              <button
                key={item.kind}
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left hover:bg-surface-2"
                onClick={() => {
                  beginCreate(item.kind)
                  setOpen(false)
                }}
              >
                <div className="text-sm">{item.label}</div>
                <div className="text-[11px] text-ink-muted mt-0.5">{item.hint}</div>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
