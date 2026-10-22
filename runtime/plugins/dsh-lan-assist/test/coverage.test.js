import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { dispatch, serveVendor, isLocalClient } from '../http.js'
import { registerTools } from '../tools.js'
import { registerCommands } from '../commands.js'
import {
  CODE_MAX_GUESSES,
  CODE_TTL_MS,
  EXPIRE_AFTER_MS,
  FAIL_AFTER_MS,
  LOST_HOLD_MS,
} from '../home.js'
import { keyFromHex, signFrame } from '../crypto.js'
import { createFileStore } from '../files.js'
import { afterHandshake } from './pair-finish.js'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

function routeFrame(target, frame, remote) {
  if (frame.type === 'hello') return target.acceptHello(frame, remote)
  return target.peerFor(frame.from).then((peer) => {
    if (!peer) return { ok: false, error: 'KEY_REJECT' }
    if (frame.type === 'envelope') return target.receiveEnvelope(frame, peer)
    if (frame.type === 'reply') return target.receiveReply(frame, peer)
    if (frame.type === 'ack') return target.receiveAck(frame, peer)
    if (frame.type === 'shout') return { ok: true }
    return { ok: false, error: 'UNKNOWN' }
  })
}

function connectMany(clock) {
  const box = { A: null, B: null, C: null }
  const now = clock || (() => 1_700_000_000_000)
  const writeSlip = async () => ({ ok: true, path: ':mem:' })
  const sendA = async (door, frame) => {
    if (String(door).includes('10.0.0.2')) return routeFrame(box.B, frame, '10.0.0.1:9527')
    if (String(door).includes('10.0.0.3')) return routeFrame(box.C, frame, '10.0.0.1:9527')
    return { ok: false, error: 'UNREACHABLE' }
  }
  const sendB = async (_door, frame) => routeFrame(box.A, frame, '10.0.0.2:9527')
  const sendC = async (_door, frame) => routeFrame(box.A, frame, '10.0.0.3:9527')
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip })
  box.C = createSecretary({ store: memStore(), now, send: sendC, writeSlip })
  return box
}

async function pairInto(from, into, door, name) {
  await from.setDisplayName(from === into ? name : (await from.snapshot()).self.displayName)
  await into.setDisplayName(name)
  await into.mintPairCode()
  const code = (await into.snapshot()).pairCode.code
  const hs = await from.handshake({ peerCode: code, door })
  assert.equal(hs.ok, true)
  const accepted = await into.acceptPairAsk()
  assert.equal(accepted.ok, true)
  const peers = (await from.snapshot()).peers
  return peers.find((p) => p.displayName === name) || peers[0]
}

async function trio(clock) {
  const box = connectMany(clock)
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.C.setDisplayName('陈工')
  const lin = await pairInto(box.A, box.B, '10.0.0.2:9527', '林督')
  const chen = await pairInto(box.A, box.C, '10.0.0.3:9527', '陈工')
  return { ...box, lin, chen }
}

test('one envelope can go to two paired peers', async () => {
  const { A, B, C, lin, chen } = await trio()
  const composed = await A.compose({
    excerpt: '先切 10%',
    to: [lin.id, chen.id],
    sessionId: 'sess-gray',
  })
  assert.equal(composed.ok, true)
  await A.confirmSend(composed.requestId)
  assert.equal((await B.snapshot()).requests.length, 1)
  assert.equal((await C.snapshot()).requests.length, 1)
  assert.equal((await A.snapshot()).requests[0].to.length, 2)
})

test('topic group is one envelope to members; followup stays on that letter', async () => {
  const { A, B, C, lin, chen } = await trio()
  const g = await A.createGroup({ name: '灰度上线', members: [lin.id, chen.id] })
  assert.equal(g.ok, true)
  assert.equal((await A.snapshot()).groups[0].name, '灰度上线')
  const composed = await A.compose({
    excerpt: '今晚 10% 灰度，回滚窗口谁盯？',
    to: [],
    groupId: g.groupId,
    sessionId: 'sess-gray',
  })
  assert.equal(composed.ok, true)
  const out = (await A.snapshot()).requests.find((row) => row.id === composed.requestId)
  assert.equal(out.topic, true)
  assert.equal(out.groupId, g.groupId)
  assert.equal(out.to.length, 2)
  await A.confirmSend(composed.requestId)
  const linIn = (await B.snapshot()).requests[0]
  const chenIn = (await C.snapshot()).requests[0]
  assert.equal(linIn.topic, true)
  assert.equal(linIn.groupName, '灰度上线')
  assert.equal((await B.snapshot()).groups[0].id, g.groupId)
  await B.reply({ requestId: linIn.id, body: '先切 10%。' })
  const after = (await A.snapshot()).requests.find((row) => row.id === composed.requestId)
  assert.equal(after.replies.length, 1)
  const adopted = await A.adopt(composed.requestId, [lin.id])
  assert.ok(adopted.followup)
  assert.match(adopted.followup.text, /先切 10%/)
})

