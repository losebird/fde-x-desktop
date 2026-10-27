import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

test('Host plugin has no DSH client slot', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.dsh && pkg.dsh.client, undefined)
  assert.equal(pkg.exports && pkg.exports['./client'], undefined)
})
