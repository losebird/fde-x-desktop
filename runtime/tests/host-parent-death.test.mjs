import assert from 'node:assert/strict'
import test from 'node:test'
import { PARENT_DEATH_DEADLINE_MS, runParentDeath } from './support/parent-death-repro.mjs'

test('SIGKILL of the connector reaps the host group within 2s', { timeout: 240_000 }, async () => {
  const out = process.env.PARENT_DEATH_OUT || ''
  const report = await runParentDeath({ mode: 'death', out: out || undefined })
  assert.equal(report.error, null, JSON.stringify(report))
  assert.equal(report.webLine, true, JSON.stringify(report))
  assert.equal(report.epipe, false, JSON.stringify(report))
  assert.ok(report.httpStatus >= 200 && report.httpStatus < 400, JSON.stringify(report))
  assert.equal(report.hostBefore?.ppid, report.parentPid, JSON.stringify(report.hostBefore))
  assert.ok(report.beforeKids.length > 0, `did not observe semantica pip under the live host: ${JSON.stringify(report)}`)
  assert.ok(report.elapsedMs != null && report.elapsedMs <= PARENT_DEATH_DEADLINE_MS, JSON.stringify(report))
  assert.deepEqual(report.reparented, [], `parent SIGKILL left a pid 1 child: ${JSON.stringify(report.reparented)}`)
  assert.deepEqual(report.survivors, [], `parent SIGKILL left host group processes: ${JSON.stringify(report.survivors)}`)
})

test('a living connector keeps the host connected for 30s', { timeout: 240_000 }, async () => {
  const out = process.env.PARENT_DEATH_STABLE_OUT || ''
  const report = await runParentDeath({ mode: 'stable', holdMs: 30_000, out: out || undefined })
  assert.equal(report.error, null, JSON.stringify(report))
  assert.equal(report.stable?.type, 'stable')
  assert.equal(report.webLine, true, JSON.stringify(report.stable))
  assert.equal(report.epipe, false, JSON.stringify(report))
  assert.ok(report.httpStatus >= 200 && report.httpStatus < 400, JSON.stringify(report.stable))
  assert.equal(report.hostBefore?.ppid, report.parentPid, JSON.stringify(report.hostBefore))
  assert.deepEqual(report.survivors, [], JSON.stringify(report.survivors))
})
