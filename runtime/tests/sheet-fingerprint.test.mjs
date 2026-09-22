import test from 'node:test'
import assert from 'node:assert/strict'
import { listQueryFingerprint, pendingSheetWatchFingerprint } from '../biz/sheet-fingerprint.mjs'

test('listQueryFingerprint differs when where differs', () => {
  const a = listQueryFingerprint({
    kind: 'T',
    action: '现查',
    where: [{ keys: ['status'], values: ['open'] }],
  })
  const b = listQueryFingerprint({
    kind: 'T',
    action: '现查',
    where: [{ keys: ['status'], values: ['open'], not: true }],
  })
  assert.notEqual(a, b)
})

test('listQueryFingerprint differs when hopWhere differs', () => {
  const a = listQueryFingerprint({
    kind: 'T',
    action: '现查',
    where: [{ keys: ['status'], values: ['open'] }],
    hopWhere: [{ keys: ['role'], values: ['a'] }],
  })
  const b = listQueryFingerprint({
    kind: 'T',
    action: '现查',
    where: [{ keys: ['status'], values: ['open'] }],
    hopWhere: [{ keys: ['role'], values: ['b'] }],
  })
  assert.notEqual(a, b)
})

test('listQueryFingerprint differs when nested from chain differs', () => {
  const a = listQueryFingerprint({
    kind: 'T',
    action: '现查',
    from: { kind: 'ParentA', from: { kind: 'MidB' } },
    steps: [{ kind: 'ParentA' }, { kind: 'MidB' }, { kind: 'T' }],
  })
  const b = listQueryFingerprint({
    kind: 'T',
    action: '现查',
  })
  assert.notEqual(a, b)
})

test('pendingSheetWatchFingerprint changes when query changes even if rowCount matches', () => {
  const row = { no: '1', status: 'x' }
  const fp1 = pendingSheetWatchFingerprint({
    kind: 'T',
    action: '现查',
    rows: [row],
    where: [{ keys: ['status'], values: ['a'] }],
  })
  const fp2 = pendingSheetWatchFingerprint({
    kind: 'T',
    action: '现查',
    rows: [row],
    where: [{ keys: ['status'], values: ['b'] }],
  })
  assert.notEqual(fp1, fp2)
})

test('pendingSheetWatchFingerprint changes when a peer hit appears', () => {
  const base = {
    kind: '甲',
    action: '现查',
    rows: [{ no: '1' }],
    sessionId: 's',
    speech: '甲并且乙',
  }
  const alone = pendingSheetWatchFingerprint(base)
  const withPeer = pendingSheetWatchFingerprint({
    ...base,
    peers: [{ kind: '乙', hitTotal: 5, rows: [{ no: '2' }] }],
  })
  assert.notEqual(alone, withPeer)
})

test('pendingSheetWatchFingerprint differs when sessionId differs', () => {
  const row = { no: '1' }
  const a = pendingSheetWatchFingerprint({
    kind: 'T',
    action: '现查',
    rows: [row],
    sessionId: 's1',
    speech: 'same speech',
  })
  const b = pendingSheetWatchFingerprint({
    kind: 'T',
    action: '现查',
    rows: [row],
    sessionId: 's2',
    speech: 'same speech',
  })
  assert.notEqual(a, b)
})
