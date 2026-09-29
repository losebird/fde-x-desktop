import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-slot-plan-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate } = await import(pathToFileURL(join(staged, 'write.js')).href)

const vocab = [
  {
    kind: '客户',
    resource: 'biz_customers',
    can: ['现查', '改行'],
    relations: [{ from: '客户', to: '销售合同', field: 'customer' }],
  },
  {
    kind: '销售合同',
    resource: 'biz_contracts',
    can: ['现查'],
    relations: [
      { from: '客户', to: '销售合同', field: 'customer' },
      { from: '销售合同', to: '销售回款', field: 'contract' },
    ],
  },
  {
    kind: '销售回款',
    resource: 'biz_payments',
    can: ['现查', '改行', '删除', '过审'],
    relations: [
      { from: '销售合同', to: '销售回款', field: 'contract' },
      { from: '客户', to: '销售回款', field: 'customer' },
    ],
  },
  { kind: '孤立甲', resource: 'lone_a', can: ['现查', '改行'] },
  { kind: '孤立乙', resource: 'lone_b', can: ['现查', '改行'] },
]

const schemaByKind = {
  客户: [{ name: 'name', title: '客户名称', interface: 'input' }],
  销售合同: [{
    name: 'status',
    title: '合同状态',
    interface: 'select',
    enums: { expired: '已到期', signed: '已签订' },
  }],
  销售回款: [
    { name: 'status', title: '回款状态', interface: 'select', enums: { pending: '待确认', confirmed: '已确认' } },
    { name: 'remarks', title: '备注', interface: 'input' },
  ],
}

const customers = [
  { no: 'CUST-JIA', fields: { id: 'c1', name: '甲乙丙工业有限公司' } },
]
const contracts = [
  { no: 'HT-EXP', status: 'expired', fields: { id: 'ht1', status: 'expired', customerId: 'c1' } },
  { no: 'HT-OK', status: 'signed', fields: { id: 'ht2', status: 'signed', customerId: 'c1' } },
]
const payments = [
  { no: 'PAY-EXP-1', status: 'pending', fields: { id: 'p1', status: 'pending', contractId: 'ht1', customerId: 'c1', remarks: null } },
  { no: 'PAY-EXP-2', status: 'pending', fields: { id: 'p2', status: 'pending', contractId: 'ht1', customerId: 'c1', remarks: null } },
  { no: 'PAY-OK', status: 'pending', fields: { id: 'p3', status: 'pending', contractId: 'ht2', customerId: 'c1', remarks: null } },
  { no: 'PAY-DONE', status: 'confirmed', fields: { id: 'p4', status: 'confirmed', contractId: 'ht1', customerId: 'c1', remarks: null } },
]

function termHit(row, term) {
  const keys = Array.isArray(term.keys) ? term.keys : []
  const values = (Array.isArray(term.values) ? term.values : []).map(String)
  if (!keys.length || !values.length) return true
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {}
  const contains = term.text === true || term.textPass === 'contains'
  const hit = keys.some((key) => {
    const text = String(fields[key] ?? row[key] ?? '')
    return contains
      ? values.some((value) => text.includes(value))
      : values.includes(text)
  })
  return term.not ? !hit : hit
}

function applyWhere(rows, where) {
  if (!Array.isArray(where) || !where.length) return rows
  return rows.filter((row) => where.every((term) => termHit(row, term)))
}

function lookupTodo(spec) {
  const kind = String(spec.kind || '')
  let rows = kind === '客户' ? customers.slice()
    : kind === '销售合同' ? contracts.slice()
      : kind === '销售回款' ? payments.slice()
        : []
  const relatedIds = spec.related && Array.isArray(spec.related.ids) ? spec.related.ids.map(String) : []
  if (relatedIds.length) {
    const field = String(spec.related.field || '')
    const idSet = new Set(relatedIds)
    rows = rows.filter((row) => {
      const fields = row.fields || {}
      const fk = field.endsWith('Id') ? field : (field ? `${field}Id` : '')
      return idSet.has(String(fields[fk] || fields[field] || fields.id || ''))
    })
  }
  rows = applyWhere(rows, spec.where)
  if (!rows.length) return { ok: false, error: 'NOT_FOUND', matches: [], hitTotal: 0, hitTotalState: 'known' }
  return {
    ok: true,
    matches: rows,
    no: rows.length === 1 ? rows[0].no : '',
    status: rows[0].status,
    fields: rows.length === 1 ? rows[0].fields : {},
    hitTotal: rows.length,
    hitTotalState: 'known',
  }
}

