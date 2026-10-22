import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildContextPack, renderContextForPrompt } from '../context-pack.mjs'
import { openDatabase } from '../db.mjs'
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dbPath = '/tmp/fde-x-context-pack-test.sqlite'

test('renderContextForPrompt omits one hit by id', () => {
  const pack = {
    generatedAt: Date.now(),
    workspace: { cwd: '/tmp/ws', name: '测试' },
    memory: {
      hits: [
        { id: 'memory:aa', excerpt: '留下这条', sourceRef: 'memory:aa' },
        { id: 'memory:bb', excerpt: '丢掉这条', sourceRef: 'memory:bb' },
      ],
      precedents: [],
    },
  }
  const text = renderContextForPrompt(pack, new Set(['memory:hit:memory:bb']))
  assert.match(text, /留下这条/)
  assert.equal(text.includes('丢掉这条'), false)
})

test('renderContextForPrompt respects 1500 char cap', () => {
  const pack = {
    generatedAt: Date.now(),
    workspace: { cwd: '/tmp/ws', name: '测试' },
    memory: {
      hits: Array.from({ length: 40 }, (_, i) => ({
        id: `hit_${i}`,
        excerpt: '这是一段很长的记忆摘录内容，用于测试长度上限。',
        sourceRef: `hit_${i}`,
      })),
      precedents: [],
    },
  }
  const text = renderContextForPrompt(pack)
  assert.ok(text.length <= 1500)
  assert.match(text, /【相关记忆】/)
})

