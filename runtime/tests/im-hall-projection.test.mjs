import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rosterProjectionFp, unreadProjectionFp } from '../lan-assist-state-watch.mjs'

test('unread projection ignores peer heartbeats', () => {
  const unread = {
    requests: [
      { id: 'a', kind: 'incoming', unread: true, workspace: '/ws', status: 'open' },
    ],
  }
  const a = unreadProjectionFp({ ...unread, peers: [{ id: 'p1', online: true, lastHeard: 1 }] })
  const b = unreadProjectionFp({ ...unread, peers: [{ id: 'p1', online: true, lastHeard: 99 }] })
  assert.equal(a, b)
  const c = unreadProjectionFp({
    requests: [{ id: 'a', kind: 'incoming', unread: false, workspace: '/ws', status: 'open' }],
    peers: [{ id: 'p1', online: true, lastHeard: 99 }],
  })
  assert.notEqual(a, c)
})

test('roster projection ignores lastHeard and tracks online flips', () => {
  const base = {
    requests: [],
    peers: [{ id: 'p1', online: true, lastHeard: 1 }],
    groups: [{ id: 'g1' }],
  }
  const a = rosterProjectionFp(base)
  const b = rosterProjectionFp({ ...base, peers: [{ id: 'p1', online: true, lastHeard: 50 }] })
  assert.equal(a, b)
  const c = rosterProjectionFp({ ...base, peers: [{ id: 'p1', online: false, lastHeard: 50 }] })
  assert.notEqual(a, c)
})
