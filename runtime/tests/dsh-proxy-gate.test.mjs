import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldProxyDshPath } from '../dsh-proxy-gate.mjs'

const livePath = '/live'
const hostOrigin = 'http://127.0.0.1:9'

test('iframe path always proxies to Host', () => {
  assert.equal(shouldProxyDshPath('/dsh-app', { livePath }), true)
  assert.equal(shouldProxyDshPath('/dsh-app/', { hostOrigin, staticDir: '/pack/dist', livePath }), true)
  assert.equal(shouldProxyDshPath('/dsh-app/assets/client.js', { staticDir: '/pack/dist', livePath }), true)
})

test('packaged static keeps FDE routes', () => {
  const packed = { hostOrigin, staticDir: '/pack/dist', livePath }
  assert.equal(shouldProxyDshPath('/ai', packed), false)
  assert.equal(shouldProxyDshPath('/memory', packed), false)
  assert.equal(shouldProxyDshPath('/assets/index.js', packed), false)
  assert.equal(shouldProxyDshPath('/api/v1/ai/status', packed), false)
  assert.equal(shouldProxyDshPath('/live', packed), false)
})

test('dev BFF without static still forwards leftover Host paths', () => {
  const dev = { hostOrigin, livePath }
  assert.equal(shouldProxyDshPath('/plugins/foo', dev), true)
  assert.equal(shouldProxyDshPath('/ai', dev), true)
  assert.equal(shouldProxyDshPath('/api/v1/ai/status', dev), false)
  assert.equal(shouldProxyDshPath('/live', dev), false)
  assert.equal(shouldProxyDshPath('/health', dev), false)
  assert.equal(shouldProxyDshPath('/', dev), false)
})

test('no Host origin skips leftover paths', () => {
  assert.equal(shouldProxyDshPath('/plugins/foo', { livePath }), false)
  assert.equal(shouldProxyDshPath('/dsh-app/', { livePath }), true)
})
