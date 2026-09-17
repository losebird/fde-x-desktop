import { emit } from './events.mjs'

const POLL_MS = 3000

function fingerprintPendingSheet(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  return JSON.stringify({
    kind: sheet.kind,
    action: sheet.action,
    previewId: sheet.preview_id ?? sheet.previewId,
    rowCount: Array.isArray(sheet.rows) ? sheet.rows.length : 0,
    columns: sheet.columns,
    canWrite: sheet.canWrite ?? sheet.can_write,
  })
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

/**
 * @param {{ lanAssist: Function, cwd: string }} deps
 */
export function startLanAssistStateWatch(deps) {
  const { lanAssist, cwd } = deps
  let lastSheetFp = ''
  let lastUnreadFp = ''
  let knownIncomingIds = new Set()
  let bootstrapped = false

  const tick = async () => {
    try {
      const state = await lanAssist('/state', { search: { sessionId: '' } })
      if (!state || state.ok === false) return

      const sheet = state.pendingSheet ?? state.pendingWrite
      const sheetFp = fingerprintPendingSheet(sheet)
      if (sheetFp && sheetFp !== lastSheetFp) {
        lastSheetFp = sheetFp
        emit('biz.sheet.pending', {
          kind: String(sheet.kind || ''),
          action: String(sheet.action || ''),
          previewId: sheet.preview_id ?? sheet.previewId ?? undefined,
          rows: Array.isArray(sheet.rows) ? sheet.rows.length : 0,
          columns: Array.isArray(sheet.columns) ? sheet.columns : [],
          canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
          source: 'ai',
        }, {
          workspaceCwd: cwd,
          sessionId: typeof sheet.sessionId === 'string' ? sheet.sessionId : undefined,
          source: 'lan-assist',
        })
        if (typeof deps.onPendingSheet === 'function') {
          deps.onPendingSheet(sheet, typeof sheet.sessionId === 'string' ? sheet.sessionId : undefined)
        }
      }

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

  void tick()
  const timer = setInterval(() => { void tick() }, POLL_MS)
  if (typeof timer.unref === 'function') timer.unref()
  return () => clearInterval(timer)
}
