import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../..', import.meta.url))

test('desktop and mac workflows take plugins from the repo and do not copy ~/.dsh/vendor', () => {
  for (const rel of ['.github/workflows/desktop.yml', '.github/workflows/mac-all.yml']) {
    const text = readFileSync(join(repo, rel), 'utf8')
    assert.equal(/cp\b[^\n]*\.dsh\/vendor/.test(text), false, rel)
    assert.equal(/rsync\b[^\n]*\.dsh\/vendor/.test(text), false, rel)
    assert.equal(text.includes('.dsh/vendor/dsh-lan-assist'), false, rel)
    assert.equal(text.includes('.dsh/vendor/dsh-semantic-os'), false, rel)
    assert.match(text, /runtime\/plugins/, rel)
  }
})
