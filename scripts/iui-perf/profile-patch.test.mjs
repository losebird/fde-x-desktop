import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ensureGenerationHost } from '../../runtime/generation.mjs'
import { PROMPT } from './lib/request-facts.mjs'
import { redactText } from './lib/redact.mjs'
import { countTokens } from './lib/tokens.mjs'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const PLANTED = 'sk-plantedmcpsecretvalue'
const SERVERS = [
  ['cua-driver', 8, 600],
  ['chrome-devtools', 12, 800],
  ['playwright', 10, 700],
  ['filesystem', 6, 400],
  ['github', 8, 500],
  ['memory', 5, 400],
  ['fetch', 4, 350],
  ['sqlite', 6, 450],
]

await ensureGenerationHost()
const { buildMcpPatchBlock } = await import('../../runtime/mcp-archive.mjs')

function fakeServerSource() {
  return [
    "import { createInterface } from 'node:readline'",
    "import { stdin, stdout } from 'node:process'",
    'const serverName = process.argv[2] || "alpha"',
    'const toolCount = Number(process.argv[3] || 1)',
    'const descChars = Number(process.argv[4] || 200)',
    'function description(index) {',
    '  const unit = `${serverName} tool ${index} inspects page state and returns a structured result for the operator. `',
    "  let text = ''",
    '  let n = 0',
    '  while (text.length < descChars) {',
    '    text += unit.replace("result", `result-${n}`)',
    '    n += 1',
    '  }',
    '  return text.slice(0, descChars)',
    '}',
    'const tools = []',
    'for (let i = 0; i < toolCount; i += 1) {',
    '  tools.push({',
    '    name: `t${i}`,',
    '    description: description(i),',
    '    inputSchema: { type: "object", properties: { q: { type: "string", description: "query" } }, additionalProperties: false },',
    '  })',
    '}',
    'const rl = createInterface({ input: stdin })',
    "rl.on('line', (line) => {",
    '  const trimmed = line.trim()',
    '  if (!trimmed) return',
    '  let msg',
    '  try { msg = JSON.parse(trimmed) } catch { return }',
    '  if (msg.id == null) return',
    "  if (msg.method === 'initialize') {",
    '    const version = msg.params && msg.params.protocolVersion ? msg.params.protocolVersion : "2025-03-26"',
    '    stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: { name: serverName, version: "0.0.0" } } })}\\n`)',
    '    return',
    '  }',
    "  if (msg.method === 'tools/list') {",
    '    stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { tools } })}\\n`)',
    '    return',
    '  }',
    "  if (msg.method === 'ping') stdout.write(`${JSON.stringify({ jsonrpc: \"2.0\", id: msg.id, result: {} })}\\n`)",
    '})',
    '',
  ].join('\n')
}

function responsesStaticSse() {
  const events = [
    { type: 'response.output_text.delta', output_index: 0, delta: 'static-intercept' },
    { type: 'response.completed', response: { id: 'resp_static', status: 'completed', output: [] } },
  ]
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
}

function startFakeModel() {
  const bodies = []
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    if (request.method === 'POST') bodies.push(raw)
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

function stopChild(child) {
  if (!child || child.exitCode != null || child.signalCode != null) return Promise.resolve()
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

async function waitFor(predicate, timeoutMs, label) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const value = await predicate()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`timed out waiting for ${label}`)
}

async function applyUserPatch(home, patchFile) {
  const moduleUrl = new URL('./lib/profile-patch.mjs', import.meta.url)
  if (!existsSync(fileURLToPath(moduleUrl))) return false
  const previous = process.env.IUI_PERF_PROFILE_PATCH
  process.env.IUI_PERF_PROFILE_PATCH = patchFile
  try {
    const { applyProfilePatch } = await import(moduleUrl.href)
    await applyProfilePatch(home, ['fde-x'])
    return true
  } finally {
    if (previous == null) delete process.env.IUI_PERF_PROFILE_PATCH
    else process.env.IUI_PERF_PROFILE_PATCH = previous
  }
}

async function mcpStatus(origin) {
  const response = await fetch(new URL('/api/v1/mcp/servers', origin), { headers: { origin } })
  const payload = await response.json()
  const mcp = payload && payload.data && Array.isArray(payload.data.mcp) ? payload.data.mcp : []
  return mcp.map((row) => `${row.serverName}:${row.status}`).join(' ')
}

async function waitUntilMcpReady(origin, expectPatch) {
  if (!expectPatch) return 'patch-not-applied'
  const names = SERVERS.map((row) => row[0])
  const deadline = Date.now() + 120000
  let last = ''
  while (Date.now() < deadline) {
    last = await mcpStatus(origin)
    const rows = last.split(' ').filter(Boolean)
    const failed = rows.filter((row) => row.endsWith(':failed'))
    if (failed.length) throw new Error(`mcp server failed: ${failed.join(' ')}`)
    if (names.every((name) => rows.includes(`${name}:loaded`))) return last
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`mcp servers did not become loaded: ${last}`)
}

