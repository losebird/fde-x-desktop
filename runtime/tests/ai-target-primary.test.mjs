import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { invalidateHostSessionList, isPrimarySession, listHostSessions, pickPrimarySessionId, resolvePrimarySessionId } from '../session-primary.mjs'

const parent = {
  sessionId: 'parent-1',
  title: '主会话',
  updatedAt: 1,
  running: false,
  blank: false,
  cwd: '/ws/a',
}
const child = {
  sessionId: 'child-1',
  title: '子会话',
  updatedAt: 2,
  running: false,
  blank: false,
  origin: 'subagent',
  parentSessionId: 'parent-1',
  cwd: '/ws/a',
}

test('isPrimarySession rejects subagent occupancy', () => {
  assert.equal(isPrimarySession(parent), true)
  assert.equal(isPrimarySession(child), false)
  assert.equal(isPrimarySession({ ...parent, parentSessionId: 'x' }), false)
})

test('resolvePrimarySessionId opens subagents at the parent', () => {
  const rows = [parent, child]
  assert.equal(resolvePrimarySessionId('parent-1', rows), 'parent-1')
  assert.equal(resolvePrimarySessionId('child-1', rows), 'parent-1')
  assert.equal(resolvePrimarySessionId('missing', rows), 'missing')
  assert.equal(resolvePrimarySessionId('', rows), '')
  assert.equal(resolvePrimarySessionId('orphan', [{ ...child, sessionId: 'orphan', parentSessionId: '' }]), '')
})

test('pickPrimarySessionId preferIdle skips a running latest session', () => {
  const rows = [
    { sessionId: 'busy', cwd: '/ws/a', updatedAt: 9, running: true },
    { sessionId: 'idle', cwd: '/ws/a', updatedAt: 8, running: false },
  ]
  assert.equal(pickPrimarySessionId(rows, { cwd: '/ws/a' }), 'busy')
  assert.equal(pickPrimarySessionId(rows, { cwd: '/ws/a', preferIdle: true }), 'idle')
})

test('listHostSessions reuses one Host list within the hold window', async () => {
  invalidateHostSessionList()
  let calls = 0
  const runtime = {
    call(endpoint) {
      assert.equal(endpoint, 'session/list')
      calls += 1
      return { items: [parent] }
    },
  }
  const first = await listHostSessions(runtime)
  const second = await listHostSessions(runtime)
  assert.equal(calls, 1)
  assert.equal(first[0].sessionId, 'parent-1')
  assert.equal(second[0].sessionId, 'parent-1')
  invalidateHostSessionList()
  await listHostSessions(runtime)
  assert.equal(calls, 2)
})
