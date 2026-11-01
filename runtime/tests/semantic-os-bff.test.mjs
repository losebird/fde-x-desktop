import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bootSemanticOsBff, semanticOsBffReady } from '../semantic-os-bff.mjs'
import { BUILTIN_PLUGINS } from '../builtin-plugins.mjs'
import { RETIRED_PROFILE_BUNDLES } from '../profile-manifest.mjs'

test('loopback Vite Origin is trusted for BFF memory writes', async () => {
  const { isTrustedRequest } = await import('../plugins/dsh-semantic-os/http.js')
  assert.equal(isTrustedRequest({
    method: 'GET',
    headers: { host: '127.0.0.1:4318', origin: 'http://127.0.0.1:5174' },
  }), true)
  assert.equal(isTrustedRequest({
    method: 'POST',
    headers: {
      host: '127.0.0.1:4318',
      origin: 'http://127.0.0.1:5174',
      'sec-fetch-site': 'cross-site',
    },
  }), true)
})

test('invokeSemanticOs posts /find instead of GET', () => {
  const src = readFileSync(new URL('../semantic-os-bff.mjs', import.meta.url), 'utf8')
  assert.match(src, /path === '\/python' \|\| path === '\/find' \? 'POST'/)
  assert.match(src, /path === '\/find'/)
  assert.match(src, /query: options\.query/)
})

test('semantic-os is retired from Host builtins', () => {
  assert.equal(BUILTIN_PLUGINS.some((plugin) => plugin.dir === 'dsh-semantic-os'), false)
  assert.equal(RETIRED_PROFILE_BUNDLES.includes('dsh-semantic-os'), true)
  assert.equal(BUILTIN_PLUGINS.length, 0)
  assert.equal(RETIRED_PROFILE_BUNDLES.includes('@losebird/iui'), true)
})

test('BFF semantic-os boots a handler without DSH', async () => {
  const runtime = await bootSemanticOsBff({ start: false })
  assert.equal(semanticOsBffReady(), true)
  assert.equal(typeof runtime.handler, 'function')
  assert.equal(typeof runtime.sessionIngest.start, 'function')
  assert.equal(typeof runtime.extract.extract, 'function')
  assert.equal(typeof runtime.persistence.list, 'function')
})
