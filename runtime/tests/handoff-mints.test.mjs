import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SESSION_CARD_HINT,
  handoffRoundAsksPlanPage,
  markHandoffToken,
  openHandoffMints,
  planPageSpeech,
  rewritePlanHandoffSpeech,
} from '../plugins/dsh-lan-assist/handoff-mints.js'

test('markHandoffToken sets planHandoff and copies session from the mint event', () => {
  const token = { sessionId: '', expiresAt: Date.now() + 60_000, used: false }
  markHandoffToken(token, {
    sessionId: 'sess_mint',
    previewId: 'pv_01234567',
    action: '改行',
    changes: [],
  })
  assert.equal(token.planHandoff, true)
  assert.equal(token.sessionId, 'sess_mint')
})

test('openHandoffMints keeps only open handoff tokens with a session', () => {
  const now = Date.now()
  const tokens = new Map([
    ['pv_open', {
      planHandoff: true,
      sessionId: 'sess_a',
      used: false,
      expiresAt: now + 60_000,
      action: '改行',
      changes: [{ field: 'level', label: '等级', from: 'B', to: 'A' }],
    }],
    ['pv_used', {
      planHandoff: true,
      sessionId: 'sess_b',
      used: true,
      expiresAt: now + 60_000,
      action: '改行',
      changes: [],
    }],
    ['pv_expired', {
      planHandoff: true,
      sessionId: 'sess_c',
      used: false,
      expiresAt: now - 1,
      action: '改行',
      changes: [],
    }],
    ['pv_workstation', {
      sessionId: 'sess_d',
      used: false,
      expiresAt: now + 60_000,
      action: '改行',
      changes: [],
    }],
    ['pv_empty', {
      planHandoff: true,
      sessionId: '',
      used: false,
      expiresAt: now + 60_000,
      action: '改行',
      changes: [],
    }],
  ])
  const mints = openHandoffMints(tokens, now)
  assert.equal(mints.length, 1)
  assert.equal(mints[0].previewId, 'pv_open')
  assert.equal(mints[0].sessionId, 'sess_a')
  assert.equal(mints[0].workstation, false)
  assert.equal(mints[0].action, '改行')
  assert.deepEqual(mints[0].changes, [{ field: 'level', label: '等级', from: 'B', to: 'A' }])
})

test('planPageSpeech replaces right-side confirm copy with the session card hint', () => {
  assert.equal(planPageSpeech('请在右侧确认过账'), SESSION_CARD_HINT)
  assert.equal(planPageSpeech('先预览，请在右侧确认'), `先预览，\n${SESSION_CARD_HINT}`)
  assert.equal(planPageSpeech('已生成预览'), `已生成预览\n${SESSION_CARD_HINT}`)
  assert.equal(SESSION_CARD_HINT, '请在业务记录过账')
})

test('plan page speech is rewritten only when the round already asks for the plan page', () => {
  const result = {
    speak: '已生成预览 请在右侧确认过账',
    hint: '请在右侧确认过账',
    sheet: { speak: '请在右侧确认过账', hint: '请在右侧确认' },
  }
  assert.equal(handoffRoundAsksPlanPage('把等级改成 A'), false)
  assert.equal(rewritePlanHandoffSpeech(result, false), result)
  assert.equal(handoffRoundAsksPlanPage(`用 biz_preview 改业务。\n${SESSION_CARD_HINT}`), true)
  const next = rewritePlanHandoffSpeech(result, true)
  assert.equal(next.speak, `已生成预览\n${SESSION_CARD_HINT}`)
  assert.equal(next.hint, SESSION_CARD_HINT)
  assert.equal(next.sheet.speak, SESSION_CARD_HINT)
  assert.equal(next.sheet.hint, SESSION_CARD_HINT)
  assert.equal(result.speak.includes('请在右侧确认'), true)
})

test('workstation confirm hint is 业务记录', async () => {
  const { WORKSTATION_CONFIRM_HINT } = await import('../plugins/dsh-lan-assist/write.js')
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  assert.equal(WORKSTATION_CONFIRM_HINT, SESSION_CARD_HINT)
  const dock = readFileSync(join(import.meta.dirname, '..', 'plugins', 'dsh-lan-assist', 'dock.js'), 'utf8')
  assert.match(dock, /SESSION_CARD_HINT/)
  assert.doesNotMatch(dock, /请到右边确认/)
})
