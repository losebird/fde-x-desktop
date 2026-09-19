import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import {
  activateApp,
  createAppDraft,
  getAppById,
  putAppSpec,
  rollbackApp,
} from '../apps/repository.mjs'
import { insertRecord, listColumns, listRecords } from '../apps/records.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD = '/tmp/fde-app-revision-cwd'

function specWith({ name, slug }) {
  return { ...SUPPLIER_VISITS_SPEC, name, slug }
}

function dbNew() {
  return openDatabase(
    `/tmp/fde-apps-rev-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
    join(repoRoot, 'runtime/migrations'),
  )
}

describe('apps revision add-field and rollback', () => {
  test('listColumns appends entity fields missing from view.columns', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.entities[0].fields.push({ name: 'extra_col', type: 'text', label: '附加' })
    const cols = listColumns(spec, 'visit', spec.views.find((v) => v.type === 'table'))
    assert.ok(cols.includes('extra_col'))
    assert.ok(cols.indexOf('extra_col') > cols.indexOf('status'))
  })

  test('activate after adding a field keeps old rows; rollback hides the field', () => {
    const db = dbNew()
    const spec = specWith({ name: '修订台账', slug: 'rev-keep' })
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec,
    })
    assert.equal(created.ok, true)
    assert.equal(activateApp(db, created.data.appId).kind, 'ok')
    insertRecord(db, spec, 'visit', CWD, {
      supplier: '旧行',
      visit_date: '2026-09-19',
      status: '计划',
    })

    const current = getAppById(db, created.data.appId)
    const next = JSON.parse(JSON.stringify(current.spec))
    next.entities[0].fields.push({ name: 'phone', type: 'text', label: '电话' })
    const put = putAppSpec(db, created.data.appId, { spec: next, changeNote: '加字段' })
    assert.equal(put.kind, 'ok')
    assert.equal(put.data.revision, 2)
    const pending = getAppById(db, created.data.appId)
    assert.equal(pending.revisions.find((r) => r.revision === 2)?.materialize_status, 'pending')

    assert.equal(activateApp(db, created.data.appId).kind, 'ok')
    const info = db.prepare('PRAGMA table_info("app_rev-keep__visit")').all()
    assert.ok(info.some((col) => col.name === 'phone'))
    const afterAdd = getAppById(db, created.data.appId)
    const listed = listRecords(db, afterAdd.spec, 'visit', CWD)
    assert.equal(listed.total, 1)
    assert.equal(listed.rows[0].supplier, '旧行')
    assert.ok(listColumns(afterAdd.spec, 'visit', afterAdd.spec.views.find((v) => v.type === 'table')).includes('phone'))

    const rolled = rollbackApp(db, created.data.appId, 1)
    assert.equal(rolled.revision, 1)
    const restored = getAppById(db, created.data.appId)
    assert.equal(restored.currentRevision, 1)
    assert.equal(restored.spec.entities[0].fields.some((f) => f.name === 'phone'), false)
    const afterRollback = listRecords(db, restored.spec, 'visit', CWD)
    assert.equal(afterRollback.total, 1)
    assert.equal(afterRollback.rows[0].supplier, '旧行')
    assert.equal(afterRollback.rows[0].phone, undefined)
    const infoAfter = db.prepare('PRAGMA table_info("app_rev-keep__visit")').all()
    assert.ok(infoAfter.some((col) => col.name === 'phone'))
    db.close()
  })
})