async function captureArm({ port, patchFile }) {
  const home = await mkdtemp(join(tmpdir(), 'iui-perf-patch-'))
  const workspace = await mkdtemp(join(tmpdir(), 'iui-perf-patch-ws-'))
  const model = await startFakeModel()
  const logs = { out: '' }
  let child = null
  try {
    await mkdir(join(home, 'profiles', 'fde-x'), { recursive: true })
    await mkdir(join(home, 'skills'), { recursive: true })
    const applied = patchFile ? await applyUserPatch(home, patchFile) : false
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
    child = spawn(process.execPath, ['runtime/boot.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DSH_HOME: home,
        FDE_DSH_HOME: home,
        GROK2API_API_KEY: 'static-intercept',
        FDE_DATABASE_PATH: join(home, 'fde.sqlite'),
        FDE_AI_WORKSPACE: workspace,
        FDE_RUNTIME_PORT: String(port),
        FDE_LISTEN_HOST: '127.0.0.1',
        FDE_VENDOR_DIR: join(home, 'missing-vendor'),
        DSH_PERMISSION_MODE: 'danger-full-access',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { logs.out += redactText(chunk) })
    child.stderr.on('data', (chunk) => { logs.out += redactText(chunk) })
    await waitFor(() => logs.out.includes('FDE_LISTENING'), 90000, 'FDE_LISTENING')
    const listened = logs.out.match(/FDE_LISTENING\s+(\d+)/)
    const origin = `http://127.0.0.1:${listened ? listened[1] : port}`
    const connected = await fetch(new URL('/api/v1/ai/connect', origin), {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(180000),
    })
    const connectText = await connected.text()
    assert.equal(connected.ok, true, redactText(connectText).slice(0, 400))
    const mcpNote = await waitUntilMcpReady(origin, applied)
    const createdResponse = await fetch(new URL('/api/v1/ai/sessions', origin), {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ cwd: workspace, agentPreset: 'standard' }),
      signal: AbortSignal.timeout(60000),
    })
    const createdText = await createdResponse.text()
    assert.equal(createdResponse.status, 201, redactText(createdText).slice(0, 400))
    const sessionId = JSON.parse(createdText).data.sessionId
    const prompted = await fetch(new URL(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, origin), {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ text: PROMPT }),
      signal: AbortSignal.timeout(60000),
    })
    const promptText = await prompted.text()
    assert.equal(prompted.ok, true, redactText(promptText).slice(0, 400))
    const raw = await waitFor(() => model.bodies.find((body) => body.includes('杭州三天')) || '', 90000, 'model request')
    const tools = JSON.parse(raw).tools
    const toolTokens = await countTokens(JSON.stringify(tools))
    const profile = await readFile(join(home, 'profiles', 'fde-x', 'cordis.patch.yml'), 'utf8')
    return {
      applied,
      toolCount: Array.isArray(tools) ? tools.length : 0,
      toolTokens,
      mcpNote,
      log: logs.out,
      profileHasPlanted: profile.includes(PLANTED),
    }
  } finally {
    model.close()
    await stopChild(child)
    await rm(home, { recursive: true, force: true })
    await rm(workspace, { recursive: true, force: true })
  }
}

test('a user MCP patch raises B tool count and tokens, and the closed switch stays near 45', { timeout: 300000 }, async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'iui-perf-patch-src-'))
  try {
    const script = join(scratch, 'fake-mcp.mjs')
    await writeFile(script, fakeServerSource())
    const blocks = SERVERS.map(([name, count, chars]) => buildMcpPatchBlock({
      serverName: name,
      transport: 'stdio',
      command: process.execPath,
      args: [script, name, String(count), String(chars)],
      ...(name === 'github' ? { env: { MCP_TOKEN: PLANTED } } : {}),
    }))
    const patchFile = join(scratch, 'cordis.patch.yml')
    await writeFile(patchFile, blocks.join(''), { mode: 0o600 })
    const patchText = await readFile(patchFile, 'utf8')
    assert.equal(patchText.includes(PLANTED), true)
    assert.equal(redactText(patchText).includes(PLANTED), false)
    const off = await captureArm({ port: 4651, patchFile: '' })
    const on = await captureArm({ port: 4652, patchFile })
    assert.equal(off.log.includes(PLANTED), false)
    assert.equal(on.log.includes(PLANTED), false)
    const detail = `off tools=${off.toolCount} tokens=${off.toolTokens} applied=${off.applied}; on tools=${on.toolCount} tokens=${on.toolTokens} applied=${on.applied} mcp=${on.mcpNote} profileSecret=${on.profileHasPlanted}`
    assert.equal(off.toolCount >= 30 && off.toolCount <= 70, true, detail)
    assert.equal(on.toolCount >= off.toolCount + 40, true, detail)
    assert.equal(on.toolTokens >= off.toolTokens + 6000, true, detail)
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
})

