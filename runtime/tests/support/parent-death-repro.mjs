import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const PARENT_DEATH_DEADLINE_MS = 2000

const GROUP_ROLES = new Set(['leader', 'host', 'pip'])

export function judgeHostGroupWindow(samples) {
  const transientPid1 = []
  let sawEmpty = false
  let reappeared = false
  for (const sample of samples || []) {
    const group = (sample.rows || []).filter((row) => GROUP_ROLES.has(row.role))
    if (sawEmpty) {
      if (group.length > 0) reappeared = true
      continue
    }
    if (group.length === 0) {
      sawEmpty = true
      continue
    }
    for (const row of group) {
      if (row.ppid !== 1) continue
      transientPid1.push({
        tMs: sample.tMs,
        pid: row.pid,
        ppid: row.ppid,
        pgid: row.pgid,
        sid: row.sid,
        stat: row.stat,
        role: row.role,
      })
    }
  }
  const lastGroup = ((samples || []).at(-1)?.rows || []).filter((row) => GROUP_ROLES.has(row.role))
  const endClear = (samples || []).length > 0 && lastGroup.length === 0
  const stayedClear = sawEmpty && reappeared === false
  return {
    endClear,
    stayedClear,
    transientPid1,
    pass: endClear && stayedClear,
  }
}

export function judgeHostCrash(report) {
  const windowJudgment = judgeHostGroupWindow(report?.samples)
  const pips = Array.isArray(report?.pipBefore) ? report.pipBefore : []
  const leaderPgid = report?.leaderPgid
  const inGroup = pips.length > 0
    && Number.isInteger(leaderPgid)
    && leaderPgid > 1
    && pips.every((row) => row.pgid === leaderPgid && !String(row.stat || '').includes('Z'))
  return {
    endClear: windowJudgment.endClear,
    stayedClear: windowJudgment.stayedClear,
    transientPid1: windowJudgment.transientPid1,
    inGroup,
    leaderPgid: leaderPgid ?? null,
    pip: pips.map((row) => ({ pid: row.pid, pgid: row.pgid, stat: row.stat })),
    pass: inGroup && windowJudgment.pass,
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function listProcesses() {
  const { stdout } = await execFileAsync('ps', ['-ax', '-o', 'pid=,ppid=,pgid=,sid=,stat=,args='], {
    timeout: 4000,
    maxBuffer: 16 * 1024 * 1024,
  })
  const rows = []
  for (const line of String(stdout || '').split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/u)
    if (!match) continue
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
      sid: Number(match[4]),
      stat: match[5],
      args: match[6],
    })
  }
  return rows
}

function isSemanticaPip(row) {
  return row.args.includes('semantica') && /\bpip\d*\b/u.test(row.args)
}

function roleOf(row, leaderPid) {
  if (row.pid === leaderPid || row.args.includes('host-group.mjs')) return 'leader'
  if (isSemanticaPip(row)) return 'pip'
  if (row.args.includes('bin.js') || row.args.includes('@deepseek-ai/dsh')) return 'host'
  return 'other'
}

function markRow(row, leaderPid) {
  return {
    pid: row.pid,
    ppid: row.ppid,
    pgid: row.pgid,
    sid: row.sid,
    stat: row.stat,
    role: roleOf(row, leaderPid),
    args: row.args,
  }
}

async function processOwnsHome(pid, home) {
  try {
    const env = await readFile(join('/proc', String(pid), 'environ'))
    if (env.includes(home)) return true
  } catch {
    return false
  }
  return false
}

async function processRow(pid) {
  const rows = await listProcesses()
  return rows.find((row) => row.pid === pid) || null
}

async function homeProcesses(home) {
  const rows = []
  for (const row of await listProcesses()) {
    if (row.stat.includes('Z')) continue
    if (!(await processOwnsHome(row.pid, home))) continue
    rows.push(row)
  }
  return rows
}

async function ensurePeerResources() {
  const generation = join(import.meta.dirname, '..', '..', '.host-generation', 'node_modules', '@deepseek-ai')
  const root = await mkdtemp(join(tmpdir(), 'fde-parent-death-resources-'))
  const dest = join(root, 'dsh', 'node_modules', '@deepseek-ai')
  await mkdir(dest, { recursive: true })
  for (const name of ['schemastery', 'dsh-tools', 'dsh-llm']) {
    const source = join(generation, name)
    if (!existsSync(join(source, 'package.json'))) {
      throw new Error(`generation host is missing ${name}`)
    }
    await symlink(source, join(dest, name))
  }
  return root
}

