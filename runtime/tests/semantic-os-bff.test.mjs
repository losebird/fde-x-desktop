import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootSemanticOsBff, semanticOsBffReady } from '../semantic-os-bff.mjs'

test('BFF semantic-os boots a handler without DSH', async () => {
  const runtime = await bootSemanticOsBff({ start: false })
  assert.equal(semanticOsBffReady(), true)
  assert.equal(typeof runtime.handler, 'function')
})
