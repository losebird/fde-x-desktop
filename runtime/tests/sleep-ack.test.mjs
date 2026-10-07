import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
test('sleep command returns ack not a hall snapshot', () => {
  const http = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor-overlays', 'dsh-lan-assist', 'http.js'), 'utf8')
  assert.match(http, /case '\/sleep':/)
  assert.match(http, /return \{ ok: true, asleep: Boolean\(b\.on\) \}/)
  assert.doesNotMatch(http, /case '\/sleep':\s*\n\s*return secretary\.setAsleep/)
})
