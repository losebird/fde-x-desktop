export const SESSION_BIND_BOTH = '创建会话只能带 workspaceId 或 cwd，不能两个都带'
export const SESSION_BIND_MISSING = '创建会话需要 workspaceId 或绝对路径 cwd'
export const SESSION_RESTORE_BOTH = '复原会话只能带 workspaceId 或 cwd，不能两个都带'
export const SESSION_RESTORE_MISSING = '复原会话需要 workspaceId 或绝对路径 cwd'

export type SessionBind =
  | { workspaceId: string; cwd?: never }
  | { cwd: string; workspaceId?: never }

export type SessionCreateInput = SessionBind & {
  sessionId?: string
  agentPreset?: string
}

export type SessionRestoreInput<TSessions = unknown> = SessionBind & {
  writeCwd?: string
  sessions: TSessions
}

function readBind(input: { workspaceId?: string; cwd?: string }): { workspaceId: string; cwd: string } {
  const workspaceId = typeof input.workspaceId === 'string' ? input.workspaceId.trim() : ''
  const cwd = typeof input.cwd === 'string' && input.cwd.startsWith('/') ? input.cwd : ''
  return { workspaceId, cwd }
}

export function sessionCreateBody(input: SessionCreateInput): Record<string, unknown> {
  const { workspaceId, cwd } = readBind(input)
  if (workspaceId && cwd) throw new Error(SESSION_BIND_BOTH)
  if (!workspaceId && !cwd) throw new Error(SESSION_BIND_MISSING)
  return {
    ...(workspaceId ? { workspaceId } : {}),
    ...(cwd ? { cwd } : {}),
    ...(typeof input.sessionId === 'string' && input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(typeof input.agentPreset === 'string' && input.agentPreset ? { agentPreset: input.agentPreset } : {}),
  }
}

export function sessionRestoreBody(input: SessionRestoreInput): Record<string, unknown> {
  const { workspaceId, cwd } = readBind(input)
  if (workspaceId && cwd) throw new Error(SESSION_RESTORE_BOTH)
  if (!workspaceId && !cwd) throw new Error(SESSION_RESTORE_MISSING)
  const writeCwd = typeof input.writeCwd === 'string' && input.writeCwd.startsWith('/') ? input.writeCwd : ''
  return {
    ...(workspaceId ? { workspaceId } : {}),
    ...(cwd ? { cwd } : {}),
    ...(writeCwd ? { writeCwd } : {}),
    sessions: input.sessions,
  }
}
