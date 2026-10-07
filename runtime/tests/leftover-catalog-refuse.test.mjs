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
const {
  collapseKindsToConnectedTables,
  connectorCatalogPresent,
  registeredKinds,
  kindPreviewableInCatalog,
} = await import(pathToFileURL(join(staged, 'lookup.js')).href)
const { describeKindCatalog } = await import(pathToFileURL(join(staged, 'catalog.js')).href)

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

test('hop parent missing from the graph catalog is refused', async () => {
  const out = await gate().preview({
    workspace: '/tmp/leftover-ws',
    kind: 'AlphaWidget',
    action: '现查',
    speech: 'AlphaWidget',
    replay: true,
    steps: [{ kind: 'GhostKind' }, { kind: 'AlphaWidget' }],
  })
  assert.equal(out.ok, false)
  assert.equal(out.error, 'NO_CONNECTOR')
  assert.match(String(out.hint || ''), /没连业务/)
})

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
    kind: 'AlphaWidget',
    action: '现查',
    speech,
    from: { kind: 'AlphaGadget', where: [{ keys: ['status'], values: ['expired'] }] },
    where: [{ keys: ['status'], values: ['pending'] }],
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

test('non-stem graph kind is not a preview target; spoken alias binds the connected table', async () => {
  const g = createGate({
    vocab: [
      {
        kind: 'AlphaWidget',
        resource: 'alpha_widget',
        catalogVersion: 'schema:1',
        can: ['现查', '过审'],
        aliases: ['GraphSay'],
        clues: [{ role: '型', say: ['GraphSay'] }],
      },
      { kind: 'GraphSay', resource: 'graph:orphan', can: ['现查', '过审'] },
    ],
    lookupTodo,
    collectionsOf: async () => collections,
  })
  const out = await g.preview({
    workspace: '/tmp/leftover-ws',
    kind: 'GraphSay',
    action: '现查',
  })
  assert.notEqual(out.error, 'NO_CONNECTOR')
  const sheet = out.sheet && typeof out.sheet === 'object' ? out.sheet : out
  assert.equal(sheet.kind, 'AlphaWidget')
})

test('collapseKindsToConnectedTables drops graph-only rows and folds aliases', () => {
  const raw = [
    {
      kind: 'AlphaWidget',
      resource: 'alpha_widget',
      catalogVersion: 'schema:1',
      can: ['现查'],
      aliases: ['GraphSay'],
      clues: [{ role: '型', say: ['OralSay'] }],
    },
    { kind: 'GraphSay', resource: 'graph:orphan', can: ['现查'] },
    { kind: 'GraphOnly', can: ['现查', '过审'] },
  ]
  const { kinds, aliases } = collapseKindsToConnectedTables(raw)
  assert.equal(kinds.length, 1)
  assert.equal(kinds[0].kind, 'AlphaWidget')
  assert.ok(kinds[0].aliases.includes('GraphSay'))
  assert.ok(kinds[0].aliases.includes('OralSay'))
  assert.equal(aliases.GraphSay, 'AlphaWidget')
  assert.equal(aliases.OralSay, 'AlphaWidget')
})

test('connectorCatalogPresent ignores graph vocab without collection stems', () => {
  assert.equal(
    connectorCatalogPresent({ vocab: [{ kind: 'GraphOnly', can: ['现查'] }], kinds: [{ kind: 'GraphOnly' }] }),
    false,
  )
  assert.equal(
    connectorCatalogPresent({ collections: [{ name: 'alpha_widget', title: 'AlphaWidget' }] }),
    true,
  )
})

test('registeredKinds omits non-previewable leftover when live collections exist', () => {
  const bag = {
    vocab: leftoverVocab,
    collections,
  }
  const names = registeredKinds(bag)
  assert.ok(names.includes('AlphaWidget'))
  assert.ok(!names.includes('Widget'))
  assert.ok(kindPreviewableInCatalog('Widget', bag) === false)
})

