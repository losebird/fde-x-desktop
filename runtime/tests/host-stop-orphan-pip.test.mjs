import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  } catch {}
  return false
}

async function semanticaPips(home) {
  const rows = []
  for (const row of await listProcesses()) {
    if (!isSemanticaPip(row)) continue
    if (!(await processOwnsHome(row.pid, home))) continue
    rows.push(row)
  }
  return rows
}

async function processRow(pid) {
  const rows = await listProcesses()
  return rows.find((row) => row.pid === pid) || null
}

async function ensurePeerResources() {
  const generation = join(import.meta.dirname, '..', '.host-generation', 'node_modules', '@deepseek-ai')
  const root = join(tmpdir(), `fde-orphan-resources-${process.pid}`)
  const dest = join(root, 'dsh', 'node_modules', '@deepseek-ai')
  await mkdir(dest, { recursive: true })
  for (const name of ['schemastery', 'dsh-tools', 'dsh-llm']) {
    const source = join(generation, name)
    assert.ok(existsSync(join(source, 'package.json')), `generation host is missing ${name}`)
    const link = join(dest, name)
    if (!existsSync(link)) await symlink(source, link)
  }
  process.env.FDE_RESOURCES = root
}

test('Host stop does not leave semantica pip reparented to pid 1', { timeout: 240_000 }, async () => {
  const semantic = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS || ''
  const lan = process.env.FDE_PLUGIN_DSH_LAN_ASSIST || ''
  assert.ok(semantic, 'FDE_PLUGIN_DSH_SEMANTIC_OS must point at the pinned semantic-os tree')
  assert.ok(lan, 'FDE_PLUGIN_DSH_LAN_ASSIST must point at the pinned lan-assist tree')
  const vendor = join(tmpdir(), `fde-orphan-vendor-${process.pid}`)
  await mkdir(vendor, { recursive: true })
  const previousVendor = process.env.FDE_VENDOR_DIR
  const previousResources = process.env.FDE_RESOURCES
  process.env.FDE_VENDOR_DIR = vendor
  await ensurePeerResources()
  process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = semantic
  process.env.FDE_PLUGIN_DSH_LAN_ASSIST = lan

  const { bootWorkflowHost } = await import('./support/workflow-host.mjs')
  let host = null
  const report = {
    label: 'host-stop-orphan-pip',
    connected: false,
    version: null,
    hostPid: null,
    hostAtStart: null,
    beforeKids: [],
    reparented: [],
    survivors: [],
    stopError: null,
    lastError: null,
    recentLogs: [],
  }
  try {
    const boot = bootWorkflowHost({ withPlugins: true })
    let live = []
    const started = Date.now()
    while (Date.now() - started < 150_000) {
      host = await Promise.race([
        boot.then((value) => ({ ready: value })),
        sleep(200).then(() => null),
      ])
      if (host?.ready) {
        const ready = host.ready
        host = ready
        report.connected = true
        report.version = ready.version
        report.hostPid = ready.core.child?.pid ?? null
        if (report.hostPid) report.hostAtStart = await processRow(report.hostPid)
        live = await semanticaPips(ready.home)
        if (live.length > 0) break
        const extraUntil = Date.now() + 20_000
        while (Date.now() < extraUntil) {
          live = await semanticaPips(ready.home)
          if (live.length > 0) break
          await sleep(200)
        }
        break
      }
    }
    if (!host?.core) throw new Error('真 Host 没有在时限内连上')
    report.beforeKids = live
    report.recentLogs = (host.core.logs || []).slice(-12)
    report.lastError = host.core.lastError || null
    const tracked = new Map(live.map((row) => [row.pid, row]))
    try {
      await host.core.stop()
    } catch (error) {
      report.stopError = error instanceof Error ? error.message : String(error)
    }
    const deadline = Date.now() + 1000
    const seen = new Map()
    do {
      for (const pid of tracked.keys()) {
        const row = await processRow(pid)
        if (row) seen.set(pid, row)
      }
      if ([...tracked.keys()].every((pid) => !seen.has(pid))) break
      await sleep(200)
    } while (Date.now() < deadline)
    report.survivors = [...seen.values()].filter((row) => !row.stat.includes('Z'))
    report.reparented = report.survivors.filter((row) => row.ppid === 1)
    const out = process.env.ORPHAN_PIP_OUT
    if (out) {
      await mkdir(dirname(out), { recursive: true })
      await writeFile(out, `${JSON.stringify(report, null, 2)}\n`)
    }
    assert.ok(report.beforeKids.length > 0, `did not observe semantica pip under the live host: ${JSON.stringify(report)}`)
    assert.deepEqual(report.reparented, [], `stop left semantica pip reparented to pid 1: ${JSON.stringify(report.reparented)}`)
    assert.deepEqual(report.survivors, [], `stop left semantica pip alive: ${JSON.stringify(report.survivors)}`)
  } finally {
    if (host?.home) {
      for (const row of await semanticaPips(host.home).catch(() => [])) {
        try { process.kill(row.pid, 'SIGKILL') } catch {}
      }
    }
    if (host) await host.stop().catch(() => {})
    if (previousVendor === undefined) delete process.env.FDE_VENDOR_DIR
    else process.env.FDE_VENDOR_DIR = previousVendor
    if (previousResources === undefined) delete process.env.FDE_RESOURCES
    else process.env.FDE_RESOURCES = previousResources
  }
})
