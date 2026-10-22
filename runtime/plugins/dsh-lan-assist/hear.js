/**
 * Typed chat is heard, not started. Sleep skips. Duplicates skip.
 * @module dsh-lan-assist/hear
 */

import { FOCUS_TTL_MS } from './home.js'
import { clip } from './dock.js'
import { parseBusinessRef } from './ref.js'
import {
  looksLikeBusiness,
  looksLikeChase,
  looksLikeNudge,
  parseWriteAction,
  nudgeQuote,
} from './probe.js'

export function liveFocus(state, sessionId, t) {
  const focus = state && state.focus
  if (!focus || !focus.no || !focus.kind) return null
  if (sessionId && focus.sessionId && focus.sessionId !== sessionId) return null
  if (focus.expiresAt && Number(focus.expiresAt) <= t) return null
  return focus
}

/**
 * @param {object} bag
 */
export function createHear(bag) {
  const { store, now, snapshot, note, opts, considerAdvice, gatedSpeak } = bag

  async function rememberFocus(sessionId, workspace, ref, found) {
    if (!ref || !ref.kind || !ref.no || ref.kind === '单据') return
    if (!found || found.ok === false || found.ambiguous) return
    const no = String(found.no || ref.no).trim()
    if (!no) return
    await store.update((s) => {
      s.focus = {
        kind: ref.kind,
        no,
        sessionId: sessionId || '',
        workspace: workspace || '',
        at: now(),
        expiresAt: now() + FOCUS_TTL_MS,
      }
    })
  }

  async function hearUserLine(sessionId, text, workspace) {
    const state = await store.get()
    if (state.asleep) return { ok: true, skipped: 'asleep' }
    const speech = String(text || '').trim()
    if (!speech) return { ok: true, skipped: 'empty' }
    const nudge = looksLikeNudge(speech)
    if (nudge) {
      const quote = nudgeQuote(speech)
      await store.update((s) => {
        s.nudgeAsk = { quote, speech, sessionId: sessionId || '', at: now() }
        note(s, `听出约提醒 · 点了才留条 · ${clip(quote, 24)}`, now())
      })
      return { ok: true, heard: 'nudge', speak: `要我记下「${clip(quote, 24)}」？`, ...(await snapshot()) }
    }
    const looks = typeof opts.looksLikeChoice === 'function' ? opts.looksLikeChoice(speech) : false
    const business = looksLikeBusiness(speech)
    const chase = looksLikeChase(speech)
    if (parseWriteAction(speech) || parseBusinessRef(speech)) {
      return { ok: true, skipped: 'session' }
    }
    if (!looks && !business && !chase) return { ok: true, skipped: 'not_choice' }
    if (business || chase) {
      await store.update((s) => {
        const spoken = gatedSpeak(s, chase ? 'chase' : 'bizline', sessionId || 's', speech.slice(0, 40))
        spoken && note(s, chase
          ? `听出催待办 · 仍不自动开工 · ${clip(speech, 24)}`
          : `听出业务动作 · 仍不自动开工 · ${clip(speech, 24)}`, now())
      })
      if (!looks) {
        return {
          ok: true,
          heard: chase ? 'chase' : 'business',
          speak: chase ? '像催待办。点了才动，不自动开工。' : '像业务动作。点了才动，不自动开工。',
          ...(await snapshot()),
        }
      }
    }
    const key = `user:${sessionId || ''}:${speech.slice(0, 80)}`
    if (state.lastAdviceKey === key) return { ok: true, skipped: 'dup' }
    if (state.advice && state.advice.ready && !state.advice.recordedId && state.advice.sessionId === sessionId) {
      return { ok: true, skipped: 'pending' }
    }
    await store.update((s) => { s.lastAdviceKey = key })
    return considerAdvice({ sessionId, scenario: speech, requestId: '' })
  }

  return { liveFocus, rememberFocus, hearUserLine }
}
