import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { BUILTIN_PLUGINS } from '../builtin-plugins.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const IUI = BUILTIN_PLUGINS.find((plugin) => plugin.module === '@losebird/iui')
const goodTar = join('/home/ubuntu/.dsh/vendor/iui', `iui-${IUI.source.commit}.tar.gz`)

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

async function readStatus(base) {
  const response = await fetch(`${base}/api/v1/ai/status`)
  assert.equal(response.status, 200)
  return response.json()
}

test('repacking a failed archive enables IUI without restarting the dev process', { timeout: 180_000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-iui-retry-'))
  const artifact = join(home, 'vendor-tar', `iui-${IUI.source.commit}.tar.gz`)
  await mkdir(dirname(artifact), { recursive: true })
  await writeFile(artifact, 'tampered-iui-archive')
  const badSha = createHash('sha256').update('tampered-iui-archive').digest('hex')
  const port = await freePort()
  const logs = []
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      FDE_DSH_HOME: home,
      FDE_IUI_ARTIFACT: artifact,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: join(home, 'data', 'fde-workstation.sqlite'),
      FDE_LISTEN_HOST: '127.0.0.1',
      DSH_LAN_ASSIST_PORT: '0',
      FDE_SEMANTIC_RUNTIME_MODE: 'readonly',
      FDE_WEB_PORT: '5174',
      FDE_ALLOWED_ORIGINS: 'http://127.0.0.1:5174,http://localhost:5174',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  const base = `http://127.0.0.1:${port}`
  const headers = {
    'content-type': 'application/json',
    origin: 'http://127.0.0.1:5174',
  }
  try {
    let health = null
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch(`${base}/health`)
        if (response.ok) {
          health = await response.json()
          break
        }
      } catch (error) {
        const code = error?.cause?.code || error?.code
        if (code !== 'ECONNREFUSED' && code !== 'ECONNRESET') throw error
      }
      if (child.exitCode != null) break
      await new Promise((resolveWait) => setTimeout(resolveWait, 250))
    }
    assert.ok(health, `server did not serve /health\n${logs.join('').slice(-2000)}`)
    const connect = await fetch(`${base}/api/v1/ai/connect`, { method: 'POST', headers, body: '{}' })
    const connectText = await connect.text()
    console.log(`connect ${connect.status} ${connectText.slice(0, 500)}`)
    assert.equal(connect.status, 200, connectText.slice(0, 500))
    const first = await readStatus(base)
    console.log(`after bad tar ${JSON.stringify(first.data.iui)}`)
    assert.equal(first.data.iui.state, 'verify_failed')
    assert.equal(first.data.iui.actual, badSha)
    await copyFile(goodTar, artifact)
    const again = await fetch(`${base}/api/v1/ai/connect`, { method: 'POST', headers, body: '{}' })
    const againBody = await again.json()
    console.log(`second connect ${again.status} ${JSON.stringify(againBody.data && againBody.data.iui)}`)
    assert.equal(againBody.data.iui.state, 'verify_failed')
    const retry = await fetch(`${base}/api/v1/ai/iui/retry`, { method: 'POST', headers, body: '{}' })
    const retryText = await retry.text()
    console.log(`retry ${retry.status} ${retryText.slice(0, 800)}`)
    assert.equal(retry.status, 200, retryText.slice(0, 800))
    const retried = JSON.parse(retryText)
    assert.equal(retried.data.iui.state, 'enabled')
    assert.equal(retried.data.state, 'connected')
    const second = await fetch(`${base}/api/v1/ai/iui/retry`, { method: 'POST', headers, body: '{}' })
    const secondBody = await second.json()
    console.log(`retry again ${second.status} ${JSON.stringify(secondBody.data && secondBody.data.iui)}`)
    assert.equal(second.status, 200)
    assert.equal(secondBody.data.iui.state, 'enabled')
    assert.equal(secondBody.data.iui.version, IUI.source.version)
    assert.equal(child.exitCode == null, true)
  } finally {
    if (child.exitCode == null) child.kill('SIGTERM')
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
    await rm(home, { recursive: true, force: true })
  }
})
