import { emit } from './events.mjs'
import { emitBizSheetPending } from './routes/biz.mjs'
import { pendingSheetWatchFingerprint } from './biz/sheet-fingerprint.mjs'

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

function sheetFromState(state) {
  const raw = state?.pendingSheet ?? state?.pendingWrite
  if (!raw || typeof raw !== 'object') return null
  const rowList = Array.isArray(raw.rows) ? raw.rows : []
  const columnList = Array.isArray(raw.columns) ? raw.columns : []
  return {
    kind: String(raw.kind || ''),
    action: String(raw.action || ''),
    preview_id: raw.preview_id ?? raw.previewId ?? null,
    previewId: raw.preview_id ?? raw.previewId ?? null,
    rows: rowList,
    columns: columnList,
    canWrite: Boolean(raw.canWrite ?? raw.can_write),
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    workspace: typeof raw.workspace === 'string' ? raw.workspace : undefined,
    ...(Array.isArray(raw.where) && raw.where.length ? { where: raw.where } : {}),
    ...(Array.isArray(raw.hopWhere) && raw.hopWhere.length ? { hopWhere: raw.hopWhere } : {}),
  }
}

function emitPendingSheet(sheet, deps, source = 'lan-assist') {
  const workspaceCwd = typeof sheet.workspace === 'string' && sheet.workspace.startsWith('/')
    ? sheet.workspace
    : deps.cwd
  const sessionId = typeof sheet.sessionId === 'string' ? sheet.sessionId : undefined
  const emitted = emitBizSheetPending(sheet, { sessionId, source, workspaceCwd })
  if (emitted && typeof deps.onPendingSheet === 'function') {
    deps.onPendingSheet(sheet, sessionId)
  }
  return emitted
}

/**
 * @param {{ lanAssist: Function, cwd: string, onPendingSheet?: Function }} deps
 */
export function startLanAssistStateWatch(deps) {
  const { lanAssist, cwd } = deps
  let lastSheetFp = ''
  let lastUnreadFp = ''
  let knownIncomingIds = new Set()
  let bootstrapped = false

  const processPendingSheet = (sheet, { force = false } = {}) => {
    const sheetFp = fingerprintPendingSheet(sheet)
    if (!sheetFp) return false
    if (!force && sheetFp === lastSheetFp) return false
    lastSheetFp = sheetFp
    return emitPendingSheet(sheet, deps)
  }

  const tick = async () => {
    try {
      const state = await lanAssist('/state', { search: { sessionId: '' } })
      if (!state || state.ok === false) return

      const sheet = sheetFromState(state)
      if (sheet) processPendingSheet(sheet)

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
      // lan-assist offline: no events, no error (spec §7)
    }
  }

  const flushPendingSheet = async () => {
    try {
      const state = await lanAssist('/state', { search: { sessionId: '' } })
      if (!state || state.ok === false) return false
      const sheet = sheetFromState(state)
      if (!sheet) return false
      return processPendingSheet(sheet, { force: true })
    } catch {
      return false
    }
  }

  void tick()
  const timer = setInterval(() => { void tick() }, POLL_MS)
  if (typeof timer.unref === 'function') timer.unref()
  return { stop: () => clearInterval(timer), flushPendingSheet }
}
