import './support/no-stray-processes.mjs'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import { activateApp, createAppDraft } from '../apps/repository.mjs'
import { deleteRecord, getRecord, insertRecord, patchRecord } from '../apps/records.mjs'
import { handleAppsBridge, handleAppsRoutes } from '../routes/apps.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD = '/tmp/fde-s2-record-propose-cwd'
const PAGE_TOKEN = 'a'.repeat(64)
const BRIDGE_TOKEN = 'b'.repeat(64)
const ORIGIN = 'http://127.0.0.1:5174'

let dbSeq = 0

function openFresh() {
  dbSeq += 1
  return openDatabase(`/tmp/fde-s2-propose-${process.pid}-${Date.now()}-${dbSeq}.sqlite`, join(repoRoot, 'runtime/migrations'))
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

  test('propose writes one audit row and keeps the snapshot on the operation', async () => {
    const db = openFresh()
    const { row } = await readyVisit(db)
    const before = countAction(db, 'app.record.propose')
    const result = await proposeStatus(db, row.id, '已拜访')
    assert.equal(result.ok, true)
    const after = getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id)
    assert.equal(after.status, '计划', '提案后记录不能被改')
    const pending = db.prepare(`SELECT id, state, plan_json FROM operations WHERE state = 'awaiting_approval'`).all()
    assert.equal(pending.length, 1, '提案后应有一条 awaiting_approval 的操作')
    const plan = JSON.parse(pending[0].plan_json)
    assert.equal(plan.patches[0].rid, row.id)
    assert.deepEqual(plan.patches[0].fields, { status: '已拜访' })
    assert.equal(countAction(db, 'app.record.propose'), before + 1)
    db.close()
  })

  test('page token confirm applies the snapshot and ignores a tampered body', async () => {
    const db = openFresh()
    const { row } = await readyVisit(db)
    const proposed = await proposeStatus(db, row.id, '已拜访')
    const before = countAction(db, 'app.record.confirm')
    const summaryBefore = getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id).summary
    const confirmed = await decide(db, proposed.proposalId, 'confirm', {
      'x-fde-ui-token': PAGE_TOKEN,
    }, { status: '需跟进', summary: '被改写' })
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.payload))
    const after = getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id)
    assert.equal(after.status, '已拜访')
    assert.equal(after.summary, summaryBefore)
    const op = db.prepare('SELECT state FROM operations WHERE id = ?').get(proposed.proposalId)
    assert.equal(op.state, 'succeeded')
    assert.equal(countAction(db, 'app.record.confirm'), before + 1)

    patchRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id, { status: '需跟进' })
    const again = await decide(db, proposed.proposalId, 'confirm', {
      'x-fde-ui-token': PAGE_TOKEN,
    }, { status: '已拜访' })
    assert.equal(again.status, 409)
    const stayed = getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id)
    assert.equal(stayed.status, '需跟进')
    assert.equal(db.prepare('SELECT state FROM operations WHERE id = ?').get(proposed.proposalId).state, 'succeeded')
    assert.equal(countAction(db, 'app.record.confirm'), before + 1)
    db.close()
  })

  test('confirm without the page token returns 401 and leaves the record', async () => {
    const db = openFresh()
    const { row } = await readyVisit(db)
    const proposed = await proposeStatus(db, row.id, '已拜访')
    const missing = await decide(db, proposed.proposalId, 'confirm', {}, { status: '已拜访' })
    assert.equal(missing.status, 401)
    const bridged = await decide(db, proposed.proposalId, 'confirm', {
      'x-fde-bridge-token': BRIDGE_TOKEN,
      'x-fde-ui-token': BRIDGE_TOKEN,
    }, { status: '已拜访' })
    assert.equal(bridged.status, 401)
    const after = getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id)
    assert.equal(after.status, '计划')
    assert.equal(db.prepare('SELECT state FROM operations WHERE id = ?').get(proposed.proposalId).state, 'awaiting_approval')
    db.close()
  })

  test('reject leaves the record unchanged and a later confirm is refused', async () => {
    const db = openFresh()
    const { row } = await readyVisit(db)
    const proposed = await proposeStatus(db, row.id, '已拜访')
    const before = countAction(db, 'app.record.reject')
    const rejected = await decide(db, proposed.proposalId, 'reject', {
      'x-fde-ui-token': PAGE_TOKEN,
    }, { status: '已拜访' })
    assert.equal(rejected.status, 200, JSON.stringify(rejected.payload))
    const after = getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id)
    assert.equal(after.status, '计划')
    assert.equal(db.prepare('SELECT state FROM operations WHERE id = ?').get(proposed.proposalId).state, 'cancelled')
    assert.equal(countAction(db, 'app.record.reject'), before + 1)
    const again = await decide(db, proposed.proposalId, 'confirm', {
      'x-fde-ui-token': PAGE_TOKEN,
    }, {})
    assert.equal(again.status, 409)
    assert.equal(getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id).status, '计划')
    assert.equal(db.prepare('SELECT state FROM operations WHERE id = ?').get(proposed.proposalId).state, 'cancelled')
    db.close()
  })

  test('confirm refuses when the same field changed after the proposal', async () => {
    const db = openFresh()
    const { row } = await readyVisit(db)
    const proposed = await proposeStatus(db, row.id, '已拜访')
    const patched = await patchVisit(db, row.id, { status: '需跟进' })
    assert.equal(patched.status, 200, JSON.stringify(patched.payload))
    const confirmed = await decide(db, proposed.proposalId, 'confirm', {
      'x-fde-ui-token': PAGE_TOKEN,
    }, { status: '已拜访' })
    assert.equal(confirmed.status, 409)
    const after = getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id)
    assert.equal(after.status, '需跟进')
    const op = db.prepare('SELECT state FROM operations WHERE id = ?').get(proposed.proposalId)
    assert.equal(op.state, 'failed')
    const audits = db.prepare(`SELECT outcome FROM audit_entries WHERE action = 'app.record.confirm'`).all()
    assert.equal(audits.length, 1)
    assert.equal(audits[0].outcome, 'failed')
    db.close()
  })

  test('confirm closes the proposal when the record was deleted', async () => {
    const db = openFresh()
    const { row } = await readyVisit(db)
    const proposed = await proposeStatus(db, row.id, '已拜访')
    assert.equal(deleteRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id), true)
    const confirmed = await decide(db, proposed.proposalId, 'confirm', {
      'x-fde-ui-token': PAGE_TOKEN,
    }, {})
    assert.equal(confirmed.status, 404)
    const op = db.prepare('SELECT state FROM operations WHERE id = ?').get(proposed.proposalId)
    assert.equal(op.state, 'failed')
    const audits = db.prepare(`SELECT outcome FROM audit_entries WHERE action = 'app.record.confirm'`).all()
    assert.equal(audits.length, 1)
    assert.equal(audits[0].outcome, 'failed')
    const again = await decide(db, proposed.proposalId, 'confirm', {
      'x-fde-ui-token': PAGE_TOKEN,
    }, {})
    assert.equal(again.status, 409)
    assert.equal(again.payload.error.code, 'invalid_state')
    assert.equal(db.prepare('SELECT state FROM operations WHERE id = ?').get(proposed.proposalId).state, 'failed')
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM audit_entries WHERE action = 'app.record.confirm'`).get().n, 1)
    assert.equal(getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD, row.id), null)
    db.close()
  })
})

async function readyVisit(db) {
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
  return { row }
}

async function proposeStatus(db, rid, status) {
  return handleAppsBridge('app-records-propose', {
    slug: 'supplier-visits',
    entity: 'visit',
    op: 'update',
    rows: [{ id: rid, status }],
  }, db, CWD)
}

function countAction(db, action) {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM audit_entries WHERE action = ?').get(action).n)
}

async function patchVisit(db, rid, body) {
  const env = { status: 0, payload: null }
  const handled = await handleAppsRoutes(
    {
      method: 'PATCH',
      headers: { origin: ORIGIN, 'x-fde-ui-token': PAGE_TOKEN },
    },
    {},
    new URL(`http://127.0.0.1/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(CWD)}`),
    {
      db,
      allowedOrigins: new Set([ORIGIN]),
      correlationId: 'corr_s2',
      uiToken: PAGE_TOKEN,
      sendJson(_response, code, payload) {
        env.status = code
        env.payload = payload
      },
      sendError(_response, code, error, message, correlationId, details) {
        env.status = code
        env.payload = { error: { code: error, message, details }, correlationId }
      },
      readJson: async () => body,
    },
  )
  assert.equal(handled, true)
  return env
}

async function decide(db, operationId, decision, headers, body) {
  const env = { status: 0, payload: null }
  const handled = await handleAppsRoutes(
    {
      method: 'POST',
      headers: { origin: ORIGIN, ...headers },
    },
    {},
    new URL(`http://127.0.0.1/api/v1/apps/record-proposals/${operationId}/${decision}`),
    {
      db,
      allowedOrigins: new Set([ORIGIN]),
      correlationId: 'corr_s2',
      uiToken: PAGE_TOKEN,
      sendJson(_response, code, payload) {
        env.status = code
        env.payload = payload
      },
      sendError(_response, code, error, message, correlationId, details) {
        env.status = code
        env.payload = { error: { code: error, message, details }, correlationId }
      },
      readJson: async () => body,
    },
  )
  assert.equal(handled, true)
  return env
}
