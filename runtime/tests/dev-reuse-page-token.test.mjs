import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { DatabaseSync } from 'node:sqlite'
import { mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'

const node = process.execPath
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const origin = 'http://127.0.0.1:5174'
const stamp = `${process.pid}-${Date.now()}`
const root = `/tmp/fde-s1-dev-reuse-${stamp}`
const dbPath = join(root, 'fde.sqlite')
const dshHome = join(root, 'dsh-home')
const workspaceCwd = join(root, 'workspace')

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

async function serverPids(databasePath) {
  const pids = []
  const names = await readdir('/proc')
  for (const name of names) {
    if (!/^\d+$/u.test(name)) continue
    const pid = Number(name)
    let environ
    let cmdline
    try {
      environ = await readFile(`/proc/${pid}/environ`)
      cmdline = await readFile(`/proc/${pid}/cmdline`)
    } catch (error) {
      if (error && (error.code === 'ENOENT' || error.code === 'EACCES')) continue
      throw error
    }
    if (!environ.includes(Buffer.from(`FDE_DATABASE_PATH=${databasePath}`))) continue
    if (!cmdline.includes('runtime/server.mjs')) continue
    pids.push(pid)
  }
  return pids.sort((left, right) => left - right)
}

function launch(args, options) {
  return spawn(node, args, { detached: true, ...options })
}

function watchOutput(child) {
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  let code = null
  child.on('exit', (exitCode) => { code = exitCode })
  return {
    output: () => output,
    code: () => code,
  }
}

function signalPid(pid, signal) {
  try {
    process.kill(pid, signal)
  } catch (error) {
    if (!error || error.code !== 'ESRCH') throw error
  }
}

async function pidsInGroup(pgid) {
  const pids = []
  const names = await readdir('/proc')
  for (const name of names) {
    if (!/^\d+$/u.test(name)) continue
    let stat
    try {
      stat = await readFile(`/proc/${name}/stat`, 'utf8')
    } catch (error) {
      if (error && (error.code === 'ENOENT' || error.code === 'EACCES')) continue
      throw error
    }
    const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
    if (Number(rest[2]) === pgid) pids.push(Number(name))
  }
  return pids
}

async function stop(child) {
  if (!child?.pid) return
  const group = await pidsInGroup(child.pid)
  for (const pid of [child.pid, ...group]) signalPid(pid, 'SIGKILL')
  for (let i = 0; i < 20; i += 1) {
    if (child.exitCode != null || child.signalCode != null) return
    await delay(50)
  }
  try {
    await readFile(`/proc/${child.pid}/stat`)
  } catch (error) {
    if (error && error.code === 'ENOENT') return
    throw error
  }
  throw new Error(`process ${child.pid} did not exit`)
}

async function stopPids(pids) {
  for (const pid of pids) signalPid(pid, 'SIGKILL')
}

function devEnv(extra) {
  return {
    ...process.env,
    FDE_LISTEN_HOST: '127.0.0.1',
    FDE_DATABASE_PATH: dbPath,
    FDE_DSH_HOME: dshHome,
    FDE_AI_WORKSPACE: workspaceCwd,
    FDE_RUNTIME_SUPERVISED: '1',
    ...extra,
  }
}

describe('dev reuse page token', { concurrency: 1 }, () => {
  test('pnpm dev exits when the preferred port has a BFF and no page token', async (t) => {
    await rm(root, { recursive: true, force: true })
    await mkdir(workspaceCwd, { recursive: true })
    await mkdir(dshHome, { recursive: true })
    const occupant = launch(['runtime/server.mjs'], {
      cwd: repoRoot,
      env: devEnv({ FDE_RUNTIME_PORT: '0' }),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const occupantWatch = watchOutput(occupant)
    let dev = null
    t.after(async () => {
      try {
        await stop(dev)
        await stop(occupant)
      } finally {
        await stopPids(await serverPids(dbPath))
        await rm(root, { recursive: true, force: true })
      }
    })
    let occupantPort = 0
    for (let i = 0; i < 100; i += 1) {
      const match = /^FDE_LISTENING\s+(\d+)/m.exec(occupantWatch.output())
      if (match) {
        occupantPort = Number(match[1])
        const health = await fetch(`http://127.0.0.1:${occupantPort}/health`).catch(() => null)
        if (health?.ok) break
      }
      if (occupant.exitCode != null) break
      await delay(100)
    }
    assert.ok(occupantPort > 0, occupantWatch.output())

    dev = launch([join(repoRoot, 'scripts/dev.mjs')], {
      cwd: repoRoot,
      env: devEnv({
        FDE_RUNTIME_PORT: String(occupantPort),
        FDE_WEB_PORT: String(await freePort()),
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const devWatch = watchOutput(dev)
    let extra = false
    for (let i = 0; i < 40; i += 1) {
      const pids = await serverPids(dbPath)
      extra = pids.some((pid) => pid !== occupant.pid)
      if (extra || devWatch.code() !== null) break
      await delay(100)
    }
    const left = await serverPids(dbPath)
    assert.deepEqual(left, [occupant.pid], `${devWatch.output()}\npids=${left.join(',')}`)
    assert.equal(devWatch.code(), 1, devWatch.output())
    assert.match(devWatch.output(), /不复用，也不另起/)
    assert.match(devWatch.output(), new RegExp(`kill ${occupant.pid}`))
    const health = await fetch(`http://127.0.0.1:${occupantPort}/health`)
    assert.equal(health.status, 200)
  })

  test('an empty port lets dev hand the page token to a record PATCH', async (t) => {
    await rm(root, { recursive: true, force: true })
    await mkdir(workspaceCwd, { recursive: true })
    await mkdir(dshHome, { recursive: true })
    const appRoot = join(root, 'app')
    await mkdir(join(appRoot, 'node_modules/vite/bin'), { recursive: true })
    await symlink(join(repoRoot, 'runtime'), join(appRoot, 'runtime'))
    await writeFile(join(appRoot, 'node_modules/vite/bin/vite.js'), `
      process.on('message', (msg) => {
        if (msg && msg.type === 'fde-ui-token' && typeof msg.token === 'string') {
          process.stdout.write('STUB_UI_TOKEN ' + msg.token + '\\n')
        }
      })
      if (typeof process.send === 'function') process.send({ type: 'fde-vite-listening' })
      setInterval(() => {}, 1 << 30)
    `)
    const runtimePort = await freePort()
    const webPort = await freePort()
    const pageOrigin = `http://127.0.0.1:${webPort}`
    const dev = launch([join(repoRoot, 'scripts/dev.mjs')], {
      cwd: repoRoot,
      env: devEnv({
        FDE_APP_ROOT: appRoot,
        FDE_RUNTIME_PORT: String(runtimePort),
        FDE_WEB_PORT: String(webPort),
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const devWatch = watchOutput(dev)
    t.after(async () => {
      try {
        await stop(dev)
      } finally {
        await stopPids(await serverPids(dbPath))
        await rm(root, { recursive: true, force: true })
      }
    })
    let token = ''
    for (let i = 0; i < 100; i += 1) {
      const match = /^STUB_UI_TOKEN\s+([0-9a-f]{64})$/m.exec(devWatch.output())
      if (match) {
        token = match[1]
        const health = await fetch(`http://127.0.0.1:${runtimePort}/health`).catch(() => null)
        if (health?.ok) break
      }
      if (devWatch.code() !== null) break
      await delay(100)
    }
    assert.match(token, /^[0-9a-f]{64}$/u, devWatch.output())
    const base = `http://127.0.0.1:${runtimePort}`
    const created = await writeJson(base, '/api/v1/apps', { spec: SUPPLIER_VISITS_SPEC, workspaceCwd }, 'POST', pageOrigin, token)
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    const activated = await writeJson(base, `/api/v1/apps/${encodeURIComponent(created.payload.data.appId)}/activate`, {}, 'POST', pageOrigin, token)
    assert.equal(activated.status, 200, JSON.stringify(activated.payload))
    const inserted = await writeJson(base, '/api/v1/apps/supplier-visits/visit', {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
      workspaceCwd,
    }, 'POST', pageOrigin, token)
    assert.equal(inserted.status, 201, JSON.stringify(inserted.payload))
    clearAudit()
    const patched = await fetch(
      `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(inserted.payload.data.id)}?workspace=${encodeURIComponent(workspaceCwd)}`,
      {
        method: 'PATCH',
        headers: {
          Origin: pageOrigin,
          'Content-Type': 'application/json',
          'x-fde-ui-token': token,
        },
        body: JSON.stringify({ status: '已拜访' }),
      },
    )
    const patchedBody = await patched.json().catch(() => ({}))
    assert.equal(patched.status, 200, JSON.stringify(patchedBody))
    assert.equal(auditCount(), 1)
  })

  test('an unsupervised BFF does not print the page token', async (t) => {
    await rm(root, { recursive: true, force: true })
    await mkdir(workspaceCwd, { recursive: true })
    await mkdir(dshHome, { recursive: true })
    const child = launch(['runtime/server.mjs'], {
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
    const watched = watchOutput(child)
    t.after(async () => {
      try {
        await stop(child)
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    })
    let base = ''
    for (let i = 0; i < 100; i += 1) {
      const portMatch = /^FDE_LISTENING\s+(\d+)/m.exec(watched.output())
      if (portMatch) {
        base = `http://127.0.0.1:${portMatch[1]}`
        const res = await fetch(`${base}/health`).catch(() => null)
        if (res?.ok) break
      }
      if (watched.code() !== null) break
      await delay(100)
    }
    assert.match(watched.output(), /^FDE_LISTENING\s+\d+/m)
    assert.equal(/^FDE_UI_TOKEN\s+/m.test(watched.output()), false, watched.output())
    const created = await writeJson(base, '/api/v1/apps', { spec: SUPPLIER_VISITS_SPEC, workspaceCwd }, 'POST')
    assert.equal(created.status, 401, JSON.stringify(created.payload))
  })
})

async function writeJson(base, path, body, method, requestOrigin = origin, token = '') {
  const headers = { Origin: requestOrigin, 'Content-Type': 'application/json' }
  if (token) headers['x-fde-ui-token'] = token
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
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
