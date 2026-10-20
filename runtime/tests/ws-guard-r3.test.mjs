import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { openDatabase } from '../db.mjs'
import { insertTask } from '../plan/task-store.mjs'
import { proposePlanTask } from '../plan/task-proposals.mjs'
import { httpWorkspaceRoutes } from '../http-workspace.mjs'
import { workspaceScopeAllow } from '../workspace-scope-allow.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

const SCOPED_CALLS = [
  'getAppById',
  'trashApp',
  'putAppSpec',
  'activateApp',
  'restoreApp',
  'purgeApp',
  'rollbackApp',
  'updateBusinessApp',
  'getOperation',
  'getOperationTrace',
  'approveOperation',
  'executeDryRun',
  'executeOperationLive',
  'getTask',
  'updateTask',
  'deleteTask',
  'decidePlanTask',
  'getDocument',
  'putDocument',
]

const SCOPED_TABLES = ['business_apps', 'operations', 'tasks', 'calendar_events', 'workflows']

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify({ cwd }), now, now)
}

function insertPlainApp(db, id, workspaceId, name) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO business_apps (
      id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at
    ) VALUES (?, ?, ?, 'generated', 'draft', 1, '{}', ?, ?)
  `).run(id, workspaceId, name, now, now)
}

function insertWebApp(db, id, workspaceId) {
  const now = new Date().toISOString()
  const spec = { spec: 'fde-web/v1', slug: 'shop', name: '店', _workspaceCwd: '/ws-guard-b' }
  db.prepare(`
    INSERT INTO business_apps (
      id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at
    ) VALUES (?, ?, '店', 'generated', 'draft', 1, ?, ?, ?)
  `).run(id, workspaceId, JSON.stringify(spec), now, now)
}

function insertOperation(db, id) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO operations (
      id, workspace_id, connection_id, app_id, requested_by, target_ref, action,
      operation_kind, risk_level, execution_mode, state, idempotency_key, expected_version,
      input_json, plan_json, correlation_id, causation_id, created_at, updated_at
    ) VALUES (?, 'ws_b', NULL, NULL, 'actor_local_user', 'fde://workstation/op', 'record.update', 'write', 'low', 'dry_run', 'draft', ?, NULL, '{}', '{}', ?, NULL, ?, ?)
  `).run(id, `idem-${id}`, `corr-${id}`, now, now)
}

async function startServer(dbPath) {
  const dshHome = await mkdtemp(join(tmpdir(), 'fde-ws-guard-r3-'))
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_RUNTIME_SUPERVISED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  let base = ''
  let uiToken = ''
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const port = (stdout.match(/^FDE_LISTENING\s+(\d+)/m) || [])[1]
    uiToken = (stdout.match(/^FDE_UI_TOKEN\s+(\S+)/m) || [])[1] || ''
    if (port && uiToken) {
      base = `http://127.0.0.1:${port}`
      const health = await fetch(`${base}/health`).catch(() => null)
      if (health?.ok) break
    }
    if (child.exitCode != null) break
    await delay(100)
  }
  if (!base) {
    child.kill('SIGTERM')
    throw new Error(`runtime did not start: ${stderr.slice(0, 500)}\n${stdout.slice(0, 500)}`)
  }
  return {
    base,
    uiToken,
    stop: async () => {
      child.kill('SIGTERM')
      await delay(50)
      await rm(dshHome, { recursive: true, force: true })
    },
  }
}

async function call(server, method, path, body) {
  const headers = {
    Origin: server.base,
    'x-fde-ui-token': server.uiToken,
  }
  let payload
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const response = await fetch(`${server.base}${path}`, { method, headers, body: payload })
  const text = await response.text()
  let parsed = {}
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { raw: text.slice(0, 200) }
  }
  return { status: response.status, payload: parsed }
}

function codeOf(payload) {
  if (payload?.error && typeof payload.error === 'object') return payload.error.code
  return payload?.error
}

function proposeUpdate(db, taskId) {
  const result = proposePlanTask(db, {
    op: 'update',
    workspaceId: 'ws_b',
    taskId,
    title: '被串改',
    actorId: 'actor_local_user',
    correlationId: `corr-${taskId}`,
  })
  if (!result.ok) throw new Error(result.message || 'propose failed')
  return result.proposalId
}

