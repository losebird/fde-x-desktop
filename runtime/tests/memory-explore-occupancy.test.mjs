import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '../../src/pages/Memory.tsx'), 'utf8')

test('explore occupancy fills the panel and ignores viewport media', () => {
  assert.match(src, /function ensureHostCss/)
  assert.match(src, /\[data-fde-semantic-canvas\]\.dsh-explore-host \.explore-toolbelt/)
  assert.match(src, /explore-scene-stage/)
  assert.match(src, /explore-workflow-bar/)
  assert.match(src, /grid-template-columns:minmax\(0,1fr\) auto!important/)
  assert.match(src, /grid-column:1\/-1!important/)
  assert.match(src, /flex-wrap:wrap!important/)
  assert.doesNotMatch(src, /explore-toolbelt\{position:absolute/)
  assert.match(src, /function pingCanvasResize/)
  assert.match(src, /new ResizeObserver\(ping\)/)
  assert.match(src, /document\.head\.appendChild\(style\)/)
})
