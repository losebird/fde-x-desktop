import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const pyDir = join(root, 'python')
const runtimePy = join(homedir(), '.dsh', 'semantic-os', 'runtime', '0.1.1', 'darwin-arm64', 'python', 'bin', 'python3')

test('close_lite shuts down the redislite child', { skip: !existsSync(runtimePy) }, () => {
  const home = mkdtempSync(join(tmpdir(), 'dsos-lite-'))
  const script = [
    'import os, sys, time, json',
    `os.environ["DSH_HOME"] = ${JSON.stringify(home)}`,
    `sys.path.insert(0, ${JSON.stringify(pyDir)})`,
    'from stores import _open_lite, close_lite',
    'db = _open_lite()',
    'pid = getattr(getattr(db, "client", None), "pid", None)',
    'print("pid", pid)',
    'if not pid:',
    '    print("json", {"ok": True, "skipped": True})',
    '    raise SystemExit(0)',
    'alive = os.path.exists(f"/proc/{pid}") if os.name == "posix" and os.path.isdir("/proc") else True',
    'try:',
    '    os.kill(int(pid), 0)',
    '    before = True',
    'except OSError:',
    '    before = False',
    'close_lite()',
    'time.sleep(0.4)',
    'try:',
    '    os.kill(int(pid), 0)',
    '    after = True',
    'except OSError:',
    '    after = False',
    'import json',
    'print("json", json.dumps({"ok": True, "before": before, "after": after, "pid": int(pid)}))',
  ].join('\n')
  try {
    const ran = spawnSync(runtimePy, ['-c', script], { encoding: 'utf8', timeout: 20000, env: { ...process.env, DSH_HOME: home } })
    const line = (ran.stdout || '').split('\n').filter((row) => row.startsWith('json ')).pop()
    assert.equal(ran.status, 0, ran.stderr || ran.stdout)
    assert.ok(line, ran.stdout)
    const got = JSON.parse(line.slice(5))
    if (got.skipped) return
    assert.equal(got.before, true)
    assert.equal(got.after, false)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
