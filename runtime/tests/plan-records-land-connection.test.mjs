import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordsLandConnectionId } from '../plan/records-land-connection.mjs'

const connections = [
  { id: 'conn-a', name: '甲库' },
  { id: 'conn-b', name: '乙库' },
]

test('named biz ref switches RecordsPanel to that connection', () => {
  const panel = readFileSync(new URL('../../src/components/biz/RecordsPanel.tsx', import.meta.url), 'utf8')
  assert.match(panel, /recordsLandConnectionId\(/)
  assert.equal(recordsLandConnectionId({
    currentId: 'conn-a',
    dataLand: 4,
    connectionLand: 4,
    landConnection: '乙库',
    connections,
    vocabConnection: 'conn-a',
  }), 'conn-b')
})

test('legacy biz ref leaves the current RecordsPanel connection', () => {
  assert.equal(recordsLandConnectionId({
    currentId: 'conn-a',
    dataLand: 5,
    connectionLand: 0,
    landConnection: '',
    connections,
    vocabConnection: 'conn-b',
  }), 'conn-a')
})
