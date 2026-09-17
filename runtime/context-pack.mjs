import { listBusinessApps, listBusinessConnections, listOperations, listWorkspaces } from './db.mjs'

const PACK_BUDGET_MS = 3000

const ALLOWED_SCOPES = new Set(['workspace', 'tasks', 'im', 'biz', 'apps', 'memory'])

function folderName(cwd) {
  const parts = String(cwd || '').split('/').filter(Boolean)
  return parts.at(-1) || '工作区'
}

function workspaceRowForCwd(db, workspaceCwd) {
  const rows = listWorkspaces(db)
  for (const row of rows) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const path = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
    if (path === workspaceCwd) return row
  }
  return null
}

function isoDayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function isoDayEnd() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

async function withBudget(deadline, fn) {
  const remaining = deadline - Date.now()
  if (remaining <= 0) return { skipped: true, reason: 'timeout' }
  return await Promise.race([
    fn(),
    new Promise((resolve) => {
      setTimeout(() => resolve({ skipped: true, reason: 'timeout' }), remaining)
    }),
  ])
}

async function semanticReady(aiRuntime) {
  try {
    if (!aiRuntime?.status?.().connected) return false
    const payload = await aiRuntime.semanticOs('/ready', { method: 'GET' })
    return payload?.ready === true
  } catch {
    return false
  }
}

async function semanticFind(aiRuntime, query, cwd) {
  return aiRuntime.semanticOs('/find', { query, ...(cwd ? { cwd } : {}) })
}

async function semanticPython(aiRuntime, op, args, cwd) {
  return aiRuntime.semanticOs('/python', { op, args, ...(cwd ? { cwd } : {}) })
}

function mapFindHits(data, limit = 5) {
  const rows = []
  const items = Array.isArray(data?.items) ? data.items
    : Array.isArray(data?.hits) ? data.hits
      : Array.isArray(data?.excerpts) ? data.excerpts
        : []
  for (const row of items.slice(0, limit)) {
    if (!row || typeof row !== 'object') continue
    rows.push({
      id: String(row.id || row.node?.id || ''),
      score: typeof row.score === 'number' ? row.score : undefined,
      excerpt: String(row.snippet || row.excerpt || row.text || row.content || '').slice(0, 400),
      sourceRef: String(row.id || ''),
      at: row.then || row.at || row.ts || undefined,
    })
  }
  return rows
}

function mapPrecedents(data, limit = 3) {
  const raw = Array.isArray(data?.precedents) ? data.precedents
    : Array.isArray(data?.results) ? data.results
      : Array.isArray(data) ? data
        : []
  return raw.slice(0, limit).map((row, index) => ({
    id: String(row?.id || `prec_${index}`),
    title: String(row?.title || row?.scenario || '先例'),
    excerpt: String(row?.excerpt || row?.summary || row?.reasoning || '').slice(0, 400),
    at: row?.at || row?.then || undefined,
  }))
}

function buildMemoryQuery({ query, entity, intentKind }) {
  const parts = []
  if (query) parts.push(String(query).trim())
  if (entity && typeof entity === 'object') {
    if (entity.kind) parts.push(String(entity.kind))
    if (entity.ref) parts.push(String(entity.ref))
    const fields = entity.fields && typeof entity.fields === 'object' ? entity.fields : {}
    for (const [key, value] of Object.entries(fields).slice(0, 8)) {
      if (value == null) continue
      parts.push(`${key}:${String(value).slice(0, 120)}`)
    }
  }
  if (intentKind) parts.push(String(intentKind))
  return parts.join(' ').trim()
}

async function fillWorkspace(db, pack, workspaceCwd, sessionId) {
  const row = workspaceRowForCwd(db, workspaceCwd)
  pack.workspace = {
    cwd: workspaceCwd,
    name: row?.name || folderName(workspaceCwd),
    ...(sessionId ? { activeSessionId: sessionId } : {}),
  }
}

async function fillTasks(db, pack, workspaceCwd) {
  const row = workspaceRowForCwd(db, workspaceCwd)
  const workspaceId = row?.id || 'ws_personal'
  const dayStart = isoDayStart()
  const dayEnd = isoDayEnd()
  const now = new Date().toISOString()
  const todayRows = db.prepare(`
    SELECT id, title, status, due_at FROM tasks
    WHERE workspace_id = ? AND status IN ('todo', 'doing')
      AND due_at IS NOT NULL AND due_at >= ? AND due_at <= ?
    ORDER BY due_at ASC LIMIT 20
  `).all(workspaceId, dayStart, dayEnd)
  const overdue = db.prepare(`
    SELECT COUNT(*) AS n FROM tasks
    WHERE workspace_id = ? AND status IN ('todo', 'doing')
      AND due_at IS NOT NULL AND due_at < ?
  `).get(workspaceId, now)
  pack.tasks = {
    today: todayRows.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueAt: t.due_at ?? undefined,
    })),
    overdue: Number(overdue?.n || 0),
  }
}

