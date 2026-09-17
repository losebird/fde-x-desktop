import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { applyMaterialize } from '../apps/materialize.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import { insertRecord } from '../apps/records.mjs'
import {
  buildAgentActionJobs,
  buildBizPreviewIntents,
  executeSetAction,
  findAction,
  planSetActionWithApproval,
  renderRowTemplate,
} from '../apps/actions.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD = '/tmp/workspace-actions'

describe('apps actions', () => {
  test('set action updates rows', () => {
    const db = openDatabase(`/tmp/fde-apps-act-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    applyMaterialize(db, SUPPLIER_VISITS_SPEC)
    const row = insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
    })
    const action = findAction(SUPPLIER_VISITS_SPEC, 'mark-follow')
    const result = executeSetAction(db, {
      workspaceId: 'ws_personal',
      appId: null,
      spec: SUPPLIER_VISITS_SPEC,
      action,
      rids: [row.id],
      workspaceCwd: CWD,
    })
    assert.equal(result.rows[0].status, '需跟进')
    db.close()
  })

  test('approval creates operation', () => {
    const db = openDatabase(`/tmp/fde-apps-act2-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const action = { ...findAction(SUPPLIER_VISITS_SPEC, 'mark-follow'), approval: 'required' }
    const planned = planSetActionWithApproval(db, {
      workspaceId: 'ws_personal',
      appId: null,
      action,
      rids: ['rec_1'],
    })
    assert.equal(planned.kind, 'awaiting_approval')
    const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(planned.operationId)
    assert.equal(op.state, 'awaiting_approval')
    const step = db.prepare('SELECT * FROM operation_steps WHERE operation_id = ?').get(planned.operationId)
    assert.ok(step)
    db.close()
  })

  test('agent prompt template renders row fields', () => {
    const text = renderRowTemplate('跟进 $supplier 于 $visit_date', { supplier: 'ACME', visit_date: '2026-09-01' })
    assert.equal(text, '跟进 ACME 于 2026-09-01')
  })

  test('agent builds jobs', () => {
    const action = {
      name: 'ai',
      kind: 'agent',
      entity: 'visit',
      agent: { preset: 'fde-app-builder', prompt: '总结 $summary', writeBack: 'summary' },
    }
    const jobs = buildAgentActionJobs(action, [{ id: 'r1', summary: '见面聊价' }])
    assert.equal(jobs[0].preset, 'fde-app-builder')
    assert.equal(jobs[0].prompt, '总结 见面聊价')
    assert.equal(jobs[0].writeBack, 'summary')
  })

  test('biz builds preview intents', () => {
    const action = {
      name: 'biz',
      kind: 'biz',
      entity: 'visit',
      biz: { kind: '客户', action: '现查', map: { id: '$supplier' } },
    }
    const intents = buildBizPreviewIntents(action, [{ id: 'r1', supplier: 'ACME' }])
    assert.equal(intents[0].map.id, 'ACME')
  })
})
