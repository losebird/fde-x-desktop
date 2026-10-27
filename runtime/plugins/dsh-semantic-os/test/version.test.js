import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PLUGIN_VERSION, RUNTIME_VERSION } from '../version.js'

test('plugin, bridge, runtime, client, and optional dependency versions stay aligned', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const client = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.equal(PLUGIN_VERSION, pkg.version)
  assert.equal(RUNTIME_VERSION, pkg.version)
  assert.ok(client.includes("id: 'dsh-semantic-os'"))
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  assert.ok(patch.includes(`name: ${pkg.name}`))
  assert.ok(patch.includes(`id: ${pkg.name}`))
})
