import { normalizeCwd } from './vendor-overlays/dsh-lan-assist/letter-home.js'

export function isPrimarySession(session) {
  return Boolean(session) && session.origin !== 'subagent' && !session.parentSessionId
}

export function resolvePrimarySessionId(sessionId, sessions) {
  const id = String(sessionId || '')
  if (!id) return ''
  const row = (Array.isArray(sessions) ? sessions : []).find((item) => item && item.sessionId === id)
  if (!row) return id
  if (isPrimarySession(row)) return id
  return String(row.parentSessionId || '')
}

export function listedSessions(listed) {
  if (Array.isArray(listed?.items)) return listed.items
  if (Array.isArray(listed?.sessions)) return listed.sessions
  if (Array.isArray(listed)) return listed
  return []
}

export function asPrimarySessionRow(row) {
  if (!row || typeof row !== 'object') return null
  const sessionId = String(row.sessionId || row.id || '')
  if (!sessionId) return null
  return {
    sessionId,
    cwd: String(row.cwd || row.workspace || ''),
    origin: row.origin,
    parentSessionId: row.parentSessionId,
    updatedAt: Number(row.updatedAt || 0),
  }
}

export function pickPrimarySessionId(sessions, input = {}) {
  const rows = (Array.isArray(sessions) ? sessions : []).map(asPrimarySessionRow).filter(Boolean)
  const hinted = String((input && (input.sessionId || input.id)) || '').trim()
  if (hinted) {
    const resolved = resolvePrimarySessionId(hinted, rows)
    if (resolved) return resolved
  }
  const cwd = normalizeCwd((input && (input.cwd || input.workspace)) || '')
  const primary = rows.filter(isPrimarySession)
  const pool = cwd ? primary.filter((row) => normalizeCwd(row.cwd) === cwd) : []
  const ranked = [...pool].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
  return ranked[0] ? ranked[0].sessionId : ''
}

export async function resolvePrimarySessionForRuntime(aiRuntime, input = {}) {
  if (!aiRuntime || typeof aiRuntime.status !== 'function' || !aiRuntime.status().connected) return ''
  if (typeof aiRuntime.call !== 'function') return ''
  let listed
  try {
    listed = await aiRuntime.call('session/list', { _request: { includeBlank: false } })
  } catch (error) {
    console.warn('session/list for primary failed', error)
    return ''
  }
  return pickPrimarySessionId(listedSessions(listed), input)
}
