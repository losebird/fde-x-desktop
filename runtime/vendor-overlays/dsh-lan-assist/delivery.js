/**
 * Per-peer delivery receipts. Letter status is derived from who is still out.
 * A dead door only blocks that person.
 * @module dsh-lan-assist/delivery
 */

export const RETRY_STEPS_MS = [30_000, 2 * 60_000, 10 * 60_000]
export const FAIL_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export function nextRetryWait(attempts, steps = RETRY_STEPS_MS) {
  const list = Array.isArray(steps) && steps.length ? steps : RETRY_STEPS_MS
  return list[Math.min(Math.max(0, attempts || 0), list.length - 1)]
}

export function peerMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return { ...value }
}

export function peerOut(req, peerId) {
  const id = String(peerId || '')
  if (!id || !req) return false
  return !!((req.delivered && req.delivered[id]) || (req.relayed && req.relayed[id]))
}

export function pendingPeers(req) {
  const withdrawn = new Set(Array.isArray(req && req.withdrawn) ? req.withdrawn.map(String) : [])
  return (Array.isArray(req && req.to) ? req.to : [])
    .map((id) => String(id || ''))
    .filter((id) => id && !withdrawn.has(id) && !peerOut(req, id))
}

export function stillPending(req) {
  return pendingPeers(req).length > 0
}

export function shouldAttemptPeer(req, peerId, now, steps = RETRY_STEPS_MS) {
  const id = String(peerId || '')
  if (!id || peerOut(req, id)) return false
  if ((Array.isArray(req && req.withdrawn) ? req.withdrawn : []).map(String).includes(id)) return false
  const last = Number(peerMap(req && req.lastAttempt)[id] || 0)
  if (!last) return true
  const attempts = Number(peerMap(req && req.attempts)[id] || 0)
  return now - last >= nextRetryWait(Math.max(0, attempts - 1), steps)
}

export function deriveLetterStatus(req, now, failAfterMs = FAIL_AFTER_MS) {
  if (!req) return ''
  if (req.status === 'presend' || req.status === 'closed' || req.status === 'withdrawn') return req.status
  const pending = pendingPeers(req)
  if (!pending.length) return 'sent'
  const created = Number(req.createdAt || 0)
  if (failAfterMs && created && now - created >= failAfterMs) return 'failed'
  if (pending.some((id) => Number(peerMap(req.lastAttempt)[id] || 0))) return 'retry'
  return 'queued'
}

export function applyPeerResult(row, peerId, sent, now, failAfterMs = FAIL_AFTER_MS) {
  const id = String(peerId || '')
  if (!row || !id) return row
  row.attempts = peerMap(row.attempts)
  row.lastAttempt = peerMap(row.lastAttempt)
  row.lastError = peerMap(row.lastError)
  row.attempts[id] = (Number(row.attempts[id] || 0) || 0) + 1
  row.lastAttempt[id] = now
  if (sent && sent.ok && sent.via === 'relay') {
    row.relayed = { ...(row.relayed || {}), [id]: now }
    row.via = { ...(row.via || {}), [id]: 'relay' }
    delete row.lastError[id]
  } else if (sent && sent.ok) {
    row.delivered = { ...(row.delivered || {}), [id]: now }
    row.via = { ...(row.via || {}), [id]: sent.via || 'lan' }
    delete row.lastError[id]
  } else {
    row.lastError[id] = (sent && sent.error) || 'UNREACHABLE'
  }
  row.status = deriveLetterStatus(row, now, failAfterMs)
  row.updatedAt = now
  return row
}

export function clearPendingWait(row) {
  if (!row) return row
  const last = peerMap(row.lastAttempt)
  for (const id of pendingPeers(row)) last[id] = 0
  row.lastAttempt = last
  return row
}
