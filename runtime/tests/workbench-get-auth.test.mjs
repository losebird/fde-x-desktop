import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { workbenchGetNeedsToken } from '../workbench-get-auth.mjs'

test('workbench GET token gate covers sessions and briefing, not status events or share', () => {
  assert.equal(workbenchGetNeedsToken('/api/v1/ai/sessions'), true)
  assert.equal(workbenchGetNeedsToken('/api/v1/briefing/latest'), true)
  assert.equal(workbenchGetNeedsToken('/api/v1/ai/status'), false)
  assert.equal(workbenchGetNeedsToken('/api/v1/events'), false)
  assert.equal(workbenchGetNeedsToken('/api/v1/events/recent'), false)
  assert.equal(workbenchGetNeedsToken('/api/v1/app-share/abc'), false)
  assert.equal(workbenchGetNeedsToken('/live'), false)
})
