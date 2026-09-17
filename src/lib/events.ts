import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useApp } from '@/store/app'

export type FdeEvent<T = unknown> = {
  id: string
  ts: number
  type: string
  workspaceCwd: string | null
  sessionId?: string
  source: string
  payload: T
}

export const FDE_EVENT_TYPES_V1 = [
  'ai.tool.called',
  'ai.tool.finished',
  'ai.session.changed',
  'biz.sheet.pending',
  'biz.write.done',
  'im.message.received',
  'im.unread.changed',
  'app.spec.submitted',
  'app.activated',
  'app.record.changed',
  'task.changed',
  'briefing.ready',
  'memory.card.drafted',
] as const

const SESSION_SINCE_KEY = 'fde-x-events-since'
const POLL_MS = 15_000

type StreamStatus = 'idle' | 'connecting' | 'open' | 'polling' | 'closed'

type Listener = {
  types: string[] | '*'
  handler: (event: FdeEvent) => void
  workspace?: string
}

const listeners = new Set<Listener>()
let eventSource: EventSource | null = null
let streamStatus: StreamStatus = 'idle'
let reconnectAttempt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: number | null = null
let pollWarned = false
let boundWorkspace = ''
const statusSubscribers = new Set<() => void>()

function notifyStatus() {
  for (const fn of statusSubscribers) fn()
}

function setStreamStatus(next: StreamStatus) {
  if (streamStatus === next) return
  streamStatus = next
  notifyStatus()
}

function currentWorkspaceFromStore(): string {
  const state = useApp.getState()
  const row = state.workspaces.find((item) => item.id === state.activeWorkspaceId) ?? state.workspaces[0]
  const cwd = typeof row?.cwd === 'string' ? row.cwd.trim() : ''
  return cwd.startsWith('/') ? cwd : ''
}

function dispatchEvent(event: FdeEvent) {
  if (event.id) {
    try {
      sessionStorage.setItem(SESSION_SINCE_KEY, event.id)
    } catch {
      // ignore quota / private mode
    }
  }
  for (const listener of listeners) {
    if (listener.workspace && event.workspaceCwd != null && event.workspaceCwd !== listener.workspace) {
      continue
    }
    if (listener.types !== '*' && !listener.types.includes(event.type)) continue
    listener.handler(event)
  }
}

function parseEnvelope(raw: string): FdeEvent | null {
  try {
    return JSON.parse(raw) as FdeEvent
  } catch {
    return null
  }
}

function attachTypeListeners(source: EventSource) {
  const onPayload = (message: MessageEvent<string>) => {
    const envelope = parseEnvelope(String(message.data ?? ''))
    if (envelope) dispatchEvent(envelope)
  }
  source.onmessage = onPayload
  for (const type of FDE_EVENT_TYPES_V1) {
    source.addEventListener(type, onPayload as EventListener)
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling(workspace: string) {
  if (pollTimer) return
  setStreamStatus('polling')
  if (!pollWarned) {
    console.warn('事件流不可用，已退回 /api/v1/events/recent 轮询')
    pollWarned = true
  }
  pollTimer = window.setInterval(() => {
    const params = new URLSearchParams()
    if (workspace) params.set('workspace', workspace)
    params.set('limit', '50')
    void fetch(`/api/v1/events/recent?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const items = Array.isArray(body?.items) ? body.items as FdeEvent[] : []
        for (const item of items) dispatchEvent(item)
      })
      .catch(() => undefined)
  }, POLL_MS)
}

function teardownStream() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function scheduleReconnect(workspace: string) {
  const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt)
  reconnectAttempt += 1
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectEventStream(workspace)
  }, delay)
}

function connectEventStream(workspace: string) {
  teardownStream()
  boundWorkspace = workspace
  setStreamStatus('connecting')

  const params = new URLSearchParams()
  if (workspace) params.set('workspace', workspace)
  try {
    const since = sessionStorage.getItem(SESSION_SINCE_KEY)
    if (since) params.set('since', since)
  } catch {
    // ignore
  }

  const source = new EventSource(`/api/v1/events?${params.toString()}`)
  eventSource = source
  attachTypeListeners(source)

  source.onopen = () => {
    reconnectAttempt = 0
    stopPolling()
    setStreamStatus('open')
  }

  source.onerror = () => {
    setStreamStatus('closed')
    teardownStream()
    startPolling(workspace)
    scheduleReconnect(workspace)
  }
}

export function getEventStream(): EventSource {
  const workspace = currentWorkspaceFromStore()
  if (!eventSource || boundWorkspace !== workspace) {
    connectEventStream(workspace)
  }
  if (!eventSource) {
    throw new Error('event_stream_unavailable')
  }
  return eventSource
}

function ensureStreamSubscription() {
  const workspace = currentWorkspaceFromStore()
  if (!eventSource || boundWorkspace !== workspace) {
    connectEventStream(workspace)
  }
}

export function useEvents(
  types: string[] | '*',
  handler: (event: FdeEvent) => void,
  opts?: { workspace?: string },
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    ensureStreamSubscription()
    const listener: Listener = {
      types,
      workspace: opts?.workspace,
      handler: (event) => {
        handlerRef.current(event)
      },
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [Array.isArray(types) ? types.join('\0') : types, opts?.workspace])
}

export function useEventStreamStatus(): StreamStatus {
  return useSyncExternalStore(
    (onStoreChange) => {
      statusSubscribers.add(onStoreChange)
      return () => {
        statusSubscribers.delete(onStoreChange)
      }
    },
    () => streamStatus,
    () => streamStatus,
  )
}
