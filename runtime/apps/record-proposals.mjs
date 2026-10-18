import { appendAudit, createId, getOperation } from '../db.mjs'
import { appIsTrashed, getAppById } from './repository.mjs'
import { getRecord, patchRecord } from './records.mjs'

const RECORD_PROPOSAL_ACTION = 'app.record.propose'

const RESERVED_KEYS = new Set(['id', 'rid', 'workspace', 'workspaceCwd'])

function expectedVersion(patches) {
  if (patches.length === 1) return String(patches[0].base.updated_at)
  return JSON.stringify(Object.fromEntries(patches.map((patch) => [patch.rid, patch.base.updated_at])))
}

function rowMoved(row, patch) {
  const base = patch.base
  if (!base || typeof base !== 'object' || Array.isArray(base)) return true
  return row.updated_at !== base.updated_at
}

function recordPatches(spec, entity, rows) {
  const entities = Array.isArray(spec?.entities) ? spec.entities : []
  const ent = entities.find((item) => item && item.name === entity)
  if (!ent || !Array.isArray(ent.fields)) return null
  if (!Array.isArray(rows) || rows.length === 0) return null
  const allowed = new Set(ent.fields.map((field) => field.name))
  const patches = []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null
    const rid = typeof row.id === 'string' && row.id
      ? row.id
      : typeof row.rid === 'string' && row.rid
        ? row.rid
        : ''
    if (!rid) return null
    const fields = {}
    for (const [key, value] of Object.entries(row)) {
      if (RESERVED_KEYS.has(key) || !allowed.has(key)) continue
      fields[key] = value
    }
    if (Object.keys(fields).length === 0) return null
    patches.push({ rid, fields })
  }
  return patches
}

