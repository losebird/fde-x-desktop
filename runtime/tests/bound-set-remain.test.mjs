import './support/no-stray-processes.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createGate as createOpening } from '../plugins/dsh-lan-assist/gate.js'
import { createGate as createWriteGate } from '../plugins/dsh-lan-assist/write.js'

const NOS = [
  'EXP20251227415',
  'EXP20260629627',
  'EXP20250805461',
  'EXP20240226276',
]
const KEPT = 'EXP-KEEP'

const vocab = [{
  kind: '客户',
  resource: 'customers',
  can: ['现查', '改行', '过审'],
  fields: ['code', 'name', 'status'],
}]
const schema = [
  { name: 'id', interface: 'snowflakeId', title: '主键' },
  { name: 'code', interface: 'input', title: '客户编号' },
  { name: 'name', interface: 'input', title: '客户名称' },
  {
    name: 'status',
    interface: 'select',
    title: '客户状态',
    enums: { inactive: '暂停合作', active: '成交客户' },
  },
]

test('a successful bound set drops every written no from the sheet and names them all', async () => {
  const live = Object.fromEntries(NOS.map((no, index) => [no, {
    no,
    fields: { id: String(index + 1), code: no, name: no, status: 'inactive' },
  }]))
  const posted = []
  const writeGate = createWriteGate({
    vocab,
    collectionsOf: async () => [{ name: 'customers', title: '客户', fields: schema }],
    fieldsOf: async () => schema,
    lookupTodo: async (spec) => {
      const wanted = String((spec && spec.no) || '').trim()
      if (wanted) {
        const row = live[wanted]
        if (!row) return { ok: false, error: 'NOT_FOUND', matches: [] }
        return {
          ok: true,
          no: row.no,
          status: row.fields.status,
          fields: { ...row.fields },
          matches: [{ no: row.no, status: row.fields.status, fields: { ...row.fields } }],
        }
      }
      const where = Array.isArray(spec && spec.where) ? spec.where : []
      let matches = Object.values(live).map((row) => ({
        no: row.no,
        status: row.fields.status,
        fields: { ...row.fields },
      }))
      if (where.length) {
        matches = matches.filter((row) => where.every((term) => {
          const keys = Array.isArray(term.keys) ? term.keys : []
          const values = (Array.isArray(term.values) ? term.values : []).map(String)
          if (!keys.length || !values.length) return true
          return keys.some((key) => values.includes(String(row.fields[key] ?? row[key] ?? '')))
        }))
      }
      if (!matches.length) return { ok: false, error: 'NOT_FOUND', matches: [] }
      return {
        ok: true,
        matches,
        hitTotal: matches.length,
        hitTotalState: 'known',
        no: matches.length === 1 ? matches[0].no : '',
        status: matches[0].status,
        fields: matches.length === 1 ? matches[0].fields : {},
      }
    },
    postWrite: async (spec) => {
      const no = String(spec.no || '')
      posted.push(no)
      const row = live[no]
      if (row) row.fields.status = 'active'
      return { ok: true, receiptId: `rcpt-${no}` }
    },
  })
  const previewed = await writeGate.preview({
    workspace: '/tmp/bound-set-remain',
    kind: '客户',
    action: '改行',
    batch: true,
    where: [{ keys: ['status'], values: ['inactive'] }],
    patch: { status: 'active' },
    speech: '把这四张停用客户改成成交。',
  })
  const previewId = String(previewed.preview_id || previewed.sheet?.preview_id || '')
  assert.ok(previewId, previewed.hint || previewed.error)
  const sheetRows = previewed.sheet?.rows || []
  assert.deepEqual(sheetRows.map((row) => row.no), NOS)

  const shown = [
    ...sheetRows,
    { no: KEPT, status: 'inactive', fields: { code: KEPT, status: 'inactive' } },
  ]
  const state = {
    pendingWrite: {
      openingId: 'open-bound',
      preview_id: previewId,
      kind: '客户',
      action: '改行',
      patch: { status: 'active' },
      sessionId: 'sess-bound',
      lines: [{
        preview_id: previewId,
        kind: '客户',
        action: '改行',
        patch: { status: 'active' },
        no: '',
      }],
    },
    pendingSheet: {
      kind: '客户',
      rows: shown,
      remainRows: shown,
      preview_id: previewId,
      canWrite: true,
    },
  }
  const opening = createOpening({
    store: {
      async get() { return state },
      async update(fn) { await fn(state) },
    },
    now: () => 1_700_000_000_000,
    snapshot: async () => ({}),
    note() {},
    opts: { gate: writeGate },
    catalogOf: () => [],
    reopenReplyDraft: async () => false,
    hearBusinessEvent: async () => {},
    rememberFocus() {},
  })
  const written = await opening.commitWrite({
    preview_id: previewId,
    source: 'workstation',
    sessionId: 'sess-bound',
    workspace: '/tmp/bound-set-remain',
  })
  assert.equal(written.ok, true, written.hint || written.speak || written.error)
  assert.deepEqual(posted, NOS)
  const left = (state.pendingSheet && state.pendingSheet.rows) || []
  assert.deepEqual(left.map((row) => row.no), [KEPT])
  for (const no of NOS) {
    assert.equal(left.some((row) => row.no === no), false, no)
    assert.match(written.speak, new RegExp(no))
    assert.match(String(written.lines?.[0]?.speak || ''), new RegExp(no))
  }
  assert.match(written.speak, /已写 4 张/)
  assert.match(String(written.lines?.[0]?.speak || ''), /已写 4 张/)
})
