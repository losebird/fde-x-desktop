import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { adaptSessionPersistence, createSessionIngest, eventTime, headerCwd, headerId, mayLook } from '../session-ingest.js'

test('mayLook treats see_file as a 点头', () => {
  assert.equal(mayLook({ type: 'user/message', data: { content: '请看发票' } }), false)
  assert.equal(mayLook({ type: 'tool/call', data: { name: 'see_file', path: '/tmp/a.pdf' } }), true)
  assert.equal(mayLook({ type: 'assistant/message', data: { name: 'search_text' } }), false)
})

test('eventTime reads DSH event.time milliseconds', () => {
  assert.equal(eventTime({ type: 'user/message', seq: 1, time: 1787467138598, data: {} }), new Date(1787467138598).toISOString())
  assert.equal(eventTime({ type: 'user/message', seq: 1, data: { content: 'hi' } }), '')
})

function event(seq, text, time) {
  const row = { seq, type: 'user/message', data: { content: text, source: { kind: 'user' }, id: `m${seq}` } }
  if (time != null) row.time = time
  return row
}

async function readStamps(root) {
  try {
    return JSON.parse(await readFile(join(root, 'semantic-os', 'session-stamps.json'), 'utf8'))
  } catch {
    return {}
  }
}

async function withHome(fn) {
  const previous = process.env.DSH_HOME
  const root = await mkdtemp(join(tmpdir(), 'dsos-session-ingest-'))
  process.env.DSH_HOME = root
  try { await fn(root) } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(root, { recursive: true, force: true })
  }
}

function fakeSidecar(port, responder) {
  const server = new (class {
    snapshot() { return { ready: true, port } }
    getApiKey() { return 'test-token' }
  })()
  return Object.assign(server, { responder })
}

test('header helpers unwrap DSH list snapshots', () => {
  const snap = { header: { id: 's-new', cwd: '/ws/new' }, revision: 'r1', eventCount: 2 }
  assert.equal(headerId(snap), 's-new')
  assert.equal(headerCwd(snap), '/ws/new')
  assert.equal(headerId({ id: 'legacy', cwd: '/ws/old' }), 'legacy')
})

test('adaptSessionPersistence flattens DSH list snapshots', async () => {
  const adapted = adaptSessionPersistence({
    async list() {
      return [{ header: { id: 's1', cwd: '/ws/new', createdAt: 9 }, revision: 'r1' }]
    },
    async open() {
      return { read: async () => ({ events: [] }), close: async () => {} }
    },
  })
  assert.deepEqual(await adapted.list(), [{ id: 's1', cwd: '/ws/new', createdAt: 9, updatedAt: 9 }])
})

test('session ingest reads DSH sessionPersistence snapshots via open/read', async () => {
  await withHome(async () => {
    const { createServer } = await import('node:http')
    const calls = []
    const server = createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        calls.push(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const starts = []
    const persistence = {
      async list() {
        return [{ header: { id: 's1', cwd: process.cwd() }, revision: 'r1', eventCount: 1 }]
      },
      async open(_id, access) {
        assert.equal(access, 'read')
        return {
          async read(from = 0) {
            starts.push(from)
            return { events: from === 0 ? [event(0, 'new workspace first')] : [event(1, 'new workspace second')] }
          },
          async close() {},
        }
      },
    }
    const ingest = createSessionIngest({
      sidecar: fakeSidecar(server.address().port),
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue() {} },
      getConfig: () => ({}),
    })
    try {
      const first = await ingest.tick()
      assert.equal(first.error, '')
      assert.equal(first.ok, true)
      assert.equal(first.ingested, 1)
      assert.ok(calls.some((row) => row.op === 'index_passages'))
      assert.equal((await ingest.tick()).ok, true)
      assert.deepEqual(starts, [0, 0, 1])
    } finally {
      server.close()
    }
  })
})

test('session ingest reads from committed cursor on the next tick', async () => {
  await withHome(async () => {
    const { createServer } = await import('node:http')
    const calls = []
    const server = createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        calls.push(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true, steps: ['extract', 'kg_build', 'dedup'] }))
      })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const starts = []
    const persistence = {
      async list() { return [{ id: 's1', cwd: process.cwd() }] },
      async readFrom(_id, from) {
        starts.push(from)
        return { events: from === 0 ? [event(0, 'first')] : [event(1, 'second')] }
      },
    }
    const enqueued = []
    const ingest = createSessionIngest({
      sidecar: fakeSidecar(server.address().port),
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue: (cwd, texts) => enqueued.push({ cwd, texts }) },
      getConfig: () => ({ sessionIngestIntervalMin: 30 }),
    })
    try {
      assert.equal((await ingest.tick()).ok, true)
      assert.equal((await ingest.tick()).ok, true)
      // Second tick backfills event times onto already-ingested session nodes
      // (readFrom 0) before reading the next seq. Fixture events have no time,
      // so stampExisting does not post.
      assert.deepEqual(starts, [0, 0, 1])
      // Chat text stays in DSH logs. Ticks index passages; extract is hit/nod/idle, not a full replay.
      assert.equal(calls.filter((row) => row.op === 'upsert_documents').length, 0)
      assert.equal(enqueued.length, 0)
      assert.ok(calls.some((row) => row.op === 'index_passages'))
    } finally {
      server.close()
    }
  })
})

