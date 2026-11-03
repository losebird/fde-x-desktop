import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { injectPageTokenHtml, isPageTokenValue } from '../page-token-html.mjs'

const TOKEN = 'ab'.repeat(32)
const STALE = 'cd'.repeat(32)

test('injectPageTokenHtml writes a live token into head', () => {
  const html = '<html><head></head><body></body></html>'
  const out = injectPageTokenHtml(html, TOKEN)
  assert.match(out, new RegExp(`<meta name="fde-ui-token" content="${TOKEN}" />`))
})

test('injectPageTokenHtml replaces a baked token', () => {
  const html = `<html><head><meta name="fde-ui-token" content="${STALE}" /></head></html>`
  const out = injectPageTokenHtml(html, TOKEN)
  assert.match(out, new RegExp(`content="${TOKEN}"`))
  assert.equal(out.includes(STALE), false)
})

test('injectPageTokenHtml strips a baked token when the live token is missing', () => {
  const html = `<html><head><meta name="fde-ui-token" content="${STALE}" /></head></html>`
  const out = injectPageTokenHtml(html, '')
  assert.equal(out.includes('fde-ui-token'), false)
  assert.equal(out.includes(STALE), false)
})

test('isPageTokenValue accepts a 64-hex token', () => {
  assert.equal(isPageTokenValue(TOKEN), true)
  assert.equal(isPageTokenValue('nope'), false)
})
