import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { insertBizSurface, openDatabase } from '../db.mjs'
import { getOrCreateDefinition } from '../briefing/store.mjs'
import { listEventsAfter, listRecentEvents, matchesWorkspaceFilter } from '../events.mjs'
import { httpWorkspaceExemptions, httpWorkspaceRoutes } from '../http-workspace.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const runtimeRoot = join(repoRoot, 'runtime')
const WIN = 'C:/x'
const SLASH = '/x'
const ILLEGAL = 'a/b'
const UNREG_WIN = 'C:/unregistered'
const UNREG_SLASH = '/y-not-registered'
const WIN_MARK = 'matrix-win-marker'
const SLASH_MARK = 'matrix-slash-marker'
const DEFAULT_MARK = 'matrix-default-marker'

const APPS_UNREGISTERED = new Set(['apps', 'apps-create', 'apps-entity', 'context-pack', 'bridge-context', 'business-apps', 'catalog', 'catalog-post', 'business-connections', 'biz-connections', 'briefing-latest', 'briefing-definition', 'briefing-run'])
const WS_KEY = 'cwd|workspace|workspaceCwd|workspacePath|workingDirectory'
const PATH_KEY = 'cwd|workspaceCwd|workspacePath|workingDirectory'
const READ_RE = new RegExp(String.raw`searchParams\.(?:get|has)\(\s*['"\`](?:${WS_KEY})['"\`]|(?:[A-Za-z_][A-Za-z0-9_]*)\.(?:get|has)\(\s*['"\`](?:${PATH_KEY})['"\`]|body\??\.(?:${WS_KEY})\b|body\??\[['\"\`](?:${WS_KEY})['\"\`]\]|(?:resolveHttpWorkspace|bizWorkspace|requireHttpWorkspace|cwdFrom|requireWorkspaceQuery|briefingCwdFromBody|appIdentity|appRecordCwd)\s*\(`)

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify({ cwd }), now, now)
}

function insertMarkerEvent(db, id, cwd, marker) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO outbox_events (
      id, event_type, schema_version, source_ref, subject_ref, correlation_id,
      payload_json, occurred_at, available_at, ts, workspace_cwd, source, delivered
    ) VALUES (?, 'matrix.marker', 1, ?, NULL, ?, ?, ?, ?, ?, ?, 'bff', 0)
  `).run(id, `fde://workspace${cwd}`, id, JSON.stringify({ marker }), now, now, Date.now(), cwd)
}

function insertMarkerApp(db, id, workspaceId, name) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO business_apps (
      id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at
    ) VALUES (?, ?, ?, 'generated', 'draft', 1, '{}', ?, ?)
  `).run(id, workspaceId, name, now, now)
}

function workspaceRejected(status, text) {
  return status === 400 && /workspace_invalid|必须是绝对路径|需要本机绝对路径|tempPath 无效|path 无效|请填写本机绝对路径/.test(text)
}

function foreignMarkers(mode) {
  if (mode === 'win') return [SLASH_MARK, DEFAULT_MARK]
  if (mode === 'slash') return [WIN_MARK, DEFAULT_MARK]
  if (mode === 'illegal') return [WIN_MARK, SLASH_MARK, DEFAULT_MARK]
  return [WIN_MARK, SLASH_MARK]
}

async function startServer(env) {
  const port = 26000 + (process.pid % 20000)
  const dbPath = `/tmp/fde-http-ws-matrix-${process.pid}.sqlite`
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: dbPath,
      FDE_RUNTIME_SUPERVISED: '1',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  let stdout = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  const base = `http://127.0.0.1:${port}`
  let healthy = false
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const health = await fetch(`${base}/health`)
      if (health.ok) {
        healthy = true
        break
      }
    } catch { /* wait */ }
    await delay(100)
  }
  if (!healthy) {
    child.kill('SIGTERM')
    db.close()
    throw new Error(`runtime did not start: ${stderr.slice(0, 500)}`)
  }
  const uiToken = (stdout.match(/FDE_UI_TOKEN (\S+)/) || [])[1] || ''
  return {
    base,
    port,
    db,
    uiToken,
    stop: async () => {
      child.kill('SIGTERM')
      db.close()
      await delay(50)
    },
  }
}

