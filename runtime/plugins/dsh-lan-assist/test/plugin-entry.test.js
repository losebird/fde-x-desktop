import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('plugin entry parses as an ES module', () => {
  const entry = fileURLToPath(new URL('../index.js', import.meta.url))
  const checked = spawnSync(process.execPath, ['--check', entry], { encoding: 'utf8' })
  assert.equal(checked.status, 0, checked.stderr || checked.stdout)
})