async function fillIm(aiRuntime, pack) {
  const state = await aiRuntime.lanAssist('/state', { search: {} })
  const unread = Number(state?.unreadTotal ?? state?.unread ?? 0)
  const requests = Array.isArray(state?.requests) ? state.requests : []
  const recent = requests.slice(0, 3).map((row) => ({
    peer: String(row?.peerName || row?.from || row?.peerId || '会话'),
    excerpt: String(row?.excerpt || row?.preview || row?.subject || '').slice(0, 160),
    requestId: String(row?.requestId || row?.id || ''),
  }))
  pack.im = { unread, recent }
}

async function fillBiz(db, pack, workspaceCwd) {
  const row = workspaceRowForCwd(db, workspaceCwd)
  const workspaceId = row?.id || 'ws_personal'
  const connections = listBusinessConnections(db, { workspaceId }).slice(0, 6).map((c) => ({
    id: c.id,
    name: c.name,
    online: c.status === 'active' || c.status === 'connected',
  }))
  const ops = listOperations(db, { workspaceId, limit: 3 })
  pack.biz = {
    connections: connections.slice(0, 6),
    recentOps: ops.map((op) => ({
      kind: op.operationKind || 'op',
      action: op.action || op.targetRef || '',
      at: op.updatedAt || op.createdAt,
    })),
  }
}

async function fillApps(db, pack, workspaceCwd) {
  const row = workspaceRowForCwd(db, workspaceCwd)
  const workspaceId = row?.id || 'ws_personal'
  const apps = listBusinessApps(db, { workspaceId }).slice(0, 8).map((app) => {
    let entities = []
    try {
      const def = app.definition && typeof app.definition === 'object' ? app.definition : {}
      const spec = def.spec || def
      const list = spec?.entities || spec?.collections || []
      if (Array.isArray(list)) entities = list.map((e) => String(e?.name || e?.slug || e)).filter(Boolean)
    } catch { /* keep empty */ }
    return {
      slug: app.id,
      name: app.name,
      entities: entities.slice(0, 6),
    }
  })
  pack.apps = apps
}

async function fillMemory(aiRuntime, pack, { workspaceCwd, query, entity, intentKind }, warnings) {
  const ready = await semanticReady(aiRuntime)
  if (!ready) {
    warnings.push('memory_engine_not_ready')
    return
  }
  const memoryQuery = buildMemoryQuery({ query, entity, intentKind })
  if (!memoryQuery) {
    warnings.push('memory_query_missing')
    return
  }
  const memory = { hits: [], precedents: [] }
  try {
    const found = await semanticFind(aiRuntime, memoryQuery, workspaceCwd)
    memory.hits = mapFindHits(found, 5)
  } catch (error) {
    warnings.push('memory_find_failed')
    console.warn('context_pack_memory_find_failed', error)
  }
  try {
    const prec = await semanticPython(aiRuntime, 'find_precedents', {
      scenario: memoryQuery.slice(0, 500),
      max_results: 3,
    }, workspaceCwd)
    memory.precedents = mapPrecedents(prec?.result ?? prec, 3)
  } catch (error) {
    warnings.push('memory_precedents_failed')
    console.warn('context_pack_precedents_failed', error)
  }
  if (intentKind === 'decision') {
    try {
      const brief = await semanticPython(aiRuntime, 'brief_for_decision', {
        scenario: memoryQuery.slice(0, 500),
      }, workspaceCwd)
      const text = typeof brief?.brief === 'string' ? brief.brief
        : typeof brief?.result === 'string' ? brief.result
          : typeof brief?.text === 'string' ? brief.text
            : ''
      if (text) memory.decisionBrief = text.slice(0, 800)
    } catch (error) {
      warnings.push('memory_decision_brief_failed')
      console.warn('context_pack_decision_brief_failed', error)
    }
  }
  pack.memory = memory
}

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, aiRuntime: object }} deps
 */
