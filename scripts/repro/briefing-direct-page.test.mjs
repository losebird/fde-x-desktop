import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
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
            params: { server: 'ai-hot', tool: 'mcp__ai-hot__aihot_get_latest', args: {} },
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
    const { chromium } = await import('@playwright/test')
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`${web}/briefing`, { waitUntil: 'domcontentloaded' })
    const generate = page.getByRole('button', { name: '生成新早报' })
    await generate.waitFor({ timeout: 30_000 })
    await generate.click()
    const projected = page.getByText('会话未投影').first()
    const mailed = page.getByText('fake-mail-item')
    const winner = await Promise.race([
      mailed.waitFor({ timeout: 90_000 }).then(() => 'mail'),
      projected.waitFor({ timeout: 90_000 }).then(() => 'projected'),
    ])
    if (winner === 'projected') {
      throw new Error(`page shows 会话未投影\n${await page.locator('body').innerText()}`)
    }
    await page.getByText('fake-news-item').waitFor({ timeout: 20_000 })
    const body = await page.locator('body').innerText()
    assert.equal(body.includes('会话未投影'), false)
    const mailCount = await page.locator('h2', { hasText: '重要邮件' }).locator('xpath=following-sibling::span').innerText()
    const newsCount = await page.locator('h2', { hasText: '行业资讯' }).locator('xpath=following-sibling::span').innerText()
    assert.ok(Number(mailCount) > 0, mailCount)
    assert.ok(Number(newsCount) > 0, newsCount)
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
