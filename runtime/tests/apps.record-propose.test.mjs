import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import { activateApp, createAppDraft } from '../apps/repository.mjs'
import { getRecord, insertRecord } from '../apps/records.mjs'
import { handleAppsBridge } from '../routes/apps.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD = '/tmp/fde-s2-record-propose-cwd'

function openFresh() {
  return openDatabase(`/tmp/fde-s2-propose-${process.pid}-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
}

describe('app record propose', () => {
  test('propose leaves the record unchanged and stores one awaiting_approval operation', async () => {
    const db = openFresh()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: SUPPLIER_VISITS_SPEC,
    })
    assert.equal(created.ok, true)
    const activated = activateApp(db, created.data.appId)
    assert.equal(activated.kind, 'ok')
    const row = insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
    })

    const result = await handleAppsBridge('app-records-propose', {
      slug: 'supplier-visits',
      entity: 'visit',
      op: 'update',
      rows: [{ id: row.id, status: '已拜访' }],
    }, db, CWD)

    assert.equal(result.ok, true)
    const after = getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id)
    assert.equal(after.status, '计划', '提案后记录不能被改')
    const pending = db.prepare(`SELECT id, state FROM operations WHERE state = 'awaiting_approval'`).all()
    assert.equal(pending.length, 1, '提案后应有一条 awaiting_approval 的操作')
    db.close()
  })
})
