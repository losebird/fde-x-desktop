import assert from 'node:assert/strict'
import test from 'node:test'
import { captureWriteIdentity, identityFilterKeys, nocobasePath } from '../vendor-overlays/dsh-lan-assist/lookup.js'

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
