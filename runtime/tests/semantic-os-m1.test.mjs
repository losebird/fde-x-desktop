import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { generationDshBin, generationInstallRoot } from '../generation.mjs'

const repoRoot = join(import.meta.dirname, '../..')
const SOURCE = 'losebird/dsh-semantic-os@42e228fa25ad757b933bf5ffe1e3fe83640b4ae7'
const SNAPSHOT = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS || ''

function snapshotMounted() {
  return Boolean(SNAPSHOT) && existsSync(join(SNAPSHOT, 'session-ingest.js')) && existsSync(join(SNAPSHOT, 'package.json'))
}

function listen(handler) {
  return new Promise((resolve, reject) => {
    const server = createServer(handler)
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, port: address.port })
    })
  })
}

async function until(predicate, budgetMs) {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > budgetMs) return false
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return true
}

describe('semantic-os session ingest', { concurrency: false }, () => {
  test(`persistence inventory matches ${SOURCE}`, async (t) => {
    if (!snapshotMounted()) {
      t.skip('FDE_PLUGIN_DSH_SEMANTIC_OS is not mounted')
      return
    }
    const pkg = JSON.parse(await readFile(join(SNAPSHOT, 'package.json'), 'utf8'))
    assert.equal(pkg.name, 'dsh-semantic-os')
    assert.equal(pkg.version, '0.1.1')
    const mod = await import(pathToFileURL(join(SNAPSHOT, 'session-ingest.js')).href)
    assert.deepEqual(Object.keys(mod).sort(), [
      'DEFAULT_SESSION_INGEST_INTERVAL_MIN',
      'createSessionIngest',
      'eventText',
      'eventTime',
      'headerCwd',
      'headerId',
      'mayLook',
      'toolNameOf',
    ])
    assert.equal('adaptSessionPersistence' in mod, false)
    assert.equal(mod.DEFAULT_SESSION_INGEST_INTERVAL_MIN, 30)

    const cwd = await mkdtemp(join(tmpdir(), 'fde-m1-cwd-'))
    assert.equal(mod.headerId({ id: 'top', meta: { id: 'meta' } }), 'top')
    assert.equal(mod.headerId({ meta: { id: 'meta-only' } }), 'meta-only')
    assert.equal(mod.headerCwd({ cwd, meta: { cwd: '/elsewhere' } }), cwd)
    assert.equal(mod.headerCwd({ meta: { cwd } }), cwd)
    assert.equal(mod.headerId({ header: { id: 'nested', cwd }, revision: 1 }), '')
    assert.equal(mod.headerCwd({ header: { id: 'nested', cwd } }), '')

    const keyword = 'm1kw-42e228fa-session-ingest'
    assert.equal(mod.eventText({
      type: 'user/message',
      data: { content: [{ type: 'text', text: keyword }], source: { kind: 'user' } },
    }), keyword)
    assert.equal(mod.eventText({
      type: 'user/message',
      data: { content: keyword, source: { kind: 'user' } },
    }), keyword)
    assert.equal(mod.eventText({
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: `ack-${keyword}` }] } },
    }), `ack-${keyword}`)
    assert.equal(mod.eventText({
      type: 'user/message',
      data: { content: keyword, source: { kind: 'tool' } },
    }), '')
    assert.equal(mod.eventText({ type: 'tool/result', data: { content: keyword } }), '')
    assert.equal(mod.eventTime({ time: 1_700_000_000_000 }).length > 0, true)

    const bodies = []
    const { server, port } = await listen((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        bodies.push(text ? JSON.parse(text) : {})
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{}')
      })
    })
    const home = await mkdtemp(join(tmpdir(), 'fde-m1-ingest-'))
    const previousHome = process.env.DSH_HOME
    process.env.DSH_HOME = home
    const seen = []
    const calls = []
    const persistence = new Proxy({
      async list() {
        calls.push('list')
        return [{ id: 's1', cwd, meta: { id: 's1', cwd } }]
      },
      async readFrom(id, fromSeq) {
        calls.push(['readFrom', id, fromSeq])
        return {
          events: [
            {
              type: 'user/message',
              seq: 0,
              time: 1_700_000_000_000,
              data: { content: [{ type: 'text', text: keyword }], source: { kind: 'user' } },
            },
            {
              type: 'user/message',
              seq: 1,
              time: 1_700_000_000_001,
              data: { content: [{ type: 'text', text: `skip-${keyword}` }], source: { kind: 'tool' } },
            },
            {
              type: 'assistant/message',
              seq: 2,
              time: 1_700_000_000_002,
              data: { message: { content: [{ type: 'text', text: `ack-${keyword}` }] } },
            },
            {
              type: 'tool/result',
              seq: 3,
              time: 1_700_000_000_003,
              data: { content: `tool-${keyword}` },
            },
            {
              type: 'user/message',
              seq: Number.NaN,
              time: 1_700_000_000_004,
              data: { content: [{ type: 'text', text: `nan-${keyword}` }], source: { kind: 'user' } },
            },
          ],
        }
      },
    }, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && prop !== 'then') seen.push(prop)
        return Reflect.get(target, prop, receiver)
      },
    })
    const ingest = mod.createSessionIngest({
      sidecar: { snapshot: () => ({ ready: true, port }), getApiKey: () => '' },
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue() {}, snapshot() { return null } },
      getConfig: () => ({ sessionIngestIntervalMin: 30 }),
    })
    try {
      const result = await ingest.tick()
      assert.equal(result.error, '', JSON.stringify(result))
      assert.deepEqual(calls, ['list', ['readFrom', 's1', 0]])
      assert.deepEqual([...new Set(seen)].sort(), ['list', 'readFrom'])
      const arrived = await until(() => bodies.length > 0, 2000)
      assert.equal(arrived, true, 'index_passages was not called')
      const rows = bodies[0]?.args?.rows || []
      assert.deepEqual(rows.map((row) => row.id), [`session:s1:0`, `session:s1:2`])
      assert.equal(rows[0].text, keyword)
      assert.equal(rows[1].text, `ack-${keyword}`)
      assert.equal(JSON.stringify(rows).includes(`nan-${keyword}`), false)
      assert.equal(JSON.stringify(rows).includes(`tool-${keyword}`), false)
      assert.equal(JSON.stringify(rows).includes(`skip-${keyword}`), false)

      const missing = mod.createSessionIngest({
        sidecar: { snapshot: () => ({ ready: true, port: 1 }), getApiKey: () => '' },
        getPersistence: () => ({ async list() { return [] } }),
        getEyes: () => null,
        getExtract: () => null,
        extractQueue: { enqueue() {}, snapshot() { return null } },
        getConfig: () => ({ sessionIngestIntervalMin: 30 }),
      })
      const denied = await missing.tick()
      assert.equal(denied.error, 'NO_PERSISTENCE')
      missing.stop()

      let read = false
      const nested = mod.createSessionIngest({
        sidecar: { snapshot: () => ({ ready: true, port: 1 }), getApiKey: () => '' },
        getPersistence: () => ({
          async list() { return [{ header: { id: 'hidden', cwd }, revision: 1 }] },
          async readFrom() { read = true; return { events: [] } },
        }),
        getEyes: () => null,
        getExtract: () => null,
        extractQueue: { enqueue() {}, snapshot() { return null } },
        getConfig: () => ({ sessionIngestIntervalMin: 30 }),
      })
      const skipped = await nested.tick()
      assert.equal(read, false)
      assert.equal(skipped.skipped, 1)
      nested.stop()
    } finally {
      ingest.stop()
      if (previousHome == null) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      await new Promise((resolve) => server.close(resolve))
      await rm(home, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('mounted semantic-os is ready and memory search is not 502', { timeout: 200_000 }, async (t) => {
    if (!snapshotMounted()) {
      t.skip('FDE_PLUGIN_DSH_SEMANTIC_OS is not mounted')
      return
    }
    const bin = generationDshBin()
    if (!bin) {
      t.skip('generation dsh bin is not installed')
      return
    }
    const home = await mkdtemp(join(tmpdir(), 'fde-m1-home-'))
    const workspace = await mkdtemp(join(tmpdir(), 'fde-m1-ws-'))
    const dbPath = join(home, 'fde.sqlite')
    await writeFile(join(home, '.credentials.yaml'), '', { mode: 0o600 })
    const peerDir = join(home, 'profiles', 'web', 'node_modules', '@deepseek-ai')
    await mkdir(peerDir, { recursive: true })
    for (const name of ['schemastery', 'dsh-tools', 'cordis', 'dsh-llm']) {
      const src = join(generationInstallRoot(), 'node_modules', '@deepseek-ai', name)
      assert.equal(existsSync(src), true, `${name} is not in the host generation`)
      symlinkSync(src, join(peerDir, name))
    }
    const output = { text: '' }
    const child = spawn(process.execPath, ['runtime/server.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: home,
        FDE_DSH_HOME: home,
        FDE_VENDOR_DIR: join(home, 'vendor'),
        FDE_PLUGIN_DSH_SEMANTIC_OS: SNAPSHOT,
        FDE_DATABASE_PATH: dbPath,
        FDE_AI_WORKSPACE: workspace,
        FDE_RUNTIME_PORT: '0',
        FDE_RUNTIME_SUPERVISED: '1',
        FDE_DSH_PROFILE: 'm1-semantic',
        FDE_SEMANTIC_RUNTIME_MODE: 'readonly',
        DSH_TELEMETRY_DISABLED: '1',
        DSH_LAN_ASSIST_PORT: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => { output.text += chunk.toString() })
    child.stderr.on('data', (chunk) => { output.text += chunk.toString() })
    try {
      const started = Date.now()
      let port = 0
      while (Date.now() - started < 30_000) {
        if (child.exitCode != null || child.signalCode != null) {
          throw new Error(`runtime exited ${child.exitCode ?? child.signalCode}\n${output.text.slice(-3000)}`)
        }
        const match = output.text.match(/FDE_LISTENING (\d+)/)
        if (match) {
          port = Number(match[1])
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (!port) throw new Error(`runtime did not listen\n${output.text.slice(-3000)}`)
      const base = `http://127.0.0.1:${port}`
      const origin = base
      const request = (path, options = {}) => fetch(`${base}${path}`, {
        ...options,
        headers: { origin, ...(options.headers || {}) },
      })
      const connect = await request('/api/v1/ai/connect', { method: 'POST' })
      const connectBody = await connect.json()
      assert.equal(connect.status, 200, JSON.stringify(connectBody))
      const readyRes = await request('/api/v1/memory/ready')
      const readyBody = await readyRes.json()
      const searchRes = await request('/api/v1/memory/search?q=m1kw-42e228fa-session-ingest')
      const searchText = await searchRes.text()
      const statusRes = await request('/api/v1/ai/status')
      const statusBody = await statusRes.json()
      const recent = JSON.stringify(statusBody?.data?.recentLogs || []).slice(-4000)
      const problems = []
      if (readyBody?.data?.ready !== true) problems.push(`ready ${JSON.stringify(readyBody)}`)
      if (searchRes.status === 502) problems.push(`search 502 ${searchText.slice(0, 500)}`)
      assert.equal(problems.length, 0, `${problems.join('\n')}\n${recent}`)
    } finally {
      if (child.exitCode == null && child.signalCode == null) child.kill('SIGTERM')
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          try { child.kill('SIGKILL') } catch { /* already exited */ }
          resolve()
        }, 8000)
        child.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })
      await rm(home, { recursive: true, force: true })
      await rm(workspace, { recursive: true, force: true })
    }
  })
})
