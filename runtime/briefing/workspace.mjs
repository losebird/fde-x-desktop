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

export function resolveWorkspaceIdOrFail(db, resolved) {
  if (resolved?.error) return { error: resolved.error }
  const suppliedId = typeof resolved?.id === 'string' ? resolved.id.trim() : ''
  const requestPath = resolved?.source === 'request' ? canonicalWorkspaceCwd(resolved.cwd) : ''
  if (requestPath) {
    const row = workspaceRowForCwd(db, requestPath)
    if (!row) return { error: 'missing_workspace' }
    if (suppliedId && suppliedId !== row.id) return { error: 'workspace_mismatch' }
    return { workspaceId: row.id, cwd: requestPath }
  }
  if (suppliedId) return { workspaceId: suppliedId }
  if (!resolved?.cwd) return { workspaceId: 'ws_personal' }
  const row = workspaceRowForCwd(db, resolved.cwd)
  if (row) return { workspaceId: row.id, cwd: resolved.cwd }
  return { workspaceId: 'ws_personal', cwd: resolved.cwd }
}

