import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { FDE_RESOURCES } from '../config.mjs'
import { HOST_GENERATION, generationInstallRoot } from '../generation.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const yamlDirs = [
  join(generationInstallRoot(), 'node_modules', 'yaml'),
  join(FDE_RESOURCES, 'dsh', 'node_modules', 'yaml'),
]
if (!yamlDirs.some((dir) => existsSync(join(dir, 'package.json')))) {
  throw new Error(
    `缺少 Host ${HOST_GENERATION.pin} 里的 yaml。`
    + `导入早报路由时会在这些目录找 yaml/package.json：${yamlDirs.join('、')}。`
    + '在仓库根目录执行 node --input-type=module -e "import { ensureGenerationHost } from \'./runtime/generation.mjs\'; await ensureGenerationHost()"'
    + `。它把 @deepseek-ai/dsh@${HOST_GENERATION.pin} 装进 runtime/.host-generation，yaml 随这一代 Host 下来。`,
  )
}

const { openDatabase } = await import('../db.mjs')
const { briefingInFlight, getBriefing, getOrCreateDefinition } = await import('../briefing/store.mjs')
const { mergeBriefingSubmit } = await import('../briefing/run.mjs')
const { handleBriefingRoutes } = await import('../routes/briefing.mjs')

const migrations = join(repoRoot, 'runtime', 'migrations')
const origin = 'http://127.0.0.1:5174'

function makeDb(path) {
  return openDatabase(path, migrations)
}

