import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WORKSTATION_CONFIRM_HINT,
  createGate,
  createLookup,
  createSecretary,
  createStore,
} from '../lan-assist-engine.mjs'

test('BFF can import the lan-assist gate without the DSH client', () => {
  assert.equal(typeof createGate, 'function')
  assert.equal(typeof createLookup, 'function')
  assert.equal(typeof createSecretary, 'function')
  assert.equal(typeof createStore, 'function')
  assert.equal(typeof WORKSTATION_CONFIRM_HINT, 'string')
  assert.match(WORKSTATION_CONFIRM_HINT, /业务记录/)
})
