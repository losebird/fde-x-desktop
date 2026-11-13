import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

test('workstation tour walks every FDE-X surface', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/components/settings/WorkstationTour.tsx'), 'utf8')
  for (const id of ['welcome', 'workspace', 'ai', 'briefing', 'plan', 'im', 'files', 'terminal', 'data', 'mcp', 'skills', 'memory', 'settings', 'done']) {
    assert.match(src, new RegExp(`id: '${id}'`))
  }
  assert.match(src, /panel: 'briefing'/)
  assert.match(src, /panel: 'plan'/)
  assert.match(src, /panel: 'im'/)
  assert.match(src, /panel: 'files'/)
  assert.match(src, /panel: 'data'/)
  assert.match(src, /panel: 'mcp'/)
  assert.match(src, /panel: 'skills'/)
  assert.match(src, /panel: 'memory'/)
  assert.match(src, /reveal: 'terminal'/)
  assert.match(src, /reveal: 'ai'/)
  assert.match(src, /WorkstationTourGate/)
  assert.match(src, /fde-x-tour-open/)
})
