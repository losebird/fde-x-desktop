import { test } from 'node:test'
import assert from 'node:assert/strict'
import { speakExpired, speakForbidden, speakGuestNet, speakMiss, speakObserve, speakWho } from '../miss.js'
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

function connect(extraA = {}, extraB = {}) {
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    if (frame.type === 'reply') return box.B.receiveReply(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'reply') return box.A.receiveReply(frame, await box.A.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip: async () => ({ ok: true }), ...extraA })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip: async () => ({ ok: true }), ...extraB })
  return box
}

async function paired(extraA = {}, extraB = {}) {
  const { A, B } = connect(extraA, extraB)
  await A.setDisplayName('Ace')
  await B.setDisplayName('林督')
  await A.mintPairCode()
  await B.mintPairCode()
  const bCode = (await B.snapshot()).pairCode.code
  const hs = await A.handshake({ peerCode: bCode, door: '10.0.0.2:9527' })
  const done = await afterHandshake(A, B, hs)
  return { A, B, peer: done.peers[0] }
}

test('miss speak names the gap and never pretends it sent', () => {
  assert.match(speakMiss({ name: '陈工' }), /没配对/)
  assert.match(speakMiss({ name: '林督', matches: 2 }), /两个/)
  assert.match(speakMiss({ name: '林督', listen: false }), /听口没开/)
  assert.match(speakMiss({ withdrawn: true, ticket: 'PO-12' }), /撤信不等于业务作废/)
  assert.match(speakWho({ displayName: 'Ace', staffId: 'emp_ace' }), /Ace的号 emp_ace/)
  assert.match(speakExpired(), /不自己重登/)
  assert.match(speakGuestNet('林督'), /访客网/)
  assert.match(speakGuestNet('林督'), /不装成送到/)
  assert.match(speakObserve({ sends: 2, lookups: 1 }), /送信失败 2 次/)
  assert.match(speakObserve({ sends: 2, lookups: 1 }), /查单失败 1 次/)
  assert.match(speakForbidden('nocobase_write'), /这台不能碰/)
})

test('find miss and switch seat do not borrow tickets', async () => {
  const { A, peer } = await paired()
  await A.bindStaff(peer.id, 'emp_lin')
  const miss = await A.speakFindMiss({ name: '陈工' })
  assert.equal(miss.ok, true)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'miss')
  assert.match(dock.speak, /没配对/)
  const seat = await A.switchSeat('emp_zhang', '张三')
  assert.match(seat.who, /张三的号 emp_zhang/)
  assert.equal((await A.snapshot()).peers.find((p) => p.id === peer.id).staffId, '')
})

test('expired lookup speaks and does not log in', async () => {
  const { A, B, peer } = await paired({
    lookupTodo: async () => ({ ok: false, error: 'EXPIRED' }),
  })
  const composed = await A.compose({ excerpt: '请过采购单 PO-12', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  await B.reply({ requestId: (await B.snapshot()).requests[0].id, body: '可以过。' })
  const preview = await A.previewWrite(composed.requestId)
  assert.equal(preview.ok, false)
  assert.equal(preview.error, 'EXPIRED')
  assert.match(preview.hint, /不自己重登/)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'expired')
  assert.ok((preview.inbox || []).some((row) => row.kind === 'expired' && /不自己重登/.test(row.speak)))
})

test('guest net outbox and observe / forbid speak stay honest', async () => {
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    return { ok: false, error: 'UNREACHABLE' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '192.168.43.9:9527')
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  box.A = createSecretary({
    store: memStore(),
    now,
    port: 9527,
    send: sendA,
    writeSlip: async () => ({ ok: true }),
    selfDoor: () => '192.168.1.8:9527',
  })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip: async () => ({ ok: true }) })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.A.mintPairCode()
  await box.B.mintPairCode()
  const hs = await box.A.handshake({ peerCode: (await box.B.snapshot()).pairCode.code, door: '192.168.43.9:9527' })
  const lin = (await afterHandshake(box.A, box.B, hs)).peers[0]
  await box.A.setPeerDoor(lin.id, '192.168.43.9:9527')
  const composed = await box.A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  await box.A.confirmSend(composed.requestId)
  const dock = await box.A.dock('s')
  assert.equal(dock.mode, 'outbox')
  assert.match(dock.speak, /访客网/)
  const observed = await box.A.speakObserveHint()
  assert.equal(observed.ok, true)
  assert.match((await box.A.snapshot()).observe.speak, /送信失败/)
  const forbid = await box.A.speakForbiddenHint('nocobase_write')
  assert.equal(forbid.ok, true)
  assert.ok((await box.A.snapshot()).inbox.some((row) => /这台不能碰/.test(row.speak)))
})

test('asleep queues a business event; wake opens it', async () => {
  const { A, B } = await paired()
  await A.setAsleep(true)
  const queued = await A.hearBusinessEvent({ kind: 'mine', no: 'PO-12' })
  assert.equal(queued.ok, true)
  assert.equal(await A.dock('sess-gray'), null)
  assert.equal((await B.snapshot()).requests.length, 0)
  await A.setAsleep(false)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'biz')
  assert.match(dock.speak, /到我审了/)
})