function paramFor(mode) {
  if (mode === 'win') return WIN
  if (mode === 'slash') return SLASH
  if (mode === 'unreg-win') return UNREG_WIN
  if (mode === 'unreg-slash') return UNREG_SLASH
  return ILLEGAL
}

function personalMarkers() {
  return [WIN_MARK, SLASH_MARK, DEFAULT_MARK, 'matrix-default-app', 'matrix-win-app', 'matrix-slash-app', 'matrix-personal-task', 'matrix-surface-default', 'matrix-surface-win', 'matrix-surface-slash', 'matrix-default-brief', 'matrix-win-brief', 'matrix-slash-brief', 'AGENTS.md', 'win-marker.txt']
}

async function requestRoute(server, route, mode, token) {
  const url = new URL(route.path, server.base)
  const body = { ...(route.extra || {}) }
  if (route.place === 'query') {
    for (const [key, value] of Object.entries(route.extra || {})) {
      if (value != null && typeof value !== 'object') url.searchParams.set(key, String(value))
    }
    if (mode !== 'absent') url.searchParams.set(route.param, paramFor(mode))
  } else if (mode !== 'absent') {
    body[route.param] = paramFor(mode)
  }
  if (route.proof === 'bridge') {
    body.requestId = `matrix-${route.id}-${mode}`
    body.kind = 'text'
    body.data = 'matrix'
  }
  const headers = { Origin: `http://127.0.0.1:${server.port}` }
  if (route.method !== 'GET' && server.uiToken) headers['x-fde-ui-token'] = server.uiToken
  if (route.proof === 'bridge' || route.path.startsWith('/api/v1/bridge/')) headers['x-fde-bridge-token'] = token
  let payload
  if (route.place === 'body' || route.method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), route.proof === 'events-sse' ? 2500 : 8000)
  try {
    const response = await fetch(url, { method: route.method, headers, body: payload, signal: controller.signal })
    if (route.proof === 'events-sse' && response.status === 200 && response.body) {
      const reader = response.body.getReader()
      let text = ''
      const started = Date.now()
      try {
        while (Date.now() - started < 1500 && !text.includes('matrix-')) {
          const chunk = await Promise.race([
            reader.read(),
            delay(200).then(() => ({ timeout: true })),
          ])
          if (chunk.timeout) continue
          if (chunk.done) break
          if (chunk.value) text += Buffer.from(chunk.value).toString()
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      return { status: response.status, text }
    }
    return { status: response.status, text: await response.text() }
  } finally {
    clearTimeout(timer)
  }
}

function checkCase(route, mode, status, text) {
  const problems = []
  const label = `${route.id} ${mode}`
  if (mode === 'unreg-win' || mode === 'unreg-slash') {
    for (const marker of personalMarkers()) {
      if (text.includes(marker)) problems.push(`${label} leaked ${marker}`)
    }
    if (route.proof === 'events' && text.includes('matrix-null-marker')) {
      problems.push(`${label} kept a null workspace event`)
    }
    if (APPS_UNREGISTERED.has(route.id) && (status !== 404 || !text.includes('工作区未登记'))) {
      problems.push(`${label} status ${status} ${text.slice(0, 180)}`)
    }
    return problems
  }
  const rejected = workspaceRejected(status, text)
  if (mode === 'illegal') {
    if (route.illegal === 'unmatched') {
      if (rejected) problems.push(`${label} rejected an id`)
      if (text.includes(DEFAULT_MARK) || text.includes(WIN_MARK)) problems.push(`${label} crossed workspace`)
      return problems
    }
    if (!rejected) problems.push(`${label} status ${status} ${text.slice(0, 180)}`)
    return problems
  }
  if (mode === 'absent' && route.absent === 'required') {
    if (status !== 400) problems.push(`${label} status ${status}`)
    return problems
  }
  if (rejected) problems.push(`${label} rejected absolute or absent cwd status ${status} ${text.slice(0, 180)}`)
  if (route.absent !== 'unfiltered' || mode !== 'absent') {
    for (const marker of foreignMarkers(mode)) {
      if (text.includes(marker)) problems.push(`${label} leaked ${marker}`)
    }
  }
  if (route.proof === 'surfaces' && mode === 'win' && (!text.includes('matrix-surface-win') || text.includes('matrix-surface-default') || text.includes('matrix-surface-slash'))) {
    problems.push(`${label} crossed surfaces`)
  }
  if (route.proof === 'surfaces' && mode === 'slash' && (!text.includes('matrix-surface-slash') || text.includes('matrix-surface-default') || text.includes('matrix-surface-win'))) {
    problems.push(`${label} crossed surfaces`)
  }
  if (route.proof === 'surfaces' && mode === 'absent' && (!text.includes('matrix-surface-default') || text.includes('matrix-surface-win'))) {
    problems.push(`${label} missed default surface`)
  }
  if (route.proof === 'files' && mode === 'win') {
    if (status !== 200 || !text.includes('win-marker.txt') || text.includes('AGENTS.md')) problems.push(`${label} status ${status} ${text.slice(0, 180)}`)
  }
  if (route.proof === 'files' && mode === 'slash' && text.includes('AGENTS.md')) problems.push(`${label} listed the default tree`)
  if (route.proof === 'files' && mode === 'absent' && text.includes('win-marker.txt')) problems.push(`${label} listed the windows tree`)
  if (route.proof === 'briefing' && mode === 'win' && !text.includes('matrix-win-brief')) problems.push(`${label} missed win briefing`)
  if (route.proof === 'briefing' && mode === 'slash' && !text.includes('matrix-slash-brief')) problems.push(`${label} missed slash briefing`)
  if (route.proof === 'briefing' && mode === 'absent' && (!text.includes('matrix-default-brief') || text.includes('matrix-win-brief'))) {
    problems.push(`${label} missed default briefing`)
  }
  if (route.proof === 'events' && mode === 'win' && !text.includes(WIN_MARK)) problems.push(`${label} missed win event`)
  if (route.proof === 'events' && mode === 'slash' && !text.includes(SLASH_MARK)) problems.push(`${label} missed slash event`)
  if (route.proof === 'events' && mode === 'absent' && (!text.includes(WIN_MARK) || !text.includes(DEFAULT_MARK))) {
    problems.push(`${label} dropped an unfiltered event`)
  }
  if (route.proof === 'events' && mode !== 'absent' && mode !== 'illegal' && text.includes('matrix-null-marker')) {
    problems.push(`${label} kept a null workspace event`)
  }
  if (route.proof === 'events' && mode === 'absent' && !text.includes('matrix-null-marker')) {
    problems.push(`${label} dropped an unfiltered null event`)
  }
  if (route.proof === 'events-sse' && mode === 'win' && status === 200 && !text.includes(WIN_MARK)) problems.push(`${label} missed win event`)
  if (route.proof === 'events-sse' && mode === 'slash' && status === 200 && !text.includes(SLASH_MARK)) problems.push(`${label} missed slash event`)
  if (route.proof === 'apps' && mode === 'win' && (!text.includes('matrix-win-app') || text.includes('matrix-default-app') || text.includes('matrix-slash-app'))) {
    problems.push(`${label} crossed apps`)
  }
  if (route.proof === 'apps' && mode === 'slash' && (!text.includes('matrix-slash-app') || text.includes('matrix-default-app') || text.includes('matrix-win-app'))) {
    problems.push(`${label} crossed apps`)
  }
  if (route.proof === 'apps' && mode === 'absent' && (!text.includes('matrix-default-app') || text.includes('matrix-win-app'))) {
    problems.push(`${label} missed default apps`)
  }
  if (route.proof === 'apps' && mode === 'illegal' && (text.includes('matrix-default-app') || text.includes('matrix-win-app'))) {
    problems.push(`${label} crossed workspace`)
  }
  if (route.id === 'business-apps' && (mode === 'win' || mode === 'slash')) {
    const own = mode === 'win' ? 'matrix-win-app' : 'matrix-slash-app'
    const other = mode === 'win' ? 'matrix-slash-app' : 'matrix-win-app'
    if (!text.includes(own) || text.includes('matrix-default-app') || text.includes(other)) {
      problems.push(`${label} mixed business apps`)
    }
  }
  return problems
}

test('http workspace matrix', { timeout: 180_000 }, async () => {
  const winDir = join(repoRoot, 'C:', 'x')
  await mkdir(winDir, { recursive: true })
  await writeFile(join(winDir, 'win-marker.txt'), 'win')
  const dshHome = `/tmp/fde-matrix-dsh-${process.pid}`
  const server = await startServer({ FDE_AI_WORKSPACE: repoRoot, FDE_DSH_HOME: dshHome })
  try {
  const surfaceWin = insertBizSurface(server.db, { workspaceCwd: WIN, kind: 'visit', action: 'matrix-surface-win', createdAt: 3 })
  const surfaceSlash = insertBizSurface(server.db, { workspaceCwd: SLASH, kind: 'visit', action: 'matrix-surface-slash', createdAt: 2 })
  const surfaceDefault = insertBizSurface(server.db, { workspaceCwd: repoRoot, kind: 'visit', action: 'matrix-surface-default', createdAt: 1 })
  server.db.prepare(`UPDATE workspaces SET metadata_json = ? WHERE id = 'ws_personal'`).run(JSON.stringify({ cwd: repoRoot }))
  registerWorkspace(server.db, 'ws_matrix_win', WIN)
  registerWorkspace(server.db, 'ws_matrix_slash', SLASH)
  const fallbackDef = getOrCreateDefinition(server.db, repoRoot)
  const winDef = getOrCreateDefinition(server.db, WIN)
  const slashDef = getOrCreateDefinition(server.db, SLASH)
  server.db.prepare('UPDATE briefing_definitions SET name = ? WHERE id = ?').run('matrix-default-brief', fallbackDef.id)
  server.db.prepare('UPDATE briefing_definitions SET name = ? WHERE id = ?').run('matrix-win-brief', winDef.id)
  server.db.prepare('UPDATE briefing_definitions SET name = ? WHERE id = ?').run('matrix-slash-brief', slashDef.id)
  insertMarkerEvent(server.db, 'evt_matrix_win', WIN, WIN_MARK)
  insertMarkerEvent(server.db, 'evt_matrix_slash', SLASH, SLASH_MARK)
  insertMarkerEvent(server.db, 'evt_matrix_default', repoRoot, DEFAULT_MARK)
  insertMarkerEvent(server.db, 'evt_matrix_null', null, 'matrix-null-marker')
  insertMarkerApp(server.db, 'app_matrix_win', 'ws_matrix_win', 'matrix-win-app')
  insertMarkerApp(server.db, 'app_matrix_slash', 'ws_matrix_slash', 'matrix-slash-app')
  insertMarkerApp(server.db, 'app_matrix_default', 'ws_personal', 'matrix-default-app')
  const taskNow = new Date().toISOString()
  server.db.prepare(`
    INSERT INTO tasks (id, workspace_id, title, notes, status, priority, due_at, created_at, updated_at)
    VALUES ('task_matrix_personal', 'ws_personal', 'matrix-personal-task', '', 'todo', 'med', NULL, ?, ?)
  `).run(taskNow, taskNow)
  let token = ''
  for (let attempt = 0; attempt < 20 && !token; attempt += 1) {
    try {
      token = String(await readFile(join(dshHome, 'run', 'bridge.token'), 'utf8')).trim()
    } catch {
      await delay(50)
    }
  }
  const problems = []
  if (!surfaceWin || !surfaceSlash || !surfaceDefault) problems.push('surface seed failed')
    for (const route of httpWorkspaceRoutes) {
      const modes = ['win', 'slash', 'illegal', 'absent', 'unreg-win', 'unreg-slash']
      for (const mode of modes) {
        try {
          const result = await requestRoute(server, route, mode, token)
          problems.push(...checkCase(route, mode, result.status, result.text))
          if (route.proof === 'bridge' && (mode === 'win' || mode === 'slash') && result.status === 200) {
            const row = server.db.prepare('SELECT workspace_cwd FROM ai_results WHERE request_id = ?').get(`matrix-${route.id}-${mode}`)
            const expected = mode === 'win' ? WIN : SLASH
            if (!row || row.workspace_cwd !== expected) problems.push(`${route.id} ${mode} stored ${row?.workspace_cwd}`)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          problems.push(`${route.id} ${mode} ${message}`)
        }
      }
    }
    const bypasses = [
      { id: 'business-apps', method: 'GET', path: '/api/v1/business/apps', query: { workspaceId: 'ws_personal', workspaceCwd: UNREG_WIN } },
      { id: 'business-apps', method: 'GET', path: '/api/v1/business/apps', query: { workspaceId: 'ws_personal', workspaceCwd: UNREG_SLASH } },
      { id: 'apps', method: 'GET', path: '/api/v1/apps', query: { workspace: 'ws_personal', cwd: UNREG_WIN } },
      { id: 'apps', method: 'GET', path: '/api/v1/apps', query: { workspace: 'ws_personal', cwd: UNREG_SLASH } },
      { id: 'apps-create', method: 'POST', path: '/api/v1/apps', body: { workspaceId: 'ws_personal', workspaceCwd: UNREG_WIN } },
      { id: 'apps-create', method: 'POST', path: '/api/v1/apps', body: { workspaceId: 'ws_personal', workspaceCwd: UNREG_SLASH } },
      { id: 'apps-entity', method: 'GET', path: '/api/v1/apps/matrix-slug/visit', query: { workspace: 'ws_personal', cwd: UNREG_WIN } },
      { id: 'plan-task', method: 'POST', path: '/api/v1/bridge/plan-task-propose', bridge: true, body: { workspaceId: 'ws_personal', workspaceCwd: UNREG_WIN, op: 'insert', title: 'matrix bypass' } },
      { id: 'business-apps-mismatch', method: 'GET', path: '/api/v1/business/apps', query: { workspaceId: 'ws_personal', workspaceCwd: WIN }, expect: 'mismatch' },
      { id: 'apps-mismatch', method: 'GET', path: '/api/v1/apps', query: { workspace: 'ws_personal', cwd: WIN }, expect: 'mismatch' },
      { id: 'context-pack-mismatch', method: 'POST', path: '/api/v1/context/pack', body: { workspaceId: 'ws_personal', workspaceCwd: WIN, scopes: ['tasks'] }, expect: 'mismatch' },
    ]
    for (const row of bypasses) {
      const url = new URL(row.path, server.base)
      for (const [key, value] of Object.entries(row.query || {})) url.searchParams.set(key, value)
      const headers = { Origin: `http://127.0.0.1:${server.port}` }
      if (row.method !== 'GET' && server.uiToken) headers['x-fde-ui-token'] = server.uiToken
      if (row.bridge) headers['x-fde-bridge-token'] = token
      let payload
      if (row.body) {
        headers['Content-Type'] = 'application/json'
        payload = JSON.stringify(row.body)
      }
      const response = await fetch(url, { method: row.method, headers, body: payload })
      const text = await response.text()
      const label = `${row.id} ${row.expect || 'id-unreg'}`
      if (row.expect === 'mismatch') {
        if (response.status !== 400 || !text.includes('workspace_mismatch')) problems.push(`${label} status ${response.status} ${text.slice(0, 180)}`)
        if (text.includes('matrix-default-app')) problems.push(`${label} leaked matrix-default-app`)
      } else if (response.status !== 404 || !text.includes('工作区未登记')) {
        problems.push(`${label} status ${response.status} ${text.slice(0, 180)}`)
      }
    }
    assert.deepEqual(problems, [])
  } finally {
    await server.stop()
    await rm(join(repoRoot, 'C:'), { recursive: true, force: true })
    await rm(dshHome, { recursive: true, force: true })
  }
})

function wholeFileExempt(rel) {
  return httpWorkspaceExemptions.some((row) => !row.path && (rel === row.file || rel.startsWith(`${row.file}/`)))
}

function pathExempt(rel, found) {
  return httpWorkspaceExemptions.some((row) => {
    if (!row.path) return false
    if (rel !== row.file && !rel.startsWith(`${row.file}/`)) return false
    return found === row.path || found.startsWith(`${row.path}/`)
  })
}

function pathRegistered(found, method, rel) {
  return httpWorkspaceRoutes.some((route) => {
    if (rel && route.file !== rel) return false
    if (method && route.method !== method) return false
    return found === route.path
  })
}

function methodIn(window) {
  const matches = [...window.matchAll(/method === ['"](GET|POST|PUT|PATCH|DELETE)['"]/g)]
  return matches.length ? matches[matches.length - 1][1] : ''
}

function discoveredPaths(window) {
  const found = []
  for (const match of window.matchAll(/['"](\/(?:api\/v1|semantic-os)\/[^'"]*)['"]/g)) found.push(match[1])
  for (const match of window.matchAll(/\\\/api\\\/v1\\\/([A-Za-z0-9/_-]+)/g)) found.push(`/api/v1/${match[1]}`)
  return found
}

const HELPER_RE = /^(?:export\s+)?function (requireHttpWorkspace|bizWorkspace|cwdFrom|cwdOf|requireWorkspaceQuery|briefingCwdFromBody|appIdentity|appRecordCwd|workspaceFilter|workspaceOf|specWorkspaceCwd|requestAppWorkspace|requireOwnedApp|catalogWorkspaceId|settleCatalogWorkspace)\b/

function helperRanges(lines) {
  const ranges = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!HELPER_RE.test(lines[i].trim())) continue
    let depth = 0
    let started = false
    for (let j = i; j < lines.length; j += 1) {
      for (const ch of lines[j]) {
        if (ch === '{') {
          depth += 1
          started = true
        } else if (ch === '}') depth -= 1
      }
      if (started && depth <= 0) {
        ranges.push([i, j])
        break
      }
    }
  }
  return ranges
}

async function runtimeSources() {
  const files = []
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'vendor-overlays' || entry.name === 'node_modules' || entry.name === 'data' || entry.name === 'tests') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.mjs')) files.push(full)
    }
  }
  await walk(runtimeRoot)
  return files
}

