import test from 'node:test'
import assert from 'node:assert/strict'
import { enrichStructuredSlots, clueHitsInSpeech } from '../vendor-overlays/dsh-lan-assist/slots.js'

const vocab = [
  {
    kind: '客户',
    resource: 'biz_customers',
    can: ['现查'],
    clues: [{ say: ['停用', 'inactive'], keys: ['status'], values: ['inactive', '停用'] }],
  },
  {
    kind: '工单',
    resource: 'biz_tickets',
    can: ['现查'],
    relations: [{ from: '客户', to: '工单', field: 'customer' }],
    clues: [{ say: ['停用'], keys: ['status'], values: ['inactive'] }],
  },
  {
    kind: '口语',
    spoken: true,
    clues: [{
      say: ['没关', '未关闭'],
      keys: ['status', 'state'],
      values: ['closed', 'done'],
      not: true,
    }],
  },
]

test('clueHitsInSpeech assigns 停用 to 客户 and 没关 to 工单 by proximity', () => {
  const speech = '停用客户还有哪些没关的工单？'
  const hits = clueHitsInSpeech(speech, vocab)
  const hitStop = hits.find((row) => row.say === '停用')
  const hitOpen = hits.find((row) => row.say === '没关')
  assert.equal(hitStop?.assignKind, '客户')
  assert.equal(hitOpen?.assignKind, '工单')
  assert.equal(hitOpen?.not, true)
})

const hopVocab = [
  {
    kind: 'ParentA',
    resource: 'parent_a',
    can: ['现查'],
    relations: [{ from: 'ParentA', to: 'ChildB', field: 'parentRef' }],
    clues: [{ say: ['pending'], keys: ['status'], values: ['pending'] }],
  },
  {
    kind: 'ChildB',
    resource: 'child_b',
    can: ['现查'],
    clues: [{ say: ['expired'], keys: ['status'], values: ['expired'] }],
  },
]

test('enrichStructuredSlots links two mentioned kinds via graph relation', () => {
  const speech = 'ParentA pending rows tied to ChildB expired — list ChildB hits'
  const out = enrichStructuredSlots({
    kind: 'ChildB',
    action: '现查',
    speech,
    where: [{ keys: ['status'], values: ['expired'] }],
  }, hopVocab)
  assert.equal(out.from?.kind, 'ParentA')
  assert.ok(Array.isArray(out.where) && out.where.length)
})

test('enrichStructuredSlots adds from hop without utterance literals', () => {
  const spec = {
    kind: '工单',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
  }
  const out = enrichStructuredSlots(spec, vocab)
  assert.equal(out.from?.kind, '客户')
  assert.ok(Array.isArray(out.from?.where) && out.from.where.length)
  assert.ok(Array.isArray(out.where) && out.where.some((term) => term.not))
})
