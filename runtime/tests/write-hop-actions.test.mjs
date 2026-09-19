import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-hop-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate } = await import(pathToFileURL(join(staged, 'write.js')).href)

const hopVocab = [
  {
    kind: 'ParentA',
    resource: 'parent_a',
    can: ['现查'],
    relations: [{ from: 'ParentA', to: 'ChildB', field: 'parentRef' }],
    clues: [{ say: ['expired'], keys: ['status'], values: ['expired'] }],
  },
  {
    kind: 'ChildB',
    resource: 'child_b',
    can: ['现查', '改行', '删除', '过审', '新建'],
    clues: [{ say: ['pending'], keys: ['status'], values: ['pending'] }],
  },
]

const speech = 'pending ChildB ∩ expired ParentA'
const parentRows = Array.from({ length: 5 }, (_, i) => {
  const id = `p${i + 1}`
  return { no: `PA-${i + 1}`, status: 'expired', fields: { id, status: 'expired', code: `PA-${i + 1}` } }
})
const childRows = [
  { no: 'CB-HIT', status: 'pending', fields: { id: 'c-hit', status: 'pending', parentRefId: 'p3', code: 'CB-HIT' } },
  { no: 'CB-OTHER', status: 'pending', fields: { id: 'c-other', status: 'pending', parentRefId: 'outside', code: 'CB-OTHER' } },
  { no: 'CB-DONE', status: 'done', fields: { id: 'c-done', status: 'done', parentRefId: 'p3', code: 'CB-DONE' } },
]

function termHit(row, term) {
  const keys = Array.isArray(term.keys) ? term.keys : []
  const values = (Array.isArray(term.values) ? term.values : []).map(String)
  if (!keys.length || !values.length) return true
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {}
  const hit = keys.some((key) => values.includes(String(fields[key] ?? row[key] ?? '')))
  return term.not ? !hit : hit
}

function applyWhere(rows, where) {
  if (!Array.isArray(where) || !where.length) return rows
  return rows.filter((row) => where.every((term) => termHit(row, term)))
}

function lookupTodo(spec) {
  const kind = String(spec.kind || '')
  let rows = kind === 'ParentA' ? parentRows : kind === 'ChildB' ? childRows : []
  const relatedIds = spec.related && Array.isArray(spec.related.ids) ? spec.related.ids.map(String) : []
  if (relatedIds.length) {
    const field = String(spec.related.field || 'parentRefId')
    const idSet = new Set(relatedIds)
    rows = rows.filter((row) => idSet.has(String(row.fields[field] || row.fields.id || '')))
  }
  rows = applyWhere(rows, spec.where)
  if (!rows.length) return { ok: false, error: 'NOT_FOUND', matches: [] }
  return {
    ok: true,
    matches: rows,
    no: rows[0].no,
    status: rows[0].status,
    fields: rows[0].fields,
  }
}

function gate() {
  return createGate({ vocab: hopVocab, lookupTodo })
}

function hopMeta(result) {
  const sheet = result && result.sheet && typeof result.sheet === 'object' ? result.sheet : result
  const fromRows = sheet && sheet.from && Array.isArray(sheet.from.rows) ? sheet.from.rows : []
  return {
    ok: result && result.ok !== false,
    error: result && result.error,
    kind: sheet && sheet.kind,
    rows: Array.isArray(sheet && sheet.rows) ? sheet.rows.length : 0,
    first: Array.isArray(sheet && sheet.rows) && sheet.rows[0] ? String(sheet.rows[0].no || '') : '',
    fromKind: sheet && sheet.from && sheet.from.kind,
    fromRows: fromRows.length,
    fromFirst: fromRows[0] ? String(fromRows[0].no || '') : '',
    hopWhere: Array.isArray(sheet && sheet.hopWhere) && sheet.hopWhere.length > 0,
    steps: Array.isArray(sheet && sheet.steps) ? sheet.steps.map((row) => row.kind) : [],
    ambiguous: Boolean(result && result.ambiguous),
    previewId: result && result.preview_id,
  }
}

