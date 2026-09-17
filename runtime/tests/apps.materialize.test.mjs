import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, execControlledDdl } from '../db.mjs'
import { applyMaterialize, planMaterializeDdl } from '../apps/materialize.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import { detectBreakingSpecChange } from '../apps/spec.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

describe('apps materialize', () => {
  test('creates app table', () => {
    const db = openDatabase(`/tmp/fde-apps-mat-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    applyMaterialize(db, SUPPLIER_VISITS_SPEC)
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE name = 'app_supplier-visits__visit'",
    ).get()
    assert.ok(row)
    db.close()
  })

  test('adds column on revision', () => {
    const db = openDatabase(`/tmp/fde-apps-mat2-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    applyMaterialize(db, SUPPLIER_VISITS_SPEC)
    const next = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    next.entities[0].fields.push({ name: 'phone', type: 'text', label: '电话' })
    const { ddl } = planMaterializeDdl(next, db, SUPPLIER_VISITS_SPEC)
    assert.ok(ddl.some((s) => s.includes('ADD COLUMN')))
    applyMaterialize(db, next, SUPPLIER_VISITS_SPEC)
    const info = db.prepare('PRAGMA table_info("app_supplier-visits__visit")').all()
    assert.ok(info.some((c) => c.name === 'phone'))
    db.close()
  })

  test('rejects breaking field removal', () => {
    const db = openDatabase(`/tmp/fde-apps-mat3-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    applyMaterialize(db, SUPPLIER_VISITS_SPEC)
    const next = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    next.entities[0].fields = next.entities[0].fields.filter((f) => f.name !== 'summary')
    assert.throws(() => planMaterializeDdl(next, db, SUPPLIER_VISITS_SPEC), (err) => err.code === 'breaking_change')
    db.close()
  })

  test('ddl whitelist rejects DROP', () => {
    const db = openDatabase(`/tmp/fde-apps-mat4-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    assert.throws(() => execControlledDdl(db, 'DROP TABLE app_x__y'))
    db.close()
  })

  test('detectBreakingSpecChange lists removed field', () => {
    const next = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    next.entities[0].fields = next.entities[0].fields.filter((f) => f.name !== 'summary')
    const breaking = detectBreakingSpecChange(SUPPLIER_VISITS_SPEC, next)
    assert.ok(breaking.length > 0)
  })
})
