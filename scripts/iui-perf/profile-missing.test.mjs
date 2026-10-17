import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyProfilePatch, liveProfilePatchMessage } from './lib/profile-patch.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))

function profileHint(text) {
  assert.match(text, /cordis\.patch\.yml/)
  assert.match(text, /fde-x/)
  assert.match(text, /node runtime\/server\.mjs/)
  assert.match(text, /ensureIsolatedProfile/)
  assert.equal(/\bENOENT\b/.test(text), false, text)
}

test('applyProfilePatch names a missing cordis.patch.yml instead of throwing ENOENT', async () => {
  const missing = join(tmpdir(), 'missing-fde-x-cordis.patch.yml')
  const home = await mkdtemp(join(tmpdir(), 'iui-missing-profile-'))
  const previous = process.env.IUI_PERF_PROFILE_PATCH
  process.env.IUI_PERF_PROFILE_PATCH = missing
  try {
    await assert.rejects(() => applyProfilePatch(home, ['fde-x']), (error) => {
      profileHint(String(error && error.message))
      return true
    })
  } finally {
    if (previous == null) delete process.env.IUI_PERF_PROFILE_PATCH
    else process.env.IUI_PERF_PROFILE_PATCH = previous
    await rm(home, { recursive: true, force: true })
  }
})

test('a live run checks the profile patch before it measures', async () => {
  const missing = join(tmpdir(), 'missing-live-cordis.patch.yml')
  const env = { ...process.env, IUI_PERF_PROFILE_PATCH: missing, GROK2API_API_KEY: 'static-intercept' }
  delete env.FDE_IUI_ARTIFACT
  const child = spawn(process.execPath, ['scripts/iui-perf/run.mjs'], { cwd: root, env })
  let out = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { out += chunk })
  child.stderr.on('data', (chunk) => { out += chunk })
  const code = await new Promise((resolve) => child.once('exit', resolve))
  assert.equal(code === 0, false, out)
  profileHint(out)
  assert.equal(/\n\s+at /.test(out), false, out)
})

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

function recipeEnv(home, port) {
  const env = {
    ...process.env,
    HOME: home,
    FDE_RUNTIME_PORT: String(port),
    FDE_LISTEN_HOST: '127.0.0.1',
    FDE_DATABASE_PATH: join(home, 'fde.sqlite'),
    FDE_AI_WORKSPACE: home,
    FDE_VENDOR_DIR: join(home, 'missing-vendor'),
    FDE_SEMANTIC_RUNTIME_MODE: 'readonly',
    GROK2API_API_KEY: 'static-intercept',
  }
  delete env.FDE_DSH_HOME
  delete env.DSH_HOME
  return env
}

function stopTree(child) {
  if (!child || !child.pid) return
  try { process.kill(-child.pid, 'SIGKILL') } catch { /* already gone */ }
}

test('following the missing-patch hint creates cordis.patch.yml', async () => {
  const home = await mkdtemp(join(tmpdir(), 'iui-patch-recipe-'))
  const port = await freePort()
  const message = liveProfilePatchMessage(join(home, 'missing', 'cordis.patch.yml'))
  const fence = message.match(/```sh\n([\s\S]*?)```/)
  const patch = join(home, '.dsh-fde-x', 'profiles', 'fde-x', 'cordis.patch.yml')
  let child = null
  try {
    if (fence) {
      child = spawn('sh', ['-c', fence[1]], {
        cwd: root,
        env: recipeEnv(home, port),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let out = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => { out += chunk })
      child.stderr.on('data', (chunk) => { out += chunk })
      const code = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          stopTree(child)
          resolve('timeout')
        }, 90000)
        child.once('exit', (status) => {
          clearTimeout(timer)
          resolve(status)
        })
      })
      assert.equal(code, 0, out)
    } else {
      child = spawn(process.execPath, ['runtime/server.mjs'], {
        cwd: root,
        env: recipeEnv(home, port),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let out = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => { out += chunk })
      child.stderr.on('data', (chunk) => { out += chunk })
      const listening = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 20000)
        const watch = () => {
          if (!out.includes('FDE_LISTENING')) return
          clearTimeout(timer)
          resolve(true)
        }
        child.stdout.on('data', watch)
        child.stderr.on('data', watch)
      })
      assert.equal(listening, true, out)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    assert.equal(existsSync(patch), true, message)
  } finally {
    stopTree(child)
    try {
      const pid = Number((await readFile(join(home, '.dsh-fde-x', 'fde-server.pid'), 'utf8')).trim())
      if (pid) process.kill(pid, 'SIGKILL')
    } catch { /* no pid file */ }
    await rm(home, { recursive: true, force: true })
  }
})

test('the README tells the operator to connect before the patch file exists', async () => {
  const readme = await readFile(join(root, 'scripts/iui-perf/README.md'), 'utf8')
  assert.match(readme, /api\/v1\/ai\/connect/)
  assert.match(readme, /version: 1/)
  assert.equal(readme.includes('启动时 ensureIsolatedProfile 会创建这个文件'), false)
})
