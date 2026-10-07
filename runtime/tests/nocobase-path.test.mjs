import assert from 'node:assert/strict'
import test from 'node:test'
import { captureWriteIdentity, createLookup, identityFilterKeys, nocobasePath } from '../vendor-overlays/dsh-lan-assist/lookup.js'

const spec = {
  resource: 'biz_rows',
  fields: ['ticketNo', 'owner', 'note', '类别', '备注', '时间'],
}
const schema = [
  { name: 'ticketNo', title: '单号', interface: 'input' },
  { name: 'owner', title: '经办', interface: 'm2o' },
  { name: 'kindCode', title: '类别', interface: 'select' },
  { name: 'remarks', title: '备注', interface: 'textarea' },
  { name: 'handledAt', title: '时间', interface: 'datetime' },
]

test('ticket lookup keeps identity columns and drops enum text dumps', () => {
  const keys = identityFilterKeys(spec, schema, 'AB1001')
  assert.deepEqual(keys, ['ticketNo'])
  const path = nocobasePath(spec, 'AB1001', '样例', schema)
  const filter = JSON.parse(decodeURIComponent(path.split('filter=')[1]))
  const flat = JSON.stringify(filter)
  assert.match(flat, /ticketNo/)
  assert.doesNotMatch(flat, /owner|类别|kindCode|remarks|handledAt/)
})

test('write identity prefers the schema identifier then the 单号 cell', () => {
  const pk = captureWriteIdentity({
    no: 'AB1001',
    fields: { id: '371713140981787', ticketNo: 'AB1001', remarks: 'note' },
  }, [
    { name: 'id', interface: 'snowflakeId' },
    { name: 'ticketNo', title: '单号', interface: 'input' },
    { name: 'remarks', title: '备注', interface: 'textarea' },
  ])
  assert.deepEqual(pk, { field: 'id', value: '371713140981787' })
  const byNo = captureWriteIdentity({
    no: 'AB1001',
    fields: { ticketNo: 'AB1001', remarks: 'note' },
  }, [
    { name: 'ticketNo', title: '单号', interface: 'input' },
    { name: 'remarks', title: '备注', interface: 'textarea' },
  ])
  assert.deepEqual(byNo, { field: 'ticketNo', value: 'AB1001' })
})

test('a long numeric id is looked up on the schema identifier plus real columns', () => {
  const keys = identityFilterKeys({ resource: 'biz_rows', fields: ['ticketNo', 'lines'] }, [
    { name: 'rowKey', title: '主键', interface: 'snowflakeId' },
    { name: 'ticketNo', title: '单号', interface: 'input' },
    { name: 'lines', title: '明细', interface: 'o2m' },
  ], '371713140981787')
  assert.deepEqual(keys, ['rowKey', 'ticketNo'])
})

test('a long number does not invent a column the schema does not have', () => {
  const keys = identityFilterKeys({ resource: 'biz_rows', fields: ['ticketNo'] }, [
    { name: 'ticketNo', title: '单号', interface: 'input' },
  ], '371713140981787')
  assert.deepEqual(keys, ['ticketNo'])
})

test('a ticket look keeps 单号 columns and leaves schema identifiers off the filter', () => {
  const keys = identityFilterKeys({ resource: 'biz_rows' }, [
    { name: 'id', interface: 'snowflakeId' },
    { name: 'requestNo', title: '申请编号', interface: 'input' },
    { name: 'no', title: '单号', interface: 'input' },
  ], 'AB-2026-017')
  assert.deepEqual(keys, ['requestNo', 'no'])
  const path = nocobasePath({ resource: 'biz_rows' }, 'AB-2026-017', '样例', [
    { name: 'id', interface: 'snowflakeId' },
    { name: 'requestNo', title: '申请编号', interface: 'input' },
    { name: 'no', title: '单号', interface: 'input' },
  ])
  const filter = JSON.parse(decodeURIComponent(path.split('filter=')[1]))
  const flat = JSON.stringify(filter)
  assert.match(flat, /requestNo/)
  assert.doesNotMatch(flat, /"id"/)
})

test('ticket filter LOOKUP rereads the same 单号 on the list mouth', async () => {
  const urls = []
  const lookup = createLookup({
    fetchImpl: async (url) => {
      const href = String(url)
      urls.push(href)
      if (href.includes('filter=')) {
        return { ok: false, status: 400, json: async () => ({ error: 'bad filter' }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: '371', requestNo: 'AB-2026-017', no: 'AB-2026-017', status: 'open' },
            { id: '372', requestNo: 'AB-2026-001', no: 'AB-2026-001', status: 'draft' },
          ],
        }),
      }
    },
    resolve: async () => ({
      baseUrl: 'http://example.test',
      token: 't',
      vocab: [{ kind: '样例', resource: 'biz_rows', fields: ['requestNo', 'no'] }],
      collections: [{
        name: 'biz_rows',
        fields: [
          { name: 'id', interface: 'snowflakeId' },
          { name: 'requestNo', title: '申请编号', interface: 'input' },
          { name: 'no', title: '单号', interface: 'input' },
          { name: 'status', title: '状态', interface: 'select' },
        ],
      }],
    }),
  })
  const found = await lookup.lookupTodo({ kind: '样例', no: 'AB-2026-017' })
  assert.equal(found.ok, true)
  assert.equal(found.no, 'AB-2026-017')
  assert.ok(urls.some((url) => url.includes('filter=')))
  assert.ok(urls.some((url) => url.includes(':list') && !url.includes('filter=')))
})
