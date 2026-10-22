import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureGenerationHost } from '../generation.mjs'
import { createPageTokenClient } from './support/page-token-fetch.mjs'

const page = createPageTokenClient()

await ensureGenerationHost()

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const FIXTURE_TOKEN = 'catalog-fixture-token-k7m2'
const EMPTY_NOTICE = 'No skills are currently available'

function responsesStaticSse() {
  const events = [
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', id: 'msg_static', role: 'assistant', status: 'in_progress', content: [] },
    },
    { type: 'response.output_text.delta', output_index: 0, delta: 'static-intercept' },
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        type: 'message',
        id: 'msg_static',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: 'static-intercept' }],
      },
    },
    {
      type: 'response.completed',
      response: { id: 'resp_static', status: 'completed', output: [] },
    },
  ]
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
}

function startFakeModel() {
  const bodies = []
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    if (request.method === 'POST') {
      let body = null
      try {
        body = JSON.parse(raw)
      } catch {
        body = { _unparsed: true, raw }
      }
      bodies.push({ path: request.url, body, raw })
    }
    if (request.method === 'GET') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ object: 'list', data: [{ id: 'grok-4.6', object: 'model' }] }))
      return
    }
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    response.end(responsesStaticSse())
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        bodies,
        origin: `http://127.0.0.1:${port}`,
        close() {
          server.closeAllConnections?.()
          server.close()
        },
      })
    })
  })
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => resolve(port))
    })
  })
}

function stopChild(child) {
  if (!child || child.exitCode != null || child.signalCode != null || child.pid == null) return Promise.resolve()
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        child.kill('SIGKILL')
      }
      resolve()
    }, 4000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function waitFor(predicate, timeoutMs, label, abort) {
  const start = Date.now()
  let last = ''
  while (Date.now() - start < timeoutMs) {
    if (abort) {
      const reason = abort()
      if (reason) throw new Error(`${label} aborted: ${reason}`)
    }
    const value = await predicate()
    if (value) return value
    last = typeof value === 'string' ? value : last
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`timed out waiting for ${label}${last ? `: ${last}` : ''}`)
}

test('a standard session sends the skill catalog on the first model request', { timeout: 180000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-skill-catalog-'))
  const workspace = await mkdtemp(join(tmpdir(), 'fde-skill-catalog-ws-'))
  const model = await startFakeModel()
  const logs = { stdout: '', stderr: '' }
  let child = null
  try {
    await mkdir(join(home, 'profiles', 'fde-x'), { recursive: true })
    await mkdir(join(home, 'skills', 'catalog-fixture'), { recursive: true })
    await writeFile(join(home, 'skills', 'catalog-fixture', 'SKILL.md'), [
      '---',
      'name: catalog-fixture',
      `description: Fixture skill ${FIXTURE_TOKEN} for the standard session catalog.`,
      '---',
      '',
      'Follow the fixture skill.',
      '',
    ].join('\n'))
    await writeFile(join(home, '.credentials.yaml'), 'version: 1\nrefs:\n', { mode: 0o600 })
    await writeFile(join(home, 'settings.yaml'), [
      'llm-pi-ai:',
      '  providers:',
      '    grok2api:',
      '      displayName: grok2api',
      '      apiKeyEnv: GROK2API_API_KEY',
      '      api: openai-responses',
      `      baseURL: ${JSON.stringify(`${model.origin}/v1`)}`,
      '      models:',
      '        - id: grok-4.6',
      '          name: grok-4.6',
      'agent-default-model:',
      '  provider: grok2api',
      '  model: grok-4.6',
      '',
    ].join('\n'), { mode: 0o600 })
    const port = await freePort()
    const childState = { gone: '' }
    child = spawn(process.execPath, ['runtime/server.mjs'], {
      cwd: repoRoot,
      detached: true,
      env: {
        ...process.env,
        DSH_HOME: home,
        FDE_DSH_HOME: home,
        GROK2API_API_KEY: 'static-intercept',
        FDE_DATABASE_PATH: join(home, 'fde.sqlite'),
        FDE_RUNTIME_SUPERVISED: '1',
        FDE_AI_WORKSPACE: workspace,
        FDE_RUNTIME_PORT: String(port),
        FDE_LISTEN_HOST: '127.0.0.1',
        FDE_VENDOR_DIR: join(home, 'missing-vendor'),
        FDE_SEMANTIC_RUNTIME_MODE: 'readonly',
        DSH_PERMISSION_MODE: 'danger-full-access',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      page.observe(chunk)
      logs.stdout += chunk
    })
    child.stderr.on('data', (chunk) => { logs.stderr += chunk })
    child.once('exit', (code, signal) => {
      childState.gone = `code=${code ?? ''} signal=${signal ?? ''}`
    })
    const abortChild = () => (childState.gone ? `${childState.gone}\n${logs.stderr.slice(-800)}` : '')
    const origin = `http://127.0.0.1:${port}`
    await waitFor(() => logs.stdout.includes('FDE_LISTENING') || logs.stderr.includes('FDE_LISTENING'), 60000, 'FDE_LISTENING', abortChild)
    const connected = await page.fetch(new URL('/api/v1/ai/connect', origin), {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(180000),
    })
    const connectText = await connected.text()
    assert.equal(connected.ok, true, connectText.slice(0, 500))
    await waitForSettingsImport(origin, home, model.origin, abortChild)
    const createdResponse = await page.fetch(new URL('/api/v1/ai/sessions', origin), {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ cwd: workspace, agentPreset: 'standard' }),
      signal: AbortSignal.timeout(60000),
    })
    const createdText = await createdResponse.text()
    assert.equal(createdResponse.status, 201, createdText.slice(0, 500))
    const created = JSON.parse(createdText)
    const sessionId = created.data && (created.data.sessionId || created.data.id)
    assert.ok(sessionId, createdText.slice(0, 300))
    const prompted = await page.fetch(new URL(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, origin), {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ text: '用一句话打个招呼' }),
      signal: AbortSignal.timeout(60000),
    })
    const promptText = await prompted.text()
    assert.equal(prompted.ok, true, promptText.slice(0, 500))
    const recorded = await waitFor(() => bodiesWithText(model.bodies), 90000, 'model request', abortChild)
    const raw = recorded.raw
    const profile = await readFile(join(home, 'profiles', 'fde-x', 'cordis.patch.yml'), 'utf8')
    assert.equal(raw.includes('<available_skills>'), true, catalogFailure(raw, profile, logs))
    assert.equal(raw.includes(FIXTURE_TOKEN), true, catalogFailure(raw, profile, logs))
    assert.equal(raw.includes(EMPTY_NOTICE), false, catalogFailure(raw, profile, logs))
  } finally {
    model.close()
    await stopChild(child)
    await rm(home, { recursive: true, force: true })
    await rm(workspace, { recursive: true, force: true })
  }
})