test('write actions hop the relation-chain intersection instead of dumping parent rows', async () => {
  const writes = ['改行', '删除', '过审']
  for (const action of writes) {
    const body = {
      workspace: '/tmp/hop-ws',
      kind: 'ChildB',
      action,
      speech,
    }
    if (action === '改行') body.patch = { remark: 'hop' }
    const out = hopMeta(await gate().preview(body))
    assert.equal(out.kind, 'ChildB', action)
    assert.equal(out.rows, 1, action)
    assert.equal(out.first, 'CB-HIT', action)
    assert.equal(out.fromKind, 'ParentA', action)
    assert.equal(out.fromRows, 1, action)
    assert.equal(out.fromFirst, 'PA-3', action)
    assert.ok(out.fromRows < parentRows.length, action)
    assert.equal(out.hopWhere, true, action)
    assert.deepEqual(out.steps, ['ParentA', 'ChildB'], action)
    assert.equal(out.ambiguous, false, action)
    assert.ok(out.previewId, action)
    assert.notEqual(out.error, 'AMBIGUOUS', action)
  }
})

test('新建 keeps hop metadata on the same relation chain', async () => {
  const out = hopMeta(await gate().preview({
    workspace: '/tmp/hop-ws',
    kind: 'ChildB',
    action: '新建',
    speech,
  }))
  assert.equal(out.ok, true)
  assert.equal(out.fromKind, 'ParentA')
  assert.equal(out.hopWhere, true)
  assert.deepEqual(out.steps, ['ParentA', 'ChildB'])
})

test('现查 on the same speech still returns the intersection row', async () => {
  const out = hopMeta(await gate().preview({
    workspace: '/tmp/hop-ws',
    kind: 'ChildB',
    action: '现查',
    speech,
  }))
  assert.equal(out.kind, 'ChildB')
  assert.equal(out.rows, 1)
  assert.equal(out.first, 'CB-HIT')
  assert.equal(out.fromKind, 'ParentA')
  assert.equal(out.fromRows, 1)
  assert.equal(out.fromFirst, 'PA-3')
  assert.ok(out.fromRows < parentRows.length)
  assert.equal(out.hopWhere, true)
})

test('write uniqueness is on the intersection, not the parent half-table', async () => {
  const extraChild = {
    no: 'CB-HIT-2',
    status: 'pending',
    fields: { id: 'c-hit-2', status: 'pending', parentRefId: 'p1', code: 'CB-HIT-2' },
  }
  const lookup = (spec) => {
    const kind = String(spec.kind || '')
    let rows = kind === 'ParentA' ? parentRows : kind === 'ChildB' ? [...childRows, extraChild] : []
    const relatedIds = spec.related && Array.isArray(spec.related.ids) ? spec.related.ids.map(String) : []
    if (relatedIds.length) {
      const field = String(spec.related.field || 'parentRefId')
      const idSet = new Set(relatedIds)
      rows = rows.filter((row) => idSet.has(String(row.fields[field] || row.fields.id || '')))
    }
    rows = applyWhere(rows, spec.where)
    if (!rows.length) return { ok: false, error: 'NOT_FOUND', matches: [] }
    return { ok: true, matches: rows, no: rows[0].no, status: rows[0].status, fields: rows[0].fields }
  }
  const out = hopMeta(await createGate({ vocab: hopVocab, lookupTodo: lookup }).preview({
    workspace: '/tmp/hop-ws',
    kind: 'ChildB',
    action: '删除',
    speech,
  }))
  assert.equal(out.kind, 'ChildB')
  assert.ok(out.rows > 1)
  assert.notEqual(out.kind, 'ParentA')
  assert.ok(out.rows < parentRows.length)
  assert.equal(out.fromKind, 'ParentA')
  assert.ok(out.fromRows >= 1)
  assert.ok(out.fromRows < parentRows.length)
  assert.equal(out.hopWhere, true)
})