function runsFixture() {
  const runs = []
  for (const effort of ['low', 'high']) {
    for (const group of ['A', 'B']) {
      for (let index = 1; index <= 3; index += 1) {
        const first = 100 * index + (effort === 'high' ? 50 : 0)
        runs.push({
          group: `${group}-${effort}`,
          effort,
          index,
          metas: [
            { id: 's1', firstByteMs: first, totalMs: first + 200, usage: { input: 1000, output: 40, cacheRead: 700 } },
            { id: 's2', firstByteMs: first + 10, totalMs: first + 80, usage: { input: 1000, output: 10, cacheRead: 900 } },
          ],
          body: group === 'B'
            ? { instructions: '<available_skills>\n<skill>demo</skill>\n</available_skills>' }
            : { instructions: 'plain' },
        })
      }
    }
  }
  runs.push({
    group: 'B-default',
    effort: '(default)',
    index: 1,
    metas: [{ id: 's1', firstByteMs: 80, totalMs: 180, usage: { input: 500, output: 5, cacheRead: 100 } }],
    body: { instructions: 'No skills are currently available' },
  })
  return runs
}

test('the measurement report splits low and high, and bills uncached input separately from cache', async () => {
  const summarize = await import('./lib/summarize.mjs')
  const report = typeof summarize.measurementReport === 'function'
    ? await summarize.measurementReport(runsFixture())
    : { markdown: '', groups: {} }
  const low = report.groups['A-low']
  const high = report.groups['A-high']
  const bLow = report.groups['B-low']
  const fallback = report.groups['B-default']
  assert.equal(low && low.firstToken && low.firstToken.median, 200)
  assert.equal(low.firstToken.range, 200)
  assert.equal(low.gen.median, 200)
  assert.equal(low.billing.uncached.median, 400)
  assert.equal(low.billing.cached.median, 1600)
  assert.equal(low.billing.output.median, 50)
  assert.equal(high.firstToken.median, 250)
  assert.equal(bLow.skillCatalog.hasAvailableSkills, true)
  assert.equal(bLow.skillCatalog.hasEmptyNotice, false)
  assert.equal(fallback.skillCatalog.hasEmptyNotice, true)
  const markdown = String(report.markdown || '')
  const lowAt = markdown.indexOf('## effort=low')
  const highAt = markdown.indexOf('## effort=high')
  const defaultAt = markdown.indexOf('## B-default')
  assert.equal(lowAt >= 0 && highAt > lowAt && defaultAt > highAt, true, markdown)
  const lowSection = markdown.slice(lowAt, highAt)
  const highSection = markdown.slice(highAt, defaultAt)
  assert.match(lowSection, /首 token 中位 200/)
  assert.match(lowSection, /波动 200/)
  assert.match(lowSection, /生成耗时中位 200/)
  assert.match(lowSection, /未缓存 400/)
  assert.match(lowSection, /缓存 1600/)
  assert.match(lowSection, /输出 50/)
  assert.match(lowSection, /技能目录：有/)
  assert.match(highSection, /首 token 中位 250/)
  assert.match(markdown.slice(defaultAt), /技能目录：空通知/)
})

function countArms(plan, id) {
  return plan.filter((arm) => arm && arm.id === id).length
}

test('cold starts cover effort low and high, three times per arm', async () => {
  const moduleUrl = new URL('./lib/arms.mjs', import.meta.url)
  const mod = existsSync(fileURLToPath(moduleUrl)) ? await import(moduleUrl.href) : null
  const plan = mod && typeof mod.planArms === 'function' ? mod.planArms({ env: {}, staticMode: false }) : []
  assert.equal(countArms(plan, 'A-low'), 3)
  assert.equal(countArms(plan, 'B-low'), 3)
  assert.equal(countArms(plan, 'A-high'), 3)
  assert.equal(countArms(plan, 'B-high'), 3)
  assert.equal(countArms(plan, 'B-default'), 3)
  assert.equal(plan.length, 15)
  const once = mod && typeof mod.planArms === 'function' ? mod.planArms({ env: {}, staticMode: true }) : []
  assert.equal(countArms(once, 'A-low'), 1)
  assert.equal(countArms(once, 'A-high'), 1)
  assert.equal(once.length, 5)
  const lowOnly = mod && typeof mod.planArms === 'function'
    ? mod.planArms({ env: { IUI_PERF_EFFORTS: 'low' }, staticMode: false })
    : []
  assert.equal(countArms(lowOnly, 'A-high'), 0)
  assert.equal(countArms(lowOnly, 'A-low'), 3)
  assert.equal(countArms(lowOnly, 'B-default'), 3)
})
