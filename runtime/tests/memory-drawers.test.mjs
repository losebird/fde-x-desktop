import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('Memory drawers include 批注 正文 治理 without a seventh canvas', () => {
  const src = readFileSync(resolve('src/pages/Memory.tsx'), 'utf8')
  assert.match(src, /label: '批注'/)
  assert.match(src, /label: '正文'/)
  assert.match(src, /label: '治理'/)
  assert.match(src, /drawer === 'note'/)
  assert.match(src, /drawer === 'markdown'/)
  assert.match(src, /drawer === 'govern'/)
  assert.match(src, /community_rag/)
  assert.match(src, /detect_value_conflicts/)
  assert.equal((src.match(/id: 'explore'/g) || []).length >= 1, true)
  assert.equal(src.includes('CANVASES = [') || src.includes('const CANVASES'), true)
  const canvasIds = [...src.matchAll(/id: '(explore|analyze|decisions|io|ontology|admin)'/g)].map((m) => m[1])
  assert.deepEqual([...new Set(canvasIds)].sort(), ['admin', 'analyze', 'decisions', 'explore', 'io', 'ontology'].sort())
})
