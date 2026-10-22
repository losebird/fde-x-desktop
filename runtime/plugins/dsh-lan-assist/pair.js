/**
 * Pairing handshake: spoken code + LAN door. Key never leaves this machine.
 * @module dsh-lan-assist/pair
 */

import { CODE_MAX_GUESSES, CODE_TTL_MS, PAIR_HELLO_MS } from './home.js'
import {
  derivePairedKey,
  generatePairOffer,
  keyFromHex,
  pairSharedSecret,
  randomHex,
  sixDigitCode,
  signFrame,
  verifyFrame,
} from './crypto.js'

/**
 * @param {{
 *   store: { get: Function, update: Function },
 *   now: () => number,
 *   send: Function,
 *   selfDoor: () => string,
 *   ensureSelf: Function,
 *   note: Function,
 *   snapshot: Function,
 * }} bag
 */
function handshakeHint(error) {
  return ({
    UNREACHABLE: '对面门牌连不上。填对面配置里的「本机端口」，不要填网页口（3080/3181）。',
    TIMEOUT: '对面没回。确认对面 DSH 开着，配对码还没过期。',
    BAD_DOOR: '地址写成 IP:端口。同一台电脑用 127.0.0.1:对面本机端口。',
    BAD_CODE: '配对码要六位数字。',
    CODE_EXPIRED: '对面配对码过期了，让对面再开一枚。',
    CODE_LOCKED: '这枚码猜太多次，作废了。让对面再开一枚。',
    CODE_MISMATCH: '配对码不对。',
    BAD_OFFER: '握手密钥没对上，再开一枚配对码。',
  })[error] || ''
}

