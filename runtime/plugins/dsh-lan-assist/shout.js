/**
 * LAN shout and doorplates. Private IPv4 only. Loopback is this machine.
 * @module dsh-lan-assist/shout
 */

import { FAIL_AFTER_MS } from './home.js'
import { keyFromHex, randomHex, seenNonceKey, signFrame } from './crypto.js'

const PRIVATE_HOST = /^(10\.|192\.168\.|127\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/

export function isOwnLoopbackDoor(plate, port) {
  const next = String(plate || '').trim()
  if (!next) return true
  const host = next.split(':')[0]
  const claimedPort = Number(next.split(':')[1] || 0)
  const loopback = host === '127.0.0.1' || host === '::1' || host === 'localhost'
  return loopback && (!claimedPort || claimedPort === port)
}

/**
 * @param {object} bag
 */
export function createShout(bag) {
  const { store, now, send, selfDoor, ensureSelf, note, snapshot, port, flushOutbox } = bag

  async function markPeerQuiet(peerId) {
    await store.update((state) => {
      const peer = state.peers[peerId]
      peer && !peer.unpaired && (peer.lastHeard = 0, peer.online = false)
    })
  }

  async function shout() {
    const state = await store.get()
    if (state.asleep) return { ok: true, shouted: 0, asleep: true }
    await store.update((s) => ensureSelf(s))
    const me = (await store.get()).self
    const doors = []
    for (const peer of Object.values(state.peers || {})) {
      if (peer.unpaired || !peer.door) continue
      const host = String(peer.door).split(':')[0]
      if (!PRIVATE_HOST.test(host)) continue
      const frame = {
        type: 'shout',
        from: me.id,
        fromName: me.displayName,
        avatar: me.avatar || '',
        door: selfDoor(),
        ts: now(),
      }
      if (!peer.keyHex) {
        await send(peer.door, frame)
        continue
      }
      try {
        const signed = signFrame(keyFromHex(peer.keyHex), { ...frame, nonce: randomHex(8) })
        const sent = await send(peer.door, signed)
        sent && sent.ok && !sent.listen && doors.push(peer.door)
        sent && sent.ok && sent.listen && await markPeerQuiet(peer.id)
      } catch {
        /* 一次没喊到不立刻标离线，靠 lastHeard 超时 */
      }
    }
    return { ok: true, shouted: doors.length }
  }

  async function hear(peerId, door, displayName, avatar) {
    await store.update((state) => {
      const peer = state.peers[peerId]
      if (!peer || peer.unpaired) return
      const next = String(door || '').trim()
      const mine = selfDoor()
      next && next !== mine && !isOwnLoopbackDoor(next, port) && (peer.door = next)
      displayName && (peer.displayName = displayName)
      avatar && (peer.avatar = String(avatar).slice(0, 24))
      peer.lastHeard = now()
      peer.online = true
    })
  }

  async function setPeerDoor(peerId, door) {
    const next = String(door || '').trim()
    if (!next.includes(':')) return { ok: false, error: 'BAD_DOOR' }
    if (isOwnLoopbackDoor(next, port) || next === selfDoor()) return { ok: false, error: 'OWN_DOOR' }
    await store.update((state) => {
      const peer = state.peers[peerId]
      peer && !peer.unpaired && (peer.door = next, peer.updatedAt = now(), note(state, `门牌改为 ${next} · ${peer.displayName || peerId}`, now()))
    })
    return snapshot()
  }

  async function setAsleep(on) {
    const next = !!on
    let woke = false
    await store.update((state) => {
      ensureSelf(state)
      const was = !!state.asleep
      state.asleep = next
      next && !was && note(state, '合盖了。睡着时不装成送到。', now())
      !next && was && (woke = true, note(state, '醒来了。再喊一轮再送。', now()), (state.events || []).forEach((ev) => {
        ev && ev.silent && !ev.held && (ev.silent = false)
      }))
    })
    woke && await shout()
    woke && await flushOutbox()
    return snapshot()
  }

  async function noteSeen(from, nonce) {
    let dup = false
    await store.update((state) => {
      const key = seenNonceKey(from, nonce)
      state.seen[key] ? (dup = true) : (state.seen[key] = now())
      const cutoff = now() - FAIL_AFTER_MS
      for (const [k, ts] of Object.entries(state.seen)) {
        ts < cutoff && delete state.seen[k]
      }
    })
    return !dup
  }

  async function noteSighting({ id, displayName, door }) {
    const peerId = String(id || '')
    if (!peerId) return snapshot()
    await store.update((state) => {
      if (state.peers[peerId] && !state.peers[peerId].unpaired) {
        door && (state.peers[peerId].door = door)
        state.peers[peerId].lastHeard = now()
        state.peers[peerId].online = true
        return
      }
      state.sightings = state.sightings || {}
      state.sightings[peerId] = {
        id: peerId,
        displayName: displayName || '未信任机器',
        door: door || '',
        lastHeard: now(),
      }
    })
    return snapshot()
  }

  async function forgetSighting(id) {
    const peerId = String(id || '').trim()
    if (!peerId) return { ok: false, error: 'NO_SIGHT' }
    await store.update((state) => {
      state.sightings && state.sightings[peerId] && (delete state.sightings[peerId], note(state, `忘掉发现 · ${peerId} · 不是解除配对`, now()))
    })
    return { ok: true, ...(await snapshot()) }
  }

  async function ingestListenInbox(files, receiveEnvelope, receiveReply, receiveAck, peerFor, acceptPairFrame) {
    const list = Array.isArray(files) ? files : []
    for (const file of list) {
      const frame = file && file.frame
      if (!frame || !frame.from) continue
      if (String(frame.type || '').startsWith('pair.')) {
        typeof acceptPairFrame === 'function' && await acceptPairFrame(frame)
        continue
      }
      const peer = await peerFor(frame.from)
      if (!peer || !peer.keyHex) continue
      frame.type === 'envelope' && await receiveEnvelope(frame, peer)
      frame.type === 'reply' && await receiveReply(frame, peer)
      frame.type === 'ack' && await receiveAck(frame, peer)
    }
    return snapshot()
  }

  return {
    shout, hear, setPeerDoor, setAsleep, noteSeen, markPeerQuiet,
    noteSighting, forgetSighting, ingestListenInbox,
    isOwnLoopbackDoor: (plate) => isOwnLoopbackDoor(plate, port),
  }
}
