import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergePageCors } from '../proxy-cors.mjs'

test('semantic proxy 200 keeps body headers and uses page Allow-Origin', () => {
  const merged = mergePageCors(
    {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': 'http://127.0.0.1:57240',
      'cache-control': 'no-store',
    },
    { 'Access-Control-Allow-Origin': 'http://127.0.0.1:5174', Vary: 'Origin' },
  )
  assert.equal(merged['Access-Control-Allow-Origin'], 'http://127.0.0.1:5174')
  assert.equal(merged['access-control-allow-origin'], undefined)
  assert.equal(merged['content-type'], 'application/json; charset=utf-8')
  assert.equal(merged.Vary, 'Origin')
})

test('semantic proxy without page origin does not invent Allow-Origin', () => {
  const merged = mergePageCors({ 'content-type': 'application/json' }, {})
  assert.equal(merged['Access-Control-Allow-Origin'], undefined)
  assert.equal(merged['content-type'], 'application/json')
})
