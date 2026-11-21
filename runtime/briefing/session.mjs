import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { sameWorkspaceCwd } from '../cwd.mjs'
import { discardBriefingAllow, stageBriefingAllow } from '../fde-x-dsh-bridge/lib/briefing-allow.js'
import { invalidateHostSessionList, listedSessions, sessionIsRunning } from '../session-primary.mjs'
import { briefingAllowServerNames, briefingConnectedServerNames } from './defaults.mjs'

export const BRIEFING_PRESET = 'fde-briefing'

export function briefingSessionPreset(row) {
  const values = row?.projections?.values
  if (values && typeof values.agentPreset === 'string') return values.agentPreset
  if (typeof row?.agentPreset === 'string') return row.agentPreset
  return ''
}

export function isBriefingMachinerySession(row) {
  return briefingSessionPreset(row) === BRIEFING_PRESET
}

function rowCwd(row) {
  if (typeof row?.cwd === 'string' && row.cwd) return row.cwd
  const values = row?.projections?.values
  if (values && typeof values.cwd === 'string') return values.cwd
  return ''
}

function briefingSessionMeta(row) {
  const values = row?.projections?.values
  return values && typeof values === 'object' ? values : {}
}

export function briefingDirty(row) {
  const values = briefingSessionMeta(row)
  if (values.title && String(values.title).trim()) return true
  const meta = values.sessionListMetadata && typeof values.sessionListMetadata === 'object'
    ? values.sessionListMetadata
    : null
  if (meta) {
    if (meta.lastPromptAt) return true
    if (meta.blank === false) return true
    if (meta.blank === true) return false
  }
  return true
}

function purgeBriefingSessionFiles(home, sessionId) {
  const root = String(home || '').trim()
  const id = String(sessionId || '').trim()
  if (!root || !id) return
  try {
    rmSync(join(root, 'storages', 'session_projcache', 'sessions', `${id}.json`), { force: true })
  } catch { /* ignore */ }
  const sessionsRoot = join(root, 'sessions')
  if (!existsSync(sessionsRoot)) return
  const walk = (dir, depth) => {
    if (depth > 5) return
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory() && entry.name === id) {
        try { rmSync(full, { recursive: true, force: true }) } catch { /* ignore */ }
        continue
      }
      if (entry.isDirectory()) walk(full, depth + 1)
    }
  }
  walk(sessionsRoot, 0)
}

export async function disposeBriefingSession(aiRuntime, sessionId) {
  const id = String(sessionId || '').trim()
  if (!id) return
  let gone = false
  if (aiRuntime && typeof aiRuntime.call === 'function') {
    const attempts = [
      ['workspace/archiveSession', { request: { sessionId: id, stopActivity: true } }],
      ['session/delete', { request: { sessionId: id } }],
      ['workspace/removeSession', { request: { sessionId: id } }],
      ['workspace/deleteSession', { request: { sessionId: id } }],
    ]
    for (const [endpoint, args] of attempts) {
      try {
        await aiRuntime.call(endpoint, args)
        gone = true
        break
      } catch { /* try next */ }
    }
  }
  discardBriefingSessionAllow(aiRuntime, id)
  if (gone) purgeBriefingSessionFiles(aiRuntime && aiRuntime.dshHome, id)
}

export function stageBriefingSessionAllow(aiRuntime, sessionId, sections, extraNames = []) {
  try {
    stageBriefingAllow(
      String(sessionId || ''),
      [...briefingAllowServerNames(sections), ...briefingConnectedServerNames(extraNames)],
      aiRuntime && aiRuntime.dshHome,
    )
  } catch (error) {
    console.warn('briefing_allow_stage_failed', error instanceof Error ? error.message : error)
  }
}

export function discardBriefingSessionAllow(aiRuntime, sessionId) {
  discardBriefingAllow(String(sessionId || ''), aiRuntime && aiRuntime.dshHome)
}

export async function resolveBriefingSession(aiRuntime, cwd, sections, emit) {
  if (typeof sections === 'function' && emit == null) {
    emit = sections
    sections = undefined
  }
  const workspaceCwd = String(cwd || '')
  if (!workspaceCwd) {
    const error = new Error('早报会话缺少工作区')
    error.code = 'briefing_workspace_missing'
    throw error
  }
  let listed = []
  try {
    listed = listedSessions(await aiRuntime.call('session/list', { _request: { includeBlank: true } }))
  } catch {
    listed = []
  }
  const mine = listed.filter((row) => (
    isBriefingMachinerySession(row)
    && sameWorkspaceCwd(rowCwd(row), workspaceCwd)
    && !row.archived
  ))
  const leftoverIds = new Set(
    mine.map((row) => String(row.sessionId || row.id || '').trim()).filter(Boolean),
  )
  for (const id of leftoverIds) await disposeBriefingSession(aiRuntime, id)

  async function createClerk() {
    const created = await aiRuntime.call('session/create', {
      request: { cwd: workspaceCwd, agentPreset: BRIEFING_PRESET },
    })
    return String(created?.sessionId || '')
  }

  let sessionId = await createClerk()
  if (sessionId && leftoverIds.has(sessionId)) {
    await disposeBriefingSession(aiRuntime, sessionId)
    sessionId = await createClerk()
  }
  if (!sessionId) {
    const error = new Error('早报会话没有建成')
    error.code = 'briefing_session_missing'
    throw error
  }
  if (Array.isArray(sections)) stageBriefingSessionAllow(aiRuntime, sessionId, sections)
  invalidateHostSessionList()
  return sessionId
}
