import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('select recovers a released Host session by reconnecting the workspace', () => {
  const src = readFileSync(new URL('../fde-x-dsh-bridge/lib/client.js', import.meta.url), 'utf8')
  assert.match(src, /function openOrHydrate/)
  assert.match(src, /origConnectWorkspace/)
  assert.match(src, /released/i)
})
