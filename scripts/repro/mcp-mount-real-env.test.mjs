import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { upsertMcpPatchEntry } from '../../runtime/mcp-archive.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const bff = 'http://127.0.0.1:4318'
const web = 'http://127.0.0.1:5174'
const origin = web
const sinkPort = 8791
const enabled = process.env.FDE_MCP_MOUNT_PAGE === '1'

function toolNames(body) {
  const tools = Array.isArray(body?.tools) ? body.tools : []
  return tools.map((tool) => String(tool?.function?.name || tool?.name || '')).filter(Boolean)
}

function excerpt(body) {
  const names = toolNames(body)
  return {
    model: body?.model || '',
    toolCount: names.length,
    tools: names,
  }
}

function hasServer(names, server) {
  return names.some((name) => name === `mcp__${server}` || name.startsWith(`mcp__${server}__`))
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = ''
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
      last = `${res.status}`
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    await delay(300)
  }
  throw new Error(`timed out waiting for ${url}: ${last}`)
}

function startSink(bodies) {
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    let json = null
    if (raw) {
      try { json = JSON.parse(raw) } catch { json = null }
    }
    if (json && (Array.isArray(json.tools) || Array.isArray(json.messages))) bodies.push(json)
    if (request.method === 'GET') {
      const payload = JSON.stringify({ object: 'list', data: [{ id: 'sink-model', object: 'model' }] })
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(payload)
      return
    }
    if (json && json.stream === false) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        id: 'sink',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      }))
      return
    }
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    const chunk = (delta, finish) => JSON.stringify({
      id: 'sink',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta, finish_reason: finish || null }],
    })
    response.write(`data: ${chunk({ role: 'assistant', content: 'ok' })}\n\n`)
    response.write(`data: ${chunk({}, 'stop')}\n\n`)
    response.write('data: [DONE]\n\n')
    response.end()
  })
  return new Promise((resolve) => {
    server.listen(sinkPort, '127.0.0.1', () => resolve(server))
  })
}

function messageText(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : []
  return messages.map((message) => {
    if (typeof message?.content === 'string') return message.content
    if (!Array.isArray(message?.content)) return ''
    return message.content.map((part) => (part && typeof part.text === 'string' ? part.text : '')).join('\n')
  }).join('\n')
}

async function waitPrompt(bodies, text, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = bodies.find((body) => toolNames(body).length > 0 && messageText(body).includes(text))
    if (found) return found
    await delay(200)
  }
  const seen = bodies.map((body) => `${toolNames(body).length}:${messageText(body).slice(0, 80)}`)
  throw new Error(`timed out waiting for model request ${text}, have ${seen.join(' | ')}`)
}

