import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '../../src/lib/workbench-shortcuts.ts'), 'utf8')
const screen = readFileSync(join(import.meta.dirname, '../../src/components/IMScreen.tsx'), 'utf8')
const main = readFileSync(join(import.meta.dirname, '../../apps/desktop/src/main.ts'), 'utf8')

test('workbench shortcuts cover the Settings table', () => {
  assert.match(src, /name === 'session'/)
  assert.match(src, /name === 'task'/)
  assert.match(src, /name === 'event'/)
  assert.match(src, /name === 'briefing'/)
  assert.match(src, /name === 'mute-im'/)
  assert.match(src, /session-prev/)
  assert.match(src, /key === 'n'/)
  assert.match(screen, /handleWorkbenchKeydown/)
  assert.match(main, /before-input-event/)
  assert.match(main, /fde:shortcut/)
})
