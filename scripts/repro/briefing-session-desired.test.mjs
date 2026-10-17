import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as zlib from 'node:zlib'

async function loadFixture() {
  if (typeof zlib.zstdDecompress !== 'function') {
    throw new Error('这套复现要带 node:zlib zstdDecompress 的 Node。本机可用 22.23.3。')
  }
  return import('./lib/briefing-fixture.mjs')
}

test('configured stdio MCP fills the briefing when the new session has no request header', async () => {
  const { removeFixtureRoot, runProjectionBriefing } = await loadFixture()
  const observed = await runProjectionBriefing()
  try {
    assert.deepEqual(observed.spoken.map((row) => row.toolNames), [['imap_search'], ['aihot_get_latest']])
    assert.deepEqual(observed.projectedBeforePrompt, [])
    assert.equal(observed.mail.error, '')
    assert.equal(observed.news.error, '')
    assert.ok(observed.mail.items > 0, '重要邮件 count')
    assert.ok(observed.news.items > 0, '行业资讯 count')
  } finally {
    await removeFixtureRoot(observed.root)
  }
})

test('creating the briefing session publishes ai.session.changed', async () => {
  const { removeFixtureRoot, runProjectionBriefing } = await loadFixture()
  const observed = await runProjectionBriefing()
  try {
    assert.equal(observed.sessionCreate?.agentPreset, 'fde-briefing')
    assert.ok(observed.events.includes('ai.session.changed'))
  } finally {
    await removeFixtureRoot(observed.root)
  }
})
