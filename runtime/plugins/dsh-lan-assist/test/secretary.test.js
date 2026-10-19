import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { afterHandshake } from './pair-finish.js'
import { setRelayStore } from '../nats-relay.js'
import { keyFromHex, signFrame } from '../crypto.js'

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

function connect(extraA = {}, extraB = {}, clock) {
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    if (frame.type === 'reply') return box.B.receiveReply(frame, await box.B.peerFor(frame.from))
    if (frame.type === 'ack') return box.B.receiveAck(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'reply') return box.A.receiveReply(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'ack') return box.A.receiveAck(frame, await box.A.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = clock || (() => 1_700_000_000_000)
  const writeSlip = async () => ({ ok: true, path: ':mem:' })
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip, ...extraA })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip, ...extraB })
  return box
}

async function paired(extraA = {}, extraB = {}, clock) {
  const { A, B } = connect(extraA, extraB, clock)
  await A.setDisplayName('Ace')
  await B.setDisplayName('林督')
  await A.mintPairCode()
  await B.mintPairCode()
  const bCode = (await B.snapshot()).pairCode.code
  const hs = await A.handshake({ peerCode: bCode, door: '10.0.0.2:9527' })
  assert.equal(hs.ok, true)
  assert.equal(hs.awaiting, true)
  const done = await afterHandshake(A, B, hs)
  assert.equal(done.ok, true)
  assert.equal(done.peers.length, 1)
  assert.equal(done.peers[0].displayName, '林督')
  return { A, B, peer: done.peers[0] }
}

test('relayed recipient is not posted again', async () => {
  const box = { A: null, B: null }
  let envelopes = 0
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') {
      envelopes += 1
      return { ok: true, via: 'relay' }
    }
    if (frame.type === 'reply') return box.B.receiveReply(frame, await box.B.peerFor(frame.from))
    if (frame.type === 'ack') return box.B.receiveAck(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'reply') return box.A.receiveReply(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'ack') return box.A.receiveAck(frame, await box.A.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  const writeSlip = async () => ({ ok: true, path: ':mem:' })
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.B.mintPairCode()
  const hs = await box.A.handshake({ peerCode: (await box.B.snapshot()).pairCode.code, door: '10.0.0.2:9527' })
  await afterHandshake(box.A, box.B, hs)
  const peer = (await box.A.snapshot()).peers[0]
  const composed = await box.A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 's' })
  await box.A.confirmSend(composed.requestId)
  assert.equal(envelopes, 1)
  await box.A.tick()
  await box.A.tick()
  assert.equal(envelopes, 1)
  const row = (await box.A.snapshot()).requests.find((item) => item.id === composed.requestId)
  assert.ok(row.relayed[peer.id])
  assert.equal(Object.keys(row.delivered || {}).length, 0)
  const livePeer = await box.A.peerFor(peer.id)
  const bSelf = (await box.B.snapshot()).self
  const ack = signFrame(keyFromHex(livePeer.keyHex), {
    type: 'ack',
    event: 'delivery',
    from: bSelf.id,
    fromName: bSelf.displayName,
    to: (await box.A.snapshot()).self.id,
    nonce: 'n1',
    ts: 1,
    requestId: composed.requestId,
  })
  const got = await box.A.receiveAck(ack, { id: bSelf.id, keyHex: livePeer.keyHex, displayName: '林督' })
  assert.equal(got.ok, true)
  const after = (await box.A.snapshot()).requests.find((item) => item.id === composed.requestId)
  assert.ok(after.delivered[peer.id])
  assert.equal((after.reads || {})[peer.id], undefined)
})

