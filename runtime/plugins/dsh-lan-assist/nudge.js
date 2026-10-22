/**
 * Local reminder slips. Noted only after a click. Due speak is not a send.
 * @module dsh-lan-assist/nudge
 */

import { randomHex } from './crypto.js'
import { clip, dayKey } from './dock.js'
import { nudgeDueAt } from './probe.js'

/**
 * @param {object} bag
 */
export function createNudges(bag) {
  const { store, now, snapshot, note } = bag

  async function confirmNudge() {
    const state = await store.get()
    const ask = state.nudgeAsk
    if (!ask || !ask.quote) return { ok: false, error: 'NO_NUDGE' }
    const id = `nudge_${randomHex(4)}`
    const dueAt = nudgeDueAt(ask.speech || ask.quote, now())
    await store.update((s) => {
      s.nudges = s.nudges || []
      s.nudges.push({
        id,
        quote: ask.quote,
        speech: ask.speech || ask.quote,
        sessionId: ask.sessionId || '',
        createdAt: now(),
        dueAt,
        spokenDay: '',
        forgotten: false,
      })
      s.nudgeAsk = null
      note(s, `记下条子 · ${clip(ask.quote, 24)} · 到点单独开口`, now())
    })
    return { ok: true, nudgeId: id, ...(await snapshot()) }
  }

  async function addNudge({ quote, speech, sessionId, dueAt: dueAtRaw }) {
    const text = String(quote || speech || '').trim()
    if (!text) return { ok: false, error: 'EMPTY', hint: '还没有可记下的话。记下才留。' }
    const id = `nudge_${randomHex(4)}`
    const dueGiven = Number(dueAtRaw)
    const dueAt = Number.isFinite(dueGiven) && dueGiven > 0 ? dueGiven : nudgeDueAt(speech || text, now())
    await store.update((s) => {
      s.nudges = s.nudges || []
      s.nudges.push({
        id,
        quote: text.slice(0, 80),
        speech: String(speech || text),
        sessionId: sessionId || '',
        createdAt: now(),
        dueAt,
        spokenDay: '',
        forgotten: false,
      })
      note(s, `记下条子 · ${clip(text, 24)} · 到点单独开口`, now())
    })
    return { ok: true, nudgeId: id, ...(await snapshot()) }
  }

  async function dismissNudgeAsk() {
    await store.update((s) => {
      s.nudgeAsk = null
      note(s, '先不记条子', now())
    })
    return snapshot()
  }

  async function holdNudge(nudgeId) {
    const today = dayKey(now())
    await store.update((s) => {
      const row = (s.nudges || []).find((item) => item && item.id === nudgeId)
      row && (row.spokenDay = today, note(s, `条子先记下 · ${nudgeId} · 今天不再开口`, now()))
    })
    return snapshot()
  }

  async function forgetNudge(nudgeId) {
    await store.update((s) => {
      const row = (s.nudges || []).find((item) => item && item.id === nudgeId)
      row && (row.forgotten = true, note(s, `忘掉条子 · ${clip(row.quote, 24)}`, now()))
    })
    return snapshot()
  }

  return { confirmNudge, addNudge, dismissNudgeAsk, holdNudge, forgetNudge }
}
