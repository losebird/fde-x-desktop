import { emit } from './events.mjs'
import { emitBizSheetPending } from './routes/biz.mjs'
import { pendingSheetWatchFingerprint } from './biz/sheet-fingerprint.mjs'
import { sheetAfterDismissedWrite } from './biz/dismissed-previews.mjs'
import { sheetPayloadFromRaw } from './biz/sheet-payload.mjs'
import { reconcileLanAssistConnectionLamp } from './biz/connection-lamp.mjs'


const POLL_MS = 1000

function fingerprintPendingSheet(sheet) {
  return pendingSheetWatchFingerprint(sheet)
}

function incomingRequestIds(state) {
  const requests = Array.isArray(state?.requests) ? state.requests : []
  const ids = new Set()
  for (const row of requests) {
    if (row?.kind !== 'incoming') continue
    const id = String(row.id || '')
    if (id) ids.add(id)
  }
  return ids
}

function buildUnread(state) {
  const requests = Array.isArray(state?.requests) ? state.requests : []
  const byPeer = {}
  let total = 0
  for (const row of requests) {
    if (!row?.unread || row.kind !== 'incoming') continue
    total += 1
    const peerId = String(row.from || row.peerId || '')
    if (peerId) byPeer[peerId] = (byPeer[peerId] || 0) + 1
  }
  return { total, byPeer }
}

function hasHandoff(row) {
  if (row?.handoff) return true
  const rawAttach = Array.isArray(row?.attachments) ? row.attachments : []
  for (const item of rawAttach) {
    if (!item || typeof item !== 'object') continue
    if (item.kind === 'handoff') return true
    if (item.mime === 'application/vnd.dsh.handoff+json') return true
  }
  return false
}

function newIncomingMessages(state, knownIds) {
  const requests = Array.isArray(state?.requests) ? state.requests : []
  const messages = []
  for (const row of requests) {
    if (row?.kind !== 'incoming') continue
    const requestId = String(row.id || '')
    if (!requestId || knownIds.has(requestId)) continue
    messages.push({
      peerId: String(row.from || ''),
      requestId,
      hasHandoff: hasHandoff(row),
    })
  }
  return messages
}

function officialFromState(state) {
  return sheetAfterDismissedWrite(sheetPayloadFromRaw(state?.officialRoundSheet))
}

function emitOfficialSheet(sheet, deps, source = 'round-end', surfaceId, writePreview) {
  const workspaceCwd = typeof sheet.workspace === 'string' && sheet.workspace.startsWith('/')
    ? sheet.workspace
    : deps.cwd
  const sessionId = typeof sheet.sessionId === 'string' ? sheet.sessionId : undefined
  const emitted = emitBizSheetPending(sheet, {
    sessionId,
    source,
    workspaceCwd,
    surfaceId: typeof surfaceId === 'string' && surfaceId.trim() ? surfaceId.trim() : undefined,
    writePreview,
  })
  if (emitted && typeof deps.onPendingSheet === 'function') {
    deps.onPendingSheet(sheet, sessionId)
  }
  return emitted
}

/**
 * @param {{ lanAssist: Function, cwd: string, onPendingSheet?: Function, prepareSurface?: Function }} deps
 */
export function subscribeLanAssistMailbox({ origin, cookie, onEvent, onLive, onDown }) {
  const ac = new AbortController()
  const url = new URL('/lan-assist/events', origin)
  void (async () => {
    while (!ac.signal.aborted) {
      try {
        const response = await fetch(url, {
          headers: {
            cookie: String(cookie || ''),
            origin: String(origin || ''),
            accept: 'text/event-stream',
          },
          signal: ac.signal,
        })
        if (!response.ok || !response.body) throw new Error('mailbox sse unavailable')
        if (typeof onLive === 'function') onLive()
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const chunks = buf.split('\n\n')
          buf = chunks.pop() || ''
          for (const block of chunks) {
            const dataLine = block.split('\n').find((line) => line.startsWith('data:'))
            if (!dataLine) continue
            try {
              onEvent(JSON.parse(dataLine.slice(5).trim()))
            } catch { /* ignore malformed mailbox frames */ }
          }
        }
        if (typeof onDown === 'function') onDown()
      } catch {
        if (typeof onDown === 'function') onDown()
        if (ac.signal.aborted) return
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  })()
  return () => ac.abort()
}

export function startLanAssistStateWatch(deps) {
  const { lanAssist, cwd, db } = deps
  let lastSheetFp = ''
  let lastUnreadFp = ''
  let knownIncomingIds = new Set()
  let bootstrapped = false

  const processOfficialSheet = (sheet, { force = false, writePreview } = {}) => {
    const sheetFp = fingerprintPendingSheet(sheet)
    if (!sheetFp) return false
    if (!force && sheetFp === lastSheetFp) return false
    lastSheetFp = sheetFp
    const sessionId = typeof sheet.sessionId === 'string' ? sheet.sessionId : undefined
    let surfaceId
    if (typeof deps.prepareSurface === 'function') {
      const prepared = deps.prepareSurface(sheet, sessionId)
      if (typeof prepared === 'string' && prepared.trim()) surfaceId = prepared.trim()
    }
    return emitOfficialSheet(sheet, deps, 'round-end', surfaceId, writePreview)
  }

  const tick = async () => {
    try {
      const state = await lanAssist('/state', { search: { sessionId: '' } })
      if (db) reconcileLanAssistConnectionLamp(db, state && state.ok !== false ? state : null)
      if (!state || state.ok === false) return

      const sheet = officialFromState(state)
      if (sheet) processOfficialSheet(sheet, { writePreview: state.writePreview })

      const unread = buildUnread(state)
      const unreadFp = JSON.stringify(unread)
      if (unreadFp !== lastUnreadFp) {
        lastUnreadFp = unreadFp
        emit('im.unread.changed', unread, { workspaceCwd: cwd, source: 'lan-assist' })
      }

      if (!bootstrapped) {
        knownIncomingIds = incomingRequestIds(state)
        bootstrapped = true
      } else {
        const fresh = newIncomingMessages(state, knownIncomingIds)
        for (const message of fresh) {
          knownIncomingIds.add(message.requestId)
          emit('im.message.received', message, { workspaceCwd: cwd, source: 'lan-assist' })
        }
      }
    } catch {
      if (db) reconcileLanAssistConnectionLamp(db, null)
      // lan-assist offline: no events, no error (spec §7)
    }
  }

  const flushPendingSheet = async (sessionId) => {
    try {
      const sid = String(sessionId || '').trim()
      const state = await lanAssist('/state', { search: { sessionId: sid } })
      if (!state || state.ok === false) return false
      const sheet = officialFromState(state)
      if (!sheet) return false
      return processOfficialSheet(sheet, { force: true, writePreview: state.writePreview })
    } catch {
      return false
    }
  }

  void tick()
  let timer = null
  const startPoll = () => {
    if (timer) return
    timer = setInterval(() => { void tick() }, POLL_MS)
    if (typeof timer.unref === 'function') timer.unref()
  }
  const stopPoll = () => {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }
  let stopMailbox = () => {}
  if (typeof deps.subscribeLanMailbox === 'function') {
    startPoll()
    stopMailbox = deps.subscribeLanMailbox((payload) => {
      if (payload && String(payload.type || '') === 'official-sheet') {
        void flushPendingSheet(payload.sessionId).then((ok) => {
          if (!ok) startPoll()
        })
        return
      }
      void tick()
    }, {
      onDown: startPoll,
    })
  } else {
    startPoll()
  }
  return {
    stop: () => {
      stopPoll()
      stopMailbox()
    },
    flushPendingSheet,
  }
}
