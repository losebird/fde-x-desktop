import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const PARENT_DEATH_DEADLINE_MS = 2000

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
  const mode = options.mode === 'stable' ? 'stable' : 'death'
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
    beforeKids: [],
    survivors: [],
    reparented: [],
    elapsedMs: null,
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
      const killedAt = Date.now()
      expectExit = true
      process.kill(child.pid, 'SIGKILL')
      const tracked = new Set([report.hostPid, ...report.beforeKids.map((row) => row.pid)].filter((pid) => Number.isInteger(pid)))
      let last = []
      let goneAt = null
      const until = killedAt + deadlineMs
      do {
        last = await homeProcesses(ready.home)
        if (last.length === 0 && [...tracked].every((pid) => !alive(pid))) {
          goneAt = Date.now()
          break
        }
        if (Date.now() >= until) break
        await sleep(100)
      } while (Date.now() < until)
      report.elapsedMs = (goneAt ?? Date.now()) - killedAt
      report.survivors = last
      report.reparented = last.filter((row) => row.ppid === 1)
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
      && report.webLine === true
      && report.epipe === false
      && report.httpStatus >= 200
      && report.httpStatus < 400
      && report.beforeKids.length > 0
      && report.survivors.length === 0
      && report.reparented.length === 0
      && report.elapsedMs != null
      && report.elapsedMs <= deadlineMs
      && report.hostBefore?.ppid === report.parentPid
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
  const mode = args.includes('--stable') ? 'stable' : 'death'
  const outFlag = args.indexOf('--out')
  const out = outFlag >= 0 ? resolve(args[outFlag + 1] || '') : ''
  const report = await runParentDeath({ mode, out: out || undefined })
  if (!out) console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
