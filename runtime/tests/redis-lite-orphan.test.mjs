import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test, after } from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repoRoot = join(import.meta.dirname, '../..')
const snapshot = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS || ''
const REDISLITE_SPEC = 'redislite==6.2.912183'
const PSUTIL_SPEC = 'psutil==7.2.2'

let suiteRoot = ''
let python = ''

const pyPrelude = `
def identity(target):
    import psutil
    try:
        proc = psutil.Process(int(target))
    except psutil.NoSuchProcess:
        return {"status": "gone"}
    status = proc.status()
    if status == psutil.STATUS_ZOMBIE:
        return {"status": "zombie"}
    if status == "dead":
        return {"status": "dead"}
    cmdline = list(proc.cmdline())
    if not cmdline:
        return {"status": "unreadable"}
    return {
        "status": status,
        "cmdline": cmdline,
        "create_time": repr(proc.create_time()),
        "pgid": os.getpgid(int(target)),
    }

def hide_proc():
    real = os.path.isdir
    def _isdir(path):
        try:
            if os.fspath(path) == "/proc":
                return False
        except (TypeError, ValueError):
            pass
        return real(path)
    os.path.isdir = _isdir
`.trim()

function dead(obs) {
  return obs.status === 'gone' || obs.status === 'zombie' || obs.status === 'dead'
}

function live(obs) {
  return !dead(obs)
    && Array.isArray(obs.cmdline)
    && obs.cmdline.length > 0
    && typeof obs.create_time === 'string'
    && Number.isInteger(obs.pgid)
}