test('a workspace filter drops events whose cwd is null', () => {
  const dbPath = `/tmp/fde-null-cwd-${process.pid}.sqlite`
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  insertMarkerEvent(db, 'evt_null', null, 'matrix-null-marker')
  insertMarkerEvent(db, 'evt_slash', SLASH, SLASH_MARK)
  const recent = listRecentEvents(db, { workspaceCwd: SLASH })
  const replay = listEventsAfter(db, { workspaceCwd: SLASH })
  assert.equal(recent.some((item) => item.id === 'evt_null'), false)
  assert.equal(recent.some((item) => item.id === 'evt_slash'), true)
  assert.equal(replay.some((item) => item.id === 'evt_null'), false)
  assert.equal(matchesWorkspaceFilter({ workspaceCwd: null }, SLASH), false)
  assert.equal(listRecentEvents(db, {}).some((item) => item.id === 'evt_null'), true)
  db.close()
})

function workspaceReadProblems(rel, text) {
  const problems = []
  const lines = text.split('\n')
  const ranges = helperRanges(lines)
  lines.forEach((line, index) => {
    if (!READ_RE.test(line)) return
    if (/^\s*(export\s+)?(async\s+)?function\s/.test(line)) return
    if (ranges.some(([start, end]) => index > start && index <= end)) return
    const window = lines.slice(Math.max(0, index - 80), index + 1).join('\n')
    if (window.includes('safeSemanticOsUpstreamPath')) {
      if (!httpWorkspaceRoutes.some((route) => route.path.startsWith('/semantic-os'))) {
        problems.push(`${rel}:${index + 1} semantic proxy is not registered`)
      }
      return
    }
    const found = discoveredPaths(window)
    if (found.length === 0) {
      problems.push(`${rel}:${index + 1} reads workspace/cwd without a route path`)
      return
    }
    const method = methodIn(window)
    const registered = found.filter((path) => pathRegistered(path, method, rel))
    const chosen = registered.length ? registered[registered.length - 1] : found[found.length - 1]
    if (pathExempt(rel, chosen) || pathRegistered(chosen, method, rel)) return
    problems.push(`${rel}:${index + 1} ${chosen} is not registered`)
  })
  return problems
}

