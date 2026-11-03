import { beginCreate } from '@/lib/create-mouth'
import { useApp } from '@/store/app'

export type WorkbenchShortcut =
  | 'search'
  | 'session'
  | 'task'
  | 'event'
  | 'briefing'
  | 'mute-im'
  | 'session-prev'
  | 'session-next'

export function applyWorkbenchShortcut(name: WorkbenchShortcut) {
  const app = useApp.getState()
  if (name === 'search') {
    app.setPaletteOpen(true)
    return
  }
  if (name === 'session') {
    beginCreate('session')
    return
  }
  if (name === 'task') {
    beginCreate('task')
    return
  }
  if (name === 'event') {
    beginCreate('event')
    return
  }
  if (name === 'briefing') {
    app.togglePanel('briefing', 'full')
    return
  }
  if (name === 'mute-im') {
    app.setIMMuted(!app.imMuted)
    return
  }
  if (name === 'session-prev' || name === 'session-next') {
    window.dispatchEvent(new CustomEvent('fde-x-session-step', { detail: name === 'session-prev' ? -1 : 1 }))
  }
}

export function shortcutFromKeyEvent(event: KeyboardEvent): WorkbenchShortcut | '' {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return ''
  const key = event.key
  if (key === 'k' || key === 'K') return 'search'
  if (key === 'n' || key === 'N') return 'session'
  if (key === 't' || key === 'T') return 'task'
  if (key === 'e' || key === 'E') return 'event'
  if (key === '0') return 'briefing'
  if (key === ';') return 'mute-im'
  if (key === 'ArrowUp') return 'session-prev'
  if (key === 'ArrowDown') return 'session-next'
  return ''
}

export function handleWorkbenchKeydown(event: KeyboardEvent) {
  const name = shortcutFromKeyEvent(event)
  if (!name) return false
  const target = event.target
  if (target instanceof Element && name !== 'search') {
    const field = target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
    if (field) return false
  }
  event.preventDefault()
  applyWorkbenchShortcut(name)
  return true
}
