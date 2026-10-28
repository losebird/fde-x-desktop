import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootSemanticOsBff, semanticOsBffReady } from '../semantic-os-bff.mjs'
import { BUILTIN_PLUGINS } from '../builtin-plugins.mjs'
import { RETIRED_PROFILE_BUNDLES } from '../profile-manifest.mjs'

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
