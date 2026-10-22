import { createId } from '../db.mjs'
import { ORIGIN_FDE_TASK, isHostGoalId } from '../host-catalog.mjs'
import { decideProposal, openProposal } from '../proposals/commit.mjs'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  getTask,
  insertTask,
  updateTask,
} from './task-store.mjs'
import { planChangeDetails, taskHistoryView } from './history.mjs'

const ACTION = 'plan.task.propose'

function workspaceExists(db, workspaceId) {
  return Boolean(db.prepare('SELECT 1 FROM workspaces WHERE id = ?').get(workspaceId))
}

function changeFrom(input) {
  const change = {}
  if (typeof input.title === 'string') change.title = input.title.trim()
  if (typeof input.notes === 'string') change.notes = input.notes
  if (typeof input.priority === 'string' && TASK_PRIORITIES.has(input.priority)) change.priority = input.priority
  if (typeof input.dueAt === 'string' || input.dueAt === null) change.dueAt = input.dueAt
  if (Array.isArray(input.tags)) change.tags = input.tags.map(String)
  if (typeof input.status === 'string') change.status = input.status
  return change
}

function invalidShape(input) {
  if (Object.prototype.hasOwnProperty.call(input, 'priority') && !TASK_PRIORITIES.has(input.priority)) {
    return { ok: false, error: 'validation_error', message: '任务优先级无效' }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'dueAt') && input.dueAt !== null && typeof input.dueAt !== 'string') {
    return { ok: false, error: 'validation_error', message: '截止时间无效' }
  }
  return null
}

function snapshotTask(row) {
  let tags = []
  try {
    const parsed = JSON.parse(row.tags_json || '[]')
    tags = Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    tags = []
  }
  return {
    title: row.title,
    notes: row.notes ?? '',
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at ?? null,
    tags,
  }
}

function planDomain(opts) {
  return {
    action: ACTION,
    confirmAction: 'plan.task.confirm',
    rejectAction: 'plan.task.reject',
    actorId: opts.actorId,
    correlationId: opts.correlationId,
    reasons: { missing: 'task_missing', moved: 'stale_task', appeared: 'task_exists' },
    load(db, plan) {
      const row = getTask(db, plan.taskId)
      return { versions: [{ current: row ? row.updated_at : null, base: plan.change.base }] }
    },
    apply(db, plan) {
      if (plan.op === 'insert') {
        insertTask(db, {
          id: plan.taskId,
          workspaceId: plan.workspaceId,
          title: plan.change.title,
          notes: plan.change.notes,
          status: plan.change.status,
          priority: plan.change.priority,
          dueAt: plan.change.dueAt,
          sourceRef: plan.change.sourceRef,
          tags: plan.change.tags,
        })
        const diff = planChangeDetails(null, {}, taskHistoryView(getTask(db, plan.taskId)))
        return { applied: true, details: { op: plan.op, taskId: plan.taskId, before: diff.before, after: diff.after, fields: diff.fields } }
      }
      const before = taskHistoryView(getTask(db, plan.taskId))
      const change = plan.change
      const fields = {}
      if (change.title !== undefined) fields.title = change.title
      if (change.notes !== undefined) fields.notes = change.notes
      if (change.priority !== undefined) fields.priority = change.priority
      if (change.dueAt !== undefined) fields.dueAt = change.dueAt
      if (change.tags !== undefined) fields.tags = change.tags
      if (change.status !== undefined) fields.status = change.status
      const row = updateTask(db, plan.taskId, fields)
      if (!row) return { applied: false }
      const diff = planChangeDetails(null, before, taskHistoryView(row))
      return { applied: true, details: { op: plan.op, taskId: plan.taskId, before: diff.before, after: diff.after, fields: diff.fields } }
    },
    rejectedDetails(db, operation) {
      const plan = operation.plan || {}
      const current = plan.op === 'insert' ? {} : taskHistoryView(getTask(db, plan.taskId))
      const proposed = { ...current }
      const change = plan.change || {}
      for (const field of ['title', 'notes', 'status', 'priority', 'dueAt', 'tags', 'sourceRef']) {
        if (change[field] !== undefined) proposed[field] = change[field]
      }
      const diff = planChangeDetails(null, current, proposed)
      return { before: diff.before, after: diff.after, fields: diff.fields }
    },
  }
}