export function proposeRecordUpdate(db, input) {
  const drafted = recordPatches(input.app.spec, input.entity, input.rows)
  if (!drafted) return { ok: false, error: 'validation_error', message: '更新提案需要记录和字段' }
  const patches = []
  for (const patch of drafted) {
    const existing = getRecord(db, input.app.spec, input.entity, input.workspaceCwd, patch.rid)
    if (!existing) return { ok: false, error: 'not_found', message: '记录不存在' }
    patches.push({
      rid: patch.rid,
      fields: patch.fields,
      base: { updated_at: existing.updated_at },
    })
  }
  const id = createId('op')
  const now = new Date().toISOString()
  const correlationId = input.correlationId || createId('corr')
  const actorId = input.actorId ?? 'actor_local_user'
  const plan = {
    kind: 'app.record.propose',
    appId: input.app.id,
    slug: String(input.app.spec.slug),
    entity: input.entity,
    workspaceCwd: input.workspaceCwd,
    patches,
  }
  const targetRef = patches.length === 1
    ? `fde://workstation/app/${plan.slug}/${input.entity}/${patches[0].rid}`
    : `fde://workstation/app/${input.app.id}`
  const planJson = JSON.stringify(plan)
  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      INSERT INTO operations
        (id, workspace_id, connection_id, app_id, requested_by, target_ref, action, operation_kind,
         risk_level, execution_mode, state, idempotency_key, expected_version, input_json, plan_json,
         correlation_id, causation_id, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, 'write', 'low', 'dry_run', 'awaiting_approval', ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      id,
      input.workspaceId,
      input.app.id,
      actorId,
      targetRef,
      RECORD_PROPOSAL_ACTION,
      createId('idem'),
      expectedVersion(patches),
      planJson,
      planJson,
      correlationId,
      now,
      now,
    )
    appendAudit(db, {
      workspaceId: input.workspaceId,
      actorId,
      action: 'app.record.propose',
      targetRef,
      outcome: 'accepted',
      riskLevel: 'low',
      correlationId,
      details: plan,
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { ok: true, proposalId: id, plan }
}

function loadOpenProposal(db, operationId) {
  const operation = getOperation(db, operationId)
  if (!operation) return { kind: 'not_found' }
  if (operation.action !== RECORD_PROPOSAL_ACTION) return { kind: 'not_proposal' }
  if (operation.state !== 'awaiting_approval') return { kind: 'invalid_state', operation }
  return { kind: 'open', operation }
}

export function confirmRecordProposal(db, operationId, opts = {}) {
  const actorId = opts.actorId ?? 'actor_local_user'
  db.exec('BEGIN IMMEDIATE;')
  try {
    const loaded = loadOpenProposal(db, operationId)
    if (loaded.kind !== 'open') {
      db.exec('ROLLBACK;')
      return loaded
    }
    const operation = loaded.operation
    const plan = operation.plan
    const app = getAppById(db, plan.appId)
    if (!app || app.status !== 'active' || appIsTrashed(app)) {
      db.exec('ROLLBACK;')
      return { kind: 'not_found' }
    }
    const currentRows = []
    for (const patch of plan.patches) {
      const current = getRecord(db, app.spec, plan.entity, plan.workspaceCwd, patch.rid)
      if (!current) {
        db.exec('ROLLBACK;')
        return { kind: 'not_found' }
      }
      currentRows.push(current)
    }
    if (plan.patches.some((patch, index) => rowMoved(currentRows[index], patch))) {
      const now = new Date().toISOString()
      const updated = db.prepare(`
        UPDATE operations
        SET state = 'failed', updated_at = ?, finished_at = ?
        WHERE id = ? AND state = 'awaiting_approval'
      `).run(now, now, operationId)
      if (updated.changes !== 1) {
        db.exec('ROLLBACK;')
        return { kind: 'invalid_state', operation: getOperation(db, operationId) }
      }
      appendAudit(db, {
        workspaceId: operation.workspaceId,
        actorId,
        action: 'app.record.confirm',
        targetRef: operation.targetRef,
        outcome: 'failed',
        riskLevel: 'low',
        correlationId: opts.correlationId || operation.correlationId,
        details: { operationId, reason: 'stale_record' },
      })
      db.exec('COMMIT;')
      return { kind: 'stale', operation: getOperation(db, operationId) }
    }
    for (const patch of plan.patches) {
      const row = patchRecord(db, app.spec, plan.entity, plan.workspaceCwd, patch.rid, patch.fields)
      if (!row) {
        db.exec('ROLLBACK;')
        return { kind: 'not_found' }
      }
    }
    const now = new Date().toISOString()
    const updated = db.prepare(`
      UPDATE operations
      SET state = 'succeeded', updated_at = ?, finished_at = ?
      WHERE id = ? AND state = 'awaiting_approval'
    `).run(now, now, operationId)
    if (updated.changes !== 1) {
      db.exec('ROLLBACK;')
      return { kind: 'invalid_state', operation: getOperation(db, operationId) }
    }
    appendAudit(db, {
      workspaceId: operation.workspaceId,
      actorId,
      action: 'app.record.confirm',
      targetRef: operation.targetRef,
      outcome: 'succeeded',
      riskLevel: 'low',
      correlationId: opts.correlationId || operation.correlationId,
      details: { operationId, patches: plan.patches },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { kind: 'ok', operation: getOperation(db, operationId) }
}

export function rejectRecordProposal(db, operationId, opts = {}) {
  const actorId = opts.actorId ?? 'actor_local_user'
  db.exec('BEGIN IMMEDIATE;')
  try {
    const loaded = loadOpenProposal(db, operationId)
    if (loaded.kind !== 'open') {
      db.exec('ROLLBACK;')
      return loaded
    }
    const operation = loaded.operation
    const now = new Date().toISOString()
    const updated = db.prepare(`
      UPDATE operations
      SET state = 'cancelled', updated_at = ?, finished_at = ?
      WHERE id = ? AND state = 'awaiting_approval'
    `).run(now, now, operationId)
    if (updated.changes !== 1) {
      db.exec('ROLLBACK;')
      return { kind: 'invalid_state', operation: getOperation(db, operationId) }
    }
    appendAudit(db, {
      workspaceId: operation.workspaceId,
      actorId,
      action: 'app.record.reject',
      targetRef: operation.targetRef,
      outcome: 'rejected',
      riskLevel: 'low',
      correlationId: opts.correlationId || operation.correlationId,
      details: { operationId },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { kind: 'ok', operation: getOperation(db, operationId) }
}