function sameIdentity(before, after) {
  return live(before)
    && live(after)
    && JSON.stringify(before.cmdline) === JSON.stringify(after.cmdline)
    && before.create_time === after.create_time
    && before.pgid === after.pgid
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

async function materializePlugin() {
  assert.ok(existsSync(join(snapshot, 'python', 'stores.py')), 'FDE_PLUGIN_DSH_SEMANTIC_OS python/stores.py is required')
  const dest = await mkdtemp(join(suiteRoot, 'plugin-'))
  await cp(join(snapshot, 'python'), join(dest, 'python'), { recursive: true })
  await cp(join(repoRoot, 'runtime/vendor-overlays/dsh-semantic-os'), dest, { recursive: true, force: true })
  return join(dest, 'python')
}

async function ensurePython() {
  if (python) return python
  suiteRoot = await mkdtemp(join(tmpdir(), 'fde-lite-orphan-'))
  const venv = join(suiteRoot, 'venv')
  await execFileAsync('python3', ['-m', 'venv', venv], { timeout: 60_000 })
  await execFileAsync(join(venv, 'bin', 'pip'), ['install', '-q', REDISLITE_SPEC, PSUTIL_SPEC], { timeout: 180_000 })
  python = join(venv, 'bin', 'python')
  const cli = join(suiteRoot, 'identity.py')
  await writeFile(cli, `import json, os, sys\n${pyPrelude}\nprint(json.dumps(identity(int(sys.argv[1]))))\n`)
  return python
}

async function observe(pid) {
  const ran = await runPython([join(suiteRoot, 'identity.py'), String(pid)], { ...process.env })
  assert.equal(ran.code, 0, ran.stderr || ran.stdout)
  return JSON.parse(ran.stdout.trim().split('\n').pop())
}

async function killPid(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return
  try { process.kill(pid, 'SIGKILL') } catch {}
}

async function waitPidFile(pidFile) {
  const started = Date.now()
  let pid = 0
  while (Date.now() - started < 5_000) {
    try {
      pid = Number(await readFile(pidFile, 'utf8'))
      if (pid > 1) return pid
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert.ok(pid > 1, 'process did not write its pid')
  return pid
}

async function startDecoy(home) {
  const script = [
    'import os, sys, time',
    'from redislite import Redis',
    'db = Redis(sys.argv[1])',
    'pid = int(db.pid)',
    'print(f"DECOY {pid} {os.getpgid(pid)}", flush=True)',
    'while True:',
    '    time.sleep(60)',
  ].join('\n')
  const file = join(home, 'decoy.py')
  await writeFile(file, script)
  const child = spawn(python, [file, join(home, 'decoy.db')], { stdio: ['ignore', 'pipe', 'pipe'] })
  const found = await waitMatch(child, /DECOY (\d+) (\d+)/, 20_000)
  return {
    child,
    pid: Number(found.match[1]),
    pgid: Number(found.match[2]),
  }
}

function multiSource() {
  return [
    'import json, os, sys',
    'os.environ["DSH_HOME"] = sys.argv[1]',
    'sys.path.insert(0, sys.argv[2])',
    'from redislite import Redis',
    'import stores',
    pyPrelude,
    'owned = Redis(sys.argv[3])',
    'extra = Redis(sys.argv[3])',
    'count = int(owned._connection_count())',
    'pid = int(owned.pid)',
    'class Db:',
    '    def __init__(self, client):',
    '        self.client = client',
    '    def close(self):',
    '        self.client._cleanup()',
    'stores._LITE_DB = Db(owned)',
    'if sys.argv[4] == "hide":',
    '    hide_proc()',
    '    if os.path.isdir("/proc"):',
    '        raise SystemExit("proc was not hidden")',
    'stores.close_lite()',
    'keep = id(extra)',
    'print(json.dumps({"count": count, "pid": pid, "identity": identity(pid), "keep": keep, "isdir_proc": os.path.isdir("/proc")}))',
  ].join('\n')
}

function reuseSource() {
  return [
    'import json, os, sys, time',
    'sys.path.insert(0, sys.argv[1])',
    'import stores',
    pyPrelude,
    'ready, go, waiter = sys.argv[2], sys.argv[3], sys.argv[4]',
    'hide = sys.argv[5] == "hide"',
    'pid = os.spawnv(os.P_NOWAIT, sys.executable, [sys.executable, waiter, ready, go])',
    'deadline = time.time() + 5',
    'while not os.path.exists(ready):',
    '    if time.time() > deadline:',
    '        raise SystemExit("waiter did not start")',
    '    time.sleep(0.01)',
    'before = identity(pid)',
    'class Client:',
    '    def __init__(self, pid):',
    '        self.pid = pid',
    '    def shutdown(self, **kwargs):',
    '        raise OSError("no server")',
    'class Db:',
    '    def __init__(self, pid):',
    '        self.client = Client(pid)',
    '    def close(self):',
    '        open(go, "w").close()',
    '        limit = time.time() + 5',
    '        while time.time() < limit:',
    '            found = identity(pid)',
    '            if found.get("status") == "gone":',
    '                raise SystemExit("pid disappeared during exec")',
    '            cmd = " ".join(found.get("cmdline") or [])',
    '            if "sleep(120)" in cmd:',
    '                return',
    '            time.sleep(0.01)',
    '        raise SystemExit("exec did not replace the command line")',
    'stores._LITE_DB = Db(pid)',
    'if hide:',
    '    hide_proc()',
    '    if os.path.isdir("/proc"):',
    '        raise SystemExit("proc was not hidden")',
    'stores.close_lite()',
    'after = identity(pid)',
    'print(json.dumps({"pid": pid, "before": before, "after": after, "isdir_proc": os.path.isdir("/proc")}))',
  ].join('\n')
}

function stubbornSource() {
  return [
    'import json, os, sys, time',
    'sys.path.insert(0, sys.argv[1])',
    'import stores',
    pyPrelude,
    'pid = int(sys.argv[2])',
    'hide = sys.argv[3] == "hide"',
    'class Client:',
    '    def __init__(self, pid):',
    '        self.pid = pid',
    '    def shutdown(self, **kwargs):',
    '        raise OSError("no server")',
    'class Db:',
    '    def __init__(self, pid):',
    '        self.client = Client(pid)',
    '    def close(self):',
    '        return None',
    'stores._LITE_DB = Db(pid)',
    'if hide:',
    '    hide_proc()',
    '    if os.path.isdir("/proc"):',
    '        raise SystemExit("proc was not hidden")',
    'started = time.monotonic()',
    'stores.close_lite()',
    'elapsed = time.monotonic() - started',
    'print(json.dumps({"pid": pid, "identity": identity(pid), "elapsed": round(elapsed, 3), "isdir_proc": os.path.isdir("/proc")}))',
  ].join('\n')
}

async function runOwned(hide) {
  await ensurePython()
  const home = await mkdtemp(join(suiteRoot, 'home-'))
  const pythonDir = await materializePlugin()
  const script = join(home, 'multi.py')
  await writeFile(script, multiSource())
  const ran = await runPython([script, home, pythonDir, join(home, 'owned.db'), hide ? 'hide' : 'show'], {
    ...process.env,
    DSH_HOME: home,
    PYTHONPATH: pythonDir,
  })
  assert.equal(ran.code, 0, ran.stderr || ran.stdout)
  const body = JSON.parse(ran.stdout.trim().split('\n').pop())
  try {
    assert.ok(body.count >= 2, JSON.stringify(body))
    assert.equal(dead(body.identity), true, JSON.stringify(body))
    if (hide) assert.equal(body.isdir_proc, false, JSON.stringify(body))
  } finally {
    await killPid(body.pid)
  }
  return body
}

async function runDecoy(hide) {
  await ensurePython()
  const home = await mkdtemp(join(suiteRoot, 'home-'))
  const pythonDir = await materializePlugin()
  const decoy = await startDecoy(home)
  const before = await observe(decoy.pid)
  const script = join(home, 'multi.py')
  await writeFile(script, multiSource())
  try {
    const ran = await runPython([script, home, pythonDir, join(home, 'owned.db'), hide ? 'hide' : 'show'], {
      ...process.env,
      DSH_HOME: home,
      PYTHONPATH: pythonDir,
    })
    assert.equal(ran.code, 0, ran.stderr || ran.stdout)
    const body = JSON.parse(ran.stdout.trim().split('\n').pop())
    const after = await observe(decoy.pid)
    const report = { owned: body, decoy: { pid: decoy.pid, pgidBefore: decoy.pgid, before, after } }
    assert.ok(body.count >= 2, JSON.stringify(report))
    assert.equal(dead(body.identity), true, JSON.stringify(report))
    assert.equal(sameIdentity(before, after), true, JSON.stringify(report))
    assert.equal(after.pgid, decoy.pgid, JSON.stringify(report))
    if (hide) assert.equal(body.isdir_proc, false, JSON.stringify(report))
    await killPid(body.pid)
    return report
  } finally {
    try { decoy.child.kill('SIGKILL') } catch {}
    await killPid(decoy.pid)
  }
}

async function runReuse(hide) {
  await ensurePython()
  const home = await mkdtemp(join(suiteRoot, 'home-'))
  const pythonDir = await materializePlugin()
  const waiter = join(home, 'waiter.py')
  await writeFile(waiter, [
    'import os, sys, time',
    'open(sys.argv[1], "w").close()',
    'while not os.path.exists(sys.argv[2]):',
    '    time.sleep(0.01)',
    'os.execv(sys.executable, [sys.executable, "-c", "import time; time.sleep(120)"])',
  ].join('\n'))
  const script = join(home, 'reuse.py')
  await writeFile(script, reuseSource())
  const ran = await runPython([
    script,
    pythonDir,
    join(home, 'ready'),
    join(home, 'go'),
    waiter,
    hide ? 'hide' : 'show',
  ], {
    ...process.env,
    PYTHONPATH: pythonDir,
  })
  assert.equal(ran.code, 0, ran.stderr || ran.stdout)
  const body = JSON.parse(ran.stdout.trim().split('\n').pop())
  try {
    const beforeCmd = (body.before.cmdline || []).join(' ')
    const afterCmd = (body.after.cmdline || []).join(' ')
    assert.equal(live(body.before), true, JSON.stringify(body))
    assert.equal(live(body.after), true, JSON.stringify(body))
    assert.equal(body.after.pgid, body.before.pgid, JSON.stringify(body))
    assert.equal(body.after.create_time, body.before.create_time, JSON.stringify(body))
    assert.equal(beforeCmd.includes('sleep(120)'), false, JSON.stringify(body))
    assert.equal(afterCmd.includes('sleep(120)'), true, JSON.stringify(body))
    if (hide) assert.equal(body.isdir_proc, false, JSON.stringify(body))
  } finally {
    await killPid(body.pid)
  }
  return body
}

async function runStubborn(hide) {
  await ensurePython()
  const home = await mkdtemp(join(suiteRoot, 'home-'))
  const pythonDir = await materializePlugin()
  const stubborn = join(home, 'stubborn.py')
  await writeFile(stubborn, [
    'import os, signal, sys, time',
    'signal.signal(signal.SIGTERM, signal.SIG_IGN)',
    'open(sys.argv[1], "w").write(str(os.getpid()))',
    'while True:',
    '    time.sleep(30)',
  ].join('\n'))
  const pidFile = join(home, 'stubborn.pid')
  const child = spawn(python, [stubborn, pidFile], { stdio: 'ignore' })
  const pid = await waitPidFile(pidFile)
  const script = join(home, 'kill.py')
  await writeFile(script, stubbornSource())
  try {
    const ran = await runPython([script, pythonDir, String(pid), hide ? 'hide' : 'show'], {
      ...process.env,
      PYTHONPATH: pythonDir,
    })
    assert.equal(ran.code, 0, ran.stderr || ran.stdout)
    const body = JSON.parse(ran.stdout.trim().split('\n').pop())
    assert.equal(dead(body.identity), true, JSON.stringify(body))
    if (hide) assert.equal(body.isdir_proc, false, JSON.stringify(body))
    return body
  } finally {
    await killPid(pid)
    try { child.kill('SIGKILL') } catch {}
  }
}

describe('redis lite close', { concurrency: false }, () => {
  after(async () => {
    if (!suiteRoot) return
    try {
      const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid=,args='], { timeout: 4000, maxBuffer: 8 * 1024 * 1024 })
      for (const line of String(stdout).split('\n')) {
        if (!line.includes(suiteRoot)) continue
        const pid = Number(line.trim().split(/\s+/)[0])
        await killPid(pid)
      }
    } catch {}
    await rm(suiteRoot, { recursive: true, force: true })
    suiteRoot = ''
    python = ''
  })

  test('multi-connection close_lite stops the owned redis-server', { timeout: 180_000 }, async (t) => {
    const body = await runOwned(false)
    t.diagnostic(JSON.stringify(body))
  })

  test('foreign redis-server stays up with the same pgid', { timeout: 180_000 }, async (t) => {
    const report = await runDecoy(false)
    t.diagnostic(JSON.stringify(report))
  })

  test('a recycled pid with a different command line is not signaled', { timeout: 180_000 }, async (t) => {
    const body = await runReuse(false)
    t.diagnostic(JSON.stringify(body))
  })

  test('close_lite stops a process that ignores SIGTERM', { timeout: 180_000 }, async (t) => {
    const body = await runStubborn(false)
    t.diagnostic(JSON.stringify(body))
  })

  test('Host stopChild SIGTERM stops the owned redis-server', { timeout: 180_000 }, async (t) => {
    await ensurePython()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const pythonDir = await materializePlugin()
    const ownedDb = join(home, 'owned.db')
    const holderFile = join(home, 'holder.py')
    await writeFile(holderFile, [
      'import os, sys, time',
      'from redislite import Redis',
      'db = Redis(sys.argv[1])',
      'pid = int(db.pid)',
      'print(f"HOLD {pid} {os.getpgid(pid)}", flush=True)',
      'while True:',
      '    time.sleep(60)',
    ].join('\n'))
    const holder = spawn(python, [holderFile, ownedDb], { stdio: ['ignore', 'pipe', 'pipe'] })
    const held = await waitMatch(holder, /HOLD (\d+) (\d+)/, 20_000)
    const heldPid = Number(held.match[1])
    const decoy = await startDecoy(home)
    const decoyBefore = await observe(decoy.pid)
    const script = join(home, 'sidecar.py')
    await writeFile(script, [
      'import os, signal, sys, time',
      'os.environ["DSH_HOME"] = sys.argv[1]',
      'sys.path.insert(0, sys.argv[2])',
      'from redislite import Redis',
      'import stores',
      'owned = Redis(sys.argv[3])',
      'count = int(owned._connection_count())',
      'pid = int(owned.pid)',
      'if count < 2:',
      '    raise SystemExit(f"need two connections, got {count}")',
      'class Db:',
      '    def __init__(self, client):',
      '        self.client = client',
      '    def close(self):',
      '        self.client._cleanup()',
      'stores._LITE_DB = Db(owned)',
      'def _stop(_signum, _frame):',
      '    stores.close_lite()',
      '    raise SystemExit(0)',
      'signal.signal(signal.SIGTERM, _stop)',
      'print(f"READY {pid} {os.getpgid(pid)} {count}", flush=True)',
      'while True:',
      '    time.sleep(30)',
    ].join('\n'))
    const child = spawn(python, [script, home, pythonDir, ownedDb], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DSH_HOME: home, PYTHONPATH: pythonDir },
    })
    let redisPid = heldPid
    try {
      const found = await waitMatch(child, /READY (\d+) (\d+) (\d+)/, 20_000)
      redisPid = Number(found.match[1])
      const redisPgid = Number(found.match[2])
      const count = Number(found.match[3])
      assert.equal(redisPid, heldPid, 'sidecar joined the holder server')
      assert.ok(count >= 2, found.stdout)
      assert.notEqual(redisPid, decoy.pid)
      assert.equal(redisPgid, redisPid, 'daemonized redis pgid is its own pid')
      const { DshCoreConnector } = await import('../dsh-core.mjs')
      const core = new DshCoreConnector({ dshHome: home })
      core.child = child
      await core.stopChild()
      const ownedAfter = await observe(redisPid)
      const decoyAfter = await observe(decoy.pid)
      const report = {
        owned: { pid: redisPid, identity: ownedAfter },
        decoy: { pid: decoy.pid, pgidBefore: decoy.pgid, before: decoyBefore, after: decoyAfter },
      }
      t.diagnostic(JSON.stringify(report))
      assert.equal(dead(ownedAfter), true, JSON.stringify(report))
      assert.equal(sameIdentity(decoyBefore, decoyAfter), true, JSON.stringify(report))
      assert.equal(decoyAfter.pgid, decoy.pgid, JSON.stringify(report))
    } finally {
      try { process.kill(-child.pid, 'SIGKILL') } catch {}
      await killPid(redisPid)
      try { decoy.child.kill('SIGKILL') } catch {}
      await killPid(decoy.pid)
      try { holder.kill('SIGKILL') } catch {}
      await killPid(heldPid)
    }
  })

  test('without /proc and without psutil, close_lite still closes', { timeout: 180_000 }, async (t) => {
    await ensurePython()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const pythonDir = await materializePlugin()
    const sleeper = join(home, 'sleeper.py')
    await writeFile(sleeper, [
      'import os, sys, time',
      'open(sys.argv[1], "w").write(str(os.getpid()))',
      'while True:',
      '    time.sleep(30)',
    ].join('\n'))
    const pidFile = join(home, 'sleeper.pid')
    const child = spawn(python, [sleeper, pidFile], { stdio: 'ignore' })
    const pid = await waitPidFile(pidFile)
    const before = await observe(pid)
    const script = join(home, 'missing.py')
    await writeFile(script, [
      'import json, os, sys',
      'sys.path.insert(0, sys.argv[1])',
      'pid = int(sys.argv[2])',
      'import stores',
      pyPrelude,
      'class Client:',
      '    def __init__(self, pid):',
      '        self.pid = pid',
      '    def shutdown(self, **kwargs):',
      '        raise OSError("no server")',
      'class Db:',
      '    def __init__(self, pid):',
      '        self.client = Client(pid)',
      '        self.closed = 0',
      '    def close(self):',
      '        self.closed += 1',
      'db = Db(pid)',
      'stores._LITE_DB = db',
      'pgid_before = os.getpgid(pid)',
      'sys.modules["psutil"] = None',
      'hide_proc()',
      'if os.path.isdir("/proc"):',
      '    raise SystemExit("proc was not hidden")',
      'error = None',
      'try:',
      '    stores.close_lite()',
      'except Exception as exc:',
      '    error = type(exc).__name__ + ": " + str(exc)',
      'print(json.dumps({"closed": db.closed, "error": error, "pgid_before": pgid_before, "isdir_proc": os.path.isdir("/proc")}))',
    ].join('\n'))
    try {
      const ran = await runPython([script, pythonDir, String(pid)], {
        ...process.env,
        PYTHONPATH: pythonDir,
      })
      assert.equal(ran.code, 0, ran.stderr || ran.stdout)
      const body = JSON.parse(ran.stdout.trim().split('\n').pop())
      const after = await observe(pid)
      const report = { body, before, after }
      t.diagnostic(JSON.stringify(report))
      assert.equal(body.closed, 1, JSON.stringify(report))
      assert.equal(body.error, null, JSON.stringify(report))
      assert.equal(body.isdir_proc, false, JSON.stringify(report))
      assert.equal(sameIdentity(before, after), true, JSON.stringify(report))
      assert.equal(after.pgid, body.pgid_before, JSON.stringify(report))
    } finally {
      await killPid(pid)
      try { child.kill('SIGKILL') } catch {}
    }
  })

  test('without /proc, psutil identity covers multi, stubborn, decoy, and pid reuse', { timeout: 180_000 }, async (t) => {
    const failures = []
    const reports = {}
    const cases = [
      ['multi', () => runOwned(true)],
      ['stubborn', () => runStubborn(true)],
      ['decoy', () => runDecoy(true)],
      ['pid reuse', () => runReuse(true)],
    ]
    for (const [name, fn] of cases) {
      try {
        reports[name] = await fn()
      } catch (error) {
        failures.push(`${name}: ${error && error.message ? error.message : error}`)
      }
    }
    t.diagnostic(JSON.stringify(reports))
    assert.deepEqual(failures, [], failures.join('\n'))
  })

  test('identity reports exited when the process dies after Process()', { timeout: 180_000 }, async (t) => {
    await ensurePython()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const script = join(home, 'die-after-process.py')
    await writeFile(script, [
      'import json, os, signal, sys',
      pyPrelude,
      'pid = os.spawnv(os.P_NOWAIT, sys.executable, [sys.executable, "-c", "import time; time.sleep(120)"])',
      'import psutil',
      'real_init = psutil.Process.__init__',
      'def init(self, pid=None):',
      '    real_init(self, pid)',
      '    os.kill(int(self.pid), signal.SIGKILL)',
      '    os.waitpid(int(self.pid), 0)',
      'psutil.Process.__init__ = init',
      'print(json.dumps(identity(pid)))',
    ].join('\n'))
    const ran = await runPython([script], { ...process.env })
    assert.equal(ran.code, 0, ran.stderr || ran.stdout)
    const body = JSON.parse(ran.stdout.trim().split('\n').pop())
    t.diagnostic(JSON.stringify(body))
    assert.equal(dead(body), true, JSON.stringify(body))
  })
})
