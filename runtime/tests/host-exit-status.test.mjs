import assert from 'node:assert/strict'
import test from 'node:test'
import { PARENT_DEATH_DEADLINE_MS } from './support/parent-death-repro.mjs'
import { runHostExitStatus } from './support/host-exit-status-repro.mjs'
import { runForkTrial } from './support/host-fork-repro.mjs'

for (const mode of ['code3', 'sigsegv', 'sigkill', 'code0']) {
  test(`fake host ${mode} keeps the dsh-core status and clears the group`, { timeout: 180_000 }, async () => {
    const report = await runHostExitStatus({ mode })
    assert.equal(report.error, null, JSON.stringify(report))
    assert.equal(report.inGroup, true, JSON.stringify({ pip: report.pipBefore, leaderPgid: report.leaderPgid }))
    assert.equal(report.pipBefore.pgid, report.leaderPgid)
    assert.equal(report.message.includes(report.phrase), true, report.message)
    assert.equal(report.message.includes('真实退出状态未知'), false, report.message)
    assert.equal(report.judgment.pass, true, JSON.stringify(report.judgment))
    assert.ok(report.elapsedMs != null && report.elapsedMs <= PARENT_DEATH_DEADLINE_MS, JSON.stringify(report.elapsedMs))
    assert.equal(report.ok, true)
  })
}

test('a stale pid status file is not the host exit', { timeout: 180_000 }, async () => {
  const report = await runHostExitStatus({ mode: 'stale' })
  assert.equal(report.error, null, JSON.stringify(report))
  assert.equal(report.inGroup, true)
  assert.equal(report.message.includes('真实退出状态未知'), true, report.message)
  assert.equal(report.message.includes('signal SIGKILL'), true, report.message)
  assert.equal(report.message.includes('code 3'), false, report.message)
  assert.equal(report.ok, true)
})

test('a missing host status falls back without inventing a code', { timeout: 180_000 }, async () => {
  const report = await runHostExitStatus({ mode: 'missing' })
  assert.equal(report.error, null, JSON.stringify(report))
  assert.equal(report.inGroup, true)
  assert.equal(report.message.includes('真实退出状态未知'), true, report.message)
  assert.equal(report.message.includes('signal SIGKILL'), true, report.message)
  assert.equal(report.message.includes('code 3'), false, report.message)
  assert.equal(report.ok, true)
})

test('a host that keeps forking leaves no group member after exit', { timeout: 180_000 }, async () => {
  for (let i = 0; i < 30; i += 1) {
    const report = await runForkTrial()
    assert.equal(report.ok, true, JSON.stringify({ i, leaked: report.leakedCount, elapsedMs: report.elapsedMs }))
  }
})
