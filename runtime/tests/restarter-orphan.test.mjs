import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const parentScript = join(repoRoot, 'runtime/tests/support/restarter-parent.mjs')
const preload = pathToFileURL(join(repoRoot, 'runtime/tests/support/restarter-group-child.mjs')).href

function procStat(pid) {
  try {
    const text = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const rest = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/)
    return {
      state: rest[0],
      ppid: Number(rest[1]),
      pgid: Number(rest[2]),
      sid: Number(rest[3]),
    }
  } catch {
    return null
  }
}

function running(pid) {
  const stat = procStat(pid)
  if (!stat) return false
  if (stat.state === 'Z') return false
  return true
}

function commandOf(pid) {
  try {
    return execFileSync('ps', ['-o', 'pid=,ppid=,pgid=,stat=,args=', '-p', String(pid)], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function childEnv(dir, port) {
  const env = { ...process.env }
  delete env.FDE_DSH_HOME
  delete env.FDE_IUI_ARTIFACT
  delete env.NODE_OPTIONS
  env.HOME = dir
  env.FDE_DATABASE_PATH = join(dir, 'data.sqlite')
  env.FDE_RUNTIME_PORT = String(port)
  env.FDE_LISTEN_HOST = '127.0.0.1'
  env.FDE_RUNTIME_HOST = '127.0.0.1'
  env.FDE_RESTARTER_MARK = dir
  return env
}

async function waitFor(read, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    const value = read()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return null
}

function spawnParent(mode, dir, port, withChild) {
  const metaPath = join(dir, 'meta.json')
  const childPath = join(dir, 'child.pid')
  const errPath = join(dir, 'parent.err')
  const errFd = openSync(errPath, 'a')
  const parent = spawn(process.execPath, [
    parentScript,
    mode,
    metaPath,
    childPath,
    withChild ? preload : '',
  ], {
    cwd: repoRoot,
    env: childEnv(dir, port),
    stdio: ['ignore', 'ignore', errFd],
  })
  closeSync(errFd)
  return {
    parent,
    metaPath,
    childPath,
    errPath,
    logs: () => existsSync(errPath) ? readFileSync(errPath, 'utf8') : '',
  }
}

async function killMarked(dir) {
  let names = []
  try {
    names = await readdir('/proc')
  } catch {
    return
  }
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue
    const pid = Number(name)
    if (pid === process.pid) continue
    try {
      const env = await readFile(join('/proc', name, 'environ'))
      if (!env.includes(dir)) continue
      killPid(pid)
    } catch {
      // already gone or not readable
    }
  }
}

async function readChildPid(childPath) {
  const text = await waitFor(() => {
    if (!existsSync(childPath)) return ''
    return readFileSync(childPath, 'utf8').trim()
  }, 2000)
  const pid = Number(text)
  return Number.isInteger(pid) ? pid : 0
}

function killPid(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return
  try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ }
}

function killGroup(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return
  try { process.kill(-pid, 'SIGKILL') } catch { /* already gone */ }
  killPid(pid)
}

test('parent SIGKILL reaps the restarter and its child within 5s', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-kill-'))
  const port = 22000 + Math.floor(Math.random() * 20000)
  const handle = spawnParent('hold', dir, port, true)
  let restarter = 0
  let child = 0
  try {
    const meta = await waitFor(() => {
      if (!existsSync(handle.metaPath)) return null
      return JSON.parse(readFileSync(handle.metaPath, 'utf8'))
    }, 2000)
    assert.ok(meta?.restarter, 'precondition: restarter pid')
    restarter = meta.restarter
    child = await readChildPid(handle.childPath)
    const restarterStat = procStat(restarter)
    const childStat = procStat(child)
    assert.equal(running(restarter), true, `precondition: restarter running ${commandOf(restarter)}`)
    assert.equal(running(child), true, `precondition: restarter child running ${commandOf(child)}`)
    assert.equal(restarterStat?.pgid, restarter, `precondition: restarter leads its group ${commandOf(restarter)}`)
    assert.equal(childStat?.pgid, restarter, `precondition: child is in the restarter group ${commandOf(child)}`)
    const started = Date.now()
    killPid(meta.parent)
    let goneAt = null
    while (Date.now() - started < 5000) {
      if (!running(restarter) && !running(child)) {
        goneAt = Date.now() - started
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    assert.ok(goneAt != null, `restarter and child still running after 5s restarter=${commandOf(restarter)} child=${commandOf(child)}`)
    assert.ok(goneAt <= 5000)
  } finally {
    killGroup(restarter)
    killPid(child)
    killPid(handle.parent.pid)
    await killMarked(dir)
    await rm(dir, { recursive: true, force: true })
  }
})

test('a living parent does not reap the restarter for 30s', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-hold-'))
  const port = 22000 + Math.floor(Math.random() * 20000)
  const handle = spawnParent('hold', dir, port, true)
  let restarter = 0
  let child = 0
  try {
    const meta = await waitFor(() => {
      if (!existsSync(handle.metaPath)) return null
      return JSON.parse(readFileSync(handle.metaPath, 'utf8'))
    }, 2000)
    restarter = meta?.restarter || 0
    child = await readChildPid(handle.childPath)
    assert.equal(running(restarter), true, 'precondition: restarter running')
    assert.equal(running(child), true, 'precondition: restarter child running')
    await new Promise((resolve) => setTimeout(resolve, 30000))
    assert.equal(running(meta.parent), true, 'parent still alive')
    assert.equal(running(restarter), true, `restarter was reaped while the parent lived ${commandOf(restarter)}`)
    assert.equal(running(child), true, `child was reaped while the parent lived ${commandOf(child)}`)
  } finally {
    killGroup(restarter)
    killPid(child)
    killPid(handle.parent.pid)
    await killMarked(dir)
    await rm(dir, { recursive: true, force: true })
  }
})

test('a planned restart still brings the runtime back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-restart-'))
  const port = 22000 + Math.floor(Math.random() * 20000)
  const handle = spawnParent('restart', dir, port, false)
  let listener = 0
  try {
    const healthy = await waitFor(() => {
      try {
        const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).trim()
        const pid = Number(out.split('\n')[0])
        return Number.isInteger(pid) && pid > 1 ? pid : 0
      } catch {
        return 0
      }
    }, 20000)
    listener = healthy || 0
    assert.ok(listener > 1, `planned restart did not listen on ${port}\n${handle.logs().slice(-2000)}`)
    const response = await fetch(`http://127.0.0.1:${port}/health`)
    assert.equal(response.status, 200)
  } finally {
    killPid(listener)
    killPid(handle.parent.pid)
    await killMarked(dir)
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})