test('1:1 can repeat the same line; a group topic still refuses a duplicate', async () => {
  const { A, lin } = await trio()
  const first = await A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  assert.equal(first.ok, true)
  const again = await A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  assert.equal(again.ok, true)
  assert.notEqual(again.requestId, first.requestId)
  const g = await A.createGroup({ name: '灰度上线', members: [lin.id] })
  const topic = await A.compose({ excerpt: '今晚切 10%', to: [lin.id], sessionId: 's', groupId: g.groupId })
  assert.equal(topic.ok, true)
  const dup = await A.compose({ excerpt: '今晚切 10%', to: [lin.id], sessionId: 's', groupId: g.groupId })
  assert.equal(dup.ok, false)
  assert.equal(dup.error, 'DUP')
})

test('attachments over 500MB total are refused; 20MB is allowed', async () => {
  const { A, lin } = await trio()
  const ok = await A.compose({
    excerpt: '20MB 包',
    to: [lin.id],
    attachments: [
      { name: 'a.bin', size: 4 * 1024 * 1024 + 1 },
      { name: 'b.bin', size: 4 * 1024 * 1024 + 1 },
      { name: 'c.bin', size: 4 * 1024 * 1024 + 1 },
      { name: 'd.bin', size: 4 * 1024 * 1024 + 1 },
      { name: 'e.bin', size: 4 * 1024 * 1024 + 1 },
    ],
  })
  assert.equal(ok.ok, true)
  const over = await A.compose({
    excerpt: '超大包',
    to: [lin.id],
    attachments: [
      { name: 'a.bin', size: 180 * 1024 * 1024 },
      { name: 'b.bin', size: 180 * 1024 * 1024 },
      { name: 'c.bin', size: 180 * 1024 * 1024 },
    ],
  })
  assert.equal(over.ok, false)
  assert.equal(over.error, 'ATTACH_TOTAL')
})

test('cancel presend deletes the unsent letter', async () => {
  const { A, B, lin } = await trio()
  const composed = await A.compose({ excerpt: '先不发这封', to: [lin.id], sessionId: 's' })
  await A.cancelPresend(composed.requestId)
  assert.equal((await A.snapshot()).requests.length, 0)
  assert.equal((await B.snapshot()).requests.length, 0)
})

test('read then withdraw is refused; unread reclaim returns hold', async () => {
  let t = 1_700_000_000_000
  const { A, B, lin } = await trio(() => t)
  const composed = await A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.markRead(incoming.id, 'sess-lin')
  const soon = await A.withdraw(composed.requestId, lin.id)
  assert.equal(soon.ok !== false, true)
  t += 3 * 60 * 1000
  const composed2 = await A.compose({ excerpt: '回滚今晚', to: [lin.id], sessionId: 's' })
  await A.confirmSend(composed2.requestId)
  const incoming2 = (await B.snapshot()).requests.find((row) => row.id === composed2.requestId) || (await B.snapshot()).requests[0]
  await B.markRead(incoming2.id, 'sess-lin')
  t += 3 * 60 * 1000
  const refused = await A.withdraw(composed2.requestId, lin.id)
  assert.equal(refused.ok, false)
  assert.equal(refused.error, 'ALREADY_READ')
  await A.reclaimHold(composed.requestId)
  assert.equal((await A.snapshot()).requests[0].holder, (await A.snapshot()).self.id)
})

test('reading a reply acks the sender so 撤回 can drop', async () => {
  const { A, B, lin } = await trio()
  const composed = await A.compose({ excerpt: '销售单几号', to: [lin.id], sessionId: 's' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.reply({ requestId: incoming.id, body: '这是现查。', sessionId: 'sess-lin' })
  await A.markRead(composed.requestId, 'sess-a')
  const aceId = (await A.snapshot()).self.id
  const letter = (await B.snapshot()).requests.find((row) => row.id === incoming.id)
  assert.ok(letter && letter.reads && letter.reads[aceId])
})

test('card can add a paired peer onto the cosign list; unpaired is refused', async () => {
  const { A, lin, chen } = await trio()
  const composed = await A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  await A.confirmSend(composed.requestId)
  const added = await A.addVisible(composed.requestId, chen.id)
  assert.equal(added.ok, true)
  const row = added.requests.find((item) => item.id === composed.requestId)
  assert.equal(row.cosign.on, true)
  assert.ok(row.visible.includes(chen.id))
  assert.ok(row.to.includes(chen.id))
  const refused = await A.addVisible(composed.requestId, 'pk_ghost')
  assert.equal(refused.ok, false)
  assert.equal(refused.error, 'NOT_PAIRED')
})

test('cosign blocks adopt until every named peer nods', async () => {
  const { A, B, lin } = await trio()
  const composed = await A.compose({
    excerpt: '先切 10%',
    to: [lin.id],
    sessionId: 's',
    cosign: true,
  })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.reply({ requestId: incoming.id, body: '可以。' })
  const blocked = await A.adopt(composed.requestId)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.error, 'COSIGN')
  await A.nod(composed.requestId, lin.id)
  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, true)
  assert.ok(adopted.followup)
})

test('adopt can pick one of several replies', async () => {
  const { A, B, C, lin, chen } = await trio()
  const composed = await A.compose({
    excerpt: '先切 10%',
    to: [lin.id, chen.id],
    sessionId: 's',
  })
  await A.confirmSend(composed.requestId)
  await B.reply({ requestId: (await B.snapshot()).requests[0].id, body: '林督说先切。' })
  await C.reply({ requestId: (await C.snapshot()).requests[0].id, body: '陈工说先别切。' })
  const adopted = await A.adopt(composed.requestId, [chen.id])
  assert.equal(adopted.ok, true)
  assert.match(adopted.followup.text, /先别切/)
  assert.doesNotMatch(adopted.followup.text, /林督说先切/)
})

