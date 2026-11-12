import { startWorkflowRun } from './workflow-run.mjs'
import { cronOccurrences } from './cron-match.mjs'
import { workspaceRowForCwd } from '../briefing/workspace.mjs'
import { subscribe } from '../events.mjs'

const CRON_LOOKBACK_MS = 2 * 60 * 1000

function jsonOf(raw, fallback) {
  try {
    const value = JSON.parse(raw || '')
    return value && typeof value === 'object' ? value : fallback
  } catch {
    return fallback
  }
}

function textOf(value) {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function keywordHit(patterns, text) {
  const body = String(text || '')
  if (!body) return ''
  const list = Array.isArray(patterns) ? patterns : []
  for (const pattern of list) {
    const needle = String(pattern || '').trim()
    if (needle && body.includes(needle)) return needle
  }
  return ''
}

function isOrderKind(kind) {
  const value = String(kind || '')
  return /订单|order|sales_order|biz_sales_orders/i.test(value)
}

function isCreateAction(action) {
  const value = String(action || '')
  return /^(新建|创建|create|post)$/i.test(value) || value === 'post'
}

function workspaceIdsForEnvelope(db, envelope) {
  const cwd = envelope && envelope.workspaceCwd
  if (cwd) {
    const row = workspaceRowForCwd(db, cwd)
    return row && row.id ? [row.id] : []
  }
  return db.prepare(`SELECT id FROM workspaces WHERE status = 'active'`).all().map((row) => row.id)
}

function activeTriggered(db, workspaceIds) {
  if (!workspaceIds.length) return []
  const placeholders = workspaceIds.map(() => '?').join(',')
  return db.prepare(`
    SELECT id, workspace_id, status, trigger_json
    FROM workflows
    WHERE workspace_id IN (${placeholders})
      AND status = 'active'
  `).all(...workspaceIds)
}

function runAuto(deps, { workflowId, workspaceId, correlationId, trigger }) {
  try {
    return startWorkflowRun(deps, { workflowId, workspaceId, correlationId, trigger })
  } catch (error) {
    if (error && error.status === 409) return { busy: true, workflowId }
    throw error
  }
}

export function matchKeyword(patterns, text) {
  return keywordHit(patterns, text)
}

export function dispatchWorkflowEnvelope(deps, envelope) {
  if (!envelope || typeof envelope !== 'object') return []
  const db = deps.db
  const type = String(envelope.type || '')
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  const started = []
  let workspaceIds = workspaceIdsForEnvelope(db, envelope)
  if (type === 'im.message.received' && payload.workspace) {
    const row = workspaceRowForCwd(db, payload.workspace)
    workspaceIds = row && row.id ? [row.id] : []
  }
  const rows = activeTriggered(db, workspaceIds)

  const fireEvent = (on, sourceId) => {
    const id = String(sourceId || '').trim()
    if (!id) return
    for (const row of rows) {
      const trigger = jsonOf(row.trigger_json, {})
      if (trigger.kind !== 'event' || trigger.on !== on) continue
      started.push(runAuto(deps, {
        workflowId: row.id,
        workspaceId: row.workspace_id,
        correlationId: `event:${on}:${row.id}:${id}`,
        trigger: { kind: 'event', on, sourceId: id },
      }))
    }
  }

  const fireKeyword = (sourceId, text) => {
    const id = String(sourceId || '').trim()
    if (!id) return
    for (const row of rows) {
      const trigger = jsonOf(row.trigger_json, {})
      if (trigger.kind !== 'keyword') continue
      const pattern = keywordHit(trigger.patterns, text)
      if (!pattern) continue
      started.push(runAuto(deps, {
        workflowId: row.id,
        workspaceId: row.workspace_id,
        correlationId: `keyword:${row.id}:${id}`,
        trigger: { kind: 'keyword', sourceId: id, pattern },
      }))
    }
  }

  if (type === 'task.changed' && payload.status === 'done' && payload.op === 'update') {
    fireEvent('task.done', payload.id)
  }
  if (type === 'file.save') {
    fireEvent('file.save', payload.path || payload.relPath)
  }
  if (type === 'im.message.received') {
    const requestId = payload.requestId || payload.id
    const text = textOf(payload.text) || textOf(payload.excerpt) || textOf(payload.body)
    fireEvent('im.received', requestId)
    fireKeyword(requestId, text)
  }
  if (type === 'biz.write.done' && isOrderKind(payload.kind) && isCreateAction(payload.action)) {
    fireEvent('order.new', payload.recordNo || payload.traceId)
  }
  if (type === 'app.record.changed' && payload.op === 'create' && isOrderKind(payload.entity || payload.slug)) {
    const rid = Array.isArray(payload.rids) && payload.rids[0] ? payload.rids[0] : payload.title
    fireEvent('order.new', rid)
  }
  return started
}

export function tickWorkflowCrons(deps, clock) {
  const now = clock.now instanceof Date ? clock.now : new Date(clock.now)
  const bootedAt = clock.bootedAt instanceof Date ? clock.bootedAt : new Date(clock.bootedAt)
  const fromMs = Math.max(bootedAt.getTime(), now.getTime() - CRON_LOOKBACK_MS)
  const rows = deps.db.prepare(`
    SELECT id, workspace_id, trigger_json
    FROM workflows
    WHERE status = 'active'
  `).all()
  const started = []
  for (const row of rows) {
    const trigger = jsonOf(row.trigger_json, {})
    if (trigger.kind !== 'cron') continue
    const tz = typeof trigger.tz === 'string' && trigger.tz.trim() ? trigger.tz.trim() : 'Asia/Shanghai'
    const hits = cronOccurrences(trigger.expr, tz, fromMs, now.getTime())
    for (const occurrence of hits) {
      if (Date.parse(occurrence) < bootedAt.getTime()) continue
      started.push(runAuto(deps, {
        workflowId: row.id,
        workspaceId: row.workspace_id,
        correlationId: `cron:${row.id}:${occurrence}`,
        trigger: { kind: 'cron', occurrence, expr: trigger.expr },
      }))
    }
  }
  return { started }
}

export function attachWorkflowEventDispatch(deps) {
  return subscribe((envelope) => {
    try {
      dispatchWorkflowEnvelope(deps, envelope)
    } catch (error) {
      console.error('workflow_event_dispatch_failed', error)
    }
  })
}


