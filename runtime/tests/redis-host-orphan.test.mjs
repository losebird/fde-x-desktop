import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile, execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, readlinkSync, readdirSync, realpathSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, test, after } from 'node:test'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const repoRoot = join(import.meta.dirname, '../..')
const hostGroupPath = fileURLToPath(new URL('../host-group.mjs', import.meta.url))
const bundleDir = process.env.FDE_STD_BUNDLE || '/cursor/stores/bot/std-bundle-2026-10-19'
const snapshot = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS || ''
const REQUIREMENTS = join(repoRoot, 'runtime/data/semantic-os/runtime/0.1.1/darwin-arm64/resolved-requirements.txt')
const SURVIVE_WINDOW_MS = 4000
const CLOSE_LITE_BOUND_S = 2

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

const lanSnapshot = process.env.FDE_PLUGIN_DSH_LAN_ASSIST || ''

function gitHead(dir) {
  if (!dir) return ''
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

console.log(`# plugin-sources ${sha256File(join(bundleDir, 'plugin-sources-2026-10-19.tar.gz'))}`)
console.log(`# iui ${sha256File(join(bundleDir, 'iui-77c23c7c3e9cfc991e0bed9fb44b0a4ea66fd57c.tar.gz'))}`)
console.log(`# semantic-os ${snapshot} ${gitHead(snapshot)}`)
console.log(`# lan-assist ${lanSnapshot} ${gitHead(lanSnapshot)}`)

function pinnedRequirement(name) {
  const prefix = `${name}==`.toLowerCase()
  const line = readFileSync(REQUIREMENTS, 'utf8')
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(prefix))
  assert.ok(line, `runtime pin missing: ${name}`)
  return line
}

const INSTALL_SPECS = [
  pinnedRequirement('falkordblite'),
  pinnedRequirement('FalkorDB'),
  pinnedRequirement('redis'),
  pinnedRequirement('psutil'),
]

let suiteRoot = ''
let python = ''
let pythonReady = null

const INNER_HOST = `
import { spawn } from 'node:child_process'
const child = spawn(process.argv[2], process.argv.slice(3), { stdio: 'inherit' })
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0))
})
setInterval(() => {}, 1 << 30)
`.trim()

const SIDECAR = `
import os, signal, sys
os.environ["DSH_HOME"] = sys.argv[1]
sys.path.insert(0, sys.argv[2])
import stores

def _stop(_signum, _frame):
    stores.close_lite()
    raise SystemExit(0)

signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)
db = stores._open_lite()
db.select_graph("dsh_ping").query("RETURN 1")
client = db.client
pid = int(client.pid)
print(f"READY {pid} {os.getpgid(pid)} {os.getpgrp()} {os.getpid()} {os.getppid()}", flush=True)
signal.pause()
`.trim()

const SOCKET_HOLDER = `
import sys
import redis
client = redis.Redis(unix_socket_path=sys.argv[1])
client.ping()
print("held", flush=True)
sys.stdin.readline()
`.trim()

const CLOSE_LITE = `
import json, os, sys, time
os.environ.pop("FDE_DSH_HOME", None)
os.environ["DSH_HOME"] = sys.argv[1]
sys.path.insert(0, sys.argv[2])
mode = sys.argv[3]
import stores
db = stores._open_lite()
graph = db.select_graph("dsh_ping")
graph.query("CREATE (:Probe {n: 7})")
rows = graph.query("MATCH (p:Probe) RETURN p.n").result_set
client = db.client
retry = client.get_retry()
before = None if retry is None else retry.get_retries()
backoff = None if retry is None else type(retry._backoff).__name__
pid = int(client.pid)
holder = None
held = ""
if mode == "holder":
    import subprocess
    holder = subprocess.Popen(
        [sys.executable, sys.argv[4], client.socket_file],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
    )
    held = holder.stdout.readline().strip()
started = time.perf_counter()
stores.close_lite()
elapsed = time.perf_counter() - started
again = client.get_retry()
after = None if again is None else again.get_retries()
backoff_after = None if again is None else type(again._backoff).__name__
alive = os.path.exists(f"/proc/{pid}")
if holder is not None:
    holder.kill()
    holder.wait(timeout=2)
print(json.dumps({
    "elapsed_s": elapsed,
    "retries_before": before,
    "retries_after": after,
    "backoff_before": backoff,
    "backoff_after": backoff_after,
    "rows": rows,
    "pid": pid,
    "alive": alive,
    "held": held,
}))
`.trim()