export function proposePlanTask(db, input) {
  const op = input.op
  if (op !== 'insert' && op !== 'update') {
    return { ok: false, error: 'validation_error', message: 'op 必须是 insert 或 update' }
  }
  const workspaceId = typeof input.workspaceId === 'string' ? input.workspaceId.trim() : ''
  if (!workspaceId) return { ok: false, error: 'validation_error', message: '缺少 workspaceId' }
  if (!workspaceExists(db, workspaceId)) return { ok: false, error: 'not_found', message: '工作区不存在' }
  if (op === 'insert') {
    const title = typeof input.title === 'string' ? input.title.trim() : ''
    if (!title) return { ok: false, error: 'validation_error', message: '标题不能为空' }
    if (typeof input.status === 'string' && !TASK_STATUSES.has(input.status)) {
      return { ok: false, error: 'validation_error', message: '任务状态无效' }
    }
    const shape = invalidShape(input)
    if (shape) return shape
    const taskId = createId('task')
    const sourceRef = typeof input.sourceRef === 'string' && input.sourceRef.trim()
      ? input.sourceRef.trim()
      : `${ORIGIN_FDE_TASK}${taskId}`
    const plan = {
      kind: 'plan.task.propose',
      op,
      workspaceId,
      taskId,
      change: {
        title,
        notes: typeof input.notes === 'string' ? input.notes : '',
        status: typeof input.status === 'string' ? input.status : 'todo',
        priority: TASK_PRIORITIES.has(input.priority) ? input.priority : 'med',
        dueAt: typeof input.dueAt === 'string' ? input.dueAt : null,
        tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
        sourceRef,
        base: null,
      },
    }
    return openProposal(db, {
      workspaceId,
      appId: null,
      actorId: input.actorId,
      targetRef: `fde://plan/tasks/${taskId}`,
      action: ACTION,
      expectedVersion: null,
      plan,
      correlationId: input.correlationId,
    })
  }
  const taskId = typeof input.taskId === 'string' ? input.taskId.trim() : ''
  if (isHostGoalId(taskId)) return { ok: false, error: 'validation_error', message: 'Host goal 只能改状态' }
  if (!taskId) return { ok: false, error: 'not_found', message: '任务不存在' }
  const existing = getTask(db, taskId)
  if (!existing || existing.workspace_id !== workspaceId) {
    return { ok: false, error: 'not_found', message: '任务不存在' }
  }
  const change = changeFrom(input)
  if (change.status !== undefined && !TASK_STATUSES.has(change.status)) {
    return { ok: false, error: 'validation_error', message: '任务状态无效' }
  }
  const shape = invalidShape(input)
  if (shape) return shape
  if (op === 'update' && Object.keys(change).length === 0) {
    return { ok: false, error: 'validation_error', message: '没有要修改的字段' }
  }
  const plan = {
    kind: 'plan.task.propose',
    op,
    workspaceId,
    taskId,
    before: snapshotTask(existing),
    change: { ...change, base: { updated_at: existing.updated_at } },
  }
  return openProposal(db, {
    workspaceId,
    appId: null,
    actorId: input.actorId,
    targetRef: `fde://plan/tasks/${taskId}`,
    action: ACTION,
    expectedVersion: existing.updated_at,
    plan,
    correlationId: input.correlationId,
  })
}

export function decidePlanTask(db, operationId, decision, opts = {}) {
  return decideProposal(db, operationId, decision, planDomain(opts))
}

export function listOpenPlanTaskProposals(db, workspaceId) {
  const rows = db.prepare(`
    SELECT id, workspace_id, plan_json
    FROM operations
    WHERE workspace_id = ? AND state = 'awaiting_approval' AND action = ?
    ORDER BY created_at ASC
  `).all(workspaceId, ACTION)
  return rows.map((row) => {
    const plan = JSON.parse(row.plan_json)
    const proposedTitle = typeof plan.change.title === 'string' ? plan.change.title : ''
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      op: plan.op,
      taskId: plan.taskId,
      title: proposedTitle || plan.before?.title || '',
      before: plan.before ?? null,
      change: plan.change ?? {},
    }
  })
}
