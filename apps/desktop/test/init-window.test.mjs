import assert from 'node:assert/strict'
import test from 'node:test'

import { initWindowDataUrl, initWindowHtml, initWindowSetStepSource } from '../dist/init-window.js'

test('init window data url is utf-8 encoded chinese', () => {
  const html = initWindowHtml()
  assert.match(html, /charset="utf-8"/)
  assert.match(html, /正在初始化/)
  assert.match(html, /准备中/)
  assert.match(html, /#FAFAFA/)
  assert.match(html, /#2F6B3A/)
  const url = initWindowDataUrl()
  assert.equal(url.startsWith('data:text/html;charset=utf-8,'), true)
  const decoded = decodeURIComponent(url.slice('data:text/html;charset=utf-8,'.length))
  assert.match(decoded, /正在初始化/)
  assert.equal(decoded.includes('æ'), false)
})

test('init window step script writes status text', () => {
  const source = initWindowSetStepSource('正在启动核心…')
  assert.match(source, /getElementById\('s'\)/)
  assert.match(source, /正在启动核心/)
})