test('tick closes at 14 days, fails undelivered at 7, and reclaims a lost hold at 48h', async () => {
  let t = 1_700_000_000_000
  const store = memStore()
  const A = createSecretary({ store, now: () => t, send: async () => ({ ok: false }), writeSlip: async () => ({ ok: true }) })
  await A.setDisplayName('Ace')
  await store.update((state) => {
    state.self = { id: 'pk_ace', keySeed: 'aa', displayName: 'Ace' }
    state.peers.pk_lin = { id: 'pk_lin', displayName: '林督', keyHex: 'ab', unpaired: false, lastHeard: t, door: '10.0.0.2:9527' }
    state.requests.old = {
      id: 'old', kind: 'outgoing', status: 'sent', holder: 'pk_ace', to: ['pk_lin'], from: 'pk_ace',
      createdAt: t, updatedAt: t,
    }
    state.requests.queued = {
      id: 'queued', kind: 'outgoing', status: 'queued', holder: 'pk_ace', to: ['pk_lin'], from: 'pk_ace',
      createdAt: t, updatedAt: t,
    }
    state.requests.held = {
      id: 'held', kind: 'outgoing', status: 'sent', holder: 'pk_lin', to: ['pk_lin'], from: 'pk_ace',
      createdAt: t, updatedAt: t,
    }
  })
  t += FAIL_AFTER_MS
  await A.tick()
  assert.equal((await A.snapshot()).requests.find((r) => r.id === 'queued').status, 'failed')
  t += (EXPIRE_AFTER_MS - FAIL_AFTER_MS)
  await A.tick()
  assert.equal((await A.snapshot()).requests.find((r) => r.id === 'old'), undefined)
  assert.equal((await A.snapshot()).requests.find((r) => r.id === 'queued').status, 'failed')
  t = 1_700_000_000_000 + LOST_HOLD_MS
  await store.update((state) => {
    state.peers.pk_lin.lastHeard = 1_700_000_000_000
    state.requests.held = {
      id: 'held', kind: 'outgoing', status: 'sent', holder: 'pk_lin', to: ['pk_lin'], from: 'pk_ace',
      createdAt: t, updatedAt: t,
    }
  })
  await A.tick()
  assert.equal((await A.snapshot()).requests.find((r) => r.id === 'held').holder, 'pk_ace')
})

test('pairing code expires and locks after too many guesses', async () => {
  let t = 1_000
  const b = createSecretary({ store: memStore(), now: () => t, send: async () => ({ ok: false }) })
  await b.mintPairCode()
  t += CODE_TTL_MS + 1
  const expired = await b.acceptHello({
    type: 'hello', from: 'pk_evil', fromName: '访客', nonce: 'n1', ts: t, door: '10.0.0.9:9527', offer: 'AAAA',
  }, '10.0.0.9:9527')
  assert.equal(expired.ok, false)
  assert.equal(expired.error, 'CODE_EXPIRED')

  t = 2_000
  await b.mintPairCode()
  const { generatePairOffer } = await import('../crypto.js')
  const theirs = generatePairOffer()
  const offer = await b.acceptHello({
    type: 'hello', from: 'pk_evil', fromName: '访客', nonce: 'n2', ts: t, door: '10.0.0.9:9527', offer: theirs.publicKey,
  }, '10.0.0.9:9527')
  assert.equal(offer.ok, true)
  for (let i = 0; i < CODE_MAX_GUESSES; i += 1) {
    const miss = await b.acceptHello({
      type: 'hello', confirm: true, from: 'pk_evil', fromName: '访客', nonce: 'n2', ts: t,
      door: '10.0.0.9:9527', mac: '00'.repeat(32),
    }, '10.0.0.9:9527')
    assert.equal(miss.ok, false)
    assert.equal(miss.error, 'CODE_MISMATCH')
  }
  const locked = await b.acceptHello({
    type: 'hello', confirm: true, from: 'pk_evil', fromName: '访客', nonce: 'n2', ts: t,
    door: '10.0.0.9:9527', mac: '00'.repeat(32),
  }, '10.0.0.9:9527')
  assert.equal(locked.error, 'CODE_LOCKED')
})

test('display name, note, own-loopback door, and untrusted sighting', async () => {
  const { A, lin } = await trio()
  const named = await A.setDisplayName('灰')
  assert.equal(named.self.displayName, '灰')
  assert.equal((await A.setDisplayName('')).ok, false)
  await A.setPeerNote(lin.id, '值班长')
  assert.equal((await A.snapshot()).peers.find((p) => p.id === lin.id).note, '值班长')
  const own = await A.setPeerDoor(lin.id, '127.0.0.1:9527')
  assert.equal(own.ok, false)
  assert.equal(own.error, 'OWN_DOOR')
  await A.setPeerDoor(lin.id, '10.0.0.9:9527')
  assert.equal((await A.snapshot()).peers.find((p) => p.id === lin.id).door, '10.0.0.9:9527')
  await A.noteSighting({ id: 'pk_guest', displayName: '路过', door: '10.0.0.8:9527' })
  const view = await A.snapshot()
  assert.ok(view.sightings.some((s) => s.id === 'pk_guest'))
  assert.equal(view.peers.some((p) => p.id === 'pk_guest'), false)
  const forgotten = await A.forgetSighting('pk_guest')
  assert.equal(forgotten.ok, true)
  assert.equal((await A.snapshot()).sightings.some((s) => s.id === 'pk_guest'), false)
  assert.equal((await A.snapshot()).peers.find((p) => p.id === lin.id).unpaired, false)
  const miss = await A.forgetSighting('')
  assert.equal(miss.ok, false)
})

