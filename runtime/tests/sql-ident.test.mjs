import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { quotedAssignments } from '../sql-ident.mjs'

test('quotedAssignments keeps allowlisted columns and drops injected keys', () => {
  const allowed = new Set(['title', 'start_at'])
  const row = quotedAssignments({
    title: '会',
    start_at: '2026-10-27',
    'title; DROP TABLE x': 'no',
    definition_json: '{}',
  }, allowed)
  assert.deepEqual(row.keys, ['title', 'start_at'])
  assert.equal(row.sql, '"title" = ?, "start_at" = ?')
  assert.deepEqual(row.values, ['会', '2026-10-27'])
})
