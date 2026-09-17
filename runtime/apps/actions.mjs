import { appendAudit, createId, enqueueEvent } from '../db.mjs'
import { patchRecord } from './records.mjs'

/**
 * @param {Record<string, unknown>} spec
 * @param {string} actionName
 */
export function findAction(spec, actionName) {
  const actions = Array.isArray(spec.actions) ? spec.actions : []
  return actions.find((a) => a.name === actionName) || null
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ workspaceId: string, appId: string, spec: Record<string, unknown>, action: Record<string, unknown>, rids: string[], workspaceCwd: string, correlationId?: string }} input
 */
export function executeSetAction(db, input) {
  const { spec, action, rids, workspaceCwd } = input
  const entity = String(action.entity)
  const setValues = action.set && typeof action.set === 'object' ? action.set : {}
  const results = []
  for (const rid of rids) {
    const row = patchRecord(db, spec, entity, workspaceCwd, rid, setValues)
    if (row) results.push(row)
  }
  return { kind: 'applied', rows: results }
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ workspaceId: string, appId: string, action: Record<string, unknown>, rids: string[], correlationId?: string, actorId?: string }} input
 */
export function planSetActionWithApproval(db, input) {
  const id = createId('op')
  const now = new Date().toISOString()
  const plan = { action: input.action.name, rids: input.rids }
  db.exec('BEGIN IMMEDIATE;')
  try {
    db.prepare(`
      INSERT INTO operations
        (id, workspace_id, connection_id, app_id, requested_by, target_ref, action, operation_kind,
         risk_level, execution_mode, state, idempotency_key, expected_version, input_json, plan_json,
         correlation_id, causation_id, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, 'write', 'medium', 'dry_run', 'awaiting_approval', ?, NULL, ?, ?, ?, NULL, ?, ?)
    `).run(
      id,
      input.workspaceId,
      input.appId,
      input.actorId ?? 'actor_local_user',
      `fde://workstation/app/${input.appId}/action/${input.action.name}`,
      `app.action.${input.action.name}`,
      createId('idem'),
      JSON.stringify({ rids: input.rids }),
      JSON.stringify(plan),
      input.correlationId ?? createId('corr'),
      now,
      now,
    )
    db.prepare(`
      INSERT INTO operation_steps
        (id, operation_id, sequence_no, step_kind, state, tool_ref, input_json, output_json, error_json, started_at, finished_at)
      VALUES (?, ?, 0, 'app.action.set', 'queued', 'apps/actions', ?, NULL, NULL, ?, NULL)
    `).run(createId('opstep'), id, JSON.stringify(plan), now)
    db.prepare(`
      INSERT INTO approvals
        (id, operation_id, requested_from, decision, policy_json, requested_at)
      VALUES (?, ?, 'actor_local_user', 'pending', '{}', ?)
    `).run(createId('approval'), id, now)
    appendAudit(db, {
      workspaceId: input.workspaceId,
      actorId: input.actorId ?? 'actor_local_user',
      action: 'app.action.plan',
      targetRef: `fde://workstation/operation/${id}`,
      outcome: 'accepted',
      correlationId: input.correlationId ?? createId('corr'),
      details: plan,
    })
    enqueueEvent(db, {
      type: 'operation.planned',
      sourceRef: `fde://workstation/operation/${id}`,
      subjectRef: `fde://workstation/app/${input.appId}`,
      correlationId: input.correlationId ?? createId('corr'),
      payload: { operationId: id, state: 'awaiting_approval' },
    })
    db.exec('COMMIT;')
  } catch (error) {
    db.exec('ROLLBACK;')
    throw error
  }
  return { kind: 'awaiting_approval', operationId: id }
}

/**
 * Build biz preview payloads per row (frontend completes preview/write).
 * @param {Record<string, unknown>} action
 * @param {Record<string, unknown>[]} rows
 */
export function buildBizPreviewIntents(action, rows) {
  const biz = action.biz || {}
  return rows.map((row) => ({
    kind: biz.kind,
    action: biz.action,
    map: applyBizMap(biz.map, row),
    rowId: row.id,
  }))
}

/**
 * @param {Record<string, unknown>|undefined} map
 * @param {Record<string, unknown>} row
 */
function applyBizMap(map, row) {
  if (!map || typeof map !== 'object') return { ...row }
  const out = {}
  for (const [key, template] of Object.entries(map)) {
    if (typeof template === 'string' && template.startsWith('$')) {
      out[key] = row[template.slice(1)]
    } else {
      out[key] = template
    }
  }
  return out
}