const HOLD_OPEN = `
import json, os, sys
os.environ["DSH_HOME"] = sys.argv[1]
sys.path.insert(0, sys.argv[2])
import stores

db = stores._open_lite()
pid = int(db.client.pid)
print(json.dumps({"pid": pid}), flush=True)
sys.stdin.readline()
`.trim()

const OPEN_PY = `
import json, os, sys, time, traceback
os.environ["DSH_HOME"] = sys.argv[1]
sys.path.insert(0, sys.argv[2])
try:
    import stores
    started = time.monotonic()
    db = stores._open_lite()
    elapsed = time.monotonic() - started
    result = db.select_graph("dsh_ping").query("RETURN 1")
    rows = getattr(result, "result_set", None)
    client = db.client
    pid = int(client.pid)
    daemonize = ""
    try:
        config = client.redis_configuration or ""
    except Exception:
        config = ""
    for line in config.splitlines():
        if line.startswith("daemonize "):
            daemonize = line.split(" ", 1)[1].strip()
    try:
        log = client.redis_log or ""
    except Exception:
        log = ""
    import psutil
    proc = psutil.Process(pid)
    owner = ""
    owner_path = stores.lite_db_path().parent / (stores.lite_db_path().name + ".owner.json")
    if owner_path.is_file():
        owner = owner_path.read_text()
    print(json.dumps({
        "pid": pid,
        "pgid": os.getpgid(pid),
        "pgrp": os.getpgrp(),
        "ppid": proc.ppid(),
        "python": os.getpid(),
        "elapsed": elapsed,
        "daemonize": daemonize,
        "module_loaded": ("graph" in log.lower()),
        "rows": rows,
        "query_ok": json.dumps(rows, default=str).find("1") >= 0,
        "owner": owner,
    }), flush=True)
except Exception:
    traceback.print_exc()
    raise SystemExit(1)
`.trim()

const BYSTANDER_PY = `
import atexit, json, os, sys, subprocess
os.environ["DSH_HOME"] = sys.argv[1]
sys.path.insert(0, sys.argv[2])
import stores

procs = []
def spawn_sleeper():
    proc = subprocess.Popen([sys.executable, "-c", "import signal\\nsignal.pause()\\n"])
    procs.append(proc)
    return proc
def _stop_sleepers():
    for proc in procs:
        if proc.poll() is None:
            proc.kill()
atexit.register(_stop_sleepers)

def record_for(pid, mark, exe, db_path, **over):
    cmdline, start = mark
    body = {
        "pid": int(pid),
        "cmdline": list(cmdline),
        "start": stores._start_token(start),
        "exe": exe,
        "db": str(db_path.resolve()),
        "sidecar_pid": 2 ** 30,
        "sidecar_start": "no-such",
        "sidecar_cmdline": ["no-such"],
    }
    body.update(over)
    return body

def write(db, body):
    path = stores._owner_file(db)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(body))

db = stores.lite_db_path()
db.parent.mkdir(parents=True, exist_ok=True)
proc = spawn_sleeper()
mark = stores._read_identity(proc.pid)
exe = stores._exe_path(proc.pid)
if mark is None or mark is stores._UNREAD or not exe:
    raise SystemExit(f"sleeper identity unread {mark!r} {exe!r}")
cmdline, start = mark
token = stores._start_token(start)
owner = stores._owner_file(db)
owner.write_text("{")
stores._reap_owner(db)
if proc.poll() is not None:
    raise SystemExit("corrupt record killed the bystander")
write(db, record_for(proc.pid, mark, exe, db, start=token + "-shifted"))
stores._reap_owner(db)
if proc.poll() is not None:
    raise SystemExit("shifted starttime killed the bystander")
write(db, record_for(proc.pid, mark, exe, db, cmdline=["not-the-sleeper"]))
stores._reap_owner(db)
if proc.poll() is not None:
    raise SystemExit("foreign cmdline killed the bystander")
write(db, record_for(proc.pid, mark, exe, db, db=str(db.resolve()) + ".other"))
stores._reap_owner(db)
if proc.poll() is not None:
    raise SystemExit("other profile killed the bystander")
side = stores._read_identity(os.getpid())
if side is None or side is stores._UNREAD:
    raise SystemExit("sidecar identity unread")
side_cmd, side_start = side
write(db, record_for(
    proc.pid, mark, exe, db,
    sidecar_pid=os.getpid(),
    sidecar_start=stores._start_token(side_start),
    sidecar_cmdline=list(side_cmd),
))
stores._reap_owner(db)
if proc.poll() is not None:
    raise SystemExit("live sidecar did not protect the recorded pid")
write(db, record_for(proc.pid, mark, exe, db))
saved_name = os.name
os.name = "nt"
try:
    stores._reap_owner(db)
finally:
    os.name = saved_name
if proc.poll() is not None:
    raise SystemExit("windows reap killed the bystander")
write(db, record_for(proc.pid, mark, exe, db))
stores._reap_owner(db)
if proc.poll() is None:
    raise SystemExit("matching record did not reap")
real_isdir = os.path.isdir
def hide(path):
    try:
        if os.fspath(path) == "/proc":
            return False
    except (TypeError, ValueError):
        pass
    return real_isdir(path)
os.path.isdir = hide
proc2 = spawn_sleeper()
mark2 = stores._read_identity(proc2.pid)
exe2 = stores._exe_path(proc2.pid)
if mark2 is None or mark2 is stores._UNREAD or not exe2:
    raise SystemExit(f"psutil identity unread {mark2!r} {exe2!r}")
cmd2, start2 = mark2
token2 = stores._start_token(start2)
write(db, record_for(proc2.pid, mark2, exe2, db, start=token2 + "-x", cmdline=list(cmd2)))
stores._reap_owner(db)
if proc2.poll() is not None:
    raise SystemExit("psutil start mismatch killed the bystander")
write(db, record_for(proc2.pid, mark2, exe2, db, cmdline=["other-argv"], start=token2))
stores._reap_owner(db)
if proc2.poll() is not None:
    raise SystemExit("psutil cmdline mismatch killed the bystander")
write(db, record_for(proc2.pid, mark2, exe2, db))
stores._reap_owner(db)
if proc2.poll() is None:
    raise SystemExit("psutil identity did not reap")
print("SAFE ok", flush=True)
`.trim()

