import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  mintUiToken,
  persistUiToken,
  readPersistedUiToken,
  resolveUiToken,
  verifyUiToken,
} from '../routes/bridge.mjs'

function req(token) {
  return { headers: { 'x-fde-ui-token': token } }
}

test('resolveUiToken reuses the persisted home token', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'fde-ui-token-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const first = resolveUiToken(home)
  persistUiToken(home, first)
  assert.equal(readPersistedUiToken(home), first)
  assert.equal(resolveUiToken(home), first)
  assert.notEqual(mintUiToken(), first)
})

test('verifyUiToken accepts the persisted file after memory remints', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'fde-ui-token-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const page = mintUiToken()
  persistUiToken(home, page)
  const memory = mintUiToken()
  assert.equal(verifyUiToken(req(page), memory, home), true)
  assert.equal(verifyUiToken(req(memory), memory, home), true)
  assert.equal(verifyUiToken(req(mintUiToken()), memory, home), false)
  assert.equal(verifyUiToken(req(''), memory, home), false)
})