test('standard trim, settings save, and briefing omit user MCP on the live model request', { skip: !enabled, timeout: 300_000 }, async () => {
  const evidence = process.env.FDE_MCP_MOUNT_EVIDENCE || '/opt/cursor/artifacts/fix-impl/PR-3/real-env'
  await mkdir(evidence, { recursive: true })
  const bodies = []
  const sink = await startSink(bodies)
  const home = await mkdtemp(join(tmpdir(), 'fde-mcp-mount-'))
  const workspace = await mkdtemp(join(tmpdir(), 'fde-mcp-mount-ws-'))
  const dbPath = join(home, 'bff.sqlite')
  const fake = join(repoRoot, 'scripts', 'repro', 'fake-mcp-stdio.mjs')
  const patchDir = join(home, 'profiles', 'fde-x')
  await mkdir(patchDir, { recursive: true })
  await writeFile(join(home, '.credentials.yaml'), 'version: 1\nrefs: {}\n', { mode: 0o600 })
  let patch = ''
  for (const name of ['mail', 'cua-driver', 'chrome-devtools', 'playwright']) {
    patch = upsertMcpPatchEntry(patch, {
      serverName: name,
      transport: 'stdio',
      command: process.execPath,
      args: [fake, name],
    })
  }
  await writeFile(join(patchDir, 'cordis.patch.yml'), patch)
  const logs = []
  const presetPath = join(repoRoot, 'runtime/presets/fde-briefing/agent.cordis.yml')
  const workerPkg = join(repoRoot, 'runtime/.host-generation/node_modules/@deepseek-ai/dsh-workflow-worker-thread/package.json')
  let presetBackup = ''
  if (!existsSync(workerPkg)) {
    presetBackup = await readFile(presetPath, 'utf8')
    const rows = [
      ['workflow-worker-thread', '@deepseek-ai/dsh-workflow-worker-thread'],
      ['tool-workflow', '@deepseek-ai/dsh-tool-workflow'],
      ['tool-ralph', '@deepseek-ai/dsh-tool-ralph'],
    ]
    let next = presetBackup
    for (const [id, name] of rows) {
      const needle = `    - id: ${id}\n      name: '${name}'\n`
      if (!next.includes(needle)) throw new Error(`missing ${id} row in fde-briefing preset`)
      next = next.replace(needle, `${needle}      disabled: true\n`)
    }
    await writeFile(presetPath, next)
  }
  const child = spawn(process.execPath, ['scripts/dev.mjs'], {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      FDE_DSH_HOME: home,
      FDE_DATABASE_PATH: dbPath,
      FDE_AI_WORKSPACE: workspace,
      FDE_RUNTIME_PORT: '4318',
      FDE_WEB_PORT: '5174',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => logs.push(chunk))
  child.stderr.on('data', (chunk) => logs.push(chunk))
  let browser
  let page
  try {
    await waitFor(`${bff}/health`, 30_000)
    await waitFor(web, 30_000)
    const headers = { Origin: origin, 'content-type': 'application/json' }
    const connect = await fetch(`${bff}/api/v1/ai/connect`, { method: 'POST', headers, body: '{}' })
    const connectBody = await connect.json()
    assert.equal(connect.ok && connectBody.data && connectBody.data.connected, true, JSON.stringify(connectBody))
    const provider = await fetch(`${bff}/api/v1/ai/providers/custom`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        route: 'sink',
        displayName: 'sink',
        api: 'openai-completions',
        baseURL: `http://127.0.0.1:${sinkPort}/v1`,
        apiKey: 'sink-key',
        modelId: 'sink-model',
        modelName: 'sink-model',
      }),
    })
    const providerBody = await provider.json()
    assert.equal(provider.ok && providerBody.data && providerBody.data.live, true, JSON.stringify(providerBody))
    const model = await fetch(`${bff}/api/v1/ai/models-settings/mutate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ns: 'agent-default-model',
        ops: [
          { op: 'set', path: ['provider'], value: 'sink' },
          { op: 'set', path: ['model'], value: 'sink-model' },
        ],
      }),
    })
    assert.equal(model.ok, true, await model.text())
    const ws = await fetch(`${bff}/api/v1/ai/workspaces`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path: workspace, title: 'mount-ws' }),
    })
    assert.equal(ws.ok, true, await ws.text())
    const folder = await fetch(`${bff}/api/v1/workspaces`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'mount-ws', metadata: { cwd: workspace } }),
    })
    assert.equal(folder.status, 201, await folder.text())
    const toolsAt = Date.now() + 90_000
    let tools = ''
    while (Date.now() < toolsAt) {
      const res = await fetch(`${bff}/api/v1/mcp/servers`)
      tools = await res.text()
      const rows = JSON.parse(tools).data?.mcp || []
      const loaded = ['mail', 'cua-driver', 'chrome-devtools', 'playwright'].every((name) => (
        rows.some((row) => row.serverName === name && row.status === 'loaded')
      ))
      if (loaded) break
      await delay(1000)
    }
    const ready = JSON.parse(tools).data?.mcp || []
    for (const name of ['mail', 'cua-driver', 'chrome-devtools', 'playwright']) {
      assert.equal(ready.find((row) => row.serverName === name)?.status, 'loaded', tools)
    }
    const session = await fetch(`${bff}/api/v1/ai/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cwd: workspace, agentPreset: 'standard' }),
    })
    const sessionBody = await session.json()
    assert.equal(session.status, 201, JSON.stringify(sessionBody))
    const sessionId = sessionBody.data?.sessionId
    assert.ok(sessionId, JSON.stringify(sessionBody))
    const firstPrompt = await fetch(`${bff}/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'mount-check-standard' }),
    })
    assert.equal(firstPrompt.ok, true, await firstPrompt.text())
    const first = await waitPrompt(bodies, 'mount-check-standard', 25_000)
    const firstNames = toolNames(first)
    await writeFile(join(evidence, 'first-standard.json'), JSON.stringify(excerpt(first), null, 2))
    assert.equal(hasServer(firstNames, 'mail'), true, firstNames.join('\n'))
    assert.equal(hasServer(firstNames, 'cua-driver'), false, firstNames.join('\n'))
    assert.equal(hasServer(firstNames, 'chrome-devtools'), false, firstNames.join('\n'))
    assert.equal(hasServer(firstNames, 'playwright'), false, firstNames.join('\n'))

    const { chromium } = await import('@playwright/test')
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`${web}/settings`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'AI 核心' }).click()
    await page.getByText('Host 配置').waitFor({ timeout: 30_000 })
    const header = page.getByRole('button', { name: /fde-x-dsh-bridge/ })
    await header.waitFor({ timeout: 30_000 })
    await header.click()
    const form = page.locator('div.rounded-lg.border').filter({ hasText: 'standardDenyServers' })
    await form.waitFor({ timeout: 15_000 })
    await form.screenshot({ path: join(evidence, 'settings-before.png') })
    const requests = []
    page.on('request', (request) => {
      requests.push(`${request.method()} ${request.url()}`)
    })
    const chip = form.locator('span', { hasText: 'cua-driver' }).first()
    await chip.getByRole('button', { name: '删除' }).click()
    const saveWait = page.waitForResponse((res) => (
      res.url().includes('/api/v1/catalog') && res.request().method() === 'POST'
    ), { timeout: 15_000 })
    await form.getByRole('button', { name: '保存', exact: true }).click({ timeout: 8_000 })
    const saved = await saveWait
    await writeFile(join(evidence, 'settings-requests.txt'), requests.join('\n'))
    assert.equal(saved.ok(), true, await saved.text())
    await form.screenshot({ path: join(evidence, 'settings-after.png') })

    const secondPrompt = await fetch(`${bff}/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'mount-check-after-save' }),
    })
    assert.equal(secondPrompt.ok, true, await secondPrompt.text())
    const second = await waitPrompt(bodies, 'mount-check-after-save', 60_000)
    const secondNames = toolNames(second)
    await writeFile(join(evidence, 'after-save.json'), JSON.stringify(excerpt(second), null, 2))
    assert.equal(hasServer(secondNames, 'cua-driver'), true, secondNames.join('\n'))
    assert.equal(hasServer(secondNames, 'chrome-devtools'), false, secondNames.join('\n'))
    assert.equal(hasServer(secondNames, 'playwright'), false, secondNames.join('\n'))

    const briefing = await fetch(`${bff}/api/v1/ai/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cwd: workspace, agentPreset: 'fde-briefing' }),
    })
    const briefingBody = await briefing.json()
    assert.equal(briefing.status, 201, JSON.stringify(briefingBody))
    const briefingId = briefingBody.data?.sessionId
    assert.equal(briefingBody.data?.agentPreset, 'fde-briefing', JSON.stringify(briefingBody))
    const briefingPrompt = await fetch(`${bff}/api/v1/ai/sessions/${encodeURIComponent(briefingId)}/prompt`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'mount-check-briefing' }),
    })
    assert.equal(briefingPrompt.ok, true, await briefingPrompt.text())
    const third = await waitPrompt(bodies, 'mount-check-briefing', 60_000)
    const thirdNames = toolNames(third)
    await writeFile(join(evidence, 'briefing.json'), JSON.stringify(excerpt(third), null, 2))
    assert.equal(thirdNames.some((name) => name.startsWith('mcp__')), false, thirdNames.join('\n'))
    await writeFile(join(evidence, 'bodies.json'), JSON.stringify(bodies.map(excerpt), null, 2))
  } catch (error) {
    await writeFile(join(evidence, 'error.txt'), error instanceof Error ? error.stack || error.message : String(error))
    await writeFile(join(evidence, 'dev.log'), Buffer.concat(logs))
    await writeFile(join(evidence, 'bodies.json'), JSON.stringify(bodies.map(excerpt), null, 2))
    const status = await fetch(`${bff}/api/v1/ai/status`).then((res) => res.json()).catch((cause) => String(cause))
    await writeFile(join(evidence, 'status.json'), JSON.stringify(status, null, 2))
    const sessionRoot = status && status.data && status.data.sessionRoot
    if (sessionRoot) {
      await cp(sessionRoot, join(evidence, 'sessions'), { recursive: true }).catch((cause) => writeFile(join(evidence, 'sessions-copy-error.txt'), String(cause)))
    }
    const listed = await fetch(`${bff}/api/v1/ai/sessions?includeBlank=true`).then((res) => res.json()).catch((cause) => String(cause))
    await writeFile(join(evidence, 'sessions.json'), JSON.stringify(listed, null, 2))
    if (page) {
      await page.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => undefined)
      const text = await page.locator('body').innerText().catch(() => '')
      await writeFile(join(evidence, 'failure.txt'), text)
    }
    throw error
  } finally {
    if (browser) await browser.close().catch(() => undefined)
    if (child.pid) {
      try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
    }
    await new Promise((resolve) => sink.close(resolve))
    await delay(500)
    await rm(home, { recursive: true, force: true }).catch(() => undefined)
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined)
    if (presetBackup) await writeFile(presetPath, presetBackup).catch(() => undefined)
  }
})
