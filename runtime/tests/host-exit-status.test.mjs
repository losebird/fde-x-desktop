import assert from 'node:assert/strict'
import test from 'node:test'
import { PARENT_DEATH_DEADLINE_MS } from './support/parent-death-repro.mjs'
import { runHostExitStatus } from './support/host-exit-status-repro.mjs'

for (const mode of ['code3', 'sigsegv', 'code0']) {
  test(`fake host ${mode} keeps the dsh-core status and clears the group`, { timeout: 180_000 }, async () => {
    const report = await runHostExitStatus({ mode })
    assert.equal(report.error, null, JSON.stringify(report))
    assert.equal(report.inGroup, true, JSON.stringify({ pip: report.pipBefore, leaderPgid: report.leaderPgid }))
    assert.equal(report.pipBefore.pgid, report.leaderPgid)
    assert.equal(report.message.includes(report.phrase), true, report.message)
    assert.equal(report.judgment.pass, true, JSON.stringify(report.judgment))
    assert.ok(report.elapsedMs != null && report.elapsedMs <= PARENT_DEATH_DEADLINE_MS, JSON.stringify(report.elapsedMs))
    assert.equal(report.ok, true)
  })
}
