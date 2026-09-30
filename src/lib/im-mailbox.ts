/** One browser writer for the IM hall and unread sheet. Views fold the sheet; they do not fetch /state. */

import { useSyncExternalStore } from 'react'
import { onEventStreamStatus, registerFdeEventListener } from '@/lib/events'
import { emptyUnreadSheet, localCwdSet, unreadSheet, type UnreadSheet } from '@/lib/im-letter-home'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

export type ImMailboxSnapshot = {
  hall: Record<string, unknown>
  sheet: UnreadSheet
  revision: number
}

const emptyHall: Record<string, unknown> = { requests: [] }

let snapshot: ImMailboxSnapshot = {
  hall: emptyHall,
  sheet: emptyUnreadSheet(),
  revision: 0,
}

const listeners = new Set<() => void>()
let started = false
let inflight: Promise<void> | null = null
let queued = false

function notify() {
  for (const fn of listeners) fn()
}

function hallRequests(hall: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(hall.requests) ? hall.requests as Array<Record<string, unknown>> : []
}

function hallSelfId(hall: Record<string, unknown>): string {
  const self = hall.self && typeof hall.self === 'object' ? hall.self as Record<string, unknown> : null
  return String(self?.id || '')
}

function localsFromApp(): ReturnType<typeof localCwdSet> {
  return localCwdSet(useApp.getState().workspaces)
}

function publish(hall: Record<string, unknown>) {
  snapshot = {
    hall,
    sheet: unreadSheet(hallRequests(hall), localsFromApp(), hallSelfId(hall)),
    revision: snapshot.revision + 1,
  }
  notify()
}

export function getImMailbox(): ImMailboxSnapshot {
  return snapshot
}

export function pullImMailbox(): Promise<void> {
  if (inflight) {
    queued = true
    return inflight
  }
  inflight = runtimeApi.imState()
    .then((hall) => {
      publish(hall && typeof hall === 'object' ? hall : emptyHall)
    })
    .catch(() => undefined)
    .finally(() => {
      inflight = null
      if (queued) {
        queued = false
        void pullImMailbox()
      }
    })
  return inflight
}

export function stampImMailboxRead(ids: string[]) {
  const want = new Set(ids.map((id) => String(id || '')).filter(Boolean))
  if (!want.size) return
  const hall = snapshot.hall
  const selfId = hallSelfId(hall)
  const now = Date.now()
  publish({
    ...hall,
    requests: hallRequests(hall).map((row) => {
      const id = String(row.id || '')
      if (!want.has(id)) return row
      const prev = row.reads && typeof row.reads === 'object' && !Array.isArray(row.reads)
        ? row.reads as Record<string, unknown>
        : {}
      const reads = { ...prev }
      if (selfId) reads[selfId] = now
      return { ...row, unread: false, reads }
    }),
  })
}

export function startImMailbox() {
  if (started) return
  started = true
  void pullImMailbox()
  registerFdeEventListener(['im.unread.changed', 'im.message.received'], () => {
    void pullImMailbox()
  })
  onEventStreamStatus((status) => {
    if (status === 'open') void pullImMailbox()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pullImMailbox()
  })
  useApp.subscribe((state, prev) => {
    if (state.workspaces === prev.workspaces) return
    publish(snapshot.hall)
  })
}

export function useImMailbox(): ImMailboxSnapshot {
  return useSyncExternalStore(
    (onStoreChange) => {
      startImMailbox()
      listeners.add(onStoreChange)
      return () => {
        listeners.delete(onStoreChange)
      }
    },
    () => snapshot,
    () => snapshot,
  )
}
