import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-verify-after-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate, patchApplied, WORKSTATION_CONFIRM_HINT } = await import(pathToFileURL(join(staged, 'write.js')).href)

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

function wantsInactive(spec) {
  const where = Array.isArray(spec && spec.where) ? spec.where : []
  return where.some((row) => Array.isArray(row && row.values) && row.values.includes('inactive'))
}

function gateWithRow(row, extra = {}) {
  const lookupCalls = []
  const g = createGate({
    vocab,
    collectionsOf: async () => [{ name: 'customers', title: '客户', fields: schema }],
    fieldsOf: async () => schema,
    lookupTodo: async (spec) => {
      lookupCalls.push({
        no: String((spec && spec.no) || ''),
        where: Array.isArray(spec && spec.where) ? spec.where : [],
      })
      if (typeof extra.lookupTodo === 'function') return extra.lookupTodo(spec, row)
      if (wantsInactive(spec) && row.fields.status !== 'inactive') {
        return { ok: false, error: 'NOT_FOUND', status: '没有', fields: {}, matches: [] }
      }
      const no = String((spec && spec.no) || '').trim()
      if (no && no !== row.no) {
        return { ok: false, error: 'NOT_FOUND', status: '没有', fields: {}, matches: [] }
      }
      const fields = { ...row.fields }
      return {
        ok: true,
        no: row.no,
        status: fields.status,
        fingerprint: `fp:${row.no}:${fields.status}`,
        fields,
        matches: [{ no: row.no, status: fields.status, fields }],
      }
    },
    postWrite: extra.postWrite || (async () => {
      row.fields.status = 'active'
      return { ok: true, receiptId: 'rcpt-1' }
    }),
  })
  g.lookupCalls = lookupCalls
  return g
}

async function mintWrite(g, row) {
  const previewed = await g.preview({
    workspace: '/tmp/verify-after-ws',
    kind: '客户',
    action: '改行',
    no: row.no,
    picked: true,
    patch: { status: 'active' },
    speech: '把停用客户改成成交。',
  })
  const previewId = String(previewed.preview_id || previewed.sheet?.preview_id || '')
  assert.ok(previewId, previewed.hint || previewed.error)
  const token = g.tokens.get(previewId)
  assert.ok(token)
  token.where = [{ keys: ['status'], values: ['inactive'] }]
  return { previewed, previewId, token }
}

test('write preview tells the model to confirm on the workstation', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row)
  const previewed = await g.preview({
    workspace: '/tmp/verify-after-ws',
    kind: '客户',
    action: '改行',
    no: row.no,
    picked: true,
    patch: { status: 'active' },
    speech: '把停用客户改成成交。',
  })
  assert.equal(previewed.confirm, 'workstation')
  assert.equal(previewed.hint, WORKSTATION_CONFIRM_HINT)
  assert.match(String(previewed.speak || ''), new RegExp(WORKSTATION_CONFIRM_HINT))
})

test('改行过账按身份回读，不带预览列表条件', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row)
  const { previewId } = await mintWrite(g, row)
  g.lookupCalls.length = 0
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(row.fields.status, 'active')
  assert.equal(written.ok, true, written.hint || written.speak || written.error)
  assert.equal(written.receiptId, 'rcpt-1')
  assert.equal(g.tokens.get(previewId).used, true)
  const afterPosts = g.lookupCalls.filter((call) => call.no === row.no)
  assert.ok(afterPosts.length >= 1)
  assert.ok(afterPosts.every((call) => !call.where.length))
})

test('口已收而身份回读对不上仍算已过账', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row, {
    lookupTodo: async (spec) => {
      const fields = { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' }
      const no = String((spec && spec.no) || '').trim()
      if (no && no !== row.no) return { ok: false, error: 'NOT_FOUND', fields: {}, matches: [] }
      return {
        ok: true,
        no: row.no,
        status: 'inactive',
        fingerprint: 'fp-stale',
        fields,
        matches: [{ no: row.no, status: 'inactive', fields }],
      }
    },
    postWrite: async () => ({ ok: true, receiptId: 'rcpt-posted' }),
  })
  const { previewId } = await mintWrite(g, row)
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, true, written.hint || written.error)
  assert.equal(written.receiptId, 'rcpt-posted')
  assert.equal(written.verified, false)
  assert.notEqual(written.error, 'WRITE_FAILED')
  assert.equal(g.tokens.get(previewId).used, true)
})

test('口没收时令牌可再用', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row, {
    postWrite: async () => ({ ok: false, failed: true, hint: '源拒了' }),
  })
  const { previewId } = await mintWrite(g, row)
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, false)
  assert.equal(g.tokens.get(previewId).used, false)
})

