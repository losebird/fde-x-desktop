import { appendAudit, createId } from '../db.mjs'
import { emit } from '../events.mjs'
import { collectBag, mutateBag } from '../catalog-collect.mjs'
import {
  ORIGIN_FDE_TASK,
  collectGoals,
  isHostGoalId,
  isHostScheduleId,
  isHostJobId,
  mergeTaskRows,
  mutateHostGoal,
} from '../host-catalog.mjs'
import { decidePlanTask, listOpenPlanTaskProposals } from '../plan/task-proposals.mjs'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  deleteTask,
  getTask,
  insertTask,
  listTasks,
  updateTask,
} from '../plan/task-store.mjs'

const WORKFLOW_WRITE_STATUSES = new Set(['active', 'paused'])
const EVENT_KINDS = new Set(['meeting', 'focus', 'reminder', 'external'])

const isoNow = () => new Date().toISOString()

function planWrote(response, status, data, correlationId, db, audit) {
  appendAudit(db, {
    workspaceId: audit.workspaceId ?? null,
    actorId: 'actor_local_user',
    action: audit.action,
    targetRef: audit.targetRef ?? null,
    outcome: 'succeeded',
    riskLevel: 'low',
    correlationId,
    details: audit.details ?? {},
  })
  planOk(response, status, data, correlationId)
}

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

