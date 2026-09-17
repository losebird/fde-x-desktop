import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  approveOperation,
  executeOperationLive,
  insertBizSurface,
  insertOperationStep,
  listBizSurfaces,
  openDatabase,
} from '../db.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

describe('biz surfaces and live execute', () => {
  test('dsh-core lanAssist whitelist includes /catalog and /traces', () => {
    const source = readFileSync(join(repoRoot, 'runtime/dsh-core.mjs'), 'utf8')
    assert.match(source, /'\/catalog'/)
    assert.match(source, /'\/traces'/)
  })

  test('biz_surfaces insert and list', () => {
    const db = openDatabase(`/tmp/fde-biz-surface-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    insertBizSurface(db, {
      workspaceCwd: '/tmp/ws-a',
      kind: '采购单',
      action: '现查',
      rowCount: 3,
      columnsJson: '[]',
    })
    const items = listBizSurfaces(db, '/tmp/ws-a', 10)
    assert.equal(items.length, 1)
    assert.equal(items[0].kind, '采购单')
    db.close()
  })

  test('execute live: approved without preview → preview_expired', async () => {
    const db = openDatabase(`/tmp/fde-biz-live-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const id = 'op_test_live'
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO operations
        (id, workspace_id, connection_id, app_id, requested_by, target_ref, action, operation_kind,
         risk_level, execution_mode, state, idempotency_key, expected_version, input_json, plan_json,
         correlation_id, causation_id, created_at, updated_at)
      VALUES (?, 'ws_personal', NULL, NULL, 'actor_local_user', 'fde://external/x/table/y', 'record.update', 'write',
        'high', 'live', 'approved', 'idem_live_1', NULL, '{}', '{}', 'corr', NULL, ?, ?)
    `).run(id, now, now)
    insertOperationStep(db, id, 1, 'approve', 'succeeded', {})
    const result = await executeOperationLive(db, id, {
      writePreview: async () => ({}),
    })
    assert.equal(result.kind, 'preview_expired')
    db.close()
  })

  test('execute live: not approved → invalid_state', async () => {
    const db = openDatabase(`/tmp/fde-biz-live2-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const id = 'op_test_draft'
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO operations
        (id, workspace_id, connection_id, app_id, requested_by, target_ref, action, operation_kind,
         risk_level, execution_mode, state, idempotency_key, expected_version, input_json, plan_json,
         correlation_id, causation_id, created_at, updated_at)
      VALUES (?, 'ws_personal', NULL, NULL, 'actor_local_user', 'fde://external/x/table/y', 'record.update', 'write',
        'high', 'live', 'awaiting_approval', 'idem_live_2', NULL, '{}', '{"previewId":"pv_1"}', 'corr', NULL, ?, ?)
    `).run(id, now, now)
    const result = await executeOperationLive(db, id, { writePreview: async () => ({ ok: true }) })
    assert.equal(result.kind, 'invalid_state')
    db.close()
  })

  test('execute live: approved with preview → succeeded and four steps', async () => {
    const db = openDatabase(`/tmp/fde-biz-live3-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const id = 'op_test_ok'
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO operations
        (id, workspace_id, connection_id, app_id, requested_by, target_ref, action, operation_kind,
         risk_level, execution_mode, state, idempotency_key, expected_version, input_json, plan_json,
         correlation_id, causation_id, created_at, updated_at)
      VALUES (?, 'ws_personal', NULL, NULL, 'actor_local_user', 'fde://external/x/table/y', 'record.update', 'write',
        'high', 'live', 'approved', 'idem_live_3', NULL, '{}', '{"previewId":"pv_ok","kind":"采购单","action":"改行"}', 'corr', NULL, ?, ?)
    `).run(id, now, now)
    insertOperationStep(db, id, 0, 'preview', 'succeeded', { previewId: 'pv_ok' })
    insertOperationStep(db, id, 1, 'approve', 'succeeded', {})
    const result = await executeOperationLive(db, id, {
      correlationId: 'corr_live_ok',
      writePreview: async () => ({ receipt_id: 'rcpt_1', kind: '采购单', action: '改行' }),
    })
    assert.equal(result.kind, 'ok')
    assert.equal(result.operation.state, 'succeeded')
    const steps = db.prepare('SELECT step_kind, state FROM operation_steps WHERE operation_id = ? ORDER BY sequence_no').all(id)
    assert.ok(steps.some((s) => s.step_kind === 'write' && s.state === 'succeeded'))
    assert.ok(steps.some((s) => s.step_kind === 'receipt'))
    db.close()
  })

  test('approve adds approve step', () => {
    const db = openDatabase(`/tmp/fde-biz-approve-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const id = 'op_appr'
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO operations
        (id, workspace_id, connection_id, app_id, requested_by, target_ref, action, operation_kind,
         risk_level, execution_mode, state, idempotency_key, expected_version, input_json, plan_json,
         correlation_id, causation_id, created_at, updated_at)
      VALUES (?, 'ws_personal', NULL, NULL, 'actor_local_user', 'fde://external/x/table/y', 'record.update', 'write',
        'high', 'dry_run', 'awaiting_approval', 'idem_appr', NULL, '{}', '{}', 'corr', NULL, ?, ?)
    `).run(id, now, now)
    db.prepare(`
      INSERT INTO approvals (id, operation_id, requested_from, decision, policy_json, requested_at)
      VALUES ('appr_1', ?, 'actor_local_user', 'pending', '{}', ?)
    `).run(id, now)
    const out = approveOperation(db, id, { note: 'ok', correlationId: 'corr_appr' })
    assert.equal(out.kind, 'ok')
    const step = db.prepare('SELECT step_kind FROM operation_steps WHERE operation_id = ? AND step_kind = ?').get(id, 'approve')
    assert.ok(step)
    db.close()
  })
})
