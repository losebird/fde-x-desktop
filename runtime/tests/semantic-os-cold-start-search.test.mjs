import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const repoRoot = join(import.meta.dirname, '../..')
const SNAPSHOT = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS || ''

function snapshotMounted() {
  return Boolean(SNAPSHOT) && existsSync(join(SNAPSHOT, 'session-ingest.js'))
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

function passageTexts(cwd) {
  const file = join(cwd, '.dsh', 'semantic-os', 'passages', 'texts.json')
  if (!existsSync(file)) return ''
  return readFileSync(file, 'utf8')
}

function searchPassages(cwd, keyword) {
  const raw = passageTexts(cwd)
  if (!raw) return false
  const parsed = JSON.parse(raw)
  const items = Array.isArray(parsed.items) ? parsed.items : []
  return items.some((item) => String(item && item.text || '').includes(keyword))
}

async function loadCommit() {
  const file = join(repoRoot, 'runtime/vendor-overlays/dsh-semantic-os/session-index-commit.js')
  if (!existsSync(file)) return null
  return import(pathToFileURL(file).href)
}

function userEvent(seq, text) {
  return {
    seq,
    type: 'user/message',
    ts: 1_700_000_000_000 + seq,
    data: { content: text, source: { kind: 'user' } },
  }
}

function persistenceOf(sessions) {
  return {
    async list() {
      return sessions.map((session) => ({ id: session.id, cwd: session.cwd }))
    },
    async readFrom(id, fromSeq) {
      const session = sessions.find((item) => item.id === id)
      const events = session ? session.events.filter((event) => event.seq >= fromSeq) : []
      return { events }
    },
  }
}

function indexServer({ failFirst }) {
  let calls = 0
  return listen((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      let body = {}
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { body = {} }
      if (body.op !== 'index_passages') {
        res.end(JSON.stringify({ ok: true }))
        return
      }
      calls += 1
      const rows = body.args && Array.isArray(body.args.rows) ? body.args.rows : []
      if (failFirst && calls === 1) {
        res.end(JSON.stringify({ ok: false, error: 'INDEX_NOT_STORED' }))
        return
      }
      const cwd = String(body.cwd || '')
      const dir = join(cwd, '.dsh', 'semantic-os', 'passages')
      const file = join(dir, 'texts.json')
      let items = []
      try { items = JSON.parse(readFileSync(file, 'utf8')).items || [] } catch { items = [] }
      const ids = new Set(rows.map((row) => row.id))
      items = items.filter((item) => !ids.has(item.id))
      for (const row of rows) items.push({ id: row.id, text: row.text, time: row.time || 0 })
      mkdir(dir, { recursive: true }).then(() => writeFile(file, JSON.stringify({ items }))).then(() => {
        res.end(JSON.stringify({ ok: true, updated: rows.length, count: items.length }))
      }).catch((error) => {
        res.statusCode = 500
        res.end(JSON.stringify({ error: String(error) }))
      })
    })
  })
}

async function freezeLog(home, id) {
  const file = join(home, 'sessions', `${id}.jsonl.zstd`)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, Buffer.from(`frozen-session-log:${id}\n`))
  const hash = createHash('sha256').update(await readFile(file)).digest('hex')
  return { file, hash }
}

