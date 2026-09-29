import test from 'node:test'
import assert from 'node:assert/strict'
import { lookupHitsFingerprint } from '../vendor-overlays/dsh-lan-assist/lookup.js'

test('one hop hit and one ticket hit share 单号:状态:更新时间', () => {
  const row = { no: 'TK-1', status: '已解决', updatedAt: '2026-09-03T21:22:00.000Z' }
  const matches = [{ no: 'TK-1', status: '已解决' }]
  const hop = lookupHitsFingerprint('KindA', 'related', matches, [row])
  const ticket = lookupHitsFingerprint('KindA', 'ticket', matches, [row])
  assert.equal(hop, 'TK-1:已解决:2026-09-03T21:22:00.000Z')
  assert.equal(ticket, hop)
})

test('one-row fingerprint ignores the hop tag', () => {
  const row = { code: 'TK-1', updated_at: 't1' }
  const matches = [{ no: 'TK-1', status: '处理中' }]
  const filled = lookupHitsFingerprint('KindA', 'related-filled', matches, [row])
  const related = lookupHitsFingerprint('KindA', 'related', matches, [row])
  const rest = lookupHitsFingerprint('KindA', 'rest-name', matches, [row])
  assert.equal(filled, 'TK-1:处理中:t1')
  assert.equal(related, filled)
  assert.equal(rest, filled)
})

test('many hits keep a list fingerprint', () => {
  const matches = [{ no: 'A' }, { no: 'B' }]
  assert.equal(lookupHitsFingerprint('KindA', 'related', matches, []), 'KindA:related:A,B')
})

test('row clock change changes the fingerprint', () => {
  const prev = lookupHitsFingerprint('KindA', 'related', [{ no: 'TK-1', status: '已解决' }], [{ updatedAt: 't1' }])
  const next = lookupHitsFingerprint('KindA', 'ticket', [{ no: 'TK-1', status: '已解决' }], [{ updatedAt: 't2' }])
  assert.notEqual(prev, next)
})
