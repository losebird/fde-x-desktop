import { appendAudit, createId, enqueueEvent } from '../db.mjs'
import { applyMaterialize } from './materialize.mjs'
import { withProductLayout } from './layout.mjs'
import { detectBreakingSpecChange, quoteTable, tableNameForEntity, validateAppSpec } from './spec.mjs'

const APP_TABLE_RE = /^app_[a-z][a-z0-9-]{1,30}__[a-z][a-z0-9_]{0,30}$/

const isoNow = () => new Date().toISOString()

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspaceId
 * @param {string} slug
 * @param {string} [excludeAppId]
 */
export function isSlugTaken(db, workspaceId, slug, excludeAppId, { activeOnly = false } = {}) {
  const row = db.prepare(`
    SELECT id FROM business_apps
    WHERE workspace_id = ?
      AND json_extract(definition_json, '$.slug') = ?
      ${activeOnly ? "AND status = 'active'" : ''}
    LIMIT 1
  `).get(workspaceId, slug)
  if (!row) return false
  if (excludeAppId && row.id === excludeAppId) return false
  return true
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} appId
 */
export function getAppById(db, appId) {
  const row = db.prepare(`
    SELECT id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at
    FROM business_apps WHERE id = ?
  `).get(appId)
  if (!row) return null
  const revisions = db.prepare(`
    SELECT revision, change_note, created_at, materialize_status
    FROM business_app_revisions WHERE app_id = ? ORDER BY revision DESC
  `).all(appId)
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    appKind: row.app_kind,
    status: row.status,
    currentRevision: row.current_revision,
    spec: JSON.parse(row.definition_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revisions,
  }
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspaceId
 */
export function listApps(db, workspaceId) {
  return db.prepare(`
    SELECT id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at
    FROM business_apps
    WHERE workspace_id = ?
    ORDER BY updated_at DESC
  `).all(workspaceId).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    appKind: row.app_kind,
    status: row.status,
    currentRevision: row.current_revision,
    slug: safeSlug(JSON.parse(row.definition_json)),
    spec: JSON.parse(row.definition_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

function safeSlug(def) {
  return def && typeof def === 'object' && typeof def.slug === 'string' ? def.slug : null
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ workspaceId: string, workspaceCwd: string, spec: Record<string, unknown>, actorId?: string, correlationId?: string }} input
 */
export function createAppDraft(db, input) {
  const first = validateAppSpec(input.spec)
  if (!first.ok) {
    return { ok: false, errors: first.errors }
  }
  const laidOut = withProductLayout(first.spec)
  const validation = validateAppSpec(laidOut)
  if (!validation.ok) {
    return { ok: false, errors: validation.errors }
  }
  const spec = validation.spec
  const id = createId('app')
  const revisionId = createId('apprev')
  const now = isoNow()
  const correlationId = input.correlationId ?? createId('corr')
  spec._workspaceCwd = input.workspaceCwd

  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      INSERT INTO business_apps
        (id, workspace_id, name, app_kind, status, current_revision, definition_json, created_by, created_at, updated_at)
      VALUES (?, ?, ?, 'generated', 'draft', 1, ?, ?, ?, ?)
    `).run(id, input.workspaceId, spec.name, JSON.stringify(spec), input.actorId ?? 'actor_local_user', now, now)
    db.prepare(`
      INSERT INTO business_app_revisions
        (id, app_id, revision, definition_json, change_note, created_by, created_at, materialize_status)
      VALUES (?, ?, 1, ?, ?, ?, ?, 'pending')
    `).run(revisionId, id, JSON.stringify(spec), 'App spec 草稿', input.actorId ?? 'actor_local_user', now)
    appendAudit(db, {
      workspaceId: input.workspaceId,
      actorId: input.actorId ?? 'actor_local_user',
      action: 'app.spec.create',
      targetRef: `fde://workstation/app/${id}`,
      outcome: 'succeeded',
      correlationId,
      details: { slug: spec.slug },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { ok: true, data: { appId: id, revision: 1 } }
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} appId
 * @param {{ spec: Record<string, unknown>, changeNote?: string, actorId?: string, correlationId?: string }} input
 */
export function putAppSpec(db, appId, input) {
  const app = getAppById(db, appId)
  if (!app) return { kind: 'not_found' }
  const laidOut = withProductLayout(input.spec, { fillPages: false })
  const validation = validateAppSpec(laidOut, {
    slugTaken: isSlugTaken(db, app.workspaceId, String(laidOut.slug), appId, { activeOnly: true }),
  })
  if (!validation.ok) return { kind: 'validation', errors: validation.errors }
  const spec = validation.spec
  if (app.status === 'active') {
    const breaking = detectBreakingSpecChange(app.spec, spec)
    if (breaking.length) return { kind: 'breaking', errors: breaking }
  }
  if (app.spec?._workspaceCwd) spec._workspaceCwd = app.spec._workspaceCwd
  const nextRevision = app.currentRevision + 1
  const now = isoNow()
  const revisionId = createId('apprev')
  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      UPDATE business_apps SET name = ?, current_revision = ?, definition_json = ?, updated_at = ? WHERE id = ?
    `).run(spec.name, nextRevision, JSON.stringify(spec), now, appId)
    db.prepare(`
      INSERT INTO business_app_revisions
        (id, app_id, revision, definition_json, change_note, created_by, created_at, materialize_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      revisionId,
      appId,
      nextRevision,
      JSON.stringify(spec),
      input.changeNote ?? '保存 spec 修订',
      input.actorId ?? 'actor_local_user',
      now,
    )
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { kind: 'ok', data: { revision: nextRevision } }
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} appId
 * @param {{ emit?: Function, correlationId?: string, actorId?: string }} hooks
 */
export function activateApp(db, appId, hooks = {}) {
  const app = getAppById(db, appId)
  if (!app) return { kind: 'not_found' }
  const validation = validateAppSpec(app.spec, {
    slugTaken: isSlugTaken(db, app.workspaceId, String(app.spec.slug), appId, { activeOnly: true }),
  })
  if (!validation.ok) return { kind: 'validation', errors: validation.errors }

  const prevRev = db.prepare(`
    SELECT definition_json FROM business_app_revisions
    WHERE app_id = ? AND materialize_status = 'applied' ORDER BY revision DESC LIMIT 1
  `).get(appId)
  const previousSpec = prevRev ? JSON.parse(prevRev.definition_json) : null

  const now = isoNow()
  let applied = []
  try {
    const result = applyMaterialize(db, app.spec, previousSpec)
    applied = result.applied
  } catch (error) {
    if (error?.code === 'breaking_change') {
      return { kind: 'breaking', errors: error.details || [] }
    }
    db.prepare(`
      UPDATE business_app_revisions SET materialize_status = 'failed'
      WHERE app_id = ? AND revision = ?
    `).run(appId, app.currentRevision)
    throw error
  }

  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      UPDATE business_apps SET status = 'active', updated_at = ? WHERE id = ?
    `).run(now, appId)
    db.prepare(`
      UPDATE business_app_revisions
      SET ddl_applied_json = ?, materialize_status = 'applied'
      WHERE app_id = ? AND revision = ?
    `).run(JSON.stringify(applied), appId, app.currentRevision)
    enqueueEvent(db, {
      type: 'app.activated',
      sourceRef: `fde://workstation/app/${appId}`,
      subjectRef: `fde://workstation/app/${appId}`,
      correlationId: hooks.correlationId ?? createId('corr'),
      payload: { appId, slug: app.spec.slug, revision: app.currentRevision },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }

  if (hooks.emit) {
    hooks.emit('app.activated', { appId, slug: app.spec.slug }, {
      workspaceCwd: app.spec._workspaceCwd,
    })
  }
  return { kind: 'ok', data: { status: 'active', applied } }
}

export function archiveApp(db, appId) {
  const now = isoNow()
  const result = db.prepare(`
    UPDATE business_apps SET status = 'archived', updated_at = ? WHERE id = ?
  `).run(now, appId)
  return result.changes > 0
}

function dropAppEntityTables(db, spec) {
  const dropped = []
  const entities = Array.isArray(spec?.entities) ? spec.entities : []
  for (const ent of entities) {
    const table = tableNameForEntity(String(spec.slug || ''), String(ent?.name || ''))
    if (!APP_TABLE_RE.test(table)) continue
    db.exec(`DROP TABLE IF EXISTS ${quoteTable(table)}`)
    dropped.push(table)
  }
  return dropped
}

function deleteAppMetadata(db, appId) {
  db.prepare('DELETE FROM business_app_revisions WHERE app_id = ?').run(appId)
  db.prepare('DELETE FROM business_apps WHERE id = ?').run(appId)
}

export function discardDraftApp(db, appId, hooks = {}) {
  const app = getAppById(db, appId)
  if (!app) return { kind: 'not_found' }
  if (app.status !== 'draft') return { kind: 'not_draft' }
  const correlationId = hooks.correlationId ?? createId('corr')
  db.exec('BEGIN IMMEDIATE;')
  try {
    deleteAppMetadata(db, appId)
    appendAudit(db, {
      workspaceId: app.workspaceId,
      actorId: hooks.actorId ?? 'actor_local_user',
      action: 'app.spec.discard',
      targetRef: `fde://workstation/app/${appId}`,
      outcome: 'succeeded',
      correlationId,
      details: { name: app.name, status: 'draft' },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { kind: 'ok' }
}

export function purgeApp(db, appId, hooks = {}) {
  const app = getAppById(db, appId)
  if (!app) return { kind: 'not_found' }
  if (app.status === 'draft') return { kind: 'use_discard' }
  const correlationId = hooks.correlationId ?? createId('corr')
  db.exec('BEGIN IMMEDIATE;')
  try {
    const dropped = dropAppEntityTables(db, app.spec)
    deleteAppMetadata(db, appId)
    appendAudit(db, {
      workspaceId: app.workspaceId,
      actorId: hooks.actorId ?? 'actor_local_user',
      action: 'app.purge',
      targetRef: `fde://workstation/app/${appId}`,
      outcome: 'succeeded',
      correlationId,
      details: { name: app.name, dropped },
    })
    db.exec('COMMIT;')
    return { kind: 'ok', data: { dropped } }
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
}

export function rollbackApp(db, appId, revision) {
  const row = db.prepare(`
    SELECT definition_json FROM business_app_revisions WHERE app_id = ? AND revision = ?
  `).get(appId, revision)
  if (!row) return null
  const spec = JSON.parse(row.definition_json)
  const now = isoNow()
  db.prepare(`
    UPDATE business_apps SET current_revision = ?, definition_json = ?, updated_at = ? WHERE id = ?
  `).run(revision, row.definition_json, now, appId)
  return { revision, spec }
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspaceId
 * @param {string} slug
 * @param {string} [workspaceCwd]
 */
export function findActiveAppBySlug(db, workspaceId, slug, workspaceCwd) {
  const cwd = String(workspaceCwd || '').trim()
  const rows = db.prepare(`
    SELECT id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at
    FROM business_apps
    WHERE status = 'active'
  `).all().map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    appKind: row.app_kind,
    status: row.status,
    currentRevision: row.current_revision,
    slug: safeSlug(JSON.parse(row.definition_json)),
    spec: JSON.parse(row.definition_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })).filter((row) => row.slug === slug)
  if (cwd) {
    const byCwd = rows.find((row) => row.spec && row.spec._workspaceCwd === cwd)
    if (byCwd) return byCwd
  }
  return rows.find((row) => row.workspaceId === workspaceId) || null
}
