import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import { isPidAlive, pidsChildrenOf, pidsListeningOnPort } from '../reclaim-runtime.mjs'
import { ensureOwnedRuntime } from '../../scripts/dev-runtime.mjs'
import { runtimePortOpen } from '../../scripts/runtime-port.mjs'

const node = process.execPath
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const origin = 'http://127.0.0.1:5174'
const stamp = `${process.pid}-${Date.now()}`
const root = `/tmp/fde-s1-dev-reuse-${stamp}`
const dbPath = join(root, 'fde.sqlite')
const dshHome = join(root, 'dsh-home')
const workspaceCwd = join(root, 'workspace')

function announce(child) {
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  return {
    async ready() {
      for (let i = 0; i < 100; i += 1) {
        const tokenMatch = /^FDE_UI_TOKEN\s+([0-9a-f]{64})$/m.exec(stdout)
        const portMatch = /^FDE_LISTENING\s+(\d+)/m.exec(stdout)
        if (portMatch && tokenMatch) {
          const port = Number(portMatch[1])
          const base = `http://127.0.0.1:${port}`
          const res = await fetch(`${base}/health`).catch(() => null)
          if (res?.ok) return { port, token: tokenMatch[1], base }
        }
        if (child.exitCode != null) break
        await delay(100)
      }
      throw new Error(`owned BFF failed to start\n${stderr}\n${stdout}`)
    },
  }
}

async function stop(child) {
  if (!child || child.exitCode != null) return
  child.kill('SIGTERM')
  for (let i = 0; i < 20; i += 1) {
    if (child.exitCode != null) return
    await delay(50)
  }
  child.kill('SIGKILL')
}

describe('dev reuse page token', { concurrency: 1 }, () => {
  test('a reused BFF still accepts a page-token record PATCH', async (t) => {
    await rm(root, { recursive: true, force: true })
    await mkdir(workspaceCwd, { recursive: true })
    await mkdir(dshHome, { recursive: true })
    const occupant = spawn(node, ['runtime/server.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        FDE_RUNTIME_PORT: '0',
        FDE_LISTEN_HOST: '127.0.0.1',
        FDE_DATABASE_PATH: dbPath,
        FDE_DSH_HOME: dshHome,
        FDE_AI_WORKSPACE: workspaceCwd,
        FDE_RUNTIME_SUPERVISED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const occupantAnnounced = announce(occupant)
    const extras = []
    t.after(async () => {
      await stop(occupant)
      for (const child of extras) await stop(child)
      await rm(root, { recursive: true, force: true })
    })
    const listening = await occupantAnnounced.ready()

    const owned = await ensureOwnedRuntime({
      preferredPort: listening.port,
      portOpen: (port) => runtimePortOpen(port, '127.0.0.1', 400),
      listenersOn: (port) => pidsListeningOnPort(port),
      childrenOf: (pid) => pidsChildrenOf(pid),
      spawnOwned: async ({ port, keepPids }) => {
        const child = spawn(node, ['runtime/server.mjs'], {
          cwd: repoRoot,
          env: {
            ...process.env,
            FDE_RUNTIME_PORT: String(port),
            FDE_LISTEN_HOST: '127.0.0.1',
            FDE_DATABASE_PATH: dbPath,
            FDE_DSH_HOME: dshHome,
            FDE_AI_WORKSPACE: workspaceCwd,
            FDE_RUNTIME_SUPERVISED: '1',
            FDE_RECLAIM_KEEP_PIDS: keepPids.join(','),
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        extras.push(child)
        const started = await announce(child).ready()
        return { port: started.port, token: started.token }
      },
    })

    const base = `http://127.0.0.1:${owned.port}`
    const created = await writeJson(base, '/api/v1/apps', { spec: SUPPLIER_VISITS_SPEC, workspaceCwd }, 'POST')
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    const activated = await writeJson(base, `/api/v1/apps/${encodeURIComponent(created.payload.data.appId)}/activate`, {}, 'POST')
    assert.equal(activated.status, 200, JSON.stringify(activated.payload))
    const inserted = await writeJson(base, '/api/v1/apps/supplier-visits/visit', {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
      workspaceCwd,
    }, 'POST')
    assert.equal(inserted.status, 201, JSON.stringify(inserted.payload))
    const rid = inserted.payload.data.id
    clearAudit()

    const patched = await fetch(
      `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
      {
        method: 'PATCH',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'x-fde-ui-token': owned.token,
        },
        body: JSON.stringify({ status: '已拜访' }),
      },
    )
    const patchedBody = await patched.json().catch(() => ({}))
    assert.equal(patched.status, 200, JSON.stringify(patchedBody))
    assert.equal(isPidAlive(occupant.pid), true)
    const oldHealth = await fetch(`${listening.base}/health`)
    assert.equal(oldHealth.status, 200)
    assert.notEqual(owned.port, listening.port)
    assert.equal(auditCount(), 1)
    const page = await fetch(`${base}/`)
    const pageText = await page.text()
    assert.equal(pageText.includes(owned.token), false)
    const ai = await fetch(`${base}/ai`)
    const aiText = await ai.text()
    assert.equal(aiText.includes(owned.token), false)
  })

  test('an unsupervised BFF does not print the page token', async (t) => {
    await rm(root, { recursive: true, force: true })
    await mkdir(workspaceCwd, { recursive: true })
    await mkdir(dshHome, { recursive: true })
    const child = spawn(node, ['runtime/server.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        FDE_RUNTIME_PORT: '0',
        FDE_LISTEN_HOST: '127.0.0.1',
        FDE_DATABASE_PATH: dbPath,
        FDE_DSH_HOME: dshHome,
        FDE_AI_WORKSPACE: workspaceCwd,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    t.after(async () => {
      await stop(child)
      await rm(root, { recursive: true, force: true })
    })
    let base = ''
    for (let i = 0; i < 100; i += 1) {
      const portMatch = /^FDE_LISTENING\s+(\d+)/m.exec(stdout)
      if (portMatch) {
        base = `http://127.0.0.1:${portMatch[1]}`
        const res = await fetch(`${base}/health`).catch(() => null)
        if (res?.ok) break
      }
      if (child.exitCode != null) break
      await delay(100)
    }
    assert.match(stdout, /^FDE_LISTENING\s+\d+/m)
    assert.equal(/^FDE_UI_TOKEN\s+/m.test(stdout), false, stdout)
    const created = await writeJson(base, '/api/v1/apps', { spec: SUPPLIER_VISITS_SPEC, workspaceCwd }, 'POST')
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    const activated = await writeJson(base, `/api/v1/apps/${encodeURIComponent(created.payload.data.appId)}/activate`, {}, 'POST')
    assert.equal(activated.status, 200, JSON.stringify(activated.payload))
    const inserted = await writeJson(base, '/api/v1/apps/supplier-visits/visit', {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
      workspaceCwd,
    }, 'POST')
    assert.equal(inserted.status, 201, JSON.stringify(inserted.payload))
    const patched = await fetch(
      `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(inserted.payload.data.id)}?workspace=${encodeURIComponent(workspaceCwd)}`,
      {
        method: 'PATCH',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '已拜访' }),
      },
    )
    assert.equal(patched.status, 401)
  })
})

async function writeJson(base, path, body, method) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  return { status: res.status, payload }
}

function clearAudit() {
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA busy_timeout = 5000;')
  db.exec('DELETE FROM audit_entries;')
  db.close()
}

function auditCount() {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const row = db.prepare('SELECT COUNT(*) AS n FROM audit_entries').get()
    return Number(row.n)
  } finally {
    db.close()
  }
}
