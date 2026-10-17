import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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
const enabled = process.env.FDE_BRIEFING_PAGE === '1'

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

function plantStuckRunning(dbPath, workspaceCwd) {
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA busy_timeout = 5000')
  const workspaces = db.prepare('SELECT id, metadata_json FROM workspaces').all()
  const workspace = workspaces.find((row) => {
    const meta = JSON.parse(row.metadata_json || '{}')
    const path = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
    return path === workspaceCwd
  })
  if (!workspace) throw new Error(`workspace missing for ${workspaceCwd}`)
  const definition = db.prepare('SELECT id FROM briefing_definitions WHERE workspace_id = ?').get(workspace.id)
  if (!definition) throw new Error(`definition missing for ${workspace.id}`)
  const id = `brf_stuck_${Date.now()}`
  const now = new Date().toISOString()
  const content = JSON.stringify({
    status: 'running',
    sections: [],
    workspaceCwd,
    agentRequestId: '',
  })
  db.prepare(`
    INSERT INTO briefings
      (id, definition_id, state, content_json, artifact_ref, generated_at, created_at, workspace_cwd, agent_request_id)
    VALUES (?, ?, 'generating', ?, NULL, ?, ?, ?, NULL)
  `).run(id, definition.id, content, now, now, workspaceCwd)
  db.close()
  return id
}

