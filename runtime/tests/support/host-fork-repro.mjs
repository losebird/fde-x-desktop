import { execFile, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { PARENT_DEATH_DEADLINE_MS } from './parent-death-repro.mjs'

const execFileAsync = promisify(execFile)
const hostGroupPath = fileURLToPath(new URL('../../host-group.mjs', import.meta.url))
const forkHostPath = fileURLToPath(new URL('./fork-host.mjs', import.meta.url))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function groupMembers(pgid) {
  const { stdout } = await execFileAsync('ps', ['-ax', '-o', 'pid=,pgid=,stat=,args='], {
    timeout: 4000,
    maxBuffer: 16 * 1024 * 1024,
  })
  const rows = []
  for (const line of String(stdout || '').split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/u)
    if (!match) continue
    const row = {
      pid: Number(match[1]),
      pgid: Number(match[2]),
      stat: match[3],
      args: match[4],
    }
    if (row.pgid !== pgid || String(row.stat).includes('Z')) continue
    rows.push(row)
  }
  return rows
}

export async function runForkTrial() {
  const leader = spawn(process.execPath, [hostGroupPath, process.execPath, forkHostPath], {
    detached: true,
    stdio: ['pipe', 'ignore', 'ignore'],
  })
  leader.stdin?.on('error', () => {})
  const status = await new Promise((resolve, reject) => {
    leader.once('error', reject)
    leader.once('exit', (code, signal) => resolve({ code, signal }))
  })
  const started = Date.now()
  const until = started + PARENT_DEATH_DEADLINE_MS
  const samples = []
  let leaked = []
  while (Date.now() < until) {
    leaked = await groupMembers(leader.pid)
    samples.push({ tMs: Date.now() - started, count: leaked.length })
    if (leaked.length === 0) break
    const wait = Math.min(50, until - Date.now())
    if (wait <= 0) break
    await sleep(wait)
  }
  if (leaked.length > 0) {
    try { process.kill(-leader.pid, 'SIGKILL') } catch { /* already gone */ }
  }
  const emptyAt = samples.find((sample) => sample.count === 0)
  return {
    leaderPid: leader.pid,
    status,
    leaked: leaked.slice(0, 8),
    leakedCount: leaked.length,
    elapsedMs: emptyAt ? emptyAt.tMs : Date.now() - started,
    samples,
    ok: leaked.length === 0 && emptyAt != null && emptyAt.tMs <= PARENT_DEATH_DEADLINE_MS,
  }
}
