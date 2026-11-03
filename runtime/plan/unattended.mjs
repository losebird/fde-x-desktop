export function readPlanUnattended(db, workspaceId) {
  const id = typeof workspaceId === 'string' ? workspaceId.trim() : ''
  if (!id) return false
  const row = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(id)
  if (!row) return false
  try {
    const meta = JSON.parse(row.metadata_json ?? '{}')
    return meta && meta.planUnattended === true
  } catch {
    return false
  }
}

export function writePlanUnattended(db, workspaceId, on) {
  const id = typeof workspaceId === 'string' ? workspaceId.trim() : ''
  if (!id) return false
  const row = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(id)
  if (!row) return false
  let meta = {}
  try {
    meta = JSON.parse(row.metadata_json ?? '{}') || {}
  } catch {
    meta = {}
  }
  if (typeof meta !== 'object' || Array.isArray(meta)) meta = {}
  meta.planUnattended = on === true
  db.prepare('UPDATE workspaces SET metadata_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(meta),
    new Date().toISOString(),
    id,
  )
  return true
}
