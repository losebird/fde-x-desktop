import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const parentScript = join(repoRoot, 'runtime/tests/support/restarter-parent.mjs')
const preload = pathToFileURL(join(repoRoot, 'runtime/tests/support/restarter-group-child.mjs')).href
const runtimeArg = /(?:^|[\s/])runtime\/(?:boot|server)\.mjs(?:\s|$)/

function psRows() {
  let text = ''
  try {
    text = execFileSync('ps', ['-A', '-ww', '-o', 'pid=,ppid=,pgid=,stat=,args='], { encoding: 'utf8' })
  } catch (error) {
    throw new Error(`ps -A -ww -o pid=,ppid=,pgid=,stat=,args= failed: ${error.message}`)
  }
  const rows = []
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/)
    if (!match) continue
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      state: match[4],
      args: match[5],
    })
  }
  return rows
}

function psOf(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return null
  try {
    const text = execFileSync(
      'ps',
      ['-p', String(pid), '-ww', '-o', 'pid=,ppid=,pgid=,stat=,args='],
      { encoding: 'utf8' },
    ).trim()
    const match = text.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([\s\S]*)$/)
    if (!match) return null
    return {
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      state: match[4],
      args: match[5],
    }
  } catch {
    return null
  }
}

function running(pid) {
  const row = psOf(pid)
  if (!row) return false
  return !row.state.startsWith('Z')
}

function commandOf(pid) {
  const row = psOf(pid)
  if (!row) return ''
  return `${row.pid} ${row.ppid} ${row.pgid} ${row.state} ${row.args}`
}

function runtimePids() {
  return psRows()
    .filter((row) => runtimeArg.test(row.args) && !row.state.startsWith('Z'))
    .map((row) => row.pid)
}

function newRuntimes(before) {
  return runtimePids().filter((pid) => !before.has(pid))
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
    const value = await read()
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

function killPids(pids) {
  for (const pid of pids) killPid(pid)
}

test('parent SIGKILL reaps the restarter and its child within 5s', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-kill-'))
  const port = 22000 + Math.floor(Math.random() * 20000)
  const before = new Set(runtimePids())
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
    const restarterRow = psOf(restarter)
    const childRow = psOf(child)
    assert.equal(running(restarter), true, `precondition: restarter running ${commandOf(restarter)}`)
    assert.equal(running(child), true, `precondition: restarter child running ${commandOf(child)}`)
    assert.equal(restarterRow?.pgid, restarter, `precondition: restarter leads its group ${commandOf(restarter)}`)
    assert.equal(childRow?.pgid, restarter, `precondition: child is in the restarter group ${commandOf(child)}`)
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
    const successors = newRuntimes(before).map((pid) => commandOf(pid)).filter(Boolean)
    const groupGone = goneAt != null
    assert.equal(
      groupGone && successors.length === 0,
      true,
      `restarter group must be gone within 5s and must not have spawned a successor`
      + ` goneAt=${goneAt} successors=${successors.join(' | ') || 'none'}`
      + ` restarter=${commandOf(restarter)} child=${commandOf(child)}`,
    )
  } finally {
    killPids(newRuntimes(before))
    killGroup(restarter)
    killPid(child)
    killPid(handle.parent.pid)
    await rm(dir, { recursive: true, force: true })
  }
})

test('a living parent does not reap the restarter for 30s', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-hold-'))
  const port = 22000 + Math.floor(Math.random() * 20000)
  const before = new Set(runtimePids())
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
    const successors = newRuntimes(before).map((pid) => commandOf(pid)).filter(Boolean)
    assert.equal(running(meta.parent), true, 'parent still alive')
    assert.equal(running(restarter), true, `restarter was reaped while the parent lived ${commandOf(restarter)}`)
    assert.equal(running(child), true, `child was reaped while the parent lived ${commandOf(child)}`)
    assert.deepEqual(successors, [], `living parent spawned a successor ${successors.join(' | ')}`)
  } finally {
    killPids(newRuntimes(before))
    killGroup(restarter)
    killPid(child)
    killPid(handle.parent.pid)
    await rm(dir, { recursive: true, force: true })
  }
})

test('a planned restart still brings the runtime back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-restart-'))
  const port = 22000 + Math.floor(Math.random() * 20000)
  const before = new Set(runtimePids())
  const handle = spawnParent('restart', dir, port, false)
  let listener = 0
  try {
    const healthy = await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`)
        return response.status === 200
      } catch {
        return false
      }
    }, 20000)
    const successors = newRuntimes(before)
    listener = successors[0] || 0
    assert.equal(healthy, true, `planned restart did not serve /health on ${port}\n${handle.logs().slice(-2000)}`)
    assert.ok(listener > 1, `planned restart did not start runtime/boot.mjs or runtime/server.mjs`)
  } finally {
    killPid(listener)
    killPids(newRuntimes(before))
    killPid(handle.parent.pid)
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})
