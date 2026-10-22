import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createCoreConnector } from '../dsh-core.mjs'

const fakeHostPath = fileURLToPath(new URL('./support/fake-host-exit.mjs', import.meta.url))

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

test('killGroup does not rewrite the host exit that lastError reports', { timeout: 180_000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-lasterror-'))
  const cwd = join(home, 'workspace')
  const patchFile = join(home, 'probe.patch.yml')
  const readyPath = join(home, 'ready')
  const goPath = join(home, 'go')
  const statusDir = join(tmpdir(), 'fde-host-exit')
  await mkdir(cwd, { recursive: true })
  mkdirSync(statusDir, { recursive: true })
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
  process.env.FAKE_HOST_MODE = 'code'
  process.env.FDE_SEMANTIC_RUNTIME_MODE = process.env.FDE_SEMANTIC_RUNTIME_MODE || 'readonly'
  const known = new Set(readdirSync(statusDir))
  const reads = []
  const note = () => {
    for (const name of readdirSync(statusDir)) {
      if (!name.endsWith('.json') || known.has(name)) continue
      try {
        const buf = readFileSync(join(statusDir, name))
        reads.push({ name, sha256: sha256(buf), text: buf.toString() })
      } catch { /* connector already unlinked it */ }
    }
  }
  let core = null
  let leaderPid = 0
  let hostPid = 0
  let pipPid = 0
  const timer = setInterval(note, 20)
  try {
    core = createCoreConnector({
      dshHome: home,
      cwd,
      patchFile,
      profileName: `fde-lasterror-${process.pid}`,
      startTimeoutMs: 20_000,
    })
    core.bin = fakeHostPath
    const started = core.start().then(
      () => ({ message: '' }),
      (error) => ({ message: error instanceof Error ? error.message : String(error) }),
    )
    const ready = await new Promise((resolve, reject) => {
      const until = Date.now() + 60_000
      const waitReady = () => {
        try {
          const text = readFileSync(readyPath, 'utf8')
          if (text.trim()) {
            resolve(JSON.parse(text))
            return
          }
        } catch { /* ready file appears after the fake host spawns pip */ }
        if (Date.now() >= until) {
          reject(new Error('fake host did not report pip'))
          return
        }
        setTimeout(waitReady, 20)
      }
      waitReady()
    })
    hostPid = ready.hostPid
    pipPid = ready.pipPid
    leaderPid = core.child?.pid || 0
    await writeFile(goPath, '3\n')
    const settled = await started
    note()
    const lastError = core.lastError
    const distinct = [...new Set(reads.map((row) => row.sha256))]
    console.log(`# lastError ${JSON.stringify(lastError)}`)
    console.log(`# status reads ${JSON.stringify(reads.map((row) => ({ name: row.name, sha256: row.sha256, text: row.text })))}`)
    console.log(`# message ${JSON.stringify(settled.message)}`)
    assert.equal(typeof lastError, 'string', JSON.stringify(lastError))
    assert.equal(lastError.includes('code 3'), true, lastError)
    assert.equal(lastError.includes('SIGTERM'), false, lastError)
    assert.equal(lastError.includes('SIGKILL'), false, lastError)
    assert.equal(settled.message.includes('code 3'), true, settled.message)
    assert.equal(distinct.length, 1, JSON.stringify(reads))
    const parsed = JSON.parse(reads[0].text)
    assert.equal(parsed.code, 3)
    assert.equal(parsed.signal, null)
    assert.equal(lastError.includes(`code ${parsed.code}`), true, lastError)
  } finally {
    clearInterval(timer)
    for (const pid of [pipPid, hostPid, leaderPid]) {
      if (!Number.isInteger(pid) || pid <= 1) continue
      try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ }
    }
    if (leaderPid > 1) {
      try { process.kill(-leaderPid, 'SIGKILL') } catch { /* group already gone */ }
    }
    if (core) await core.stop().catch(() => {})
    await rm(home, { recursive: true, force: true }).catch(() => {})
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
