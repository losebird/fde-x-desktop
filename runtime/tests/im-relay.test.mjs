import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { publicImRelay } from '../im-relay.mjs'

test('publicImRelay reads lan-assist snapshot fields', () => {
  assert.deepEqual(
    publicImRelay({
      relayConfigured: true,
      relayConnected: false,
      relayUrl: 'wss://relay.example/nats',
      relayCredsSet: true,
      relayEnv: false,
      relay: { error: 'NATS_DEPENDENCY_MISSING' },
    }),
    {
      configured: true,
      connected: false,
      url: 'wss://relay.example/nats',
      credsSet: true,
      env: false,
      error: 'NATS_DEPENDENCY_MISSING',
    },
  )
})

test('publicImRelay is off when the snapshot has no relay', () => {
  assert.deepEqual(publicImRelay({}), {
    configured: false,
    connected: false,
    url: '',
    credsSet: false,
    env: false,
    error: '',
  })
})
