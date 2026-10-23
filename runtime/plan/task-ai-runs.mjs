import { createId } from '../db.mjs'

const isoNow = () => new Date().toISOString()

function mapRun(row) {
  if (!row) return null
  return {
    id: row.id,
    taskId: row.task_id,
    sessionId: row.session_id,
    requestId: row.request_id,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listTaskAiRuns(db, taskId) {
  const rows = db.prepare(`
    SELECT id, task_id, session_id, request_id, state, created_at, updated_at
    FROM task_ai_runs
    WHERE task_id = ?
    ORDER BY created_at ASC
  `).all(taskId)
  return rows.map(mapRun)
}

export function startTaskAiRun(db, input) {
  const taskId = String(input.taskId || '').trim()
  const requestId = String(input.requestId || '').trim()
  const sessionId = input.sessionId == null ? '' : String(input.sessionId).trim()
  if (!taskId || !requestId) {
    return { ok: false, status: 422, error: 'validation_error', message: '缺少会话或请求' }
  }
  const running = db.prepare(`
    SELECT id FROM task_ai_runs WHERE task_id = ? AND state = 'running'
  `).get(taskId)
  if (running) {
    return { ok: false, status: 409, error: 'ai_run_busy', message: '已在处理' }
  }
  const now = isoNow()
  const id = createId('run')
  db.prepare(`
    INSERT INTO task_ai_runs
      (id, task_id, session_id, request_id, state, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'running', ?, ?)
  `).run(id, taskId, sessionId, requestId, now, now)
  return { ok: true, status: 201, data: mapRun(db.prepare('SELECT * FROM task_ai_runs WHERE id = ?').get(id)) }
}

export function cancelTaskAiRun(db, taskId) {
  const running = db.prepare(`
    SELECT * FROM task_ai_runs
    WHERE task_id = ? AND state = 'running'
    ORDER BY created_at DESC
  `).get(taskId)
  if (!running) return { ok: false, status: 404, error: 'not_found', message: '没有进行中的处理' }
  const now = isoNow()
  db.prepare(`UPDATE task_ai_runs SET state = 'cancelled', updated_at = ? WHERE id = ?`).run(now, running.id)
  return { ok: true, status: 200, data: mapRun(db.prepare('SELECT * FROM task_ai_runs WHERE id = ?').get(running.id)) }
}

const PREVIEW_ID = /^pv_[0-9a-f]{8}$/i

function textHasPreviewId(text, previewId) {
  const hay = String(text || '')
  const needle = String(previewId || '').toLowerCase()
  if (!hay || !PREVIEW_ID.test(needle)) return false
  const lower = hay.toLowerCase()
  let from = 0
  while (from <= lower.length - needle.length) {
    const at = lower.indexOf(needle, from)
    if (at < 0) return false
    const before = at > 0 ? lower[at - 1] : ''
    const after = lower[at + needle.length] || ''
    if (!/[0-9a-f]/.test(before) && !/[0-9a-f]/.test(after)) return true
    from = at + 1
  }
  return false
}

export function completeTaskAiRun(db, taskId) {
  const id = String(taskId || '').trim()
  if (!id) return { ok: true, completed: false, runs: [] }
  const now = isoNow()
  const running = db.prepare(`
    SELECT id FROM task_ai_runs WHERE task_id = ? AND state = 'running'
  `).all(id)
  if (running.length === 0) return { ok: true, completed: false, runs: [] }
  const update = db.prepare(`
    UPDATE task_ai_runs SET state = 'completed', updated_at = ? WHERE id = ? AND state = 'running'
  `)
  const runs = []
  for (const row of running) {
    if (update.run(now, row.id).changes !== 1) continue
    runs.push(mapRun(db.prepare('SELECT * FROM task_ai_runs WHERE id = ?').get(row.id)))
  }
  return { ok: true, completed: runs.length > 0, runs }
}

function linkedTaskIds(db, sessionId, previewId) {
  const taskIds = new Set()
  if (sessionId) {
    const rows = db.prepare(`
      SELECT DISTINCT task_id FROM task_ai_runs
      WHERE state = 'running' AND session_id = ?
    `).all(sessionId)
    for (const row of rows) taskIds.add(row.task_id)
  }
  if (!PREVIEW_ID.test(String(previewId || ''))) return taskIds
  const running = db.prepare(`
    SELECT DISTINCT task_id FROM task_ai_runs WHERE state = 'running'
  `).all()
  const notesFor = db.prepare('SELECT notes FROM tasks WHERE id = ?')
  for (const row of running) {
    const task = notesFor.get(row.task_id)
    if (task && textHasPreviewId(task.notes, previewId)) taskIds.add(row.task_id)
  }
  const open = db.prepare(`
    SELECT plan_json FROM operations
    WHERE state = 'awaiting_approval' AND action = 'plan.task.propose'
  `).all()
  for (const row of open) {
    let plan
    try {
      plan = JSON.parse(row.plan_json)
    } catch {
      continue
    }
    const notes = plan && plan.change && typeof plan.change.notes === 'string' ? plan.change.notes : ''
    if (!textHasPreviewId(notes, previewId)) continue
    const taskId = String(plan.taskId || '').trim()
    if (taskId) taskIds.add(taskId)
  }
  return taskIds
}

export function finishWorkstationHandoff(db, input = {}) {
  if (input.ok === false) return { ok: true, completed: false, runs: [] }
  if (input.rollback) return { ok: true, completed: false, runs: [] }
  const sessionId = String(input.sessionId || '').trim()
  const previewId = String(input.previewId || '').trim()
  const runs = []
  for (const taskId of linkedTaskIds(db, sessionId, previewId)) {
    const result = completeTaskAiRun(db, taskId)
    if (result.completed) runs.push(...result.runs)
  }
  return { ok: true, completed: runs.length > 0, runs }
}
