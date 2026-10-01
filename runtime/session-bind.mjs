export const SESSION_BIND_BOTH = '创建会话只能带 workspaceId 或 cwd，不能两个都带'
export const SESSION_BIND_MISSING = '创建会话需要 workspaceId 或绝对路径 cwd'
export const SESSION_RESTORE_BOTH = '复原会话只能带 workspaceId 或 cwd，不能两个都带'
export const SESSION_RESTORE_MISSING = '复原会话需要 workspaceId 或绝对路径 cwd'

export function parseSessionBind(body) {
  const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : ''
  const cwd = typeof body?.cwd === 'string' && body.cwd.startsWith('/') ? body.cwd : ''
  if (workspaceId && cwd) {
    return { ok: false, code: 'both', workspaceId: '', cwd: '' }
  }
  if (workspaceId) return { ok: true, code: 'workspace', workspaceId, cwd: '' }
  if (cwd) return { ok: true, code: 'path', workspaceId: '', cwd }
  return { ok: false, code: 'missing', workspaceId: '', cwd: '' }
}

export function restoreWriteRoot(body, created, bindCwd) {
  const writeCwd = typeof body?.writeCwd === 'string' && body.writeCwd.startsWith('/') ? body.writeCwd : ''
  const fromCreated = String(created?.cwd || created?.header?.cwd || '').trim()
  const createdAbs = fromCreated.startsWith('/') ? fromCreated : ''
  const bindAbs = typeof bindCwd === 'string' && bindCwd.startsWith('/') ? bindCwd : ''
  return writeCwd || createdAbs || bindAbs
}
