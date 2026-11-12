import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../resources/plugins/iui/lib')

test('IUI auto-fix is forced off on the host plugin', () => {
  const index = readFileSync(join(root, 'index.js'), 'utf8')
  assert.match(index, /fenceFeedback: Schema\.boolean\(\)\.default\(false\)/)
  assert.match(index, /fenceFeedback: false,/)
  assert.match(index, /feedbackOptions\.fenceFeedback = false/)
  assert.doesNotMatch(index, /feedbackOptions\.fenceFeedback = live\.fenceFeedback !== false/)
})

test('IUI client never enables fenceFeedback auto-repair', () => {
  const client = readFileSync(join(root, 'client.js'), 'utf8')
  assert.match(client, /fenceFeedback:!1/)
  assert.doesNotMatch(client, /fenceFeedback:t\.fenceFeedback!==!1/)
  assert.match(client, /Vx\(\)\.fenceFeedback&&Vw\(/)
})
