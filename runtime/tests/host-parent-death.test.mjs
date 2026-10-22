import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { PARENT_DEATH_DEADLINE_MS, judgeHostCrash, judgeHostGroupWindow, runParentDeath } from './support/parent-death-repro.mjs'

test('SIGKILL of the connector reaps the host group within 2s', { timeout: 240_000 }, async () => {
  const out = process.env.PARENT_DEATH_OUT || ''
  const report = await runParentDeath({ mode: 'death', out: out || undefined })
  assert.equal(report.error, null, JSON.stringify(report))
  assert.equal(report.connector, 'DshCoreConnector')
  assert.ok(report.samples.length > 0, JSON.stringify(report.samples))
  const judgment = judgeHostGroupWindow(report.samples)
  assert.deepEqual(report.judgment, judgment)
  assert.equal(judgment.endClear, true, JSON.stringify(judgment))
  assert.equal(judgment.stayedClear, true, JSON.stringify(judgment))
  assert.equal(judgment.pass, true, JSON.stringify(judgment))
  assert.equal(report.webLine, true, JSON.stringify(report))
  assert.equal(report.epipe, false, JSON.stringify(report))
  assert.ok(report.httpStatus >= 200 && report.httpStatus < 400, JSON.stringify(report))
  assert.equal(report.hostBefore?.ppid, report.parentPid, JSON.stringify(report.hostBefore))
  assert.ok(report.beforeKids.length > 0, `did not observe semantica pip under the live host: ${JSON.stringify(report)}`)
  assert.ok(report.elapsedMs != null && report.elapsedMs <= PARENT_DEATH_DEADLINE_MS, JSON.stringify(report))
  assert.deepEqual(report.reparented, [], `parent SIGKILL left a pid 1 child: ${JSON.stringify(report.reparented)}`)
  assert.deepEqual(report.survivors, [], `parent SIGKILL left host group processes: ${JSON.stringify(report.survivors)}`)
})

test('SIGKILL of the host bin reaps in-group semantica pip within 2s', { timeout: 240_000 }, async () => {
  const out = process.env.HOST_CRASH_OUT || ''
  const report = await runParentDeath({ mode: 'crash', out: out || undefined })
  assert.equal(report.error, null, JSON.stringify(report))
  const judgment = judgeHostCrash(report)
  assert.deepEqual(report.crashJudgment, judgment)
  assert.equal(judgment.inGroup, true, JSON.stringify({ pip: report.pipBefore, leaderPgid: report.leaderPgid }))
  assert.ok(report.pipBefore.length > 0, JSON.stringify(report.pipBefore))
  for (const pip of report.pipBefore) {
    assert.equal(pip.pgid, report.leaderPgid, JSON.stringify({ pip, leaderPgid: report.leaderPgid }))
    assert.equal(String(pip.stat).includes('Z'), false, JSON.stringify(pip))
  }
  assert.deepEqual(judgeHostGroupWindow(report.samples), report.judgment)
  assert.equal(judgment.endClear, true, JSON.stringify(judgment))
  assert.equal(judgment.stayedClear, true, JSON.stringify(judgment))
  assert.equal(judgment.pass, true, JSON.stringify(judgment))
  assert.equal(report.killed?.role, 'host', JSON.stringify(report.killed))
  assert.notEqual(report.killed?.pid, report.killed?.leaderPid)
  assert.notEqual(report.killed?.pid, report.parentPid)
  assert.equal(report.parentAliveAfter, true)
  assert.ok(report.elapsedMs != null && report.elapsedMs <= PARENT_DEATH_DEADLINE_MS, JSON.stringify(report.elapsedMs))
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