test('a handler that skips resolveHttpWorkspace fails the guard', async () => {
  const problems = []
  for (const file of await runtimeSources()) {
    const rel = relative(repoRoot, file)
    if (wholeFileExempt(rel)) continue
    problems.push(...workspaceReadProblems(rel, await readFile(file, 'utf8')))
  }
  assert.ok(problems.some((line) => line.includes('ws-guard-probe') && line.includes('resolveHttpWorkspace')))
})

test('http workspace readers are registered', async () => {
  const problems = []
  const seen = new Set(httpWorkspaceRoutes.map((route) => route.id))
  if (seen.size !== httpWorkspaceRoutes.length) problems.push('duplicate route id')
  for (const file of await runtimeSources()) {
    const rel = relative(repoRoot, file)
    if (wholeFileExempt(rel)) continue
    problems.push(...workspaceReadProblems(rel, await readFile(file, 'utf8')))
  }
  assert.deepEqual(problems, [])
})

test('guard bypasses are reported', () => {
  const bypasses = {
    alias: "if (url.pathname === '/api/v1/not-a-workspace-route') {\n  const cwd = url.searchParams.get('workspacePath')\n}\n",
    directory: "if (url.pathname === '/api/v1/not-a-workspace-route') {\n  const cwd = body.workingDirectory\n}\n",
    prefix: "if (url.pathname.startsWith('/api/v1/')) {\n  const cwd = url.searchParams.get('cwd')\n}\n",
    hidden: "if (url.pathname === '/api/v1/not-a-workspace-route') {\n  const picked = url.searchParams\n  const cwd = picked.get('cwd')\n}\n",
    helper: 'function workspaceOf(input) {\n  return input\n}\nconst cwd = url.searchParams.get(\'cwd\')\n',
    method: "if (request.method === 'POST' && url.pathname === '/api/v1/events/recent') {\n  const cwd = url.searchParams.get('cwd')\n}\n",
    child: "if (request.method === 'GET' && url.pathname === '/api/v1/catalog/stream') {\n  const cwd = url.searchParams.get('cwd')\n}\n",
  }
  const open = []
  for (const [name, source] of Object.entries(bypasses)) {
    const file = name === 'child' ? 'runtime/routes/catalog.mjs' : 'runtime/routes/ghost.mjs'
    if (workspaceReadProblems(file, source).length === 0) open.push(name)
  }
  assert.deepEqual(open, [])
})

test('template and bracket workspace reads are scanned', () => {
  const samples = [
    'searchParams.get(`cwd`)',
    'searchParams.get(`workspace`)',
    "body['cwd']",
    "body['workspace']",
  ]
  for (const sample of samples) {
    assert.match(sample, READ_RE, sample)
  }
  assert.match('searchParams.get("workspacePath")', READ_RE)
  assert.match("body['workingDirectory']", READ_RE)
  assert.match("picked.get('cwd')", READ_RE)
})
