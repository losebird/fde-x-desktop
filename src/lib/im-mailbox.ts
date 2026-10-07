/** One browser writer for the IM hall and unread sheet. Views fold the sheet; they do not fetch /state. */

import { useSyncExternalStore } from 'react'
import { onEventStreamStatus, registerFdeEventListener, type FdeEvent } from '@/lib/events'
import { emptyUnreadSheet, localCwdSet, unreadSheet, type UnreadSheet } from '@/lib/im-letter-home'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

export type ImMailboxSnapshot = {
  hall: Record<string, unknown>
  sheet: UnreadSheet
  revision: number
  hallSeq: number
  letterSeq: number
  letterKey: string
}

const emptyHall: Record<string, unknown> = { requests: [] }

let snapshot: ImMailboxSnapshot = {
  hall: emptyHall,
  sheet: emptyUnreadSheet(),
  revision: 0,
  hallSeq: 0,
  letterSeq: 0,
  letterKey: '',
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

function sheetOf(hall: Record<string, unknown>): UnreadSheet {
  return unreadSheet(hallRequests(hall), localsFromApp(), hallSelfId(hall))
}

function publishHall(hall: Record<string, unknown>, letter?: { key?: string }) {
  snapshot = {
    hall,
    sheet: sheetOf(hall),
    revision: snapshot.revision + 1,
    hallSeq: snapshot.hallSeq + 1,
    letterSeq: letter ? snapshot.letterSeq + 1 : snapshot.letterSeq,
    letterKey: letter ? String(letter.key || '*') : snapshot.letterKey,
  }
  notify()
}

function isUnreadSheet(payload: unknown): payload is UnreadSheet {
  if (!payload || typeof payload !== 'object') return false
  const row = payload as Record<string, unknown>
  return Array.isArray(row.talks) && !!row.byTalk && typeof row.byTalk === 'object'
}

function applyUnreadChanged(event: FdeEvent) {
  if (!isUnreadSheet(event.payload)) {
    void pullImMailbox()
    return
  }
  snapshot = {
    ...snapshot,
    sheet: event.payload,
    revision: snapshot.revision + 1,
  }
  notify()
}

function idsOf(rows: unknown, field = 'id'): Set<string> {
  const out = new Set<string>()
  if (!Array.isArray(rows)) return out
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const id = String((row as Record<string, unknown>)[field] || '')
    if (id) out.add(id)
  }
  return out
}

function applyPeerChanged(event: FdeEvent) {
  const payload = event.payload && typeof event.payload === 'object'
    ? event.payload as Record<string, unknown>
    : null
  if (!payload) {
    void pullImMailbox()
    return
  }
  const hall = snapshot.hall
  const knownPeers = idsOf(hall.peers)
  const knownGroups = idsOf(hall.groups)
  const incomingPeers = Array.isArray(payload.peers) ? payload.peers as Array<Record<string, unknown>> : []
  const incomingGroups = Array.isArray(payload.groups) ? payload.groups as Array<Record<string, unknown>> : []
  const unknownPeer = incomingPeers.some((row) => {
    const id = String(row.id || '')
    return id && !knownPeers.has(id)
  })
  const unknownGroup = incomingGroups.some((row) => {
    const id = String(row.id || '')
    return id && !knownGroups.has(id)
  })
  if (!knownPeers.size || unknownPeer || unknownGroup) {
    void pullImMailbox()
    return
  }
  const online = new Map(incomingPeers.map((row) => [String(row.id || ''), Boolean(row.online)]))
  const peers = Array.isArray(hall.peers)
    ? (hall.peers as Array<Record<string, unknown>>).map((row) => {
      const id = String(row.id || '')
      if (!id || !online.has(id)) return row
      return { ...row, online: online.get(id) }
    })
    : incomingPeers
  publishHall({
    ...hall,
    peers,
    pairAsk: Object.prototype.hasOwnProperty.call(payload, 'pairAsk') ? payload.pairAsk : hall.pairAsk,
    pairWait: Object.prototype.hasOwnProperty.call(payload, 'pairWait') ? payload.pairWait : hall.pairWait,
    doorPort: Object.prototype.hasOwnProperty.call(payload, 'doorPort') ? payload.doorPort : hall.doorPort,
  })
}

function letterKeyOf(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '*'
  const row = payload as Record<string, unknown>
  const groupId = String(row.groupId || '')
  if (groupId) return groupId
  const peerId = String(row.peerId || '')
  if (peerId) return peerId
  return '*'
}

function applyLetterArrived(event: FdeEvent) {
  snapshot = {
    ...snapshot,
    revision: snapshot.revision + 1,
    letterSeq: snapshot.letterSeq + 1,
    letterKey: letterKeyOf(event.payload),
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
      publishHall(hall && typeof hall === 'object' ? hall : emptyHall, { key: '*' })
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
  publishHall({
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
  registerFdeEventListener(['im.unread.changed'], (event) => {
    applyUnreadChanged(event)
  })
  registerFdeEventListener(['im.message.received', 'im.message.sent'], (event) => {
    applyLetterArrived(event)
  })
  registerFdeEventListener(['im.peer.changed'], (event) => {
    applyPeerChanged(event)
  })
  onEventStreamStatus((status) => {
    if (status === 'open') void pullImMailbox()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pullImMailbox()
  })
  useApp.subscribe((state, prev) => {
    if (state.workspaces === prev.workspaces) return
    snapshot = {
      ...snapshot,
      sheet: sheetOf(snapshot.hall),
      revision: snapshot.revision + 1,
    }
    notify()
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
