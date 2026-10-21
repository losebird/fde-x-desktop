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

let suiteRoot = ''
let python = ''

function dead(state) {
  return state === 'gone' || state === 'Z' || state === 'X'
}

function live(state) {
  return state === 'R' || state === 'S' || state === 'D' || state === 'I'
}

async function procState(pid) {
  try {
    const text = await readFile(`/proc/${pid}/stat`, 'utf8')
    return text.slice(text.lastIndexOf(')') + 2).split(' ', 1)[0]
  } catch {
    return 'gone'
  }
}

async function procPgid(pid) {
  const text = await readFile(`/proc/${pid}/stat`, 'utf8')
  const fields = text.slice(text.lastIndexOf(')') + 2).split(' ')
  return Number(fields[2])
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
  await execFileAsync(join(venv, 'bin', 'pip'), ['install', '-q', 'redislite', 'psutil'], { timeout: 180_000 })
  python = join(venv, 'bin', 'python')
  return python
}

async function killPid(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return
  try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ }
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

const multiScript = [
  'import json, os, sys',
  'os.environ["DSH_HOME"] = sys.argv[1]',
  'sys.path.insert(0, sys.argv[2])',
  'from redislite import Redis',
  'import stores',
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
  'stores.close_lite()',
  'def proc_state(target):',
  '    try:',
  '        text = open(f"/proc/{target}/stat", encoding="utf-8").read()',
  '    except FileNotFoundError:',
  '        return "gone"',
  '    return text[text.rfind(")") + 2:].split(" ", 1)[0]',
  'keep = id(extra)',
  'print(json.dumps({"count": count, "pid": pid, "state": proc_state(pid), "keep": keep}))',
].join('\n')

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
    } catch { /* ps failure still removes the temp root */ }
    await rm(suiteRoot, { recursive: true, force: true })
    suiteRoot = ''
    python = ''
  })

  test('multi-connection close_lite stops the owned redis-server', { timeout: 180_000 }, async (t) => {
    await ensurePython()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const pythonDir = await materializePlugin()
    const script = join(home, 'multi.py')
    await writeFile(script, multiScript)
    const ran = await runPython([script, home, pythonDir, join(home, 'owned.db')], {
      ...process.env,
      DSH_HOME: home,
      PYTHONPATH: pythonDir,
    })
    assert.equal(ran.code, 0, ran.stderr || ran.stdout)
    const body = JSON.parse(ran.stdout.trim().split('\n').pop())
    t.diagnostic(JSON.stringify(body))
    assert.ok(body.count >= 2, JSON.stringify(body))
    try {
      assert.equal(dead(body.state), true, JSON.stringify(body))
    } finally {
      await killPid(body.pid)
    }
  })

  test('foreign redis-server stays up with the same pgid', { timeout: 180_000 }, async (t) => {
    await ensurePython()
    const home = await mkdtemp(join(suiteRoot, 'home-'))
    const pythonDir = await materializePlugin()
    const decoy = await startDecoy(home)
    const script = join(home, 'multi.py')
    await writeFile(script, multiScript)
    try {
      const ran = await runPython([script, home, pythonDir, join(home, 'owned.db')], {
        ...process.env,
        DSH_HOME: home,
        PYTHONPATH: pythonDir,
      })
      assert.equal(ran.code, 0, ran.stderr || ran.stdout)
      const body = JSON.parse(ran.stdout.trim().split('\n').pop())
      const state = await procState(decoy.pid)
      const pgid = state === 'gone' ? null : await procPgid(decoy.pid)
      const report = { owned: body, decoy: { pid: decoy.pid, state, pgid, pgidBefore: decoy.pgid } }
      t.diagnostic(JSON.stringify(report))
      assert.ok(body.count >= 2, JSON.stringify(report))
      assert.equal(live(state), true, JSON.stringify(report))
      assert.equal(pgid, decoy.pgid, JSON.stringify(report))
      await killPid(body.pid)
    } finally {
      try { decoy.child.kill('SIGKILL') } catch { /* holder already exited */ }
      await killPid(decoy.pid)
    }
  })

  test('a recycled pid with a different command line is not signaled', { timeout: 180_000 }, async (t) => {
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
    await writeFile(script, [
      'import json, os, sys, time',
      'sys.path.insert(0, sys.argv[1])',
      'import stores',
      'ready, go, waiter = sys.argv[2], sys.argv[3], sys.argv[4]',
      'pid = os.spawnv(os.P_NOWAIT, sys.executable, [sys.executable, waiter, ready, go])',
      'deadline = time.time() + 5',
      'while not os.path.exists(ready):',
      '    if time.time() > deadline:',
      '        raise SystemExit("waiter did not start")',
      '    time.sleep(0.01)',
      'pgid_before = os.getpgid(pid)',
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
      '            try:',
      '                cmd = open(f"/proc/{pid}/cmdline", "rb").read()',
      '            except FileNotFoundError:',
      '                raise SystemExit("pid disappeared during exec")',
      '            if b"sleep(120)" in cmd:',
      '                return',
      '            time.sleep(0.01)',
      '        raise SystemExit("exec did not replace the command line")',
      'stores._LITE_DB = Db(pid)',
      'stores.close_lite()',
      'def proc_state(target):',
      '    try:',
      '        text = open(f"/proc/{target}/stat", encoding="utf-8").read()',
      '    except FileNotFoundError:',
      '        return "gone"',
      '    return text[text.rfind(")") + 2:].split(" ", 1)[0]',
      'state = proc_state(pid)',
      'pgid_after = os.getpgid(pid) if state != "gone" else None',
      'print(json.dumps({"pid": pid, "state": state, "pgidBefore": pgid_before, "pgidAfter": pgid_after}))',
    ].join('\n'))
    const ran = await runPython([script, pythonDir, join(home, 'ready'), join(home, 'go'), waiter], {
      ...process.env,
      PYTHONPATH: pythonDir,
    })
    assert.equal(ran.code, 0, ran.stderr || ran.stdout)
    const body = JSON.parse(ran.stdout.trim().split('\n').pop())
    t.diagnostic(JSON.stringify(body))
    try {
      assert.equal(live(body.state), true, JSON.stringify(body))
      assert.equal(body.pgidAfter, body.pgidBefore, JSON.stringify(body))
    } finally {
      await killPid(body.pid)
    }
  })

  test('close_lite stops a process that ignores SIGTERM', { timeout: 180_000 }, async (t) => {
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
    const started = Date.now()
    let pid = 0
    while (Date.now() - started < 5_000) {
      try {
        pid = Number(await readFile(pidFile, 'utf8'))
        if (pid > 1) break
      } catch { /* file not written yet */ }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    assert.ok(pid > 1, 'stubborn process did not write its pid')
    const script = join(home, 'kill.py')
    await writeFile(script, [
      'import json, sys, time',
      'sys.path.insert(0, sys.argv[1])',
      'import stores',
      'pid = int(sys.argv[2])',
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
      'started = time.monotonic()',
      'stores.close_lite()',
      'elapsed = time.monotonic() - started',
      'def proc_state(target):',
      '    try:',
      '        text = open(f"/proc/{target}/stat", encoding="utf-8").read()',
      '    except FileNotFoundError:',
      '        return "gone"',
      '    return text[text.rfind(")") + 2:].split(" ", 1)[0]',
      'print(json.dumps({"pid": pid, "state": proc_state(pid), "elapsed": round(elapsed, 3)}))',
    ].join('\n'))
    try {
      const ran = await runPython([script, pythonDir, String(pid)], {
        ...process.env,
        PYTHONPATH: pythonDir,
      })
      assert.equal(ran.code, 0, ran.stderr || ran.stdout)
      const body = JSON.parse(ran.stdout.trim().split('\n').pop())
      t.diagnostic(JSON.stringify(body))
      assert.equal(dead(body.state), true, JSON.stringify(body))
    } finally {
      await killPid(pid)
      try { child.kill('SIGKILL') } catch { /* already stopped */ }
    }
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
      const ownedState = await procState(redisPid)
      const decoyState = await procState(decoy.pid)
      const decoyPgid = decoyState === 'gone' ? null : await procPgid(decoy.pid)
      const report = {
        owned: { pid: redisPid, state: ownedState },
        decoy: { pid: decoy.pid, state: decoyState, pgid: decoyPgid, pgidBefore: decoy.pgid },
      }
      t.diagnostic(JSON.stringify(report))
      assert.equal(dead(ownedState), true, JSON.stringify(report))
      assert.equal(live(decoyState), true, JSON.stringify(report))
      assert.equal(decoyPgid, decoy.pgid, JSON.stringify(report))
    } finally {
      try { process.kill(-child.pid, 'SIGKILL') } catch { /* group already gone */ }
      await killPid(redisPid)
      try { decoy.child.kill('SIGKILL') } catch { /* decoy holder already exited */ }
      await killPid(decoy.pid)
      try { holder.kill('SIGKILL') } catch { /* connection holder already exited */ }
      await killPid(heldPid)
    }
  })
})
