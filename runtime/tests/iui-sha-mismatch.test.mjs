import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { BUILTIN_PLUGINS } from '../builtin-plugins.mjs'
import { createPageTokenClient } from './support/page-token-fetch.mjs'
import { writeFakeDshCredentials } from './support/iui-home-fixture.mjs'

const page = createPageTokenClient()

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const IUI = BUILTIN_PLUGINS.find((plugin) => plugin.module === '@losebird/iui')
const REBUILD = 'node scripts/pack/build-iui.mjs --out ~/.dsh/vendor/iui'

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolvePort(port))
    })
  })
}

test('a tampered vendor tar disables IUI and leaves the core connected', { timeout: 180_000 }, async () => {
  assert.equal(existsSync(join(root, 'scripts/pack/build-iui.mjs')), true)
  const home = await mkdtemp(join(tmpdir(), 'fde-sha-degrade-'))
  const blankHome = join(home, 'blank-home')
  const artifact = join(home, 'vendor-tar', `iui-${IUI.source.commit}.tar.gz`)
  const bytes = Buffer.from('tampered-iui-archive')
  const actual = createHash('sha256').update(bytes).digest('hex')
  const port = await freePort()
  const database = join(home, 'data', 'fde-workstation.sqlite')
  await mkdir(blankHome, { recursive: true })
  await mkdir(dirname(artifact), { recursive: true })
  await writeFakeDshCredentials(home)
  await writeFile(artifact, bytes)
  const logs = []
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      HOME: blankHome,
      FDE_DSH_HOME: home,
      FDE_RUNTIME_SUPERVISED: '1',
      FDE_IUI_ARTIFACT: artifact,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: database,
      FDE_LISTEN_HOST: '127.0.0.1',
      DSH_LAN_ASSIST_PORT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => {
    page.observe(chunk)
    logs.push(String(chunk))
  })
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  const base = `http://127.0.0.1:${port}`
  try {
    let health = null
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await page.fetch(`${base}/health`)
        if (response.ok) {
          health = await response.json()
          break
        }
      } catch {
        /* server still binding */
      }
      if (child.exitCode != null) break
      await new Promise((resolveWait) => setTimeout(resolveWait, 250))
    }
    assert.ok(health, `server did not serve /health\n${logs.join('').slice(-2000)}`)
    assert.equal(health.state, 'healthy')
    const connect = await page.fetch(`${base}/api/v1/ai/connect`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://127.0.0.1:5174',
      },
      body: '{}',
    })
    const connectText = await connect.text()
    console.log(`ai connect ${connect.status} ${connectText.slice(0, 800)}`)
    assert.equal(connect.status, 200, connectText.slice(0, 800))
    const live = await page.fetch(`${base}/health`).then((response) => response.json())
    assert.equal(live.state, 'healthy')
    const ai = (live.adapters || []).find((row) => row.capability === 'ai-runtime')
    assert.ok(ai, 'ai-runtime adapter missing')
    console.log(`status line ${ai.detail}`)
    assert.equal(ai.state, 'healthy')
    assert.match(ai.detail, /IUI 校验失败/)
    assert.match(ai.detail, new RegExp(IUI.source.sha256))
    assert.match(ai.detail, new RegExp(actual))
    assert.match(ai.detail, new RegExp(artifact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(ai.detail, /node scripts\/pack\/build-iui\.mjs --out ~\/\.dsh\/vendor\/iui/)
    assert.equal(existsSync(join(home, 'vendor', 'iui', 'package.json')), false)
    assert.doesNotMatch(ai.detail, /IUI 未安装/)
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolveWait) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        resolveWait()
      }, 8000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolveWait()
      })
    })
    await rm(home, { recursive: true, force: true })
  }
  assert.equal(REBUILD, 'node scripts/pack/build-iui.mjs --out ~/.dsh/vendor/iui')
})
