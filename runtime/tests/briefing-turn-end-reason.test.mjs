import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../db.mjs'
import { runBriefing } from '../briefing/run.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrations = join(repoRoot, 'runtime', 'migrations')
const KEY_TEXT = '没有配置模型密钥（MISSING_CREDENTIAL）。请到设置里配置 key。'

function turnEnd(reason) {
  return {
    type: 'event',
    event: {
      type: 'turn/end',
      data: { turn: 1, reason },
    },
  }
}

function runtime(reason, cwd) {
  return {
    status: () => ({ connected: true }),
    lanAssist: async () => ({ requests: [] }),
    semanticOs: async () => ({ cards: [] }),
    call: async (endpoint) => {
      if (endpoint === 'session/list') {
        return { items: [{ sessionId: 'sess-brief', cwd, running: false }] }
      }
      if (endpoint === 'session/create') return { sessionId: 'sess-brief' }
      if (endpoint === 'session/prompt') return {}
      return {}
    },
    async *stream(endpoint) {
      if (endpoint === 'workspace/follow') {
        yield { type: 'baseline', value: { items: [] } }
        return
      }
      if (endpoint !== 'session/follow') return
      yield { type: 'snapshot', records: [] }
      yield { type: 'event', event: { type: 'turn/start', data: { turn: 1 } } }
      yield turnEnd(reason)
    },
  }
}

async function withWorkspace(t) {
  const dir = await mkdtemp(join(tmpdir(), 'fde-brief-reason-'))
  const cwd = join(dir, 'ws')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(cwd)
  const db = openDatabase(join(dir, 'core.sqlite'), migrations)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_reason', 'reason', '', 'active', ?, ?, ?)
  `).run(JSON.stringify({ cwd }), now, now)
  t.after(async () => {
    db.close()
    await rm(dir, { recursive: true, force: true })
  })
  return { db, cwd }
}

function aiError(result) {
  const sections = result?.briefing?.sections || []
  const ai = sections.find((section) => section.type === 'ai')
  return ai?.error || ''
}

test('a turn that ends without a key names that reason in the briefing block', async (t) => {
  const { db, cwd } = await withWorkspace(t)
  const aiRuntime = runtime({
    kind: 'error',
    error: {
      message: 'llm-deepseek: no API key for provider route "deepseek-official"',
      code: 'MISSING_CREDENTIAL',
    },
  }, cwd)
  const result = await runBriefing({ db, aiRuntime }, { workspaceCwd: cwd, mode: 'full' })
  const error = aiError(result)
  assert.notEqual(error, '没有收到早报提交')
  assert.notEqual(error, '超时')
  assert.equal(error, KEY_TEXT)
})

test('a turn failure nested under another field still reaches the block', async (t) => {
  const { db, cwd } = await withWorkspace(t)
  const aiRuntime = runtime({
    kind: 'error',
    failure: { code: 'MODEL_OVERLOADED', message: 'busy' },
  }, cwd)
  const result = await runBriefing({ db, aiRuntime }, { workspaceCwd: cwd, mode: 'full' })
  const error = aiError(result)
  assert.notEqual(error, '没有收到早报提交')
  assert.equal(error, '早报这一轮失败（MODEL_OVERLOADED）。')
})

const KEY_LINE = '没有配置模型密钥（MISSING_CREDENTIAL）。请到设置里配置 key。'
const coded = (code) => `早报这一轮失败（${code}）。`

const turnCases = [
  {
    name: 'MISSING_CREDENTIAL',
    reason: {
      kind: 'error',
      error: {
        code: 'MISSING_CREDENTIAL',
        message: 'llm-deepseek: no API key for provider route "deepseek-official"',
      },
    },
    expect: KEY_LINE,
  },
  {
    name: 'INVALID_CREDENTIAL',
    reason: {
      kind: 'error',
      error: { code: 'INVALID_CREDENTIAL', message: 'stored credential is malformed' },
    },
    expect: coded('INVALID_CREDENTIAL'),
  },
  {
    name: 'AUTH with api key in the message',
    reason: {
      kind: 'error',
      error: { code: 'AUTH', message: '401 invalid api key' },
    },
    expect: coded('AUTH'),
  },
  {
    name: 'RATE_LIMIT with 密钥 in the message',
    reason: {
      kind: 'error',
      error: { code: 'RATE_LIMIT', message: '请检查密钥配额后再试' },
    },
    expect: coded('RATE_LIMIT'),
  },
  {
    name: 'other code whose message mentions api key',
    reason: {
      kind: 'error',
      failure: { code: 'PROVIDER_BUSY', message: 'upstream said api key quota' },
    },
    expect: coded('PROVIDER_BUSY'),
  },
  {
    name: 'message mentions a key and has no code',
    reason: {
      kind: 'error',
      error: { message: 'no API key for provider' },
    },
    expect: '早报这一轮失败。',
  },
]

for (const row of turnCases) {
  test(`turn end code ${row.name} is named in the briefing block`, async (t) => {
    const { db, cwd } = await withWorkspace(t)
    const result = await runBriefing(
      { db, aiRuntime: runtime(row.reason, cwd) },
      { workspaceCwd: cwd, mode: 'full' },
    )
    const error = aiError(result)
    assert.notEqual(error, '没有收到早报提交')
    assert.equal(error, row.expect)
  })
}
