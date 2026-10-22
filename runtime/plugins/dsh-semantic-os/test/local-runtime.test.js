import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { resolveBundledRuntime, runtimeKey } from '../runtime-bundle.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('plugin ships a local runtime-dist for this machine', async () => {
  const key = runtimeKey()
  const local = join(root, 'runtime-dist', key, 'runtime-manifest.json')
  if (!existsSync(local)) return
  const got = await resolveBundledRuntime({ verifyFiles: false })
  assert.equal(got.ok, true, got.error || got.detail)
  assert.equal(got.root, join(root, 'runtime-dist', key))
})