function readMessages(child) {
  const channel = child.stdio[3]
  channel.setEncoding('utf8')
  let buffer = ''
  const messages = []
  const waiters = []
  let failed = null
  function settle(message) {
    const waiter = waiters.shift()
    if (waiter) waiter.resolve(message)
    else messages.push(message)
  }
  channel.on('data', (chunk) => {
    buffer += chunk
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      index = buffer.indexOf('\n')
      if (!line) continue
      let message
      try {
        message = JSON.parse(line)
      } catch (error) {
        message = { type: 'bad-json', line, error: error instanceof Error ? error.message : String(error) }
      }
      settle(message)
    }
  })
  return {
    fail(error) {
      failed = error
      while (waiters.length > 0) waiters.shift().reject(error)
    },
    next(timeoutMs) {
      if (failed) return Promise.reject(failed)
      if (messages.length > 0) return Promise.resolve(messages.shift())
      return new Promise((resolveMessage, rejectMessage) => {
        const timer = setTimeout(() => rejectMessage(new Error('connector child did not report in time')), timeoutMs)
        waiters.push({
          resolve(message) {
            clearTimeout(timer)
            resolveMessage(message)
          },
          reject(error) {
            clearTimeout(timer)
            rejectMessage(error)
          },
        })
      })
    },
  }
}