test('briefing page fills both mcp columns from the host', { skip: !enabled, timeout: 300_000 }, async () => {
  const evidence = process.env.FDE_BRIEFING_EVIDENCE || join(tmpdir(), 'briefing-direct-page')
  await mkdir(evidence, { recursive: true })
  const home = await mkdtemp(join(tmpdir(), 'fde-briefing-page-'))
  const workspace = await mkdtemp(join(tmpdir(), 'fde-briefing-ws-'))
  const dbPath = join(home, 'bff.sqlite')
  const fake = join(repoRoot, 'scripts', 'repro', 'fake-mcp-stdio.mjs')
  const patchDir = join(home, 'profiles', 'fde-x')
  await mkdir(patchDir, { recursive: true })
  await writeFile(join(home, '.credentials.yaml'), 'version: 1\nrefs: {}\n', { mode: 0o600 })
  let patch = upsertMcpPatchEntry('', {
    serverName: 'mail',
    transport: 'stdio',
    command: process.execPath,
    args: [fake, 'mail'],
  })
  patch = upsertMcpPatchEntry(patch, {
    serverName: 'ai-hot',
    transport: 'stdio',
    command: process.execPath,
    args: [fake, 'ai-hot'],
  })
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
    const connect = await fetch(`${bff}/api/v1/ai/connect`, {
      method: 'POST',
      headers: { Origin: origin, 'content-type': 'application/json' },
      body: '{}',
    })
    const connectBody = await connect.json()
    assert.equal(connect.ok && connectBody.data && connectBody.data.connected, true, JSON.stringify(connectBody))
    const headers = { Origin: origin, 'content-type': 'application/json' }
    const ws = await fetch(`${bff}/api/v1/ai/workspaces`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ path: workspace, title: 'briefing-ws' }),
    })
    assert.equal(ws.ok, true, await ws.text())
    const folder = await fetch(`${bff}/api/v1/workspaces`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'briefing-ws', metadata: { cwd: workspace } }),
    })
    assert.equal(folder.status, 201, await folder.text())
    const session = await fetch(`${bff}/api/v1/ai/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cwd: workspace }),
    })
    assert.equal(session.status, 201, await session.text())
    const listedBefore = await fetch(`${bff}/api/v1/ai/sessions?includeBlank=true`)
    const before = await listedBefore.json()
    const primary = (before.data?.items || []).find((row) => row.cwd === workspace && row.origin !== 'subagent')
    assert.ok(primary, JSON.stringify(before.data?.items || []))
    const definition = await fetch(`${bff}/api/v1/briefing/definition`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        workspaceCwd: workspace,
        schedule: { at: '08:30', days: [1, 2, 3, 4, 5], onOpen: false, tz: 'Asia/Shanghai' },
        sections: [
          {
            id: 'mail',
            type: 'mcp',
            title: '重要邮件',
            enabled: true,
            render: 'list',
            params: { server: 'mail', tool: 'mcp__mail__imap_search', args: {} },
          },
          {
            id: 'news',
            type: 'mcp',
            title: '行业资讯',
            enabled: true,
            render: 'list',
            params: { server: 'ai-hot', tool: 'mcp__ai-hot__missing', args: {} },
          },
        ],
      }),
    })
    assert.equal(definition.ok, true, await definition.text())
    const toolsAt = Date.now() + 90_000
    let tools = ''
    while (Date.now() < toolsAt) {
      const res = await fetch(`${bff}/api/v1/mcp/servers`)
      tools = await res.text()
      const rows = JSON.parse(tools).data?.mcp || []
      if (rows.some((row) => row.serverName === 'mail' && row.status === 'loaded')
        && rows.some((row) => row.serverName === 'ai-hot' && row.status === 'loaded')) break
      await delay(1000)
    }
    const ready = JSON.parse(tools).data?.mcp || []
    assert.equal(ready.find((row) => row.serverName === 'mail')?.status, 'loaded', tools)
    assert.equal(ready.find((row) => row.serverName === 'ai-hot')?.status, 'loaded', tools)
    const stuckId = plantStuckRunning(dbPath, workspace)
    const { chromium } = await import('@playwright/test')
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`${web}/briefing`, { waitUntil: 'domcontentloaded' })
    const generate = page.getByRole('button', { name: '生成新早报' })
    await generate.waitFor({ timeout: 30_000 })
    const runWait = page.waitForResponse((res) => (
      res.url().includes('/api/v1/briefing/run') && res.request().method() === 'POST'
    ))
    await generate.click()
    const runRes = await runWait
    const runJson = await runRes.json()
    await writeFile(join(evidence, 'run.json'), JSON.stringify(runJson, null, 2))
    const sections = runJson.data?.briefing?.sections || []
    const mail = sections.find((section) => section.id === 'mail')
    const news = sections.find((section) => section.id === 'news')
    assert.notEqual(runJson.data?.briefingId, stuckId)
    assert.match(JSON.stringify(mail?.items || []), /fake-mail-item/)
    assert.match(String(news?.error || ''), /tool_not_registered/)
    await page.getByText('fake-mail-item').waitFor({ timeout: 30_000 })
    await page.getByText('tool_not_registered').waitFor({ timeout: 20_000 })
    const body = await page.locator('body').innerText()
    assert.equal(body.includes('会话未投影'), false)
    assert.match(body, /重要邮件/)
    assert.match(body, /行业资讯/)
    assert.match(body, /失败：/)
    const mailCount = await page.locator('h2', { hasText: '重要邮件' }).locator('xpath=following-sibling::span').innerText()
    assert.ok(Number(mailCount) > 0, mailCount)
    const listed = await fetch(`${bff}/api/v1/ai/sessions?includeBlank=true`)
    const sessions = await listed.json()
    const briefing = (sessions.data?.items || []).find((row) => row.agentPreset === 'fde-briefing')
    assert.ok(briefing, JSON.stringify(sessions.data?.items || []))
    assert.equal(briefing.cwd, workspace)
  } catch (error) {
    await writeFile(join(evidence, 'dev.log'), Buffer.concat(logs))
    if (page) {
      const body = await page.locator('body').innerText().catch(() => '')
      await writeFile(join(evidence, 'page.txt'), body)
      await page.screenshot({ path: join(evidence, 'page.png'), fullPage: true }).catch(() => undefined)
    }
    throw error
  } finally {
    if (page) {
      const body = await page.locator('body').innerText().catch(() => '')
      if (body) await writeFile(join(evidence, 'page.txt'), body).catch(() => undefined)
      await page.screenshot({ path: join(evidence, 'page.png'), fullPage: true }).catch(() => undefined)
    }
    await writeFile(join(evidence, 'dev.log'), Buffer.concat(logs)).catch(() => undefined)
    if (browser) await browser.close().catch(() => undefined)
    if (child.pid) {
      try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
    }
    await delay(500)
    await rm(home, { recursive: true, force: true }).catch(() => undefined)
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined)
    if (presetBackup) await writeFile(presetPath, presetBackup).catch(() => undefined)
  }
})