function planRowId(segment) {
  const raw = String(segment || '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function requireWorkspaceId(workspaceId, response, correlationId) {
  if (typeof workspaceId !== 'string' || !workspaceId.trim()) {
    planError(response, 400, 'missing_workspace_id', '缺少 workspaceId', correlationId)
    return null
  }
  return workspaceId.trim()
}

function workspaceCwdForEmit(db, workspaceId) {
  const row = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(workspaceId)
  if (!row) return null
  try {
    const meta = JSON.parse(row.metadata_json ?? '{}')
    const raw = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
    const cwd = String(raw).trim()
    return cwd.startsWith('/') ? cwd : null
  } catch {
    return null
  }
}

function emitTaskChanged(db, { id, op, workspaceId, status, title }) {
  emit('task.changed', { id, op, status, title }, { workspaceCwd: workspaceCwdForEmit(db, workspaceId) })
}

function workspaceExists(db, workspaceId) {
  return Boolean(db.prepare('SELECT 1 FROM workspaces WHERE id = ?').get(workspaceId))
}

async function hostBagFields(aiRuntime, kind, workspaceId, cwd) {
  try {
    const bag = await collectBag(aiRuntime, kind, { workspaceId, cwd })
    return (Array.isArray(bag.items) ? bag.items : []).map((row) => row.fields).filter((row) => row && row.id)
  } catch {
    return []
  }
}

function planEventFromBag(row, workspaceId) {
  const startAt = String(row.startAt || row.createdAt || '')
  return {
    id: row.id,
    workspaceId: row.workspaceId || workspaceId,
    title: String(row.title || row.id),
    startAt,
    endAt: String(row.endAt || startAt),
    timezone: String(row.timezone || 'Asia/Shanghai'),
    location: row.location ?? null,
    kind: EVENT_KINDS.has(row.kind) ? row.kind : 'reminder',
    allDay: Boolean(row.allDay),
    sourceRef: row.sourceRef || row.id,
    createdAt: String(row.createdAt || startAt),
    updatedAt: String(row.updatedAt || row.createdAt || startAt),
  }
}

function planWorkflowFromBag(row, workspaceId) {
  const createdAt = String(row.createdAt || new Date().toISOString())
  return {
    id: row.id,
    workspaceId: row.workspaceId || workspaceId,
    name: String(row.name || row.id),
    status: row.status === 'active' ? 'active' : 'paused',
    trigger: row.trigger && typeof row.trigger === 'object' ? row.trigger : { kind: 'manual' },
    description: String(row.description || ''),
    category: row.category || 'system',
    emoji: row.emoji || '🤖',
    steps: Array.isArray(row.steps) ? row.steps : [],
    createdAt,
    updatedAt: String(row.updatedAt || createdAt),
  }
}

export async function handlePlanRequest(request, response, url, { db, enqueueEvent, readJson, aiRuntime }, correlationId) {
  if (!url.pathname.startsWith('/api/v1/plan/')) return false

  const method = request.method ?? 'GET'
  const segments = url.pathname.split('/').filter(Boolean)

  if (method === 'GET' && url.pathname === '/api/v1/plan/tasks') {
    const workspaceId = requireWorkspaceId(url.searchParams.get('workspaceId'), response, correlationId)
    if (!workspaceId) return true
    const status = url.searchParams.get('status')
    const q = url.searchParams.get('q')
    const rows = listTasks(db, { workspaceId, status, q }).map(mapTask)
    const cwd = workspaceCwdForEmit(db, workspaceId)
    let hostRows = []
    try {
      hostRows = await collectGoals(aiRuntime, { workspaceId, cwd })
    } catch {
      hostRows = []
    }
    const merged = mergeTaskRows(rows, hostRows)
    const filtered = merged.filter((row) => {
      if (status && row.status !== status) return false
      if (q && !String(row.title || '').includes(q)) return false
      return true
    })
    planOk(response, 200, filtered, correlationId)
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
    const priority = TASK_PRIORITIES.has(body.priority) ? body.priority : 'med'
    const status = TASK_STATUSES.has(body.status) ? body.status : 'todo'
    const id = createId('task')
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : []
    const dueAt = typeof body.dueAt === 'string' ? body.dueAt : null
    const sourceRef = typeof body.sourceRef === 'string' && body.sourceRef.trim()
      ? body.sourceRef.trim()
      : `${ORIGIN_FDE_TASK}${id}`
    const row = insertTask(db, {
      id,
      workspaceId,
      title,
      notes: '',
      status,
      priority,
      dueAt,
      sourceRef,
      tags,
    })
    emitTaskChanged(db, { id, op: 'insert', workspaceId, status: row.status, title: row.title })
    planWrote(response, 201, mapTask(row), correlationId, db, {
      workspaceId,
      action: 'plan.task.insert',
      targetRef: `fde://plan/tasks/${id}`,
      details: { id },
    })
    return true
  }

  const taskPatchMatch = method === 'PATCH' && segments.length === 5 && segments[0] === 'api' && segments[1] === 'v1' && segments[2] === 'plan' && segments[3] === 'tasks'
  if (taskPatchMatch) {
    const id = planRowId(segments[4])
    const body = await readJson(request)
    if (isHostGoalId(id)) {
      const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
      const cwd = workspaceId ? workspaceCwdForEmit(db, workspaceId) : null
      try {
        const [updated] = await mutateHostGoal(aiRuntime, { id, status: body.status, cwd })
        if (!updated) {
          planError(response, 404, 'not_found', '任务不存在', correlationId)
          return true
        }
        planWrote(response, 200, updated, correlationId, db, {
          workspaceId: workspaceId || null,
          action: 'plan.task.update',
          targetRef: `fde://plan/tasks/${id}`,
          details: { id },
        })
      } catch (error) {
        planError(response, 502, 'host_goal_failed', error instanceof Error ? error.message : '改不了这条 goal', correlationId)
      }
      return true
    }
    const existing = getTask(db, id)
    if (!existing) {
      planError(response, 404, 'not_found', '任务不存在', correlationId)
      return true
    }
    if (body.workspaceId && body.workspaceId !== existing.workspace_id) {
      planError(response, 422, 'validation_error', 'workspaceId 不匹配', correlationId)
      return true
    }
    const fields = {}
    if (typeof body.title === 'string') fields.title = body.title.trim()
    if (typeof body.notes === 'string') fields.notes = body.notes
    if (body.priority && TASK_PRIORITIES.has(body.priority)) fields.priority = body.priority
    if (typeof body.dueAt === 'string' || body.dueAt === null) fields.dueAt = body.dueAt
    if (Array.isArray(body.tags)) fields.tags = body.tags.map(String)
    if (body.status) {
      if (!TASK_STATUSES.has(body.status)) {
        planError(response, 422, 'invalid_status', '任务状态无效', correlationId)
        return true
      }
      fields.status = body.status
    }
    if (!Object.keys(fields).length) {
      planOk(response, 200, mapTask(existing), correlationId)
      return true
    }
    const row = updateTask(db, id, fields)
    emitTaskChanged(db, { id, op: 'update', workspaceId: row.workspace_id, status: row.status, title: row.title })
    planWrote(response, 200, mapTask(row), correlationId, db, {
      workspaceId: row.workspace_id,
      action: 'plan.task.update',
      targetRef: `fde://plan/tasks/${id}`,
      details: { id },
    })
    return true
  }

  const taskDeleteMatch = method === 'DELETE' && segments.length === 5 && segments[3] === 'tasks'
  if (taskDeleteMatch) {
    const id = planRowId(segments[4])
    if (isHostGoalId(id)) {
      const workspaceId = url.searchParams.get('workspaceId') || ''
      const cwd = workspaceId ? workspaceCwdForEmit(db, workspaceId) : null
      try {
        await mutateHostGoal(aiRuntime, { id, status: 'archived', cwd })
        planWrote(response, 200, { id }, correlationId, db, {
          workspaceId: workspaceId || null,
          action: 'plan.task.delete',
          targetRef: `fde://plan/tasks/${id}`,
          details: { id },
        })
      } catch (error) {
        planError(response, 502, 'host_goal_failed', error instanceof Error ? error.message : '清不了这条 goal', correlationId)
      }
      return true
    }
    const existing = deleteTask(db, id)
    if (!existing) {
      planError(response, 404, 'not_found', '任务不存在', correlationId)
      return true
    }
    emitTaskChanged(db, { id, op: 'delete', workspaceId: existing.workspace_id, status: existing.status, title: existing.title })
    planWrote(response, 200, { id }, correlationId, db, {
      workspaceId: existing.workspace_id,
      action: 'plan.task.delete',
      targetRef: `fde://plan/tasks/${id}`,
      details: { id },
    })
    return true
  }

  if (method === 'GET' && url.pathname === '/api/v1/plan/task-proposals') {
    const workspaceId = requireWorkspaceId(url.searchParams.get('workspaceId'), response, correlationId)
    if (!workspaceId) return true
    planOk(response, 200, listOpenPlanTaskProposals(db, workspaceId), correlationId)
    return true
  }

  const proposalMatch = method === 'POST'
    && segments.length === 6
    && segments[3] === 'task-proposals'
    && (segments[5] === 'confirm' || segments[5] === 'reject')
  if (proposalMatch) {
    await readJson(request)
    const operationId = planRowId(segments[4])
    const decision = segments[5]
    const result = decidePlanTask(db, operationId, decision, { correlationId })
    if (result.kind === 'ok' && decision === 'confirm') {
      const plan = result.operation.plan
      const row = getTask(db, plan.taskId)
      emitTaskChanged(db, {
        id: plan.taskId,
        op: plan.op,
        workspaceId: plan.workspaceId,
        status: row.status,
        title: row.title,
      })
    }
    if (result.kind === 'ok') {
      planOk(response, 200, result.operation, correlationId)
      return true
    }
    if (result.kind === 'not_found' || result.kind === 'not_proposal') {
      planError(response, 404, 'not_found', '提案不存在', correlationId)
      return true
    }
    if (result.kind === 'invalid_state') {
      planError(response, 409, 'invalid_state', '提案已经确认或拒绝', correlationId)
      return true
    }
    if (result.kind === 'stale' && result.reason === 'task_exists') {
      planError(response, 409, 'task_exists', '这个 id 已经有任务', correlationId)
      return true
    }
    if (result.kind === 'stale') {
      planError(response, 409, 'stale_task', '任务在提案之后已变更', correlationId)
      return true
    }
    throw new Error(`unknown proposal result: ${result.kind}`)
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
    const rows = db.prepare(sql).all(...params).map(mapEvent)
    const cwd = workspaceCwdForEmit(db, workspaceId)
    const hostRows = (await hostBagFields(aiRuntime, 'schedule', workspaceId, cwd)).map((row) => planEventFromBag(row, workspaceId))
    const merged = mergeTaskRows(rows, hostRows).filter((row) => {
      if (fromIso && row.endAt < fromIso) return false
      if (toIso && row.startAt > toIso) return false
      return true
    })
    planOk(response, 200, merged, correlationId)
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
    planWrote(response, 201, mapEvent(row), correlationId, db, {
      workspaceId,
      action: 'plan.event.insert',
      targetRef: `fde://plan/events/${id}`,
      details: { id },
    })
    return true
  }

  const eventPatchMatch = method === 'PATCH' && segments.length === 5 && segments[3] === 'events'
  if (eventPatchMatch) {
    const id = planRowId(segments[4])
    const body = await readJson(request)
    if (isHostScheduleId(id)) {
      planError(response, 502, 'host_schedule_failed', 'Host 没有这个动作', correlationId)
      return true
    }
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
    planWrote(response, 200, mapEvent(row), correlationId, db, {
      workspaceId: row.workspace_id,
      action: 'plan.event.update',
      targetRef: `fde://plan/events/${id}`,
      details: { id },
    })
    return true
  }

  const eventDeleteMatch = method === 'DELETE' && segments.length === 5 && segments[3] === 'events'
  if (eventDeleteMatch) {
    const id = planRowId(segments[4])
    if (isHostScheduleId(id)) {
      const workspaceId = url.searchParams.get('workspaceId') || ''
      const cwd = workspaceId ? workspaceCwdForEmit(db, workspaceId) : null
      try {
        await mutateBag(aiRuntime, { kind: 'schedule', action: 'delete', id, cwd, workspaceId })
        planWrote(response, 200, { id }, correlationId, db, {
          workspaceId: workspaceId || null,
          action: 'plan.event.delete',
          targetRef: `fde://plan/events/${id}`,
          details: { id },
        })
      } catch (error) {
        planError(response, 502, 'host_schedule_failed', error instanceof Error ? error.message : '清不了这条日程', correlationId)
      }
      return true
    }
    const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id)
    if (!existing) {
      planError(response, 404, 'not_found', '日程不存在', correlationId)
      return true
    }
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id)
    planWrote(response, 200, { id }, correlationId, db, {
      workspaceId: existing.workspace_id,
      action: 'plan.event.delete',
      targetRef: `fde://plan/events/${id}`,
      details: { id },
    })
    return true
  }

  if (method === 'GET' && url.pathname === '/api/v1/plan/workflows') {
    const workspaceId = requireWorkspaceId(url.searchParams.get('workspaceId'), response, correlationId)
    if (!workspaceId) return true
    const rows = db.prepare('SELECT * FROM workflows WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId).map(mapWorkflow)
    const cwd = workspaceCwdForEmit(db, workspaceId)
    const hostRows = (await hostBagFields(aiRuntime, 'job', workspaceId, cwd)).map((row) => planWorkflowFromBag(row, workspaceId))
    planOk(response, 200, mergeTaskRows(rows, hostRows), correlationId)
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
    planWrote(response, 201, mapWorkflow(row), correlationId, db, {
      workspaceId,
      action: 'plan.workflow.insert',
      targetRef: `fde://plan/workflows/${id}`,
      details: { id },
    })
    return true
  }

  const wfPatchMatch = method === 'PATCH' && segments.length === 5 && segments[3] === 'workflows'
  if (wfPatchMatch) {
    const id = planRowId(segments[4])
    const body = await readJson(request)
    if (isHostJobId(id)) {
      if (body.status !== 'paused') {
        planError(response, 502, 'host_job_failed', 'Host 没有这个动作', correlationId)
        return true
      }
      const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''
      const cwd = workspaceId ? workspaceCwdForEmit(db, workspaceId) : null
      try {
        const bag = await mutateBag(aiRuntime, { kind: 'job', action: 'kill', id, cwd, workspaceId })
        const updated = (bag.items || []).map((row) => planWorkflowFromBag(row.fields || row, workspaceId)).find((row) => row.id === id)
        const updatedRow = updated || planWorkflowFromBag({ id, status: 'paused' }, workspaceId)
        planWrote(response, 200, updatedRow, correlationId, db, {
          workspaceId: workspaceId || null,
          action: 'plan.workflow.update',
          targetRef: `fde://plan/workflows/${id}`,
          details: { id },
        })
      } catch (error) {
        planError(response, 502, 'host_job_failed', error instanceof Error ? error.message : '停不了这条 job', correlationId)
      }
      return true
    }
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
    planWrote(response, 200, mapWorkflow(row), correlationId, db, {
      workspaceId: row.workspace_id,
      action: 'plan.workflow.update',
      targetRef: `fde://plan/workflows/${id}`,
      details: { id },
    })
    return true
  }

  const wfDeleteMatch = method === 'DELETE' && segments.length === 5 && segments[3] === 'workflows'
  if (wfDeleteMatch) {
    const id = planRowId(segments[4])
    if (isHostJobId(id)) {
      const workspaceId = url.searchParams.get('workspaceId') || ''
      const cwd = workspaceId ? workspaceCwdForEmit(db, workspaceId) : null
      try {
        await mutateBag(aiRuntime, { kind: 'job', action: 'kill', id, cwd, workspaceId })
        planWrote(response, 200, { id }, correlationId, db, {
          workspaceId: workspaceId || null,
          action: 'plan.workflow.delete',
          targetRef: `fde://plan/workflows/${id}`,
          details: { id },
        })
      } catch (error) {
        planError(response, 502, 'host_job_failed', error instanceof Error ? error.message : '停不了这条 job', correlationId)
      }
      return true
    }
    const existing = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id)
    if (!existing) {
      planError(response, 404, 'not_found', '工作流不存在', correlationId)
      return true
    }
    db.prepare('DELETE FROM workflows WHERE id = ?').run(id)
    planWrote(response, 200, { id }, correlationId, db, {
      workspaceId: existing.workspace_id,
      action: 'plan.workflow.delete',
      targetRef: `fde://plan/workflows/${id}`,
      details: { id },
    })
    return true
  }

  planError(response, 404, 'not_found', '接口不存在', correlationId)
  return true
}
