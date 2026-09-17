import { DatabaseSync } from 'node:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const isoNow = () => new Date().toISOString()

export function createId(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`
}

export function openDatabase(databasePath, migrationsDirectory) {
  mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA synchronous = NORMAL;')
  db.exec('PRAGMA busy_timeout = 5000;')
  db.exec('PRAGMA temp_store = MEMORY;')
  db.exec('PRAGMA wal_autocheckpoint = 1000;')
  applyMigrations(db, migrationsDirectory)
  seedRuntime(db)
  return db
}

function applyMigrations(db, migrationsDirectory) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT;
  `)

  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort()

  const applied = db.prepare('SELECT version FROM schema_migrations').all()
  const appliedVersions = new Set(applied.map((row) => Number(row.version)))
  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
  )

  for (const fileName of migrationFiles) {
    const version = Number(fileName.split('_', 1)[0])
    if (appliedVersions.has(version)) continue

    const sql = readFileSync(join(migrationsDirectory, fileName), 'utf8')
    db.exec('BEGIN IMMEDIATE;')
    try {
      db.exec(sql)
      insertMigration.run(version, fileName, isoNow())
      db.exec('COMMIT;')
    } catch (error) {
      db.exec('ROLLBACK;')
      throw new Error(`Migration ${fileName} failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

function seedRuntime(db) {
  const now = isoNow()
  const insertActor = db.prepare(`
    INSERT OR IGNORE INTO actors
      (id, actor_type, display_name, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, 'active', '{}', ?, ?)
  `)
  const insertWorkspace = db.prepare(`
    INSERT OR IGNORE INTO workspaces
      (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, 'active', '{}', ?, ?)
  `)
  const insertBusinessConnection = db.prepare(`
    INSERT OR IGNORE INTO business_connections
      (id, workspace_id, name, provider, connection_kind, status, config_json, capabilities_json, last_health_json, created_at, updated_at)
    VALUES (?, 'ws_personal', ?, ?, ?, 'pending', '{}', ?, ?, ?, ?)
  `)
  const insertBusinessApp = db.prepare(`
    INSERT OR IGNORE INTO business_apps
      (id, workspace_id, name, app_kind, status, current_revision, definition_json, created_by, created_at, updated_at)
    VALUES (?, 'ws_personal', ?, 'system', 'active', 1, ?, 'actor_system', ?, ?)
  `)

  db.exec('BEGIN IMMEDIATE;')
  try {
    insertActor.run('actor_system', 'system', 'FDE-X Runtime', now, now)
    insertActor.run('actor_local_user', 'user', '本机用户', now, now)
    insertWorkspace.run('ws_personal', '个人工作区', '事务型工作台默认工作区', now, now)
    insertBusinessConnection.run(
      'conn_lan_assist',
      '局域网业务协作适配器',
      'lan-assist',
      'local-plugin',
      JSON.stringify(['data.read', 'data.write', 'message.send', 'operation.trace']),
      JSON.stringify({ state: 'detected', note: '已发现源码入口，真实调用适配尚未启用' }),
      now,
      now,
    )
    insertBusinessApp.run(
      'app_business_records',
      '业务记录浏览器',
      JSON.stringify({ kind: 'data-browser', source: 'prototype', capabilities: ['browse', 'filter', 'plan-write'] }),
      now,
      now,
    )
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
}

export function appendAudit(db, entry) {
  const id = entry.id ?? createId('audit')
  db.prepare(`
    INSERT INTO audit_entries
      (id, workspace_id, actor_id, action, target_ref, outcome, risk_level, correlation_id, details_json, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.workspaceId ?? null,
    entry.actorId ?? null,
    entry.action,
    entry.targetRef ?? null,
    entry.outcome,
    entry.riskLevel ?? 'low',
    entry.correlationId ?? '',
    JSON.stringify(entry.details ?? {}),
    entry.occurredAt ?? isoNow(),
  )
  return id
}

export function enqueueEvent(db, event) {
  const id = event.id ?? createId('evt')
  const occurredAt = event.occurredAt ?? isoNow()
  db.prepare(`
    INSERT INTO outbox_events
      (id, event_type, schema_version, source_ref, subject_ref, correlation_id, causation_id, payload_json, occurred_at, available_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    event.type,
    event.schemaVersion ?? 1,
    event.sourceRef,
    event.subjectRef ?? null,
    event.correlationId,
    event.causationId ?? null,
    JSON.stringify(event.payload ?? {}),
    occurredAt,
    event.availableAt ?? occurredAt,
  )
  return id
}

export function createWorkspace(db, input) {
  const id = input.id ?? createId('ws')
  const now = isoNow()
  const correlationId = input.correlationId ?? createId('corr')

  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      INSERT INTO workspaces
        (id, name, description, status, metadata_json, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?, ?)
    `).run(id, input.name, input.description ?? '', JSON.stringify(input.metadata ?? {}), now, now)

    appendAudit(db, {
      workspaceId: id,
      actorId: input.actorId ?? 'actor_local_user',
      action: 'workspace.create',
      targetRef: `fde://workstation/workspace/${id}`,
      outcome: 'succeeded',
      correlationId,
      details: { name: input.name },
    })
    enqueueEvent(db, {
      type: 'workspace.created',
      sourceRef: `fde://workstation/workspace/${id}`,
      subjectRef: `fde://workstation/workspace/${id}`,
      correlationId,
      payload: { id, name: input.name },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }

  return getWorkspace(db, id)
}

export function ensureWorkspace(db, input) {
  const existing = getWorkspace(db, input.id)
  if (existing) return existing
  return createWorkspace(db, input)
}

export function getWorkspace(db, id) {
  const row = db.prepare(`
    SELECT id, name, description, status, metadata_json, created_at, updated_at
    FROM workspaces WHERE id = ?
  `).get(id)
  return row ? mapWorkspace(row) : null
}

export function listWorkspaces(db) {
  return db.prepare(`
    SELECT id, name, description, status, metadata_json, created_at, updated_at
    FROM workspaces ORDER BY created_at ASC
  `).all().map(mapWorkspace)
}

function mapWorkspace(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    metadata: JSON.parse(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listPendingEvents(db, limit = 50) {
  return db.prepare(`
    SELECT id, event_type, schema_version, source_ref, subject_ref, correlation_id,
           causation_id, payload_json, occurred_at, available_at, attempt_count, last_error
    FROM outbox_events
    WHERE published_at IS NULL AND available_at <= ?
    ORDER BY occurred_at ASC
    LIMIT ?
  `).all(isoNow(), limit).map((row) => ({
    id: row.id,
    type: row.event_type,
    schemaVersion: row.schema_version,
    sourceRef: row.source_ref,
    subjectRef: row.subject_ref,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    payload: JSON.parse(row.payload_json),
    occurredAt: row.occurred_at,
    availableAt: row.available_at,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
  }))
}

/** Seed/runtime rows for lan-assist stay on ws_personal; every active workspace should see them in list. */
const SHARED_BUSINESS_CONNECTION_PROVIDERS = ['lan-assist']

export function listBusinessConnections(db, { workspaceId = 'ws_personal' } = {}) {
  const rows = workspaceId === 'ws_personal'
    ? db.prepare(`
        SELECT id, workspace_id, name, provider, connection_kind, status, config_json,
               credential_ref, capabilities_json, last_health_json, created_at, updated_at
        FROM business_connections
        WHERE workspace_id = ?
        ORDER BY name ASC
      `).all(workspaceId)
    : db.prepare(`
        SELECT id, workspace_id, name, provider, connection_kind, status, config_json,
               credential_ref, capabilities_json, last_health_json, created_at, updated_at
        FROM business_connections
        WHERE workspace_id = ?
           OR (workspace_id = 'ws_personal' AND provider IN (${SHARED_BUSINESS_CONNECTION_PROVIDERS.map(() => '?').join(', ')}))
        ORDER BY name ASC
      `).all(workspaceId, ...SHARED_BUSINESS_CONNECTION_PROVIDERS)

  const byId = new Map()
  for (const row of rows) {
    const prev = byId.get(row.id)
    if (!prev || row.workspace_id === workspaceId) byId.set(row.id, row)
  }
  return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    provider: row.provider,
    connectionKind: row.connection_kind,
    status: row.status,
    config: JSON.parse(row.config_json),
    credentialRef: row.credential_ref,
    capabilities: JSON.parse(row.capabilities_json),
    lastHealth: row.last_health_json ? JSON.parse(row.last_health_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export function listBusinessApps(db, { workspaceId = 'ws_personal' } = {}) {
  return db.prepare(`
    SELECT id, workspace_id, name, app_kind, status, current_revision, definition_json,
           created_by, created_at, updated_at
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
    definition: JSON.parse(row.definition_json),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export function createBusinessApp(db, input) {
  const id = input.id ?? createId('app')
  const revisionId = createId('apprev')
  const now = isoNow()
  const correlationId = input.correlationId ?? createId('corr')
  const definition = input.definition ?? {}

  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      INSERT INTO business_apps
        (id, workspace_id, name, app_kind, status, current_revision, definition_json, created_by, created_at, updated_at)
      VALUES (?, ?, ?, 'generated', 'draft', 1, ?, ?, ?, ?)
    `).run(id, input.workspaceId ?? 'ws_personal', input.name, JSON.stringify(definition), input.actorId ?? 'actor_local_user', now, now)
    db.prepare(`
      INSERT INTO business_app_revisions
        (id, app_id, revision, definition_json, change_note, created_by, created_at)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `).run(revisionId, id, JSON.stringify(definition), input.changeNote ?? 'AI 创建应用草稿', input.actorId ?? 'actor_local_user', now)
    appendAudit(db, {
      workspaceId: input.workspaceId ?? 'ws_personal',
      actorId: input.actorId ?? 'actor_local_user',
      action: 'business_app.create',
      targetRef: `fde://workstation/business-app/${id}`,
      outcome: 'succeeded',
      correlationId,
      details: { name: input.name, revision: 1, status: 'draft' },
    })
    enqueueEvent(db, {
      type: 'business_app.created',
      sourceRef: `fde://workstation/business-app/${id}`,
      subjectRef: `fde://workstation/business-app/${id}`,
      correlationId,
      payload: { appId: id, name: input.name, revision: 1, status: 'draft' },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }

  return listBusinessApps(db, { workspaceId: input.workspaceId ?? 'ws_personal' }).find((app) => app.id === id)
}

export function updateBusinessApp(db, id, input) {
  const existing = db.prepare(`
    SELECT id, workspace_id, name, current_revision, definition_json
    FROM business_apps WHERE id = ?
  `).get(id)
  if (!existing) return null
  const definition = input.definition && typeof input.definition === 'object' ? input.definition : JSON.parse(existing.definition_json)
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : existing.name
  const nextRevision = Number(existing.current_revision || 1) + 1
  const now = isoNow()
  const correlationId = input.correlationId ?? createId('corr')
  const revisionId = createId('apprev')
  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      UPDATE business_apps
      SET name = ?, current_revision = ?, definition_json = ?, updated_at = ?
      WHERE id = ?
    `).run(name, nextRevision, JSON.stringify(definition), now, id)
    db.prepare(`
      INSERT INTO business_app_revisions
        (id, app_id, revision, definition_json, change_note, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(revisionId, id, nextRevision, JSON.stringify(definition), input.changeNote ?? '更新应用草稿', input.actorId ?? 'actor_local_user', now)
    appendAudit(db, {
      workspaceId: existing.workspace_id,
      actorId: input.actorId ?? 'actor_local_user',
      action: 'business_app.update',
      targetRef: `fde://workstation/business-app/${id}`,
      outcome: 'succeeded',
      correlationId,
      details: { name, revision: nextRevision },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return listBusinessApps(db, { workspaceId: existing.workspace_id }).find((app) => app.id === id)
}

export function getOperationTrace(db, id) {
  const operation = getOperation(db, id)
  if (!operation) return null
  const steps = db.prepare(`
    SELECT id, sequence_no, step_kind, state, tool_ref, input_json, output_json, error_json, started_at, finished_at
    FROM operation_steps WHERE operation_id = ? ORDER BY sequence_no ASC
  `).all(id).map((row) => ({
    id: row.id,
    sequence: row.sequence_no,
    kind: row.step_kind,
    state: row.state,
    toolRef: row.tool_ref,
    input: JSON.parse(row.input_json),
    output: row.output_json ? JSON.parse(row.output_json) : null,
    error: row.error_json ? JSON.parse(row.error_json) : null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }))
  const approvals = db.prepare(`
    SELECT id, requested_from, decision, decision_note, policy_json, requested_at, decided_at
    FROM approvals WHERE operation_id = ? ORDER BY requested_at ASC
  `).all(id).map((row) => ({
    id: row.id,
    requestedFrom: row.requested_from,
    decision: row.decision,
    note: row.decision_note,
    policy: JSON.parse(row.policy_json),
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
  }))
  const snapshots = db.prepare(`
    SELECT id, snapshot_kind, source_authority, object_ref, version_token, data_json, captured_at
    FROM operation_snapshots WHERE operation_id = ? ORDER BY captured_at ASC
  `).all(id).map((row) => ({
    id: row.id,
    kind: row.snapshot_kind,
    sourceAuthority: row.source_authority,
    objectRef: row.object_ref,
    versionToken: row.version_token,
    data: JSON.parse(row.data_json),
    capturedAt: row.captured_at,
  }))
  const receipts = db.prepare(`
    SELECT id, receipt_kind, external_request_id, external_receipt_ref, result_json, received_at
    FROM operation_receipts WHERE operation_id = ? ORDER BY received_at ASC
  `).all(id).map((row) => ({
    id: row.id,
    kind: row.receipt_kind,
    externalRequestId: row.external_request_id,
    externalReceiptRef: row.external_receipt_ref,
    result: JSON.parse(row.result_json),
    receivedAt: row.received_at,
  }))
  const compensations = db.prepare(`
    SELECT id, strategy, state, reason, plan_json, result_json, approved_by, created_at, started_at, finished_at
    FROM compensations WHERE operation_id = ? ORDER BY created_at ASC
  `).all(id).map((row) => ({
    id: row.id,
    strategy: row.strategy,
    state: row.state,
    reason: row.reason,
    plan: JSON.parse(row.plan_json),
    result: row.result_json ? JSON.parse(row.result_json) : null,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }))

  return { operation, steps, approvals, snapshots, receipts, compensations }
}

export function listOperations(db, { workspaceId, limit = 100 } = {}) {
  const rows = workspaceId
    ? db.prepare(`
        SELECT id, workspace_id, connection_id, app_id, requested_by, target_ref, action,
               operation_kind, risk_level, execution_mode, state, idempotency_key, expected_version,
               input_json, plan_json, correlation_id, causation_id, created_at, updated_at, started_at, finished_at
        FROM operations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?
      `).all(workspaceId, limit)
    : db.prepare(`
        SELECT id, workspace_id, connection_id, app_id, requested_by, target_ref, action,
               operation_kind, risk_level, execution_mode, state, idempotency_key, expected_version,
               input_json, plan_json, correlation_id, causation_id, created_at, updated_at, started_at, finished_at
        FROM operations ORDER BY created_at DESC LIMIT ?
      `).all(limit)

  return rows.map(mapOperation)
}

export function getOperation(db, id) {
  const row = db.prepare(`
    SELECT id, workspace_id, connection_id, app_id, requested_by, target_ref, action,
           operation_kind, risk_level, execution_mode, state, idempotency_key, expected_version,
           input_json, plan_json, correlation_id, causation_id, created_at, updated_at, started_at, finished_at
    FROM operations WHERE id = ?
  `).get(id)
  return row ? mapOperation(row) : null
}

function mapOperation(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    connectionId: row.connection_id,
    appId: row.app_id,
    requestedBy: row.requested_by,
    targetRef: row.target_ref,
    action: row.action,
    operationKind: row.operation_kind,
    riskLevel: row.risk_level,
    executionMode: row.execution_mode,
    state: row.state,
    idempotencyKey: row.idempotency_key,
    expectedVersion: row.expected_version,
    input: JSON.parse(row.input_json),
    plan: JSON.parse(row.plan_json),
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

export function approveOperation(db, id, { actorId = 'actor_local_user', note = '', correlationId }) {
  const operation = getOperation(db, id)
  if (!operation) return { kind: 'not_found' }
  if (operation.state !== 'awaiting_approval') return { kind: 'invalid_state', operation }
  const now = isoNow()

  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      UPDATE approvals
      SET decision = 'approved', decision_note = ?, decided_at = ?
      WHERE operation_id = ? AND decision = 'pending'
    `).run(note, now, id)
    db.prepare(`UPDATE operations SET state = 'approved', updated_at = ? WHERE id = ?`).run(now, id)
    insertOperationStep(db, id, 1, 'approve', 'succeeded', { note })
    appendAudit(db, {
      workspaceId: operation.workspaceId,
      actorId,
      action: 'operation.approve',
      targetRef: `fde://workstation/operation/${id}`,
      outcome: 'accepted',
      riskLevel: operation.riskLevel,
      correlationId,
      details: { note },
    })
    enqueueEvent(db, {
      type: 'operation.approved',
      sourceRef: `fde://workstation/operation/${id}`,
      subjectRef: operation.targetRef,
      correlationId,
      payload: { operationId: id, approvedBy: actorId },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { kind: 'ok', operation: getOperation(db, id) }
}

export function executeDryRun(db, id, { actorId = 'actor_local_user', correlationId }) {
  const operation = getOperation(db, id)
  if (!operation) return { kind: 'not_found' }
  if (operation.executionMode !== 'dry_run') return { kind: 'live_not_supported', operation }
  if (!['draft', 'approved'].includes(operation.state)) return { kind: 'invalid_state', operation }
  const now = isoNow()
  const result = {
    validated: true,
    sideEffects: false,
    targetRef: operation.targetRef,
    action: operation.action,
    note: '仅验证操作计划，未调用外部业务系统。',
  }

  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      UPDATE operations SET state = 'uncertain', started_at = ?, finished_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, now, id)
    db.prepare(`
      INSERT INTO operation_receipts
        (id, operation_id, receipt_kind, result_json, received_at)
      VALUES (?, ?, 'verified', ?, ?)
    `).run(createId('receipt'), id, JSON.stringify(result), now)
    appendAudit(db, {
      workspaceId: operation.workspaceId,
      actorId,
      action: 'operation.dry_run',
      targetRef: `fde://workstation/operation/${id}`,
      outcome: 'succeeded',
      riskLevel: operation.riskLevel,
      correlationId,
      details: result,
    })
    enqueueEvent(db, {
      type: 'operation.dry_run_succeeded',
      sourceRef: `fde://workstation/operation/${id}`,
      subjectRef: operation.targetRef,
      correlationId,
      payload: { operationId: id, sideEffects: false },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { kind: 'ok', operation: getOperation(db, id), receipt: result }
}

export function insertOperationStep(db, operationId, sequenceNo, stepKind, state, input = {}, output = null, error = null) {
  const now = isoNow()
  db.prepare(`
    INSERT INTO operation_steps
      (id, operation_id, sequence_no, step_kind, state, tool_ref, input_json, output_json, error_json, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, 'biz/gate', ?, ?, ?, ?, ?)
  `).run(
    createId('opstep'),
    operationId,
    sequenceNo,
    stepKind,
    state,
    JSON.stringify(input),
    output ? JSON.stringify(output) : null,
    error ? JSON.stringify(error) : null,
    now,
    state === 'succeeded' || state === 'failed' ? now : null,
  )
}

export function insertBizSurface(db, row) {
  const id = createId('bsurf')
  db.prepare(`
    INSERT INTO biz_surfaces
      (id, workspace_cwd, connection_id, kind, action, preview_id, session_id, row_count, columns_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    row.workspaceCwd,
    row.connectionId ?? null,
    row.kind,
    row.action,
    row.previewId ?? null,
    row.sessionId ?? null,
    row.rowCount ?? null,
    row.columnsJson ?? null,
    row.createdAt ?? Date.now(),
  )
  return id
}

export function listBizSurfaces(db, workspaceCwd, limit = 20) {
  const rows = db.prepare(`
    SELECT id, workspace_cwd, connection_id, kind, action, preview_id, session_id, row_count, columns_json, created_at
    FROM biz_surfaces
    WHERE workspace_cwd = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(workspaceCwd, Math.max(1, Math.min(100, limit)))
  return rows.map((row) => ({
    id: row.id,
    workspaceCwd: row.workspace_cwd,
    connectionId: row.connection_id,
    kind: row.kind,
    action: row.action,
    previewId: row.preview_id,
    sessionId: row.session_id,
    rowCount: row.row_count,
    columns: row.columns_json ? JSON.parse(row.columns_json) : [],
    createdAt: row.created_at,
  }))
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} id
 * @param {{ actorId?: string, correlationId?: string, writePreview: (previewId: string) => Promise<Record<string, unknown>> }} deps
 */
export async function executeOperationLive(db, id, { actorId = 'actor_local_user', correlationId, writePreview }) {
  const operation = getOperation(db, id)
  if (!operation) return { kind: 'not_found' }
  if (operation.executionMode !== 'live') return { kind: 'live_not_supported', operation }
  if (operation.state !== 'approved') return { kind: 'invalid_state', operation }

  const plan = operation.plan && typeof operation.plan === 'object' ? operation.plan : {}
  const previewId = typeof plan.previewId === 'string' ? plan.previewId : ''
  if (!previewId) return { kind: 'preview_expired', operation }

  const now = isoNow()
  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`UPDATE operations SET state = 'executing', started_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id)
    insertOperationStep(db, id, 2, 'write', 'running', { previewId })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }

  let written
  try {
    written = await writePreview(previewId)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    const expired = code === 'preview_expired' || /expir|过期/i.test(message)
    db.exec('BEGIN IMMEDIATE;')
    try {
      db.prepare(`
        UPDATE operation_steps SET state = 'failed', error_json = ?, finished_at = ?
        WHERE operation_id = ? AND sequence_no = 2 AND step_kind = 'write'
      `).run(JSON.stringify({ message }), now, id)
      db.prepare(`UPDATE operations SET state = 'failed', finished_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id)
      db.exec('COMMIT;')
    } catch (inner) {
      db.exec('ROLLBACK;')
      throw inner
    }
    if (expired) return { kind: 'preview_expired', operation: getOperation(db, id), message }
    return { kind: 'write_failed', operation: getOperation(db, id), message }
  }

  const receipt = {
    receiptId: String(written?.receipt_id || written?.receiptId || ''),
    traceId: String(written?.trace_id || written?.traceId || ''),
    kind: String(written?.kind || ''),
    action: String(written?.action || ''),
  }

  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      UPDATE operation_steps SET state = 'succeeded', output_json = ?, finished_at = ?
      WHERE operation_id = ? AND sequence_no = 2 AND step_kind = 'write'
    `).run(JSON.stringify(written), now, id)
    insertOperationStep(db, id, 3, 'receipt', 'succeeded', {}, receipt)
    db.prepare(`UPDATE operations SET state = 'succeeded', finished_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id)
    db.prepare(`
      INSERT INTO operation_receipts (id, operation_id, receipt_kind, result_json, received_at)
      VALUES (?, ?, 'executed', ?, ?)
    `).run(createId('receipt'), id, JSON.stringify(receipt), now)
    appendAudit(db, {
      workspaceId: operation.workspaceId,
      actorId,
      action: 'operation.execute_live',
      targetRef: `fde://workstation/operation/${id}`,
      outcome: 'succeeded',
      riskLevel: operation.riskLevel,
      correlationId,
      details: receipt,
    })
    enqueueEvent(db, {
      type: 'operation.executed',
      sourceRef: `fde://workstation/operation/${id}`,
      subjectRef: operation.targetRef,
      correlationId,
      payload: { operationId: id, receipt },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { kind: 'ok', operation: getOperation(db, id), receipt }
}

export function databaseHealth(db, databasePath) {
  const quickCheck = db.prepare('PRAGMA quick_check').get()
  const migrations = db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all()
  const tableCount = db.prepare(`SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).get()
  const fingerprint = createHash('sha256').update(databasePath).digest('hex').slice(0, 12)

  return {
    state: quickCheck.quick_check === 'ok' ? 'healthy' : 'degraded',
    database: { fingerprint, tableCount: Number(tableCount.count) },
    migrations,
  }
}

const DDL_ALLOWED = [
  /^CREATE TABLE IF NOT EXISTS (?:"app_[^"]+"|app_[a-z0-9-]+__[a-z][a-z0-9_]*)\s/i,
  /^ALTER TABLE (?:"app_[^"]+"|app_[a-z0-9-]+__[a-z][a-z0-9_]*)\s+ADD COLUMN\s/i,
  /^CREATE UNIQUE INDEX\s+(?:"[^"]+"|[^\s]+)\s+ON\s+(?:"app_[^"]+"|app_[a-z0-9-]+__[a-z][a-z0-9_]*)\s/i,
]

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} sql
 * @param {{ allowPrefix?: string }} [_opts]
 */
export function execControlledDdl(db, sql, _opts = {}) {
  const trimmed = sql.trim()
  if (!DDL_ALLOWED.some((re) => re.test(trimmed))) {
    throw Object.assign(new Error('ddl_not_allowed'), { code: 'ddl_not_allowed' })
  }
  if (/;.*\S/.test(trimmed.replace(/;+\s*$/, ''))) {
    throw Object.assign(new Error('ddl_multi_statement'), { code: 'ddl_not_allowed' })
  }
  db.exec(trimmed)
}