function pinnedLine(name) {
  return pinnedRequirement(name)
}

function readIdent(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const raw = readFileSync(`/proc/${pid}/cmdline`)
    const rest = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)
    if (!rest.length || rest[0] === 'Z' || rest[0] === 'X') return null
    const cmdline = raw.toString().split('\0').filter(Boolean)
    if (!cmdline || rest.length <= 19) return 'unread'
    let exe = ''
    try { exe = readlinkSync(`/proc/${pid}/exe`) } catch { exe = '' }
    return {
      cmdline,
      start: rest[19],
      pgid: Number(rest[2]),
      ppid: Number(rest[1]),
      exe,
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    return 'unread'
  }
}

function waitMatch(child, pattern, timeoutMs) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`timeout\n${stdout}\n${stderr}`))
    }, timeoutMs)
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(value)
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      const match = stdout.match(pattern)
      if (match) finish(null, { match, stdout, stderr })
    })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.once('exit', (code) => {
      const match = stdout.match(pattern)
      if (match) finish(null, { match, stdout, stderr, code })
      else finish(new Error(`exit ${code}\n${stdout}\n${stderr}`))
    })
    child.once('error', (error) => finish(error))
  })
}

function runPython(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, { env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.once('error', reject)
    child.once('exit', (code) => resolve({ code, stdout, stderr }))
  })
}

async function ensurePython() {
  if (!pythonReady) pythonReady = createPython()
  return pythonReady
}

async function createPython() {
  suiteRoot = await mkdtemp(join(tmpdir(), 'fde-host-orphan-'))
  const venv = join(suiteRoot, 'venv')
  await execFileAsync('python3', ['-m', 'venv', venv], { timeout: 60_000 })
  await execFileAsync(join(venv, 'bin', 'pip'), ['install', '-q', ...INSTALL_SPECS], { timeout: 180_000 })
  python = join(venv, 'bin', 'python')
  return python
}