function gate() {
  return createGate({
    vocab,
    lookupTodo,
    async fieldsOf(kind) { return schemaByKind[kind] || [] },
    async collectionsOf() {
      return [
        {
          name: 'biz_customers',
          title: '客户',
          fields: schemaByKind.客户.concat([{ name: 'id' }]),
        },
        {
          name: 'biz_contracts',
          title: '销售合同',
          fields: schemaByKind.销售合同.concat([
            { name: 'id' },
            { name: 'customerId' },
            { name: 'customer', interface: 'm2o', target: 'biz_customers', foreignKey: 'customerId' },
          ]),
        },
        {
          name: 'biz_payments',
          title: '销售回款',
          fields: schemaByKind.销售回款.concat([
            { name: 'id' },
            { name: 'customerId' },
            { name: 'contractId' },
            { name: 'contract', interface: 'm2o', target: 'biz_contracts', foreignKey: 'contractId' },
            { name: 'customer', interface: 'm2o', target: 'biz_customers', foreignKey: 'customerId' },
          ]),
        },
        { name: 'lone_a', title: '孤立甲', fields: [{ name: 'id' }, { name: 'name' }] },
        { name: 'lone_b', title: '孤立乙', fields: [{ name: 'id' }, { name: 'name' }] },
      ]
    },
  })
}

function sheetOf(result) {
  return result && result.sheet && typeof result.sheet === 'object' ? result.sheet : result
}

const speech = '甲乙丙到期合同下还有哪些待审回款？把备注改成催收。'

function hopSlots() {
  return {
    from: {
      kind: '客户',
      where: [{ keys: ['name'], values: ['甲乙丙'], text: true, textPass: 'contains' }],
    },
    steps: [
      {
        kind: '客户',
        where: [{ keys: ['name'], values: ['甲乙丙'], text: true, textPass: 'contains' }],
      },
      { kind: '销售合同', from: '客户', where: [{ keys: ['status'], values: ['expired'] }] },
      { kind: '销售回款', from: '销售合同', where: [{ keys: ['status'], values: ['pending'] }] },
    ],
    where: [{ keys: ['status'], values: ['pending'] }],
    patch: { remarks: '催收' },
  }
}

test('tool hop slots preview the intersection and mint a write token', async () => {
  const listed = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '改行',
    speech,
    ...hopSlots(),
  })
  const listedSheet = sheetOf(listed)
  const listedNos = (Array.isArray(listedSheet.rows) ? listedSheet.rows : []).map((row) => row.no).sort()
  assert.equal(listed.ok, true)
  assert.equal(listedSheet.kind, '销售回款')
  assert.equal(listedSheet.action, '改行')
  assert.deepEqual(listedNos, ['PAY-EXP-1', 'PAY-EXP-2'])
  assert.equal(String(listed.preview_id || listedSheet.preview_id || '').startsWith('pv_'), false)
  const stepKinds = Array.isArray(listedSheet.steps) ? listedSheet.steps.map((row) => row.kind) : []
  assert.ok(stepKinds.includes('客户'))
  assert.ok(stepKinds.includes('销售合同'))

  const batched = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '改行',
    speech,
    batch: true,
    ...hopSlots(),
  })
  const batchedSheet = sheetOf(batched)
  const batchedNos = (Array.isArray(batchedSheet.rows) ? batchedSheet.rows : []).map((row) => row.no).sort()
  assert.equal(batched.ok, true)
  assert.deepEqual(batchedNos, ['PAY-EXP-1', 'PAY-EXP-2'])
  assert.equal(batchedSheet.listed, false)
  assert.equal(batchedSheet.batch, true)
  assert.ok(String(batched.preview_id || batchedSheet.preview_id || '').startsWith('pv_'))

  const first = (Array.isArray(batchedSheet.rows) ? batchedSheet.rows : [])[0]
  const picked = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '改行',
    speech,
    picked: true,
    no: first && first.no,
    lookup: first && first.lookup,
    ...hopSlots(),
  })
  const pickedSheet = sheetOf(picked)
  const pickedRows = Array.isArray(pickedSheet.rows) ? pickedSheet.rows : []
  assert.equal(picked.ok, true)
  assert.ok(String(picked.preview_id || pickedSheet.preview_id || '').startsWith('pv_'))
  assert.equal(pickedRows.length, 1)
  assert.equal(pickedRows[0].no, first.no)
  assert.equal(pickedSheet.picked, true)
})

