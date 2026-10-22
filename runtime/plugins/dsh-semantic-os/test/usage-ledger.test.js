import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { estimateTokens, readUsage, recordUsage } from '../usage-ledger.js'

async function withHome(fn) {
  const previous = process.env.DSH_HOME
  const home = await mkdtemp(join(tmpdir(), 'dsos-usage-'))
  process.env.DSH_HOME = home
  try { await fn() } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
}

test('estimateTokens counts CJK as one and latin as ~4 chars', () => {
  assert.equal(estimateTokens('抽取'), 2)
  assert.ok(estimateTokens('abcd') >= 1)
})

test('recordUsage totals extract and search separately', async () => {
  await withHome(async () => {
    await recordUsage({ kind: 'extract', prompt: 10, completion: 5, total: 15, reasoning: 3, model: 'x' })
    await recordUsage({ kind: 'search', bytes: 100, context: 20 })
    const got = await readUsage()
    assert.equal(got.totals.extract.calls, 1)
    assert.equal(got.totals.extract.total, 15)
    assert.equal(got.totals.extract.reasoning, 3)
    assert.equal(got.totals.search.calls, 1)
    assert.equal(got.totals.search.bytes, 100)
    assert.equal(got.events[0].kind, 'search')
  })
})
