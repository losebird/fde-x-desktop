import { canonicalWorkspaceCwd, sameWorkspaceCwd } from '../cwd.mjs'

export function sessionCwdOf(item) {
  const direct = canonicalWorkspaceCwd(item?.cwd)
  if (direct) return direct
  const header = item?.header && typeof item.header === 'object' ? item.header : null
  return canonicalWorkspaceCwd(header?.cwd) || canonicalWorkspaceCwd(header?.meta?.cwd) || ''
}

export function sessionBelongsToWorkspace(item, workspaceCwd, workspaceId) {
  const cwd = sessionCwdOf(item)
  const requested = canonicalWorkspaceCwd(workspaceCwd)
  if (cwd && requested) return sameWorkspaceCwd(cwd, requested)
  if (cwd) return false
  return workspaceId === 'ws_personal'
}

export function sessionsForWorkspace(items, workspaceCwd, workspaceId) {
  return (Array.isArray(items) ? items : []).filter((item) => sessionBelongsToWorkspace(item, workspaceCwd, workspaceId))
}

export function findSessionForWorkspace(items, sessionId, workspaceCwd, workspaceId) {
  const id = String(sessionId || '')
  if (!id) return null
  return sessionsForWorkspace(items, workspaceCwd, workspaceId).find((item) => item?.sessionId === id) || null
}
