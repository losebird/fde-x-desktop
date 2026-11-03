import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { readUiTokenFile, resolveAnnouncedUiToken } from '../dist/bff.js'

const TOKEN = 'ab'.repeat(32)
const STALE = 'cd'.repeat(32)

test('resolveAnnouncedUiToken keeps a stdout token', () => {
  assert.equal(resolveAnnouncedUiToken(TOKEN, '/nope'), TOKEN)
})

test('resolveAnnouncedUiToken reads the dsh-home file when stdout missed the line', () => {
  const home = `/tmp/fde-bff-token-${Date.now()}`
  mkdirSync(home, { recursive: true })
  writeFileSync(join(home, '.ui-token'), `${STALE}\n`, { encoding: 'utf8', mode: 0o600 })
  try {
    assert.equal(readUiTokenFile(home), STALE)
    assert.equal(resolveAnnouncedUiToken('', home), STALE)
    assert.equal(resolveAnnouncedUiToken('short', home), STALE)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