test('chat ingest advances the cursor without copying diaries into the graph', async () => {
  await withHome(async () => {
    const starts = []
    const persistence = {
      async list() { return [{ id: 's1', cwd: process.cwd() }] },
      async readFrom(_id, from) { starts.push(from); return { events: [event(0, 'retry me')] } },
    }
    const ingest = createSessionIngest({
      sidecar: { snapshot: () => ({ ready: true, port: 1 }), getApiKey: () => '' },
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue() {} },
      getConfig: () => ({}),
    })
    assert.equal((await ingest.tick()).ok, true)
    assert.equal((await ingest.tick()).ok, true)
    assert.deepEqual(starts, [0, 0, 1])
  })
})

test('session ingest does not let 眼睛 read an un-nodded attachment', async () => {
  await withHome(async () => {
    const { createServer } = await import('node:http')
    const calls = []
    const server = createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        calls.push(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    let described = 0
    const persistence = {
      async list() { return [{ id: 's1', cwd: process.cwd() }] },
      async readFrom() {
        return {
          events: [{
            seq: 0,
            type: 'user/message',
            data: {
              source: { kind: 'user' },
              content: [
                { type: 'text', text: '请看这张发票' },
                { type: 'image', attachment: { attachmentId: 'sha256:' + 'a'.repeat(64), mediaType: 'image/png' } },
              ],
            },
          }],
        }
      },
    }
    const ingest = createSessionIngest({
      sidecar: fakeSidecar(server.address().port),
      getPersistence: () => persistence,
      getEyes: () => ({
        describe: async () => {
          described += 1
          return { text: '发票金额不应自己爬进来' }
        },
      }),
      getExtract: () => null,
      extractQueue: { enqueue: () => undefined },
      getConfig: () => ({}),
    })
    try {
      assert.equal((await ingest.tick()).ok, true)
      assert.equal(described, 0)
      assert.ok(!calls.some((row) => String((row.args && row.args.texts || []).map((item) => item.text).join('')).includes('发票金额')))
      assert.ok(!calls.some((row) => row.op === 'ingest_directory'))
    } finally {
      server.close()
    }
  })
})

test('session ingest does not dump a pasted file path into ingest_directory', async () => {
  await withHome(async () => {
    const { createServer } = await import('node:http')
    const calls = []
    const server = createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        calls.push(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const persistence = {
      async list() { return [{ id: 's1', cwd: process.cwd() }] },
      async readFrom() {
        return {
          events: [{
            seq: 0,
            type: 'user/message',
            data: {
              source: { kind: 'user' },
              content: '请看 /tmp/notes.pdf',
            },
          }],
        }
      },
    }
    const ingest = createSessionIngest({
      sidecar: fakeSidecar(server.address().port),
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue: () => undefined },
      getConfig: () => ({}),
    })
    try {
      assert.equal((await ingest.tick()).ok, true)
      assert.ok(!calls.some((row) => row.op === 'ingest_directory'))
    } finally {
      server.close()
    }
  })
})

test('a nodded look that sees nothing records 未看见', async () => {
  await withHome(async () => {
    const { createServer } = await import('node:http')
    const calls = []
    const server = createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        calls.push(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const persistence = {
      async list() { return [{ id: 's1', cwd: process.cwd() }] },
      async readFrom() {
        return {
          events: [{
            seq: 0,
            type: 'user/message',
            data: {
              source: { kind: 'user' },
              nodded: true,
              content: [
                { type: 'text', text: '看看这张发票' },
                { type: 'image', attachment: { attachmentId: 'sha256:' + 'b'.repeat(64), mediaType: 'image/png' } },
              ],
            },
          }],
        }
      },
    }
    const ingest = createSessionIngest({
      sidecar: fakeSidecar(server.address().port),
      getPersistence: () => persistence,
      getEyes: () => ({ describe: async () => ({ text: '' }) }),
      getExtract: () => null,
      extractQueue: { enqueue: () => undefined },
      getConfig: () => ({}),
    })
    try {
      assert.equal((await ingest.tick()).ok, true)
      const sight = calls.find((row) => row.op === 'record_sight')
      assert.ok(sight)
      assert.equal(sight.args.nodded, true)
      assert.equal(sight.args.text, '')
    } finally {
      server.close()
    }
  })
})

test('failed stamp_session_times is not recorded as done and does not move the cursor', async () => {
  await withHome(async (root) => {
    const { createServer } = await import('node:http')
    const calls = []
    const server = createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        calls.push(payload)
        const fail = payload.op === 'stamp_session_times'
        res.writeHead(fail ? 400 : 200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(fail ? { error: 'STAMP_FAILED' } : { ok: true, stamped: 0 }))
      })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const starts = []
    const persistence = {
      async list() { return [{ id: 's1', cwd: process.cwd() }] },
      async readFrom(_id, from) {
        starts.push(from)
        if (from === 0) return { events: [event(0, 'first', 1787660875673)] }
        return { events: [event(1, 'second', 1787660876000)] }
      },
    }
    const ingest = createSessionIngest({
      sidecar: fakeSidecar(server.address().port),
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue: () => undefined },
      getConfig: () => ({}),
    })
    try {
      assert.equal((await ingest.tick()).ok, true)
      assert.equal((await ingest.tick()).ok, true)
      assert.deepEqual(starts, [0, 0, 1])
      assert.equal(calls.filter((row) => row.op === 'stamp_session_times').length, 1)
      assert.deepEqual(await readStamps(root), {})
      const cursors = JSON.parse(await readFile(join(root, 'semantic-os', 'session-cursors.json'), 'utf8'))
      assert.equal(cursors.s1, 1)
    } finally {
      server.close()
    }
  })
})

