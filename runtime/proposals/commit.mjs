import { appendAudit, createId, getOperation } from '../db.mjs'

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function judgeSnapshot(current, base) {
  if (base == null && current == null) return 'ready'
  if (base == null && current != null) return 'appeared'
  if (plainObject(base) && current == null) return 'missing'
  if (!plainObject(base) || current !== base.updated_at) return 'moved'
  return 'ready'
}

function markState(db, operationId, state) {
  const now = new Date().toISOString()
  return db.prepare(`
    UPDATE operations
    SET state = ?, updated_at = ?, finished_at = ?
    WHERE id = ? AND state = 'awaiting_approval'
  `).run(state, now, now, operationId)
}

function auditProposal(db, operation, { actorId, action, outcome, correlationId, details }) {
  appendAudit(db, {
    workspaceId: operation.workspaceId,
    actorId,
    action,
    targetRef: operation.targetRef,
    outcome,
    riskLevel: 'low',
    correlationId,
    details,
  })
}

export function openProposal(db, spec) {
  const id = createId('op')
  const now = new Date().toISOString()
  const correlationId = spec.correlationId || createId('corr')
  const actorId = spec.actorId ?? 'actor_local_user'
  const planJson = JSON.stringify(spec.plan)
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
      spec.workspaceId,
      spec.appId ?? null,
      actorId,
      spec.targetRef,
      spec.action,
      createId('idem'),
      spec.expectedVersion ?? null,
      planJson,
      planJson,
      correlationId,
      now,
      now,
    )
    appendAudit(db, {
      workspaceId: spec.workspaceId,
      actorId,
      action: spec.action,
      targetRef: spec.targetRef,
      outcome: 'accepted',
      riskLevel: 'low',
      correlationId,
      details: spec.plan,
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { ok: true, proposalId: id, plan: spec.plan }
}

export function decideProposal(db, operationId, decision, domain) {
  const actorId = domain.actorId ?? 'actor_local_user'
  db.exec('BEGIN IMMEDIATE;')
  try {
    const operation = getOperation(db, operationId)
    if (!operation) {
      db.exec('ROLLBACK;')
      return { kind: 'not_found' }
    }
    if (operation.action !== domain.action) {
      db.exec('ROLLBACK;')
      return { kind: 'not_proposal' }
    }
    if (operation.state !== 'awaiting_approval') {
      db.exec('ROLLBACK;')
      return { kind: 'invalid_state', operation }
    }
    const correlationId = domain.correlationId || operation.correlationId
    if (decision === 'reject') {
      const updated = markState(db, operationId, 'cancelled')
      if (updated.changes !== 1) {
        db.exec('ROLLBACK;')
        return { kind: 'invalid_state', operation: getOperation(db, operationId) }
      }
      auditProposal(db, operation, {
        actorId,
        action: domain.rejectAction,
        outcome: 'rejected',
        correlationId,
        details: { operationId },
      })
      db.exec('COMMIT;')
      return { kind: 'ok', operation: getOperation(db, operationId) }
    }
    if (decision !== 'confirm') throw new Error(`unknown proposal decision: ${decision}`)
    const loaded = domain.load(db, operation.plan)
    if (loaded.hold === true) {
      db.exec('ROLLBACK;')
      return { kind: 'not_found' }
    }
    let closing = null
    for (const version of loaded.versions) {
      if (judgeSnapshot(version.current, version.base) === 'missing') {
        closing = { kind: 'not_found', reason: domain.reasons.missing }
        break
      }
    }
    if (!closing) {
      for (const version of loaded.versions) {
        const verdict = judgeSnapshot(version.current, version.base)
        if (verdict === 'moved' || verdict === 'appeared') {
          closing = { kind: 'stale', reason: domain.reasons[verdict] }
          break
        }
      }
    }
    if (closing) {
      const updated = markState(db, operationId, 'failed')
      if (updated.changes !== 1) {
        db.exec('ROLLBACK;')
        return { kind: 'invalid_state', operation: getOperation(db, operationId) }
      }
      auditProposal(db, operation, {
        actorId,
        action: domain.confirmAction,
        outcome: 'failed',
        correlationId,
        details: { operationId, reason: closing.reason },
      })
      db.exec('COMMIT;')
      return { kind: closing.kind, reason: closing.reason, operation: getOperation(db, operationId) }
    }
    const applied = domain.apply(db, operation.plan)
    if (applied.applied !== true) {
      db.exec('ROLLBACK;')
      return { kind: 'not_found' }
    }
    const updated = markState(db, operationId, 'succeeded')
    if (updated.changes !== 1) {
      db.exec('ROLLBACK;')
      return { kind: 'invalid_state', operation: getOperation(db, operationId) }
    }
    auditProposal(db, operation, {
      actorId,
      action: domain.confirmAction,
      outcome: 'succeeded',
      correlationId,
      details: { operationId, ...applied.details },
    })
    db.exec('COMMIT;')
    return { kind: 'ok', operation: getOperation(db, operationId) }
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
}
