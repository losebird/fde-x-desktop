import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveBffOrigin } from '../bff-origin.mjs'

test('vite pages map to fixed BFF ports', () => {
  assert.equal(resolveBffOrigin('', { protocol: 'http:', hostname: '127.0.0.1', port: '5174' }), 'http://127.0.0.1:4318')
  assert.equal(resolveBffOrigin('', { protocol: 'http:', hostname: '127.0.0.1', port: '5175' }), 'http://127.0.0.1:4319')
})

test('explicit env wins', () => {
  assert.equal(resolveBffOrigin('http://127.0.0.1:4318/', { protocol: 'http:', hostname: '127.0.0.1', port: '56329' }), 'http://127.0.0.1:4318')
})

test('packaged page uses its own origin', () => {
  assert.equal(resolveBffOrigin('', { protocol: 'http:', hostname: '127.0.0.1', port: '56329' }), 'http://127.0.0.1:56329')
  assert.equal(resolveBffOrigin('  ', { protocol: 'http:', hostname: '127.0.0.1', port: '54418' }), 'http://127.0.0.1:54418')
})

test('empty env does not invent 4318', () => {
  assert.equal(resolveBffOrigin('', { protocol: 'http:', hostname: '127.0.0.1', port: '' }), 'http://127.0.0.1')
  assert.equal(resolveBffOrigin(undefined), 'http://127.0.0.1')
})