describe('semantic-os cold start search', { concurrency: false }, () => {
  test('cold start first session is searchable when the un-awaited index write does not store passages', async (t) => {
    if (!snapshotMounted()) {
      t.skip('FDE_PLUGIN_DSH_SEMANTIC_OS is not mounted')
      return
    }
    const home = await mkdtemp(join(tmpdir(), 'fde-m1-cold-home-'))
    const cwd = await mkdtemp(join(tmpdir(), 'fde-m1-cold-cwd-'))
    const keyword = `m1cold-${Date.now().toString(36)}-first`
    const keyword2 = `${keyword}-second`
    const id = 'sess-cold-1'
    const id2 = 'sess-cold-2'
    const sessions = [{ id, cwd, events: [userEvent(17, keyword)] }]
    const { file, hash } = await freezeLog(home, id)
    const previousHome = process.env.DSH_HOME
    process.env.DSH_HOME = home
    const { server, port } = await indexServer({ failFirst: true })
    const mod = await import(pathToFileURL(join(SNAPSHOT, 'session-ingest.js')).href)
    const { postPython } = await import(pathToFileURL(join(SNAPSHOT, 'ingest.js')).href)
    const persistence = persistenceOf(sessions)
    const sidecar = { snapshot: () => ({ ready: true, port }), getApiKey: () => '' }
    const ingest = mod.createSessionIngest({
      sidecar,
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue() {}, snapshot() { return null } },
      getConfig: () => ({ sessionIngestIntervalMin: 30 }),
    })
    const commit = await loadCommit()
    const hook = commit
      ? commit.attachSessionIndexCommit({
        sidecar,
        getPersistence: () => persistence,
        postPython,
        eventText: mod.eventText,
        headerId: mod.headerId,
        headerCwd: mod.headerCwd,
      })
      : null
    try {
      await ingest.tick()
      if (hook) await hook.whenSettled()
      const cursorText = existsSync(join(home, 'semantic-os', 'session-cursors.json'))
        ? readFileSync(join(home, 'semantic-os', 'session-cursors.json'), 'utf8')
        : ''
      assert.equal(
        searchPassages(cwd, keyword),
        true,
        `cold start missed ${keyword} cursor=${cursorText} passages=${passageTexts(cwd)}`,
      )
      sessions.push({ id: id2, cwd, events: [userEvent(4, keyword2)] })
      await freezeLog(home, id2)
      await ingest.tick()
      if (hook) await hook.whenSettled()
      assert.equal(searchPassages(cwd, keyword2), true, `second session missed ${keyword2} passages=${passageTexts(cwd)}`)
      assert.equal(searchPassages(cwd, keyword), true, 'first session disappeared after the second ingest')
      assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), hash)
      assert.equal(existsSync(file), true)
    } finally {
      if (hook) hook.close()
      ingest.stop()
      if (previousHome == null) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      await new Promise((resolve) => server.close(resolve))
      await rm(home, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('restart still searches a session whose cursor advanced ahead of passages', async (t) => {
    if (!snapshotMounted()) {
      t.skip('FDE_PLUGIN_DSH_SEMANTIC_OS is not mounted')
      return
    }
    const home = await mkdtemp(join(tmpdir(), 'fde-m1-restart-home-'))
    const cwd = await mkdtemp(join(tmpdir(), 'fde-m1-restart-cwd-'))
    const keyword = `m1cold-${Date.now().toString(36)}-restart`
    const id = 'sess-restart'
    const sessions = [{ id, cwd, events: [userEvent(17, keyword)] }]
    const { file, hash } = await freezeLog(home, id)
    await mkdir(join(home, 'semantic-os'), { recursive: true })
    await writeFile(join(home, 'semantic-os', 'session-cursors.json'), `${JSON.stringify({ [id]: 17 }, null, 2)}\n`)
    const previousHome = process.env.DSH_HOME
    process.env.DSH_HOME = home
    const { server, port } = await indexServer({ failFirst: false })
    const mod = await import(pathToFileURL(join(SNAPSHOT, 'session-ingest.js')).href)
    const { postPython } = await import(pathToFileURL(join(SNAPSHOT, 'ingest.js')).href)
    const persistence = persistenceOf(sessions)
    const sidecar = { snapshot: () => ({ ready: true, port }), getApiKey: () => '' }
    const ingest = mod.createSessionIngest({
      sidecar,
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue() {}, snapshot() { return null } },
      getConfig: () => ({ sessionIngestIntervalMin: 30 }),
    })
    const commit = await loadCommit()
    const hook = commit
      ? commit.attachSessionIndexCommit({
        sidecar,
        getPersistence: () => persistence,
        postPython,
        eventText: mod.eventText,
        headerId: mod.headerId,
        headerCwd: mod.headerCwd,
      })
      : null
    try {
      if (hook) await hook.whenSettled()
      await ingest.tick()
      if (hook) await hook.whenSettled()
      const cursorText = existsSync(join(home, 'semantic-os', 'session-cursors.json'))
        ? readFileSync(join(home, 'semantic-os', 'session-cursors.json'), 'utf8')
        : ''
      assert.equal(
        searchPassages(cwd, keyword),
        true,
        `restart missed ${keyword} cursor=${cursorText} passages=${passageTexts(cwd)}`,
      )
      assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), hash)
      assert.equal(existsSync(file), true)
    } finally {
      if (hook) hook.close()
      ingest.stop()
      if (previousHome == null) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      await new Promise((resolve) => server.close(resolve))
      await rm(home, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