export async function buildContextPack(deps, input) {
  const {
    workspaceCwd,
    scopes = [],
    query,
    entity,
    intentKind,
    sessionId,
  } = input
  const warnings = []
  const pack = { generatedAt: Date.now() }
  const cwd = typeof workspaceCwd === 'string' && workspaceCwd.startsWith('/') ? workspaceCwd : ''
  const scopeList = scopes.filter((s) => ALLOWED_SCOPES.has(s))
  const deadline = Date.now() + PACK_BUDGET_MS

  if (!cwd) {
    return { pack, warnings: ['workspace_cwd_missing'] }
  }

  for (const scope of scopeList) {
    const result = await withBudget(deadline, async () => {
      try {
        if (scope === 'workspace') await fillWorkspace(deps.db, pack, cwd, sessionId)
        else if (scope === 'tasks') await fillTasks(deps.db, pack, cwd)
        else if (scope === 'im') await fillIm(deps.aiRuntime, pack)
        else if (scope === 'biz') await fillBiz(deps.db, pack, cwd)
        else if (scope === 'apps') await fillApps(deps.db, pack, cwd)
        else if (scope === 'memory') await fillMemory(deps.aiRuntime, pack, { workspaceCwd: cwd, query, entity, intentKind }, warnings)
        return { ok: true }
      } catch (error) {
        warnings.push(`${scope}_failed`)
        console.warn(`context_pack_scope_failed_${scope}`, error)
        return { ok: false }
      }
    })
    if (result?.skipped) {
      warnings.push(`${scope}_timeout`)
    }
  }

  if (!pack.workspace) {
    await fillWorkspace(deps.db, pack, cwd, sessionId)
  }
  if (entity && typeof entity === 'object') {
    pack.entity = entity
  }

  return { pack, warnings }
}

/** @param {Record<string, unknown>} pack @param {Set<string>} omit */
export function renderContextForPrompt(pack, omit = new Set()) {
  const lines = []
  const w = pack.workspace && typeof pack.workspace === 'object' ? pack.workspace : null
  if (w && !omit.has('workspace')) {
    lines.push('【工作区】', `${w.name || '工作区'}（${w.cwd || ''}）`)
    if (w.activeSessionTitle) lines.push(`当前会话：${w.activeSessionTitle}`)
  }
  if (pack.tasks && !omit.has('tasks')) {
    const t = pack.tasks
    const today = Array.isArray(t.today) ? t.today : []
    lines.push('【今日待办】', today.length ? today.map((row) => `- ${row.title}（${row.status}）`).join('\n') : '（无）')
    if (typeof t.overdue === 'number' && t.overdue > 0) lines.push(`逾期 ${t.overdue} 条`)
  }
  if (pack.im && !omit.has('im')) {
    const im = pack.im
    lines.push('【IM】', `未读 ${im.unread ?? 0}`)
    const recent = Array.isArray(im.recent) ? im.recent : []
    for (const row of recent) lines.push(`- ${row.peer}：${row.excerpt}`)
  }
  if (pack.biz && !omit.has('biz')) {
    const biz = pack.biz
    const conns = Array.isArray(biz.connections) ? biz.connections : []
    lines.push('【业务连接】', conns.map((c) => `${c.name}${c.online ? '' : '（离线）'}`).join('、') || '（无）')
    const ops = Array.isArray(biz.recentOps) ? biz.recentOps : []
    for (const op of ops) lines.push(`- ${op.kind} ${op.action}`)
  }
  if (pack.apps && !omit.has('apps')) {
    const apps = Array.isArray(pack.apps) ? pack.apps : []
    lines.push('【应用】', apps.map((a) => `${a.name}（${(a.entities || []).join(',')}）`).join('\n'))
  }
  if (pack.memory && !omit.has('memory')) {
    const mem = pack.memory
    const hits = Array.isArray(mem.hits) ? mem.hits : []
    if (hits.length) {
      lines.push('【相关记忆】')
      for (const h of hits) lines.push(`- ${h.excerpt}（${h.id}）`)
    }
    const prec = Array.isArray(mem.precedents) ? mem.precedents : []
    if (prec.length) {
      lines.push('【先例】')
      for (const p of prec) lines.push(`- ${p.title}：${p.excerpt}`)
    }
    if (mem.decisionBrief) lines.push('【决策简报】', String(mem.decisionBrief))
  }
  if (pack.entity && !omit.has('entity')) {
    const e = pack.entity
    lines.push('【来源实体】', `${e.kind || ''} ${e.ref || ''}`)
    const fields = e.fields && typeof e.fields === 'object' ? e.fields : {}
    for (const [key, value] of Object.entries(fields).slice(0, 12)) {
      lines.push(`${key}：${String(value).slice(0, 200)}`)
    }
  }
  let text = lines.join('\n').trim()
  if (text.length > 1500) text = `${text.slice(0, 1497)}…`
  return text
}