test('write without no/where/from identity is 缺身份 and mints no token', async () => {
  const result = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '改行',
    speech,
    patch: { remarks: '催收' },
  })
  assert.equal(result.ok, false)
  assert.equal(result.error, 'NO_IDENTITY')
  assert.equal(String(result.hint || result.speak || '').includes('缺身份'), true)
  assert.equal(result.preview_id, undefined)
})

test('glued enum in the name slot stays in the slot and misses', async () => {
  const result = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '改行',
    speech,
    from: {
      kind: '客户',
      where: [{ keys: ['name'], values: ['甲乙丙到期'], text: true, textPass: 'contains' }],
    },
    patch: { remarks: '催收' },
  })
  const sheet = sheetOf(result)
  const speak = String(sheet.speak || result.hint || result.speak || '')
  assert.equal(result.ok, false)
  assert.equal(String(result.error || sheet.error || ''), 'NOT_FOUND')
  assert.equal(speak.includes('甲乙丙到期'), true)
  const fromWhere = sheet.from && Array.isArray(sheet.from.where) ? sheet.from.where : []
  const nameVals = fromWhere.flatMap((term) => term.values || [])
  assert.equal(nameVals.includes('甲乙丙到期'), true)
  assert.equal(String(result.preview_id || sheet.preview_id || '').startsWith('pv_'), false)
})

test('speech naming a contract does not insert a contract hop the slots omitted', async () => {
  const result = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '现查',
    speech,
    from: {
      kind: '客户',
      where: [{ keys: ['name'], values: ['甲乙丙'], text: true, textPass: 'contains' }],
    },
    where: [{ keys: ['status'], values: ['pending'] }],
  })
  const sheet = sheetOf(result)
  const nos = (Array.isArray(sheet.rows) ? sheet.rows : []).map((row) => row.no).sort()
  assert.equal(sheet.action, '现查')
  assert.deepEqual(nos, ['PAY-EXP-1', 'PAY-EXP-2', 'PAY-OK'])
  const stepKinds = Array.isArray(sheet.steps) ? sheet.steps.map((row) => row.kind) : []
  assert.equal(stepKinds.includes('销售合同'), false)
  assert.equal(sheet.from && sheet.from.kind, '客户')
})

test('oral enum in a where value maps to the unique field code', async () => {
  const seen = []
  const g = createGate({
    vocab,
    lookupTodo(spec) {
      seen.push(spec)
      return lookupTodo(spec)
    },
    async fieldsOf(kind) { return schemaByKind[kind] || [] },
    async collectionsOf() {
      return [{
        name: 'biz_payments',
        title: '销售回款',
        fields: schemaByKind.销售回款.concat([{ name: 'id' }]),
      }]
    },
  })
  await g.preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '现查',
    speech: '待审回款',
    where: [{ keys: ['status'], values: ['待审'] }],
  })
  const pay = seen.find((spec) => String(spec.kind || '') === '销售回款')
  const vals = (Array.isArray(pay && pay.where) ? pay.where : []).flatMap((term) => term.values || [])
  assert.equal(vals.includes('pending'), true)
})

test('where key missing from the collection is 列对不上', async () => {
  const result = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '现查',
    speech: '按色号查回款',
    where: [{ keys: ['色号'], values: ['红'] }],
  })
  const sheet = sheetOf(result)
  const speak = String(sheet.speak || result.hint || result.speak || '')
  assert.equal(result.error === 'WHERE_UNBOUND' || sheet.error === 'WHERE_UNBOUND' || speak.includes('对不上'), true)
})

