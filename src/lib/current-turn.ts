import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { revealAi } from '@/lib/reveal-ai'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

export type CurrentTurnSink = {
  select: (opts: {
    sessionId: string
    workspaceId?: string
    cwd?: string
    title?: string
    requestId?: string
  }) => void
}

let sink: CurrentTurnSink | null = null

export function registerCurrentTurnSink(next: CurrentTurnSink) {
  sink = next
  return () => {
    if (sink === next) sink = null
  }
}

export function selectCurrentTurn(opts: {
  sessionId: string
  workspaceId?: string
  cwd?: string
  title?: string
  requestId?: string
}) {
  sink?.select(opts)
}

export type SubmitCurrentTurnInput = {
  text: string
  fillThreadId?: string
  sessionId?: string
  reveal?: boolean
}

export type SubmitCurrentTurnResult =
  | { ok: true; sessionId: string; requestId: string }
  | { ok: false; error: string }

export type ImFillBind = {
  sessionId: string
  threadId: string
  requestId?: string
}

export function assistantMatchesFill(
  bind: ImFillBind | null | undefined,
  event: { sessionId?: string; requestId?: string },
) {
  if (!bind) return false
  const sid = String(event.sessionId || '')
  if (!sid || bind.sessionId !== sid) return false
  const want = String(bind.requestId || '')
  if (!want) return true
  return want === String(event.requestId || '')
}

function newRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `turn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export async function submitCurrentTurn(input: SubmitCurrentTurnInput): Promise<SubmitCurrentTurnResult> {
  const text = String(input.text || '').trim()
  if (!text) return { ok: false, error: '没有可问的正文' }
  const workspace = loadCurrentWorkspaceCwd()
  const explicit = String(input.sessionId || '').trim()
  let sessionId = explicit
  let cwd = workspace.ok ? workspace.cwd : ''
  let workspaceId = workspace.ok ? workspace.workspaceId : ''
  if (!sessionId) {
    const target = await currentAiTarget()
    if (!target.ok) return target
    sessionId = target.sessionId
    cwd = target.cwd
    workspaceId = target.workspaceId
  } else if (!workspace.ok) {
    return workspace
  }
  const requestId = newRequestId()
  useApp.getState().setActiveAiSessionId(sessionId)
  if (input.reveal !== false) revealAi(sessionId)
  sink?.select({
    sessionId,
    cwd,
    workspaceId,
    requestId,
  })
  try {
    await runtimeApi.promptAi(sessionId, { text, requestId })
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : '没问出去' }
  }
  const fillThreadId = String(input.fillThreadId || '').trim()
  if (fillThreadId) {
    useApp.getState().setIMFillBind({ sessionId, threadId: fillThreadId, requestId })
  }
  return { ok: true, sessionId, requestId }
}
