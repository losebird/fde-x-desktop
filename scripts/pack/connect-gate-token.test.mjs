import assert from 'node:assert/strict'
import { test } from 'node:test'
import { connectHeaders, planConnect, postConnect, tokenFromSupervisedLog } from './connect-gate.mjs'

const token = 'ab'.repeat(32)
const origin = 'http://127.0.0.1:43123'

test('a supervised log line yields a 64 hex token', () => {
  const log = `booting\nFDE_UI_TOKEN ${token}\nFDE_LISTENING 43123\n`
  const found = tokenFromSupervisedLog(log)
  assert.match(found, /^[0-9a-f]{64}$/u)
  assert.equal(found, token)
})

test('a log with only FDE_LISTENING yields ui_token_not_printed and does not build a POST', () => {
  const planned = planConnect('FDE_LISTENING 43123\n', origin)
  assert.equal(planned.reason, 'ui_token_not_printed')
  assert.equal(planned.post, null)
})

test('a header map carries x-fde-ui-token and an empty token never reaches fetch', async () => {
  const headers = connectHeaders(origin, token)
  assert.equal(headers['x-fde-ui-token'], token)
  let calls = 0
  let seen = null
  const fetchImpl = async (_url, init) => {
    calls += 1
    seen = init.headers
    return { status: 200 }
  }
  await assert.rejects(
    () => postConnect(fetchImpl, { origin, token: '' }),
    (error) => {
      assert.equal(error.reason, 'ui_token_not_printed')
      return true
    },
  )
  assert.equal(calls, 0)
  await postConnect(fetchImpl, { origin, token })
  assert.equal(calls, 1)
  assert.equal(seen['x-fde-ui-token'], token)
})
