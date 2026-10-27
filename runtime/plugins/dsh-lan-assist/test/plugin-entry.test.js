import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('plugin entry parses as an ES module', () => {
  const entry = fileURLToPath(new URL('../index.js', import.meta.url))
  const checked = spawnSync(process.execPath, ['--check', entry], { encoding: 'utf8' })
  assert.equal(checked.status, 0, checked.stderr || checked.stdout)
})

test('Host plugin has no DSH client slot', async () => {
  const { readFile } = await import('node:fs/promises')
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.dsh && pkg.dsh.client, undefined)
  assert.equal(pkg.exports && pkg.exports['./client'], undefined)
})
