/**
 * Semantic advice and calendar notes. Recording is a nod, never a send.
 * @module dsh-lan-assist/advice
 */

import { clip } from './dock.js'

/**
 * @param {object} bag
 */
export function createAdvice(bag) {
  const { store, now, snapshot, note, opts, dockFor } = bag

  async function considerAdvice({ sessionId, scenario, requestId }) {
    const text = String(scenario || '').trim()
    if (!text) return { ok: false, error: 'EMPTY' }
    if (typeof opts.brief !== 'function') {
      return { ok: false, error: 'NO_SEMANTIC', hint: '没装语义，不能装成已进档案。信还能寄，点头还有效。' }
    }
    const letter = requestId ? (await store.get()).requests[requestId] : null
    const found = await opts.brief(sessionId, text, letter && letter.workspace)
    const advice = found && found.advice
    if (!advice || !advice.ready) {
      await store.update((state) => {
        state.advice = null
        note(state, `语义图里没有能当依据的节点 · ${clip(text, 24)}`, now())
      })
      return { ok: false, error: (found && found.error) || 'NO_BECAUSE', ...(await snapshot()) }
    }
    await store.update((state) => {
      state.advice = {
        ready: true,
        scenario: text,
        sessionId: sessionId || '',
        requestId: requestId || '',
        speak: advice.speak,
        because: advice.because,
        evidence: advice.evidence,
        precedents: advice.precedents,
        cwd: (letter && letter.workspace) || found.cwd || '',
        recordedId: '',
        at: now(),
      }
      note(state, `秘书开口建议 · ${clip(text, 24)}`, now())
    })
    return { ok: true, ...(await snapshot()) }
  }

  async function maybeAdvise(sessionId) {
    const state = await store.get()
    if (state.advice && (state.advice.because || []).length && !state.advice.recordedId) return snapshot()
    const dock = dockFor(state, sessionId)
    if (!dock) return snapshot()
    const scenario = String(dock.sourceQuote || dock.speak || '').trim()
    if (!scenario) return snapshot()
    const looks = typeof opts.looksLikeChoice === 'function' ? opts.looksLikeChoice(scenario) : true
    if (!looks && dock.mode !== 'reply' && dock.mode !== 'presend') return snapshot()
    const key = `${sessionId || ''}:${dock.mode}:${dock.requestId}:${scenario.slice(0, 80)}`
    if (state.lastAdviceKey === key) return snapshot()
    await store.update((s) => { s.lastAdviceKey = key })
    return considerAdvice({ sessionId, scenario, requestId: dock.requestId })
  }

  async function dismissAdvice() {
    await store.update((state) => {
      state.advice = null
      note(state, '先不记进档案', now())
    })
    return snapshot()
  }

  async function confirmAdvice() {
    const state = await store.get()
    const ad = state.advice
    if (!ad || !(ad.because || []).length) return { ok: false, error: 'NO_ADVICE' }
    if (typeof opts.record !== 'function') {
      return { ok: false, error: 'NO_SEMANTIC', hint: '没装语义，不能装成已进档案。' }
    }
    const leadsTo = [ad.requestId, ad.sessionId].filter(Boolean)
    !leadsTo.length && leadsTo.push(`lan-assist:${now()}`)
    const written = await opts.record(ad.sessionId, {
      cwd: ad.cwd,
      scenario: ad.scenario,
      reasoning: ad.speak,
      outcome: 'confirmed',
      actor: (state.self && state.self.displayName) || state.displayName || '本机',
      because: ad.because,
      leadsTo,
      sessionId: ad.sessionId,
      requestId: ad.requestId,
    })
    if (!written || !written.ok) {
      return { ok: false, error: (written && written.error) || 'RECORD_FAILED', ...(await snapshot()) }
    }
    await store.update((s) => {
      s.advice && (s.advice.recordedId = written.decisionId || 'recorded')
      note(s, `已记进语义决策 · ${written.decisionId || ''} · 依据 ${ad.because.length} · 后果 ${leadsTo.length}`, now())
      s.advice = null
    })
    return { ok: true, decisionId: written.decisionId, causal: written.causal, ...(await snapshot()) }
  }

  async function maybeBoard(payload) {
    if (typeof opts.record !== 'function') {
      return { ok: false, error: 'NO_SEMANTIC', hint: '没装语义，不能装成已进档案。' }
    }
    const because = (payload.because || []).map((id) => String(id || '').trim()).filter(Boolean)
    const leadsTo = (payload.leadsTo || []).map((id) => String(id || '').trim()).filter(Boolean)
    if (!because.length || !leadsTo.length) return { ok: false, error: 'NO_CAUSAL' }
    const snap = await store.get()
    try {
      const written = await opts.record(payload.sessionId, {
        scenario: payload.scenario,
        reasoning: payload.reasoning,
        outcome: payload.outcome,
        actor: (snap.self && snap.self.id) || snap.displayName || '本机',
        because,
        leadsTo,
        sessionId: payload.sessionId,
        requestId: payload.requestId,
      })
      written && written.ok && await store.update((s) => { note(s, `已记进语义决策 · ${payload.outcome} · ${payload.requestId}`, now()) })
      return written
    } catch {
      return { ok: false, error: 'RECORD_FAILED' }
    }
  }

  async function suggestPrecedent(sessionId, scenario, workspace) {
    const text = String(scenario || '').trim()
    if (!text) return { ok: false, error: 'EMPTY' }
    if (typeof opts.brief !== 'function') {
      return { ok: false, error: 'NO_SEMANTIC', hint: '没装语义，手写照样能发。不能装成已进档案。' }
    }
    const found = await opts.brief(sessionId, text, workspace)
    return (!found || !found.ok || !found.advice || !found.advice.ready)
      ? { ok: false, error: (found && found.error) || 'NO_BECAUSE', advice: found && found.advice }
      : { ok: true, advice: found.advice, cwd: found.cwd || workspace || '' }
  }

  async function proposeSlots(requestId, slots) {
    await store.update((state) => {
      const req = state.requests[requestId]
      req && (req.slots = Array.isArray(slots) ? slots.slice(0, 5) : [])
    })
    return snapshot()
  }

  async function pickSlot(requestId, index) {
    await store.update((state) => {
      const req = state.requests[requestId]
      req && (req.pickedSlot = Number(index))
    })
    return snapshot()
  }

  async function writeCalendar(requestId) {
    let slot = null
    await store.update((state) => {
      const req = state.requests[requestId]
      req && req.pickedSlot >= 0 && (req.calendarNoted = true, req.calendarWritten = false, slot = req.slots[req.pickedSlot] || null, note(state, `记下了约的时段 · 还没写进日历 · ${requestId}`))
    })
    if (!slot) return { ok: false, error: 'NO_SLOT' }
    const label = typeof slot === 'string' ? slot : (slot.label || JSON.stringify(slot))
    const state = await store.get()
    const req = state.requests[requestId]
    await maybeBoard({
      sessionId: req && req.sessionId,
      requestId,
      scenario: label,
      reasoning: '用户确认记下约的时段，还没写进日历',
      outcome: 'calendar',
      because: [requestId, ...(req && req.evidence || []).map((row) => row.id || row).filter(Boolean)],
      leadsTo: [req && req.sessionId || requestId],
    })
    return {
      ok: true,
      wrote: false,
      slot,
      speak: '记下了约的时段。没配写出命令，不能装成已写进日历。',
      ...(await snapshot()),
    }
  }

  return {
    considerAdvice, maybeAdvise, dismissAdvice, confirmAdvice,
    maybeBoard, suggestPrecedent, proposeSlots, pickSlot, writeCalendar,
  }
}
