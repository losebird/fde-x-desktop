import assert from 'node:assert/strict'
import test from 'node:test'

import { initWindowDataUrl, initWindowHtml } from '../dist/init-window.js'

test('init window data url is utf-8 encoded chinese', () => {
  const html = initWindowHtml()
  assert.match(html, /charset="utf-8"/)
  assert.match(html, /正在初始化/)
  const url = initWindowDataUrl()
  assert.equal(url.startsWith('data:text/html;charset=utf-8,'), true)
  const decoded = decodeURIComponent(url.slice('data:text/html;charset=utf-8,'.length))
  assert.match(decoded, /正在初始化/)
  assert.equal(decoded.includes('æ'), false)
})
