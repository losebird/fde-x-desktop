import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore, CONVERSATIONS_REL, LETTERS_BAK, emptyState } from '../store.js'

test('first letter save keeps a bak that later saves do not overwrite', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dla-store-'))
  const store = createStore({ root: home })
  await store.update((s) => {
    Object.assign(s, emptyState())
    s.requests = { req_1: { id: 'req_1', excerpt: '先切' } }
  })
  const bak = join(home, 'lan-assist', LETTERS_BAK)
  const first = await readFile(bak, 'utf8')
  assert.match(first, /req_1/)
  await store.update((s) => {
    s.requests.req_2 = { id: 'req_2', excerpt: '第二封' }
  })
  const again = await readFile(bak, 'utf8')
  assert.equal(again, first)
  assert.doesNotMatch(again, /req_2/)
  const proj = JSON.parse(await readFile(join(home, 'lan-assist', CONVERSATIONS_REL), 'utf8'))
  assert.equal(proj.some((row) => row && row.requestId === 'req_2'), true)
  const live = JSON.parse(await readFile(join(home, 'lan-assist', 'state.json'), 'utf8'))
  assert.equal(live.requests, undefined)
  assert.equal(live.conversations.req_2.excerpt, '第二封')
  assert.equal(live.conversations.req_2.messages, undefined)
})

test('loads conversations as the letter map and still reads old requests', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dla-store-'))
  const root = join(home, 'lan-assist')
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'state.json'), JSON.stringify({
    version: 1,
    conversations: { req_c: { id: 'req_c', excerpt: '会话' } },
    peers: {},
  }), 'utf8')
  const store = createStore({ root: home })
  const state = await store.get()
  assert.equal(state.requests.req_c.excerpt, '会话')
  assert.equal(state.conversations.req_c.excerpt, '会话')
  const home2 = await mkdtemp(join(tmpdir(), 'dla-store-'))
  const root2 = join(home2, 'lan-assist')
  await mkdir(root2, { recursive: true })
  await writeFile(join(root2, 'state.json'), JSON.stringify({
    version: 1,
    requests: { req_old: { id: 'req_old', excerpt: '旧信封' } },
    peers: {},
  }), 'utf8')
  const old = createStore({ root: home2 })
  const loaded = await old.get()
  assert.equal(loaded.requests.req_old.excerpt, '旧信封')
  await old.update((s) => { s.requests.req_old.excerpt = '已迁' })
  const disk = JSON.parse(await readFile(join(root2, 'state.json'), 'utf8'))
  assert.equal(disk.requests, undefined)
  assert.equal(disk.conversations.req_old.excerpt, '已迁')
})

test('corrupt state.json falls back to letters bak', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dla-store-'))
  const root = join(home, 'lan-assist')
  await mkdir(root, { recursive: true })
  await writeFile(join(root, LETTERS_BAK), JSON.stringify({
    version: 1,
    requests: { req_bak: { id: 'req_bak', excerpt: '备份' } },
    peers: {},
  }), 'utf8')
  await writeFile(join(root, 'state.json'), '{not json', 'utf8')
  const store = createStore({ root: home })
  const state = await store.get()
  assert.equal(state.requests.req_bak.excerpt, '备份')
  await rm(home, { recursive: true, force: true })
})
