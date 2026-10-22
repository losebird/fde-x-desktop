import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translateQuote } from '../translate.js'
import { dispatch } from '../http.js'

test('translateQuote collects text-delta and does not invent a session followup', async () => {
  const llm = {
    listProviders: () => [{ id: 'deepseek-official' }],
    listModels: async () => [{ id: 'deepseek-v4-flash' }],
    stream: async function* () {
      yield { type: 'text-delta', index: 0, text: 'Hel' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Hello' } }
    },
  }
  const got = await translateQuote(llm, '你好')
  assert.equal(got.ok, true)
  assert.equal(got.lang, 'EN')
  assert.equal(got.out, 'Hello')
  assert.equal(got.followup, undefined)
})

test('translate without a model is a hint, not a session dump', async () => {
  const empty = await translateQuote(null, 'hello')
  assert.equal(empty.ok, false)
  assert.equal(empty.error, 'NO_LLM')
  const viaHttp = await dispatch({}, '/translate', { quote: 'hello' })
  assert.equal(viaHttp.ok, false)
  assert.equal(viaHttp.error, 'NO_LLM')
  const ok = await dispatch({}, '/translate', { quote: '测试' }, null, {
    translate: async () => ({ ok: true, lang: 'EN', out: 'Test' }),
  })
  assert.equal(ok.out, 'Test')
})
