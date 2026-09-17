import { createId } from '../db.mjs'

const TASK_STATUSES = new Set(['todo', 'doing', 'done', 'archived'])
const WORKFLOW_WRITE_STATUSES = new Set(['active', 'paused'])
const PRIORITIES = new Set(['low', 'med', 'high', 'urgent'])
const EVENT_KINDS = new Set(['meeting', 'focus', 'reminder', 'external'])

const isoNow = () => new Date().toISOString()

function planError(response, status, error, message, correlationId) {
  const body = JSON.stringify({ ok: false, error, message, correlationId })
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

function planOk(response, status, data, correlationId) {
  const body = JSON.stringify({ ok: true, data, correlationId })
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

function parseTags(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function mapTask(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    notes: row.notes ?? '',
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at ?? null,
    completedAt: row.completed_at ?? null,
    tags: parseTags(row.tags_json),
    sourceRef: row.source_ref ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEvent(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone,
    location: row.location ?? null,
    kind: row.event_kind,
    allDay: Boolean(row.all_day),
    sourceRef: row.source_ref ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWorkflow(row) {
  let trigger = { kind: 'manual' }
  let definition = { description: '', category: 'system', emoji: '🤖', steps: [] }
  try {
    trigger = JSON.parse(row.trigger_json)
  } catch { /* keep default */ }
  try {
    definition = { ...definition, ...JSON.parse(row.definition_json) }
  } catch { /* keep default */ }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    status: row.status,
    trigger,
    description: definition.description ?? '',
    category: definition.category ?? 'system',
    emoji: definition.emoji ?? '🤖',
    steps: Array.isArray(definition.steps) ? definition.steps : [],
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function requireWorkspaceId(workspaceId, response, correlationId) {
  if (typeof workspaceId !== 'string' || !workspaceId.trim()) {
    planError(response, 400, 'missing_workspace_id', '缺少 workspaceId', correlationId)
    return null
  }
  return workspaceId.trim()
}

function emitTaskChanged(db, enqueueEvent, { id, op, workspaceId, correlationId }) {
  enqueueEvent(db, {
    type: 'task.changed',
    sourceRef: `fde://workstation/task/${id}`,
    subjectRef: `fde://workstation/workspace/${workspaceId}`,
    correlationId,
    payload: { id, op },
  })
}

function workspaceExists(db, workspaceId) {
  return Boolean(db.prepare('SELECT 1 FROM workspaces WHERE id = ?').get(workspaceId))
}

export async function handlePlanRequest(request, response, url, { db, enqueueEvent, readJson }, correlationId) {
  if (!url.pathname.startsWith('/api/v1/plan/')) return false

  const method = request.method ?? 'GET'
  const segments = url.pathname.split('/').filter(Boolean)

  if (method === 'GET' && url.pathname === '/api/v1/plan/tasks') {
    const workspaceId = requireWorkspaceId(url.searchParams.get('workspaceId'), response, correlationId)
    if (!workspaceId) return true
    const status = url.searchParams.get('status')
    const q = url.searchParams.get('q')
    let sql = 'SELECT * FROM tasks WHERE workspace_id = ?'
    const params = [workspaceId]
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    if (q) {
      sql += ' AND title LIKE ?'
      params.push(`%${q}%`)
    }
    sql += ' ORDER BY created_at DESC'
    const rows = db.prepare(sql).all(...params)
    planOk(response, 200, rows.map(mapTask), correlationId)
    return true
  }

  if (method === 'POST' && url.pathname === '/api/v1/plan/tasks') {
    const body = await readJson(request)
    const workspaceId = requireWorkspaceId(body.workspaceId, response, correlationId)
    if (!workspaceId) return true
    if (!workspaceExists(db, workspaceId)) {
      planError(response, 404, 'not_found', '工作区不存在', correlationId)
      return true
    }
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      planError(response, 422, 'validation_error', '标题不能为空', correlationId)
      return true
    }
    const priority = PRIORITIES.has(body.priority) ? body.priority : 'med'
    const status = TASK_STATUSES.has(body.status) ? body.status : 'todo'
    const now = isoNow()
    const id = createId('task')
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : []
    const dueAt = typeof body.dueAt === 'string' ? body.dueAt : null
    const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef : null
    const completedAt = status === 'done' ? now : null
    db.prepare(`
      INSERT INTO tasks
        (id, workspace_id, title, notes, status, priority, due_at, completed_at, metadata_json, source_ref, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, '', ?, ?, ?, ?, '{}', ?, ?, ?, ?)
    `).run(id, workspaceId, title, status, priority, dueAt, completedAt, sourceRef, JSON.stringify(tags), now, now)
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    emitTaskChanged(db, enqueueEvent, { id, op: 'insert', workspaceId, correlationId })
    planOk(response, 201, mapTask(row), correlationId)
    return true
  }

  const taskPatchMatch = method === 'PATCH' && segments.length === 5 && segments[0] === 'api' && segments[1] === 'v1' && segments[2] === 'plan' && segments[3] === 'tasks'
  if (taskPatchMatch) {
    const id = segments[4]
    const body = await readJson(request)
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    if (!existing) {
      planError(response, 404, 'not_found', '任务不存在', correlationId)
      return true
    }
    if (body.workspaceId && body.workspaceId !== existing.workspace_id) {
      planError(response, 422, 'validation_error', 'workspaceId 不匹配', correlationId)
      return true
    }
    const patch = {}
    if (typeof body.title === 'string') patch.title = body.title.trim()
    if (typeof body.notes === 'string') patch.notes = body.notes
    if (body.priority && PRIORITIES.has(body.priority)) patch.priority = body.priority
    if (typeof body.dueAt === 'string' || body.dueAt === null) patch.due_at = body.dueAt
    if (Array.isArray(body.tags)) patch.tags_json = JSON.stringify(body.tags.map(String))
    if (body.status) {
      if (!TASK_STATUSES.has(body.status)) {
        planError(response, 422, 'invalid_status', '任务状态无效', correlationId)
        return true
      }
      patch.status = body.status
      if (body.status === 'done') patch.completed_at = isoNow()
      else patch.completed_at = null
    }
    const keys = Object.keys(patch)
    if (!keys.length) {
      planOk(response, 200, mapTask(existing), correlationId)
      return true
    }
    const now = isoNow()
    const sets = keys.map((k) => `${k} = ?`).join(', ')
    db.prepare(`UPDATE tasks SET ${sets}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => patch[k]), now, id)
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    emitTaskChanged(db, enqueueEvent, { id, op: 'update', workspaceId: row.workspace_id, correlationId })
    planOk(response, 200, mapTask(row), correlationId)
    return true
  }

  const taskDeleteMatch = method === 'DELETE' && segments.length === 5 && segments[3] === 'tasks'
  if (taskDeleteMatch) {
    const id = segments[4]
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    if (!existing) {
      planError(response, 404, 'not_found', '任务不存在', correlationId)
      return true
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    emitTaskChanged(db, enqueueEvent, { id, op: 'delete', workspaceId: existing.workspace_id, correlationId })
    planOk(response, 200, { id }, correlationId)
    return true
  }

  if (method === 'GET' && url.pathname === '/api/v1/plan/events') {
    const workspaceId = requireWorkspaceId(url.searchParams.get('workspaceId'), response, correlationId)
    if (!workspaceId) return true
    const fromMs = Number(url.searchParams.get('from'))
    const toMs = Number(url.searchParams.get('to'))
    const fromIso = Number.isFinite(fromMs) ? new Date(fromMs).toISOString() : null
    const toIso = Number.isFinite(toMs) ? new Date(toMs).toISOString() : null
    let sql = 'SELECT * FROM calendar_events WHERE workspace_id = ?'
    const params = [workspaceId]
    if (fromIso) {
      sql += ' AND end_at >= ?'
      params.push(fromIso)
    }
    if (toIso) {
      sql += ' AND start_at <= ?'
      params.push(toIso)
    }
    sql += ' ORDER BY start_at ASC'
    const rows = db.prepare(sql).all(...params)
    planOk(response, 200, rows.map(mapEvent), correlationId)
    return true
  }

  if (method === 'POST' && url.pathname === '/api/v1/plan/events') {
    const body = await readJson(request)
    const workspaceId = requireWorkspaceId(body.workspaceId, response, correlationId)
    if (!workspaceId) return true
    if (!workspaceExists(db, workspaceId)) {
      planError(response, 404, 'not_found', '工作区不存在', correlationId)
      return true
    }
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const startAt = typeof body.startAt === 'string' ? body.startAt : ''
    const endAt = typeof body.endAt === 'string' ? body.endAt : ''
    if (!title || !startAt || !endAt) {
      planError(response, 422, 'validation_error', '标题与起止时间必填', correlationId)
      return true
    }
    const kind = EVENT_KINDS.has(body.kind) ? body.kind : 'meeting'
    const now = isoNow()
    const id = createId('cevt')
    const location = typeof body.location === 'string' ? body.location : null
    const timezone = typeof body.timezone === 'string' ? body.timezone : 'Asia/Shanghai'
    const allDay = body.allDay ? 1 : 0
    const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef : null
    db.prepare(`
      INSERT INTO calendar_events
        (id, workspace_id, title, start_at, end_at, timezone, location, event_kind, metadata_json, source_ref, all_day, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)
    `).run(id, workspaceId, title, startAt, endAt, timezone, location, kind, sourceRef, allDay, now, now)
    const row = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id)
    planOk(response, 201, mapEvent(row), correlationId)
    return true
  }

  const eventPatchMatch = method === 'PATCH' && segments.length === 5 && segments[3] === 'events'
  if (eventPatchMatch) {
    const id = segments[4]
    const body = await readJson(request)
    const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id)
    if (!existing) {
      planError(response, 404, 'not_found', '日程不存在', correlationId)
      return true
    }
    const patch = {}
    if (typeof body.title === 'string') patch.title = body.title.trim()
    if (typeof body.startAt === 'string') patch.start_at = body.startAt
    if (typeof body.endAt === 'string') patch.end_at = body.endAt
    if (typeof body.location === 'string' || body.location === null) patch.location = body.location
    if (body.kind && EVENT_KINDS.has(body.kind)) patch.event_kind = body.kind
    if (typeof body.allDay === 'boolean') patch.all_day = body.allDay ? 1 : 0
    const keys = Object.keys(patch)
    if (!keys.length) {
      planOk(response, 200, mapEvent(existing), correlationId)
      return true
    }
    const now = isoNow()
    const sets = keys.map((k) => `${k} = ?`).join(', ')
    db.prepare(`UPDATE calendar_events SET ${sets}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => patch[k]), now, id)
    const row = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id)
    planOk(response, 200, mapEvent(row), correlationId)
    return true
  }

  const eventDeleteMatch = method === 'DELETE' && segments.length === 5 && segments[3] === 'events'
  if (eventDeleteMatch) {
    const id = segments[4]
    const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id)
    if (!existing) {
      planError(response, 404, 'not_found', '日程不存在', correlationId)
      return true
    }
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id)
    planOk(response, 200, { id }, correlationId)
    return true
  }

  if (method === 'GET' && url.pathname === '/api/v1/plan/workflows') {
    const workspaceId = requireWorkspaceId(url.searchParams.get('workspaceId'), response, correlationId)
    if (!workspaceId) return true
    const rows = db.prepare('SELECT * FROM workflows WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId)
    planOk(response, 200, rows.map(mapWorkflow), correlationId)
    return true
  }

  if (method === 'POST' && url.pathname === '/api/v1/plan/workflows') {
    const body = await readJson(request)
    const workspaceId = requireWorkspaceId(body.workspaceId, response, correlationId)
    if (!workspaceId) return true
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      planError(response, 422, 'validation_error', '名称不能为空', correlationId)
      return true
    }
    const status = WORKFLOW_WRITE_STATUSES.has(body.status) ? body.status : 'paused'
    const trigger = body.trigger && typeof body.trigger === 'object' ? body.trigger : { kind: 'manual' }
    const definition = {
      description: typeof body.description === 'string' ? body.description : '',
      category: body.category ?? 'system',
      emoji: body.emoji ?? '🤖',
      steps: Array.isArray(body.steps) ? body.steps : [],
    }
    const now = isoNow()
    const id = createId('wf')
    db.prepare(`
      INSERT INTO workflows
        (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, workspaceId, name, status, JSON.stringify(trigger), JSON.stringify(definition), now, now)
    const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id)
    planOk(response, 201, mapWorkflow(row), correlationId)
    return true
  }

  const wfPatchMatch = method === 'PATCH' && segments.length === 5 && segments[3] === 'workflows'
  if (wfPatchMatch) {
    const id = segments[4]
    const body = await readJson(request)
    const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id)
    if (!existing) {
      planError(response, 404, 'not_found', '工作流不存在', correlationId)
      return true
    }
    const patch = {}
    if (typeof body.name === 'string') patch.name = body.name.trim()
    if (body.status) {
      if (!WORKFLOW_WRITE_STATUSES.has(body.status)) {
        planError(response, 422, 'invalid_status', '工作流状态只能是 active 或 paused', correlationId)
        return true
      }
      patch.status = body.status
    }
    if (body.trigger && typeof body.trigger === 'object') patch.trigger_json = JSON.stringify(body.trigger)
    if (body.description !== undefined || body.steps !== undefined || body.category !== undefined || body.emoji !== undefined) {
      let definition = {}
      try {
        definition = JSON.parse(existing.definition_json)
      } catch { /* empty */ }
      if (typeof body.description === 'string') definition.description = body.description
      if (body.category) definition.category = body.category
      if (body.emoji) definition.emoji = body.emoji
      if (Array.isArray(body.steps)) definition.steps = body.steps
      patch.definition_json = JSON.stringify(definition)
    }
    const keys = Object.keys(patch)
    if (!keys.length) {
      planOk(response, 200, mapWorkflow(existing), correlationId)
      return true
    }
    const now = isoNow()
    const sets = keys.map((k) => `${k} = ?`).join(', ')
    db.prepare(`UPDATE workflows SET ${sets}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => patch[k]), now, id)
    const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id)
    planOk(response, 200, mapWorkflow(row), correlationId)
    return true
  }

  const wfDeleteMatch = method === 'DELETE' && segments.length === 5 && segments[3] === 'workflows'
  if (wfDeleteMatch) {
    const id = segments[4]
    const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id)
    if (!existing) {
      planError(response, 404, 'not_found', '工作流不存在', correlationId)
      return true
    }
    db.prepare('DELETE FROM workflows WHERE id = ?').run(id)
    planOk(response, 200, { id }, correlationId)
    return true
  }

  planError(response, 404, 'not_found', '接口不存在', correlationId)
  return true
}
