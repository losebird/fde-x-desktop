import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { applyMaterialize } from '../apps/materialize.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import {
  deleteRecord,
  getRecord,
  insertRecord,
  listRecords,
  patchRecord,
} from '../apps/records.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD_A = '/tmp/workspace-a'
const CWD_B = '/tmp/workspace-b'

function dbWithApp() {
  const db = openDatabase(`/tmp/fde-apps-crud-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
  applyMaterialize(db, SUPPLIER_VISITS_SPEC)
  return db
}

describe('apps crud', () => {
  test('insert and list', () => {
    const db = dbWithApp()
    const row = insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
    })
    assert.ok(row.id)
    const list = listRecords(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A)
    assert.equal(list.total, 1)
    db.close()
  })

  test('required validation', () => {
    const db = dbWithApp()
    assert.throws(() => insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, { supplier: 'x' }), (e) => e.code === 'validation_error')
    db.close()
  })

  test('enum validation', () => {
    const db = dbWithApp()
    assert.throws(
      () => insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, {
        supplier: 'ACME',
        visit_date: '2026-09-01',
        status: '无效',
      }),
      (e) => e.code === 'validation_error',
    )
    db.close()
  })

  test('patch and get', () => {
    const db = dbWithApp()
    const row = insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
    })
    patchRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, row.id, { status: '已拜访' })
    const got = getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, row.id)
    assert.equal(got.status, '已拜访')
    db.close()
  })

  test('soft delete', () => {
    const db = dbWithApp()
    const row = insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
    })
    assert.ok(deleteRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, row.id))
    assert.equal(listRecords(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A).total, 0)
    db.close()
  })

  test('workspace isolation', () => {
    const db = dbWithApp()
    insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
    })
    assert.equal(listRecords(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_B).total, 0)
    db.close()
  })

  test('pagination', () => {
    const db = dbWithApp()
    for (let i = 0; i < 3; i++) {
      insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, {
        supplier: `S${i}`,
        visit_date: '2026-09-01',
        status: '计划',
      })
    }
    const page = listRecords(db, SUPPLIER_VISITS_SPEC, 'visit', CWD_A, { page: 1, size: 2 })
    assert.equal(page.rows.length, 2)
    assert.equal(page.total, 3)
    db.close()
  })
})
