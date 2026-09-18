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
