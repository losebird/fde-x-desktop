import './support/no-stray-processes.mjs'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const parentScript = join(repoRoot, 'runtime/tests/support/restarter-parent.mjs')
const preload = pathToFileURL(join(repoRoot, 'runtime/tests/support/restarter-group-child.mjs')).href
const runtimeArg = /(?:^|\s)(?:\S*\/)?node\s+runtime\/(?:boot|server)\.mjs(?:\s|$)/

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

function childEnv(dir, port) {
  const env = { ...process.env }
  delete env.FDE_DSH_HOME
  delete env.FDE_IUI_ARTIFACT
  delete env.NODE_OPTIONS
  delete env.FDE_RUNTIME_SUPERVISED
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

function spawnParent(mode, dir, port, withChild, extraEnv = {}) {
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
    env: { ...childEnv(dir, port), ...extraEnv },
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

function spawnDecoy(dir, port) {
  const errFd = openSync(join(dir, 'decoy.err'), 'a')
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: childEnv(dir, port),
    detached: true,
    stdio: ['ignore', 'ignore', errFd],
  })
  child.unref()
  closeSync(errFd)
  return child.pid
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

function noteChildren(restarter, seen) {
  if (!Number.isInteger(restarter) || restarter <= 1) return
  for (const row of psRows()) {
    if (row.ppid !== restarter || row.state.startsWith('Z')) continue
    seen.set(row.pid, row)
  }
}

function successorLines(seen) {
  return [...seen.values()]
    .filter((row) => runtimeArg.test(row.args))
    .map((row) => `${row.pid} ${row.ppid} ${row.pgid} ${row.state} ${row.args}`)
}

function killOwned(restarter, seen) {
  const groups = new Set()
  if (Number.isInteger(restarter) && restarter > 1) groups.add(restarter)
  for (const row of seen.values()) {
    if (row.pgid > 1) groups.add(row.pgid)
  }
  for (const pgid of groups) killGroup(pgid)
}

function runtimePidRows(dir) {
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  const rows = []
  for (const name of names) {
    if (!/^runtime-\d+\.pid$/.test(name)) continue
    let pid = 0
    try {
      pid = Number(readFileSync(join(dir, name), 'utf8'))
    } catch {
      continue
    }
    const row = psOf(pid)
    if (row && !row.state.startsWith('Z')) rows.push(row)
  }
  return rows
}

function reapRuntimePids(dir) {
  const self = psOf(process.pid)
  for (const row of runtimePidRows(dir)) {
    if (!runtimeArg.test(row.args)) continue
    if (self && row.pgid === self.pgid) continue
    if (row.pgid > 1) killGroup(row.pgid)
  }
}

async function readMeta(metaPath) {
  return waitFor(() => {
    if (!existsSync(metaPath)) return null
    return JSON.parse(readFileSync(metaPath, 'utf8'))
  }, 2000)
}

test('parent SIGKILL reaps the restarter and its child within 5s', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-kill-'))
  const port = 22000 + Math.floor(Math.random() * 20000)
  const seen = new Map()
  const handle = spawnParent('hold', dir, port, true)
  let restarter = 0
  let child = 0
  try {
    const meta = await readMeta(handle.metaPath)
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
      noteChildren(restarter, seen)
      if (!running(restarter) && !running(child)) {
        goneAt = Date.now() - started
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    noteChildren(restarter, seen)
    const successors = successorLines(seen)
    assert.equal(
      goneAt != null && successors.length === 0,
      true,
      `restarter group must be gone within 5s and must not have spawned a successor`
      + ` goneAt=${goneAt} successors=${successors.join(' | ') || 'none'}`
      + ` restarter=${commandOf(restarter)} child=${commandOf(child)}`,
    )
  } finally {
    try { killOwned(restarter, seen) } catch { /* already gone */ }
    try { killPid(child) } catch { /* already gone */ }
    try { killPid(handle.parent.pid) } catch { /* already gone */ }
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})

test('an unrelated runtime server stays up while the restarter is reaped', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-decoy-'))
  const decoyDir = join(dir, 'decoy')
  mkdirSync(decoyDir)
  const port = 22000 + Math.floor(Math.random() * 20000)
  const decoyPort = port + 1
  const seen = new Map()
  const decoyPid = spawnDecoy(decoyDir, decoyPort)
  const handle = spawnParent('hold', dir, port, true)
  let restarter = 0
  let child = 0
  let decoyPgid = 0
  try {
    const decoyRow = await waitFor(() => {
      const row = psOf(decoyPid)
      return row && runtimeArg.test(row.args) ? row : null
    }, 2000)
    assert.ok(decoyRow, `precondition: decoy runtime/server.mjs running ${commandOf(decoyPid)}`)
    decoyPgid = decoyRow.pgid
    assert.equal(decoyRow.pgid, decoyPid, `precondition: decoy leads its own group ${commandOf(decoyPid)}`)
    const meta = await readMeta(handle.metaPath)
    assert.ok(meta?.restarter, 'precondition: restarter pid')
    restarter = meta.restarter
    child = await readChildPid(handle.childPath)
    assert.equal(running(restarter), true, 'precondition: restarter running')
    assert.equal(running(child), true, 'precondition: restarter child running')
    assert.notEqual(decoyRow.ppid, restarter, 'precondition: decoy is not a child of the restarter')
    const started = Date.now()
    killPid(meta.parent)
    let goneAt = null
    while (Date.now() - started < 5000) {
      noteChildren(restarter, seen)
      if (!running(restarter) && !running(child)) {
        goneAt = Date.now() - started
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    noteChildren(restarter, seen)
    const successors = successorLines(seen)
    assert.equal(goneAt != null && successors.length === 0, true, `reap failed goneAt=${goneAt} successors=${successors.join(' | ') || 'none'}`)
    const after = psOf(decoyPid)
    assert.equal(running(decoyPid), true, `decoy was killed ${commandOf(decoyPid)}`)
    assert.equal(after?.pgid, decoyPgid, `decoy group changed ${commandOf(decoyPid)}`)
    process.stdout.write(`# decoy-alive ${commandOf(decoyPid)}\n`)
  } finally {
    try { killOwned(restarter, seen) } catch { /* already gone */ }
    try { killPid(child) } catch { /* already gone */ }
    try { killPid(handle.parent.pid) } catch { /* already gone */ }
    try { killGroup(decoyPgid || decoyPid) } catch { /* already gone */ }
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})

test('a living parent does not reap the restarter for 30s', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-hold-'))
  const port = 22000 + Math.floor(Math.random() * 20000)
  const seen = new Map()
  const handle = spawnParent('hold', dir, port, true)
  let restarter = 0
  let child = 0
  try {
    const meta = await readMeta(handle.metaPath)
    restarter = meta?.restarter || 0
    child = await readChildPid(handle.childPath)
    assert.equal(running(restarter), true, 'precondition: restarter running')
    assert.equal(running(child), true, 'precondition: restarter child running')
    const until = Date.now() + 30000
    while (Date.now() < until) {
      noteChildren(restarter, seen)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    noteChildren(restarter, seen)
    const successors = successorLines(seen)
    assert.equal(running(meta.parent), true, 'parent still alive')
    assert.equal(running(restarter), true, `restarter was reaped while the parent lived ${commandOf(restarter)}`)
    assert.equal(running(child), true, `child was reaped while the parent lived ${commandOf(child)}`)
    assert.deepEqual(successors, [], `living parent spawned a successor ${successors.join(' | ')}`)
  } finally {
    try { killOwned(restarter, seen) } catch { /* already gone */ }
    try { killPid(child) } catch { /* already gone */ }
    try { killPid(handle.parent.pid) } catch { /* already gone */ }
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})

test('a planned restart still brings the runtime back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-restarter-restart-'))
  const port = 22000 + Math.floor(Math.random() * 20000)
  const seen = new Map()
  const runtimePidPreload = pathToFileURL(join(repoRoot, 'runtime/tests/support/restarter-runtime-pid.mjs')).href
  let handle = null
  let restarter = 0
  try {
    handle = spawnParent('restart', dir, port, false, {
      NODE_OPTIONS: `--import ${runtimePidPreload}`,
      FDE_RESTARTER_RUNTIME_PIDDIR: dir,
    })
    const meta = await readMeta(handle.metaPath)
    assert.ok(meta?.restarter, 'precondition: restarter pid')
    restarter = meta.restarter
    const deadline = Date.now() + 20000
    let healthy = false
    while (Date.now() < deadline) {
      noteChildren(restarter, seen)
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`)
        if (response.status === 200) {
          healthy = true
          break
        }
      } catch { /* not listening yet */ }
      await new Promise((resolve) => setTimeout(resolve, 15))
    }
    noteChildren(restarter, seen)
    const successors = runtimePidRows(dir).filter((row) => runtimeArg.test(row.args))
    assert.equal(healthy, true, `planned restart did not serve /health on ${port}\n${handle.logs().slice(-2000)}`)
    assert.ok(
      successors.length >= 1,
      `planned restart did not leave a runtime/boot.mjs or runtime/server.mjs started by this test; saw ${successors.map((row) => row.args).join(' | ') || 'none'}`,
    )
    process.stdout.write(`# successor ${successors.map((row) => `${row.pid} ${row.ppid} ${row.pgid} ${row.state} ${row.args}`).join(' | ')}\n`)
  } finally {
    try { reapRuntimePids(dir) } catch { /* still kill the restarter group */ }
    try { killOwned(restarter, seen) } catch { /* already gone */ }
    try { if (handle) killPid(handle.parent.pid) } catch { /* already gone */ }
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
})
