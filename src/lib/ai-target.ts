import { runtimeApi, type AiSessionSummary } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

export type AiTarget = {
  ok: true
  sessionId: string
  cwd: string
  workspaceId: string
}

export type AiTargetMiss = {
  ok: false
  error: string
}

export type AiTargetResult = AiTarget | AiTargetMiss

export function isPrimarySession(session: AiSessionSummary) {
  return session.origin !== 'subagent' && !session.parentSessionId
}

export function sessionMatchesCwd(session: AiSessionSummary, cwd: string) {
  const here = cwd.replace(/\/+$/u, '')
  const there = String(session.cwd || '').replace(/\/+$/u, '')
  return Boolean(here && there && here === there)
}

export function pickCurrentAiSession(
  sessions: AiSessionSummary[],
  opts: { cwd: string; preferredSessionId?: string },
) {
  const cwd = String(opts.cwd || '').replace(/\/+$/u, '')
  const primary = sessions.filter((row) => isPrimarySession(row) && sessionMatchesCwd(row, cwd))
  if (!primary.length) return null
  const preferred = String(opts.preferredSessionId || '')
  if (preferred) {
    const hit = primary.find((row) => row.sessionId === preferred)
    if (hit) return hit
  }
  return [...primary].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null
}

export type WorkspaceCwdResult =
  | { ok: true; cwd: string; workspaceId: string }
  | { ok: false; error: string }

export function loadCurrentWorkspaceCwd(): WorkspaceCwdResult {
  const state = useApp.getState()
  const workspace = state.workspaces.find((row) => row.id === state.activeWorkspaceId)
  const cwd = workspace?.cwd && workspace.cwd.startsWith('/') ? workspace.cwd : ''
  const workspaceId = workspace?.id || ''
  if (!cwd || !workspaceId) {
    return { ok: false, error: '当前顶栏工作区没有本机目录' }
  }
  return { ok: true, cwd, workspaceId }
}

export async function loadCurrentAiTarget(signal?: AbortSignal): Promise<AiTargetResult> {
  const workspace = loadCurrentWorkspaceCwd()
  if (!workspace.ok) return workspace
  const { cwd, workspaceId } = workspace
  const state = useApp.getState()
  let sessions: AiSessionSummary[]
  try {
    sessions = await runtimeApi.listAiSessions({ includeBlank: true }, signal)
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : '列会话失败' }
  }
  const row = pickCurrentAiSession(sessions, {
    cwd,
    preferredSessionId: state.activeAiSessionId || '',
  })
  if (!row) return { ok: false, error: '当前工作区还没有可用的 AI 会话' }
  if (state.activeAiSessionId !== row.sessionId) state.setActiveAiSessionId(row.sessionId)
  return { ok: true, sessionId: row.sessionId, cwd, workspaceId }
}
