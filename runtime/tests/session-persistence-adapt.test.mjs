import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adaptSessionPersistence } from '../plugins/dsh-semantic-os/session-persistence-adapt.js'

const overlayIndex = readFileSync(join(import.meta.dirname, '../plugins/dsh-semantic-os/index.js'), 'utf8')

test('overlay imports adaptSessionPersistence from its own file', () => {
  assert.match(overlayIndex, /import \{ createSessionIngest, DEFAULT_SESSION_INGEST_INTERVAL_MIN, eventText, headerCwd, headerId \} from '\.\/session-ingest\.js'/)
  assert.match(overlayIndex, /import \{ adaptSessionPersistence \} from '\.\/session-persistence-adapt\.js'/)
  assert.equal(overlayIndex.includes("adaptSessionPersistence") && overlayIndex.includes("from './session-ingest.js'\nimport { adaptSessionPersistence"), true)
  assert.equal(/import \{[^}]*adaptSessionPersistence[^}]*\} from '\.\/session-ingest\.js'/.test(overlayIndex), false)
})

test('adaptSessionPersistence maps Host snapshots onto list and readFrom', async () => {
  assert.equal(adaptSessionPersistence(null), null)
  const listOnly = { async list() { return [] } }
  assert.equal(adaptSessionPersistence(listOnly), listOnly)
  const already = { async list() { return [] }, async readFrom() { return { events: [] } } }
  const wrapped = adaptSessionPersistence(already)
  assert.notEqual(wrapped, already)
  assert.deepEqual(await wrapped.list(), [])
  assert.deepEqual(await wrapped.readFrom('already', 0), { events: [] })

  const opened = []
  const closed = []
  const reads = []
  const cwd = '/tmp/m1-workspace'
  const adapted = adaptSessionPersistence({
    async list() {
      return [
        { header: { id: 'sess-1', cwd, createdAt: 10 }, revision: 'r1', eventCount: 2 },
        { header: { meta: { id: 'sess-2', cwd: '/tmp/other' } }, revision: 'r2' },
      ]
    },
    async open(id, access) {
      opened.push([id, access])
      return {
        async read(offset) {
          reads.push([id, offset])
          return {
            eventState: 'shared',
            events: [{ type: 'user/message', seq: offset, time: 10, data: { content: 'hi' } }],
          }
        },
        async close() { closed.push(id) },
      }
    },
  })
  const rows = await adapted.list()
  assert.deepEqual(rows.map((row) => ({ id: row.id, cwd: row.cwd })), [
    { id: 'sess-1', cwd },
    { id: '', cwd: '/tmp/other' },
  ])
  assert.equal(rows[0].header, undefined)
  assert.equal(rows[0].meta, undefined)
  assert.equal(rows[0].createdAt, 10)
  assert.equal(rows[0].updatedAt, 10)
  const packed = await adapted.readFrom('sess-1', 4)
  assert.equal(packed.events[0].seq, 4)
  assert.deepEqual(opened, [['sess-1', 'read']])
  assert.deepEqual(reads, [['sess-1', 4]])
  assert.deepEqual(closed, ['sess-1'])
})

test('readFrom does not touch a handle when open fails', async () => {
  let closed = 0
  const adapted = adaptSessionPersistence({
    async list() { return [] },
    async open() {
      throw new Error('log missing')
    },
    async close() { closed += 1 },
  })
  await assert.rejects(() => adapted.readFrom('missing', 0), /log missing/)
  assert.equal(closed, 0)
})

test('overlay commits passage rows before a session cursor counts', () => {
  assert.match(overlayIndex, /attachSessionIndexCommit/)
  assert.match(overlayIndex, /indexCommit\.poke\(\)/)
  assert.match(overlayIndex, /indexCommit\.close\(\)/)
})

test('readFrom still closes the handle when read fails', async () => {
  let closed = false
  const adapted = adaptSessionPersistence({
    async list() { return [] },
    async open() {
      return {
        async read() { throw new Error('log unreadable') },
        async close() { closed = true },
      }
    },
  })
  await assert.rejects(() => adapted.readFrom('sess-1', 0), /log unreadable/)
  assert.equal(closed, true)
})