test('patchApplied accepts enum code or label on the same field', () => {
  const fieldsCode = { status: 'active' }
  const fieldsLabel = { status: '成交客户' }
  const fieldsObj = { status: { value: 'active', label: '成交客户' } }
  assert.equal(patchApplied({ status: 'active' }, fieldsCode, schema), true)
  assert.equal(patchApplied({ status: 'active' }, fieldsLabel, schema), true)
  assert.equal(patchApplied({ status: '成交客户' }, fieldsCode, schema), true)
  assert.equal(patchApplied({ status: 'active' }, fieldsObj, schema), true)
  assert.equal(patchApplied({ status: 'active' }, { status: 'inactive' }, schema), false)
})

test('posting lock refuses a second confirm', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row)
  const { previewId, token } = await mintWrite(g, row)
  token.posting = true
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, false)
  assert.equal(written.error, 'USED')
})

test('single-row reread after write looks up by identity', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row)
  const { previewId } = await mintWrite(g, row)
  g.lookupCalls.length = 0
  await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  const reread = g.lookupCalls.filter((call) => call.no === row.no)
  assert.ok(reread.length >= 1)
  assert.ok(reread.every((call) => !call.where.length))
})

test('preview snapshots fromFields even when the live row later omits the key', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row)
  const { token } = await mintWrite(g, row)
  assert.equal(scalarish(token.fromFields && token.fromFields.status), 'inactive')
})

function scalarish(value) {
  if (value == null || value === '') return ''
  if (typeof value !== 'object') return String(value)
  return String(value.value ?? value.code ?? value.name ?? value.label ?? '').trim()
}

test('row changed under the preview is stale', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row, {
    lookupTodo: async (spec) => {
      const fields = { id: '1', code: 'CUST-1', name: '甲', status: 'other' }
      return {
        ok: true,
        no: row.no,
        status: 'other',
        fingerprint: 'fp-other',
        fields,
        matches: [{ no: row.no, status: 'other', fields }],
      }
    },
    postWrite: async () => {
      throw new Error('must not post')
    },
  })
  const { previewId, token } = await mintWrite(g, row)
  token.fromFields = { status: 'inactive' }
  token.patch = { status: 'active' }
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, false)
  assert.equal(written.error, 'STALE')
})

test('enum code and label of the same from-value are not stale', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row, {
    lookupTodo: async () => {
      const fields = { id: '1', code: 'CUST-1', name: '甲', status: '暂停合作' }
      return {
        ok: true,
        no: row.no,
        status: '暂停合作',
        fingerprint: 'fp-label',
        fields,
        matches: [{ no: row.no, status: '暂停合作', fields }],
      }
    },
  })
  const { previewId } = await mintWrite(g, row)
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, true, written.hint || written.speak || written.error)
})

test('missing fromFields still stale when the live field moved', async () => {
  const row = {
    no: 'CUST-1',
    fields: { id: '1', code: 'CUST-1', name: '甲', status: 'inactive' },
  }
  const g = gateWithRow(row, {
    lookupTodo: async () => {
      const fields = { id: '1', code: 'CUST-1', name: '甲', status: 'other' }
      return {
        ok: true,
        no: row.no,
        status: 'other',
        fingerprint: 'fp-other',
        fields,
        matches: [{ no: row.no, status: 'other', fields }],
      }
    },
    postWrite: async () => {
      throw new Error('must not post')
    },
  })
  const { previewId, token } = await mintWrite(g, row)
  delete token.fromFields
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, false)
  assert.equal(written.error, 'STALE')
})