test('unpair reclaims hold and switchSeat drops staff refs', async () => {
  const { A, lin } = await trio()
  await A.bindStaff(lin.id, 'emp_lin')
  const composed = await A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  await A.confirmSend(composed.requestId)
  await A.reclaimHold(composed.requestId)
  await A.unpair(lin.id)
  const after = await A.snapshot()
  const peer = after.peers.find((p) => p.id === lin.id)
  assert.equal(peer.unpaired, true)
  assert.equal(peer.staffId, '')
  assert.equal(after.requests[0].holder, after.self.id)
  const seated = await A.switchSeat('emp_ace', 'Ace')
  assert.match(seated.who || '', /emp_ace|Ace/)
})

test('openHere rebinds a letter; close drops it from the mailbox', async () => {
  const { A, B, lin } = await trio()
  const composed = await A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 'old' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  const opened = await B.openHere(incoming.id, 'sess-now')
  assert.equal(opened.ok, true)
  assert.equal((await B.snapshot()).requests[0].sessionId, 'sess-now')
  await A.closeRequest(composed.requestId)
  assert.equal((await A.snapshot()).requests.find((r) => r.id === composed.requestId), undefined)
})

test('listen grant, sink without a command, and listen inbox ingest', async () => {
  const { A, B, lin } = await trio()
  await A.grantListen(true)
  assert.equal((await A.snapshot()).listenGranted, true)
  const sink = await A.runSink('nope')
  assert.equal(sink.ok, true)
  assert.equal(sink.ran, false)
  await A.setSinkCommand('echo hi')
  const noted = await A.runSink('nope')
  assert.equal(noted.ran, false)
  assert.match(noted.hint || '', /点了才送/)

  const composed = await A.compose({ excerpt: '听口来信', to: [lin.id], sessionId: 's' })
  await A.confirmSend(composed.requestId)
  const peer = await B.peerFor((await B.snapshot()).peers[0].id)
  const frame = signFrame(keyFromHex(peer.keyHex), {
    type: 'ack',
    from: peer.id,
    fromName: 'Ace',
    requestId: (await B.snapshot()).requests[0].id,
    nonce: 'n-listen',
    ts: 1,
    event: 'read',
  })
  const ingested = await B.ingestListenInbox([{ frame }])
  assert.ok(ingested.requests[0].reads)
})

test('replayed nonce is rejected', async () => {
  const { A, lin } = await trio()
  const fresh = await A.noteSeen(lin.id, 'once')
  const again = await A.noteSeen(lin.id, 'once')
  assert.equal(fresh, true)
  assert.equal(again, false)
})

test('http dispatch covers hall routes without waking a model', async () => {
  const { A, lin } = await trio()
  const named = await dispatch(A, '/name', { name: '灰' })
  assert.equal(named.self.displayName, '灰')
  const noted = await dispatch(A, '/note', { peerId: lin.id, note: '督' })
  assert.equal(noted.peers.find((p) => p.id === lin.id).note, '督')
  const composed = await dispatch(A, '/compose', { excerpt: '大厅起草', to: [lin.id], sessionId: 's' })
  assert.equal(composed.ok, true)
  const cancelled = await dispatch(A, '/presend/cancel', { requestId: composed.requestId })
  assert.equal(cancelled.requests.length, 0)
  const listen = await dispatch(A, '/listen', { on: true })
  assert.equal(listen.listenGranted, true)
  const sleep = await dispatch(A, '/sleep', { on: true })
  assert.equal(sleep.asleep, true)
  const brief = await dispatch(A, '/brief', { off: true })
  assert.equal(brief.briefOff, true)
  const unknown = await dispatch(A, '/no-such', {})
  assert.equal(unknown.error, 'NOT_FOUND')
  const biz = await A.hearBusinessEvent({ kind: 'biz', speak: '业务里还有待审' })
  const held = await dispatch(A, '/biz/hold', { eventId: biz.eventId })
  assert.ok((held.inbox || []).every((row) => row.requestId !== biz.eventId))
})

test('peer pin/mute and group update/dissolve stay on this machine', async () => {
  const { A, lin } = await trio()
  const flagged = await A.setPeerFlags(lin.id, { pin: true, mute: true })
  const peer = flagged.peers.find((p) => p.id === lin.id)
  assert.equal(peer.pin, true)
  assert.equal(peer.mute, true)
  const g = await A.createGroup({ name: '灰度上线', members: [lin.id] })
  assert.equal(g.ok, true)
  const updated = await A.updateGroup({ groupId: g.groupId, name: '灰度', pin: true })
  assert.equal(updated.groups[0].name, '灰度')
  assert.equal(updated.groups[0].pin, true)
  const gone = await A.dissolveGroup(g.groupId)
  assert.equal((gone.groups || []).length, 0)
})

