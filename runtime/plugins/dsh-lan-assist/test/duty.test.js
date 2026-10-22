import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packBackup, speakDuty } from '../duty.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { afterHandshake } from './pair-finish.js'

function memStore() {
  let state = emptyState()
  return {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
  }
}

function connect() {
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, await box.A.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip: async () => ({ ok: true }) })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip: async () => ({ ok: true }) })
  return box
}

async function paired() {
  const { A, B } = connect()
  await A.setDisplayName('Ace')
  await B.setDisplayName('林督')
  await A.mintPairCode()
  await B.mintPairCode()
  const bCode = (await B.snapshot()).pairCode.code
  const hs = await A.handshake({ peerCode: bCode, door: '10.0.0.2:9527' })
  const done = await afterHandshake(A, B, hs)
  return { A, B, peer: done.peers[0] }
}

test('duty speak never treats roster as a send key', () => {
  assert.match(speakDuty({ who: '陈工', ref: { kind: '采购单', no: 'PO-12' } }), /按岗位该陈工/)
  assert.match(speakDuty({ who: '陈工', reason: 'sod', ref: { no: 'PO-12' } }), /提单人不能过自己的单/)
  assert.match(speakDuty({ who: '陈工', paired: false, ref: { no: 'PO-12' } }), /花名册不能代替配对/)
  assert.doesNotMatch(speakDuty({ who: '陈工', paired: false }), /已发出|已转出/)
})

test('backup packs refs and ledger, never keys', () => {
  const packed = packBackup({
    peers: {
      pk_lin: { id: 'pk_lin', displayName: '林督', staffId: 'emp_lin', keyHex: 'secret', unpaired: false },
    },
    ledger: [{ at: 1, text: '已送到' }],
    requests: { req1: { id: 'req1', kind: 'outgoing', status: 'sent', workspace: '/ws', ref: { kind: '采购单', no: 'PO-12' } } },
  })
  assert.equal(packed.refs[0].staffId, 'emp_lin')
  assert.equal(packed.requests[0].ref.no, 'PO-12')
  assert.doesNotMatch(JSON.stringify(packed), /secret|keyHex/)
})

test('unpaired duty only speaks; paired duty still does not send', async () => {
  const { A, B } = await paired()
  const miss = await A.speakDutyHint({ who: '陈工', no: 'PO-12', reason: 'role' })
  assert.equal(miss.ok, true)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'duty')
  assert.match(dock.speak, /没配对/)
  assert.match(dock.sign, /不能代替配对/)
  assert.equal((await B.snapshot()).requests.length, 0)
  await A.hold(dock.requestId)
  const lin = (await A.snapshot()).peers[0]
  const hit = await A.speakDutyHint({ who: lin.displayName, no: 'PO-12', reason: 'shift' })
  assert.equal(hit.ok, true)
  const next = await A.dock('sess-gray')
  assert.equal(next.mode, 'duty')
  assert.match(next.speak, /按值班/)
  assert.equal((await B.snapshot()).requests.length, 0)
})

test('export includes refs; wipeRefs clears staff ids only', async () => {
  const { A, peer } = await paired()
  await A.bindStaff(peer.id, 'emp_lin')
  const dumped = await A.exportLedger()
  assert.equal(dumped.ok, true)
  assert.equal(dumped.refs.find((row) => row.id === peer.id).staffId, 'emp_lin')
  assert.doesNotMatch(JSON.stringify(dumped), /keyHex/)
  await A.wipeRefs()
  assert.equal((await A.snapshot()).peers.find((p) => p.id === peer.id).staffId, '')
  assert.equal((await A.snapshot()).peers.find((p) => p.id === peer.id).unpaired, false)
})