test('picked write of a row that moved under the preview is stale and keeps the token', async () => {
  const rows = {
    'CUST-1': { no: 'CUST-1', fields: { id: '1', code: 'CUST-1', status: 'inactive' } },
    'CUST-2': { no: 'CUST-2', fields: { id: '2', code: 'CUST-2', status: 'inactive' } },
  }
  const live = {
    'CUST-1': { ...rows['CUST-1'], fields: { ...rows['CUST-1'].fields } },
    'CUST-2': { ...rows['CUST-2'], fields: { ...rows['CUST-2'].fields, status: 'other' } },
  }
  const posted = []
  const g = createGate({
    vocab,
    collectionsOf: async () => [{ name: 'customers', title: '客户', fields: schema }],
    fieldsOf: async () => schema,
    lookupTodo: async (spec) => {
      const where = Array.isArray(spec && spec.where) ? spec.where : []
      const identityKeys = new Set(['id', 'code', 'no'])
      const identityTerm = where.find((term) => (
        Array.isArray(term.keys) && term.keys.some((key) => identityKeys.has(String(key)))
      ))
      if (identityTerm) {
        const keys = identityTerm.keys.map(String)
        const values = (Array.isArray(identityTerm.values) ? identityTerm.values : []).map(String)
        const row = Object.values(live).find((item) => {
          const fields = item.fields || {}
          return keys.some((key) => values.includes(String(fields[key] ?? item[key] ?? '')))
        })
        if (!row) return { ok: false, error: 'NOT_FOUND', matches: [] }
        return {
          ok: true,
          no: row.no,
          status: row.fields.status,
          fields: row.fields,
          matches: [{ no: row.no, status: row.fields.status, fields: row.fields }],
        }
      }
      const no = String((spec && spec.no) || '').trim()
      if (no && !where.length) {
        const row = live[no]
        if (!row) return { ok: false, error: 'NOT_FOUND', matches: [] }
        return {
          ok: true,
          no: row.no,
          status: row.fields.status,
          fields: row.fields,
          matches: [{ no: row.no, status: row.fields.status, fields: row.fields }],
        }
      }
      const matches = Object.values(rows).map((row) => ({
        no: row.no,
        status: row.fields.status,
        fields: { ...row.fields },
      }))
      return { ok: true, matches, hitTotal: matches.length, hitTotalState: 'known', fields: {}, no: '' }
    },
    postWrite: async (spec) => {
      posted.push(String(spec.no || ''))
      return { ok: true, receiptId: `rcpt-${spec.no}` }
    },
  })
  const listed = await g.preview({
    workspace: '/tmp/verify-after-ws',
    kind: '客户',
    action: '改行',
    batch: true,
    where: [{ keys: ['status'], values: ['inactive'] }],
    patch: { status: 'active' },
    speech: '把停用客户改成成交。',
  })
  const listedSheet = listed.sheet && typeof listed.sheet === 'object' ? listed.sheet : listed
  const listedRows = Array.isArray(listedSheet.rows) ? listedSheet.rows : []
  assert.equal(listed.ok, true)
  assert.equal(listedSheet.listed, false)
  assert.equal(listedSheet.batch, true)
  assert.ok(String(listed.preview_id || listedSheet.preview_id || '').startsWith('pv_'))
  const staleRow = listedRows.find((row) => row.no === 'CUST-2')
  const picked = await g.preview({
    workspace: '/tmp/verify-after-ws',
    kind: '客户',
    action: '改行',
    batch: true,
    where: [{ keys: ['status'], values: ['inactive'] }],
    patch: { status: 'active' },
    speech: '把停用客户改成成交。',
    picked: true,
    no: staleRow.no,
    lookup: staleRow.lookup,
  })
  const previewId = String(picked.preview_id || picked.sheet?.preview_id || '')
  assert.ok(previewId, picked.hint || picked.error)
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, false)
  assert.equal(written.error, 'STALE')
  assert.equal(posted.length, 0)
  assert.ok(g.tokens.get(previewId))
  assert.equal(g.tokens.get(previewId).used, false)
})

test('set token confirm is stale when bound membership moved', async () => {
  const live = {
    'CUST-1': { no: 'CUST-1', fields: { id: '1', code: 'CUST-1', status: 'inactive' } },
    'CUST-2': { no: 'CUST-2', fields: { id: '2', code: 'CUST-2', status: 'inactive' } },
  }
  const posted = []
  const g = createGate({
    vocab,
    collectionsOf: async () => [{ name: 'customers', title: '客户', fields: schema }],
    fieldsOf: async () => schema,
    lookupTodo: async (spec) => {
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
      posted.push(String(spec.no || ''))
      return { ok: true, receiptId: `rcpt-${spec.no}` }
    },
  })
  const previewed = await g.preview({
    workspace: '/tmp/verify-after-ws',
    kind: '客户',
    action: '改行',
    batch: true,
    where: [{ keys: ['status'], values: ['inactive'] }],
    patch: { status: 'active' },
    speech: '把停用客户改成成交。',
  })
  const sheet = previewed.sheet && typeof previewed.sheet === 'object' ? previewed.sheet : previewed
  const previewId = String(previewed.preview_id || sheet.preview_id || '')
  assert.ok(previewId, previewed.hint || previewed.error)
  assert.equal(sheet.batch, true)
  live['CUST-2'].fields.status = 'other'
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, false)
  assert.equal(written.error, 'STALE')
  assert.equal(posted.length, 0)
  assert.equal(g.tokens.get(previewId).used, false)
})

