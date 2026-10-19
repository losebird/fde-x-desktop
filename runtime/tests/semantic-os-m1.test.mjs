import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { generationDshBin, generationInstallRoot } from '../generation.mjs'

const repoRoot = join(import.meta.dirname, '../..')
const SOURCE = 'losebird/dsh-semantic-os@a13e45390a860162042ddbcdd5b6eee3b92651d8'
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

async function reapHomeProcesses(home) {
  let names = []
  try {
    names = await readdir('/proc')
  } catch {
    return
  }
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue
    const pid = Number(name)
    if (pid === process.pid) continue
    let env = ''
    try {
      env = await readFile(join('/proc', name, 'environ'))
    } catch {
      continue
    }
    if (!env.includes(home)) continue
    try { process.kill(pid, 'SIGKILL') } catch {}
  }
}

async function sessionLogHashes(dir, state = new Map(), depth = 0) {
  if (depth > 8) return state
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return state
  }
  for (const entry of entries) {
    if (entry.name === 'venv' || entry.name === 'node_modules') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      await sessionLogHashes(path, state, depth + 1)
      continue
    }
    if (!entry.name.endsWith('.jsonl.zstd')) continue
    state.set(path, createHash('sha256').update(await readFile(path)).digest('hex'))
  }
  return state
}

function sameHashes(before, after) {
  if (before.size === 0) return false
  if (before.size !== after.size) return false
  for (const [path, hash] of before) {
    if (after.get(path) !== hash) return false
  }
  return true
}

function searchFoundKeyword(text, keyword) {
  let body
  try {
    body = JSON.parse(text)
  } catch {
    return false
  }
  const data = body && body.data && typeof body.data === 'object' ? body.data : body
  const rows = []
  for (const key of ['items', 'excerpts', 'results', 'hits']) {
    if (Array.isArray(data[key])) rows.push(...data[key])
  }
  return JSON.stringify(rows).includes(keyword)
}

const ZSTD_MAGIC = 0xfd2fb528

async function textOfFile(path, buf) {
  if (!path.endsWith('.zstd')) return buf.toString('utf8')
  const { zstdDecompressSync } = await import('node:zlib')
  const parts = []
  let offset = 0
  while (offset + 4 <= buf.length) {
    if (buf.readUInt32LE(offset) !== ZSTD_MAGIC) break
    let end = buf.length
    const next = buf.indexOf(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]), offset + 4)
    if (next !== -1) end = next
    try {
      parts.push(zstdDecompressSync(buf.subarray(offset, end)).toString('utf8'))
    } catch {
      break
    }
    offset = end
  }
  return parts.join('\n')
}

async function sessionFilesContain(dir, keyword, state = { found: false, files: [] }, depth = 0) {
  if (depth > 8) return state
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return state
  }
  for (const entry of entries) {
    if (entry.name === 'venv' || entry.name === 'node_modules') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      await sessionFilesContain(path, keyword, state, depth + 1)
      if (state.found) return state
      continue
    }
    if (entry.name.endsWith('.jsonl') || entry.name.endsWith('.jsonl.zstd') || entry.name.includes('session')) {
      state.files.push(path)
    }
    let buf
    try {
      buf = await readFile(path)
    } catch {
      continue
    }
    if (buf.length > 8_000_000) continue
    const text = await textOfFile(path, buf)
    if (text.includes(keyword)) {
      state.found = true
      return state
    }
  }
  return state
}

