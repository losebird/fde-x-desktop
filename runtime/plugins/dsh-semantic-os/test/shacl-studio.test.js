import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))

test('rule check page does not mount Monaco', () => {
  const src = readFileSync(join(root, 'ui/src/workspaces/OntologyWorkspace/ShaclStudio.tsx'), 'utf8')
  assert.equal(src.includes('@monaco-editor/react'), false)
  assert.match(src, /asShapeList/)
  assert.match(src, /<textarea/)
})
