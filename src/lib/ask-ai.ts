import { publishSuccessfulRename } from '@/lib/ai-session-list'
import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import {
  applyPromptPackChoice,
  buildContextPack,
  renderContextForPrompt,
  type ContextPack,
  type ContextScope,
  type PromptPackChoice,
} from '@/lib/context-pack'
import { submitCurrentTurn } from '@/lib/current-turn'
import { waitForFdeEvent } from '@/lib/events'
import { validateJsonSchemaLite, type JsonSchemaLite } from '@/lib/json-schema-lite'
import { runtimeApi } from '@/lib/runtime-api'
import { settleAskWait } from '../../runtime/plan/ask-flight.mjs'
import { pickOrganizeSession } from '../../runtime/plan/organize-session.mjs'

export type { ContextScope }

export type AskAiOptions = {
  intent: string
  prompt: string
  schema?: JsonSchemaLite
  preset?: string
  context?: ContextScope[]
  omit?: Set<string>
  timeoutMs?: number
  title?: string
  signal?: AbortSignal
  reveal?: boolean
  adopt?: boolean
  reuseTitlePrefix?: string
} & PromptPackChoice

export type AskAiResult<T> =
  | { ok: true; data: T; sessionId: string; summary?: string; pack?: ContextPack; warnings?: string[] }
  | { ok: false; error: string; sessionId?: string; raw?: unknown; pack?: ContextPack; warnings?: string[] }

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

async function waitForAiResultReady(requestId: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (signal?.aborted) return false
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
  if (opts.signal?.aborted) return { ok: false, error: 'cancelled' }
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
    if (opts.signal?.aborted) return { ok: false, error: 'cancelled' }
    if (opts.reuseTitlePrefix) {
      try {
        const items = await runtimeApi.listAiSessions({ workspaceId: workspace.workspaceId }, opts.signal)
        const picked = pickOrganizeSession(items, workspace.cwd, opts.reuseTitlePrefix)
        if (picked?.sessionId) {
          if (opts.title) {
            const renamed = await runtimeApi.renameAiSession(picked.sessionId, opts.title, opts.signal, workspace.workspaceId).catch(() => undefined)
            publishSuccessfulRename(renamed, { sessionId: picked.sessionId, title: opts.title, cwd: workspace.cwd })
          }
          return { ok: true, sessionId: picked.sessionId, cwd: workspace.cwd }
        }
      } catch {
        if (opts.signal?.aborted) return { ok: false, error: 'cancelled' }
      }
    }
    try {
      const created = await runtimeApi.createAiSession({
        cwd: workspace.cwd,
        agentPreset: opts.preset,
      }, opts.signal)
      const sessionId = created.sessionId
      if (opts.title) {
        const renamed = await runtimeApi.renameAiSession(sessionId, opts.title, opts.signal, workspace.workspaceId).catch(() => undefined)
        publishSuccessfulRename(renamed, { sessionId, title: opts.title, cwd: workspace.cwd })
      }
      return { ok: true, sessionId, cwd: workspace.cwd }
    } catch (cause) {
      if (opts.signal?.aborted) return { ok: false, error: 'cancelled' }
      return { ok: false, error: cause instanceof Error ? cause.message : '新建会话失败' }
    }
  }
  const target = await currentAiTarget()
  if (!target.ok) return target
  return { ok: true, sessionId: target.sessionId, cwd: target.cwd }
}

export async function askAiForResult<T>(opts: AskAiOptions): Promise<AskAiResult<T>> {
  if (opts.signal?.aborted) return { ok: false, error: 'cancelled' }
  const requestId = ulid()
  const timeoutMs = opts.timeoutMs ?? 120_000
  const scopes = opts.context?.length ? opts.context : (['workspace'] as ContextScope[])
  const choice = applyPromptPackChoice(scopes, opts)

  const target = await resolveTarget(opts)
  if (!target.ok) {
    return { ok: false, error: target.error }
  }

  const schemaHint = opts.schema
    ? '\n完成后用 fde_submit_result 提交符合给定 JSON Schema 的 JSON（kind=json）。'
    : ''
  let contextBlock = ''
  let pack: ContextPack | undefined = choice.pack
  let warnings: string[] = choice.warnings
  try {
    if (!pack) {
      const packed = await buildContextPack({
        scopes: choice.scopes,
        query: opts.prompt,
        intentKind: 'lookup',
        ...choice.taskIdInput,
      })
      pack = packed.pack
      warnings = packed.warnings || []
    }
    const identifyTasks = Array.isArray(choice.taskIdInput.taskIds)
    contextBlock = renderContextForPrompt(pack, opts.omit, identifyTasks ? { taskIds: true } : undefined)
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

  if (opts.signal?.aborted) {
    return { ok: false, error: 'cancelled', sessionId: target.sessionId, pack, warnings }
  }
  const sent = await submitCurrentTurn({
    text: prompt,
    sessionId: target.sessionId,
    reveal: opts.reveal !== false,
    adopt: opts.adopt !== false,
  })
  if (!sent.ok) {
    return { ok: false, error: sent.error, sessionId: target.sessionId, pack, warnings }
  }
  if (opts.signal?.aborted) {
    return { ok: false, error: 'cancelled', sessionId: target.sessionId, pack, warnings }
  }

  const waited = await settleAskWait(opts.signal, () => waitForAiResultReady(requestId, timeoutMs, opts.signal))
  if (!waited.ok) {
    return { ok: false, error: waited.error, sessionId: target.sessionId, pack, warnings }
  }
  const ready = waited.value
  if (!ready) {
    setAskAiNotice({
      kind: 'warn',
      text: 'AI 没有提交结构化结果，可在 AI 页查看它说了什么',
      sessionId: target.sessionId,
    })
    return { ok: false, error: 'timeout', sessionId: target.sessionId, pack, warnings }
  }

  const row = await runtimeApi.getAiResult(requestId)
  if (row.status !== 'ready' || row.data === undefined) {
    return { ok: false, error: row.status === 'expired' ? 'expired' : 'no_result', sessionId: target.sessionId, pack, warnings }
  }

  if (opts.schema) {
    const check = validateJsonSchemaLite(row.data, opts.schema)
    if (!check.ok) {
      return { ok: false, error: 'schema_mismatch', sessionId: target.sessionId, raw: row.data, pack, warnings }
    }
  }

  return {
    ok: true,
    data: row.data as T,
    sessionId: target.sessionId,
    summary: row.summary,
    pack,
    warnings,
  }
}
