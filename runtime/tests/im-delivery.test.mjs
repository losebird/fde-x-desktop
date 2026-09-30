import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPeerResult,
  clearPendingWait,
  deriveLetterStatus,
  FAIL_AFTER_MS,
  pendingPeers,
  peerMap,
  peerOut,
  shouldAttemptPeer,
} from '../vendor-overlays/dsh-lan-assist/delivery.js'

const dead = 'pk_dead'
const live = 'pk_live'

function letter(partial) {
  return {
    id: 'req_x',
    kind: 'outgoing',
    status: 'queued',
    to: [dead, live],
    delivered: {},
    relayed: {},
    withdrawn: [],
    attempts: {},
    lastAttempt: {},
    lastError: {},
    createdAt: 1,
    ...partial,
  }
}

describe('im per-peer delivery', () => {
  test('old scalar lastAttempt does not skip the remaining peer', () => {
    const req = letter({ lastAttempt: 9_000, attempts: 3, status: 'retry' })
    assert.deepEqual(peerMap(req.lastAttempt), {})
    assert.equal(shouldAttemptPeer(req, dead, 9_010), true)
    assert.equal(shouldAttemptPeer(req, live, 9_010), true)
  })

  test('one unreachable peer does not consume the wait of the next', () => {
    const req = letter()
    applyPeerResult(req, dead, { ok: false, error: 'ECONNREFUSED' }, 1_000)
    assert.equal(req.status, 'retry')
    assert.equal(peerOut(req, dead), false)
    assert.equal(shouldAttemptPeer(req, live, 1_000), true)
    applyPeerResult(req, live, { ok: true, via: 'lan' }, 1_001)
    assert.equal(peerOut(req, live), true)
    assert.deepEqual(pendingPeers(req), [dead])
    assert.equal(req.status, 'retry')
  })

  test('relayed counts as out; all relayed is sent', () => {
    const req = letter()
    applyPeerResult(req, dead, { ok: true, via: 'relay' }, 10)
    applyPeerResult(req, live, { ok: true, via: 'relay' }, 11)
    assert.equal(peerOut(req, dead), true)
    assert.equal(peerOut(req, live), true)
    assert.deepEqual(pendingPeers(req), [])
    assert.equal(req.status, 'sent')
  })

  test('already-out peer is not attempted again', () => {
    const req = letter({ delivered: { [live]: 5 } })
    assert.equal(shouldAttemptPeer(req, live, 50), false)
    applyPeerResult(req, dead, { ok: false, error: 'UNREACHABLE' }, 50)
    assert.equal(peerOut(req, live), true)
    assert.deepEqual(pendingPeers(req), [dead])
  })

  test('expired remaining peers fail the letter; already-out stay out', () => {
    const req = letter({ createdAt: 1, delivered: { [live]: 2 } })
    const status = deriveLetterStatus(req, 1 + FAIL_AFTER_MS, FAIL_AFTER_MS)
    assert.equal(status, 'failed')
    assert.equal(peerOut(req, live), true)
    assert.deepEqual(pendingPeers(req), [dead])
  })

  test('NOT_PAIRED is a per-peer miss; the remaining peer is still attempted', () => {
    const req = letter()
    applyPeerResult(req, dead, { ok: false, error: 'NOT_PAIRED' }, 1_000)
    assert.equal(req.lastError[dead], 'NOT_PAIRED')
    assert.equal(peerOut(req, dead), false)
    assert.equal(shouldAttemptPeer(req, live, 1_000), true)
    applyPeerResult(req, live, { ok: true, via: 'lan' }, 1_001)
    assert.equal(peerOut(req, live), true)
    assert.deepEqual(pendingPeers(req), [dead])
    assert.equal(req.status, 'retry')
  })

  test('再送 clears wait only for people still pending', () => {
    const req = letter({
      delivered: { [live]: 8 },
      lastAttempt: { [dead]: 8, [live]: 8 },
      status: 'retry',
    })
    clearPendingWait(req)
    assert.equal(req.lastAttempt[dead], 0)
    assert.equal(req.lastAttempt[live], 8)
    assert.equal(shouldAttemptPeer(req, dead, 9), true)
    assert.equal(shouldAttemptPeer(req, live, 9), false)
  })
})
