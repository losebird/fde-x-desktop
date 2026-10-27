import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootLanAssistBff, invokeLanAssist, lanAssistBffReady } from '../lan-assist-bff.mjs'
import {
  WORKSTATION_CONFIRM_HINT,
  createGate,
  createLanAssistCore,
  createLookup,
  createSecretary,
  createStore,
} from '../lan-assist-engine.mjs'

test('BFF can import the lan-assist gate without the DSH client', () => {
  assert.equal(typeof createGate, 'function')
  assert.equal(typeof createLanAssistCore, 'function')
  assert.equal(typeof createLookup, 'function')
  assert.equal(typeof createSecretary, 'function')
  assert.equal(typeof createStore, 'function')
  assert.equal(typeof WORKSTATION_CONFIRM_HINT, 'string')
  assert.match(WORKSTATION_CONFIRM_HINT, /业务记录/)
})

test('createLanAssistCore boots secretary and gate without DSH ctx', async () => {
  const core = await createLanAssistCore({
    store: {
      get: async () => ({ self: {}, lookups: [] }),
      update: async () => undefined,
      getSecret: async () => '',
    },
    port: 0,
    send: async () => ({ ok: true }),
    loadVocab: async () => [],
    saveVocab: async () => ({ ok: true }),
  })
  assert.equal(typeof core.secretary.previewBiz, 'function')
  assert.equal(typeof core.gate.previewTokenIndex, 'function')
  assert.equal(typeof core.secretary.hall, 'function')
})

test('BFF lan-assist invoke serves /state without DSH', async () => {
  await bootLanAssistBff({
    store: {
      get: async () => ({ self: {}, lookups: [] }),
      update: async () => undefined,
      getSecret: async () => '',
    },
    loadVocab: async () => [],
    saveVocab: async () => ({ ok: true }),
    send: async () => ({ ok: true }),
  })
  assert.equal(lanAssistBffReady(), true)
  const state = await invokeLanAssist('/state', { search: { sessionId: '' } })
  assert.equal(state.ok, true)
})
