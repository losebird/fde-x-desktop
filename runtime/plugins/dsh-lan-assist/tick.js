/**
 * Quiet tick: expire, reclaim lost hold, fail undelivered. Empty tick writes nothing.
 * @module dsh-lan-assist/tick
 */

import {
  EXPIRE_AFTER_MS,
  FAIL_AFTER_MS,
  LEDGER_KEEP_MS,
  LOST_HOLD_MS,
  SLEEP_GAP_MS,
} from './home.js'
import { stripAttach } from './attach.js'

/**
 * @param {object} bag
 */
export function createTick(bag) {
  const { store, now, note, files, shout, flushOutbox } = bag
  let lastTickAt = 0

  async function tick() {
    let woke = false
    let changed = false
    const dropIds = []
    const t = now()
    const slept = !!(lastTickAt && t - lastTickAt >= SLEEP_GAP_MS)
    lastTickAt = t
    const live = await store.get()
    const due = Object.values(live.requests || {}).some((req) => req && (
      req.status === 'closed'
      || (req.status === 'failed' && t - (req.updatedAt || req.createdAt) >= EXPIRE_AFTER_MS)
      || (req.status !== 'failed' && t - req.createdAt >= EXPIRE_AFTER_MS)
      || (req.holder && live.self && req.holder !== live.self.id && t - ((live.peers[req.holder] && live.peers[req.holder].lastHeard) || 0) >= LOST_HOLD_MS)
      || ((req.status === 'queued' || req.status === 'retry') && t - req.createdAt >= FAIL_AFTER_MS)
    ))
    const ledgerDue = (live.ledger || []).some((row) => row && row.at < t - LEDGER_KEEP_MS)
    const queued = Object.values(live.requests || {}).some((req) => req && req.kind === 'outgoing' && (req.status === 'queued' || req.status === 'retry'))
    if ((live.asleep && !slept) || (!slept && !due && !ledgerDue && !queued)) return { changed: false }
    await store.update((state) => {
      if (slept) {
        !state.asleep && note(state, '合盖过。睡着时没装成送到。', t)
        state.asleep = false
        woke = true
        changed = true
        note(state, '醒来了。再喊一轮再送。', t)
        for (const ev of state.events || []) {
          ev && ev.silent && !ev.held && (ev.silent = false)
        }
      }
      if (state.asleep) return
      for (const req of Object.values(state.requests)) {
        if (req.status === 'closed' || (req.status === 'failed' && t - (req.updatedAt || req.createdAt) >= EXPIRE_AFTER_MS)) {
          dropIds.push(req.id)
          delete state.requests[req.id]
          changed = true
          continue
        }
        if (req.status === 'failed') continue
        if (t - req.createdAt >= EXPIRE_AFTER_MS) {
          dropIds.push(req.id)
          delete state.requests[req.id]
          changed = true
          note(state, `已关闭 · ${req.id}`)
          continue
        }
        if (req.holder && req.holder !== state.self.id) {
          const peer = state.peers[req.holder]
          const heard = peer && peer.lastHeard ? peer.lastHeard : 0
          t - heard >= LOST_HOLD_MS && (req.holder = state.self.id, changed = true, note(state, `失联超时，持有回到你这边 · ${req.id}`))
        }
        if ((req.status === 'queued' || req.status === 'retry') && t - req.createdAt >= FAIL_AFTER_MS) {
          req.status = 'failed'
          req.failReason = 'undelivered'
          req.updatedAt = t
          req.attachments = stripAttach(req.attachments)
          req.replyAttachments = stripAttach(req.replyAttachments)
          req.replies = (req.replies || []).map((rep) => Object.assign({}, rep, { attachments: stripAttach(rep && rep.attachments) }))
          dropIds.push(req.id)
          changed = true
          note(state, `标失败，人能看见。未送达 · ${req.id}`)
        }
      }
      const keep = t - LEDGER_KEEP_MS
      const ledger = state.ledger || []
      const nextLedger = ledger.filter((row) => row.at >= keep)
      nextLedger.length !== ledger.length && (state.ledger = nextLedger, changed = true)
    })
    for (const id of dropIds) await files.dropPrefix(id)
    woke && await shout()
    const flushed = await flushOutbox()
    return { changed: changed || woke || !!flushed }
  }

  return { tick }
}
