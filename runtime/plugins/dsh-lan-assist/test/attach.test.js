import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createAttachStore,
  listHasBytes,
  publicAttach,
  requestHasFiles,
  sanitizeAttach,
  stripAttach,
} from '../attach.js'
import { ATTACH_MAX_BYTES } from '../home.js'

test('sanitize keeps a nameless row as file and flags oversize', () => {
  const rows = sanitizeAttach([
    { name: 'ok.txt', data: 'echo' },
    { name: '', data: 'nope' },
    { name: 'big.bin', size: ATTACH_MAX_BYTES + 1, data: 'x' },
  ])
  assert.equal(rows.length, 3)
  assert.equal(rows[1].name, 'file')
  assert.equal(rows[0].over, false)
  assert.equal(rows[2].over, true)
  assert.equal(listHasBytes(rows), true)
})

test('publicAttach keeps a pointer flag; stripAttach drops bytes', () => {
  const pub = publicAttach([{ name: 'a.png', size: 4, mime: 'image/png', fileId: 'req.0' }])
  assert.equal(pub[0].hasData, true)
  assert.equal(pub[0].fileId, undefined)
  const stripped = stripAttach([{ name: 'a.png', size: 4, mime: 'image/png', data: 'xxxx', over: true }])
  assert.equal(stripped[0].hasData, false)
  assert.equal(stripped[0].over, true)
  assert.equal(stripped[0].data, undefined)
})

test('createAttachStore persists bytes off the mailbox JSON', async () => {
  const mem = {}
  const files = {
    async put(id, data) { mem[id] = data },
    async get(id) { return mem[id] || '' },
  }
  const attach = createAttachStore(files)
  const stored = await attach.persistList('req_a', [{ name: 'note.txt', data: 'hello', size: 5, mime: 'text/plain' }])
  assert.equal(stored[0].fileId, 'req_a.0')
  assert.equal(stored[0].data, undefined)
  assert.equal(mem['req_a.0'], 'hello')
  const live = await attach.hydrateList(stored)
  assert.equal(live[0].data, 'hello')
  assert.equal(await attach.bytesOf(stored[0]), 'hello')
})

test('spillOnce moves in-JSON bytes onto the file store once', async () => {
  const mem = {}
  const files = {
    async put(id, data) { mem[id] = data },
    async get(id) { return mem[id] || '' },
  }
  const attach = createAttachStore(files)
  let state = {
    requests: {
      req_a: {
        id: 'req_a',
        attachments: [{ name: 'a.txt', data: 'aa' }],
        replyAttachments: [{ name: 'r.txt', data: 'rr' }],
        replies: [{ attachments: [{ name: 'p.txt', data: 'pp' }] }],
      },
    },
  }
  const store = {
    async get() { return state },
    async update(fn) { fn(state) },
  }
  await attach.spillOnce(store)
  assert.equal(mem['req_a.0'], 'aa')
  assert.equal(mem['req_a.reply.0'], 'rr')
  assert.equal(mem['req_a.r0.0'], 'pp')
  assert.equal(state.requests.req_a.attachments[0].data, undefined)
  assert.equal(state.requests.req_a.attachments[0].fileId, 'req_a.0')
  assert.equal(requestHasFiles(state.requests.req_a), true)
})
