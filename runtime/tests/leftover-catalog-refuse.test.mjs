import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-leftover-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate } = await import(pathToFileURL(join(staged, 'write.js')).href)

const leftoverVocab = [
  {
    kind: 'AlphaWidget',
    resource: 'alpha_widget',
    can: ['现查', '改行'],
    relations: [{ from: 'AlphaGadget', to: 'AlphaWidget', field: 'gadgetRef' }],
    clues: [{ say: ['pending'], keys: ['status'], values: ['pending'] }],
  },
  { kind: 'Widget', resource: 'widget', can: ['现查', '改行'] },
  {
    kind: 'AlphaGadget',
    resource: 'alpha_gadget',
    can: ['现查'],
    aliases: ['gad'],
    clues: [{ say: ['expired'], keys: ['status'], values: ['expired'] }],
  },
  { kind: 'Gadget', resource: 'gadget', can: ['现查'] },
]

const collections = [
  { name: 'alpha_widget', title: 'AlphaWidget' },
  { name: 'alpha_gadget', title: 'AlphaGadget' },
]

const speech = 'pending Widget ∩ expired Gadget'
const gadgetRows = [
  { no: 'GAD-1', status: 'expired', fields: { id: 'g1', status: 'expired', code: 'GAD-1' } },
]
const widgetRows = [
  { no: 'WID-HIT', status: 'pending', fields: { id: 'w-hit', status: 'pending', gadgetRefId: 'g1', code: 'WID-HIT' } },
  { no: 'WID-OTHER', status: 'pending', fields: { id: 'w-other', status: 'pending', gadgetRefId: 'outside', code: 'WID-OTHER' } },
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
  let rows = kind === 'AlphaGadget' ? gadgetRows : kind === 'AlphaWidget' ? widgetRows : []
  const relatedIds = spec.related && Array.isArray(spec.related.ids) ? spec.related.ids.map(String) : []
  if (relatedIds.length) {
    const field = String(spec.related.field || 'gadgetRefId')
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
  return createGate({
    vocab: leftoverVocab,
    lookupTodo,
    collectionsOf: async () => collections,
  })
}

test('leftover kind not in connector catalog is refused as preview target', async () => {
  const out = await gate().preview({
    workspace: '/tmp/leftover-ws',
    kind: 'Widget',
    action: '现查',
  })
  assert.equal(out.ok, false)
  assert.equal(out.error, 'NO_CONNECTOR')
  assert.equal(out.kind, undefined)
  assert.equal(out.sheet, undefined)
  assert.match(String(out.hint || ''), /没连业务/)
})

test('spoken leftover still binds to connected vocab kind and hops', async () => {
  const out = await gate().preview({
    workspace: '/tmp/leftover-ws',
    kind: 'Widget',
    action: '现查',
    speech,
  })
  assert.notEqual(out.error, 'NO_CONNECTOR')
  const sheet = out.sheet && typeof out.sheet === 'object' ? out.sheet : out
  assert.equal(sheet.kind, 'AlphaWidget')
  assert.equal(Array.isArray(sheet.rows) ? sheet.rows.length : 0, 1)
  assert.equal(sheet.rows[0].no, 'WID-HIT')
  assert.equal(sheet.from && sheet.from.kind, 'AlphaGadget')
})

test('write of leftover kind not in catalog is refused', async () => {
  const g = gate()
  const preview = await g.preview({
    workspace: '/tmp/leftover-ws',
    kind: 'Widget',
    action: '改行',
    patch: { remark: 'x' },
  })
  assert.equal(preview.ok, false)
  assert.equal(preview.error, 'NO_CONNECTOR')
  const write = await g.write({ preview_id: preview.preview_id || 'pv_missing' })
  assert.equal(write.ok, false)
  assert.ok(write.error === 'NO_CONNECTOR' || write.error === 'NEED_PREVIEW')
})

test('empty-resource kind cannot preview when a connector catalog is present', async () => {
  const g = createGate({
    vocab: [
      { kind: 'AlphaWidget', resource: 'alpha_widget', catalogVersion: 'schema:1', can: ['现查'] },
      { kind: 'GraphOnly', can: ['现查', '过审'] },
    ],
    lookupTodo,
    collectionsOf: async () => collections,
  })
  const out = await g.preview({
    workspace: '/tmp/leftover-ws',
    kind: 'GraphOnly',
    action: '现查',
  })
  assert.equal(out.ok, false)
  assert.equal(out.error, 'NO_CONNECTOR')
})

test('型槽 spoken name previews the connected table', async () => {
  const g = createGate({
    vocab: [
      {
        kind: 'AlphaWidget',
        resource: 'alpha_widget',
        catalogVersion: 'schema:1',
        can: ['现查', '过审'],
        clues: [{ role: '型', say: ['OralSay'] }],
      },
    ],
    lookupTodo,
    collectionsOf: async () => collections,
  })
  const out = await g.preview({
    workspace: '/tmp/leftover-ws',
    kind: 'OralSay',
    action: '现查',
  })
  assert.notEqual(out.error, 'NO_CONNECTOR')
  const sheet = out.sheet && typeof out.sheet === 'object' ? out.sheet : out
  assert.equal(sheet.kind, 'AlphaWidget')
})

test('collection-title kind stays itself, not another table\'s spoken alias', async () => {
  const g = createGate({
    vocab: [
      {
        kind: 'LeaveKind',
        resource: 'biz_leave',
        catalogVersion: 'schema:1',
        can: ['现查'],
        clues: [{ role: '型', say: ['ApprovalSlip'] }],
      },
      { kind: 'TicketKind', can: ['现查'] },
    ],
    lookupTodo: (spec) => {
      const kind = String(spec.kind || '')
      if (kind === 'TicketKind') {
        return {
          ok: true,
          matches: [{ no: 'TK-1', fields: { id: 't1', code: 'TK-1' } }],
          no: 'TK-1',
          fields: { id: 't1', code: 'TK-1' },
        }
      }
      if (kind === 'LeaveKind') {
        return {
          ok: true,
          matches: [{ no: 'LV-1', fields: { id: 'l1', code: 'LV-1' } }],
          no: 'LV-1',
          fields: { id: 'l1', code: 'LV-1' },
        }
      }
      return { ok: false, error: 'NOT_FOUND', matches: [] }
    },
    collectionsOf: async () => [
      { name: 'biz_leave', title: 'LeaveKind' },
      { name: 'biz_tickets', title: 'TicketKind' },
    ],
  })
  const out = await g.preview({
    workspace: '/tmp/leftover-ws',
    kind: 'TicketKind',
    action: '现查',
    speech: 'list open TicketKind',
  })
  const sheet = out.sheet && typeof out.sheet === 'object' ? out.sheet : out
  assert.equal(sheet.kind, 'TicketKind')
  assert.notEqual(sheet.kind, 'LeaveKind')
})
