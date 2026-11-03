import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('install dialog picker says 选择目录', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/components/skills/InstallDialog.tsx'), 'utf8')
  assert.match(src, />选择目录</)
  assert.match(src, /min-w-0 flex-1/)
  assert.match(src, /shrink-0 whitespace-nowrap/)
})
