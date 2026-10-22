import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planAiRunOpen } from '../plan/plan-ai-chip.mjs'

test('a run with no session does not offer to open a session', () => {
  const plan = readFileSync(new URL('../../src/pages/Plan.tsx', import.meta.url), 'utf8')
  assert.match(plan, /planAiRunOpen\(/)
  assert.equal(planAiRunOpen({ state: 'running', sessionId: '' }), null)
  assert.equal(planAiRunOpen({ state: 'running', sessionId: null }), null)
  const open = planAiRunOpen({ state: 'running', sessionId: 'sess_real' })
  assert.equal(open && open.label, 'AI 处理中 · 打开会话')
  assert.equal(open && open.sessionId, 'sess_real')
})
