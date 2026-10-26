import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sanitizeOfficeHtml } from '../office-html.mjs'

test('sanitizeOfficeHtml strips script and event handlers from Word HTML', () => {
  const dirty = '<p>hello</p><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">x</a>'
  const clean = sanitizeOfficeHtml(dirty)
  assert.match(clean, /hello/)
  assert.equal(/<script/i.test(clean), false)
  assert.equal(/onerror/i.test(clean), false)
  assert.equal(/javascript:/i.test(clean), false)
})
