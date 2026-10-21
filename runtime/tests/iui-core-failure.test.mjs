import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { BUILTIN_PLUGINS } from '../builtin-plugins.mjs'
import { generationDshBin } from '../generation.mjs'
import { createPageTokenClient } from './support/page-token-fetch.mjs'
import { goodIuiTar, writeFakeDshCredentials } from './support/iui-home-fixture.mjs'

const page = createPageTokenClient()
const IUI = BUILTIN_PLUGINS.find((plugin) => plugin.module === '@losebird/iui')
const goodTar = goodIuiTar(IUI.source.commit)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const realBin = join(root, 'runtime', '.host-generation', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')

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

async function waitForHealth(base, child, logs) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`)
      if (response.ok) return response.json()
    } catch (error) {
      const code = error?.cause?.code || error?.code
      if (code !== 'ECONNREFUSED' && code !== 'ECONNRESET') throw error
    }
    if (child.exitCode != null) break
    await new Promise((resolveWait) => setTimeout(resolveWait, 250))
  }
  throw new Error(`server did not serve /health\n${logs.join('').slice(-2000)}`)
}

function spawnServer(home, port, artifact) {
  page.reset()
  const logs = []
  const env = { ...process.env }
  delete env.FDE_PLUGIN_IUI
  delete env.FDE_VENDOR_DIR
  delete env.FDE_DSH_BIN
  delete env.FDE_IUI_ARTIFACT
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: root,
    env: {
      ...env,
      FDE_DSH_HOME: home,
      FDE_RUNTIME_SUPERVISED: '1',
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: join(home, 'data', 'fde-workstation.sqlite'),
      FDE_LISTEN_HOST: '127.0.0.1',
      DSH_LAN_ASSIST_PORT: '0',
      FDE_IUI_ARTIFACT: artifact,
      FDE_SEMANTIC_RUNTIME_MODE: 'readonly',
      FDE_WEB_PORT: '5174',
      FDE_ALLOWED_ORIGINS: 'http://127.0.0.1:5174,http://localhost:5174',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => {
    page.observe(chunk)
    logs.push(String(chunk))
  })
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return { child, logs }
}

async function stopServer(child) {
  if (child.exitCode != null) return
  child.kill('SIGTERM')
  await new Promise((resolveWait) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolveWait()
    }, 4000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolveWait()
    })
  })
}

async function readStatus(base) {
  const response = await page.fetch(`${base}/api/v1/ai/status`)
  assert.equal(response.status, 200)
  const body = await response.json()
  return body.data
}

async function assertTerminalFailure(base, child, logs, deadlineMs, reasonPattern) {
  const deadline = Date.now() + deadlineMs
  let latest = null
  const connect = page.fetch(`${base}/api/v1/ai/connect`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://127.0.0.1:5174',
    },
    body: '{}',
  })
  while (Date.now() < deadline) {
    latest = await readStatus(base)
    if (latest.state === 'error' && latest.iui && latest.iui.state === 'failed' && latest.iui.reason) break
    await new Promise((resolveWait) => setTimeout(resolveWait, 200))
  }
  const connectResult = await Promise.race([
    connect.then(async (response) => ({ status: response.status, body: await response.text() })),
    new Promise((resolveWait) => setTimeout(() => resolveWait({ status: 0, body: 'connect still open' }), 1000)),
  ])
  console.log(`status ${JSON.stringify({ state: latest && latest.state, lastError: latest && latest.lastError, iui: latest && latest.iui })}`)
  console.log(`connect ${connectResult.status} ${String(connectResult.body).slice(0, 400)}`)
  console.log(`server ${logs.join('').slice(-1500)}`)
  assert.equal(latest.state, 'error')
  assert.equal(typeof latest.lastError, 'string')
  assert.equal(latest.lastError.length > 0, true)
  assert.equal(/未完成启动/u.test(latest.lastError), false)
  assert.match(latest.lastError, reasonPattern)
  assert.equal(latest.iui.state, 'failed')
  assert.match(latest.iui.reason, reasonPattern)
  assert.equal(child.exitCode == null, true)
}

async function restoreGenerationBin(original) {
  await chmod(realBin, 0o644)
  await writeFile(realBin, original)
}

test('a core entry that exits on launch becomes error and IUI failed', { timeout: 120_000 }, async () => {
  assert.equal(generationDshBin(), realBin)
  const original = await readFile(realBin)
  assert.equal(original.includes(Buffer.from('import')), true)
  const home = await mkdtemp(join(tmpdir(), 'fde-core-exit-'))
  const port = await freePort()
  await mkdir(home, { recursive: true })
  await writeFakeDshCredentials(home)
  await writeFile(realBin, "import 'fde-iui-missing-module'\n")
  const { child, logs } = spawnServer(home, port, goodTar)
  const base = `http://127.0.0.1:${port}`
  try {
    await waitForHealth(base, child, logs)
    await assertTerminalFailure(base, child, logs, 45_000, /fde-iui-missing-module/u)
  } finally {
    await restoreGenerationBin(original)
    await stopServer(child)
    await rm(home, { recursive: true, force: true })
  }
})

test('an unreadable core entry becomes error and IUI failed', { timeout: 60_000 }, async () => {
  assert.equal(generationDshBin(), realBin)
  const original = await readFile(realBin)
  const home = await mkdtemp(join(tmpdir(), 'fde-core-mode-'))
  const port = await freePort()
  await writeFakeDshCredentials(home)
  await chmod(realBin, 0o000)
  const { child, logs } = spawnServer(home, port, join(home, 'missing-iui.tar.gz'))
  const base = `http://127.0.0.1:${port}`
  try {
    await waitForHealth(base, child, logs)
    await assertTerminalFailure(base, child, logs, 15_000, /不可用/u)
  } finally {
    await restoreGenerationBin(original)
    await stopServer(child)
    await rm(home, { recursive: true, force: true })
  }
})