test('relay invite handshake waits for a human nod and does not use LAN hello', async () => {
  const prev = process.env.DSH_LAN_ASSIST_NATS
  process.env.DSH_LAN_ASSIST_NATS = 'wss://relay.example/nats'
  try {
    const box = { A: null, B: null }
    async function sendA(_door, frame) {
      if (frame.type === 'hello') return { ok: false, error: 'UNREACHABLE' }
      if (String(frame.type || '').startsWith('pair.')) return box.B.acceptPairFrame(frame)
      return { ok: false, error: 'UNREACHABLE' }
    }
    async function sendB(_door, frame) {
      if (frame.type === 'hello') return { ok: false, error: 'UNREACHABLE' }
      if (String(frame.type || '').startsWith('pair.')) return box.A.acceptPairFrame(frame)
      return { ok: false, error: 'UNREACHABLE' }
    }
    box.A = createSecretary({ store: memStore(), now: () => 1, send: sendA })
    box.B = createSecretary({ store: memStore(), now: () => 1, send: sendB })
    await box.A.setDisplayName('Ace')
    await box.B.setDisplayName('林督')
    const issued = await box.B.mintRelayInvite()
    assert.equal(issued.ok, true)
    const hs = await box.A.handshake({ session: issued.invite.session, device: issued.invite.device })
    assert.equal(hs.ok, true)
    assert.equal(hs.awaiting, true)
    const ask = (await box.B.snapshot()).pairAsk
    assert.equal(ask.ready, true)
    assert.equal(ask.session, issued.invite.session)
    const accepted = await box.B.acceptPairAsk()
    assert.equal(accepted.ok, true)
    assert.equal((await box.A.snapshot()).peers.length, 1)
    assert.equal((await box.B.snapshot()).peers.length, 1)
    assert.equal(await box.B.relayInviteLive(issued.invite.session), false)
  } finally {
    if (prev == null) delete process.env.DSH_LAN_ASSIST_NATS
    else process.env.DSH_LAN_ASSIST_NATS = prev
  }
})

test('relay config stores url, keeps creds path in secrets', async () => {
  const secrets = {}
  const store = memStore()
  store.getSecret = async (key) => secrets[key] || ''
  store.setSecret = async (key, value) => {
    if (value) secrets[key] = String(value)
    else delete secrets[key]
    return secrets[key] || ''
  }
  const secretary = createSecretary({
    store,
    now: () => 1,
    send: async () => ({ ok: false }),
  })
  const bad = await secretary.setRelayConfig({ url: 'http://x' })
  assert.equal(bad.error, 'BAD_URL')
  const ok = await secretary.setRelayConfig({ url: 'nats://127.0.0.1:4222', credsPath: '/tmp/device.creds' })
  assert.equal(ok.ok, true)
  const snap = await secretary.snapshot()
  assert.equal(snap.relayUrl, 'nats://127.0.0.1:4222')
  assert.equal(snap.relayCredsSet, true)
  assert.equal(JSON.stringify(snap).includes('/tmp/device.creds'), false)
  assert.equal(secrets.natsCredsPath, '/tmp/device.creds')
  setRelayStore({ url: '', credsPath: '' })
})

test('relay invite is stored then revoked, never the pairing code', async () => {
  const prev = process.env.DSH_LAN_ASSIST_NATS
  process.env.DSH_LAN_ASSIST_NATS = 'wss://relay.example/nats'
  try {
    const secretary = createSecretary({
      store: memStore(),
      now: () => 1,
      send: async () => ({ ok: false }),
    })
    await secretary.setDisplayName('Ace')
    const issued = await secretary.mintRelayInvite()
    assert.equal(issued.ok, true)
    assert.equal(issued.invite.code, undefined)
    assert.equal(await secretary.relayInviteLive(issued.invite.session), true)
    const miss = await secretary.revokeRelayInvite('')
    assert.equal(miss.error, 'NO_INVITE')
    const revoked = await secretary.revokeRelayInvite(issued.invite.session)
    assert.equal(revoked.ok, true)
    assert.equal(await secretary.relayInviteLive(issued.invite.session), false)
  } finally {
    if (prev == null) delete process.env.DSH_LAN_ASSIST_NATS
    else process.env.DSH_LAN_ASSIST_NATS = prev
  }
})

test('LAN post is a short probe and speaks 已投出, not 已收到', async () => {
  const { A, peer } = await paired()
  const composed = await A.compose({
    excerpt: '候选：先切 10% 灰度',
    to: [peer.id],
    sessionId: 'sess-gray',
  })
  assert.equal(composed.messageId, `${composed.requestId}:v1`)
  await A.confirmSend(composed.messageId)
  const snap = await A.snapshot()
  const row = snap.requests.find((item) => item.id === composed.requestId)
  assert.equal(row.via[peer.id], 'lan')
  const ledger = JSON.stringify(snap.ledger || [])
  assert.match(ledger, /已投出/)
  assert.doesNotMatch(ledger, /已收到/)
})

