#!/usr/bin/env node
/**
 * Two secretaries on one machine: LAN fails, NATS carries pair+letter+delivery_ack.
 * Not two homes. Relayed is still not 已收到.
 */
import { existsSync } from 'node:fs'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { createLanFirstTransport, createLanTransport } from '../transport.js'
import { createNatsTransport, relayCredsPath, relayUrl } from '../nats-relay.js'

const url = relayUrl()
if (!url) {
  console.error('未设置 DSH_LAN_ASSIST_NATS')
  process.exit(1)
}

function secondCreds() {
  const extra = String(process.env.DSH_LAN_ASSIST_NATS_CREDS_B || '').trim()
  if (extra) return extra
  const a = relayCredsPath()
  const b = a.replace(/device\.creds$/, 'device-b.creds')
  return b !== a && existsSync(b) ? b : a
}

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

async function until(fn, ms, label) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const got = await fn()
    if (got) return got
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(label || 'TIMEOUT')
}

function onFrame(secretary) {
  return async (frame) => {
    const type = frame && frame.type
    if (type && String(type).startsWith('pair.')) {
      return secretary.acceptPairFrame(frame)
    }
    if (type === 'hello') return { ok: false, error: 'NO_RELAY_PAIR' }
    const from = String((frame && frame.from) || '')
    const peer = from ? await secretary.peerFor(from) : null
    if (!peer || peer.unpaired || !peer.keyHex) return { ok: false, error: 'KEY_REJECT' }
    if (type === 'envelope') return secretary.receiveEnvelope(frame, peer)
    if (type === 'reply') return secretary.receiveReply(frame, peer)
    if (type === 'ack') return secretary.receiveAck(frame, peer)
    return { ok: false, error: 'UNKNOWN' }
  }
}

const lan = createLanTransport({
  send: async () => ({ ok: false, error: 'UNREACHABLE' }),
})
const relayA = createNatsTransport({ creds: relayCredsPath(), lock: false })
const relayB = createNatsTransport({ creds: secondCreds(), lock: false })
if (!relayA || !relayB) {
  console.error('中继没配上。')
  process.exit(1)
}
const sendA = createLanFirstTransport({ lan, relay: relayA })
const sendB = createLanFirstTransport({ lan, relay: relayB })
const now = () => Date.now()
const A = createSecretary({ store: memStore(), now, send: (door, frame, opts) => sendA.send(door, frame, opts) })
const B = createSecretary({ store: memStore(), now, send: (door, frame, opts) => sendB.send(door, frame, opts) })

await A.setDisplayName('Ace')
await B.setDisplayName('林督')
const idA = (await A.snapshot()).self.id
const idB = (await B.snapshot()).self.id
const stopA = await relayA.listen(idA, onFrame(A))
const stopB = await relayB.listen(idB, onFrame(B))

try {
  const issued = await B.mintRelayInvite()
  if (!issued || issued.ok === false) {
    console.error((issued && issued.hint) || '没发出中继邀请')
    process.exit(1)
  }
  const hs = await A.handshake({
    session: issued.invite.session,
    device: issued.invite.device,
  })
  if (!hs || hs.ok === false) {
    console.error((hs && (hs.hint || hs.error)) || '中继配对没发出')
    process.exit(1)
  }
  await until(async () => {
    const ask = (await B.snapshot()).pairAsk
    return ask && ask.ready
  }, 20_000, '对端没收到配对请求')
  const accepted = await B.acceptPairAsk()
  if (!accepted || accepted.ok === false) {
    console.error((accepted && (accepted.hint || accepted.error)) || '没点确定')
    process.exit(1)
  }
  const peer = await until(async () => {
    const row = (await A.snapshot()).peers.find((item) => !item.unpaired)
    return row || null
  }, 20_000, '配对没完成')

  const composed = await A.compose({
    excerpt: '本机两秘书中继验收',
    to: [peer.id],
    sessionId: 'sess-accept-mail',
  })
  if (!composed || composed.ok === false) {
    console.error((composed && (composed.hint || composed.error)) || '没拟成')
    process.exit(1)
  }
  await A.confirmSend(composed.requestId)
  await until(async () => {
    const incoming = (await B.snapshot()).requests.find((row) => row.id === composed.requestId)
    return incoming || null
  }, 30_000, '对端没落盘')
  const delivered = await until(async () => {
    const row = (await A.snapshot()).requests.find((item) => item.id === composed.requestId)
    return row && row.delivered && row.delivered[peer.id] ? row : null
  }, 30_000, '落盘回执没回到发送方')
  const via = delivered && delivered.via && delivered.via[peer.id]
  if (via !== 'relay') {
    console.error(`via=${via || ''} 不是 relay`)
    process.exit(1)
  }
  console.log(`ok mail+delivery_ack ${composed.requestId}`)
  console.log('relayed 仍不是已收到。对端落盘回执才算送达。这不是两家 NAT 验收。')
} finally {
  if (typeof stopA === 'function') stopA()
  if (typeof stopB === 'function') stopB()
  await relayA.close()
  await relayB.close()
}
