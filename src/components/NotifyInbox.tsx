import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'
import { collectInbox } from '@/lib/notify-inbox'
import { imPaneOpen, imUnreadMouth, normalizeCwd } from '@/lib/im-letter-home'
import { useImMailbox } from '@/lib/im-mailbox'
import { openRef } from '@/lib/open-ref'
import { requestOsNotifyPermission } from '@/lib/task-notify'
import { useApp } from '@/store/app'

function when(ts?: string) {
  if (!ts) return ''
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function NotifyInbox() {
  const imPanelState = useApp((s) => s.panels.find((panel) => panel.id === 'im')?.state)
  const imFloating = useApp((s) => Boolean(s.floating.im))
  const workspaces = useApp((s) => s.workspaces)
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId)
  const notifications = useApp((s) => s.notifications)
  const markNotifRead = useApp((s) => s.markNotifRead)
  const markAll = useApp((s) => s.markAllNotifRead)
  const mailbox = useImMailbox()
  const currentHome = normalizeCwd(workspaces.find((row) => row.id === activeWorkspaceId)?.cwd)
  const imOpen = imPaneOpen(imPanelState, imFloating)
  const muteBlocksIm = useApp((s) => s.muteBlocksIm)
  const imMuted = useApp((s) => s.imMuted)
  const skipIm = Boolean(muteBlocksIm && imMuted)
  const unreadIm = skipIm ? 0 : imUnreadMouth(mailbox.sheet, imOpen, currentHome)
  const unreadNotif = notifications.filter((row) => !row.read).length
  const unread = unreadIm + unreadNotif
  const rows = collectInbox(notifications, mailbox.sheet, mailbox.hall, imOpen, currentHome, { skipIm })

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
        className="btn-ghost h-7 w-7 p-0 relative"
        title="通知中心"
        aria-label={unread > 0 ? `通知中心，${unread} 条未读` : '通知中心'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          void requestOsNotifyPermission()
          setOpen((value) => !value)
        }}
      >
        <Bell size={14} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 text-[9px] px-1 rounded-full bg-accent-red text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed w-80 bg-surface border border-line rounded-lg shadow-pop py-1.5 flex flex-col overflow-hidden"
          style={{ right: menuPos.right, top: menuPos.top, zIndex: 10000, maxHeight: menuPos.maxHeight }}
        >
          <div className="px-3 py-1.5 flex items-center justify-between shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-ink-subtle">未读</div>
            {unreadNotif > 0 && (
              <button
                type="button"
                className="text-[11px] text-ink-muted hover:text-ink"
                onClick={() => markAll()}
              >
                全部已读
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.length === 0 && (
              <div className="px-3 py-6 text-sm text-ink-muted">没有未读</div>
            )}
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-surface-2"
                onClick={() => {
                  if (row.source === 'task') markNotifRead(row.id)
                  openRef(row.land)
                  setOpen(false)
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{row.title}</div>
                  {row.body && <div className="text-[11px] text-ink-muted mt-0.5 truncate">{row.body}</div>}
                  {row.ts && <div className="text-[10px] text-ink-subtle mt-0.5">{when(row.ts)}</div>}
                </div>
                {!!row.count && row.count > 1 && (
                  <span className="min-w-4 h-4 px-1 rounded-full bg-accent-red text-white text-[9px] flex items-center justify-center mt-0.5 shrink-0">
                    {row.count > 99 ? '99+' : row.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