function registerWorkspace(db, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_submit_miss', 't', '', 'active', ?, ?, ?)
  `).run(JSON.stringify({ cwd }), now, now)
}

function runtime({ onPrompt, cwd } = {}) {
  const sessionCwd = cwd || '/tmp/fde-x-briefing-submit-miss-ws'
  return {
    status: () => ({ connected: true }),
    lanAssist: async () => ({ requests: [] }),
    call: async (endpoint) => {
      if (endpoint === 'session/list') {
        return {
          items: [{
            sessionId: 'sess-briefing',
            cwd: sessionCwd,
            origin: 'user',
            updatedAt: 2,
            running: false,
            projections: { values: { agentPreset: 'fde-briefing', cwd: sessionCwd } },
          }],
        }
      }
      if (endpoint === 'session/create') return { sessionId: 'sess-briefing' }
      if (endpoint === 'session/prompt') {
        if (onPrompt) return onPrompt()
        return {}
      }
      if (endpoint === 'session/cancel') return {}
      return {}
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/start', data: {} } }
      yield { type: 'event', event: { type: 'turn/end', data: {} } }
    },
  }
}

function failureLine(sections) {
  return (Array.isArray(sections) ? sections : [])
    .filter((section) => section && section.error)
    .map((section) => `${section.title}失败`)
    .join('、')
}

async function postRun(db, aiRuntime, cwd) {
  const response = {
    statusCode: 0,
    body: '',
    writeHead(status) { this.statusCode = status },
    end(body) { this.body = String(body || '') },
  }
  const handled = await handleBriefingRoutes(
    { method: 'POST', headers: { origin } },
    response,
    new URL('http://127.0.0.1:4318/api/v1/briefing/run'),
    {
      db,
      aiRuntime,
      allowedOrigins: new Set([origin]),
      correlationId: 'corr-submit-miss',
      sendError(res, status, code, message) {
        res.writeHead(status)
        res.end(JSON.stringify({ ok: false, error: code, message }))
      },
      readJson: async () => ({ workspaceCwd: cwd, mode: 'full' }),
      defaultWorkspaceCwd: cwd,
      runBriefingDeps: { db, aiRuntime },
    },
  )
  assert.equal(handled, true)
  return { status: response.statusCode, body: JSON.parse(response.body || '{}') }
}

function aiSection(briefing) {
  return (briefing?.sections || []).find((section) => section && section.type === 'ai')
}

async function waitSettled(db, id, cwd) {
  for (let i = 0; i < 80; i += 1) {
    const row = getBriefing(db, id, cwd)
    if (row && !briefingInFlight(row)) return row
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return getBriefing(db, id, cwd)
}

test('a finished turn without fde_briefing_submit nudges once then closes in Chinese', async () => {
  const path = '/tmp/fde-x-briefing-submit-miss.sqlite'
  await rm(path, { force: true })
  const cwd = '/tmp/fde-x-briefing-submit-miss-ws'
  const db = makeDb(path)
  registerWorkspace(db, cwd)
  getOrCreateDefinition(db, cwd)
  const page = readFileSync(join(repoRoot, 'src/pages/Briefing.tsx'), 'utf8')
  assert.match(page, /\$\{s\.title\}失败/)

  let prompts = 0
  const aiRuntime = runtime({
    cwd,
    onPrompt() {
      prompts += 1
      return {}
    },
  })
  const first = await postRun(db, aiRuntime, cwd)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  const briefing = await waitSettled(db, first.body.data.briefingId, cwd)
  assert.equal(prompts, 2)
  const ai = aiSection(briefing)
  assert.equal(ai?.title, 'AI 早报')
  assert.equal(ai?.pendingAgent, false)
  assert.equal(ai?.error, '没有收到早报提交')
  assert.notEqual(briefing.status, 'running')
  assert.match(failureLine(briefing.sections), /AI 早报失败/)
  assert.equal(briefing.sections.some((section) => section.pendingAgent), false)

  const second = await postRun(db, aiRuntime, cwd)
  assert.equal(second.status, 200, JSON.stringify(second.body))
  const secondRow = await waitSettled(db, second.body.data.briefingId, cwd)
  assert.notEqual(secondRow.id, first.body.data.briefingId)
  db.close()
})

test('a rejected briefing prompt is the Chinese section error and does not stay running', async () => {
  const path = '/tmp/fde-x-briefing-submit-prompt.sqlite'
  await rm(path, { force: true })
  const cwd = '/tmp/fde-x-briefing-submit-prompt-ws'
  const db = makeDb(path)
  registerWorkspace(db, cwd)
  getOrCreateDefinition(db, cwd)
  const aiRuntime = runtime({
    cwd,
    onPrompt() {
      throw new Error('会话拒绝了这次 prompt')
    },
  })
  const first = await postRun(db, aiRuntime, cwd)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  const briefing = await waitSettled(db, first.body.data.briefingId, cwd)
  const ai = aiSection(briefing)
  assert.equal(ai?.error, '会话拒绝了这次 prompt')
  assert.equal(ai?.pendingAgent, false)
  assert.notEqual(briefing.status, 'running')
  assert.match(failureLine(briefing.sections), /AI 早报失败/)

  const second = await postRun(db, runtime({ cwd }), cwd)
  assert.equal(second.status, 200, JSON.stringify(second.body))
  const secondRow = await waitSettled(db, second.body.data.briefingId, cwd)
  assert.notEqual(secondRow.id, first.body.data.briefingId)
  db.close()
})

test('an English host error is copied onto the AI section', async () => {
  const path = '/tmp/fde-x-briefing-submit-english.sqlite'
  await rm(path, { force: true })
  const cwd = '/tmp/fde-x-briefing-submit-english-ws'
  const db = makeDb(path)
  registerWorkspace(db, cwd)
  getOrCreateDefinition(db, cwd)
  const hostError = 'Host rejected the briefing prompt'
  const aiRuntime = runtime({
    cwd,
    onPrompt() {
      throw new Error(hostError)
    },
  })
  const first = await postRun(db, aiRuntime, cwd)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  const briefing = await waitSettled(db, first.body.data.briefingId, cwd)
  const ai = aiSection(briefing)
  assert.equal(ai?.error, hostError)
  assert.equal(ai?.pendingAgent, false)
  assert.notEqual(briefing.status, 'running')
  assert.match(failureLine(briefing.sections), /AI 早报失败/)

  const second = await postRun(db, runtime({ cwd }), cwd)
  assert.equal(second.status, 200, JSON.stringify(second.body))
  const secondRow = await waitSettled(db, second.body.data.briefingId, cwd)
  assert.notEqual(secondRow.id, first.body.data.briefingId)
  db.close()
})

test('a submit that lands stays on the section when the turn ends', async () => {
  const path = '/tmp/fde-x-briefing-submit-landed.sqlite'
  await rm(path, { force: true })
  const cwd = '/tmp/fde-x-briefing-submit-landed-ws'
  const db = makeDb(path)
  registerWorkspace(db, cwd)
  getOrCreateDefinition(db, cwd)
  const aiRuntime = runtime({
    cwd,
    onPrompt() {
      const row = db.prepare(`
        SELECT agent_request_id FROM briefings ORDER BY created_at DESC LIMIT 1
      `).get()
      const landed = mergeBriefingSubmit(db, row.agent_request_id, [
        { id: 'ai-digest', type: 'ai', title: 'AI 早报', items: [{ text: '今日总览' }] },
      ])
      assert.equal(landed.ok, true)
    },
  })
  const first = await postRun(db, aiRuntime, cwd)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  const briefing = await waitSettled(db, first.body.data.briefingId, cwd)
  const ai = aiSection(briefing)
  assert.equal(ai?.items?.[0]?.text, '今日总览')
  assert.equal(ai?.error, undefined)
  assert.equal(ai?.pendingAgent, false)
  assert.notEqual(briefing.status, 'running')
  db.close()
})
