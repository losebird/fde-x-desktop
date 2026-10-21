import { isHostGoalId, isHostJobId, isHostScheduleId } from '../host-catalog.mjs'

const TEXT_LIMIT = 200
const TARGET_REF = /^fde:\/\/plan\/(tasks|events|workflows)\/(.+)$/

export function clipPlanValue(value) {
  if (typeof value === 'string') {
    return value.length > TEXT_LIMIT ? value.slice(0, TEXT_LIMIT) : value
  }
  if (value == null || typeof value !== 'object') return value ?? null
  const json = JSON.stringify(value)
  if (json.length <= TEXT_LIMIT) return value
  return json.slice(0, TEXT_LIMIT)
}

export function planChangeDetails(id, before, after, extra = {}) {
  const beforeView = before && typeof before === 'object' ? before : {}
  const afterView = after && typeof after === 'object' ? after : {}
  const fields = []
  const beforeOut = {}
  const afterOut = {}
  const keys = [...new Set([...Object.keys(beforeView), ...Object.keys(afterView)])]
  for (const field of keys) {
    const left = Object.hasOwn(beforeView, field) ? beforeView[field] : null
    const right = Object.hasOwn(afterView, field) ? afterView[field] : null
    if (JSON.stringify(left) === JSON.stringify(right)) continue
    fields.push(field)
    beforeOut[field] = clipPlanValue(left)
    afterOut[field] = clipPlanValue(right)
  }
  const details = {}
  if (id) details.id = id
  details.before = beforeOut
  details.after = afterOut
  details.fields = fields
  if (typeof extra.via === 'string' && extra.via.trim()) details.via = extra.via.trim()
  return details
}

