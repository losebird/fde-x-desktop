import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const main = readFileSync(join(here, '../dist/main.js'), 'utf8')

test('fde:notify posts a macOS banner and plays Glass', () => {
  assert.match(main, /fde:notify/)
  assert.match(main, /new Notification/)
  assert.match(main, /notice\.show\(\)/)
  assert.match(main, /fde:notice-open/)
  assert.match(main, /removeAll\(\)/)
  assert.match(main, /icon.icns/)
  assert.match(main, /afplay/)
  assert.match(main, /dock\?\.bounce/)
  assert.doesNotMatch(main, /fallbackHelperNotice/)
  assert.doesNotMatch(main, /FDE-X Notify\.app/)
  assert.doesNotMatch(main, /display notification/)
  assert.doesNotMatch(main, /osascript/)
})
