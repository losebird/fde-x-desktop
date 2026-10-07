import { runtimeApi, type AiSessionSummary } from '@/lib/runtime-api'
import { activeWorkspaceCwdFromState, activeWorkspaceFromState, useApp } from '@/store/app'
import { isPrimarySession as isPrimarySessionRow, resolvePrimarySessionId as resolvePrimarySessionIdRow } from '../../runtime/session-primary.mjs'

export function isPrimarySession(session: AiSessionSummary) {
  return isPrimarySessionRow(session)
}

export function resolvePrimarySessionId(sessionId: string, sessions: AiSessionSummary[]) {
  return resolvePrimarySessionIdRow(sessionId, sessions)
}

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

export function sameWorkspaceCwd(left: string, right: string) {
  const here = String(left || '').replace(/\/+$/u, '')
  const there = String(right || '').replace(/\/+$/u, '')
  return Boolean(here && there && here === there)
}

export function sessionMatchesCwd(session: AiSessionSummary, cwd: string) {
  return sameWorkspaceCwd(session.cwd || '', cwd)
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
  const workspace = activeWorkspaceFromState(state)
  const cwd = activeWorkspaceCwdFromState(state)
  const workspaceId = workspace?.id || ''
  if (!cwd || !workspaceId) {
    return { ok: false, error: '当前顶栏工作区没有本机目录' }
  }
  return { ok: true, cwd, workspaceId }
}

export async function currentAiTarget(signal?: AbortSignal): Promise<AiTargetResult> {
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

export const loadCurrentAiTarget = currentAiTarget