test('compose names the recipient and does not send until confirm', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({
    excerpt: '候选：先切 10% 灰度',
    to: [peer.id],
    sessionId: 'sess-gray',
  })
  assert.equal(composed.ok, true)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'presend')
  assert.match(dock.speak, /林督/)
  assert.match(dock.speak, /pk_/)
  assert.equal((await B.snapshot()).requests.length, 0)

  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests
  assert.equal(incoming.length, 1)
  assert.equal(incoming[0].kind, 'incoming')
  const asked = await B.dock('sess-lin')
  assert.equal(asked.mode, 'asked')
})

test('same envelope can go several rounds', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.reply({ requestId: incoming.id, body: '先切可以。回滚呢？' })
  const afterFirst = (await A.snapshot()).requests.find((row) => row.id === composed.requestId)
  assert.equal(afterFirst.status, 'replied')
  const dockA = await A.dock('sess-gray')
  assert.ok(!dockA || dockA.mode !== 'reply')
  const again = await A.reply({ requestId: composed.requestId, body: '回滚今晚改完。', sessionId: 'sess-gray' })
  assert.equal(again.ok, true)
  assert.match((await B.snapshot()).requests[0].versions.slice(-1)[0].body, /回滚今晚/)
})

test('hold does not followup; adopt returns followup text', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.reply({ requestId: incoming.id, body: '先切 10%。回滚今晚改完。' })

  const held = await A.hold(composed.requestId)
  assert.equal(held.requests.find((row) => row.id === composed.requestId).held, true)
  assert.equal(held.requests.find((row) => row.id === composed.requestId).adopted, false)

  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, true)
  assert.ok(adopted.followup)
  assert.match(adopted.followup.text, /林督/)
  assert.match(adopted.followup.text, /只当正文/)
  assert.equal(adopted.followup.sessionId, 'sess-gray')
})

test('draftReply drops the incoming letter into the live session', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '我想知道 dsh-eyes 的最新进展', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  const drafted = await B.draftReply(incoming.id, 'sess-lin')
  assert.equal(drafted.ok, true)
  assert.match(drafted.followup.text, /我想知道 dsh-eyes 的最新进展/)
  assert.match(drafted.followup.text, /只当正文/)
  assert.match(drafted.followup.text, /不是改单才写信|先判断是不是改单/)
  const first = await B.acceptDraftFromSession('sess-lin', [
    '下面是一封未寄出的回信草稿：',
    '',
    '---',
    '',
    '先说一句进度。',
    '',
    '---',
    '',
    '这封还没寄。要改口吻，直接说。',
  ].join('\n'))
  assert.equal(first.ok, true)
  const second = await B.acceptDraftFromSession('sess-lin', '再补安装步骤。')
  assert.equal(second.ok, true)
  const done = await B.finalizeDraftFromSession('sess-lin')
  assert.equal(done.ok, true)
  const dock = await B.dock('sess-lin')
  assert.equal(dock.replyDraft, '先说一句进度。')
  assert.doesNotMatch(dock.replyDraft, /未寄出的回信草稿|这封还没寄|再补安装步骤/)
})

