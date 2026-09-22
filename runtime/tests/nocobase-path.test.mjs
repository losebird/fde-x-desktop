import assert from 'node:assert/strict'
import test from 'node:test'
import { identityFilterKeys, nocobasePath } from '../vendor-overlays/dsh-lan-assist/lookup.js'

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

test('ticket lookup keeps real columns and drops relations and unknown labels', () => {
  const keys = identityFilterKeys(spec, schema, 'AB1001')
  assert.deepEqual(keys, ['ticketNo', 'kindCode', 'remarks'])
  const path = nocobasePath(spec, 'AB1001', '样例', schema)
  const filter = JSON.parse(decodeURIComponent(path.split('filter=')[1]))
  const flat = JSON.stringify(filter)
  assert.match(flat, /ticketNo/)
  assert.doesNotMatch(flat, /owner|类别|handledAt/)
})

test('a long numeric id is looked up on id plus real columns', () => {
  const keys = identityFilterKeys({ resource: 'biz_rows', fields: ['ticketNo', 'lines'] }, [
    { name: 'ticketNo', title: '单号', interface: 'input' },
    { name: 'lines', title: '明细', interface: 'o2m' },
  ], '371713140981787')
  assert.deepEqual(keys, ['id', 'ticketNo'])
})