function settingsImportSettled(modelsText) {
  let body
  try {
    body = JSON.parse(modelsText)
  } catch {
    return false
  }
  const data = body && body.data ? body.data : body
  const revision = data && data.namespaces && data.namespaces['agent-default-model']
    ? data.namespaces['agent-default-model'].revision
    : undefined
  return Number.isInteger(revision) && revision >= 1
}

test('models-settings text is not a finished settings import', () => {
  const partial = JSON.stringify({
    data: {
      namespaces: {
        'llm-pi-ai': { revision: 1 },
        'agent-default-model': { revision: 0 },
      },
      rows: [{ profile: { baseURL: 'http://127.0.0.1:9/v1', models: [{ id: 'grok-4.6' }] } }],
    },
  })
  assert.equal(settingsImportSettled(partial), false)
})

async function waitForSettingsImport(origin, _home, _modelOrigin, abortChild) {
  const deadline = Date.now() + 20000
  let last = ''
  while (Date.now() < deadline) {
    const reason = abortChild()
    if (reason) throw new Error(`settings import aborted: ${reason}`)
    const status = await page.fetch(new URL('/api/v1/ai/models-settings', origin), { headers: { origin } })
    const text = await status.text()
    last = text.slice(0, 500)
    if (status.ok && settingsImportSettled(text)) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`timed out waiting for agent-default-model revision\n${last}`)
}

function bodiesWithText(bodies) {
  return bodies.find((row) => row.raw && row.raw.includes('用一句话打个招呼')) || null
}

function toolNamesFrom(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('{')) return []
  const parsed = JSON.parse(raw)
  const tools = parsed && Array.isArray(parsed.tools) ? parsed.tools : []
  return tools.map((tool) => {
    const name = tool && (tool.name || (tool.function && tool.function.name))
    return name ? String(name) : ''
  }).filter(Boolean)
}

function catalogFailure(raw, profile, logs) {
  return [
    `catalog=${raw.includes('<available_skills>')} fixture=${raw.includes(FIXTURE_TOKEN)} emptyNotice=${raw.includes(EMPTY_NOTICE)}`,
    `tools=${toolNamesFrom(raw).slice(0, 30).join(',')}`,
    `profile tool-skill disabled true=${/^- id: tool-skill[\s\S]*?disabled: true/m.test(profile)}`,
    logs.stderr.slice(-800),
  ].join('\n')
}