test('a legacy numeric stamp is not treated as done', async () => {
  await withHome(async (root) => {
    const { createServer } = await import('node:http')
    const calls = []
    const server = createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        calls.push(payload)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(payload.op === 'stamp_session_times' ? { ok: true, stamped: 1 } : { ok: true }))
      })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    await mkdir(join(root, 'semantic-os'), { recursive: true })
    await writeFile(join(root, 'semantic-os', 'session-cursors.json'), `${JSON.stringify({ s1: 0 }, null, 2)}\n`)
    await writeFile(join(root, 'semantic-os', 'session-stamps.json'), `${JSON.stringify({ s1: 1787550460444 }, null, 2)}\n`)
    const starts = []
    const persistence = {
      async list() { return [{ id: 's1', cwd: process.cwd() }] },
      async readFrom(_id, from) {
        starts.push(from)
        if (from === 0) return { events: [event(0, 'first', 1787660875673)] }
        return { events: [event(1, 'second', 1787660876000)] }
      },
    }
    const ingest = createSessionIngest({
      sidecar: fakeSidecar(server.address().port),
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue: () => undefined },
      getConfig: () => ({}),
    })
    try {
      assert.equal((await ingest.tick()).ok, true)
      assert.ok(starts.includes(0))
      assert.equal(calls.filter((row) => row.op === 'stamp_session_times').length, 1)
      const stamps = await readStamps(root)
      assert.equal(stamps.s1.cursor, 1)
      assert.ok(Number.isFinite(stamps.s1.at))
    } finally {
      server.close()
    }
  })
})

test('a successful stamp is not repeated on the next tick', async () => {
  await withHome(async (root) => {
    const { createServer } = await import('node:http')
    const calls = []
    const server = createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        calls.push(payload)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(payload.op === 'stamp_session_times' ? { ok: true, stamped: 1 } : { ok: true }))
      })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const starts = []
    const persistence = {
      async list() { return [{ id: 's1', cwd: process.cwd() }] },
      async readFrom(_id, from) {
        starts.push(from)
        if (from === 0) return { events: [event(0, 'first', 1787660875673)] }
        if (from === 1) return { events: [event(1, 'second', 1787660876000)] }
        return { events: [] }
      },
    }
    const ingest = createSessionIngest({
      sidecar: fakeSidecar(server.address().port),
      getPersistence: () => persistence,
      getEyes: () => null,
      getExtract: () => null,
      extractQueue: { enqueue: () => undefined },
      getConfig: () => ({}),
    })
    try {
      assert.equal((await ingest.tick()).ok, true)
      assert.equal((await ingest.tick()).ok, true)
      assert.equal((await ingest.tick()).ok, true)
      assert.deepEqual(starts, [0, 0, 1, 2])
      assert.equal(calls.filter((row) => row.op === 'stamp_session_times').length, 1)
      const stamps = await readStamps(root)
      assert.equal(stamps.s1.cursor, 1)
    } finally {
      server.close()
    }
  })
})