test('registeredKinds omits graph-only kinds without collection stems even when catalog is absent', () => {
  const bag = {
    vocab: [
      { kind: 'AlphaWidget', resource: 'alpha_widget', can: ['现查'] },
      { kind: 'GraphOnly', can: ['现查', '过审'] },
    ],
  }
  const names = registeredKinds(bag)
  assert.ok(names.includes('AlphaWidget'))
  assert.ok(!names.includes('GraphOnly'))
})

test('graph-only kind preview refuses without live collections', async () => {
  const g = createGate({
    vocab: [
      { kind: 'AlphaWidget', resource: 'alpha_widget', can: ['现查'] },
      { kind: 'GraphOnly', can: ['现查'] },
    ],
    lookupTodo,
  })
  const out = await g.preview({
    workspace: '/tmp/leftover-ws',
    kind: 'GraphOnly',
    action: '现查',
  })
  assert.equal(out.ok, false)
  assert.equal(out.error, 'NO_CONNECTOR')
})

test('describeKindCatalog lists only connector-backed kinds', () => {
  const out = describeKindCatalog(
    [
      { kind: 'AlphaWidget', resource: 'alpha_widget', catalogVersion: 'schema:1', can: ['现查'] },
      { kind: 'GraphOnly', can: ['现查'] },
    ],
    { collections },
  )
  assert.equal(out.kinds.length, 1)
  assert.equal(out.kinds[0].kind, 'AlphaWidget')
})

test('describeKindCatalog attaches status enums for 过审 kinds', () => {
  const out = describeKindCatalog(
    [
      { kind: '请假申请', resource: 'biz_leave', catalogVersion: 'schema:1', can: ['现查', '过审'] },
      { kind: '员工档案', resource: 'biz_staff', catalogVersion: 'schema:1', can: ['现查'] },
    ],
    {
      collections: [
        {
          name: 'biz_leave',
          title: '请假申请',
          fields: [
            { name: 'status', title: '审批状态', enums: { pending: '待审', approved: '已通过' } },
          ],
        },
        { name: 'biz_staff', title: '员工档案', fields: [{ name: 'name', title: '姓名' }] },
      ],
    },
  )
  const leave = out.kinds.find((row) => row.kind === '请假申请')
  const staff = out.kinds.find((row) => row.kind === '员工档案')
  assert.deepEqual(leave.status, { field: 'status', enums: { pending: '待审', approved: '已通过' } })
  assert.equal(staff.status, undefined)
})

test('describeKindCatalog merges live columns including date slots', () => {
  const out = describeKindCatalog(
    [
      {
        kind: '工单',
        resource: 'biz_tickets',
        ticketField: 'ticketNo',
        fields: ['ticketNo', '单号', '状态'],
        can: ['现查'],
        catalogVersion: 'schema:1',
      },
    ],
    {
      collections: [
        {
          name: 'biz_tickets',
          title: '工单',
          fields: [
            { name: 'id', title: 'ID', interface: 'snowflakeId' },
            { name: 'createdAt', title: '创建时间', interface: 'datetime' },
            { name: 'ticketNo', title: '单号', interface: 'input' },
            { name: 'status', title: '状态', interface: 'select', enums: { open: '打开' } },
            { name: 'openedAt', title: '发生日期', interface: 'date' },
            { name: 'dueAt', title: '截止日', interface: 'date' },
            { name: 'customerId', title: '客户', interface: 'bigInt' },
          ],
        },
      ],
    },
  )
  const kind = out.kinds.find((row) => row.kind === '工单')
  assert.ok(kind.columns)
  const byName = Object.fromEntries(kind.columns.map((col) => [col.name, col]))
  assert.equal(byName.openedAt.slot, 'date')
  assert.equal(byName.openedAt.title, '发生日期')
  assert.equal(byName.dueAt.slot, 'date')
  assert.equal(byName.ticketNo.slot, 'identity')
  assert.equal(byName.status.slot, 'enum')
  assert.equal(byName.id, undefined)
  assert.equal(byName.createdAt, undefined)
  assert.equal(byName.customerId, undefined)
  assert.ok(kind.fields.includes('openedAt'))
  assert.ok(kind.fields.includes('发生日期'))
  assert.ok(kind.fields.includes('ticketNo'))
})
