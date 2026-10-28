import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootLanAssistBff, invokeLanAssist, lanAssistBffReady, setLanAssistVocabSaver } from '../lan-assist-bff.mjs'
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
    lan: false,
    store: {
      get: async () => ({ self: {}, lookups: [] }),
      update: async () => undefined,
      getSecret: async () => '',
    },
    loadVocab: async () => [],
    send: async () => ({ ok: true }),
  })
  assert.equal(lanAssistBffReady(), true)
  const state = await invokeLanAssist('/state', { search: { sessionId: '' } })
  assert.equal(state.ok, true)
})

test('BFF GET /thread is empty-ok for a group, not dispatch NOT_FOUND', async () => {
  const thread = await invokeLanAssist('/thread', { search: { groupId: 'g_missing' } })
  assert.equal(thread.ok, true)
  assert.equal(Array.isArray(thread.requests), true)
  assert.equal(thread.requests.length, 0)
  const peer = await invokeLanAssist('/thread', { search: { peerId: 'pk_nobody' } })
  assert.equal(peer.ok, true)
  assert.equal(Array.isArray(peer.requests), true)
})

test('BFF vocab write-back goes through saveVocab into memory', async () => {
  const saved = []
  setLanAssistVocabSaver(async (workspace, concept) => {
    saved.push({ workspace, concept })
    return { ok: true }
  })
  const published = await invokeLanAssist('/catalog/publish', {
    method: 'POST',
    body: { workspace: '/tmp/ws', kind: '费用报销', can: ['现查'], confirm: true },
  })
  assert.equal(published.ok, true)
  assert.equal(saved.length, 1)
  assert.equal(saved[0].workspace, '/tmp/ws')
})
