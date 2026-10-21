export const TASK_STATUSES = new Set(['todo', 'doing', 'done', 'archived'])
export const TASK_PRIORITIES = new Set(['low', 'med', 'high', 'urgent'])

const isoNow = () => new Date().toISOString()

export function getTask(db, id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) || null
}

export function listTasks(db, { workspaceId, status, q }) {
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
  return db.prepare(sql).all(...params)
}

export function insertTask(db, input) {
  const now = isoNow()
  const completedAt = input.status === 'done' ? now : null
  db.prepare(`
    INSERT INTO tasks
      (id, workspace_id, title, notes, status, priority, due_at, completed_at, metadata_json, source_ref, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?)
  `).run(
    input.id,
    input.workspaceId,
    input.title,
    input.notes ?? '',
    input.status,
    input.priority,
    input.dueAt ?? null,
    completedAt,
    input.sourceRef,
    JSON.stringify(input.tags ?? []),
    now,
    now,
  )
  return getTask(db, input.id)
}

export function updateTask(db, id, fields) {
  const existing = getTask(db, id)
  if (!existing) return null
  const sets = []
  const params = []
  if (fields.title !== undefined) {
    sets.push('title = ?')
    params.push(fields.title)
  }
  if (fields.notes !== undefined) {
    sets.push('notes = ?')
    params.push(fields.notes)
  }
  if (fields.priority !== undefined) {
    sets.push('priority = ?')
    params.push(fields.priority)
  }
  if (fields.dueAt !== undefined) {
    sets.push('due_at = ?')
    params.push(fields.dueAt)
  }
  if (fields.tags !== undefined) {
    sets.push('tags_json = ?')
    params.push(JSON.stringify(fields.tags))
  }
  if (fields.status !== undefined) {
    sets.push('status = ?')
    params.push(fields.status)
    sets.push('completed_at = ?')
    params.push(fields.status === 'done' ? isoNow() : null)
  }
  if (!sets.length) return existing
  params.push(isoNow(), id)
  db.prepare(`UPDATE tasks SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...params)
  return getTask(db, id)
}

export function deleteTask(db, id) {
  const existing = getTask(db, id)
  if (!existing) return null
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return existing
}