function tagsOf(raw) {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function jsonOf(raw, fallback) {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function taskHistoryView(row) {
  if (!row) return {}
  return {
    title: row.title ?? '',
    notes: row.notes ?? '',
    status: row.status ?? '',
    priority: row.priority ?? '',
    dueAt: row.due_at ?? null,
    tags: tagsOf(row.tags_json),
    sourceRef: row.source_ref ?? null,
  }
}

export function eventHistoryView(row) {
  if (!row) return {}
  return {
    title: row.title ?? '',
    startAt: row.start_at ?? '',
    endAt: row.end_at ?? '',
    timezone: row.timezone ?? '',
    location: row.location ?? null,
    kind: row.event_kind ?? '',
    allDay: Boolean(row.all_day),
    workflowId: row.workflow_id ?? null,
    recurrence: row.recurrence ?? null,
  }
}

export function workflowHistoryView(row) {
  if (!row) return {}
  const trigger = jsonOf(row.trigger_json, { kind: 'manual' })
  const definition = jsonOf(row.definition_json, {})
  return {
    name: row.name ?? '',
    status: row.status ?? '',
    trigger,
    description: typeof definition.description === 'string' ? definition.description : '',
    steps: Array.isArray(definition.steps) ? definition.steps : [],
    category: definition.category ?? '',
    emoji: definition.emoji ?? '',
  }
}

function hostKind(kind, id) {
  if (kind === 'tasks') return isHostGoalId(id)
  if (kind === 'events') return isHostScheduleId(id)
  if (kind === 'workflows') return isHostJobId(id)
  return false
}

function ownedRow(db, kind, id) {
  if (kind === 'tasks') return db.prepare('SELECT workspace_id FROM tasks WHERE id = ?').get(id) || null
  if (kind === 'events') return db.prepare('SELECT workspace_id, workflow_id FROM calendar_events WHERE id = ?').get(id) || null
  return db.prepare('SELECT workspace_id FROM workflows WHERE id = ?').get(id) || null
}

function actorFor(action) {
  if (action === 'plan.task.confirm' || action === 'plan.task.reject') return 'ai'
  return 'you'
}

function labelFor(action, legacy) {
  if (legacy) return '（早期记录无详情）'
  if (action.endsWith('.insert')) return '新建'
  if (action === 'plan.task.confirm') return 'AI 提案 · 已确认'
  if (action === 'plan.task.reject') return 'AI 提案 · 已拒绝'
  if (action.endsWith('.delete')) return '删除'
  return '编辑'
}

function valueAt(bag, field) {
  if (!bag || typeof bag !== 'object' || !Object.hasOwn(bag, field)) return null
  return bag[field]
}

function changeEntry(row) {
  let details = {}
  try {
    details = JSON.parse(row.details_json)
  } catch {
    details = {}
  }
  if (row.action === 'plan.workflow.tools' && Array.isArray(details.before) && Array.isArray(details.after)) {
    return {
      at: row.occurred_at,
      kind: 'change',
      action: row.action,
      actor: 'you',
      legacy: false,
      changes: [{ field: 'tools', before: clipPlanValue(details.before), after: clipPlanValue(details.after) }],
      label: '编辑',
    }
  }
  const fields = Array.isArray(details.fields) ? details.fields : null
  const legacy = !fields
  const entry = {
    at: row.occurred_at,
    kind: 'change',
    action: row.action,
    actor: actorFor(row.action),
    legacy,
    changes: legacy
      ? null
      : fields.map((field) => ({
        field,
        before: valueAt(details.before, field),
        after: valueAt(details.after, field),
      })),
    label: labelFor(row.action, legacy),
  }
  if (typeof details.via === 'string' && details.via) entry.via = details.via
  return entry
}

function runEntry(row) {
  const trigger = jsonOf(row.trigger_json, {})
  const output = jsonOf(row.output_json, {})
  const kind = trigger.kind === 'schedule' ? 'schedule' : 'manual'
  const message = typeof output.message === 'string' ? output.message : ''
  const run = {
    id: row.id,
    state: row.state,
    message,
    trigger: kind,
  }
  if (typeof output.sessionId === 'string' && output.sessionId) run.sessionId = output.sessionId
  return {
    at: row.finished_at || row.started_at || row.created_at,
    kind: 'run',
    action: 'workflow.run',
    actor: 'system',
    legacy: false,
    changes: null,
    label: message || row.state,
    run,
  }
}

function auditEntries(db, workspaceId, targetRef) {
  const rows = db.prepare(`
    SELECT action, details_json, occurred_at
    FROM audit_entries
    WHERE workspace_id = ? AND target_ref = ? AND outcome IN ('succeeded', 'rejected')
    ORDER BY occurred_at DESC, rowid DESC
  `).all(workspaceId, targetRef)
  return rows.filter((row) => row.action !== 'plan.task.propose').map(changeEntry)
}

function runRows(db, workflowId) {
  return db.prepare(`
    SELECT id, state, trigger_json, output_json, started_at, finished_at, created_at
    FROM workflow_runs
    WHERE workflow_id = ?
    ORDER BY created_at DESC, rowid DESC
  `).all(workflowId)
}

function workflowRuns(db, workflowId) {
  return runRows(db, workflowId).map(runEntry)
}

function eventRuns(db, eventId, workflowId) {
  if (!workflowId) return []
  return runRows(db, workflowId).filter((row) => {
    const trigger = jsonOf(row.trigger_json, {})
    return trigger.kind === 'schedule' && trigger.eventId === eventId
  }).map(runEntry)
}

export function readPlanHistory(db, { workspaceId, targetRef }) {
  const match = TARGET_REF.exec(String(targetRef || ''))
  if (!match) return { error: 'validation_error', message: 'targetRef 无效' }
  const kind = match[1]
  const id = match[2]
  const hostManaged = hostKind(kind, id)
  const owned = ownedRow(db, kind, id)
  if (!hostManaged && (!owned || owned.workspace_id !== workspaceId)) {
    return { error: 'not_found', message: '记录不存在' }
  }
  const entries = auditEntries(db, workspaceId, `fde://plan/${kind}/${id}`)
  if (kind === 'workflows' && owned && owned.workspace_id === workspaceId) {
    entries.push(...workflowRuns(db, id))
  }
  if (kind === 'events' && owned && owned.workspace_id === workspaceId) {
    entries.push(...eventRuns(db, id, owned.workflow_id))
  }
  entries.sort((left, right) => {
    if (left.at === right.at) return 0
    return left.at < right.at ? 1 : -1
  })
  return {
    hostManaged,
    note: hostManaged ? 'Host 管理' : undefined,
    entries,
  }
}
