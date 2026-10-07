import { test } from 'node:test'
import assert from 'node:assert/strict'

function assistantMatchesFill(bind, event) {
  if (!bind) return false
  const sid = String(event.sessionId || '')
  if (!sid || bind.sessionId !== sid) return false
  const want = String(bind.requestId || '')
  if (!want) return true
  return want === String(event.requestId || '')
}

test('fill without requestId matches next assistant on that session', () => {
  const bind = { sessionId: 's1', threadId: 'im_a' }
  assert.equal(assistantMatchesFill(bind, { sessionId: 's1' }), true)
  assert.equal(assistantMatchesFill(bind, { sessionId: 's2' }), false)
  assert.equal(assistantMatchesFill(null, { sessionId: 's1' }), false)
})

test('fill with requestId matches only that turn', () => {
  const bind = { sessionId: 's1', threadId: 'im_a', requestId: 'r-b' }
  assert.equal(assistantMatchesFill(bind, { sessionId: 's1', requestId: 'r-a' }), false)
  assert.equal(assistantMatchesFill(bind, { sessionId: 's1', requestId: 'r-b' }), true)
  assert.equal(assistantMatchesFill(bind, { sessionId: 's1' }), false)
})
