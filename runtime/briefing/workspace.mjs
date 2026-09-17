import { listWorkspaces } from '../db.mjs'

export function workspaceRowForCwd(db, workspaceCwd) {
  const cwd = String(workspaceCwd || '').trim()
  if (!cwd.startsWith('/')) return null
  for (const row of listWorkspaces(db)) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const path = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
    if (path === cwd) return row
  }
  return null
}

export function workspaceIdForCwd(db, workspaceCwd) {
  const row = workspaceRowForCwd(db, workspaceCwd)
  return row?.id || 'ws_personal'
}

export function resolveWorkspaceCwd(db, queryWorkspace, fallbackCwd) {
  const raw = String(queryWorkspace || '').trim()
  if (raw.startsWith('/')) return raw
  const row = workspaceRowForCwd(db, fallbackCwd)
  if (row) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const path = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
    if (path.startsWith('/')) return path
  }
  return typeof fallbackCwd === 'string' && fallbackCwd.startsWith('/') ? fallbackCwd : ''
}