test('task proposal confirm and reject stay inside the proposal workspace', async () => {
  const dbPath = `/tmp/fde-ws-r3-prop-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  const ids = ['task_confirm_a', 'task_reject_a', 'task_confirm_bare', 'task_own']
  for (const id of ids) {
    insertTask(db, {
      id,
      workspaceId: 'ws_b',
      title: '原任务',
      notes: '',
      status: 'todo',
      priority: 'med',
      sourceRef: `fde://plan/tasks/${id}`,
      tags: [],
    })
  }
  const confirmA = proposeUpdate(db, 'task_confirm_a')
  const rejectA = proposeUpdate(db, 'task_reject_a')
  const confirmBare = proposeUpdate(db, 'task_confirm_bare')
  const confirmOwn = proposeUpdate(db, 'task_own')
  db.close()
  const server = await startServer(dbPath)
  try {
    const asA = await call(server, 'POST', `/api/v1/plan/task-proposals/${confirmA}/confirm`, { workspaceId: 'ws_a' })
    const rejA = await call(server, 'POST', `/api/v1/plan/task-proposals/${rejectA}/reject`, { workspaceId: 'ws_a' })
    const bare = await call(server, 'POST', `/api/v1/plan/task-proposals/${confirmBare}/confirm`, {})
    const own = await call(server, 'POST', `/api/v1/plan/task-proposals/${confirmOwn}/confirm`, { workspaceId: 'ws_b' })
    const check = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    const title = (id) => check.prepare('SELECT title FROM tasks WHERE id = ?').get(id).title
    const state = (id) => check.prepare('SELECT state FROM operations WHERE id = ?').get(id).state
    const seen = {
      asA: asA.status,
      asACode: codeOf(asA.payload),
      asATitle: title('task_confirm_a'),
      asAState: state(confirmA),
      rejA: rejA.status,
      rejACode: codeOf(rejA.payload),
      rejATitle: title('task_reject_a'),
      rejAState: state(rejectA),
      bare: bare.status,
      bareCode: codeOf(bare.payload),
      bareTitle: title('task_confirm_bare'),
      bareState: state(confirmBare),
      own: own.status,
      ownTitle: title('task_own'),
      ownState: state(confirmOwn),
    }
    check.close()
    assert.deepEqual(seen, {
      asA: 404,
      asACode: 'not_found',
      asATitle: '原任务',
      asAState: 'awaiting_approval',
      rejA: 404,
      rejACode: 'not_found',
      rejATitle: '原任务',
      rejAState: 'awaiting_approval',
      bare: 404,
      bareCode: 'not_found',
      bareTitle: '原任务',
      bareState: 'awaiting_approval',
      own: 200,
      ownTitle: '被串改',
      ownState: 'succeeded',
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('a workspace cannot read another workspace row by id', async () => {
  const dbPath = `/tmp/fde-ws-r3-read-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  insertPlainApp(db, 'app_b', 'ws_b', '秘密应用')
  insertWebApp(db, 'app_store', 'ws_b')
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO app_documents (id, app_id, slug, workspace_cwd, doc_key, json, updated_at)
    VALUES ('adoc_b', 'app_store', 'shop', '/ws-guard-b', 'note', ?, ?)
  `).run(JSON.stringify({ secret: 'b-secret' }), now)
  insertOperation(db, 'op_b')
  db.close()
  const server = await startServer(dbPath)
  try {
    const appA = await call(server, 'GET', '/api/v1/apps/app_b?workspaceId=ws_a')
    const appBare = await call(server, 'GET', '/api/v1/apps/app_b')
    const storeA = await call(server, 'GET', '/api/v1/apps/app_store/store/note?workspaceId=ws_a')
    const storeBare = await call(server, 'GET', '/api/v1/apps/app_store/store/note')
    const opA = await call(server, 'GET', '/api/v1/operations/op_b?workspaceId=ws_a')
    const opBare = await call(server, 'GET', '/api/v1/operations/op_b')
    const traceA = await call(server, 'GET', '/api/v1/operations/op_b/trace?workspaceId=ws_a')
    const traceBare = await call(server, 'GET', '/api/v1/operations/op_b/trace')
    const listBare = await call(server, 'GET', '/api/v1/operations')
    const listA = await call(server, 'GET', '/api/v1/operations?workspaceId=ws_a')
    const listB = await call(server, 'GET', '/api/v1/operations?workspaceId=ws_b')
    const ids = (payload) => (payload.items || []).map((item) => item.id)
    const seen = {
      appA: appA.status,
      appACode: codeOf(appA.payload),
      appAName: appA.payload.data?.name || '',
      appBare: appBare.status,
      appBareName: appBare.payload.data?.name || '',
      storeA: storeA.status,
      storeACode: codeOf(storeA.payload),
      storeASecret: storeA.payload.data?.secret || '',
      storeBare: storeBare.status,
      storeBareSecret: storeBare.payload.data?.secret || '',
      opA: opA.status,
      opACode: codeOf(opA.payload),
      opBare: opBare.status,
      traceA: traceA.status,
      traceACode: codeOf(traceA.payload),
      traceBare: traceBare.status,
      listBareHas: ids(listBare.payload).includes('op_b'),
      listAHas: ids(listA.payload).includes('op_b'),
      listBHas: ids(listB.payload).includes('op_b'),
    }
    assert.deepEqual(seen, {
      appA: 404,
      appACode: 'not_found',
      appAName: '',
      appBare: 404,
      appBareName: '',
      storeA: 404,
      storeACode: 'not_found',
      storeASecret: '',
      storeBare: 404,
      storeBareSecret: '',
      opA: 404,
      opACode: 'not_found',
      opBare: 404,
      traceA: 404,
      traceACode: 'not_found',
      traceBare: 404,
      listBareHas: false,
      listAHas: false,
      listBHas: true,
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('an unregistered plan workflow is missing_workspace', async () => {
  const dbPath = `/tmp/fde-ws-r3-wf-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  db.close()
  const server = await startServer(dbPath)
  try {
    const created = await call(server, 'POST', '/api/v1/plan/workflows', { workspaceId: 'ws_absent', name: '不应出现' })
    const check = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    const rows = check.prepare("SELECT COUNT(*) AS n FROM workflows WHERE name = '不应出现'").get().n
    check.close()
    assert.deepEqual({
      status: created.status,
      code: codeOf(created.payload),
      message: created.payload.message,
      rows,
    }, {
      status: 404,
      code: 'missing_workspace',
      message: '工作区未登记',
      rows: 0,
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('catalog stream is a registered workspace route', () => {
  const hit = httpWorkspaceRoutes.find((route) => route.method === 'GET' && route.path === '/api/v1/catalog/stream')
  assert.equal(hit?.path, '/api/v1/catalog/stream')
})

function enclosingName(text, index) {
  const head = text.slice(0, index)
  const matches = [...head.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)]
  return matches.length ? matches[matches.length - 1][1] : ''
}

function callSites(text, callee) {
  const re = new RegExp(`\\b${callee}\\s*\\(`, 'g')
  const sites = []
  for (const match of text.matchAll(re)) {
    const start = match.index
    const prefix = text.slice(Math.max(0, start - 40), start)
    if (/(?:function|async)\s+$/.test(prefix)) continue
    let depth = 0
    let end = start + match[0].length - 1
    for (; end < text.length; end += 1) {
      const ch = text[end]
      if (ch === '(') depth += 1
      else if (ch === ')') {
        depth -= 1
        if (depth === 0) {
          end += 1
          break
        }
      }
    }
    const args = text.slice(start + match[0].length, end - 1)
    if (/^[A-Za-z0-9_?]+\??\s*:\s*[A-Za-z]/.test(args.trim())) continue
    const line = text.slice(0, start).split('\n').length
    sites.push({ line, args, enclosing: enclosingName(text, start) })
  }
  return sites
}

function sqlSites(text) {
  const sites = []
  const re = new RegExp(String.raw`(?:SELECT|UPDATE|DELETE)[\s\S]{0,240}?\b(?:${SCOPED_TABLES.join('|')})\b[\s\S]{0,240}?WHERE\s+id\s*=\s*\?`, 'g')
  for (const match of text.matchAll(re)) {
    if (match[0].includes('workspace_id')) continue
    const line = text.slice(0, match.index).split('\n').length
    sites.push({ line, sql: match[0].replace(/\s+/g, ' ').slice(0, 140) })
  }
  return sites
}

async function sourceFiles(dir) {
  const files = []
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'vendor-overlays' || entry.name === 'dist' || entry.name === '.git') continue
      const full = join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (/\.(mjs|js|ts|tsx)$/.test(entry.name)) files.push(full)
    }
  }
  await walk(dir)
  return files
}

test('primary key access passes workspaceId', async () => {
  const problems = []
  const allow = new Set(workspaceScopeAllow.map((row) => `${row.file}:${row.enclosing}:${row.callee}`))
  for (const row of workspaceScopeAllow) {
    if (!row.file || !row.callee || !row.reason) problems.push(`allow row missing file, callee, or reason: ${JSON.stringify(row)}`)
  }
  for (const full of await sourceFiles(repoRoot)) {
    const rel = relative(repoRoot, full)
    if (rel.startsWith('runtime/tests/')) continue
    const text = await readFile(full, 'utf8')
    for (const callee of SCOPED_CALLS) {
      for (const site of callSites(text, callee)) {
        if (/\bworkspaceId\b/.test(site.args)) continue
        const key = `${rel}:${site.enclosing}:${callee}`
        if (allow.has(key)) continue
        problems.push(`${rel}:${site.line} ${site.enclosing || '(top)'} calls ${callee} without workspaceId`)
      }
    }
    if (!rel.startsWith('runtime/')) continue
    for (const site of sqlSites(text)) {
      problems.push(`${rel}:${site.line} sql by id without workspace_id: ${site.sql}`)
    }
  }
  assert.deepEqual(problems, [])
})