test('mixed unbound column with a bound enum stops the whole utterance', async () => {
  const result = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '现查',
    speech: '按色号查待审回款',
    where: [
      { keys: ['色号'], values: ['红'] },
      { keys: ['status'], values: ['待审'] },
    ],
  })
  assert.equal(result.error, 'WHERE_UNBOUND')
  const sheet = sheetOf(result)
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  assert.equal(rows.length, 0)
})

test('parent name on the child relation where key is 对不上', async () => {
  const result = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '现查',
    speech: '东莞联创的待审回款',
    where: [
      { keys: ['customer', '客户'], values: ['甲乙丙'] },
      { keys: ['status'], values: ['pending'] },
    ],
  })
  assert.equal(result.error, 'WHERE_UNBOUND')
  const sheet = sheetOf(result)
  const nos = (Array.isArray(sheet.rows) ? sheet.rows : []).map((row) => row.no)
  assert.equal(nos.includes('PAY-OK'), false)
})

test('batch write without from/steps does not copy official hop', async () => {
  const listed = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '现查',
    speech,
    ...hopSlots(),
  })
  const official = sheetOf(listed)
  assert.equal(listed.ok, true)
  const batched = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '改行',
    batch: true,
    patch: { remarks: '催收' },
    speech: '都改一下',
    officialSheet: official,
  })
  assert.equal(batched.ok, false)
  assert.equal(batched.error, 'NO_IDENTITY')
  assert.equal(String(batched.preview_id || '').startsWith('pv_'), false)
})

test('from with no graph edge is 缺关系', async () => {
  const result = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '孤立乙',
    action: '改行',
    speech: '孤立甲下面的孤立乙',
    from: { kind: '孤立甲', where: [{ keys: ['name'], values: ['甲'] }] },
    patch: { remarks: 'x' },
  })
  assert.equal(result.ok, false)
  assert.equal(result.error, 'NO_RELATION')
  assert.equal(String(result.hint || '').includes('缺关系'), true)
})

test('action 现查 stays 现查 when speech asks to rewrite', async () => {
  const result = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '现查',
    speech: '把备注改成催收。',
    where: [{ keys: ['status'], values: ['pending'] }],
  })
  const sheet = sheetOf(result)
  assert.equal(sheet.action, '现查')
  assert.equal(String(result.preview_id || sheet.preview_id || '').startsWith('pv_'), false)
})

test('unfiltered 现查 lists a page with a known total', async () => {
  const result = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '现查',
    speech: '看看回款',
  })
  const sheet = sheetOf(result)
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  assert.equal(sheet.action, '现查')
  assert.equal(rows.length, 4)
  assert.equal(sheet.querySettled, true)
  assert.equal(sheet.hitTotalState, 'known')
  assert.equal(sheet.hitTotal, 4)
})

test('name contains 0 / 1 / n', async () => {
  const miss = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '客户',
    action: '现查',
    speech: '查丁戊己',
    where: [{ keys: ['name'], values: ['丁戊己'], text: true, textPass: 'contains' }],
  })
  const missSheet = sheetOf(miss)
  assert.equal(Array.isArray(missSheet.rows) ? missSheet.rows.length : 0, 0)
  assert.equal(missSheet.querySettled === true || miss.ok === false, true)

  const one = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '客户',
    action: '现查',
    speech: '查甲乙丙',
    where: [{ keys: ['name'], values: ['甲乙丙'], text: true, textPass: 'contains' }],
  })
  const oneSheet = sheetOf(one)
  const oneRows = Array.isArray(oneSheet.rows) ? oneSheet.rows : []
  assert.equal(oneRows.length, 1)
  assert.equal(oneRows[0].no, 'CUST-JIA')

  const manyPays = await gate().preview({
    workspace: '/tmp/slot-plan-ws',
    kind: '销售回款',
    action: '改行',
    speech: '待审回款改催收',
    where: [{ keys: ['status'], values: ['pending'] }],
    patch: { remarks: '催收' },
  })
  const manySheet = sheetOf(manyPays)
  const manyRows = Array.isArray(manySheet.rows) ? manySheet.rows : []
  assert.equal(manyRows.length > 1, true)
  assert.equal(String(manyPays.preview_id || manySheet.preview_id || '').startsWith('pv_'), false)
})