test('memory scope without explicit query uses workspace folder name', async () => {
  await rm(dbPath, { force: true }).catch(() => undefined)
  await mkdir('/tmp/fde-x-context-pack-ws', { recursive: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  let findQuery = ''
  const aiRuntime = {
    status: () => ({ connected: true }),
    lanAssist: async () => ({ unreadTotal: 0, requests: [] }),
    semanticOs: async (path, options) => {
      if (path === '/ready') return { ready: true }
      if (path === '/find') {
        findQuery = options.query
        return { items: [] }
      }
      if (path === '/python') return { precedents: [] }
      throw new Error(`unexpected ${path}`)
    },
  }
  const { pack, warnings } = await buildContextPack(
    { db, aiRuntime },
    {
      workspaceCwd: '/tmp/fde-x-context-pack-ws',
      scopes: ['memory'],
    },
  )
  assert.equal(findQuery, 'fde-x-context-pack-ws')
  assert.ok(pack.memory)
  assert.equal(warnings.includes('memory_query_missing'), false)
})

test('memory scope failure does not break other scopes', async () => {
  await rm(dbPath, { force: true }).catch(() => undefined)
  await mkdir('/tmp/fde-x-context-pack-ws', { recursive: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const aiRuntime = {
    status: () => ({ connected: false }),
    lanAssist: async () => ({ unreadTotal: 0, requests: [] }),
    semanticOs: async () => {
      throw new Error('down')
    },
  }
  const { pack, warnings } = await buildContextPack(
    { db, aiRuntime },
    {
      workspaceCwd: '/tmp/fde-x-context-pack-ws',
      scopes: ['workspace', 'tasks', 'memory'],
      query: '采购',
    },
  )
  assert.ok(pack.workspace)
  assert.ok(warnings.includes('memory_engine_not_ready') || warnings.includes('memory_find_failed'))
})

test('explicit taskIds control tasks in prompt', async () => {
  const taskIdsDbPath = '/tmp/fde-x-context-pack-task-ids.sqlite'
  await rm(taskIdsDbPath, { force: true }).catch(() => undefined)
  await mkdir('/tmp/fde-x-context-pack-ws', { recursive: true })
  const db = openDatabase(taskIdsDbPath, join(repoRoot, 'runtime/migrations'))
  const now = new Date().toISOString()
  const undatedId = 'task_undated_p1_test'
  const overdueId = 'task_overdue_p1_test'
  const dueTodayId = 'task_due_today_p1_test'
  const doneId = 'task_done_p1_test'
  const secondId = 'task_second_p1_test'
  db.prepare(`
    INSERT INTO tasks (id, workspace_id, title, notes, status, priority, due_at, created_at, updated_at)
    VALUES (?, 'ws_personal', '无截止日待办P1', '', 'todo', 'med', NULL, ?, ?)
  `).run(undatedId, now, now)
  const aiRuntime = {
    status: () => ({ connected: false }),
    lanAssist: async () => ({ unreadTotal: 0, requests: [] }),
    semanticOs: async () => {
      throw new Error('down')
    },
  }
  const baseInput = {
    workspaceCwd: '/tmp/fde-x-context-pack-ws',
    scopes: ['tasks'],
  }
  const explicitUndated = await buildContextPack(
    { db, aiRuntime },
    { ...baseInput, taskIds: [undatedId] },
  )
  const explicitText = renderContextForPrompt(explicitUndated.pack)
  assert.match(explicitText, /无截止日待办P1/)

  const windowPack = await buildContextPack({ db, aiRuntime }, baseInput)
  const windowText = renderContextForPrompt(windowPack.pack)
  assert.match(windowText, /【今日待办】/)
  assert.equal(windowText.includes('无截止日待办P1'), false)

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  db.prepare(`
    INSERT INTO tasks (id, workspace_id, title, notes, status, priority, due_at, created_at, updated_at)
    VALUES (?, 'ws_personal', '逾期待办P1', '', 'todo', 'med', ?, ?, ?)
  `).run(overdueId, yesterday.toISOString(), now, now)

  const withOverdueExplicit = renderContextForPrompt(
    (await buildContextPack({ db, aiRuntime }, { ...baseInput, taskIds: [undatedId] })).pack,
  )
  const withOverdueWindow = renderContextForPrompt(
    (await buildContextPack({ db, aiRuntime }, baseInput)).pack,
  )
  assert.match(withOverdueExplicit, /逾期 1 条/)
  assert.match(withOverdueWindow, /逾期 1 条/)

  const dueToday = new Date()
  dueToday.setHours(12, 0, 0, 0)
  db.prepare(`
    INSERT INTO tasks (id, workspace_id, title, notes, status, priority, due_at, created_at, updated_at)
    VALUES (?, 'ws_personal', '今日截止待办P1', '', 'todo', 'med', ?, ?, ?)
  `).run(dueTodayId, dueToday.toISOString(), now, now)

  const onlyUndated = renderContextForPrompt(
    (await buildContextPack({ db, aiRuntime }, { ...baseInput, taskIds: [undatedId] })).pack,
  )
  assert.match(onlyUndated, /无截止日待办P1/)
  assert.equal(onlyUndated.includes('今日截止待办P1'), false)

  db.prepare(`
    INSERT INTO tasks (id, workspace_id, title, notes, status, priority, due_at, created_at, updated_at)
    VALUES (?, 'ws_personal', '第二条待办P1', '', 'doing', 'med', NULL, ?, ?)
  `).run(secondId, now, now)
  db.prepare(`
    INSERT INTO tasks (id, workspace_id, title, notes, status, priority, due_at, created_at, updated_at)
    VALUES (?, 'ws_personal', '已完成待办P1', '', 'done', 'med', NULL, ?, ?)
  `).run(doneId, now, now)

  const ordered = renderContextForPrompt(
    (await buildContextPack({ db, aiRuntime }, { ...baseInput, taskIds: [doneId, secondId] })).pack,
  )
  const donePos = ordered.indexOf('已完成待办P1')
  const secondPos = ordered.indexOf('第二条待办P1')
  assert.ok(donePos >= 0 && secondPos >= 0 && donePos < secondPos)
  assert.match(ordered, /已完成待办P1（done）/)

  const missingRow = await buildContextPack(
    { db, aiRuntime },
    { ...baseInput, taskIds: [undatedId, 'task_not_in_db'] },
  )
  const missingText = renderContextForPrompt(missingRow.pack)
  assert.match(missingText, /无截止日待办P1/)
  assert.equal(missingRow.warnings.includes('task_ids_invalid'), false)

  const invalid = await buildContextPack(
    { db, aiRuntime },
    { ...baseInput, taskIds: 'nope' },
  )
  const invalidText = renderContextForPrompt(invalid.pack)
  assert.equal(invalidText.includes('今日截止待办P1'), false)
  assert.ok(invalid.warnings.includes('task_ids_invalid'))
})

test('tasks stay listed when workspace cwd trailing slashes differ', async () => {
  const dbPath = `/tmp/fde-x-context-pack-slash-${Date.now()}.sqlite`
  await rm(dbPath, { force: true }).catch(() => undefined)
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const now = new Date().toISOString()
  const pairs = [
    ['/tmp/fde-x-cwd-slash-a', '/tmp/fde-x-cwd-slash-a'],
    ['/tmp/fde-x-cwd-slash-b', '/tmp/fde-x-cwd-slash-b/'],
    ['/tmp/fde-x-cwd-slash-c/', '/tmp/fde-x-cwd-slash-c'],
    ['/tmp/fde-x-cwd-slash-d/', '/tmp/fde-x-cwd-slash-d/'],
  ]
  const aiRuntime = {
    status: () => ({ connected: false }),
    lanAssist: async () => ({ unreadTotal: 0, requests: [] }),
    semanticOs: async () => {
      throw new Error('down')
    },
  }
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_other', 'other', '', 'active', ?, ?, ?)
  `).run(JSON.stringify({ cwd: '/tmp/fde-x-cwd-other' }), now, now)
  db.prepare(`
    INSERT INTO tasks (id, workspace_id, title, notes, status, priority, due_at, created_at, updated_at)
    VALUES ('task_other', 'ws_other', '别的工作区待办', '', 'todo', 'med', NULL, ?, ?)
  `).run(now, now)
  for (const [index, [metadataCwd, queryCwd]] of pairs.entries()) {
    const workspaceId = `ws_slash_${index}`
    const taskId = `task_slash_${index}`
    const title = `斜杠待办${index}`
    db.prepare(`
      INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
      VALUES (?, 'slash', '', 'active', ?, ?, ?)
    `).run(workspaceId, JSON.stringify({ cwd: metadataCwd }), now, now)
    db.prepare(`
      INSERT INTO tasks (id, workspace_id, title, notes, status, priority, due_at, created_at, updated_at)
      VALUES (?, ?, ?, '', 'todo', 'med', NULL, ?, ?)
    `).run(taskId, workspaceId, title, now, now)
    const { pack } = await buildContextPack(
      { db, aiRuntime },
      { workspaceCwd: queryCwd, scopes: ['tasks'], taskIds: [taskId] },
    )
    const text = renderContextForPrompt(pack, new Set(), { taskIds: true })
    assert.match(text, new RegExp(title))
    assert.equal(text.includes('别的工作区待办'), false)
  }
  db.close()
})

test('scope timeout is reported in warnings', async () => {
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const aiRuntime = {
    status: () => ({ connected: true }),
    lanAssist: async () => new Promise(() => {}),
    semanticOs: async () => ({ ready: true }),
  }
  const { warnings } = await buildContextPack(
    { db, aiRuntime },
    {
      workspaceCwd: '/tmp/fde-x-context-pack-ws',
      scopes: ['im'],
      query: 'x',
    },
  )
  assert.ok(warnings.some((w) => w.endsWith('_timeout')))
})