async function materializePlugin() {
  assert.ok(snapshot, 'FDE_PLUGIN_DSH_SEMANTIC_OS is required')
  assert.ok(existsSync(join(snapshot, 'python', 'stores.py')), 'semantic-os python/stores.py is required')
  const dest = await mkdtemp(join(suiteRoot, 'plugin-'))
  const { cp } = await import('node:fs/promises')
  await cp(join(snapshot, 'python'), join(dest, 'python'), { recursive: true })
  await cp(join(repoRoot, 'runtime/vendor-overlays/dsh-semantic-os'), dest, { recursive: true, force: true })
  return join(dest, 'python')
}

async function waitGone(pid, start, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = readIdent(pid)
  while (Date.now() < deadline) {
    last = readIdent(pid)
    if (last == null) return { gone: true, last }
    if (last !== 'unread' && last.start !== start) return { gone: true, last }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return { gone: false, last }
}

function killPid(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return
  try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ }
}

function killGroup(pgid) {
  if (!Number.isInteger(pgid) || pgid <= 1) return
  try { process.kill(-pgid, 'SIGKILL') } catch { /* already gone */ }
}

function releaseLeader(leader) {
  leader.stdout?.destroy()
  leader.stderr?.destroy()
  leader.stdin?.destroy()
  leader.unref()
}

async function startStack(home, pythonDir, spyPath) {
  const inner = join(home, 'inner-host.mjs')
  const sidecar = join(home, 'sidecar.py')
  await writeFile(inner, `${INNER_HOST}\n`)
  await writeFile(sidecar, `${SIDECAR}\n`)
  const leader = spawn(process.execPath, [
    hostGroupPath, process.execPath, inner, python, sidecar, home, pythonDir,
  ], {
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DSH_HOME: home,
      PYTHONPATH: pythonDir,
      FDE_REDIS_SHUTDOWN_SPY: spyPath,
    },
  })
  leader.stdin.on('error', () => {})
  leader.unref()
  const found = await waitMatch(leader, /READY (\d+) (\d+) (\d+) (\d+) (\d+)/, 60_000)
  return {
    leader,
    redisPid: Number(found.match[1]),
    redisPgid: Number(found.match[2]),
    pythonPgrp: Number(found.match[3]),
    pythonPid: Number(found.match[4]),
    hostPid: Number(found.match[5]),
    stdout: found.stdout,
  }
}

async function openLite(home, pythonDir) {
  const script = join(home, `open-${process.pid}-${Date.now()}.py`)
  await writeFile(script, `${OPEN_PY}\n`)
  const ran = await runPython([script, home, pythonDir], {
    ...process.env,
    DSH_HOME: home,
    PYTHONPATH: pythonDir,
  })
  if (ran.code !== 0) {
    throw new Error(`open failed ${ran.code}\n${ran.stdout}\n${ran.stderr}`)
  }
  return JSON.parse(ran.stdout.trim().split('\n').pop())
}

function dbPaths(home) {
  const db = join(home, 'semantic-os', 'falkordb', 'graph.db')
  return { db, owner: `${db}.owner.json` }
}

function dbHolders(dbPath) {
  let real = ''
  try { real = realpathSync(dbPath) } catch { return [] }
  const hits = []
  let names = []
  try { names = readdirSync('/proc') } catch { return hits }
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue
    const pid = Number(name)
    let exe = ''
    try { exe = readlinkSync(`/proc/${pid}/exe`) } catch { continue }
    if (!exe.includes('redis-server')) continue
    let fds = []
    try { fds = readdirSync(`/proc/${pid}/fd`) } catch { continue }
    for (const fd of fds) {
      let target = ''
      try { target = readlinkSync(`/proc/${pid}/fd/${fd}`) } catch { continue }
      if (target === real) hits.push({ pid, fd })
    }
  }
  return hits
}

function psAlive(fragment) {
  const text = execFileSync('ps', ['-eo', 'pid=,stat=,args='], { encoding: 'utf8' })
  const rows = []
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+(.*)$/)
    if (!match || match[2].includes('Z') || !match[3].includes(fragment)) continue
    rows.push(`${match[1]} ${match[2]} ${match[3]}`)
  }
  return rows
}