test('retrySend requeues a failed letter and refuses a live one', async () => {
  let t = 1_700_000_000_000
  const box = { A: null, B: null }
  const writeSlip = async () => ({ ok: true, path: ':mem:' })
  box.A = createSecretary({
    store: memStore(),
    now: () => t,
    send: async (_door, frame) => {
      if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
      return { ok: false, error: 'UNREACHABLE' }
    },
    writeSlip,
  })
  box.B = createSecretary({
    store: memStore(),
    now: () => t,
    send: async (_door, frame) => routeFrame(box.A, frame, '10.0.0.2:9527'),
    writeSlip,
  })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.B.mintPairCode()
  const hs = await box.A.handshake({ peerCode: (await box.B.snapshot()).pairCode.code, door: '10.0.0.2:9527' })
  const lin = (await afterHandshake(box.A, box.B, hs)).peers[0]
  const composed = await box.A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  const live = await box.A.retrySend(composed.requestId)
  assert.equal(live.ok, false)
  await box.A.confirmSend(composed.requestId)
  t += FAIL_AFTER_MS
  await box.A.tick()
  assert.equal((await box.A.snapshot()).requests.find((r) => r.id === composed.requestId).status, 'failed')
  const again = await box.A.retrySend(composed.requestId)
  assert.equal(again.ok, true)
  const row = again.requests.find((r) => r.id === composed.requestId)
  assert.ok(row.status === 'queued' || row.status === 'sent' || row.status === 'retry')
})

test('vendor office scripts ship same-origin and unknown names are refused', async () => {
  function mockRes() {
    const out = { status: 0, headers: {}, body: null }
    return {
      out,
      writeHead(status, headers) { out.status = status; out.headers = headers },
      end(buf) { out.body = buf },
    }
  }
  const ok = mockRes()
  const got = await serveVendor('mammoth.browser.min.js', ok)
  assert.equal(got.ok, true)
  assert.equal(ok.out.status, 200)
  assert.match(String(ok.out.headers['content-type']), /javascript/)
  assert.ok(got.bytes > 1000)
  const bad = mockRes()
  const refused = await serveVendor('../http.js', bad)
  assert.equal(refused.ok, false)
  assert.equal(refused.error, 'NO_VENDOR')
})

test('retry ladder waits before flushing again', async () => {
  let t = 1_700_000_000_000
  const hits = []
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    hits.push({ t, type: frame.type })
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    return { ok: false, error: 'UNREACHABLE' }
  }
  const sendB = async (_door, frame) => routeFrame(box.A, frame, '10.0.0.2:9527')
  box.A = createSecretary({ store: memStore(), now: () => t, send: sendA, writeSlip: async () => ({ ok: true, path: ':mem:' }) })
  box.B = createSecretary({ store: memStore(), now: () => t, send: sendB, writeSlip: async () => ({ ok: true, path: ':mem:' }) })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.B.mintPairCode()
  const hs = await box.A.handshake({ peerCode: (await box.B.snapshot()).pairCode.code, door: '10.0.0.2:9527' })
  const lin = (await afterHandshake(box.A, box.B, hs)).peers[0]
  const composed = await box.A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  await box.A.confirmSend(composed.requestId)
  assert.equal(hits.filter((row) => row.type === 'envelope').length, 1)
  t += 5_000
  await box.A.flushOutbox()
  assert.equal(hits.filter((row) => row.type === 'envelope').length, 1)
  t += 30_000
  await box.A.flushOutbox()
  assert.equal(hits.filter((row) => row.type === 'envelope').length, 2)
})

test('attachment bytes ride the envelope; snapshot strips them', async () => {
  const { A, B, lin } = await trio()
  const composed = await A.compose({
    excerpt: '脚本',
    to: [lin.id],
    sessionId: 's',
    attachments: [{ name: 'rollback.sh', size: 12, mime: 'text/x-sh', data: 'echo ok' }],
  })
  const out = (await A.snapshot()).requests.find((row) => row.id === composed.requestId)
  assert.equal(out.attachments[0].name, 'rollback.sh')
  assert.equal(out.attachments[0].hasData, true)
  assert.equal(out.attachments[0].data, undefined)
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  assert.equal(incoming.attachments[0].name, 'rollback.sh')
  assert.equal(incoming.attachments[0].hasData, true)
  assert.equal(incoming.attachments[0].data, undefined)
  const fetched = await A.getAttachment(incoming.id, 0)
  assert.equal(fetched.ok, true)
  assert.equal(fetched.name, 'rollback.sh')
  assert.equal(fetched.data, 'echo ok')
  const boxed = await B.getAttachment(incoming.id, 0)
  assert.equal(boxed.data, 'echo ok')
})

