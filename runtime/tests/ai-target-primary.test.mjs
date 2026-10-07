import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPrimarySession, resolvePrimarySessionId } from '../session-primary.mjs'

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
