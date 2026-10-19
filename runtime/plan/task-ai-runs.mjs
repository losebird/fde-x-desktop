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
  const sessionId = String(input.sessionId || '').trim()
  const requestId = String(input.requestId || '').trim()
  if (!taskId || !sessionId || !requestId) {
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
