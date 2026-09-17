import { createId } from '../db.mjs'
import { defaultSchedule, defaultSections, defaultSources } from './defaults.mjs'
import { workspaceIdForCwd } from './workspace.mjs'

const isoNow = () => new Date().toISOString()

function parseJson(raw, fallback) {
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function definitionIdForWorkspace(workspaceId) {
  return `bdef_${workspaceId}`
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspaceCwd
 */
export function getOrCreateDefinition(db, workspaceCwd) {
  const workspaceId = workspaceIdForCwd(db, workspaceCwd)
  const id = definitionIdForWorkspace(workspaceId)
  const existing = db.prepare('SELECT * FROM briefing_definitions WHERE id = ?').get(id)
  if (existing) {
    return mapDefinitionRow(existing, workspaceCwd)
  }
  const now = isoNow()
  db.prepare(`
    INSERT INTO briefing_definitions
      (id, workspace_id, name, status, sources_json, sections_json, filters_json, schedule_json, delivery_json, template_json, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?, '{}', ?, '{}', '{}', ?, ?)
  `).run(
    id,
    workspaceId,
    '默认早报',
    JSON.stringify(defaultSources()),
    JSON.stringify(defaultSections()),
    JSON.stringify(defaultSchedule()),
    now,
    now,
  )
  const row = db.prepare('SELECT * FROM briefing_definitions WHERE id = ?').get(id)
  return mapDefinitionRow(row, workspaceCwd)
}

function mapDefinitionRow(row, workspaceCwd) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceCwd,
    name: row.name,
    status: row.status,
    sections: parseJson(row.sections_json, []),
    schedule: parseJson(row.schedule_json, defaultSchedule()),
    sources: parseJson(row.sources_json, []),
    updatedAt: row.updated_at,
  }
}

export function saveDefinition(db, workspaceCwd, { sections, schedule, sources }) {
  const workspaceId = workspaceIdForCwd(db, workspaceCwd)
  const id = definitionIdForWorkspace(workspaceId)
  const now = isoNow()
  const existing = db.prepare('SELECT id FROM briefing_definitions WHERE id = ?').get(id)
  if (!existing) {
    getOrCreateDefinition(db, workspaceCwd)
  }
  db.prepare(`
    UPDATE briefing_definitions
    SET sections_json = ?, schedule_json = ?, sources_json = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(sections), JSON.stringify(schedule), JSON.stringify(sources ?? defaultSources()), now, id)
  return getOrCreateDefinition(db, workspaceCwd)
}

export function mapBriefingRow(row) {
  const content = parseJson(row.content_json, {})
  const status = content.status || (row.state === 'failed' ? 'failed' : row.state === 'generating' ? 'running' : row.state === 'ready' ? 'ready' : row.state)
  return {
    id: row.id,
    definitionId: row.definition_id,
    workspaceCwd: row.workspace_cwd || content.workspaceCwd || '',
    generatedAt: row.generated_at || row.created_at,
    status,
    sections: Array.isArray(content.sections) ? content.sections : [],
    summary: typeof content.summary === 'string' ? content.summary : '',
    sessionId: typeof content.sessionId === 'string' ? content.sessionId : '',
    agentRequestId: row.agent_request_id || content.agentRequestId || '',
    scheduleHint: content.scheduleHint || null,
  }
}

export function getBriefing(db, id) {
  const row = db.prepare('SELECT * FROM briefings WHERE id = ?').get(id)
  return row ? mapBriefingRow(row) : null
}

export function getLatestBriefing(db, workspaceCwd) {
  const row = db.prepare(`
    SELECT * FROM briefings
    WHERE workspace_cwd = ?
    ORDER BY COALESCE(generated_at, created_at) DESC
    LIMIT 1
  `).get(workspaceCwd)
  return row ? mapBriefingRow(row) : null
}

export function createBriefingRun(db, { definitionId, workspaceCwd, agentRequestId }) {
  const id = createId('brf')
  const now = isoNow()
  const content = {
    status: 'running',
    sections: [],
    workspaceCwd,
    agentRequestId,
  }
  db.prepare(`
    INSERT INTO briefings
      (id, definition_id, state, content_json, artifact_ref, generated_at, created_at, workspace_cwd, agent_request_id)
    VALUES (?, ?, 'generating', ?, NULL, ?, ?, ?, ?)
  `).run(id, definitionId, JSON.stringify(content), now, now, workspaceCwd, agentRequestId || null)
  return { id, agentRequestId }
}

export function updateBriefingContent(db, id, patch) {
  const row = db.prepare('SELECT content_json, state FROM briefings WHERE id = ?').get(id)
  if (!row) return null
  const content = parseJson(row.content_json, {})
  const next = { ...content, ...patch }
  const state = next.status === 'failed' ? 'failed'
    : next.status === 'running' ? 'generating'
      : 'ready'
  db.prepare(`
    UPDATE briefings
    SET content_json = ?, state = ?, generated_at = COALESCE(generated_at, ?)
    WHERE id = ?
  `).run(JSON.stringify(next), state, isoNow(), id)
  return getBriefing(db, id)
}

export function findBriefingByAgentRequest(db, requestId) {
  const row = db.prepare(`
    SELECT * FROM briefings WHERE agent_request_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(requestId)
  return row ? mapBriefingRow(row) : null
}

export function listScheduledDefinitions(db) {
  return db.prepare(`
    SELECT id, workspace_id, schedule_json, sections_json FROM briefing_definitions WHERE status = 'active'
  `).all()
}
