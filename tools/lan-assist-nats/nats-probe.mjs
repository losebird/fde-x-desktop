#!/usr/bin/env node
/**
 * Official nats.js roundtrip. LAN stays available if this fails.
 */
import { relayCredsPath, relayUrl } from '../nats-relay.js'

const url = relayUrl()
if (!url) {
  console.error('未设置 DSH_LAN_ASSIST_NATS')
  process.exit(1)
}

let nats
try {
  nats = await import('nats')
} catch {
  console.error('未安装官方 nats.js：npm i nats')
  process.exit(1)
}

const conf = { servers: url }
const creds = relayCredsPath()
if (creds) {
  const { readFile } = await import('node:fs/promises')
  conf.authenticator = nats.credsAuthenticator(await readFile(creds))
}

const nc = await nats.connect(conf)
const subject = `dsh.v1.probe.${Date.now()}`
const sub = nc.subscribe(subject, { max: 1 })
const body = JSON.stringify({ type: 'probe', ts: Date.now() })
await nc.flush()
await nc.publish(subject, body)
let text = ''
for await (const msg of sub) {
  text = typeof msg.data === 'string' ? msg.data : new TextDecoder().decode(msg.data)
  break
}
await nc.close()
if (!text.includes('"probe"')) {
  console.error('中继回环对不上')
  process.exit(1)
}
console.log(`ok ${url}`)
