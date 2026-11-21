import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const main = readFileSync(join(here, '../dist/main.js'), 'utf8')

test('hidden window pauses ingest and vector workers', () => {
  assert.match(main, /runtime\/background/)
  assert.match(main, /setBackgroundPaused\(true\)/)
  assert.match(main, /win\.on\('hide'/)
})

test('macOS dock restore hides instead of quitting the core', () => {
  assert.match(main, /bindMainWindowLifecycle/)
  assert.match(main, /win\.hide\(\)/)
  assert.match(main, /platform === 'darwin' && !quitting/)
  assert.match(main, /process\.platform === ['"]darwin['"]/)
})

test('fde:notify posts a macOS banner and plays Glass', () => {
  assert.match(main, /fde:notify/)
  assert.match(main, /new Notification/)
  assert.match(main, /notice\.show\(\)/)
  assert.match(main, /fde:notice-open/)
  assert.match(main, /removeAll\(\)/)
  assert.match(main, /icon.icns/)
  assert.match(main, /afplay/)
  assert.match(main, /dock\?\.bounce/)
  assert.match(main, /appleScriptBanner/)
  assert.match(main, /display notification/)
  assert.doesNotMatch(main, /fallbackHelperNotice/)
  assert.doesNotMatch(main, /FDE-X Notify\.app/)
})