test('copy attachment into workspace, not the mailbox file', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-copy-'))
  const { A, lin } = await trio()
  const composed = await A.compose({
    excerpt: '脚本',
    to: [lin.id],
    sessionId: 's',
    attachments: [{ name: 'rollback.sh', size: 12, mime: 'text/x-sh', data: 'echo ok' }],
  })
  const miss = await A.copyAttachment({ requestId: composed.requestId, index: 0 })
  assert.equal(miss.ok, false)
  assert.equal(miss.error, 'NO_CWD')
  const copied = await A.copyAttachment({ requestId: composed.requestId, index: 0, workspace: cwd })
  assert.equal(copied.ok, true, copied.hint || copied.error)
  const body = await readFile(join(cwd, copied.path), 'utf8')
  assert.equal(body, 'echo ok')
  const row = (await A.snapshot()).requests.find((item) => item.id === composed.requestId)
  assert.equal(row.attachments[0].data, undefined)
  const escaped = await A.copyAttachment({
    requestId: composed.requestId,
    index: 0,
    workspace: cwd,
  })
  assert.equal(escaped.ok, true)
  assert.doesNotMatch(escaped.path, /\.\./)
  const png = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')
  const bin = await A.compose({
    excerpt: '图',
    to: [lin.id],
    sessionId: 's',
    attachments: [{ name: 'a.png', size: 8, mime: 'image/png', data: png }],
  })
  const copiedPng = await A.copyAttachment({ requestId: `${bin.requestId}:v1`, index: 0, workspace: cwd })
  assert.equal(copiedPng.ok, true)
  const bytes = await readFile(join(cwd, copiedPng.path))
  assert.equal(bytes.toString('hex'), '89504e470d0a1a0a')
})

test('mailbox JSON keeps a file pointer, not attachment bytes', async () => {
  const store = memStore()
  const A = createSecretary({ store, now: () => 1, send: async () => ({ ok: false }) })
  await A.setDisplayName('Ace')
  await store.update((s) => {
    s.peers.pk_lin = { id: 'pk_lin', displayName: '林督', keyHex: 'ab', unpaired: false, door: '10.0.0.2:9527' }
  })
  const composed = await A.compose({
    excerpt: '脚本',
    to: ['pk_lin'],
    attachments: [{ name: 'a.sh', mime: 'text/x-sh', data: 'echo secret-bytes', size: 17 }],
  })
  const row = (await store.get()).requests[composed.requestId]
  assert.equal(row.attachments[0].data, undefined)
  assert.ok(row.attachments[0].fileId)
  assert.doesNotMatch(JSON.stringify(row), /echo secret-bytes/)
  const got = await A.getAttachment(composed.requestId, 0)
  assert.equal(got.data, 'echo secret-bytes')
})

test('expired letters drop attachment files', async () => {
  let t = 1_700_000_000_000
  const store = memStore()
  const files = createFileStore()
  const A = createSecretary({ store, files, now: () => t, send: async () => ({ ok: false }) })
  await A.setDisplayName('Ace')
  await store.update((s) => {
    s.peers.pk_lin = { id: 'pk_lin', displayName: '林督', keyHex: 'ab', unpaired: false, door: '10.0.0.2:9527' }
  })
  const composed = await A.compose({
    excerpt: '过期包',
    to: ['pk_lin'],
    attachments: [{ name: 'a.bin', data: 'gone-soon', size: 9 }],
  })
  assert.equal((await A.getAttachment(composed.requestId, 0)).data, 'gone-soon')
  t += EXPIRE_AFTER_MS
  await A.tick()
  const after = await A.getAttachment(composed.requestId, 0)
  assert.equal(after.ok, false)
  assert.equal((await store.get()).requests[composed.requestId], undefined)
})

test('askLocal followups the live session and never sends a letter', async () => {
  const { A, B, lin } = await trio()
  const empty = await A.askLocal({ quote: '', sessionId: 'sess-gray' })
  assert.equal(empty.error, 'EMPTY_BODY')
  const unbound = await A.askLocal({ quote: '探活通吗', sessionId: '' })
  assert.equal(unbound.error, 'NO_SESSION')
  const asked = await A.askLocal({ quote: '探活通吗', sessionId: 'sess-gray', workspace: '/ws' })
  assert.equal(asked.ok, true)
  assert.equal(asked.followup.sessionId, 'sess-gray')
  assert.match(asked.followup.text, /本机问话/)
  assert.match(asked.followup.text, /探活通吗/)
  assert.equal((await B.snapshot()).requests.length, 0)
  const translated = await A.askLocal({ quote: 'hold the rollback', sessionId: 'sess-gray', kind: 'translate' })
  assert.match(translated.followup.text, /本机翻译/)
  const summed = await A.askLocal({ quote: '先切 10%。探活通。', sessionId: 'sess-gray', kind: 'summary' })
  assert.match(summed.followup.text, /本机摘要/)
  const composed = await A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  assert.equal((await B.snapshot()).requests.length, 1)
  const followed = []
  const dispatched = await dispatch(A, '/ask-local', { quote: '监控跟上', sessionId: 'sess-gray', workspace: '/ws' }, async (spec) => {
    followed.push(spec)
    return { ok: true }
  })
  assert.equal(dispatched.ok, true)
  assert.equal(dispatched.followed, true)
  assert.equal(followed.length, 1)
  assert.match(followed[0].text, /监控跟上/)
  const noMouth = await dispatch(A, '/ask-local', { quote: '监控跟上', sessionId: 'sess-gray' })
  assert.equal(noMouth.error, 'NO_FOLLOWUP')
})

