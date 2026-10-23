import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const unnamed = Object.freeze([{ sessionId: 'sess-organize', title: '未命名会话' }])
const organized = Object.freeze([{ sessionId: 'sess-organize', title: '整理待办 · 10/19 14:05' }])

function defer() {
  let release
  const promise = new Promise((resolve) => {
    release = resolve
  })
  return { promise, release }
}

test('a later-issued session list keeps the renamed title when an earlier response lands after', async () => {
  const { reloadSessionList } = await import('../../src/lib/ai-session-list.ts')
  const gate = { generation: 0 }
  let shown = []
  const created = defer()
  const createdLoad = reloadSessionList(
    gate,
    () => created.promise.then(() => unnamed),
    (rows) => { shown = rows },
  )
  const renamedLoad = reloadSessionList(
    gate,
    async () => organized,
    (rows) => { shown = rows },
  )
  await renamedLoad
  console.log(JSON.stringify({ phase: 'rename response landed', title: shown[0]?.title ?? null }))
  assert.equal(shown[0]?.title, '整理待办 · 10/19 14:05')
  created.release()
  const earlierRows = await createdLoad
  console.log(JSON.stringify({
    phase: 'earlier create response landed',
    published: shown[0]?.title ?? null,
    returned: earlierRows[0]?.title ?? null,
  }))
  assert.equal(shown[0]?.title, '整理待办 · 10/19 14:05', 'sidebar keeps the renamed title after the earlier list returns')
  shown = earlierRows
  assert.equal(shown[0]?.title, '整理待办 · 10/19 14:05', 'publishing the earlier reload return keeps the renamed title')
})

test('one session list reload publishes that list', async () => {
  const { reloadSessionList } = await import('../../src/lib/ai-session-list.ts')
  const gate = { generation: 0 }
  let shown = []
  await reloadSessionList(gate, async () => organized, (rows) => { shown = rows })
  assert.equal(shown[0]?.title, '整理待办 · 10/19 14:05')
})

test('a finished reload still publishes the next list', async () => {
  const { reloadSessionList } = await import('../../src/lib/ai-session-list.ts')
  const gate = { generation: 0 }
  let shown = []
  await reloadSessionList(gate, async () => unnamed, (rows) => { shown = rows })
  assert.equal(shown[0]?.title, '未命名会话')
  await reloadSessionList(gate, async () => organized, (rows) => { shown = rows })
  assert.equal(shown[0]?.title, '整理待办 · 10/19 14:05')
})

test('session list responses that return in issue order still end on the renamed title', async () => {
  const { reloadSessionList } = await import('../../src/lib/ai-session-list.ts')
  const gate = { generation: 0 }
  let shown = []
  const created = defer()
  const renamed = defer()
  const createdLoad = reloadSessionList(
    gate,
    () => created.promise.then(() => unnamed),
    (rows) => { shown = rows },
  )
  const renamedLoad = reloadSessionList(
    gate,
    () => renamed.promise.then(() => organized),
    (rows) => { shown = rows },
  )
  created.release()
  await createdLoad
  renamed.release()
  await renamedLoad
  assert.equal(shown[0]?.title, '整理待办 · 10/19 14:05')
})