function redisRelated(home, newPid) {
  const rows = []
  let names = []
  try { names = readdirSync('/proc') } catch { return rows }
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue
    const pid = Number(name)
    let exe = ''
    try { exe = readlinkSync(`/proc/${pid}/exe`) } catch { continue }
    if (!exe.includes('redis-server')) continue
    let cwd = ''
    let cmdline = ''
    try { cwd = readlinkSync(`/proc/${pid}/cwd`) } catch { cwd = '' }
    try { cmdline = readFileSync(`/proc/${pid}/cmdline`).toString().replaceAll('\0', ' ') } catch { cmdline = '' }
    const fds = []
    try {
      for (const fd of readdirSync(`/proc/${pid}/fd`)) {
        try { fds.push(readlinkSync(`/proc/${pid}/fd/${fd}`)) } catch { /* raced */ }
      }
    } catch { /* already gone */ }
    const blob = `${cwd}\n${cmdline}\n${fds.join('\n')}`
    if (pid === newPid || blob.includes(home)) rows.push({ pid, cwd, cmdline, fds })
  }
  return rows
}

function liveRedisUnder(root) {
  const pids = []
  let names = []
  try { names = readdirSync('/proc') } catch { return pids }
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue
    try {
      const exe = readlinkSync(`/proc/${name}/exe`)
      if (exe.startsWith(root) && exe.includes('redis-server')) pids.push(Number(name))
    } catch { /* raced */ }
  }
  return pids
}

async function killSuiteRedis() {
  if (!suiteRoot) return
  let names = []
  try { names = readdirSync('/proc') } catch { return }
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue
    try {
      const exe = readlinkSync(`/proc/${name}/exe`)
      if (exe.startsWith(suiteRoot) && exe.includes('redis-server')) killPid(Number(name))
    } catch { /* raced */ }
  }
}

