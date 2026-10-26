import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { workbenchApiHeaders } from '../security-headers.mjs'
import { WEB_APP_CSP_SANDBOX } from '../apps/web-sandbox.mjs'

test('workbench API headers include nosniff and deny framing', () => {
  const headers = workbenchApiHeaders()
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.equal(headers['Referrer-Policy'], 'no-referrer')
  assert.equal(headers['Content-Security-Policy'], undefined)
})

test('share HTML CSP sandbox is not the workbench API header set', () => {
  assert.match(WEB_APP_CSP_SANDBOX, /^sandbox /)
  assert.notEqual(WEB_APP_CSP_SANDBOX, workbenchApiHeaders()['Content-Security-Policy'])
})
