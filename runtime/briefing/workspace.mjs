import { listWorkspaces } from '../db.mjs'
import { canonicalWorkspaceCwd, sameWorkspaceCwd } from '../cwd.mjs'

export function workspaceRowForCwd(db, workspaceCwd) {
  const cwd = canonicalWorkspaceCwd(workspaceCwd)
  if (!cwd) return null
  for (const row of listWorkspaces(db)) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const path = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
    if (sameWorkspaceCwd(path, cwd)) return row
  }
  return null
}

export function workspaceCwdForId(db, workspaceId) {
  if (!workspaceId) return null
  const row = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(workspaceId)
  if (!row) return null
  try {
    const meta = JSON.parse(row.metadata_json ?? '{}')
    const raw = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
    return canonicalWorkspaceCwd(raw) || null
  } catch {
    return null
  }
}

export function workspaceRowIdForCwd(db, workspaceCwd) {
  const row = workspaceRowForCwd(db, workspaceCwd)
  return row?.id || ''
}

export function workspaceIdForCwd(db, workspaceCwd) {
  return workspaceRowIdForCwd(db, workspaceCwd) || 'ws_personal'
}