test('set token confirm writes the still-matching bound set', async () => {
  const live = {
    'CUST-1': { no: 'CUST-1', fields: { id: '1', code: 'CUST-1', status: 'inactive' } },
    'CUST-2': { no: 'CUST-2', fields: { id: '2', code: 'CUST-2', status: 'inactive' } },
  }
  const posted = []
  const g = createGate({
    vocab,
    collectionsOf: async () => [{ name: 'customers', title: '客户', fields: schema }],
    fieldsOf: async () => schema,
    lookupTodo: async (spec) => {
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
      posted.push(String(spec.no || ''))
      const row = Object.values(live).find((item) => item.no === spec.no)
      if (row) row.fields.status = 'active'
      return { ok: true, receiptId: `rcpt-${spec.no}` }
    },
  })
  const previewed = await g.preview({
    workspace: '/tmp/verify-after-ws',
    kind: '客户',
    action: '改行',
    batch: true,
    where: [{ keys: ['status'], values: ['inactive'] }],
    patch: { status: 'active' },
    speech: '把停用客户改成成交。',
  })
  const sheet = previewed.sheet && typeof previewed.sheet === 'object' ? previewed.sheet : previewed
  const previewId = String(previewed.preview_id || sheet.preview_id || '')
  assert.ok(previewId, previewed.hint || previewed.error)
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, true, written.hint || written.speak || written.error)
  assert.deepEqual(posted.sort(), ['CUST-1', 'CUST-2'])
  assert.equal(g.tokens.get(previewId).used, true)
})

test('新建过账后按身份回读是否还在', async () => {
  const created = { no: '', fields: {} }
  const g = createGate({
    vocab: [{
      kind: '客户',
      resource: 'customers',
      can: ['现查', '改行', '新建'],
      fields: ['code', 'name', 'status'],
    }],
    collectionsOf: async () => [{ name: 'customers', title: '客户', fields: schema }],
    fieldsOf: async () => schema,
    lookupTodo: async (spec) => {
      const no = String((spec && spec.no) || '').trim()
      if (created.no && no === created.no) {
        return {
          ok: true,
          no: created.no,
          status: 'active',
          fields: created.fields,
          matches: [{ no: created.no, status: 'active', fields: created.fields }],
        }
      }
      return { ok: false, error: 'NOT_FOUND', matches: [] }
    },
    postWrite: async () => {
      created.no = 'CUST-NEW'
      created.fields = { id: '9', code: 'CUST-NEW', name: '新客', status: 'active' }
      return { ok: true, receiptId: 'rcpt-new', no: 'CUST-NEW' }
    },
  })
  const previewed = await g.preview({
    workspace: '/tmp/verify-after-ws',
    kind: '客户',
    action: '新建',
    patch: { name: '新客', status: 'active' },
    speech: '新建一个成交客户。',
  })
  const previewId = String(previewed.preview_id || previewed.sheet?.preview_id || '')
  assert.ok(previewId, previewed.hint || previewed.error)
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, true, written.hint || written.speak || written.error)
  assert.equal(written.verified, true)
  assert.equal(written.no, 'CUST-NEW')
})

test('新建过账没回单号则回读失败，不拿占位单号去查', async () => {
  const lookupNos = []
  const g = createGate({
    vocab: [{
      kind: '客户',
      resource: 'customers',
      can: ['现查', '改行', '新建'],
      fields: ['code', 'name', 'status'],
    }],
    collectionsOf: async () => [{ name: 'customers', title: '客户', fields: schema }],
    fieldsOf: async () => schema,
    lookupTodo: async (spec) => {
      lookupNos.push(String((spec && spec.no) || ''))
      return { ok: false, error: 'NOT_FOUND', matches: [] }
    },
    postWrite: async () => ({ ok: true, receiptId: 'rcpt-new' }),
  })
  const previewed = await g.preview({
    workspace: '/tmp/verify-after-ws',
    kind: '客户',
    action: '新建',
    patch: { name: '新客', status: 'active' },
    speech: '新建一个成交客户。',
  })
  const previewId = String(previewed.preview_id || previewed.sheet?.preview_id || '')
  assert.ok(previewId, previewed.hint || previewed.error)
  lookupNos.length = 0
  const written = await g.write({ preview_id: previewId, workspace: '/tmp/verify-after-ws' })
  assert.equal(written.ok, true, written.hint || written.speak || written.error)
  assert.equal(written.verified, false)
  assert.match(String(written.hint || written.speak || ''), /没回单号/)
  assert.equal(lookupNos.includes('新单'), false)
})
