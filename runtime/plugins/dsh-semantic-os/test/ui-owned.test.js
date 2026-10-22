import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('graph UI lives in ui/, not vendor/explorer-0.6.5', () => {
  assert.equal(existsSync(join(root, 'vendor/explorer-0.6.5')), false)
  assert.equal(existsSync(join(root, 'ui/src/workspaces/GraphWorkspace/GraphWorkspace.tsx')), true)
  assert.equal(existsSync(join(root, 'ui/src/dsh-explore-host.tsx')), true)
  assert.equal(existsSync(join(root, 'dist/explore/explore.js')), true)
})
