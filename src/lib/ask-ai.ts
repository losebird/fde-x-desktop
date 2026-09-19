import { loadCurrentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { buildContextPack, renderContextForPrompt, type ContextScope } from '@/lib/context-pack'
import { waitForFdeEvent } from '@/lib/events'
import { validateJsonSchemaLite, type JsonSchemaLite } from '@/lib/json-schema-lite'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

export type { ContextScope }

export type AskAiOptions = {
  intent: string
  prompt: string
  schema?: JsonSchemaLite
  preset?: string
  context?: ContextScope[]
  timeoutMs?: number
  title?: string
}

export type AskAiResult<T> =
  | { ok: true; data: T; sessionId: string; summary?: string }
  | { ok: false; error: string; sessionId?: string; raw?: unknown }

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function ulid(): string {
  const t = Date.now()
  const timePart = []
  let ts = t
  for (let i = 0; i < 10; i++) {
    timePart.unshift(CROCKFORD[ts % 32])
    ts = Math.floor(ts / 32)
  }
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  let randomPart = ''
  for (let i = 0; i < 10; i++) randomPart += CROCKFORD[bytes[i] % 32]
  return timePart.join('') + randomPart
}

type AskAiNotice = {
  kind: 'warn'
  text: string
  sessionId?: string
}

let askAiNotice: AskAiNotice | null = null
const noticeSubscribers = new Set<() => void>()

function setAskAiNotice(next: AskAiNotice | null) {
  askAiNotice = next
  for (const fn of noticeSubscribers) fn()
}

export function subscribeAskAiNotice(onStoreChange: () => void): () => void {
  noticeSubscribers.add(onStoreChange)
  return () => {
    noticeSubscribers.delete(onStoreChange)
  }
}

export function getAskAiNotice(): AskAiNotice | null {
  return askAiNotice
}

export function clearAskAiNotice() {
  setAskAiNotice(null)
}

async function waitForAiResultReady(requestId: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now()
    const slice = Math.min(remaining, 2000)
    const event = await waitForFdeEvent(
      'ai.result.ready',
      (row) => row.payload != null
        && typeof row.payload === 'object'
        && (row.payload as { requestId?: string }).requestId === requestId,
      slice,
    )
    if (event) return true
    try {
      const row = await runtimeApi.getAiResult(requestId)
      if (row.status === 'ready') return true
      if (row.status === 'expired') return false
    } catch {
      // keep waiting until timeout
    }
  }
  return false
}

async function resolveTarget(opts: AskAiOptions): Promise<{ ok: true; sessionId: string; cwd: string } | { ok: false; error: string }> {
  if (opts.preset) {
    const workspace = loadCurrentWorkspaceCwd()
    if (!workspace.ok) return workspace
    try {
      const status = await runtimeApi.aiStatus()
      if (!status.connected) {
        return { ok: false, error: '核心未连接' }
      }
    } catch {
      return { ok: false, error: '核心未连接' }
    }
    try {
      const created = await runtimeApi.createAiSession({
        cwd: workspace.cwd,
        agentPreset: opts.preset,
      })
      const sessionId = created.sessionId
      if (opts.title) {
        await runtimeApi.renameAiSession(sessionId, opts.title).catch(() => undefined)
      }
      return { ok: true, sessionId, cwd: workspace.cwd }
    } catch (cause) {
      return { ok: false, error: cause instanceof Error ? cause.message : '新建会话失败' }
    }
  }
  const target = await loadCurrentAiTarget()
  if (!target.ok) return target
  return { ok: true, sessionId: target.sessionId, cwd: target.cwd }
}

export async function askAiForResult<T>(opts: AskAiOptions): Promise<AskAiResult<T>> {
  const requestId = ulid()
  const timeoutMs = opts.timeoutMs ?? 120_000
  const scopes = opts.context?.length ? opts.context : (['workspace'] as ContextScope[])

  const target = await resolveTarget(opts)
  if (!target.ok) {
    return { ok: false, error: target.error }
  }

  const schemaHint = opts.schema
    ? '\n完成后用 fde_submit_result 提交符合给定 JSON Schema 的 JSON（kind=json）。'
    : ''
  let contextBlock = ''
  try {
    const packed = await buildContextPack({
      scopes,
      query: opts.prompt,
      intentKind: 'lookup',
    })
    contextBlock = renderContextForPrompt(packed.pack)
  } catch (cause) {
    console.warn('ask_ai_context_pack_failed', cause)
  }
  const prompt = [
    `[fde-request:${requestId}]`,
    opts.intent,
    contextBlock,
    opts.prompt,
    `完成后调用 fde_submit_result(requestId="${requestId}", kind="json", data=…)。${schemaHint}`,
  ].filter(Boolean).join('\n')

  try {
    await runtimeApi.promptAi(target.sessionId, { text: prompt })
    useApp.getState().setActiveAiSessionId(target.sessionId)
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : '发送 prompt 失败', sessionId: target.sessionId }
  }

  const ready = await waitForAiResultReady(requestId, timeoutMs)
  if (!ready) {
    setAskAiNotice({
      kind: 'warn',
      text: 'AI 没有提交结构化结果，可在 AI 页查看它说了什么',
      sessionId: target.sessionId,
    })
    return { ok: false, error: 'timeout', sessionId: target.sessionId }
  }

  const row = await runtimeApi.getAiResult(requestId)
  if (row.status !== 'ready' || row.data === undefined) {
    return { ok: false, error: row.status === 'expired' ? 'expired' : 'no_result', sessionId: target.sessionId }
  }

  if (opts.schema) {
    const check = validateJsonSchemaLite(row.data, opts.schema)
    if (!check.ok) {
      return { ok: false, error: 'schema_mismatch', sessionId: target.sessionId, raw: row.data }
    }
  }

  return {
    ok: true,
    data: row.data as T,
    sessionId: target.sessionId,
    summary: row.summary,
  }
}
