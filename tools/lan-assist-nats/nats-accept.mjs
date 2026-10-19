#!/usr/bin/env node
/**
 * Two-device relay accept: envelope then delivery ack. Not LAN hello.
 * LAN stays the default if this is not run.
 */
import { existsSync } from 'node:fs'
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

function wait(ms, label) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(label || 'TIMEOUT')), ms)
  })
}

const idA = 'pk_accept_a'
const idB = 'pk_accept_b'
const requestId = `req_accept_${Date.now()}`
const a = createNatsTransport({ creds: relayCredsPath(), lock: false })
const b = createNatsTransport({ creds: secondCreds(), lock: false })
if (!a || !b) {
  console.error('中继没配上。')
  process.exit(1)
}

let resolveEnv
let resolveAck
const envP = new Promise((resolve) => { resolveEnv = resolve })
const ackP = new Promise((resolve) => { resolveAck = resolve })

await a.listen(idA, async (frame) => {
  if (frame && frame.type === 'ack' && frame.event === 'delivery') resolveAck(frame)
})
await b.listen(idB, async (frame) => {
  if (frame && frame.type === 'envelope') resolveEnv(frame)
})

const posted = await a.send('', {
  type: 'envelope',
  from: idA,
  to: idB,
  requestId,
  nonce: 'n1',
})
if (!posted || posted.ok === false) {
  console.error(posted && posted.error ? posted.error : '没投出')
  process.exit(1)
}

const env = await Promise.race([envP, wait(8000, '信封没到对端')])
const acked = await b.send('', {
  type: 'ack',
  event: 'delivery',
  from: idB,
  to: idA,
  requestId: env.requestId,
  nonce: 'n2',
})
if (!acked || acked.ok === false) {
  console.error(acked && acked.error ? acked.error : '回执没投出')
  process.exit(1)
}
await Promise.race([ackP, wait(8000, '落盘回执没回到发送方')])
await a.close()
await b.close()
console.log(`ok envelope+delivery_ack ${requestId}`)
console.log('relayed 仍不是已收到。对端落盘回执才算送达。')
