import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const node = process.execPath
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const origin = 'http://127.0.0.1:5173'
const port = 47211
const base = `http://127.0.0.1:${port}`
const register = join(repoRoot, 'runtime/tests/support/briefing-crash-register.mjs')

test('onOpen full-run rejection keeps the core up and records the failure', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'fde-brief-crash-'))
  const ws = await mkdtemp(join(tmpdir(), 'fde-brief-crash-ws-'))
  const dbPath = join(home, 'core.sqlite')
  const dshHome = join(home, 'dsh')
  const child = spawn(node, ['--import', register, 'runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_BRIEFING_CRASH_PROBE: '1',
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_AI_WORKSPACE: ws,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (buf) => { log += buf })
  child.stderr.on('data', (buf) => { log += buf })
  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM')
    await delay(150)
    await rm(home, { recursive: true, force: true })
    await rm(ws, { recursive: true, force: true })
  })

  for (let i = 0; i < 80; i += 1) {
    if (child.exitCode !== null) break
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) break
    } catch { /* retry */ }
    await delay(50)
  }
  assert.equal(child.exitCode, null, `core exited before listen ${child.exitCode}\n${log.slice(-1500)}`)

  const created = await fetch(`${base}/api/v1/ai/workspaces`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: ws, title: 'probe' }),
  })
  const createdBody = await created.json()
  assert.equal(created.status, 200, JSON.stringify(createdBody))
  const cwd = createdBody.data.path
  assert.equal(typeof cwd, 'string')
  assert.ok(cwd.startsWith('/'))

  const registered = await fetch(`${base}/api/v1/workspaces`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'ws_brief_crash',
      name: 'probe',
      description: 't',
      metadata: { cwd },
    }),
  })
  assert.equal(registered.status, 201)

  const opened = await fetch(`${base}/api/v1/briefing/latest?onOpen=1&cwd=${encodeURIComponent(cwd)}`, {
    headers: { Origin: origin },
  })
  assert.equal(opened.status, 200)

  let aiError = ''
  let followStatus = 0
  const deadline = Date.now() + 2500
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const res = await fetch(`${base}/api/v1/briefing/latest?cwd=${encodeURIComponent(cwd)}`, {
        headers: { Origin: origin },
      })
      followStatus = res.status
      const body = await res.json()
      const ai = (body.data?.briefing?.sections || []).find((section) => section.type === 'ai')
      aiError = typeof ai?.error === 'string' ? ai.error : ''
      if (res.ok && aiError.includes('briefing generation failed')) break
    } catch { /* process already gone */ }
    await delay(40)
  }

  assert.equal(child.exitCode, null, `core exited ${child.exitCode}\n${log.slice(-1500)}`)
  const health = await fetch(`${base}/health`)
  assert.equal(health.status, 200)
  assert.equal(followStatus, 200)
  assert.match(aiError, /briefing generation failed/)
})
