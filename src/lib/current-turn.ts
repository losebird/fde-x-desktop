import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { revealAi } from '@/lib/reveal-ai'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

export type CurrentTurnAttachFile = {
  name: string
  type: string
  base64: string
}

export type CurrentTurnSink = {
  select: (opts: {
    sessionId: string
    workspaceId?: string
    cwd?: string
    title?: string
    requestId?: string
  }) => void
  attach: (opts: {
    sessionId: string
    files: CurrentTurnAttachFile[]
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

export type AttachCurrentAiInput = {
  path: string
  name: string
}

export type AttachCurrentAiResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string }

function mimeFromName(name: string) {
  const lower = String(name || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.md')) return 'text/markdown'
  return 'application/octet-stream'
}

async function bytesToBase64(buffer: ArrayBuffer) {
  const blob = new Blob([buffer])
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(blob)
  })
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

export async function attachToCurrentAi(input: AttachCurrentAiInput): Promise<AttachCurrentAiResult> {
  const path = String(input.path || '').trim()
  const name = String(input.name || '').trim()
  if (!path || !name) return { ok: false, error: '没有可附加的文件' }
  const target = await currentAiTarget()
  if (!target.ok) return target
  const query = new URLSearchParams({ path, sessionId: target.sessionId })
  let response: Response
  try {
    response = await fetch(`/api/v1/files/raw?${query.toString()}`)
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : '无法读取该文件' }
  }
  if (!response.ok) return { ok: false, error: '无法读取该文件' }
  let base64: string
  try {
    const buffer = await response.arrayBuffer()
    base64 = await bytesToBase64(buffer)
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : '读取文件失败' }
  }
  const type = (response.headers.get('content-type') || mimeFromName(name)).split(';')[0]
  if (!sink?.attach) return { ok: false, error: '没接到当前会话' }
  useApp.getState().setActiveAiSessionId(target.sessionId)
  revealAi(target.sessionId)
  sink.select({
    sessionId: target.sessionId,
    cwd: target.cwd,
    workspaceId: target.workspaceId,
  })
  sink.attach({
    sessionId: target.sessionId,
    files: [{ name, type, base64 }],
  })
  return { ok: true, sessionId: target.sessionId }
}