async function sampleWindow(home, leaderPid, tracked, killedAt, deadlineMs, includeZombies = false) {
  const until = killedAt + deadlineMs
  const samples = []
  let last = []
  let goneAt = null
  while (Date.now() < until) {
    const byPid = new Map()
    for (const row of await listProcesses()) {
      if (!includeZombies && row.stat.includes('Z')) continue
      if (tracked.has(row.pid)) byPid.set(row.pid, row)
    }
    for (const row of await homeProcesses(home)) byPid.set(row.pid, row)
    const rows = [...byPid.values()]
    last = rows.map((row) => markRow(row, leaderPid))
    samples.push({ tMs: Date.now() - killedAt, rows: last })
    if (goneAt == null && rows.length === 0) goneAt = Date.now()
    const wait = Math.min(100, until - Date.now())
    if (wait <= 0) break
    await sleep(wait)
  }
  return {
    samples,
    last,
    elapsedMs: (goneAt ?? Date.now()) - killedAt,
  }
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function ownPgid() {
  const stat = readFileSync('/proc/self/stat', 'utf8')
  const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const pgid = Number(rest[2])
  return Number.isInteger(pgid) ? pgid : process.pid
}

export async function runParentDeath(options = {}) {
  const mode = options.mode === 'stable' || options.mode === 'crash' ? options.mode : 'death'
  const deadlineMs = options.deadlineMs ?? PARENT_DEATH_DEADLINE_MS
  const semantic = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS || ''
  const lan = process.env.FDE_PLUGIN_DSH_LAN_ASSIST || ''
  if (!semantic) throw new Error('FDE_PLUGIN_DSH_SEMANTIC_OS must point at the pinned semantic-os tree')
  if (!lan) throw new Error('FDE_PLUGIN_DSH_LAN_ASSIST must point at the pinned lan-assist tree')
  const vendor = await mkdtemp(join(tmpdir(), 'fde-parent-death-vendor-'))
  const resources = await ensurePeerResources()
  const childPath = fileURLToPath(new URL('./host-parent-death-child.mjs', import.meta.url))
  const env = { ...process.env }
  delete env.FDE_DSH_HOME
  delete env.DSH_HOME
  env.FDE_VENDOR_DIR = vendor
  env.FDE_RESOURCES = resources
  env.FDE_PLUGIN_DSH_SEMANTIC_OS = semantic
  env.FDE_PLUGIN_DSH_LAN_ASSIST = lan
  if (mode === 'stable') env.FDE_PARENT_DEATH_HOLD_MS = String(options.holdMs ?? 30_000)
  else delete env.FDE_PARENT_DEATH_HOLD_MS
  if (mode === 'crash') env.FDE_PARENT_DEATH_KEEPALIVE = '1'
  else delete env.FDE_PARENT_DEATH_KEEPALIVE

  const child = spawn(process.execPath, [childPath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk)
  })
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk)
  })
  const messages = readMessages(child)
  let childExited = null
  let expectExit = false
  child.on('exit', (code, signal) => {
    childExited = signal ? `signal ${signal}` : `code ${code}`
    if (!expectExit) messages.fail(new Error(`connector child exited early (${childExited})\n${stderr.slice(-2000)}`))
  })
  function failIfChildExited() {
    if (childExited) throw new Error(`connector child exited early (${childExited})\n${stderr.slice(-2000)}`)
  }
  const report = {
    mode,
    deadlineMs,
    connected: false,
    version: null,
    home: null,
    hostPid: null,
    parentPid: null,
    hostBefore: null,
    webLine: false,
    httpStatus: 0,
    epipe: false,
    connector: null,
    beforeKids: [],
    beforeRows: [],
    samples: [],
    survivors: [],
    reparented: [],
    elapsedMs: null,
    verdict: null,
    stable: null,
    error: null,
    stdoutTail: '',
    stderrTail: '',
  }
  try {
    const ready = await messages.next(180_000)
    failIfChildExited()
    if (ready.type !== 'ready') throw new Error(`connector child failed before ready: ${JSON.stringify(ready)}\n${stderr.slice(-2000)}`)
    report.connected = true
    report.version = ready.version
    report.home = ready.home
    report.hostPid = ready.hostPid
    report.parentPid = ready.parentPid
    report.connector = ready.connector || ''
    report.webLine = ready.webLine
    report.httpStatus = ready.status
    report.epipe = ready.epipe
    report.hostBefore = report.hostPid ? await processRow(report.hostPid) : null
    if (mode === 'death') {
      const pipUntil = Date.now() + 20_000
      let kids = []
      do {
        kids = (await homeProcesses(ready.home)).filter(isSemanticaPip)
        if (kids.length > 0) break
        await sleep(200)
      } while (Date.now() < pipUntil)
      report.beforeKids = kids.filter((row) => alive(row.pid))
      report.hostBefore = report.hostPid ? await processRow(report.hostPid) : null
      report.beforeRows = (await homeProcesses(ready.home)).map((row) => markRow(row, report.hostPid))
      const killedAt = Date.now()
      expectExit = true
      process.kill(child.pid, 'SIGKILL')
      const tracked = new Set([
        report.hostPid,
        ...report.beforeRows.map((row) => row.pid),
        ...report.beforeKids.map((row) => row.pid),
      ].filter((pid) => Number.isInteger(pid)))
      const window = await sampleWindow(ready.home, report.hostPid, tracked, killedAt, deadlineMs)
      report.samples = window.samples
      report.elapsedMs = window.elapsedMs
      report.survivors = window.last
      report.reparented = window.last.filter((row) => row.ppid === 1)
      report.judgment = judgeHostGroupWindow(report.samples)
      report.transientPid1 = report.judgment.transientPid1
      report.verdict = report.judgment.pass ? 'green' : 'red'
    } else if (mode === 'crash') {
      const pipUntil = Date.now() + 20_000
      let kids = []
      do {
        kids = (await homeProcesses(ready.home)).filter(isSemanticaPip)
        if (kids.length > 0) break
        await sleep(200)
      } while (Date.now() < pipUntil)
      report.beforeKids = kids.filter((row) => alive(row.pid))
      report.beforeRows = (await homeProcesses(ready.home)).map((row) => markRow(row, report.hostPid))
      const leaderPid = report.hostPid
      const leaderRow = report.beforeRows.find((row) => row.pid === leaderPid) || await processRow(leaderPid)
      report.leaderPgid = leaderRow?.pgid ?? null
      report.pipBefore = report.beforeKids.map((row) => ({
        pid: row.pid,
        ppid: row.ppid,
        pgid: row.pgid,
        sid: row.sid,
        stat: row.stat,
      }))
      const hostRow = report.beforeRows.find((row) => row.role === 'host' && alive(row.pid))
      if (!hostRow) throw new Error(`did not find the host bin under ${ready.home}`)
      if (hostRow.pid === leaderPid || hostRow.pid === child.pid) {
        throw new Error(`crash probe would signal pid ${hostRow.pid}, which is the parent or the group leader`)
      }
      if (!judgeHostCrash(report).inGroup) {
        throw new Error(`pip was not running in the host group before SIGKILL: ${JSON.stringify({ pip: report.pipBefore, leaderPgid: report.leaderPgid })}`)
      }
      report.hostBefore = hostRow
      report.killed = { pid: hostRow.pid, role: hostRow.role, leaderPid, parentPid: child.pid }
      const killedAt = Date.now()
      process.kill(hostRow.pid, 'SIGKILL')
      const tracked = new Set([hostRow.pid, leaderPid, ...report.beforeKids.map((row) => row.pid)])
      const window = await sampleWindow(ready.home, leaderPid, tracked, killedAt, deadlineMs, true)
      report.samples = window.samples
      report.elapsedMs = window.elapsedMs
      report.parentAliveAfter = alive(child.pid)
      const live = (row) => !String(row.stat).includes('Z')
      report.survivors = window.last.filter((row) => (row.role === 'pip' || row.role === 'host') && live(row))
      report.reparented = []
      for (const sample of report.samples) {
        for (const row of sample.rows) {
          if (row.role !== 'pip' || row.ppid !== 1 || !live(row)) continue
          report.reparented.push({
            tMs: sample.tMs,
            pid: row.pid,
            ppid: row.ppid,
            pgid: row.pgid,
            sid: row.sid,
            stat: row.stat,
            role: row.role,
          })
        }
      }
      report.judgment = judgeHostGroupWindow(report.samples)
      report.crashJudgment = judgeHostCrash(report)
      report.transientPid1 = report.crashJudgment.transientPid1
      report.verdict = report.crashJudgment.pass ? 'green' : 'red'
      if (!report.parentAliveAfter) throw new Error('crash probe parent exited during the host SIGKILL window')
    } else {
      const stable = await messages.next((options.holdMs ?? 30_000) + 30_000)
      report.stable = stable
      report.webLine = Boolean(stable.webLine)
      report.httpStatus = stable.status
      report.epipe = Boolean(ready.epipe || stable.epipe)
      report.hostBefore = stable.hostPid ? await processRow(stable.hostPid) : null
      report.hostPid = stable.hostPid
      expectExit = true
      if (child.exitCode == null && child.signalCode == null) process.kill(child.pid, 'SIGTERM')
      const closed = Date.now() + 15_000
      while (alive(child.pid) && Date.now() < closed) await sleep(100)
      report.survivors = await homeProcesses(ready.home)
      report.reparented = report.survivors.filter((row) => row.ppid === 1)
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (alive(child.pid)) {
      try { process.kill(child.pid, 'SIGKILL') } catch {}
    }
    for (const row of [...(report.beforeKids || []), ...(report.reparented || [])]) {
      if (Number.isInteger(row.pid)) {
        try { process.kill(row.pid, 'SIGKILL') } catch {}
      }
    }
    if (report.home) {
      const mine = ownPgid()
      for (const row of await homeProcesses(report.home).catch(() => [])) {
        try { process.kill(row.pid, 'SIGKILL') } catch {}
        if (row.pgid > 1 && row.pgid !== mine) {
          try { process.kill(-row.pgid, 'SIGKILL') } catch {}
        }
      }
      await sleep(100)
      await rm(report.home, { recursive: true, force: true }).catch(() => {})
    }
    await rm(vendor, { recursive: true, force: true }).catch(() => {})
    await rm(resources, { recursive: true, force: true }).catch(() => {})
    report.stdoutTail = stdout.slice(-2000)
    report.stderrTail = stderr.slice(-2000)
  }
  report.ok = report.mode === 'death'
    ? report.error == null
      && report.connector === 'DshCoreConnector'
      && report.webLine === true
      && report.epipe === false
      && report.httpStatus >= 200
      && report.httpStatus < 400
      && report.beforeKids.length > 0
      && report.samples.length > 0
      && report.judgment?.pass === true
      && report.elapsedMs != null
      && report.elapsedMs <= deadlineMs
      && report.hostBefore?.ppid === report.parentPid
    : report.mode === 'crash'
      ? report.error == null
        && report.connector === 'DshCoreConnector'
        && report.samples.length > 0
        && report.killed?.role === 'host'
        && report.killed.pid !== report.parentPid
        && report.killed.pid !== report.killed.leaderPid
        && report.parentAliveAfter === true
        && report.crashJudgment?.inGroup === true
        && report.crashJudgment?.pass === true
        && report.elapsedMs != null
        && report.elapsedMs <= deadlineMs
    : report.error == null
      && report.stable?.type === 'stable'
      && report.webLine === true
      && report.epipe === false
      && report.httpStatus >= 200
      && report.httpStatus < 400
      && report.hostBefore?.ppid === report.parentPid
      && alive(report.hostPid) === false
      && report.survivors.length === 0
  if (options.out) {
    await mkdir(dirname(options.out), { recursive: true })
    await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`)
  }
  return report
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args.includes('--crash') ? 'crash' : args.includes('--stable') ? 'stable' : 'death'
  const outFlag = args.indexOf('--out')
  const out = outFlag >= 0 ? resolve(args[outFlag + 1] || '') : ''
  const report = await runParentDeath({ mode, out: out || undefined })
  if (!out) console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
