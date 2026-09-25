import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import {
  countHomeOperationExceptions,
  operationCountsAsHomeException,
} from '../biz/home-operation-exception.mjs'
import {
  businessKindsDescribedInLanAssistState,
  desiredLanAssistConnectionStatus,
  lookupReadyFromLanAssistState,
  reconcileLanAssistConnectionLamp,
} from '../biz/connection-lamp.mjs'

test('dry_run uncertain is not a homepage exception; real failures still are', () => {
  assert.equal(operationCountsAsHomeException({
    state: 'uncertain',
    executionMode: 'dry_run',
  }), false)
  assert.equal(operationCountsAsHomeException({ state: 'failed', executionMode: 'live' }), true)
  assert.equal(operationCountsAsHomeException({ state: 'compensation_failed' }), true)
  assert.equal(countHomeOperationExceptions([
    { state: 'uncertain', executionMode: 'dry_run' },
    { state: 'failed', executionMode: 'live' },
  ]), 1)
})

test('lan-assist lamp follows lookup + described kinds, or recent biz success', () => {
  const readyState = {
    ok: true,
    lookup: { configured: true, baseUrl: 'http://127.0.0.1:13000' },
    kinds: [{ kind: '客户', resource: 'customers', catalogVersion: 'schema:1', fields: ['no'] }],
  }
  assert.equal(lookupReadyFromLanAssistState(readyState), true)
  assert.equal(businessKindsDescribedInLanAssistState(readyState), true)
  assert.equal(desiredLanAssistConnectionStatus(readyState), 'connected')
  assert.equal(desiredLanAssistConnectionStatus(null), 'pending')
  assert.equal(desiredLanAssistConnectionStatus({ ok: false }), 'pending')
  assert.equal(desiredLanAssistConnectionStatus({ ok: true, lookup: {} }), 'pending')
  assert.equal(desiredLanAssistConnectionStatus({ ok: true, lookup: { configured: true } }, { bizSucceeded: true }), 'connected')
  assert.equal(desiredLanAssistConnectionStatus({
    ok: true,
    lookup: { configured: true, hasToken: true },
    capabilities: { connector: true },
  }), 'connected')
})

test('reconcileLanAssistConnectionLamp updates provider rows in sqlite', () => {
  const db = openDatabase(`/tmp/fde-home-conn-${Date.now()}.sqlite`, join(process.cwd(), 'runtime/migrations'))
  const before = db.prepare(`SELECT status FROM business_connections WHERE provider = 'lan-assist'`).get()
  assert.equal(before.status, 'pending')
  reconcileLanAssistConnectionLamp(db, {
    ok: true,
    lookup: { configured: true, baseUrl: 'http://127.0.0.1:13000' },
    kinds: [{ kind: '客户', resource: 'customers', catalogVersion: 'schema:1', fields: ['no'] }],
  })
  const after = db.prepare(`SELECT status FROM business_connections WHERE provider = 'lan-assist'`).get()
  assert.equal(after.status, 'connected')
  reconcileLanAssistConnectionLamp(db, null)
  const offline = db.prepare(`SELECT status FROM business_connections WHERE provider = 'lan-assist'`).get()
  assert.equal(offline.status, 'pending')
  db.close()
})
