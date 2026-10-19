/**
 * This-seat staff, hold, close. Roster leave reclaims hold and does not unpair.
 * @module dsh-lan-assist/seat
 */

import { dayKey, namesOf } from './dock.js'
import { speakWho } from './miss.js'
import { speakCostStop } from './probe.js'
import { packBackup } from './duty.js'

/**
 * @param {object} bag
 */
export function createSeat(bag) {
  const { store, now, snapshot, note, ensureSelf, files, flushOutbox, publicLookups, saveConnToken } = bag

  async function setDisplayName(name, avatar) {
    const next = String(name || '').trim()
    if (!next) return { ok: false, error: 'EMPTY_NAME' }
    const face = String(avatar || '').trim().slice(0, 24)
    await store.update((state) => {
      ensureSelf(state)
      state.displayName = next
      state.self.displayName = next
      if (face) state.self.avatar = face
    })
    return snapshot()
  }

  async function setPeerNote(peerId, noteText) {
    await store.update((state) => {
      const peer = state.peers[peerId]
      peer && (peer.note = String(noteText || '').slice(0, 40))
    })
    return snapshot()
  }

  async function setPeerFlags(peerId, { pin, mute } = {}) {
    await store.update((state) => {
      const peer = state.peers[peerId]
      peer && (typeof pin === 'boolean' && (peer.pin = pin), typeof mute === 'boolean' && (peer.mute = mute))
    })
    return snapshot()
  }

  async function stopWrites(on) {
    await store.update((state) => {
      state.writeStopped = !!on
      note(state, on ? speakCostStop() : '写闸已开。过账仍要人点。', now())
    })
    return snapshot()
  }

  async function switchSeat(staffId, displayName) {
    const staff = String(staffId || '').trim()
    const name = String(displayName || '').trim()
    await store.update((state) => {
      ensureSelf(state)
      name && (state.displayName = name, state.self.displayName = name)
      state.self.staffId = staff
      for (const peer of Object.values(state.peers || {})) {
        peer && (peer.staffId = '')
      }
      note(state, staff
        ? `换人 · 现在是${state.self.displayName}的号 ${staff} · 旧引用已解绑`
        : `换人 · ${speakWho(state.self)}`, now())
    })
    return { ok: true, who: speakWho((await store.get()).self), ...(await snapshot()) }
  }

  async function holdBusinessEvent(eventId) {
    await store.update((state) => {
      const ev = (state.events || []).find((row) => row.id === eventId)
      ev && (ev.held = true, note(state, `业务事件先记下 · ${eventId} · 没寄信，没调度`, now()))
    })
    return snapshot()
  }

  async function bindStaff(peerId, staffId) {
    const id = String(peerId || '').trim()
    const staff = String(staffId || '').trim()
    if (!id) return { ok: false, error: 'NO_PEER' }
    const state = await store.get()
    const peer = state.peers[id]
    if (!peer || peer.unpaired) return { ok: false, error: 'NOT_PAIRED' }
    await store.update((s) => {
      const row = s.peers[id]
      row && !row.unpaired && (row.staffId = staff, note(s, staff
        ? `身份引用 · ${row.displayName || id} → ${staff} · 登录口令不在这`
        : `身份引用已解绑 · ${row.displayName || id}`, now()))
    })
    return { ok: true, ...(await snapshot()) }
  }

  async function applyLeftIds(ids) {
    const left = new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))
    if (!left.size) return snapshot()
    const reclaimed = []
    await store.update((state) => {
      for (const peer of Object.values(state.peers || {})) {
        peer && left.has(peer.id) && (peer.staffId = '')
      }
      for (const req of Object.values(state.requests || {})) {
        if (req.status === 'closed' || req.status === 'failed') continue
        if (req.holder && left.has(req.holder) && req.holder !== state.self.id) {
          const who = namesOf(state, [req.holder]) || req.holder
          req.holder = state.self.id
          req.updatedAt = now()
          reclaimed.push(req.id)
          note(state, `花名册标离开，持有回到你这边 · ${req.id} · 原持有 ${who} · 建议另找人 · 不是离职自动送信`, now())
        }
      }
    })
    return { ok: true, reclaimed, ...(await snapshot()) }
  }

  async function chase(requestId) {
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req) return { ok: false, error: 'NO_REQUEST' }
    await store.update((s) => {
      const row = s.requests[requestId]
      row.chaseNoted = false
      row.lastChase = now()
      note(s, `再催是拍板 · ${requestId}`)
    })
    await store.update((s) => {
      const row = s.requests[requestId]
      row && (row.status = row.status === 'sent' || row.status === 'queued' ? 'queued' : row.status)
    })
    await flushOutbox()
    return snapshot()
  }

  async function reclaimHold(requestId) {
    await store.update((state) => {
      const req = state.requests[requestId]
      req && req.status !== 'closed' && (req.holder = state.self.id, req.updatedAt = now(), note(state, `持有已回到你这边 · ${requestId}`, now()))
    })
    return snapshot()
  }

  async function closeRequest(requestId) {
    let drop = false
    await store.update((state) => {
      const req = state.requests[requestId]
      req && (delete state.requests[requestId], drop = true, note(state, `这封关掉 · ${requestId}`))
    })
    drop && await files.dropPrefix(requestId)
    return snapshot()
  }

  async function bindSession(requestId, sessionId) {
    await store.update((state) => {
      const req = state.requests[requestId]
      req && (req.sessionId = sessionId)
    })
    return snapshot()
  }

  async function openHere(requestId, sessionId) {
    const sid = String(sessionId || '').trim()
    if (!sid) return { ok: false, error: 'NO_SESSION' }
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req) return { ok: false, error: 'NO_REQUEST' }
    await store.update((s) => {
      const row = s.requests[requestId]
      row && (row.sessionId = sid)
    })
    return { ok: true, ...(await snapshot()) }
  }

  async function exportLedger() {
    const state = await store.get()
    const backup = packBackup(state)
    return {
      ok: true,
      exportedAt: now(),
      kind: backup.kind,
      lines: backup.ledger,
      refs: backup.refs,
      requests: backup.requests,
    }
  }

  async function purgeLedger() {
    await store.update((state) => { state.ledger = [] })
    return snapshot()
  }

  async function wipeRefs() {
    const rows = publicLookups(await store.get())
    for (const row of rows) await saveConnToken(row.id, '')
    await store.update((state) => {
      for (const peer of Object.values(state.peers || {})) {
        peer && (peer.staffId = '')
      }
      state.lookup && (state.lookup.token = '')
      note(state, '身份引用已擦。钥匙还在，登录口令已清。', now())
    })
    return snapshot()
  }

  async function setBriefOff(off) {
    await store.update((state) => {
      state.briefOff = !!off
      off && (state.lastBriefDay = dayKey(now()))
    })
    return snapshot()
  }

  async function grantListen(on) {
    await store.update((state) => { state.listenGranted = !!on })
    return snapshot()
  }

  async function setSinkCommand(cmd) {
    await store.update((state) => { state.sinkCommand = String(cmd || '') })
    return snapshot()
  }

  async function runSink(requestId) {
    const state = await store.get()
    const cmd = String(state.sinkCommand || '').trim()
    if (!cmd) {
      await store.update((s) => note(s, `写出去 · 没配命令，只记本机流水 · ${requestId || ''}`, now()))
      return { ok: true, ran: false, ...(await snapshot()) }
    }
    return { ok: true, ran: false, command: cmd, hint: '点了才送。命令由本机执行面跑，这里先记下。', ...(await snapshot()) }
  }

  return {
    setDisplayName, setPeerNote, setPeerFlags,
    stopWrites, switchSeat, holdBusinessEvent, bindStaff, applyLeftIds,
    chase, reclaimHold, closeRequest, bindSession, openHere,
    exportLedger, purgeLedger, wipeRefs, setBriefOff, grantListen, setSinkCommand, runSink,
  }
}
