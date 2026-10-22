import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after } from 'node:test'
import assert from 'node:assert/strict'

// redislite daemonizes with setsid, so the server's ppid is 1 and it is not a
// descendant. It records the pid under the test home at this path.
const REDISLITE_SETTINGS = join('semantic-os', 'falkordb', 'graph.db.settings')

const roots = new Set()
const seen = new Set()
// pid -> { args, lstart } taken the first time that pid was observed.
export const recordedIdentity = new Map()

export function registerStrayRoot(dir) {
  if (dir) roots.add(dir)
}

export function listProcesses() {
  // procps and BSD ps both accept this. No /proc. macOS is not run here.
  const out = execFileSync('ps', ['-A', '-ww', '-o', 'pid=,ppid=,state=,args='], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const rows = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const match = /^ *(\d+) +(\d+) +(\S+)(?: +(.*))?$/.exec(line)
    if (!match) continue
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      state: match[3],
      args: match[4] || '',
    })
  }
  return rows
}

function rememberDescendants(rows) {
  const kids = new Map()
  for (const row of rows) {
    const list = kids.get(row.ppid)
    if (list) list.push(row.pid)
    else kids.set(row.ppid, [row.pid])
  }
  const stack = [process.pid]
  const walked = new Set([process.pid])
  while (stack.length) {
    const pid = stack.pop()
    for (const child of kids.get(pid) || []) {
      if (walked.has(child)) continue
      walked.add(child)
      seen.add(child)
      stack.push(child)
    }
  }
}

function rememberRedislite(alive) {
  for (const root of roots) {
    const settingsPath = join(root, REDISLITE_SETTINGS)
    if (!existsSync(settingsPath)) continue
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    const pidfile = settings && settings.pidfile
    if (typeof pidfile !== 'string' || !pidfile) {
      throw new Error(`redislite settings have no pidfile ${settingsPath}`)
    }
    if (!existsSync(pidfile)) continue
    const pid = Number(readFileSync(pidfile, 'utf8').trim())
    if (!Number.isInteger(pid) || pid <= 1) {
      throw new Error(`redislite pidfile is not a pid ${pidfile}`)
    }
    if (alive.has(pid)) seen.add(pid)
  }
}

function isCensusPs(row) {
  return /(?:^|\/)ps -A -ww -o pid=,ppid=,state=,args=$/.test(row.args)
    || /(?:^|\/)ps -p \d+ -ww -o lstart=,args=$/.test(row.args)
}

function isZombie(row) {
  return row.state.startsWith('Z')
}

function readIdentity(pid) {
  let out = ''
  try {
    out = execFileSync('ps', ['-p', String(pid), '-ww', '-o', 'lstart=,args='], {
      encoding: 'utf8',
      env: { ...process.env, LC_ALL: 'C' },
    })
  } catch {
    return null
  }
  const line = out.trim()
  const match = /^([A-Za-z]{3} [A-Za-z]{3} [ 0-9]\d \d{2}:\d{2}:\d{2} \d{4}) (.*)$/.exec(line)
  if (!match) return null
  return { lstart: match[1], args: match[2] }
}

function noteIdentity(pid) {
  if (recordedIdentity.has(pid)) return
  const snap = readIdentity(pid)
  if (snap) recordedIdentity.set(pid, snap)
}

function identityStillMatches(pid) {
  const recorded = recordedIdentity.get(pid)
  const now = readIdentity(pid)
  if (!recorded || !now) return false
  return recorded.args === now.args && recorded.lstart === now.lstart
}

function collectStrays() {
  const rows = listProcesses().filter((row) => !isCensusPs(row) && !isZombie(row))
  const alive = new Map(rows.map((row) => [row.pid, row]))
  rememberDescendants(rows)
  rememberRedislite(alive)
  const strays = []
  for (const pid of seen) {
    if (pid === process.pid || pid <= 1) continue
    const row = alive.get(pid)
    if (!row) continue
    noteIdentity(pid)
    strays.push(row)
  }
  strays.sort((a, b) => a.pid - b.pid)
  return strays
}

export function listStrays() {
  try {
    return collectStrays()
  } catch (error) {
    if (!censusError) censusError = error
    throw error
  }
}

export function formatStray(row) {
  return `pid=${row.pid} ppid=${row.ppid} args=${row.args}`
}

export function assertNoStrays() {
  if (censusError) throw censusError
  const rows = listStrays()
  assert.equal(rows.length, 0, rows.map(formatStray).join('\n'))
}

function stillLive(pid) {
  return listProcesses().some((row) => row.pid === pid && !isZombie(row))
}

// Confirms SIGKILL landed. A live pid past the bound is a failure.
// The census assertion does not wait for a process to exit on its own.
function confirmKilled(pid) {
  const deadline = Date.now() + 1000
  while (stillLive(pid)) {
    if (Date.now() >= deadline) {
      throw new Error(`pid ${pid} still alive after SIGKILL`)
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5)
  }
}

export function stopStrays(paths = []) {
  for (const path of paths) registerStrayRoot(path)
  const rows = listStrays()
  for (const row of rows) {
    if (row.pid <= 1 || row.pid === process.pid) continue
    if (!identityStillMatches(row.pid)) continue
    try {
      process.kill(row.pid, 'SIGKILL')
    } catch (error) {
      if (error && error.code !== 'ESRCH') throw error
      continue
    }
    confirmKilled(row.pid)
  }
  return rows
}

export function assertThenStopStrays(paths = []) {
  let missed = null
  try {
    assertNoStrays()
  } catch (error) {
    missed = error
  }
  stopStrays(paths)
  if (missed) throw missed
}

export function awaitChildExit(child, signal = 'SIGTERM') {
  const exited = new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      resolve()
      return
    }
    child.once('exit', resolve)
    try {
      child.kill(signal)
    } catch (error) {
      if (!error || error.code !== 'ESRCH') throw error
      resolve()
    }
  })
  return exited.then(() => assertThenStopStrays())
}

let censusError = null
if (process.env.NODE_TEST_CONTEXT) {
  const timer = setInterval(() => {
    try {
      listStrays()
    } catch {
      // listStrays keeps the first error for after(). A later success must not clear it.
    }
  }, 200)
  timer.unref()

  queueMicrotask(() => {
    after(() => {
      clearInterval(timer)
      if (censusError) throw censusError
      assertNoStrays()
    })
  })
}