test('ask_colleague drafts and list_visible never dumps another mailbox', async () => {
  const { A, B, lin } = await trio()
  const tools = []
  registerTools({ tools: { register: (row) => tools.push(row) } }, { defineTool: (row) => row }, A)
  const ask = tools.find((row) => row.name === 'ask_colleague')
  const listed = tools.find((row) => row.name === 'list_visible')
  const drafted = JSON.parse(await ask.execute(
    { name: '林督', excerpt: '先切 10%' },
    { agent: { id: 'sess-gray', session: { header: { cwd: '/ws' } } } },
  ))
  assert.equal(drafted.ok, true)
  assert.equal(drafted.messageId, `${drafted.requestId}:v1`)
  assert.match(drafted.speak, /林督/)
  assert.match(drafted.speak, /人点发送才寄/)
  const miss = JSON.parse(await ask.execute({ name: '路人', excerpt: 'hi' }, { agent: { id: 's' } }))
  assert.equal(miss.error, 'NO_PEER')
  await A.confirmSend(drafted.requestId)
  const visible = JSON.parse(await listed.execute({}))
  assert.equal(visible.ok, true)
  assert.equal(visible.visible.length, 1)
  assert.equal(visible.visible[0].from, 'Ace')
  assert.equal(visible.visible[0].messageId, `${visible.visible[0].id}:v1`)
  const byMsg = JSON.parse(await listed.execute({ requestId: visible.visible[0].messageId }))
  assert.equal(byMsg.visible.length, 1)
  const other = JSON.parse(await listed.execute.call(
    { execute: listed.execute },
    { requestId: 'not-yours' },
  ))
  assert.equal(other.visible.length, 0)
  assert.equal((await B.snapshot()).requests[0].kind, 'incoming')
})

test('slash command names the recipient and does not send', async () => {
  const { A, B } = await trio()
  const cmds = []
  registerCommands({ commands: { register: (row) => cmds.push(row) } }, A)
  const cmd = cmds.find((row) => row.name === 'ask-colleague')
  const bad = await cmd.handler({ agent: { id: 's' }, rawInput: '林督' })
  assert.equal(bad.kind, 'error')
  const ok = await cmd.handler({
    agent: { id: 'sess-gray', session: { header: { cwd: '/ws' } } },
    rawInput: '林督 先切 10%',
  })
  assert.equal(ok.kind, 'success')
  assert.equal((await B.snapshot()).requests.length, 0)
})

test('chase is a board and does not pretend delivered while asleep', async () => {
  const { A, B, lin } = await trio()
  const composed = await A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  await A.confirmSend(composed.requestId)
  await A.setAsleep(true)
  const chased = await A.chase(composed.requestId)
  assert.ok(chased.ledger.some((row) => /再催是拍板/.test(row.text)))
  const still = (await B.snapshot()).requests.length
  await A.setAsleep(false)
  assert.ok((await B.snapshot()).requests.length >= still)
})

test('purge ledger keeps keys; export still has no secrets', async () => {
  const { A, lin } = await trio()
  await A.bindStaff(lin.id, 'emp_lin')
  await A.compose({ excerpt: '记一笔', to: [lin.id], sessionId: 's' })
  const before = (await A.snapshot()).ledger.length
  assert.ok(before > 0)
  await A.purgeLedger()
  assert.equal((await A.snapshot()).ledger.length, 0)
  const dumped = await A.exportLedger()
  assert.doesNotMatch(JSON.stringify(dumped), /keyHex|privateKey/)
  assert.equal((await A.snapshot()).peers.find((p) => p.id === lin.id).unpaired, false)
})

test('unsent 1:1 draft survives cancel, group topic, and a follow', async () => {
  const { A, B, lin } = await trio()
  const ask = await B.compose({ excerpt: '这个项目怎么样？', to: [(await A.snapshot()).self.id] })
  await B.confirmSend(ask.requestId)
  const incoming = (await A.snapshot()).requests[0]
  await A.draftReply(incoming.id, 'sess-ace')
  await A.acceptDraftFromSession('sess-ace', '---\n来信是在问这个项目。\n---')
  await A.finalizeDraftFromSession('sess-ace')
  assert.equal((await A.dock('sess-ace')).replyDraft, '来信是在问这个项目。')

  const presend = await A.compose({ excerpt: '还没发出', to: [lin.id], sessionId: 'sess-ace' })
  assert.equal(presend.ok, true)
  await A.cancelPresend(presend.requestId)
  assert.equal((await A.dock('sess-ace')).replyDraft, '来信是在问这个项目。')

  const g = await A.createGroup({ name: '灰度', members: [lin.id] })
  const topic = await A.compose({ excerpt: '今晚切', to: [lin.id], sessionId: 'sess-ace', groupId: g.groupId })
  await A.confirmSend(topic.requestId)
  assert.equal((await A.dock('sess-ace')).replyDraft, '来信是在问这个项目。')

  const follow = await A.compose({
    excerpt: '跟一句',
    to: [lin.id],
    sessionId: 'sess-ace',
    groupId: g.groupId,
    threadId: topic.requestId,
  })
  await A.confirmSend(follow.requestId)
  assert.equal((await A.dock('sess-ace')).replyDraft, '来信是在问这个项目。')
})

