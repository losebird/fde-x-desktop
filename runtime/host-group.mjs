import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const command = process.argv[2]
const args = process.argv.slice(3)
if (!command) process.exit(1)

let killed = false
let reaper = null
let child = null
// #73 samples the group for 2000ms after the host dies. Stay inside that window.
const REAP_BOUND_MS = 1200

function publishHostExit(code, signal) {
  const finalPath = process.env.FDE_HOST_EXIT_STATUS
  if (!finalPath) return
  mkdirSync(dirname(finalPath), { recursive: true })
  const tmpPath = `${finalPath}.${process.pid}.tmp`
  writeFileSync(tmpPath, JSON.stringify({
    code: Number.isInteger(code) ? code : null,
    signal: signal || null,
  }))
  renameSync(tmpPath, finalPath)
}

function noteShutdown(who) {
  const spy = process.env.FDE_REDIS_SHUTDOWN_SPY
  if (!spy) return
  try { appendFileSync(spy, `${who}\n`) } catch { /* diagnostic only */ }
}

function armLeaderDeathReaper() {
  if (process.platform === 'win32') return
  const script = [
    "const fs = require('node:fs')",
    'const pgid = Number(process.env.FDE_REAP_PGID)',
    'const spy = process.env.FDE_REDIS_SHUTDOWN_SPY',
    'if (!Number.isInteger(pgid) || pgid <= 1) process.exit(0)',
    "process.on('SIGTERM', () => {})",
    'function reap() {',
    "  if (spy) { try { fs.appendFileSync(spy, 'leader-death\\n') } catch {} }",
    "  try { process.kill(-pgid, 'SIGKILL') } catch {}",
    '  process.exit(0)',
    '}',
    "process.stdin.on('end', reap)",
    "process.stdin.on('error', reap)",
    'process.stdin.resume()',
  ].join('\n')
  reaper = spawn(process.execPath, ['-e', script], {
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
    env: { ...process.env, FDE_REAP_PGID: String(process.pid) },
  })
  reaper.on('error', () => {})
  reaper.stdin?.on('error', () => {})
}

function sameGroupPids() {
  const pgid = process.pid
  const skip = new Set([process.pid])
  if (Number.isInteger(reaper?.pid)) skip.add(reaper.pid)
  const live = []
  let names = null
  try { names = readdirSync('/proc') } catch { names = null }
  if (names) {
    for (const name of names) {
      if (!/^\d+$/.test(name)) continue
      const pid = Number(name)
      if (skip.has(pid)) continue
      try {
        const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
        const rest = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)
        if (rest[0] === 'Z' || rest[0] === 'X') continue
        if (Number(rest[2]) === pgid) live.push(pid)
      } catch { /* process left while we read */ }
    }
    return live
  }
  const out = execFileSync('ps', ['-ax', '-o', 'pid=,pgid=,stat='], { encoding: 'utf8', timeout: 2000 })
  for (const line of out.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)/)
    if (!match) continue
    const pid = Number(match[1])
    if (skip.has(pid)) continue
    if (Number(match[2]) !== pgid) continue
    if (String(match[3]).includes('Z')) continue
    live.push(pid)
  }
  return live
}

function finishGroup() {
  try {
    process.kill(-process.pid, 'SIGKILL')
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
    process.exit(1)
  }
}

function killGroup() {
  if (killed) return
  killed = true
  noteShutdown('host-group')
  if (process.platform === 'win32') {
    try { child?.kill('SIGKILL') } catch { /* already gone */ }
    try {
      process.kill(-process.pid, 'SIGKILL')
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error
      process.exit(1)
    }
    return
  }
  try {
    process.kill(-process.pid, 'SIGTERM')
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
    process.exit(1)
  }
  const deadline = Date.now() + REAP_BOUND_MS
  const timer = setInterval(() => {
    let pending = null
    try { pending = sameGroupPids() } catch { pending = null }
    if ((pending && pending.length === 0) || Date.now() >= deadline) {
      clearInterval(timer)
      finishGroup()
    }
  }, 50)
}

if (process.platform !== 'win32') {
  process.on('SIGTERM', () => {})
  armLeaderDeathReaper()
}

process.stdin.on('end', killGroup)
process.stdin.on('error', (error) => {
  if (error?.code === 'EPIPE' || error?.code === 'ECONNRESET' || error?.code === 'ERR_STREAM_DESTROYED') killGroup()
})
process.stdin.resume()

const hostEnv = { ...process.env }
delete hostEnv.FDE_HOST_EXIT_STATUS
delete hostEnv.FDE_REAP_PGID
child = spawn(command, args, {
  stdio: ['ignore', 'inherit', 'inherit'],
  windowsHide: true,
  env: hostEnv,
})

child.on('error', () => {
  if (!killed) process.exit(1)
})

child.on('exit', (code, signal) => {
  if (killed) return
  try {
    publishHostExit(code, signal)
  } catch {
    /* still reap the group when the status file cannot be written */
  }
  killGroup()
})
