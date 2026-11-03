import type { FdeEvent } from '@/lib/events'
import type { Notification as NoticeRow } from '@/lib/types'
import { useApp } from '@/store/app'

type Notice = { title: string; body?: string; href?: 'plan' | 'ai' | 'mcp'; gate: 'done' | 'due' | 'mcp' }

export function noticeFromEvent(event: FdeEvent): Notice | null {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}
  if (event.type === 'task.done' && payload.source === 'session') {
    const title = String(payload.title || '').trim()
    return { title: title ? `会话完成：${title}` : '会话任务完成', href: 'ai', gate: 'done' }
  }
  if (event.type === 'task.changed' && payload.status === 'done') {
    const title = String(payload.title || '').trim()
    return { title: title ? `任务完成：${title}` : '任务完成', href: 'plan', gate: 'done' }
  }
  if (event.type === 'ai.result.ready') {
    return { title: '任务完成', href: 'ai', gate: 'done' }
  }
  if (event.type === 'task.due.soon') {
    const title = String(payload.title || '').trim()
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

function showOsNotice(notice: Notice) {
  const desktop = typeof window !== 'undefined' ? window.fdeDesktop : undefined
  if (desktop?.notify) {
    void desktop.notify({ title: notice.title, body: notice.body || '' })
    return
  }
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'granted') {
    new Notification(notice.title, { body: notice.body, silent: false, requireInteraction: true })
  }
}

export function applyTaskNotice(event: FdeEvent) {
  const notice = noticeFromEvent(event)
  if (!notice) return
  const state = useApp.getState()
  if (notice.gate === 'done' && !state.taskDoneNotify) return
  if (notice.gate === 'due' && !state.taskDueSoonNotify) return
  if (notice.gate === 'mcp' && !state.mcpDownNotify) return
  const row: NoticeRow = {
    id: `n_${event.id}`,
    kind: 'success',
    title: notice.title,
    body: notice.body,
    ts: new Date(event.ts || Date.now()).toISOString(),
    read: false,
    href: notice.href,
  }
  state.addNotification(row)
  showOsNotice(notice)
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
