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

export function registerStrayRoot(dir) {
  if (dir) roots.add(dir)
}

export function listProcesses() {
  // procps and BSD ps both accept this. No /proc. macOS is not run here.
  const out = execFileSync('ps', ['-A', '-ww', '-o', 'pid=,ppid=,args='], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const rows = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const match = /^ *(\d+) +(\d+)(?: +(.*))?$/.exec(line)
    if (!match) continue
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      args: match[3] || '',
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
  return /(?:^|\/)ps -A -ww -o pid=,ppid=,args=$/.test(row.args)
}

export function listStrays() {
  const rows = listProcesses().filter((row) => !isCensusPs(row))
  const alive = new Map(rows.map((row) => [row.pid, row]))
  rememberDescendants(rows)
  rememberRedislite(alive)
  const strays = []
  for (const pid of seen) {
    if (pid === process.pid || pid <= 1) continue
    const row = alive.get(pid)
    if (row) strays.push(row)
  }
  strays.sort((a, b) => a.pid - b.pid)
  return strays
}

export function formatStray(row) {
  return `pid=${row.pid} ppid=${row.ppid} args=${row.args}`
}

export function assertNoStrays() {
  if (censusError) throw censusError
  const rows = listStrays()
  assert.equal(rows.length, 0, rows.map(formatStray).join('\n'))
}

export function stopStrays(paths = []) {
  for (const path of paths) registerStrayRoot(path)
  const rows = listStrays()
  for (const row of rows) {
    if (row.pid <= 1 || row.pid === process.pid) continue
    try {
      process.kill(row.pid, 'SIGKILL')
    } catch (error) {
      if (error && error.code !== 'ESRCH') throw error
    }
  }
  return rows
}

let censusError = null
const timer = setInterval(() => {
  try {
    listStrays()
    censusError = null
  } catch (error) {
    censusError = error
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
