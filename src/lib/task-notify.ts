import type { FdeEvent } from '@/lib/events'
import { activateOsNotice } from '@/lib/notify-inbox'
import type { Notification as NoticeRow } from '@/lib/types'
import { useApp } from '@/store/app'

type Notice = { title: string; body?: string; href?: 'plan' | 'ai' | 'mcp'; sessionId?: string; cwd?: string; gate: 'done' | 'due' | 'mcp' }

function displayTitle(raw: unknown) {
  return String(raw || '').replace(/<\|[^|]*\|>/g, '').replace(/\s+/g, ' ').trim()
}

export function noticeFromEvent(event: FdeEvent): Notice | null {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}
  if (event.type === 'task.done' && payload.source === 'session') {
    const title = displayTitle(payload.title)
    const sessionId = String(payload.sessionId || event.sessionId || '').trim()
    const cwd = String(payload.cwd || event.workspaceCwd || '').trim()
    return {
      title: title ? `会话完成：${title}` : '会话任务完成',
      href: 'ai',
      ...(sessionId ? { sessionId } : {}),
      ...(cwd ? { cwd } : {}),
      gate: 'done',
    }
  }
  if (event.type === 'task.changed' && payload.status === 'done') {
    const title = displayTitle(payload.title)
    return { title: title ? `任务完成：${title}` : '任务完成', href: 'plan', gate: 'done' }
  }
  if (event.type === 'ai.result.ready') {
    return { title: '任务完成', href: 'ai', gate: 'done' }
  }
  if (event.type === 'task.due.soon') {
    const title = displayTitle(payload.title)
    return { title: title ? `即将到期：${title}` : '任务即将到期', href: 'plan', gate: 'due' }
  }
  if (event.type === 'mcp.health.changed' && payload.ok === false) {
    const name = String(payload.serverName || '').trim()
    return { title: name ? `连接器异常：${name}` : '连接器异常', href: 'mcp', gate: 'mcp' }
  }
  return null
}

export function requestOsNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return Promise.resolve('unsupported')
  if (Notification.permission !== 'default') return Promise.resolve(Notification.permission)
  return Notification.requestPermission()
}

function playNoticeSound() {
  try {
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.08
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.stop(ctx.currentTime + 0.2)
    osc.onended = () => { void ctx.close() }
  } catch {
    /* sound is best-effort */
  }
}

function showOsNotice(notice: Notice, id: string) {
  const payload = {
    title: notice.title,
    body: notice.body || '',
    id,
    href: notice.href,
    sessionId: notice.sessionId,
    cwd: notice.cwd,
  }
  const desktop = typeof window !== 'undefined' ? window.fdeDesktop : undefined
  if (desktop?.notify) {
    void desktop.notify(payload)
    return
  }
  playNoticeSound()
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'granted') {
    const os = new Notification(notice.title, { body: notice.body, silent: false, requireInteraction: true })
    os.onclick = () => activateOsNotice(payload)
  }
}

export function applyTaskNotice(event: FdeEvent) {
  const notice = noticeFromEvent(event)
  if (!notice) return
  const state = useApp.getState()
  if (notice.gate === 'done' && !state.taskDoneNotify) return
  if (notice.gate === 'due' && !state.taskDueSoonNotify) return
  if (notice.gate === 'mcp' && !state.mcpDownNotify) return
  const rowId = event.id ? `n_${event.id}` : ''
  if (rowId && state.notifications.some((row) => row.id === rowId)) return
  const row: NoticeRow = {
    id: rowId || `n_${Date.now()}`,
    kind: 'success',
    title: notice.title,
    body: notice.body,
    ts: new Date(event.ts || Date.now()).toISOString(),
    read: false,
    href: notice.href,
    ...(notice.sessionId ? { sessionId: notice.sessionId } : {}),
    ...(notice.cwd ? { cwd: notice.cwd } : {}),
  }
  state.addNotification(row)
  showOsNotice(notice, row.id)
  emitTaskToast(notice)
}

type ToastFn = (notice: Notice) => void
const toastFns = new Set<ToastFn>()

export function onTaskToast(fn: ToastFn) {
  toastFns.add(fn)
  return () => { toastFns.delete(fn) }
}

function emitTaskToast(notice: Notice) {
  for (const fn of toastFns) fn(notice)
}