test('hall snapshot is a shell; threadOf returns the opened letter', async () => {
  const { A, B, lin } = await trio()
  const composed = await A.compose({
    excerpt: '先切 10%。回滚脚本今晚我改完。',
    to: [lin.id],
    sessionId: 's',
  })
  await A.confirmSend(composed.requestId)
  const hall = await A.hall()
  const shell = hall.requests.find((row) => row.id === composed.requestId)
  assert.equal(shell.versions, undefined)
  assert.equal(typeof shell.last, 'string')
  assert.ok(String(shell.last).length <= 40)
  const opened = await A.threadOf({ peerId: lin.id })
  const full = opened.requests.find((row) => row.id === composed.requestId)
  assert.ok(Array.isArray(full.versions))
  assert.ok(full.versions.length >= 1)
  const incoming = (await B.threadOf({ peerId: (await B.snapshot()).self.id })).requests
  assert.ok(incoming.length === 0 || incoming[0])
  const theirs = await B.threadOf({ requestId: (await B.snapshot()).requests[0].id })
  assert.equal(theirs.requests[0].excerpt, '先切 10%。回滚脚本今晚我改完。')
  const g = await A.createGroup({ name: '灰度上线', members: [lin.id] })
  const topic = await A.compose({ excerpt: '今晚切 10%', to: [lin.id], sessionId: 's', groupId: g.groupId })
  await A.confirmSend(topic.requestId)
  const peerThread = await A.threadOf({ peerId: lin.id })
  assert.ok(peerThread.requests.every((row) => !row.topic && !row.groupId))
  assert.ok(peerThread.requests.some((row) => row.id === composed.requestId))
  assert.equal(peerThread.requests.some((row) => row.id === topic.requestId), false)
  const groupThread = await A.threadOf({ requestId: topic.requestId })
  assert.equal(groupThread.requests[0].id, topic.requestId)
  const follow = await A.compose({
    excerpt: '跟一句',
    to: [lin.id],
    sessionId: 's',
    groupId: g.groupId,
    threadId: topic.requestId,
  })
  assert.equal(follow.ok, true)
  const child = (await A.snapshot()).requests.find((row) => row.id === follow.requestId)
  assert.equal(child.topic, false)
  assert.equal(child.threadId, topic.requestId)
  await A.confirmSend(follow.requestId)
  const openedTopic = await A.threadOf({ requestId: topic.requestId })
  assert.ok(openedTopic.requests.some((row) => row.id === topic.requestId))
  assert.ok(openedTopic.requests.some((row) => row.id === follow.requestId))
  const stillPeer = await A.threadOf({ peerId: lin.id })
  assert.equal(stillPeer.requests.some((row) => row.id === follow.requestId), false)
  await A.closeRequest(composed.requestId)
  const afterClose = await A.hall()
  assert.equal(afterClose.requests.find((row) => row.id === composed.requestId), undefined)
  assert.equal(afterClose.ledger, undefined)
  assert.ok(Array.isArray(await A.ledger()))
  assert.equal(afterClose.catalog, undefined)
  assert.equal((await A.snapshot()).requests.find((row) => row.id === composed.requestId), undefined)
})

test('opening a stacked letter spills followups into thread messages', async () => {
  const { A, B, lin } = await trio()
  const composed = await A.compose({ excerpt: '先切 10%', to: [lin.id], sessionId: 's' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.reply({ requestId: incoming.id, body: '回一句' })
  const stacked = (await A.snapshot()).requests.find((row) => row.id === composed.requestId)
  assert.ok((stacked.replies || []).length >= 1)
  const opened = await A.threadOf({ peerId: lin.id })
  const root = opened.requests.find((row) => row.id === composed.requestId)
  assert.equal((root.replies || []).length, 0)
  assert.ok(opened.requests.some((row) => row.threadId === composed.requestId && /回一句/.test(String(row.excerpt || row.body || ''))))
})

test('lan-assist handler only accepts this machine', () => {
  assert.equal(isLocalClient({ socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:3080' } }), true)
  assert.equal(isLocalClient({ socket: { remoteAddress: '::1' }, headers: { host: 'localhost:3080' } }), true)
  assert.equal(isLocalClient({ socket: { remoteAddress: '10.0.0.8' }, headers: { host: '127.0.0.1:3080' } }), false)
  assert.equal(isLocalClient({ socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'evil.example', origin: 'http://evil.example' } }), false)
})

test('failed letters stay visible until 14 days after fail, then drop', async () => {
  let t = 1_700_000_000_000
  const store = memStore()
  const A = createSecretary({ store, now: () => t, send: async () => ({ ok: false }), writeSlip: async () => ({ ok: true }) })
  await A.setDisplayName('Ace')
  await store.update((state) => {
    state.self = { id: 'pk_ace', keySeed: 'aa', displayName: 'Ace' }
    state.peers.pk_lin = { id: 'pk_lin', displayName: '林督', keyHex: 'ab', unpaired: false, lastHeard: t, door: '10.0.0.2:9527' }
    state.requests.queued = {
      id: 'queued', kind: 'outgoing', status: 'queued', holder: 'pk_ace', to: ['pk_lin'], from: 'pk_ace',
      createdAt: t, updatedAt: t,
    }
  })
  t += FAIL_AFTER_MS
  const failed = await A.tick()
  assert.equal(failed.changed, true)
  assert.equal((await A.hall()).requests.find((r) => r.id === 'queued').status, 'failed')
  t += EXPIRE_AFTER_MS
  const gone = await A.tick()
  assert.equal(gone.changed, true)
  assert.equal((await A.snapshot()).requests.find((r) => r.id === 'queued'), undefined)
  const idle = await A.tick()
  assert.equal(idle.changed, false)
  assert.equal(idle.requests, undefined)
})
