/**
 * Optional NATS publish/subscribe for letter frames.
 * Off unless DSH_LAN_ASSIST_NATS is set. Pairing hello stays on LAN.
 * @module dsh-lan-assist/nats-relay
 */

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { randomHex } from './crypto.js'
import { assistHome, CODE_TTL_MS, RELAY_INLINE_MAX, RELAY_OBJECT_QUOTA } from './home.js'

let storedUrl = ''
let storedCreds = ''

export function setRelayStore({ url, credsPath } = {}) {
  if (url !== undefined) storedUrl = String(url || '').trim()
  if (credsPath !== undefined) storedCreds = String(credsPath || '').trim()
}

export function relayUrl() {
  return String(process.env.DSH_LAN_ASSIST_NATS || storedUrl || '').trim()
}

export function relayCredsPath() {
  return String(process.env.DSH_LAN_ASSIST_NATS_CREDS || storedCreds || '').trim()
}

export function packRelayUrl(raw) {
  const url = String(raw || '').trim()
  if (!url) return { ok: true, url: '' }
  if (!/^(nats|tls|ws|wss):\/\//i.test(url)) {
    return { ok: false, error: 'BAD_URL', hint: '中继地址要用 nats:// 或 wss://。' }
  }
  return { ok: true, url }
}

export function packRelayCredsPath(raw) {
  const path = String(raw || '').trim()
  if (!path) return { ok: true, path: '' }
  if (!isAbsolute(path) || path.includes('..')) {
    return { ok: false, error: 'BAD_PATH', hint: '令牌文件用本机绝对路径。' }
  }
  return { ok: true, path }
}

export function relayQuotaBytes() {
  const n = Number(process.env.DSH_LAN_ASSIST_NATS_QUOTA)
  return Number.isFinite(n) && n > 0 ? n : RELAY_OBJECT_QUOTA
}

export async function takeNatsInboxLock(dir) {
  const root = String(dir || assistHome())
  await mkdir(root, { recursive: true })
  const dest = join(root, 'nats-inbox.lock')
  try {
    await writeFile(dest, String(process.pid), { encoding: 'utf8', flag: 'wx' })
  } catch {
    let pid = 0
    try { pid = Number(await readFile(dest, 'utf8')) } catch { pid = 0 }
    if (pid === process.pid) return null
    if (pid) {
      try {
        process.kill(pid, 0)
        return null
      } catch { /* stale lock */ }
    }
    await writeFile(dest, String(process.pid), 'utf8')
  }
  return async () => { try { await unlink(dest) } catch { /* ignore */ } }
}

export function inboxSubject(deviceId) {
  const id = String(deviceId || '').replace(/[^A-Za-z0-9._-]/g, '')
  return id ? `dsh.v1.inbox.${id}` : ''
}

export function inviteLive(row, now) {
  if (!row || typeof row !== 'object' || row.revoked) return false
  const session = String(row.session || '').trim()
  if (!session) return false
  return Number(row.expiresAt) > Number(now || 0)
}

export function mintRelayInvite({ relay, deviceId, now } = {}) {
  const url = String(relay || relayUrl()).trim()
  const device = String(deviceId || '').replace(/[^A-Za-z0-9._-]/g, '')
  if (!url) return { ok: false, error: 'NO_RELAY', hint: '没配中继地址，不能发邀请。' }
  if (!device) return { ok: false, error: 'NO_SELF', hint: '先设本机名字。' }
  const at = Number(now) || Date.now()
  return {
    ok: true,
    invite: {
      relay: url,
      device,
      session: randomHex(8),
      expiresAt: at + CODE_TTL_MS,
    },
  }
}

export function deliveryId(frame) {
  const id = String((frame && frame.requestId) || '').trim()
  const to = String((frame && frame.to) || '').trim()
  const nonce = String((frame && frame.nonce) || '').trim()
  return id && to ? `${id}:${to}:${nonce}` : ''
}

async function publishRaw(nc, subject, body, msgID) {
  if (nc && typeof nc.jetstream === 'function') {
    try {
      const js = nc.jetstream()
      if (js && typeof js.publish === 'function') {
        await js.publish(subject, body, msgID ? { msgID } : {})
        return
      }
    } catch { /* no stream for this subject */ }
  }
  if (!nc || typeof nc.publish !== 'function') throw new Error('NO_NATS')
  await nc.publish(subject, body)
}

function objectName(frame) {
  const id = deliveryId(frame).replace(/[^A-Za-z0-9._-]/g, '_')
  return id || 'frame'
}

async function objectsOf(nc, extra) {
  if (typeof extra === 'function') {
    const store = extra()
    return store && typeof store.then === 'function' ? await store : store
  }
  if (nc && typeof nc.jetstream === 'function') {
    const js = nc.jetstream()
    if (js && js.views && typeof js.views.os === 'function') {
      const os = js.views.os('dsh-v1-mail')
      return os && typeof os.then === 'function' ? await os : os
    }
  }
  return null
}

async function publishFrame(nc, subject, frame, extra) {
  const body = JSON.stringify(frame)
  const msgID = deliveryId(frame)
  if (Buffer.byteLength(body) <= RELAY_INLINE_MAX) {
    await publishRaw(nc, subject, body, msgID)
    return
  }
  const store = await objectsOf(nc, extra)
  if (!store || typeof store.put !== 'function') throw new Error('TOO_BIG')
  const name = objectName(frame)
  await store.put(name, body)
  await publishRaw(nc, subject, JSON.stringify({ type: 'relay-object', name, to: frame.to }), msgID)
}