async function sessionUserTextHas(dir, keyword, eventText, depth = 0) {
  if (depth > 8) return false
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return false
  }
  for (const entry of entries) {
    if (entry.name === 'venv' || entry.name === 'node_modules') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (await sessionUserTextHas(path, keyword, eventText, depth + 1)) return true
      continue
    }
    if (!entry.name.endsWith('.jsonl') && !entry.name.endsWith('.jsonl.zstd')) continue
    let buf
    try {
      buf = await readFile(path)
    } catch {
      continue
    }
    if (buf.length > 8_000_000) continue
    const text = await textOfFile(path, buf)
    for (const line of text.split('\n')) {
      if (!line) continue
      let event
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      if (String(eventText(event) || '').includes(keyword)) return true
    }
  }
  return false
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
      'adaptSessionPersistence',
      'createSessionIngest',
      'eventText',
      'eventTime',
      'headerCwd',
      'headerId',
      'headerOf',
      'mayLook',
      'toolNameOf',
    ])
    assert.equal(typeof mod.adaptSessionPersistence, 'function')
    assert.equal(typeof mod.headerOf, 'function')
    assert.equal(mod.DEFAULT_SESSION_INGEST_INTERVAL_MIN, 30)

    const cwd = await mkdtemp(join(tmpdir(), 'fde-m1-cwd-'))
    assert.equal(mod.headerId({ id: 'top', meta: { id: 'meta' } }), 'top')
    assert.equal(mod.headerId({ meta: { id: 'meta-only' } }), 'meta-only')
    assert.equal(mod.headerCwd({ cwd, meta: { cwd: '/elsewhere' } }), cwd)
    assert.equal(mod.headerCwd({ meta: { cwd } }), cwd)
    assert.equal(mod.headerOf({ header: { id: 'nested', cwd }, revision: 1 }).id, 'nested')
    assert.equal(mod.headerId({ header: { id: 'nested', cwd }, revision: 1 }), 'nested')
    assert.equal(mod.headerCwd({ header: { id: 'nested', cwd } }), cwd)

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
      assert.deepEqual([...new Set(seen)].sort(), ['list', 'open', 'readFrom'])
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
      assert.equal(read, true)
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

  test('mounted semantic-os is ready and memory search is not 502', { timeout: 1_500_000 }, async (t) => {
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
    const hostEnv = {
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
    }
    const output = { text: '' }
    let child = spawn(process.execPath, ['runtime/server.mjs'], {
      cwd: repoRoot,
      env: hostEnv,
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
      const keyword = 'm1kw-42e228fa-iui-live'
      const readyDeadline = Date.now() + 12 * 60 * 1000
      let readyBody = null
      while (Date.now() < readyDeadline) {
        if (child.exitCode != null || child.signalCode != null) {
          throw new Error(`runtime exited ${child.exitCode ?? child.signalCode}\n${output.text.slice(-3000)}`)
        }
        const readyRes = await request('/api/v1/memory/ready')
        readyBody = await readyRes.json()
        const data = readyBody?.data || {}
        if (data.ready === true) break
        const phase = String(data.install?.phase || '')
        const reason = String(data.reason || '')
        const terminal = phase === 'install_failed'
          || reason === 'install_failed'
          || reason === 'python_missing'
          || reason === 'wheel_missing'
          || reason === 'version_mismatch'
          || reason === 'start_failed'
        if (terminal) break
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
      assert.equal(readyBody?.data?.ready, true, `ready ${JSON.stringify(readyBody)}`)
      const created = await request('/api/v1/ai/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cwd: workspace }),
      })
      const createdBody = await created.json()
      assert.equal(created.status, 201, JSON.stringify(createdBody))
      const sessionId = String(createdBody?.data?.sessionId || '')
      assert.equal(sessionId.length > 0, true, JSON.stringify(createdBody))
      const prompted = await request(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: keyword }),
        signal: AbortSignal.timeout(90_000),
      })
      const promptBody = await prompted.json()
      assert.equal(prompted.status, 200, JSON.stringify(promptBody))
      const ingestMod = await import(pathToFileURL(join(SNAPSHOT, 'session-ingest.js')).href)
      const storedDeadline = Date.now() + 30_000
      let stored = { found: false, files: [] }
      let visible = false
      while (Date.now() < storedDeadline) {
        stored = await sessionFilesContain(home, keyword)
        visible = await sessionUserTextHas(home, keyword, ingestMod.eventText)
        if (visible) break
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
      let searchText = ''
      let searchStatus = 0
      let hit = false
      let ingestBody = null
      const searchDeadline = Date.now() + 180_000
      while (Date.now() < searchDeadline) {
        const ingested = await request('/api/v1/memory/session-ingest', { method: 'POST' })
        ingestBody = await ingested.json()
        assert.equal(ingested.status, 200, JSON.stringify(ingestBody))
        const searchRes = await request(`/api/v1/memory/search?q=${encodeURIComponent(keyword)}&cwd=${encodeURIComponent(workspace)}`)
        searchStatus = searchRes.status
        searchText = await searchRes.text()
        hit = searchFoundKeyword(searchText, keyword)
        if (searchStatus !== 502 && hit) break
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      let passages = ''
      let cursors = ''
      try { passages = await readFile(join(workspace, '.dsh', 'semantic-os', 'passages', 'texts.json'), 'utf8') } catch {}
      try { cursors = await readFile(join(home, 'semantic-os', 'session-cursors.json'), 'utf8') } catch {}
      const evidence = `visible=${visible} stored=${stored.found} cursors=${cursors.slice(0, 300)} passages=${passages.slice(0, 300)} ingest=${JSON.stringify(ingestBody).slice(0, 400)}`
      assert.equal(searchStatus === 502, false, `search 502 ${searchText.slice(0, 800)} ${evidence}`)
      assert.equal(hit, true, `search missed ${keyword} status=${searchStatus} ${searchText.slice(0, 800)} ${evidence}`)
      const hashes = await sessionLogHashes(home)
      assert.equal(hashes.size > 0, true, 'session jsonl.zstd was not written')
      const keyword2 = `${keyword}-second`
      const created2 = await request('/api/v1/ai/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cwd: workspace }),
      })
      const created2Body = await created2.json()
      assert.equal(created2.status, 201, JSON.stringify(created2Body))
      const session2 = String(created2Body?.data?.sessionId || '')
      const prompted2 = await request(`/api/v1/ai/sessions/${encodeURIComponent(session2)}/prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: keyword2 }),
        signal: AbortSignal.timeout(90_000),
      })
      const prompt2Body = await prompted2.json()
      assert.equal(prompted2.status, 200, JSON.stringify(prompt2Body))
      let hit2 = false
      const secondDeadline = Date.now() + 180_000
      while (Date.now() < secondDeadline) {
        const ingested = await request('/api/v1/memory/session-ingest', { method: 'POST' })
        assert.equal(ingested.status, 200)
        const searchRes = await request(`/api/v1/memory/search?q=${encodeURIComponent(keyword2)}&cwd=${encodeURIComponent(workspace)}`)
        hit2 = searchFoundKeyword(await searchRes.text(), keyword2)
        if (searchRes.status !== 502 && hit2) break
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      assert.equal(hit2, true, `second session missed ${keyword2}`)
      const hashesAfterSecond = await sessionLogHashes(home)
      for (const [path, hash] of hashes) {
        assert.equal(hashesAfterSecond.get(path), hash, `session log changed ${path}`)
      }
      child.kill('SIGTERM')
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          try { child.kill('SIGKILL') } catch {}
          resolve()
        }, 8000)
        child.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })
      await reapHomeProcesses(home)
      output.text = ''
      child = spawn(process.execPath, ['runtime/server.mjs'], {
        cwd: repoRoot,
        env: hostEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.stdout.on('data', (chunk) => { output.text += chunk.toString() })
      child.stderr.on('data', (chunk) => { output.text += chunk.toString() })
      const restarted = Date.now()
      let port2 = 0
      while (Date.now() - restarted < 30_000) {
        if (child.exitCode != null || child.signalCode != null) {
          throw new Error(`restart exited ${child.exitCode ?? child.signalCode}\n${output.text.slice(-3000)}`)
        }
        const match = output.text.match(/FDE_LISTENING (\d+)/)
        if (match) {
          port2 = Number(match[1])
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      if (!port2) throw new Error(`restart did not listen\n${output.text.slice(-3000)}`)
      const request2 = (path, options = {}) => fetch(`http://127.0.0.1:${port2}${path}`, {
        ...options,
        headers: { origin: `http://127.0.0.1:${port2}`, ...(options.headers || {}) },
      })
      const connect2 = await request2('/api/v1/ai/connect', { method: 'POST' })
      const connect2Body = await connect2.json()
      assert.equal(connect2.status, 200, JSON.stringify(connect2Body))
      const readyDeadline2 = Date.now() + 180_000
      let ready2 = null
      while (Date.now() < readyDeadline2) {
        const readyRes = await request2('/api/v1/memory/ready')
        ready2 = await readyRes.json()
        if (ready2?.data?.ready === true) break
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      assert.equal(ready2?.data?.ready, true, `restart ready ${JSON.stringify(ready2)} ${output.text.slice(-1500)}`)
      for (const term of [keyword, keyword2]) {
        let found = false
        const deadline = Date.now() + 60_000
        while (Date.now() < deadline) {
          const ingested = await request2('/api/v1/memory/session-ingest', { method: 'POST' })
          assert.equal(ingested.status, 200)
          const searchRes = await request2(`/api/v1/memory/search?q=${encodeURIComponent(term)}&cwd=${encodeURIComponent(workspace)}`)
          found = searchFoundKeyword(await searchRes.text(), term)
          if (searchRes.status !== 502 && found) break
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
        assert.equal(found, true, `restart missed ${term}`)
      }
      const hashesAfterRestart = await sessionLogHashes(home)
      for (const [path, hash] of hashes) {
        assert.equal(hashesAfterRestart.get(path), hash, `restart rewrote ${path}`)
        assert.equal(existsSync(path), true)
      }
    } finally {
      if (child.exitCode == null && child.signalCode == null) child.kill('SIGTERM')
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          try { child.kill('SIGKILL') } catch {}
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