test('self-talk and a json fence are not a reply letter', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '词表里的口语为什么不能写到那里？', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.draftReply(incoming.id, 'sess-lin')
  await B.acceptDraftFromSession('sess-lin', [
    '这是问词表「口语」为什么配不出 spoken.json 那种结构，不是改单。先查图里当时怎么钉的。',
    '',
    '```json',
    '{ "role": "问句", "keys": ["role"], "values": ["问句"], "say": ["哪个用户的"] }',
    '```',
  ].join('\n'))
  await B.finalizeDraftFromSession('sess-lin')
  assert.equal((await B.dock('sess-lin')).replyDraft || '', '')
  await B.draftReply(incoming.id, 'sess-lin')
  await B.acceptDraftFromSession('sess-lin', [
    '---',
    '口语可以挂在同一条词上，但写口会丢掉角色，所以配不出那种结构。',
    '---',
    '',
    '```json',
    '{ "role": "问句" }',
    '```',
  ].join('\n'))
  await B.finalizeDraftFromSession('sess-lin')
  assert.match((await B.dock('sess-lin')).replyDraft, /口语可以挂在同一条词上/)
  assert.doesNotMatch((await B.dock('sess-lin')).replyDraft, /```|upsert_workspace_vocab|"role"/)
})

test('sending a 1:1 letter consumes the reply draft on that talk', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '这个项目怎么样？', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.draftReply(incoming.id, 'sess-lin')
  await B.acceptDraftFromSession('sess-lin', '---\n来信是在问这个项目。\n---')
  await B.finalizeDraftFromSession('sess-lin')
  assert.equal((await B.dock('sess-lin')).replyDraft, '来信是在问这个项目。')
  const sent = await B.compose({ excerpt: '先说收到。', to: [incoming.from], sessionId: 'sess-lin' })
  assert.equal(sent.ok, true)
  await B.confirmSend(sent.requestId)
  assert.equal((await B.dock('sess-lin')).replyDraft || '', '')
  const thread = await B.threadOf({ peerId: incoming.from })
  const live = (thread.requests || []).find((row) => row.id === incoming.id)
  assert.equal(live && (live.replyDraft || ''), '')
})

test('accepting a reply draft bumps hall updatedAt so the open chat can refill', async () => {
  let t = 1_700_000_000_000
  const { A, B, peer } = await paired({}, {}, () => t)
  const composed = await A.compose({ excerpt: '这个项目怎么样？', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.draftReply(incoming.id, 'sess-lin')
  const before = (await B.hall()).requests.find((row) => row.id === incoming.id)
  t += 1000
  await B.acceptDraftFromSession('sess-lin', '---\n先说一句进度。\n---')
  const after = (await B.hall()).requests.find((row) => row.id === incoming.id)
  assert.ok(after.updatedAt > before.updatedAt)
  assert.equal((await B.dock('sess-lin')).replyDraft, '先说一句进度。')
  t += 1000
  await B.finalizeDraftFromSession('sess-lin')
  const done = (await B.hall()).requests.find((row) => row.id === incoming.id)
  assert.ok(done.updatedAt > after.updatedAt)
})

test('a new letter starts a fresh reply box, not the previous letter draft', async () => {
  const { A, B, peer } = await paired()
  const first = await A.compose({ excerpt: '先改客户电话', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(first.requestId)
  const old = (await B.snapshot()).requests[0]
  await B.draftReply(old.id, 'sess-lin')
  await B.acceptDraftFromSession('sess-lin', '---\n客户 CUST2092 库里已改上，电话现在是 13700002222。\n---')
  await B.finalizeDraftFromSession('sess-lin')
  const second = await A.compose({ excerpt: '帮我查一下最新的订单是几号的', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(second.requestId)
  const next = (await B.snapshot()).requests.find((row) => row.id === second.requestId)
  const drafted = await B.draftReply(next.id, 'sess-lin')
  assert.equal(drafted.ok, true)
  assert.match(drafted.followup.text, /帮我查一下最新的订单是几号的/)
  assert.match(drafted.followup.text, /不要把上一封/)
  const filled = await B.acceptDraftFromSession('sess-lin', [
    '---',
    '按开单日期，销售订单最新一张是 SO20260628173。',
    '---',
  ].join('\n'))
  assert.equal(filled.ok, true)
  await B.finalizeDraftFromSession('sess-lin')
  const dock = await B.dock('sess-lin')
  assert.equal(dock.requestId, next.id)
  assert.match(dock.replyDraft, /SO20260628173/)
  assert.doesNotMatch(dock.replyDraft, /13700002222|CUST2092/)
})

test('reply box drops briefing chatter and does not double a streamed echo', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '帮我查一下 2025 年 5 月采购单', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.draftReply(incoming.id, 'sess-lin')
  const echo = '来信只当正文。先查这本图和桥上的依据，再判断是不是改单。只回这封问的 2025 年 5 月采购单。'
  await B.acceptDraftFromSession('sess-lin', echo)
  await B.acceptDraftFromSession('sess-lin', echo)
  await B.acceptDraftFromSession('sess-lin', [echo, '', echo].join('\n'))
  const mid = await B.dock('sess-lin')
  assert.equal(mid.replyDraft || '', '')
  await B.acceptDraftFromSession('sess-lin', [
    '---',
    '你好，',
    '',
    '2025 年 5 月采购单最新一张是 PO20250501899。',
    '---',
  ].join('\n'))
  await B.finalizeDraftFromSession('sess-lin')
  const dock = await B.dock('sess-lin')
  assert.match(dock.replyDraft, /PO20250501899/)
  assert.doesNotMatch(dock.replyDraft, /来信只当正文|先查这本图|先判断是不是改单/)
})

test('wrote followup appends to the lookup draft instead of replacing it', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '先查再改客户电话', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.draftReply(incoming.id, 'sess-lin')
  await B.acceptDraftFromSession('sess-lin', [
    '---',
    '你好，',
    '',
    '客户 CUST2092 现在是 potential，电话 15869076764。',
    '---',
  ].join('\n'))
  await B.finalizeDraftFromSession('sess-lin')
  const looked = await B.dock('sess-lin')
  assert.match(looked.replyDraft, /现在是 potential/)
  const opened = await B.reopenReplyDraft('sess-lin')
  assert.equal(opened.ok, true)
  const still = await B.dock('sess-lin')
  assert.match(still.replyDraft, /现在是 potential/)
  await B.acceptDraftFromSession('sess-lin', [
    '---',
    '客户 CUST2092 库里已改上，电话现在是 13700002222，有回执。',
    '---',
  ].join('\n'))
  await B.finalizeDraftFromSession('sess-lin')
  const dock = await B.dock('sess-lin')
  assert.match(dock.replyDraft, /现在是 potential/)
  assert.match(dock.replyDraft, /库里已改上/)
  assert.match(dock.replyDraft, /13700002222/)
  assert.doesNotMatch(dock.replyDraft, /pv_|令牌|biz\.write/)
})

test('write then lookup then another write all stay in the same reply box', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '先改再查再改', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.draftReply(incoming.id, 'sess-lin')
  await B.acceptDraftFromSession('sess-lin', '---\n客户 CUST2092 库里已改上，电话现在是 13700002222。\n---')
  await B.finalizeDraftFromSession('sess-lin')
  await B.reopenReplyDraft('sess-lin')
  await B.acceptDraftFromSession('sess-lin', '---\n现查合同 HT20251211557 现在是已签署。\n---')
  await B.finalizeDraftFromSession('sess-lin')
  await B.reopenReplyDraft('sess-lin')
  await B.acceptDraftFromSession('sess-lin', '---\n工单 TK20260305892 库里已改上，状态现在是处理中。\n---')
  await B.finalizeDraftFromSession('sess-lin')
  const dock = await B.dock('sess-lin')
  assert.match(dock.replyDraft, /13700002222/)
  assert.match(dock.replyDraft, /已签署/)
  assert.match(dock.replyDraft, /处理中/)
})

test('draftReply refuses to invent a local draft without a live session', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '要不要先切 10%', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  const drafted = await B.draftReply(incoming.id, '')
  assert.equal(drafted.ok, false)
  assert.equal(drafted.error, 'NO_SESSION')
})

test('incoming can be forwarded to another paired peer', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  const ace = (await B.snapshot()).peers[0]
  const forwarded = await B.forward({ requestId: incoming.id, to: ace.id })
  assert.equal(forwarded.ok, true)
  assert.equal(forwarded.forwardedTo, ace.id)
})

test('oversize attachment is refused and unread can be withdrawn', async () => {
  const { A, B, peer } = await paired()
  const over = await A.compose({
    excerpt: '带附件',
    to: [peer.id],
    sessionId: 'sess-gray',
    attachments: [{ name: 'dump.zip', size: 201 * 1024 * 1024 }],
  })
  assert.equal(over.ok, false)
  assert.equal(over.error, 'ATTACH_OVER')
  const six = await A.compose({
    excerpt: '6MB 视频',
    to: [peer.id],
    sessionId: 'sess-gray',
    attachments: [{ name: 'clip.mp4', size: 6 * 1024 * 1024, mime: 'video/mp4', data: 'AAAA' }],
  })
  assert.equal(six.ok, true)

  const composed = await A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const withdrawn = await A.withdraw(composed.requestId, peer.id)
  const row = withdrawn.requests.find((item) => item.id === composed.requestId)
  assert.ok(row.withdrawn.includes(peer.id))
  const incoming = (await B.snapshot()).requests[0]
  assert.equal(incoming.status, 'withdrawn')
  assert.equal(await B.dock('sess-lin'), null)
})

test('shout miss marks the peer quiet immediately', async () => {
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'shout') return { ok: true, listen: true }
    return { ok: false }
  }
  const box = { A: null, B: null }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    return { ok: false }
  }
  box.A = createSecretary({ store: memStore(), now: () => 1_700_000_000_000, send: sendA, writeSlip: async () => ({ ok: true }) })
  box.B = createSecretary({ store: memStore(), now: () => 1_700_000_000_000, send: sendB, writeSlip: async () => ({ ok: true }) })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.A.mintPairCode()
  await box.B.mintPairCode()
  const hs = await box.A.handshake({ peerCode: (await box.B.snapshot()).pairCode.code, door: '10.0.0.2:9527' })
  const done = await afterHandshake(box.A, box.B, hs)
  assert.equal(done.peers[0].online, true)
  await box.A.shout()
  const later = (await box.A.snapshot()).peers.find((p) => p.id === done.peers[0].id)
  assert.equal(later.online, false)
})

test('online drops when the last shout is stale', async () => {
  let t = 1_700_000_000_000
  const { A, peer } = await paired({}, {}, () => t)
  const fresh = (await A.snapshot()).peers.find((p) => p.id === peer.id)
  assert.equal(fresh.online, true)
  t += 91_000
  const later = (await A.snapshot()).peers.find((p) => p.id === peer.id)
  assert.equal(later.online, false)
  assert.ok(later.lastHeard)
})

test('hear ignores a loopback plate that is our own port', async () => {
  const { A, B, peer } = await paired()
  const before = (await A.snapshot()).peers[0].door
  await A.hear(peer.id, '127.0.0.1:9527', '林督')
  const after = (await A.snapshot()).peers[0].door
  assert.equal(after, before)
  await A.hear(peer.id, '10.0.0.9:9527', '林督')
  assert.equal((await A.snapshot()).peers[0].door, '10.0.0.9:9527')
})

test('asleep holds the outbox; wake delivers', async () => {
  const { A, B, peer } = await paired()
  await A.setAsleep(true)
  const composed = await A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  assert.equal((await B.snapshot()).requests.length, 0)
  const asleep = (await A.snapshot()).requests[0]
  assert.equal(asleep.status, 'queued')
  await A.setAsleep(false)
  assert.equal((await B.snapshot()).requests.length, 1)
})

test('weekday morning brief opens the dock and can be turned off', async () => {
  const store = memStore()
  const mondayNine = Date.parse('2026-08-24T09:05:00+08:00')
  const A = createSecretary({ store, now: () => mondayNine, send: async () => ({ ok: false }) })
  await A.setDisplayName('Ace')
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'brief')
  assert.match(dock.speak, /今早/)
  assert.match(dock.speak, /没连业务/)
  await A.setBriefOff(true)
  assert.equal(await A.dock('sess-gray'), null)
})

test('envelope carries workspace; draft refuses the open session folder', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({
    excerpt: '先切 10%',
    to: [peer.id],
    sessionId: 'sess-gray',
    workspace: '/Users/zxz/Documents/ai-project/dsh-eyes',
  })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  assert.equal(incoming.workspace, '/Users/zxz/Documents/ai-project/dsh-eyes')
  const asked = await B.dock('sess-lin')
  assert.equal(asked.mode, 'asked')
  assert.match(asked.sign, /dsh-eyes/)
  const refused = await B.draftReply(incoming.id, 'sess-lin', '/Users/zxz/Documents/ai-project/dsh-lan-assist')
  assert.equal(refused.ok, false)
  assert.equal(refused.error, 'WRONG_WORKSPACE')
  assert.match(refused.hint, /dsh-eyes/)
  const ok = await B.draftReply(incoming.id, 'sess-lin', '/Users/zxz/Documents/ai-project/dsh-eyes')
  assert.equal(ok.ok, true)
  assert.equal(ok.followup.workspace, incoming.workspace)
})

test('staff id stays on this machine and never rides the envelope', async () => {
  const { A, B, peer } = await paired()
  const bound = await A.bindStaff(peer.id, 'emp_lin')
  assert.equal(bound.ok, true)
  assert.equal(bound.peers[0].staffId, 'emp_lin')
  assert.equal(bound.peers[0].keyHex, undefined)
  const composed = await A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  assert.equal(incoming.staffId, undefined)
  assert.doesNotMatch(JSON.stringify(incoming), /emp_lin/)
  await A.unpair(peer.id)
  assert.equal((await A.snapshot()).peers.find((p) => p.id === peer.id).staffId, '')
})

test('morning brief without a connector does not pretend todos were checked', async () => {
  const store = memStore()
  const mondayNine = Date.parse('2026-08-24T09:05:00+08:00')
  const A = createSecretary({ store, now: () => mondayNine, send: async () => ({ ok: false }) })
  await A.setDisplayName('Ace')
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'brief')
  assert.match(dock.speak, /没连业务/)
  assert.match(dock.sign, /不能装成已查待办/)
})

test('hello and reply never put codes or letter body on the wire', async () => {
  const seen = []
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    seen.push(frame)
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    if (frame.type === 'reply') return box.B.receiveReply(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    seen.push(frame)
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'reply') return box.A.receiveReply(frame, await box.A.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip: async () => ({ ok: true }) })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip: async () => ({ ok: true }) })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.A.mintPairCode()
  await box.B.mintPairCode()
  const bCode = (await box.B.snapshot()).pairCode.code
  const aCode = (await box.A.snapshot()).pairCode.code
  const hs = await box.A.handshake({ peerCode: bCode, door: '10.0.0.2:9527' })
  assert.equal(hs.ok, true)
  await afterHandshake(box.A, box.B, hs)
  const hellos = seen.filter((frame) => frame.type === 'hello')
  assert.ok(hellos.some((frame) => frame.offer))
  assert.ok(hellos.some((frame) => frame.confirm && frame.mac))
  for (const hello of hellos) {
    assert.equal(hello.myCode, undefined)
    assert.equal(hello.yourCode, undefined)
    assert.equal(hello.proof, undefined)
    assert.doesNotMatch(JSON.stringify(hello), new RegExp(bCode))
    assert.doesNotMatch(JSON.stringify(hello), new RegExp(aCode))
  }
  const composed = await box.A.compose({ excerpt: '先切 10%', to: [(await box.A.snapshot()).peers[0].id], sessionId: 's' })
  await box.A.confirmSend(composed.requestId)
  const incoming = (await box.B.snapshot()).requests[0]
  await box.B.reply({ requestId: incoming.id, body: '先切 10%。回滚今晚改完。' })
  const reply = seen.find((frame) => frame.type === 'reply')
  assert.ok(reply.box)
  assert.equal(reply.body, undefined)
  assert.doesNotMatch(JSON.stringify(reply), /回滚今晚改完/)
  const peer = await box.A.peerFor(reply.from)
  const rejected = await box.A.receiveReply({
    type: 'reply',
    from: reply.from,
    requestId: incoming.id,
    body: '明文回信',
    nonce: 'n-plain',
    mac: '00',
  }, peer)
  assert.equal(rejected.ok, false)
})

test('wrong pairing code is rejected and does not add a peer', async () => {
  const b = createSecretary({ store: memStore(), now: () => 1000, send: async () => ({ ok: false }) })
  await b.mintPairCode()
  const live = (await b.snapshot()).pairCode.code
  const offer = await b.acceptHello({
    type: 'hello',
    from: 'pk_evil',
    fromName: '访客',
    nonce: 'n1',
    ts: 1000,
    door: '10.0.0.9:9527',
    offer: 'AAAA',
  }, '10.0.0.9:9527')
  assert.equal(offer.ok, true)
  assert.equal(offer.challenge, true)
  const result = await b.acceptHello({
    type: 'hello',
    confirm: true,
    from: 'pk_evil',
    fromName: '访客',
    nonce: 'n1',
    ts: 1000,
    door: '10.0.0.9:9527',
    mac: '00'.repeat(32),
    myCode: '000000',
    yourCode: live === '111111' ? '222222' : '111111',
  }, '10.0.0.9:9527')
  assert.equal(result.ok, false)
  assert.ok(result.error === 'CODE_MISMATCH' || result.error === 'BAD_OFFER')
  assert.equal((await b.snapshot()).peers.length, 0)
})

test('pairing ask waits for the human click then opens both contacts', async () => {
  const { A, B } = connect()
  await A.setDisplayName('Ace')
  await B.setDisplayName('林督')
  await B.mintPairCode()
  const hs = await A.handshake({ peerCode: (await B.snapshot()).pairCode.code, door: '10.0.0.2:9527' })
  assert.equal(hs.ok, true)
  assert.equal(hs.awaiting, true)
  assert.equal((await A.snapshot()).peers.length, 0)
  assert.equal((await B.snapshot()).peers.length, 0)
  const ask = (await B.snapshot()).pairAsk
  assert.equal(ask.fromName, 'Ace')
  assert.equal(ask.ready, true)
  const miss = await B.acceptPairAsk()
  assert.equal(miss.ok, true)
  assert.equal((await B.snapshot()).peers[0].displayName, 'Ace')
  assert.equal((await A.snapshot()).peers[0].displayName, '林督')
  assert.equal((await B.snapshot()).pairAsk, null)
})