export function createNatsTransport(opts = {}) {
  const connect = opts.connect
  const objects = opts.objects
  function urlNow() {
    if (typeof opts.url === 'function') return String(opts.url() || '').trim()
    if (opts.url != null && String(opts.url).trim()) return String(opts.url).trim()
    return relayUrl()
  }
  function credsNow() {
    if (typeof opts.creds === 'function') return String(opts.creds() || '').trim()
    if (opts.creds != null && String(opts.creds).trim()) return String(opts.creds).trim()
    return relayCredsPath()
  }
  if (!urlNow() && typeof connect !== 'function' && !opts.lazy) return null

  let client = null
  let listening = false
  let connected = false
  let boundUrl = ''

  function liveClient() {
    if (client && typeof client.isClosed === 'function' && client.isClosed()) {
      client = null
      connected = false
    }
    return client
  }

  async function chargeQuota(from, bytes) {
    const cap = Number(opts.quota) > 0 ? Number(opts.quota) : relayQuotaBytes()
    const file = String(opts.quotaFile || join(assistHome(), 'nats-quota.json'))
    await mkdir(join(file, '..'), { recursive: true })
    let map = {}
    try { map = JSON.parse(await readFile(file, 'utf8')) } catch { map = {} }
    if (!map || typeof map !== 'object') map = {}
    const key = String(from || 'anon').replace(/[^A-Za-z0-9._-]/g, '') || 'anon'
    const used = Number(map[key] || 0)
    if (used + bytes > cap) throw new Error('QUOTA')
    map[key] = used + bytes
    await writeFile(file, `${JSON.stringify(map)}\n`, 'utf8')
  }

  async function ensure() {
    const nextUrl = urlNow()
    if (!nextUrl && typeof connect !== 'function') {
      connected = false
      return null
    }
    const live = liveClient()
    if (live && boundUrl === nextUrl) return live
    if (live && boundUrl !== nextUrl) {
      connected = false
      client = null
      if (typeof live.close === 'function') {
        try { await live.close() } catch { /* ignore */ }
      }
    }
    const conf = { servers: nextUrl }
    if (typeof opts.authenticator === 'function') conf.authenticator = opts.authenticator
    const credsFile = credsNow()
    if (credsFile && !conf.authenticator) {
      const { readFile } = await import('node:fs/promises')
      conf.creds = await readFile(credsFile)
    }
    try {
      if (typeof connect === 'function') {
        client = await connect(nextUrl, conf)
      } else {
        let mod
        try {
          mod = await import('nats')
        } catch {
          connected = false
          return null
        }
        if (!mod || typeof mod.connect !== 'function') {
          connected = false
          return null
        }
        if (conf.creds && typeof mod.credsAuthenticator === 'function') {
          conf.authenticator = mod.credsAuthenticator(conf.creds)
          delete conf.creds
        }
        client = await mod.connect(conf)
      }
    } catch {
      client = null
      connected = false
      return null
    }
    connected = !!client
    boundUrl = nextUrl
    return client
  }

  return {
    name: 'nats',
    status() {
      liveClient()
      const configured = !!(urlNow() || typeof connect === 'function')
      return { configured, connected: !!(configured && connected) }
    },
    async send(_door, frame) {
      if (!frame || frame.type === 'hello') return { ok: false, error: 'NO_RELAY_PAIR' }
      const subject = inboxSubject(frame.to || (String(frame.type || '').startsWith('pair.') ? frame.to : ''))
      if (!subject) return { ok: false, error: 'NO_PEER' }
      const nc = await ensure()
      if (!nc) return { ok: false, error: 'NO_NATS' }
      try {
        await publishFrame(nc, subject, frame, async () => {
          const store = typeof objects === 'function' ? await objects() : await objectsOf(nc)
          if (!store) return null
          return {
            put: async (name, body) => {
              await chargeQuota(String((frame && frame.from) || ''), Buffer.byteLength(String(body)))
              return store.put(name, body)
            },
            get: (name) => store.get(name),
          }
        })
        return { ok: true }
      } catch (error) {
        const code = error && error.message
        return { ok: false, error: code === 'NO_NATS' || code === 'TOO_BIG' || code === 'QUOTA' ? code : 'UNREACHABLE' }
      }
    },
    async listen(selfId, onFrame) {
      const subject = inboxSubject(selfId)
      if (!subject || typeof onFrame !== 'function' || listening) return () => undefined
      const unlock = opts.lock === false ? async () => undefined : await takeNatsInboxLock(opts.lockDir)
      if (!unlock) return () => undefined
      const nc = await ensure()
      if (!nc || typeof nc.subscribe !== 'function') {
        await unlock()
        return () => undefined
      }
      listening = true
      let stopped = false
      const sub = await nc.subscribe(subject)
      void (async () => {
        try {
          for await (const msg of sub) {
            if (stopped) break
            let frame
            try {
              const raw = msg && (msg.data != null ? msg.data : msg)
              frame = typeof raw === 'string' || raw instanceof Uint8Array
                ? JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
                : raw
            } catch { continue }
            if (frame && typeof frame === 'object') {
              if (frame.type === 'relay-object' && frame.name) {
                const store = await objectsOf(nc, objects)
                const blob = store && typeof store.get === 'function' ? await store.get(String(frame.name)) : ''
                try { frame = JSON.parse(String(blob || '')) } catch { frame = null }
              }
              if (frame && typeof frame === 'object' && frame.type !== 'relay-object') await onFrame(frame)
              if (msg && typeof msg.ack === 'function') {
                try { await msg.ack() } catch { /* at-least-once may redeliver */ }
              }
            }
          }
        } catch { /* drop on disconnect */ }
      })()
      return () => {
        stopped = true
        listening = false
        if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe()
        void unlock()
      }
    },
    async close() {
      listening = false
      connected = false
      boundUrl = ''
      const nc = client
      client = null
      if (nc && typeof nc.close === 'function') {
        try { await nc.close() } catch { /* ignore */ }
      }
    },
  }
}
