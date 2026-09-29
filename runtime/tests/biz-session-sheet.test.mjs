import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sheetBelongsToSession, sheetForLiveSession } from '../../src/lib/sheet-session.ts'

test('new official sheet missing sessionId is stamped, not dropped', () => {
  const incoming = { kind: 'KindA', action: '现查', roundId: 'rnd_2', rows: [{ no: 'A-1' }] }
  assert.equal(sheetBelongsToSession(incoming, 'sess-live'), false)
  const admitted = sheetForLiveSession(incoming, 'sess-live', true)
  assert.ok(admitted)
  assert.equal(admitted.sessionId, 'sess-live')
  assert.equal(sheetForLiveSession(incoming, 'sess-live', false), null)
  const owned = { ...incoming, sessionId: 'sess-live' }
  assert.equal(sheetForLiveSession(owned, 'sess-live', false), owned)
})
