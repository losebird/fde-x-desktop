import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('stores expose close_store and keep close_lite as an alias', async () => {
  const src = await readFile(new URL('../python/stores.py', import.meta.url), 'utf8')
  assert.match(src, /def close_store/)
  assert.match(src, /close_lite = close_store/)
  assert.equal(src.includes('redislite'), false)
})