export function createPairing(bag) {
  const { store, now, send, selfDoor, ensureSelf, note, snapshot } = bag
  const inviteLive = typeof bag.inviteLive === 'function' ? bag.inviteLive : async () => false

  async function mintPairCode() {
    await store.update((state) => {
      ensureSelf(state)
      state.pairCode = {
        code: sixDigitCode(),
        expiresAt: now() + CODE_TTL_MS,
        guesses: 0,
      }
      state.pairAsk = null
    })
    return snapshot()
  }

  async function handshakeRelay({ session, device, peerName }) {
    await store.update((s) => ensureSelf(s))
    const me = (await store.get()).self
    const offer = generatePairOffer()
    const nonce = randomHex(16)
    await store.update((s) => {
      s.pairWait = {
        id: device,
        session,
        displayName: peerName || '同事',
        door: '',
        privateKey: offer.privateKey,
        nonce,
      }
      note(s, `中继配对已投出，等对面点确定 · ${device}`, now())
    })
    const posted = await send('', {
      type: 'pair.offer',
      from: me.id,
      fromName: me.displayName,
      to: device,
      session,
      nonce,
      ts: now(),
      door: selfDoor(),
      offer: offer.publicKey,
    })
    if (!posted || posted.ok === false) {
      await store.update((s) => { s.pairWait = null })
      const error = (posted && posted.error) || 'UNREACHABLE'
      return { ok: false, error, hint: handshakeHint(error) || '中继没投出握手。' }
    }
    return { ok: true, awaiting: true, hint: '已投到中继，等对面点确定。不是已配对。', ...(await snapshot()) }
  }

  async function handshake({ peerCode, door, peerName, session, device }) {
    const inviteSession = String(session || '').replace(/[^A-Za-z0-9._-]/g, '')
    const inviteDevice = String(device || '').replace(/[^A-Za-z0-9._-]/g, '')
    if (inviteSession && inviteDevice) return handshakeRelay({ session: inviteSession, device: inviteDevice, peerName })
    const code = String(peerCode || '').replace(/\D/g, '')
    const plate = String(door || '').trim()
    const bad = (!/^\d{6}$/.test(code) && { ok: false, error: 'BAD_CODE' })
      || (!plate.includes(':') && { ok: false, error: 'BAD_DOOR' })
    if (bad) return { ...bad, hint: handshakeHint(bad.error) }
    await store.update((s) => ensureSelf(s))
    const me = (await store.get()).self
    const offer = generatePairOffer()
    const nonce = randomHex(16)
    const myDoor = selfDoor()
    const challenged = await send(plate, {
      type: 'hello',
      from: me.id,
      fromName: me.displayName,
      avatar: me.avatar || '',
      to: '',
      nonce,
      ts: now(),
      door: myDoor,
      offer: offer.publicKey,
    }, { timeoutMs: PAIR_HELLO_MS })
    const noOffer = !challenged || !challenged.offer || !challenged.peerId
    if (noOffer) {
      const error = (challenged && challenged.error) || 'UNREACHABLE'
      return { ok: false, error, hint: handshakeHint(error) || handshakeHint('UNREACHABLE') }
    }
    const theirId = String(challenged.peerId)
    let shared
    try {
      shared = pairSharedSecret(offer.privateKey, challenged.offer)
    } catch {
      return { ok: false, error: 'BAD_OFFER' }
    }
    const key = derivePairedKey({
      shared,
      spokenCode: code,
      idA: me.id,
      idB: theirId,
      nonce,
    })
    const confirmed = await send(plate, signFrame(key, {
      type: 'hello',
      confirm: true,
      from: me.id,
      fromName: me.displayName,
      to: theirId,
      nonce,
      ts: now(),
      door: myDoor,
    }), { timeoutMs: PAIR_HELLO_MS })
    if (!confirmed || confirmed.ok === false) {
      const error = (confirmed && confirmed.error) || 'CODE_MISMATCH'
      return { ok: false, error, hint: handshakeHint(error) }
    }
    await store.update((s) => {
      ensureSelf(s)
      s.pairWait = {
        id: theirId,
        displayName: confirmed.displayName || peerName || '同事',
        door: plate,
        keyHex: key.toString('hex'),
        nonce,
      }
      note(s, `配对请求已发给对面，等对方点确定 · ${theirId}`, now())
    })
    return { ok: true, awaiting: true, ...(await snapshot()) }
  }

  async function acceptPairConfirm(frame, remoteDoor) {
    await store.update((s) => ensureSelf(s))
    const me = (await store.get()).self
    const live = (await store.get()).pairCode
    const expired = !live || live.expiresAt <= now()
    const locked = live && live.guesses >= CODE_MAX_GUESSES
    if (expired) return { ok: false, error: 'CODE_EXPIRED' }
    if (locked) return { ok: false, error: 'CODE_LOCKED' }
    const pending = live.pending
    const mismatch = !pending || pending.from !== String(frame.from || '') || pending.nonce !== String(frame.nonce || '')
    if (mismatch) return { ok: false, error: 'NO_CHALLENGE' }
    let shared
    try {
      shared = pairSharedSecret(pending.privateKey, pending.offer)
    } catch {
      return { ok: false, error: 'BAD_OFFER' }
    }
    const key = derivePairedKey({
      shared,
      spokenCode: live.code,
      idA: me.id,
      idB: pending.from,
      nonce: pending.nonce,
    })
    if (!verifyFrame(key, frame)) {
      await store.update((s) => {
        s.pairCode && (s.pairCode.guesses = (s.pairCode.guesses || 0) + 1)
      })
      return { ok: false, error: 'CODE_MISMATCH' }
    }
    await store.update((s) => {
      ensureSelf(s)
      s.pairCode.pending.keyHex = key.toString('hex')
      s.pairCode.pending.verified = true
      s.pairAsk = {
        from: pending.from,
        fromName: frame.fromName || pending.fromName || '同事',
        door: remoteDoor || pending.door || '',
        at: now(),
        ready: true,
      }
      note(s, `收到配对请求 · ${frame.fromName || pending.fromName || pending.from}`, now())
    })
    return {
      ok: true,
      awaiting: true,
      peerId: me.id,
      displayName: me.displayName,
      door: selfDoor(),
    }
  }

  function keepPeer(s, id, fields) {
    s.peers[id] = {
      id,
      displayName: fields.displayName || '同事',
      avatar: fields.avatar || '',
      door: fields.door || '',
      keyHex: fields.keyHex || '',
      lastHeard: now(),
      online: true,
      unpaired: false,
    }
  }

  async function acceptPairedAck(frame, remoteDoor) {
    const wait = (await store.get()).pairWait
    if (!wait || wait.id !== String(frame.from || '')) return { ok: false, error: 'NO_WAIT' }
    let key
    try { key = keyFromHex(wait.keyHex) } catch { return { ok: false, error: 'BAD_KEY' } }
    if (!verifyFrame(key, frame)) return { ok: false, error: 'BAD_MAC' }
    await store.update((s) => {
      ensureSelf(s)
      keepPeer(s, wait.id, {
        displayName: frame.fromName || wait.displayName,
        door: remoteDoor || wait.door,
        keyHex: wait.keyHex,
      })
      s.pairWait = null
      s.pairCode = null
      note(s, `已互存稳定 ID 与共享密钥 · ${wait.id}`, now())
    })
    return { ok: true, peerId: wait.id }
  }

  async function acceptHello(frame, remoteDoor) {
    if (frame && frame.paired) return acceptPairedAck(frame, remoteDoor)
    if (frame && frame.reject) {
      await store.update((s) => {
        s.pairWait && s.pairWait.id === String(frame.from || '') && (s.pairWait = null)
      })
      return { ok: true, rejected: true }
    }
    if (frame && frame.confirm) return acceptPairConfirm(frame, remoteDoor)
    await store.update((s) => ensureSelf(s))
    const me = (await store.get()).self
    const live = (await store.get()).pairCode
    const expired = !live || live.expiresAt <= now()
    const locked = live && live.guesses >= CODE_MAX_GUESSES
    if (expired) return { ok: false, error: 'CODE_EXPIRED' }
    if (locked) return { ok: false, error: 'CODE_LOCKED' }
    const theirId = String(frame.from || '')
    const theirOffer = String(frame.offer || '')
    const nonce = String(frame.nonce || '')
    if (!theirId || !theirOffer || !nonce) return { ok: false, error: 'NO_PEER' }
    const mine = generatePairOffer()
    await store.update((s) => {
      s.pairCode && (s.pairCode.pending = {
        from: theirId,
        fromName: frame.fromName || '同事',
        offer: theirOffer,
        privateKey: mine.privateKey,
        publicKey: mine.publicKey,
        nonce,
        door: remoteDoor || '',
      })
      s.pairAsk = {
        from: theirId,
        fromName: frame.fromName || '同事',
        avatar: frame.avatar || '',
        door: remoteDoor || '',
        at: now(),
        ready: false,
      }
    })
    return {
      ok: true,
      challenge: true,
      peerId: me.id,
      displayName: me.displayName,
      avatar: me.avatar || '',
      door: selfDoor(),
      offer: mine.publicKey,
    }
  }

  async function acceptPairAsk() {
    const state = await store.get()
    const live = state.pairCode
    const ask = state.pairAsk
    const pending = ask && ask.session
      ? (state.relayInvites && state.relayInvites[ask.session] && state.relayInvites[ask.session].pending)
      : (live && live.pending)
    if (!ask || !ask.ready || !pending || !pending.verified || !pending.keyHex) {
      return { ok: false, error: 'NO_ASK', hint: '还没有待确定的配对请求。' }
    }
    const me = (await store.get()).self
    const door = ask.door
    const keyHex = pending.keyHex
    let signed
    try {
      signed = signFrame(keyFromHex(keyHex), {
        type: ask.session ? 'pair.accept' : 'hello',
        paired: true,
        from: me.id,
        fromName: me.displayName,
        avatar: me.avatar || '',
        to: ask.from,
        nonce: pending.nonce,
        ts: now(),
        door: selfDoor(),
        ...(ask.session ? { session: ask.session } : {}),
      })
    } catch {
      return { ok: false, error: 'BAD_KEY' }
    }
    const dest = ask.session ? '' : door
    const target = dest || door
    if (!target) {
      return { ok: false, error: 'NO_DOOR', hint: '没有对端门牌，无法完成配对。' }
    }
    const sent = await send(target, signed, { timeoutMs: PAIR_HELLO_MS })
    if (!sent || sent.ok === false) {
      const error = (sent && sent.error) || 'UNREACHABLE'
      return { ok: false, error, hint: handshakeHint(error) || '通知对端失败。两边都不要点确定，请对端重新填码配对。' }
    }
    await store.update((s) => {
      ensureSelf(s)
      keepPeer(s, ask.from, { displayName: ask.fromName, avatar: ask.avatar, door, keyHex })
      s.pairAsk = null
      if (ask.session && s.relayInvites && s.relayInvites[ask.session]) {
        s.relayInvites[ask.session].pending = null
        s.relayInvites[ask.session].revoked = true
      } else {
        s.pairCode = null
      }
      note(s, `已互存稳定 ID 与共享密钥 · ${ask.from}`, now())
    })
    return { ok: true, peerId: ask.from, ...(await snapshot()) }
  }

  async function rejectPairAsk() {
    const ask = (await store.get()).pairAsk
    const me = (await store.get()).self
    ask && (ask.session || ask.door) && await send(ask.session ? '' : ask.door, {
      type: ask.session ? 'pair.reject' : 'hello',
      reject: true,
      from: me && me.id,
      fromName: me && me.displayName,
      to: ask.from,
      session: ask.session || undefined,
      ts: now(),
      door: selfDoor(),
    }, { timeoutMs: PAIR_HELLO_MS })
    await store.update((s) => {
      s.pairAsk = null
      s.pairCode && (s.pairCode.pending = null)
      note(s, ask ? `已拒绝配对 · ${ask.fromName || ask.from}` : '没有待确定的配对请求', now())
    })
    return { ok: true, ...(await snapshot()) }
  }

  async function unpair(peerId) {
    await store.update((state) => {
      const peer = state.peers[peerId]
      peer && (peer.unpaired = true, peer.keyHex = '', peer.staffId = '', peer.online = false)
      peer && Object.values(state.requests).forEach((req) => {
        req.holder === peerId && req.status !== 'closed' && (req.holder = state.self.id, req.updatedAt = now())
      })
      peer && note(state, `已解除配对 · ${peer.displayName || peerId}`)
    })
    return snapshot()
  }

  async function acceptRelayOffer(frame) {
    const session = String((frame && frame.session) || '').replace(/[^A-Za-z0-9._-]/g, '')
    if (!session || !(await inviteLive(session))) {
      return { ok: false, error: 'NO_INVITE', hint: '邀请已过期或已吊销。' }
    }
    const theirId = String((frame && frame.from) || '')
    const theirOffer = String((frame && frame.offer) || '')
    const nonce = String((frame && frame.nonce) || '')
    if (!theirId || !theirOffer || !nonce) return { ok: false, error: 'NO_PEER' }
    await store.update((s) => ensureSelf(s))
    const me = (await store.get()).self
    const mine = generatePairOffer()
    await store.update((s) => {
      s.relayInvites = s.relayInvites && typeof s.relayInvites === 'object' ? s.relayInvites : {}
      const row = s.relayInvites[session] || { session, revoked: false, expiresAt: now() + CODE_TTL_MS }
      row.pending = {
        from: theirId,
        fromName: frame.fromName || '同事',
        offer: theirOffer,
        privateKey: mine.privateKey,
        publicKey: mine.publicKey,
        nonce,
        door: frame.door || '',
        session,
      }
      s.relayInvites[session] = row
      s.pairAsk = {
        from: theirId,
        fromName: frame.fromName || '同事',
        door: frame.door || '',
        at: now(),
        ready: false,
        session,
      }
    })
    await send('', {
      type: 'pair.challenge',
      from: me.id,
      fromName: me.displayName,
      to: theirId,
      session,
      nonce,
      ts: now(),
      offer: mine.publicKey,
      peerId: me.id,
      door: selfDoor(),
    })
    return { ok: true, challenge: true }
  }

  async function acceptRelayChallenge(frame) {
    const wait = (await store.get()).pairWait
    const session = String((frame && frame.session) || '')
    if (!wait || wait.session !== session || wait.nonce !== String((frame && frame.nonce) || '')) {
      return { ok: false, error: 'NO_WAIT' }
    }
    const me = (await store.get()).self
    const theirId = String((frame && frame.from) || '')
    let shared
    try {
      shared = pairSharedSecret(wait.privateKey, frame.offer)
    } catch {
      return { ok: false, error: 'BAD_OFFER' }
    }
    const key = derivePairedKey({
      shared,
      spokenCode: session,
      idA: me.id,
      idB: theirId,
      nonce: wait.nonce,
    })
    const posted = await send('', signFrame(key, {
      type: 'pair.confirm',
      from: me.id,
      fromName: me.displayName,
      to: theirId,
      session,
      nonce: wait.nonce,
      ts: now(),
      door: selfDoor(),
    }))
    if (!posted || posted.ok === false) return { ok: false, error: (posted && posted.error) || 'UNREACHABLE' }
    await store.update((s) => {
      s.pairWait && (s.pairWait.id = theirId, s.pairWait.keyHex = key.toString('hex'), s.pairWait.displayName = frame.fromName || s.pairWait.displayName)
    })
    return { ok: true, awaiting: true }
  }

  async function acceptRelayConfirm(frame) {
    const session = String((frame && frame.session) || '')
    const state = await store.get()
    const pending = state.relayInvites && state.relayInvites[session] && state.relayInvites[session].pending
    if (!pending || pending.from !== String((frame && frame.from) || '') || pending.nonce !== String((frame && frame.nonce) || '')) {
      return { ok: false, error: 'NO_CHALLENGE' }
    }
    const me = state.self
    let shared
    try {
      shared = pairSharedSecret(pending.privateKey, pending.offer)
    } catch {
      return { ok: false, error: 'BAD_OFFER' }
    }
    const key = derivePairedKey({
      shared,
      spokenCode: session,
      idA: me.id,
      idB: pending.from,
      nonce: pending.nonce,
    })
    if (!verifyFrame(key, frame)) return { ok: false, error: 'CODE_MISMATCH' }
    await store.update((s) => {
      const row = s.relayInvites && s.relayInvites[session]
      row && row.pending && (row.pending.keyHex = key.toString('hex'), row.pending.verified = true)
      s.pairAsk = {
        from: pending.from,
        fromName: frame.fromName || pending.fromName || '同事',
        door: frame.door || pending.door || '',
        at: now(),
        ready: true,
        session,
      }
      note(s, `收到中继配对请求 · ${frame.fromName || pending.fromName || pending.from}`, now())
    })
    return { ok: true, awaiting: true, peerId: me && me.id }
  }

  async function acceptPairFrame(frame) {
    const type = String((frame && frame.type) || '')
    if (type === 'pair.offer') return acceptRelayOffer(frame)
    if (type === 'pair.challenge') return acceptRelayChallenge(frame)
    if (type === 'pair.confirm') return acceptRelayConfirm(frame)
    if (type === 'pair.accept') return acceptPairedAck(frame, frame.door || '')
    if (type === 'pair.reject') {
      await store.update((s) => {
        s.pairWait && s.pairWait.session === String((frame && frame.session) || '') && (s.pairWait = null)
      })
      return { ok: true, rejected: true }
    }
    return { ok: false, error: 'UNKNOWN' }
  }

  return { mintPairCode, handshake, acceptHello, acceptPairConfirm, acceptPairAsk, rejectPairAsk, acceptPairFrame, unpair }
}
