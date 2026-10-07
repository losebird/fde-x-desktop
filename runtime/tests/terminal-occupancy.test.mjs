import { test } from 'node:test'
import assert from 'node:assert/strict'
import { terminalCloseAction, terminalFollowStopped } from '../../src/lib/terminal-occupancy.ts'

test('terminalFollowStopped reads structured exit occupancy', () => {
  assert.equal(terminalFollowStopped({ type: 'exit' }), true)
  assert.equal(terminalFollowStopped({ type: 'close' }), true)
  assert.equal(terminalFollowStopped({ type: 'end' }), true)
  assert.equal(terminalFollowStopped({ type: 'stopped' }), true)
  assert.equal(terminalFollowStopped({ type: 'output', code: 'exited' }), true)
  assert.equal(terminalFollowStopped({ type: 'output', info: { code: 'not_running' } }), true)
  assert.equal(terminalFollowStopped({ type: 'output', data: 'exit\n' }), false)
  assert.equal(terminalFollowStopped({ type: 'snapshot', screen: 'ready' }), false)
  assert.equal(terminalFollowStopped({ info: { error: 'permission denied' } }), false)
  assert.equal(terminalFollowStopped({ info: { error: 'permission denied' } }, false), false)
  assert.equal(terminalFollowStopped({ type: 'output', info: { error: 'gone' } }, true), true)
})

test('terminalCloseAction picks Face close occupancy', () => {
  assert.equal(terminalCloseAction(['create', 'write', 'follow']), '')
  assert.equal(terminalCloseAction(['write', 'close', 'destroy']), 'close')
  assert.equal(terminalCloseAction(['kill', 'write']), 'kill')
})