describe('host redis orphan', { concurrency: false }, () => {
  after(async () => {
    await killSuiteRedis()
    if (suiteRoot) await rm(suiteRoot, { recursive: true, force: true })
    suiteRoot = ''
    python = ''
  })

  test('falkordblite 0.10.0 redislite is the runtime pin', { timeout: 180_000 }, async () => {
    await ensurePython()
    const script = join(suiteRoot, 'origin.py')
    await writeFile(script, [
      'import importlib.metadata as metadata, json',
      'from pathlib import Path',
      'import redislite',
      'def dist_version(name):',
      '    try: return metadata.version(name)',
      '    except metadata.PackageNotFoundError: return None',
      'version = dist_version("falkordblite")',
      'owned = False',
      'try:',
      '    dist = metadata.distribution("falkordblite")',
      '    root = Path(dist.locate_file("")).resolve()',
      '    files = [str(path) for path in (dist.files or [])]',
      '    module = Path(redislite.__file__).resolve()',
      '    owned = module.is_relative_to(root) and "redislite/__init__.py" in files',
      'except metadata.PackageNotFoundError:',
      '    owned = False',
      'print(json.dumps({',
      '    "falkordblite": version,',
      '    "falkordb": dist_version("FalkorDB"),',
      '    "redis": dist_version("redis"),',
      '    "psutil": dist_version("psutil"),',
      '    "redislite_file": redislite.__file__,',
      '    "owned_by_falkordblite": owned,',
      '    "separate_redislite_dist": dist_version("redislite"),',
      '}))',
    ].join('\n'))
    const ran = await runPython([script], { ...process.env })
    assert.equal(ran.code, 0, ran.stderr || ran.stdout)
    const body = JSON.parse(ran.stdout.trim().split('\n').pop())
    console.log(`# falkordblite ${body.falkordblite}`)
    console.log(`# FalkorDB ${body.falkordb}`)
    console.log(`# redis ${body.redis}`)
    console.log(`# psutil ${body.psutil}`)
    console.log(`# redislite.__file__ ${body.redislite_file}`)
    assert.equal(body.owned_by_falkordblite, true, JSON.stringify(body))
    assert.equal(body.separate_redislite_dist, null, JSON.stringify(body))
    assert.equal(body.falkordblite, '0.10.0', JSON.stringify(body))
    assert.equal(body.falkordb, '1.7.1', JSON.stringify(body))
    assert.equal(body.redis, '8.1.0', JSON.stringify(body))
    assert.equal(body.psutil, '7.2.2', JSON.stringify(body))
    assert.equal(pinnedLine('falkordblite'), 'falkordblite==0.10.0')
    assert.equal(pinnedLine('FalkorDB'), 'FalkorDB==1.7.1')
    assert.equal(pinnedLine('redis'), 'redis==8.1.0')
    assert.equal(pinnedLine('psutil'), 'psutil==7.2.2')
  })

  test('foreground FalkorDBLite stays in the host group and answers GRAPH.QUERY', { timeout: 90_000 }, async () => {
    await ensurePython()
    const pythonDir = await materializePlugin()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const body = await openLite(home, pythonDir)
    assert.equal(body.daemonize, 'no', JSON.stringify(body))
    assert.equal(body.module_loaded, true, JSON.stringify(body))
    assert.equal(body.query_ok, true, JSON.stringify(body))
    assert.ok(body.elapsed < 15, JSON.stringify(body))
    assert.equal(body.pgid, body.pgrp, JSON.stringify(body))
    assert.equal(body.ppid, body.python, JSON.stringify(body))
    assert.notEqual(body.pgid, body.pid, JSON.stringify(body))
  })

  test('SIGKILL of the inner host removes redis', { timeout: 90_000 }, async () => {
    await signalCase('SIGKILL', 'host')
  })

  test('SIGTERM of the inner host removes redis', { timeout: 90_000 }, async () => {
    const spy = await signalCase('SIGTERM', 'host')
    assert.match(spy, /close_lite/, spy)
  })

  test('SIGKILL of the host-group leader removes redis', { timeout: 90_000 }, async () => {
    const spy = await signalCase('SIGKILL', 'leader')
    assert.match(spy, /leader-death/, spy)
  })

  test('a broken host-group pipe does not leave redis holding graph.db', { timeout: 120_000 }, async () => {
    await ensurePython()
    const pythonDir = await materializePlugin()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const spyPath = join(home, 'spy.txt')
    await writeFile(spyPath, '')
    const stack = await startStack(home, pythonDir, spyPath)
    const before = readIdent(stack.redisPid)
    try {
      assert.ok(before && before !== 'unread', JSON.stringify(before))
      stack.leader.stdin.end()
      const watched = await waitGone(stack.redisPid, before.start, SURVIVE_WINDOW_MS)
      assert.equal(watched.gone, true, JSON.stringify({ before, watched }))
      const opened = await openLite(home, pythonDir)
      assert.equal(opened.query_ok, true, JSON.stringify(opened))
      assert.notEqual(opened.pid, stack.redisPid, JSON.stringify(opened))
      assert.equal(opened.pgid, opened.pgrp, JSON.stringify(opened))
      const old = readIdent(stack.redisPid)
      assert.equal(old, null, JSON.stringify(old))
    } finally {
      killPid(stack.redisPid)
      killGroup(stack.leader.pid)
      killPid(stack.leader.pid)
      killPid(stack.hostPid)
      killPid(stack.pythonPid)
      releaseLeader(stack.leader)
    }
  })

  test('a later open reaps the recorded redis and replaces the record', { timeout: 120_000 }, async () => {
    await ensurePython()
    const pythonDir = await materializePlugin()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const { db, owner } = dbPaths(home)
    await writeFile(join(home, 'hold.py'), [
      'import sys',
      'from redislite import Redis',
      'db = Redis(sys.argv[1])',
      'print(f"HOLD {int(db.pid)}", flush=True)',
      'import signal',
      'signal.pause()',
    ].join('\n'))
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(home, 'semantic-os', 'falkordb'), { recursive: true })
    const holder = spawn(python, [join(home, 'hold.py'), db], { stdio: ['ignore', 'pipe', 'pipe'] })
    let redisPid = 0
    try {
      const found = await waitMatch(holder, /HOLD (\d+)/, 60_000)
      redisPid = Number(found.match[1])
      const ident = readIdent(redisPid)
      assert.ok(ident && ident !== 'unread' && ident.exe, JSON.stringify(ident))
      const dbReal = resolve(db)
      await writeFile(owner, JSON.stringify({
        pid: redisPid,
        cmdline: ident.cmdline,
        start: ident.start,
        exe: ident.exe,
        db: dbReal,
        sidecar_pid: 2 ** 30,
        sidecar_start: 'no-such',
        sidecar_cmdline: ['no-such'],
      }))
      const opened = await openLite(home, pythonDir)
      const after = readIdent(redisPid)
      assert.equal(after, null, JSON.stringify({ ident, after, opened }))
      const saved = JSON.parse(await readFile(owner, 'utf8'))
      assert.equal(saved.pid, opened.pid, JSON.stringify(saved))
      assert.notEqual(saved.pid, redisPid)
      assert.equal(opened.query_ok, true, JSON.stringify(opened))
    } finally {
      killPid(redisPid)
      try { holder.kill('SIGKILL') } catch { /* already gone */ }
    }
  })

  test('a bad owner record does not kill a bystander', { timeout: 90_000 }, async () => {
    await ensurePython()
    const pythonDir = await materializePlugin()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const script = join(home, 'bystander.py')
    await writeFile(script, `${BYSTANDER_PY}\n`)
    const ran = await runPython([script, home, pythonDir], {
      ...process.env,
      DSH_HOME: home,
      PYTHONPATH: pythonDir,
    })
    assert.equal(ran.code, 0, ran.stderr || ran.stdout)
    assert.match(ran.stdout, /SAFE ok/)
  })

  test('close_lite returns before the retry budget with the default retry intact', { timeout: 60_000 }, async () => {
    await ensurePython()
    const pythonDir = await materializePlugin()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const script = join(home, 'close-lite.py')
    await writeFile(script, `${CLOSE_LITE}\n`)
    const ran = await runPython([script, home, pythonDir, 'none'], {
      ...process.env,
      DSH_HOME: home,
      PYTHONPATH: pythonDir,
    })
    assert.equal(ran.code, 0, ran.stderr || ran.stdout)
    const payload = JSON.parse(ran.stdout)
    console.log(`# close_lite none ${JSON.stringify(payload)}`)
    assert.deepEqual(payload.rows, [[7]])
    assert.equal(payload.retries_before, 10)
    assert.equal(payload.retries_after, 10)
    assert.equal(payload.backoff_before, 'ExponentialWithJitterBackoff')
    assert.equal(payload.backoff_after, 'ExponentialWithJitterBackoff')
    assert.equal(payload.alive, false, JSON.stringify(payload))
    assert.ok(payload.elapsed_s < CLOSE_LITE_BOUND_S, `close_lite took ${payload.elapsed_s}s`)
    assert.deepEqual(liveRedisUnder(suiteRoot), [])
  })

  test('close_lite with a second client returns before the retry budget', { timeout: 60_000 }, async () => {
    await ensurePython()
    const pythonDir = await materializePlugin()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const script = join(home, 'close-lite.py')
    const holderPath = join(home, 'holder.py')
    await writeFile(script, `${CLOSE_LITE}\n`)
    await writeFile(holderPath, `${SOCKET_HOLDER}\n`)
    const ran = await runPython([script, home, pythonDir, 'holder', holderPath], {
      ...process.env,
      DSH_HOME: home,
      PYTHONPATH: pythonDir,
    })
    assert.equal(ran.code, 0, ran.stderr || ran.stdout)
    const payload = JSON.parse(ran.stdout)
    console.log(`# close_lite holder ${JSON.stringify(payload)}`)
    assert.equal(payload.held, 'held')
    assert.deepEqual(payload.rows, [[7]])
    assert.equal(payload.retries_before, 10)
    assert.equal(payload.retries_after, 10)
    assert.equal(payload.backoff_after, 'ExponentialWithJitterBackoff')
    assert.equal(payload.alive, false, JSON.stringify(payload))
    assert.ok(payload.elapsed_s < CLOSE_LITE_BOUND_S, `close_lite took ${payload.elapsed_s}s`)
    assert.deepEqual(liveRedisUnder(suiteRoot), [])
  })

  test('a pipe break leaves the new lite as the only graph.db holder', { timeout: 120_000 }, async () => {
    await ensurePython()
    const pythonDir = await materializePlugin()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const spyPath = join(home, 'spy.txt')
    await writeFile(spyPath, '')
    const stack = await startStack(home, pythonDir, spyPath)
    const before = readIdent(stack.redisPid)
    const holderPath = join(home, 'hold-open.py')
    await writeFile(holderPath, `${HOLD_OPEN}\n`)
    let holder = null
    let newPid = 0
    try {
      assert.ok(before && before !== 'unread', JSON.stringify(before))
      stack.leader.stdin.end()
      const watched = await waitGone(stack.redisPid, before.start, SURVIVE_WINDOW_MS)
      assert.equal(watched.gone, true, JSON.stringify({ before, watched, spy: readFileSync(spyPath, 'utf8') }))
      const leaderBefore = readIdent(stack.leader.pid)
      const hostBefore = readIdent(stack.hostPid)
      const leaderStart = leaderBefore && leaderBefore !== 'unread' ? leaderBefore.start : ''
      const hostStart = hostBefore && hostBefore !== 'unread' ? hostBefore.start : ''
      const leaderGone = await waitGone(stack.leader.pid, leaderStart, SURVIVE_WINDOW_MS)
      const hostGone = await waitGone(stack.hostPid, hostStart, SURVIVE_WINDOW_MS)
      assert.equal(leaderGone.gone, true, JSON.stringify(leaderGone))
      assert.equal(hostGone.gone, true, JSON.stringify(hostGone))
      holder = spawn(python, [holderPath, home, pythonDir], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DSH_HOME: home, PYTHONPATH: pythonDir },
      })
      holder.stdin.on('error', () => {})
      const found = await waitMatch(holder, /"pid":\s*(\d+)/, 60_000)
      newPid = Number(found.match[1])
      const { db, owner } = dbPaths(home)
      const hits = dbHolders(db)
      const related = redisRelated(home, newPid)
      console.log(`# graph.db fd holders ${JSON.stringify(hits)}`)
      console.log(`# redis related ${JSON.stringify(related)}`)
      assert.deepEqual([...new Set(hits.map((hit) => hit.pid))], hits.length ? [newPid] : [], JSON.stringify(hits))
      assert.deepEqual(related.map((row) => row.pid), [newPid], JSON.stringify(related))
      assert.equal(related[0].cwd, join(home, 'semantic-os', 'falkordb'), JSON.stringify(related[0]))
      const saved = JSON.parse(await readFile(owner, 'utf8'))
      assert.equal(saved.pid, newPid, JSON.stringify(saved))
      assert.equal(saved.db, resolve(db), JSON.stringify(saved))
      assert.equal(readIdent(stack.redisPid), null, 'old redis still alive')
      const redisStart = related[0] && related[0].pid === newPid ? readIdent(newPid) : null
      killPid(newPid)
      try { holder.kill('SIGKILL') } catch { /* already gone */ }
      const redisGone = await waitGone(newPid, redisStart && redisStart !== 'unread' ? redisStart.start : '', SURVIVE_WINDOW_MS)
      assert.equal(redisGone.gone, true, JSON.stringify(redisGone))
      const redisLeft = liveRedisUnder(suiteRoot)
      const hostLeft = [
        ...psAlive('host-group.mjs'),
        ...psAlive('inner-host.mjs'),
        ...psAlive('hold-open.py'),
      ].filter((line) => line.includes(home))
      console.log(`# ps redis ${JSON.stringify(redisLeft)}`)
      console.log(`# ps host ${JSON.stringify(hostLeft)}`)
      assert.deepEqual(redisLeft, [])
      assert.deepEqual(hostLeft, [])
    } finally {
      if (holder) {
        try { holder.kill('SIGKILL') } catch { /* already gone */ }
      }
      killPid(newPid)
      killPid(stack.redisPid)
      killGroup(stack.leader.pid)
      killPid(stack.leader.pid)
      killPid(stack.hostPid)
      killPid(stack.pythonPid)
      holder?.stdout?.destroy()
      holder?.stderr?.destroy()
      holder?.unref()
      releaseLeader(stack.leader)
    }
  })
})

async function signalCase(signalName, target) {
  await ensurePython()
  const pythonDir = await materializePlugin()
  const home = await mkdtemp(join(suiteRoot, 'home-'))
  const spyPath = join(home, 'spy.txt')
  await writeFile(spyPath, '')
  const stack = await startStack(home, pythonDir, spyPath)
  const before = readIdent(stack.redisPid)
  try {
    assert.ok(before && before !== 'unread', JSON.stringify(before))
    const pid = target === 'leader' ? stack.leader.pid : stack.hostPid
    process.kill(pid, signalName)
    const watched = await waitGone(stack.redisPid, before.start, SURVIVE_WINDOW_MS)
    assert.equal(watched.gone, true, JSON.stringify({
      signal: signalName,
      target,
      before,
      watched,
      spy: existsSync(spyPath) ? readFileSync(spyPath, 'utf8') : '',
    }))
    return readFileSync(spyPath, 'utf8')
  } finally {
    killPid(stack.redisPid)
    killGroup(stack.leader.pid)
    killPid(stack.leader.pid)
    killPid(stack.hostPid)
    killPid(stack.pythonPid)
    releaseLeader(stack.leader)
  }
}
