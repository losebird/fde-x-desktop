import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/lib')
const { citableBecause, packDecisionBrief } = await import(pathToFileURL(resolve(srcRoot, 'decision-brief.ts')).href)

test('brief bag cites because ids and keeps drafts display-only', () => {
  const packed = packDecisionBrief({
    because: ['session:s1:3', 'memory:filed'],
    evidence: [
      { id: 'session:s1:3', snippet: '当轮用户确认过账' },
      { id: 'memory:filed', snippet: '已入档这一句足够长' },
    ],
    precedents: [{ id: 'd-live', outcome: 'approved', scenario: '同类贷款' }],
    drafts: [{ id: 'd-draft', outcome: '起草板', scenario: '还没点头' }],
    options: [{ id: 'd-live', label: 'approved' }],
  })
  assert.equal(packed.faces.find((row) => row.id === 'session:s1:3')?.citable, true)
  assert.equal(packed.faces.find((row) => row.id === 'memory:filed')?.citable, true)
  assert.equal(packed.faces.find((row) => row.id === 'd-draft')?.citable, false)
  assert.equal(packed.faces.find((row) => row.id === 'd-live')?.citable, false)
  assert.deepEqual(citableBecause(packed.faces, ['session:s1:3', 'd-draft', '还没点头']), ['session:s1:3'])
  assert.equal(packed.because.includes('还没点头'), false)
})

test('decision form does not use scenario text as because', async () => {
  const src = await readFile(resolve(srcRoot, '../pages/Memory.tsx'), 'utf8')
  assert.match(src, /citableBecause/)
  assert.match(src, /if \(!because\.length\)/)
  assert.equal(src.includes('form.scenario.trim().slice'), false)
  assert.equal(/because:\s*form\.scenario/.test(src), false)
  assert.equal(src.includes('依据 id'), false)
})
