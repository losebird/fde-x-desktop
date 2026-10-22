import { awaitChildExit } from './support/no-stray-processes.mjs'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createPageTokenClient } from './support/page-token-fetch.mjs'

const page = createPageTokenClient()

const node = process.execPath
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const origin = 'http://127.0.0.1:5173'
const port = 47231
const base = `http://127.0.0.1:${port}`
const register = join(repoRoot, 'runtime/tests/support/briefing-crash-register.mjs')

test('a throw while recording an open failure keeps the core up and stays visible', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'fde-brief-record-'))
  const ws = await mkdtemp(join(tmpdir(), 'fde-brief-record-ws-'))
  const dbPath = join(home, 'core.sqlite')
  const dshHome = join(home, 'dsh')
  const child = spawn(node, ['--import', register, 'runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_BRIEFING_CRASH_PROBE: '1',
      FDE_BRIEFING_DROP_WORKSPACE: '1',
      FDE_RUNTIME_SUPERVISED: '1',
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_AI_WORKSPACE: ws,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (buf) => {
    page.observe(buf)
    log += buf
  })
  child.stderr.on('data', (buf) => { log += buf })
  t.after(async () => {
    await awaitChildExit(child)
    await rm(home, { recursive: true, force: true })
    await rm(ws, { recursive: true, force: true })
  })

  for (let i = 0; i < 80; i += 1) {
    if (child.exitCode !== null) break
    try {
      const res = await page.fetch(`${base}/health`)
      if (res.ok) break
    } catch {}
    await delay(50)
  }
  assert.equal(child.exitCode, null, `core exited before listen ${child.exitCode}\n${log.slice(-1500)}`)

  const created = await page.fetch(`${base}/api/v1/ai/workspaces`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: ws, title: 'probe' }),
  })
  const createdBody = await created.json()
  assert.equal(created.status, 200, JSON.stringify(createdBody))
  const cwd = createdBody.data.path

  const registered = await page.fetch(`${base}/api/v1/workspaces`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'ws_brief_record',
      name: 'probe',
      description: 't',
      metadata: { cwd },
    }),
  })
  assert.equal(registered.status, 201)

  const opened = await page.fetch(`${base}/api/v1/briefing/latest?onOpen=1&cwd=${encodeURIComponent(cwd)}`, {
    headers: { Origin: origin },
  })
  assert.equal(opened.status, 200)

  const deadline = Date.now() + 2500
  while (Date.now() < deadline && child.exitCode === null && !log.includes('需要已登记的工作区')) {
    await delay(40)
  }

  assert.equal(child.exitCode, null, `core exited ${child.exitCode}\n${log.slice(-2000)}`)
  const health = await page.fetch(`${base}/health`)
  assert.equal(health.status, 200)
  assert.match(log, /需要已登记的工作区/)
})
