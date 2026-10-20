import { execFile, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createCoreConnector } from '../../dsh-core.mjs'
import { judgeHostGroupWindow, PARENT_DEATH_DEADLINE_MS } from './parent-death-repro.mjs'

const execFileAsync = promisify(execFile)
const fakeHostPath = fileURLToPath(new URL('./fake-host-exit.mjs', import.meta.url))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function phraseFor(mode) {
  if (mode === 'code3') return 'AI 服务启动前退出（code 3）'
  if (mode === 'code0') return 'AI 服务启动前退出（code 0）'
  if (mode === 'sigsegv') return 'AI 服务启动前退出（signal SIGSEGV）'
  throw new Error(`unknown host exit mode ${mode}`)
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

async function readReady(path, timeoutMs) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    try {
      const { readFile } = await import('node:fs/promises')
      const text = await readFile(path, 'utf8')
      if (text.trim()) return JSON.parse(text)
    } catch {
      /* ready file appears after the fake host spawns pip */
    }
    await sleep(20)
  }
  throw new Error('fake host did not report pip')
}

async function sampleTracked(tracked, leaderPid, hostPid, pipPid, deadlineMs) {
  const started = Date.now()
  const until = started + deadlineMs
  const samples = []
  while (Date.now() < until) {
    const rows = []
    for (const row of await listProcesses()) {
      if (!tracked.has(row.pid) || String(row.stat).includes('Z')) continue
      rows.push({
        ...row,
        role: row.pid === leaderPid ? 'leader' : row.pid === hostPid ? 'host' : row.pid === pipPid ? 'pip' : 'other',
      })
    }
    samples.push({ tMs: Date.now() - started, rows })
    const wait = Math.min(100, until - Date.now())
    if (wait <= 0) break
    await sleep(wait)
  }
  return samples
}

export async function runHostExitStatus(options = {}) {
  const mode = options.mode
  const phrase = phraseFor(mode)
  const home = await mkdtemp(join(tmpdir(), 'fde-host-exit-'))
  const cwd = join(home, 'workspace')
  const patchFile = join(home, 'probe.patch.yml')
  const readyPath = join(home, 'ready')
  const goPath = join(home, 'go')
  await mkdir(cwd, { recursive: true })
  await writeFile(patchFile, '')
  await writeFile(join(home, '.credentials.yaml'), '', { mode: 0o600 })
  spawnSync('mkfifo', [goPath], { stdio: 'ignore' })
  const previous = {
    FAKE_HOST_READY: process.env.FAKE_HOST_READY,
    FAKE_HOST_GO: process.env.FAKE_HOST_GO,
    FAKE_HOST_MODE: process.env.FAKE_HOST_MODE,
    FDE_SEMANTIC_RUNTIME_MODE: process.env.FDE_SEMANTIC_RUNTIME_MODE,
  }
  process.env.FAKE_HOST_READY = readyPath
  process.env.FAKE_HOST_GO = goPath
  process.env.FAKE_HOST_MODE = mode === 'sigsegv' ? 'signal' : 'code'
  process.env.FDE_SEMANTIC_RUNTIME_MODE = process.env.FDE_SEMANTIC_RUNTIME_MODE || 'readonly'
  const report = {
    mode,
    phrase,
    deadlineMs: PARENT_DEATH_DEADLINE_MS,
    pipBefore: null,
    leaderPgid: null,
    leaderPid: null,
    hostPid: null,
    inGroup: false,
    message: '',
    samples: [],
    judgment: null,
    elapsedMs: null,
    error: null,
    ok: false,
  }
  let core = null
  try {
    core = createCoreConnector({
      dshHome: home,
      cwd,
      patchFile,
      profileName: `fde-exit-${process.pid}`,
      startTimeoutMs: 20_000,
    })
    core.bin = fakeHostPath
    const started = core.start().then(
      () => ({ settled: true, message: '' }),
      (error) => ({ settled: true, message: error instanceof Error ? error.message : String(error) }),
    )
    const ready = await Promise.race([
      readReady(readyPath, 60_000),
      started.then((result) => {
        throw new Error(result.message || 'connector start settled before pip was ready')
      }),
    ])
    const leaderPid = core.child?.pid
    const rows = await listProcesses()
    const leader = rows.find((row) => row.pid === leaderPid) || null
    const pip = rows.find((row) => row.pid === ready.pipPid) || null
    const host = rows.find((row) => row.pid === ready.hostPid) || null
    report.leaderPid = leaderPid ?? null
    report.hostPid = ready.hostPid
    report.leaderPgid = leader?.pgid ?? null
    report.pipBefore = pip
      ? { pid: pip.pid, ppid: pip.ppid, pgid: pip.pgid, sid: pip.sid, stat: pip.stat }
      : null
    report.hostBefore = host
      ? { pid: host.pid, ppid: host.ppid, pgid: host.pgid, stat: host.stat }
      : null
    report.inGroup = Boolean(
      pip
      && leader
      && !String(pip.stat).includes('Z')
      && pip.pgid === leader.pgid
      && leader.pgid === leader.pid
      && leader.pid > 1,
    )
    if (!report.inGroup) {
      throw new Error(`pip was not running in the host group: ${JSON.stringify(report)}`)
    }
    if (mode === 'sigsegv') process.kill(ready.hostPid, 'SIGSEGV')
    else await writeFile(goPath, mode === 'code3' ? '3\n' : '0\n')
    const settled = await started
    report.message = settled.message
    const tracked = new Set([leaderPid, ready.hostPid, ready.pipPid].filter((pid) => Number.isInteger(pid)))
    const killedAt = Date.now()
    report.samples = await sampleTracked(tracked, leaderPid, ready.hostPid, ready.pipPid, PARENT_DEATH_DEADLINE_MS)
    report.judgment = judgeHostGroupWindow(report.samples)
    const emptyAt = report.samples.find((sample) => sample.rows.length === 0)
    report.elapsedMs = emptyAt ? emptyAt.tMs : Date.now() - killedAt
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (core) await core.stop().catch(() => {})
    await rm(home, { recursive: true, force: true }).catch(() => {})
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  report.ok = report.error == null
    && report.inGroup === true
    && report.message.includes(phrase)
    && report.judgment?.pass === true
    && report.elapsedMs != null
    && report.elapsedMs <= PARENT_DEATH_DEADLINE_MS
  if (options.out) {
    const { mkdir: mkdirOut, writeFile: writeOut } = await import('node:fs/promises')
    await mkdirOut(dirname(options.out), { recursive: true })
    await writeOut(options.out, `${JSON.stringify(report, null, 2)}\n`)
  }
  return report
}
