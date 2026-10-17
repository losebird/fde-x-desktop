import { emitSessionCreated } from '../events.mjs'
import { listedSessions } from '../session-primary.mjs'

const BRIEFING_PRESET = 'fde-briefing'

function rowPreset(row) {
  const values = row?.projections?.values
  if (values && typeof values.agentPreset === 'string') return values.agentPreset
  if (typeof row?.agentPreset === 'string') return row.agentPreset
  return ''
}

function rowCwd(row) {
  if (typeof row?.cwd === 'string' && row.cwd) return row.cwd
  const values = row?.projections?.values
  if (values && typeof values.cwd === 'string') return values.cwd
  return ''
}

export async function resolveBriefingSession(aiRuntime, cwd, emit) {
  const workspaceCwd = String(cwd || '')
  if (!workspaceCwd) {
    const error = new Error('早报会话缺少工作区')
    error.code = 'briefing_workspace_missing'
    throw error
  }
  const listed = await aiRuntime.call('session/list', { _request: { includeBlank: true } })
  const existing = listedSessions(listed).find((row) => {
    if (rowPreset(row) !== BRIEFING_PRESET) return false
    return rowCwd(row) === workspaceCwd
  })
  const existingId = existing ? String(existing.sessionId || existing.id || '') : ''
  if (existingId) return existingId
  const created = await aiRuntime.call('session/create', {
    request: { cwd: workspaceCwd, agentPreset: BRIEFING_PRESET },
  })
  const sessionId = String(created?.sessionId || '')
  if (!sessionId) {
    const error = new Error('早报会话没有建成')
    error.code = 'briefing_session_missing'
    throw error
  }
  emitSessionCreated(emit, { sessionId, workspaceCwd })
  return sessionId
}
