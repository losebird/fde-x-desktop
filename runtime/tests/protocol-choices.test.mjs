import { test } from 'node:test'
import assert from 'node:assert/strict'
import { protocolChoicesFromNamespace } from '../models-settings.mjs'

test('protocolChoicesFromNamespace reads Host uid+refs union consts', () => {
  const schema = {
    uid: 1,
    refs: {
      1: { type: 'object', dict: { providers: 2 } },
      2: { type: 'dict', inner: 3 },
      3: { type: 'object', dict: { api: 4, baseURL: 8 } },
      4: { type: 'union', list: [5, 6, 7] },
      5: { type: 'const', value: 'openai-completions' },
      6: { type: 'const', value: 'openai-responses' },
      7: { type: 'const', value: 'anthropic-messages' },
      8: { type: 'string' },
    },
  }
  assert.deepEqual(protocolChoicesFromNamespace({ schema }), [
    'openai-completions',
    'openai-responses',
    'anthropic-messages',
  ])
})

test('protocolChoicesFromNamespace keeps nested typert union', () => {
  const schema = {
    type: 'object',
    properties: {
      providers: {
        type: 'record',
        value: {
          type: 'object',
          properties: {
            api: {
              type: 'union',
              list: [
                { value: 'openai-completions' },
                { value: 'openai-responses' },
              ],
            },
          },
        },
      },
    },
  }
  assert.deepEqual(protocolChoicesFromNamespace({ schema }), [
    'openai-completions',
    'openai-responses',
  ])
})
