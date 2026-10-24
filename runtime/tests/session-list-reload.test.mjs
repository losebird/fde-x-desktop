import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

function bootstrapBody(source) {
  const start = source.indexOf('async function bootstrap()')
  const end = source.indexOf('void bootstrap()', start)
  assert.ok(start >= 0 && end > start, 'bootstrap function is in AI.tsx')
  return source.slice(start, end)
}

function bootstrapListUsesGate(body) {
  const publishes = body.match(/setRemoteSessions\s*\(/g) || []
  if (/reloadRemoteSessions\s*\(/.test(body)) return publishes.length === 0
  if (publishes.length !== 1) return false
  const gateAt = body.search(/reloadSessionList\(\s*sessionListGate\.current\s*,/)
  const listAt = body.indexOf('listAiSessions(')
  const publishAt = body.search(/setRemoteSessions\s*\(/)
  return gateAt >= 0 && gateAt < listAt && listAt < publishAt
}

test('an older bootstrap list write cannot replace a newer gated session list', async () => {
  const source = readFileSync(join(import.meta.dirname, '../../src/pages/AI.tsx'), 'utf8')
  const body = bootstrapBody(source)
  const gated = bootstrapListUsesGate(body)
  assert.equal([...source.matchAll(/ai\.session\.changed/g)].length, 1)
  const { reloadSessionList } = await import('../../src/lib/ai-session-list.ts')
  const gate = { generation: 0 }
  let shown = []
  const apply = (rows) => { shown = rows }
  const started = defer()
  const bootstrapWrite = gated
    ? reloadSessionList(gate, () => started.promise.then(() => unnamed), apply)
    : started.promise.then(() => {
      apply(unnamed)
      return unnamed
    })
  await reloadSessionList(gate, async () => organized, apply)
  console.log(JSON.stringify({
    phase: 'newer gated list landed',
    bootstrapUsesGate: gated,
    title: shown[0]?.title ?? null,
  }))
  assert.equal(shown[0]?.title, '整理待办 · 10/19 14:05')
  started.release()
  await bootstrapWrite
  console.log(JSON.stringify({
    phase: 'older bootstrap list returned',
    title: shown[0]?.title ?? null,
  }))
  assert.equal(shown[0]?.title, '整理待办 · 10/19 14:05', 'older bootstrap list must not replace the gated title')
})

const ORGANIZE_TITLE = '整理待办 · 10/24 10:40'
const ORGANIZE_ID = 'sess-organize-1024'
const ORGANIZE_CWD = '/work/demo'
const AI_PAGE = join(import.meta.dirname, '../../src/pages/AI.tsx')
const ASK_AI = join(import.meta.dirname, '../../src/lib/ask-ai.ts')

function organizeEvent() {
  return {
    type: 'ai.session.changed',
    workspaceCwd: ORGANIZE_CWD,
    payload: { kind: 'renamed', sessionId: ORGANIZE_ID, title: ORGANIZE_TITLE },
  }
}

async function sessionListModule() {
  return import('../../src/lib/ai-session-list.ts')
}

function applyListed(mod, rows, notice) {
  if (typeof mod.applySessionList === 'function') return mod.applySessionList(rows, notice)
  return Array.isArray(rows) ? rows.slice() : []
}

function noticeFrom(mod, event) {
  if (typeof mod.renamedNoticeFromEvent === 'function') return mod.renamedNoticeFromEvent(event)
  return null
}

function publishRename(mod, result, notice) {
  if (typeof mod.publishSuccessfulRename === 'function') return mod.publishSuccessfulRename(result, notice)
  return false
}

function resetTitles(mod) {
  if (typeof mod.resetRenamedSessionTitles === 'function') mod.resetRenamedSessionTitles()
}

test('gated apply writes the renamed event title when GET is unnamed or missing the id', async () => {
  const source = readFileSync(AI_PAGE, 'utf8')
  assert.equal([...source.matchAll(/ai\.session\.changed/g)].length, 1)
  const mod = await sessionListModule()
  resetTitles(mod)
  const { reloadSessionList } = mod
  const notice = noticeFrom(mod, organizeEvent())
  const gate = { generation: 0 }
  let shown = []
  await reloadSessionList(
    gate,
    async () => [{ sessionId: ORGANIZE_ID, title: '未命名会话', cwd: ORGANIZE_CWD }],
    (rows) => { shown = applyListed(mod, rows, notice) },
  )
  assert.equal(shown.find((row) => row.sessionId === ORGANIZE_ID)?.title, ORGANIZE_TITLE)

  const oldGate = { generation: 0 }
  let replaced = []
  await reloadSessionList(
    oldGate,
    async () => [{ sessionId: ORGANIZE_ID, title: '整理待办 · 10/24 10:00', cwd: ORGANIZE_CWD }],
    (rows) => { replaced = applyListed(mod, rows, notice) },
  )
  assert.equal(replaced.find((row) => row.sessionId === ORGANIZE_ID)?.title, ORGANIZE_TITLE)

  const missingGate = { generation: 0 }
  let missing = []
  await reloadSessionList(
    missingGate,
    async () => [{ sessionId: 'sess-older', title: '整理待办 · 10/24 10:00', cwd: ORGANIZE_CWD }],
    (rows) => { missing = applyListed(mod, rows, notice) },
  )
  const appended = missing.find((row) => row.sessionId === ORGANIZE_ID)
  assert.equal(appended?.title, ORGANIZE_TITLE)
  assert.equal(appended?.cwd, ORGANIZE_CWD)
  assert.equal(missing.find((row) => row.sessionId === 'sess-older')?.title, '整理待办 · 10/24 10:00')
})

test('AI.tsx keeps one ai.session.changed listener and merges that event inside the gated apply', () => {
  const source = readFileSync(AI_PAGE, 'utf8')
  assert.equal([...source.matchAll(/ai\.session\.changed/g)].length, 1)
  const start = source.indexOf("['ai.session.changed']")
  const end = source.indexOf('workspaceCwd ?', start)
  assert.ok(start >= 0 && end > start)
  const handler = source.slice(start, end)
  assert.match(handler, /\(event\)\s*=>/)
  assert.match(handler, /renamedNoticeFromEvent\(event\)/)
  assert.doesNotMatch(handler, /setRemoteSessions/)
  const reloadStart = source.indexOf('async function reloadRemoteSessions')
  const reloadEnd = source.indexOf('\n  useEffect(() => {', reloadStart)
  assert.ok(reloadStart >= 0 && reloadEnd > reloadStart)
  const reload = source.slice(reloadStart, reloadEnd)
  assert.match(reload, /setRemoteSessions\(applySessionList\(/)
})

test('a later unnamed or blank list title does not replace a successful rename', async () => {
  const mod = await sessionListModule()
  resetTitles(mod)
  const notice = { sessionId: ORGANIZE_ID, title: ORGANIZE_TITLE, cwd: ORGANIZE_CWD }
  assert.equal(publishRename(mod, undefined, notice), false)
  let shown = applyListed(mod, [{ sessionId: ORGANIZE_ID, title: '未命名会话', cwd: ORGANIZE_CWD }], null)
  assert.equal(shown[0]?.title, '未命名会话')
  assert.equal(publishRename(mod, { title: ORGANIZE_TITLE, seq: 1 }, notice), true)
  shown = applyListed(mod, [{ sessionId: ORGANIZE_ID, title: '未命名会话', cwd: ORGANIZE_CWD }], null)
  assert.equal(shown[0]?.title, ORGANIZE_TITLE)
  shown = applyListed(mod, [{ sessionId: ORGANIZE_ID, title: '   ', cwd: ORGANIZE_CWD }], null)
  assert.equal(shown[0]?.title, ORGANIZE_TITLE)
  shown = applyListed(mod, [{ sessionId: ORGANIZE_ID, title: '待办 · 别的会话', cwd: ORGANIZE_CWD }], null)
  assert.equal(shown[0]?.title, '待办 · 别的会话')
})

test('ask-ai publishes a session title only after rename resolves', () => {
  const source = readFileSync(ASK_AI, 'utf8')
  const publishes = [...source.matchAll(/publishSuccessfulRename\(/g)]
  assert.equal(publishes.length, 2)
  const catches = [...source.matchAll(/renameAiSession\([^)]*\)\.catch\(\(\) => undefined\)/g)]
  assert.equal(catches.length, 2)
  for (const match of catches) {
    const after = source.slice(match.index + match[0].length, match.index + match[0].length + 500)
    assert.match(after, /publishSuccessfulRename\(/)
    assert.doesNotMatch(match[0], /publishSuccessfulRename/)
  }
})
