import type { JsonValue, OperationIntent, OperationRecord } from './contracts'
import type { Task, PlanEvent, Workflow, ScheduleEvent } from './types'
import { activeWorkspaceCwdFromState, useApp } from '@/store/app'
import {
  sessionCreateBody,
  sessionRestoreBody,
  type SessionCreateInput,
  type SessionRestoreInput,
} from '@/lib/session-bind'
// live-probe.mjs is the shared BFF/browser helper; Vite bundles it, tsc does not resolve its types from src/.
// @ts-expect-error runtime ESM helper
import { LIVE_PATH, LIVE_PROBE_MS, combineAbortSignal, probeRuntimeLive } from '../../runtime/live-probe.mjs'

const CONNECT_ATTEMPT_MS = 5_000

export type SearchHit = {
  kind: string
  id: string
  title: string
  hint?: string
  href: {
    panel?: string
    pane?: string
    tab?: string
    path?: string
    taskId?: string
    requestId?: string
    peerId?: string
    groupId?: string
    sessionId?: string
    agentId?: string
    cardId?: string
    originId?: string
  }
}

function currentWorkspaceCwd(): string {
  return activeWorkspaceCwdFromState(useApp.getState())
}

function withWorkspaceCwd(path: string): string {
  const cwd = currentWorkspaceCwd()
  if (!cwd) return path
  return `${path}${path.includes('?') ? '&' : '?'}cwd=${encodeURIComponent(cwd)}`
}

function workspaceCwdBody(body: Record<string, unknown> = {}): Record<string, unknown> {
  const cwd = currentWorkspaceCwd()
  return cwd ? { ...body, cwd } : body
}

const DEFAULT_BASE_URL = ''

export interface RuntimeAdapterStatus {
  capability: string
  state: 'healthy' | 'degraded' | 'unavailable' | 'unknown'
  version?: string
  detail?: string
  checkedAt: string
}

export type ModelsSettingsRow = {
  provider: string
  displayName: string
  settingsNs: string
  settingsPath: string[]
  active: boolean
  kind: 'catalog' | 'custom'
  configured: boolean
  removable: boolean
  apiKeyEnv?: string
  keyRef: string
  credentialConfigured: boolean
  credentialWritable: boolean
  declared: boolean
  modelsOverridden: boolean
  revision?: number
  profile?: Record<string, unknown>
  userProfile?: Record<string, unknown>
}

export type ModelsSettingsSnapshot = {
  writable: boolean
  protocolChoices: string[]
  namespaces: Record<string, { revision?: number; applies?: string }>
  rows: ModelsSettingsRow[]
  /** BFF 尚未加载 models-settings 路由，列表来自 GET /api/v1/ai/providers */
  legacy?: boolean
}

const DEFAULT_PROTOCOL_CHOICES = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
  'google-generative-ai',
]

export function runtimeApiNotFound(error: unknown): boolean {
  return error instanceof RuntimeApiError && error.status === 404 && error.code === 'not_found'
}

/** models-settings 不可用（旧 BFF 404 或核心未连 502）时退回 GET providers */
export function shouldFallbackModelsSettings(error: unknown): boolean {
  if (!(error instanceof RuntimeApiError)) return false
  if (runtimeApiNotFound(error)) return true
  return error.status === 502 && error.code === 'models_settings_failed'
}

export function legacyModelsSnapshotFromProviders(data: {
  protocolChoices?: string[]
  providers: Array<{
    kind: 'catalog' | 'custom'
    provider: string
    displayName: string
    active: boolean
    configured: boolean
    keyRef: string
    profile?: { displayName?: string; baseURL: string; api: string; models: Array<{ id: string; name: string; contextWindow?: number; maxTokens?: number }> }
  }>
}): ModelsSettingsSnapshot {
  const protocolChoices = (data.protocolChoices?.length ? data.protocolChoices : DEFAULT_PROTOCOL_CHOICES)
  return {
    writable: true,
    protocolChoices,
    namespaces: {},
    legacy: true,
    rows: (data.providers || []).map((row) => ({
      provider: row.provider,
      displayName: row.displayName,
      settingsNs: row.kind === 'custom' ? 'llm-pi-ai' : '',
      settingsPath: row.kind === 'custom' ? ['providers', row.provider] : [],
      active: row.active,
      kind: row.kind,
      configured: row.configured,
      removable: row.kind === 'custom',
      apiKeyEnv: undefined,
      keyRef: row.keyRef,
      credentialConfigured: row.configured,
      credentialWritable: true,
      declared: row.kind === 'custom',
      modelsOverridden: false,
      profile: row.profile ? { ...row.profile, models: row.profile.models } : undefined,
      userProfile: row.profile ? { ...row.profile, models: row.profile.models } : undefined,
    })),
  }
}

export interface AiPresetRecord {
  id: string
  name?: string
  description?: string
  trust?: string
  isDefault?: boolean
  source: 'shipped' | 'user' | 'root' | 'fde'
  path?: string
  hasLocalCode?: boolean
}

export interface PresetImportPreview {
  id: string
  name: string
  description: string
  files: string[]
  hasLocalCode: boolean
  warnings: string[]
}

export interface McpServerV2 {
  serverName: string
  transport: 'stdio' | 'streamable-http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  disabled?: boolean
  pluginId?: string
  fiberPhase?: string
  status: 'configured' | 'loaded' | 'needs-reload' | 'failed' | 'disabled'
  tools: string[]
}

export interface McpConnectorCard {
  id: string
  name: string
  provider: string
  online: boolean
  catalogVersion: string
  lookupRegistered: boolean
}

export type SkillBagOrigin = 'catalog' | 'face'

export type SkillBagItem = {
  id: string
  name: string
  origin: SkillBagOrigin
  description?: string
  path?: string
  bundleRoot?: string
  modelInvocable?: boolean
  methods?: string[]
  enabled?: boolean
  triggers?: string[]
}

export function skillItemsFromBag(data: unknown): SkillBagItem[] {
  const rows = Array.isArray(data)
    ? data
    : (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)
      ? (data as { items: Array<Record<string, unknown>> }).items
      : [])
  const out: SkillBagItem[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const id = String(row.id ?? row.name ?? '')
    if (!id) continue
    const item: SkillBagItem = {
      id,
      name: String(row.name ?? id),
      origin: row.origin === 'face' ? 'face' : 'catalog',
    }
    if (typeof row.description === 'string') item.description = row.description
    if (typeof row.path === 'string') item.path = row.path
    if (typeof row.bundleRoot === 'string') item.bundleRoot = row.bundleRoot
    if (typeof row.modelInvocable === 'boolean') item.modelInvocable = row.modelInvocable
    if (Array.isArray(row.methods)) item.methods = row.methods.map(String)
    if (typeof row.enabled === 'boolean') item.enabled = row.enabled
    if (Array.isArray(row.triggers) && row.triggers.length) item.triggers = row.triggers.map(String)
    out.push(item)
  }
  return out
}

export interface RuntimeHealth {
  service: string
  state: 'healthy' | 'degraded'
  authority: {
    transactional: 'sqlite'
    semantic: 'semantic-service'
    externalRecords: 'source-system'
  }
  persistence: {
    state: string
    database: { fingerprint: string; tableCount: number }
    migrations: Array<{ version: number; name: string; applied_at: string }>
  }
  adapters: RuntimeAdapterStatus[]
  checkedAt: string
}

export interface RuntimeOperation extends OperationRecord {
  idempotencyKey: string
  plan: JsonValue
  startedAt?: string
  finishedAt?: string
}

export interface AiRuntimeStatus {
  state: 'idle' | 'starting' | 'connected' | 'stopping' | 'stopped' | 'error'
  connected: boolean
  version: string
  pid: number | null
  origin: string | null
  bffOrigin?: string
  workspace: string
  dshHome?: string
  profile?: string
  lanPort?: string
  sessionRoot?: string
  storageRoot?: string
  semanticMemoryMode: 'external-adapter'
  credentialsMode: 'ephemeral-copy'
  startedAt: string | null
  lastError: string | null
  recentLogs: string[]
}

export interface AiModelSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface AiModelCatalog {
  default: AiModelSelection
  routableProviders: string[]
  groups: Array<{
    id: string
    name: string
    models: Array<{
      id: string
      name: string
      description?: string
      reasoning?: {
        efforts: Array<{ id: string; name: string; description?: string }>
        defaultEffort?: string
      }
    }>
  }>
  failures: Array<{ id: string; name: string; message: string }>
}

export interface AiSessionSummary {
  sessionId: string
  title: string
  updatedAt: number
  running: boolean
  blank: boolean
  archived?: boolean
  parentSessionId?: string
  origin?: 'subagent'
  cwd?: string
  agentPreset?: string
  lastUsedModel?: AiModelSelection
  nextModel?: AiModelSelection
}

export interface AiSessionCreateResult {
  sessionId: string
  agentPreset?: string
}

export type AiSessionDiskFile = { name: string; size?: number; data: string }

export type AiSessionTreeMember = {
  sessionId: string
  dir?: string
  files: AiSessionDiskFile[]
}

export type AiSessionTree = {
  sessionId: string
  files: AiSessionDiskFile[]
  members?: AiSessionTreeMember[]
}

export interface AiStreamMessage {
  id: string
  seq: number
  role: 'user' | 'assistant' | 'tool'
  content?: string
  ts: string
  toolName?: string
  toolResult?: string
  status?: 'success' | 'error'
  usage?: { prompt?: number; completion?: number; total?: number }
  replace?: { startSeq: number; endSeq: number }
}

export interface AiTraceItem {
  id: string
  seq: number
  type: string
  title: string
  detail: string
  time: string
  status: 'running' | 'completed' | 'info'
  opaque?: boolean
}

export type AiLiveFrame =
  | { kind: 'start'; attemptId: string; turn: number; step: number }
  | { kind: 'text'; attemptId: string; text: string; time: string }
  | { kind: 'reasoning'; attemptId: string; text: string; time: string }
  | { kind: 'tool'; attemptId: string; callId: string; name?: string; argumentsDelta: string; time: string }
  | { kind: 'meta'; attemptId: string; chunkType: string; time: string }
  | { kind: 'end'; attemptId: string; outcome: 'committed' | 'abandoned' }

export interface AiSessionSnapshot {
  type: 'snapshot'
  session: {
    id: string
    title: string
    createdAt: string
    cwd?: string
    agentPreset?: string
    model?: AiModelSelection
  }
  cursor: number
  hasMore: boolean
  messages: AiStreamMessage[]
  trace: AiTraceItem[]
  live: AiLiveFrame[]
  permissions?: { preset?: string; names?: string[] }
  turnOutline?: unknown
  usage?: { prompt?: number; completion?: number; total?: number }
  tools?: string[]
}

export type AiFollowFrame =
  | AiSessionSnapshot
  | { type: 'event'; cursor: number; message: AiStreamMessage | null; trace: AiTraceItem | null }
  | { type: 'live'; frame: AiLiveFrame }
  | { type: 'end'; reason: string }
  | { type: 'error'; code: string; message: string }

export interface BusinessConnectionRecord {
  id: string
  workspaceId: string
  name: string
  provider: string
  connectionKind: string
  status: 'connected' | 'disconnected' | 'pending' | 'error'
  capabilities: JsonValue[]
  lastHealth: JsonValue | null
  updatedAt: string
}

export interface BizConnectionWithHealth extends BusinessConnectionRecord {
  lanAssistOnline?: boolean
  catalogVersion?: unknown
}

export interface BizVocabKind {
  kind: string
  label: string
  fields: JsonValue[]
  can?: string[]
  relations?: JsonValue[]
  resource?: string
  catalogVersion?: string
  aliases?: string[]
}

export interface BizVocabSheet {
  kinds: BizVocabKind[]
  relations: JsonValue[]
  catalogVersion: unknown
  aliases?: Record<string, string>
}

export interface BizSurfaceRecord {
  id: string
  workspaceCwd: string
  connectionId: string | null
  kind: string
  action: string
  previewId: string | null
  sessionId: string | null
  rowCount: number | null
  columns: JsonValue[]
  createdAt: number
}

export interface BusinessAppRecord {
  id: string
  workspaceId: string
  name: string
  appKind: 'generated' | 'connected' | 'system'
  status: 'draft' | 'active' | 'paused' | 'archived'
  currentRevision: number
  definition: JsonValue
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface OperationTrace {
  operation: RuntimeOperation
  steps: JsonValue[]
  approvals: JsonValue[]
  snapshots: JsonValue[]
  receipts: JsonValue[]
  compensations: JsonValue[]
}

export type BriefingSectionDef = {
  id: string
  type: string
  title: string
  enabled: boolean
  render: string
  params?: Record<string, unknown>
}

export type BriefingSchedule = {
  at?: string
  days?: number[]
  onOpen?: boolean
  tz?: string
}

export type BriefingDelivery = {
  peerId?: string
}

export type BriefingItem = {
  text: string
  sub?: string
  href?: Record<string, unknown>
  ref?: string
}

export type BriefingSectionResult = {
  id: string
  title: string
  render: string
  type?: string
  items?: BriefingItem[]
  stat?: { value?: unknown; label?: string; unit?: string }
  error?: string
  fetchedAt?: string
  body?: string
  overdue?: BriefingItem[]
}

export type BriefingDefinition = {
  id: string
  workspaceId: string
  workspaceCwd: string
  name: string
  sections: BriefingSectionDef[]
  schedule: BriefingSchedule
  sources: Array<Record<string, unknown>>
  delivery?: BriefingDelivery
  updatedAt?: string
}

export type BriefingSnapshot = {
  id: string
  definitionId: string
  workspaceCwd: string
  generatedAt: string
  status: string
  sections: BriefingSectionResult[]
  summary?: string
  sessionId?: string
}

export type MemoryDraftCard = {
  id: string
  status: '起草'
  label: string
  body: string
}

export class RuntimeApiError extends Error {
  status: number
  code: string
  correlationId?: string

  constructor(status: number, code: string, message: string, correlationId?: string) {
    super(message)
    this.name = 'RuntimeApiError'
    this.status = status
    this.code = code
    this.correlationId = correlationId
  }
}

export class RuntimeApi {
  readonly baseUrl: string

  constructor(baseUrl = import.meta.env.VITE_FDE_RUNTIME_URL ?? DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async health(signal?: AbortSignal): Promise<RuntimeHealth> {
    return this.request('/health', { signal })
  }

  async runtimeConfig(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/runtime/config', { signal })
    return result.data
  }

  async attachOldSessions(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/runtime/attach-sessions', { method: 'POST', signal })
    return result.data
  }

  async memoryReady(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/ready', { signal })
    return result.data
  }

  async semanticCoverage(cwd?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const dir = cwd && cwd.startsWith('/') ? cwd : currentWorkspaceCwd()
    if (!dir) return { ok: false, error: 'NO_CWD' }
    try {
      return await this.request<Record<string, unknown>>(`/semantic-os/api/coverage?cwd=${encodeURIComponent(dir)}`, { signal })
    } catch (error) {
      if (error instanceof RuntimeApiError) return { ok: false, error: error.code, detail: error.message }
      throw error
    }
  }

  async semanticPython(op: string, args: Record<string, unknown> = {}, cwd?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const dir = cwd && cwd.startsWith('/') ? cwd : currentWorkspaceCwd()
    return this.request<Record<string, unknown>>('/semantic-os/python', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, cwd: dir, args }),
    })
  }

  async memoryRetryReady(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/retry-ready', { method: 'POST', signal })
    return result.data
  }

  async memorySettings(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/settings', { signal })
    return result.data
  }

  async saveMemorySettings(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/settings', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async ensureWorkspace(input: { id: string; name: string; description?: string; cwd?: string }, signal?: AbortSignal): Promise<void> {
    const cwd = typeof input.cwd === 'string' && input.cwd.startsWith('/') ? input.cwd : ''
    await this.request('/api/v1/workspaces', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: input.id,
        name: input.name,
        description: input.description,
        ...(cwd ? { metadata: { cwd } } : {}),
      }),
    })
  }

  /** Plan routes write JSON without BFF CORS headers; in the browser use same-origin (Vite proxy). */
  private planFetchUrl(path: string): string {
    if (typeof window !== 'undefined') return path
    return `${this.baseUrl}${path}`
  }

  /** BFF routes with CORS: direct baseUrl works, but reload wait uses same-origin so Vite stays up when BFF respawns. */
  private uiFetchUrl(path: string): string {
    return this.planFetchUrl(path)
  }

  private async planRequest<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetch(this.planFetchUrl(path), init)
    } catch (error) {
      throw new RuntimeApiError(0, 'runtime_unreachable', error instanceof Error ? error.message : '本地运行时不可访问')
    }
    const payload = await response.json().catch(() => ({})) as { ok?: boolean; data?: T; error?: string; message?: string }
    if (!response.ok || payload.ok === false) {
      throw new RuntimeApiError(
        response.status,
        String(payload.error ?? 'runtime_error'),
        String(payload.message ?? `请求失败 (${response.status})`),
      )
    }
    return payload.data as T
  }

  private mapPlanTask(row: Record<string, unknown>): Task {
    return {
      id: String(row.id),
      title: String(row.title),
      notes: typeof row.notes === 'string' ? row.notes : '',
      status: row.status as Task['status'],
      priority: row.priority as Task['priority'],
      due: typeof row.dueAt === 'string' ? row.dueAt : undefined,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      createdAt: String(row.createdAt),
      workspaceId: typeof row.workspaceId === 'string' ? row.workspaceId : undefined,
      sourceRef: typeof row.sourceRef === 'string' ? row.sourceRef : undefined,
      completedAt: typeof row.completedAt === 'string' ? row.completedAt : undefined,
    }
  }

  private mapPlanEvent(row: PlanEvent): ScheduleEvent {
    return {
      id: row.id,
      title: row.title,
      start: row.startAt,
      end: row.endAt,
      location: row.location ?? undefined,
      kind: row.kind,
    }
  }

  private normalizeWorkflowTrigger(value: unknown): Workflow['trigger'] {
    if (!value || typeof value !== 'object') return { kind: 'manual' }
    const kind = (value as { kind?: string }).kind
    if (kind === 'cron' || kind === 'keyword' || kind === 'event' || kind === 'manual') {
      return value as Workflow['trigger']
    }
    return { kind: 'manual' }
  }

  private mapPlanWorkflow(row: Record<string, unknown>): Workflow {
    const trigger = this.normalizeWorkflowTrigger(row.trigger)
    const steps = Array.isArray(row.steps) ? row.steps as Workflow['steps'] : []
    return {
      id: String(row.id),
      name: String(row.name),
      description: typeof row.description === 'string' ? row.description : '',
      status: row.status === 'active' ? 'active' : 'paused',
      trigger,
      steps,
      category: (row.category as Workflow['category']) ?? 'system',
      emoji: typeof row.emoji === 'string' ? row.emoji : '🤖',
      createdAt: String(row.createdAt),
      workspaceId: typeof row.workspaceId === 'string' ? row.workspaceId : undefined,
    }
  }

  async listTasks(workspaceId: string, opts?: { status?: string; q?: string }, signal?: AbortSignal): Promise<Task[]> {
    const params = new URLSearchParams({ workspaceId })
    if (opts?.status) params.set('status', opts.status)
    if (opts?.q) params.set('q', opts.q)
    const rows = await this.planRequest<Array<Record<string, unknown>>>(`/api/v1/plan/tasks?${params}`, { signal })
    return rows.map((row) => this.mapPlanTask(row))
  }

  async createTask(input: {
    workspaceId: string
    title: string
    priority?: Task['priority']
    dueAt?: string
    tags?: string[]
    sourceRef?: string
    status?: Task['status']
  }, signal?: AbortSignal): Promise<Task> {
    const row = await this.planRequest<Record<string, unknown>>('/api/v1/plan/tasks', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return this.mapPlanTask(row)
  }

  async updateTask(id: string, patch: Partial<{
    title: string
    notes: string
    status: Task['status']
    priority: Task['priority']
    dueAt: string | null
    tags: string[]
    workspaceId: string
  }>, signal?: AbortSignal): Promise<Task> {
    const row = await this.planRequest<Record<string, unknown>>(`/api/v1/plan/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return this.mapPlanTask(row)
  }

  async deleteTask(id: string, opts?: { workspaceId?: string; signal?: AbortSignal }): Promise<void> {
    const params = opts?.workspaceId ? `?workspaceId=${encodeURIComponent(opts.workspaceId)}` : ''
    await this.planRequest(`/api/v1/plan/tasks/${encodeURIComponent(id)}${params}`, { method: 'DELETE', signal: opts?.signal })
  }

  async listEvents(workspaceId: string, fromMs: number, toMs: number, signal?: AbortSignal): Promise<ScheduleEvent[]> {
    const params = new URLSearchParams({
      workspaceId,
      from: String(fromMs),
      to: String(toMs),
    })
    const rows = await this.planRequest<PlanEvent[]>(`/api/v1/plan/events?${params}`, { signal })
    return rows.map((row) => this.mapPlanEvent(row))
  }

  async createEvent(input: {
    workspaceId: string
    title: string
    startAt: string
    endAt: string
    kind?: ScheduleEvent['kind']
    location?: string
    allDay?: boolean
  }, signal?: AbortSignal): Promise<ScheduleEvent> {
    const row = await this.planRequest<PlanEvent>('/api/v1/plan/events', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return this.mapPlanEvent(row)
  }

  async updateEvent(id: string, patch: Partial<{
    title: string
    startAt: string
    endAt: string
    kind: ScheduleEvent['kind']
    location: string | null
    allDay: boolean
    workspaceId: string
  }>, signal?: AbortSignal): Promise<ScheduleEvent> {
    const row = await this.planRequest<PlanEvent>(`/api/v1/plan/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return this.mapPlanEvent(row)
  }

  async deleteEvent(id: string, opts?: { workspaceId?: string; signal?: AbortSignal }): Promise<void> {
    const params = opts?.workspaceId ? `?workspaceId=${encodeURIComponent(opts.workspaceId)}` : ''
    await this.planRequest(`/api/v1/plan/events/${encodeURIComponent(id)}${params}`, { method: 'DELETE', signal: opts?.signal })
  }

  async listWorkflows(workspaceId: string, signal?: AbortSignal): Promise<Workflow[]> {
    const params = new URLSearchParams({ workspaceId })
    const rows = await this.planRequest<Array<Record<string, unknown>>>(`/api/v1/plan/workflows?${params}`, { signal })
    return rows.map((row) => this.mapPlanWorkflow(row))
  }

  async createWorkflow(input: {
    workspaceId: string
    name: string
    description?: string
    status?: Workflow['status']
    trigger?: Workflow['trigger']
    steps?: Workflow['steps']
    category?: Workflow['category']
    emoji?: string
  }, signal?: AbortSignal): Promise<Workflow> {
    const row = await this.planRequest<Record<string, unknown>>('/api/v1/plan/workflows', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return this.mapPlanWorkflow(row)
  }

  async updateWorkflow(id: string, patch: Partial<{
    name: string
    status: Workflow['status']
    description: string
    trigger: Workflow['trigger']
    steps: Workflow['steps']
    category: Workflow['category']
    emoji: string
    workspaceId: string
  }>, signal?: AbortSignal): Promise<Workflow> {
    const row = await this.planRequest<Record<string, unknown>>(`/api/v1/plan/workflows/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return this.mapPlanWorkflow(row)
  }

  async deleteWorkflow(id: string, opts?: { workspaceId?: string; signal?: AbortSignal }): Promise<void> {
    const params = opts?.workspaceId ? `?workspaceId=${encodeURIComponent(opts.workspaceId)}` : ''
    await this.planRequest(`/api/v1/plan/workflows/${encodeURIComponent(id)}${params}`, { method: 'DELETE', signal: opts?.signal })
  }

  async aiStatus(signal?: AbortSignal): Promise<AiRuntimeStatus> {
    const result = await this.request<{ data: AiRuntimeStatus }>('/api/v1/ai/status', { signal })
    return result.data
  }

  async connectAi(signal?: AbortSignal): Promise<AiRuntimeStatus> {
    const result = await this.request<{ data: AiRuntimeStatus }>('/api/v1/ai/connect', { method: 'POST', signal })
    return result.data
  }

  async disconnectAi(signal?: AbortSignal): Promise<AiRuntimeStatus> {
    const result = await this.request<{ data: AiRuntimeStatus }>('/api/v1/ai/disconnect', { method: 'POST', signal })
    return result.data
  }

  async reloadAi(signal?: AbortSignal): Promise<AiRuntimeStatus> {
    const waitMs = Number(import.meta.env.VITE_FDE_RUNTIME_RELOAD_WAIT_MS ?? 90_000)
    const waitSec = Math.round(waitMs / 1000)
    try {
      if (typeof window !== 'undefined') {
        const response = await fetch(this.uiFetchUrl('/api/v1/ai/reload'), { method: 'POST', signal })
        if (!response.ok && response.status < 500) {
          const payload = await response.json().catch(() => ({})) as {
            error?: string | { code?: string; message?: string }
            message?: string
            correlationId?: string
          }
          const nested = payload?.error && typeof payload.error === 'object' ? payload.error : null
          throw new RuntimeApiError(
            response.status,
            nested?.code ?? (typeof payload?.error === 'string' ? payload.error : 'runtime_error'),
            nested?.message ?? payload?.message ?? `请求失败 (${response.status})`,
            payload?.correlationId,
          )
        }
      } else {
        await this.request<{ data: AiRuntimeStatus }>('/api/v1/ai/reload', { method: 'POST', signal })
      }
    } catch (error) {
      if (error instanceof RuntimeApiError) throw error
      /* BFF 正在退出或已死，监督会拉起；连不上也算已经开始重载 */
    }
    const deadline = Date.now() + waitMs
    const liveUrl = this.baseUrl ? `${this.baseUrl}${LIVE_PATH}` : this.uiFetchUrl(LIVE_PATH)
    let bffUp = false
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new RuntimeApiError(0, 'aborted', '重载已取消')
      if (await probeRuntimeLive(liveUrl, signal, LIVE_PROBE_MS)) {
        bffUp = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    if (!bffUp) {
      throw new RuntimeApiError(0, 'runtime_unreachable', `本地核心没有在 ${waitSec} 秒内回来`)
    }

    while (Date.now() < deadline) {
      if (signal?.aborted) throw new RuntimeApiError(0, 'aborted', '重载已取消')
      try {
        const snap = await this.aiStatus(combineAbortSignal(signal, LIVE_PROBE_MS))
        if (snap.connected) return snap
      } catch {
        /* BFF 刚起来，status 可能还不稳 */
      }
      try {
        const remain = Math.max(LIVE_PROBE_MS, Math.min(CONNECT_ATTEMPT_MS, deadline - Date.now()))
        const status = await this.connectAi(combineAbortSignal(signal, remain))
        if (status.connected) return status
      } catch {
        /* DSH 还在冷启动 */
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new RuntimeApiError(0, 'runtime_unreachable', `DSH 没有在 ${waitSec} 秒内连上`)
  }

  async getModelsSettings(signal?: AbortSignal): Promise<ModelsSettingsSnapshot> {
    try {
      const result = await this.request<{ data: ModelsSettingsSnapshot }>('/api/v1/ai/models-settings', { signal })
      return { ...result.data, legacy: false }
    } catch (error) {
      if (!shouldFallbackModelsSettings(error)) throw error
      const legacy = await this.listAiProviders(signal)
      return legacyModelsSnapshotFromProviders(legacy)
    }
  }

  async mutateModelsSettings(body: {
    ns: string
    ops: Array<{ op: 'set'; path: string[]; value: unknown } | { op: 'unset'; path: string[] }>
    expectedRevision?: number
  }, signal?: AbortSignal): Promise<{ view?: { revision?: number; user?: Record<string, unknown> } }> {
    const result = await this.request<{ data: { view?: { revision?: number; user?: Record<string, unknown> } } }>(
      '/api/v1/ai/models-settings/mutate',
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    return result.data
  }

  async applyModelsSettingsProvider(body: {
    ns: string
    provider: string
    settingsPath: string[]
    draft: Record<string, unknown>
    committedOriginal: unknown
    expectedRevision?: number
    apiKey?: string
    keyRef: string
  }, signal?: AbortSignal): Promise<{ ok?: boolean; view?: { revision?: number; user?: Record<string, unknown> }; hint?: string }> {
    const result = await this.request<{ data: { ok?: boolean; view?: { revision?: number; user?: Record<string, unknown> }; hint?: string } }>(
      '/api/v1/ai/models-settings/apply',
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    return result.data
  }

  async setModelsCredential(body: { ref: string; action?: 'set' | 'delete'; value?: string }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/ai/models-settings/credential', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async listAiProviders(signal?: AbortSignal): Promise<{
    providers: Array<{
      kind: 'catalog' | 'custom'
      provider: string
      displayName: string
      active: boolean
      configured: boolean
      keyRef: string
      profile?: { displayName?: string; baseURL: string; api: string; models: Array<{ id: string; name: string }> }
    }>
    registered: Array<{ id: string; name: string }>
    protocolChoices?: string[]
  }> {
    const result = await this.request<{ data: {
      providers: Array<{
        kind: 'catalog' | 'custom'
        provider: string
        displayName: string
        active: boolean
        configured: boolean
        keyRef: string
        profile?: { displayName?: string; baseURL: string; api: string; models: Array<{ id: string; name: string; contextWindow?: number; maxTokens?: number }> }
      }>
      registered: Array<{ id: string; name: string }>
      protocolChoices?: string[]
    } }>('/api/v1/ai/providers', { signal })
    return result.data
  }

  async addAiProvider(body: { provider: string; apiKey: string }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/ai/providers', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async discoverAiModels(body: { baseURL: string; api?: string; apiKey?: string; provider?: string }, signal?: AbortSignal): Promise<Array<{ id: string; name: string; contextWindow?: number; maxTokens?: number; reasoningEfforts?: unknown }>> {
    const result = await this.request<{ data: { models: Array<{ id: string; name: string; contextWindow?: number; maxTokens?: number; reasoningEfforts?: unknown }> } }>('/api/v1/ai/providers/discover', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data.models || []
  }

  async addCustomAiProvider(body: {
    route: string
    displayName?: string
    baseURL: string
    api?: string
    apiKey?: string
    modelId?: string
    modelName?: string
    models?: Array<{ id: string; name?: string }>
  }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/ai/providers/custom', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async patchAiProviderKey(provider: string, apiKey: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>(`/api/v1/ai/providers/${encodeURIComponent(provider)}/key`, {
      method: 'PATCH',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })
    return result.data
  }

  async clearAiProviderKey(provider: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>(`/api/v1/ai/providers/${encodeURIComponent(provider)}/key`, {
      method: 'DELETE',
      signal,
    })
    return result.data
  }

  async patchCustomAiProvider(route: string, body: {
    displayName?: string
    baseURL?: string
    api?: string
    apiKey?: string
    modelId?: string
    modelName?: string
    models?: Array<{ id: string; name?: string }>
  }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>(`/api/v1/ai/providers/custom/${encodeURIComponent(route)}`, {
      method: 'PATCH',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async deleteCustomAiProvider(route: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>(`/api/v1/ai/providers/custom/${encodeURIComponent(route)}`, {
      method: 'DELETE',
      signal,
    })
    return result.data
  }

  async aiModels(signal?: AbortSignal): Promise<AiModelCatalog> {
    const result = await this.request<{ data: AiModelCatalog }>('/api/v1/ai/models', { signal })
    return result.data
  }

  async listAiPresets(signal?: AbortSignal): Promise<{ presets: AiPresetRecord[]; authorable?: boolean; actions?: string[] }> {
    const result = await this.request<{ data: { presets: AiPresetRecord[]; authorable?: boolean; actions?: string[] } }>('/api/v1/ai/presets', { signal })
    return result.data
  }

  async previewImportPresetDir(body: { path: string }, signal?: AbortSignal): Promise<{ preview: PresetImportPreview }> {
    const result = await this.request<{ data: { ok: boolean; preview: PresetImportPreview } }>('/api/v1/ai/presets/import-dir', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async confirmImportPresetDir(body: { path: string; id?: string }, signal?: AbortSignal): Promise<{ ok: boolean; id: string; hint?: string }> {
    const result = await this.request<{ data: { ok: boolean; id: string; hint?: string } }>('/api/v1/ai/presets/import-dir/confirm', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async previewImportPresetGit(body: { url: string; subdir?: string }, signal?: AbortSignal): Promise<{ preview: PresetImportPreview; tempPath?: string; cloneRoot?: string }> {
    const result = await this.request<{ data: { ok: boolean; preview: PresetImportPreview; tempPath?: string; cloneRoot?: string } }>('/api/v1/ai/presets/import-git', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async confirmImportPresetGit(body: { tempPath: string; cloneRoot?: string; id?: string }, signal?: AbortSignal): Promise<{ ok: boolean; id: string; hint?: string }> {
    const result = await this.request<{ data: { ok: boolean; id: string; hint?: string } }>('/api/v1/ai/presets/import-git/confirm', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async copyAiPreset(body: { from: string; id: string; name?: string }, signal?: AbortSignal): Promise<{ presets: AiPresetRecord[] }> {
    const result = await this.request<{ data: { presets: AiPresetRecord[] } }>('/api/v1/ai/presets/copy', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async deleteAiPreset(id: string, signal?: AbortSignal): Promise<{ presets: AiPresetRecord[] }> {
    const result = await this.request<{ data: { presets: AiPresetRecord[] } }>('/api/v1/ai/presets/delete', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    return result.data
  }

  async listAiCredentials(signal?: AbortSignal): Promise<{ path: string; keys: Array<{ name: string; present: boolean; hint: string }> }> {
    const result = await this.request<{ data: { path: string; keys: Array<{ name: string; present: boolean; hint: string }> } }>('/api/v1/ai/credentials', { signal })
    return result.data
  }

  async saveAiCredential(body: { name: string; value: string }, signal?: AbortSignal): Promise<{ ok: boolean; name: string; hint: string }> {
    const result = await this.request<{ data: { ok: boolean; name: string; hint: string } }>('/api/v1/ai/credentials', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async memoryDeps(cwd?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const dir = cwd && cwd.startsWith('/') ? cwd : currentWorkspaceCwd()
    const query = dir ? `?cwd=${encodeURIComponent(dir)}` : ''
    const result = await this.request<{ data: Record<string, unknown> }>(`/api/v1/memory/deps${query}`, { signal })
    return result.data
  }

  async memoryUsage(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/usage', { signal })
    return result.data
  }

  async memoryIngestNow(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/session-ingest', { method: 'POST', signal })
    return result.data
  }

  async memoryIngestStatus(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/session-ingest', { signal })
    return result.data
  }

  async memoryInstallDeps(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/deps', { method: 'POST', signal })
    return result.data
  }

  async memoryPeople(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/people', { signal })
    return result.data
  }

  async saveMemoryPeople(people: Array<Record<string, unknown>>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/people', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ people }),
    })
    return result.data
  }

  async selectAiPreset(sessionId: string, agentPreset: string, signal?: AbortSignal): Promise<string> {
    const result = await this.request<{ data: { agentPreset: string } }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/preset`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentPreset }),
    })
    return result.data.agentPreset
  }

  async executeAiCommand(sessionId: string, line: string, signal?: AbortSignal): Promise<unknown> {
    const result = await this.request<{ data: unknown }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/commands`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line }),
    })
    return result.data
  }

  async listAiCommands(sessionId: string, signal?: AbortSignal): Promise<Array<{ name: string; description?: string }>> {
    const result = await this.request<{ data: Array<{ name: string; description?: string }> | { items?: Array<{ name: string; description?: string }> } }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/commands`, { signal })
    const payload = result.data
    if (Array.isArray(payload)) return payload
    return Array.isArray(payload.items) ? payload.items : []
  }

  async setAiPermission(sessionId: string, preset: string, signal?: AbortSignal): Promise<unknown> {
    const result = await this.request<{ data: unknown }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/permission`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset }),
    })
    return result.data
  }

  async listSkillRoots(cwd?: string, signal?: AbortSignal): Promise<{ roots: Array<{ path: string; source: string }> }> {
    const params = new URLSearchParams()
    if (cwd) params.set('cwd', cwd)
    const query = params.toString()
    const result = await this.request<{ data: { roots: Array<{ path: string; source: string }> } }>(`/api/v1/skills/roots${query ? `?${query}` : ''}`, { signal })
    return result.data
  }

  async listSkillBundleFiles(path: string, cwd?: string, sessionId?: string, signal?: AbortSignal): Promise<{ bundleRoot: string; files: Array<{ rel: string; type: string }> }> {
    const params = new URLSearchParams({ path })
    if (cwd) params.set('cwd', cwd)
    if (sessionId) params.set('sessionId', sessionId)
    const result = await this.request<{ data: { bundleRoot: string; files: Array<{ rel: string; type: string }> } }>(`/api/v1/skills/bundle/files?${params}`, { signal })
    return result.data
  }

  async readSkillBundleFile(path: string, rel: string, cwd?: string, sessionId?: string, signal?: AbortSignal): Promise<{ rel: string; text: string }> {
    const params = new URLSearchParams({ path, rel })
    if (cwd) params.set('cwd', cwd)
    if (sessionId) params.set('sessionId', sessionId)
    const result = await this.request<{ data: { rel: string; text: string } }>(`/api/v1/skills/bundle/file?${params}`, { signal })
    return result.data
  }

  async writeSkillBundleFile(input: { path: string; rel: string; text: string; cwd?: string; sessionId?: string }, signal?: AbortSignal): Promise<{ rel: string }> {
    const result = await this.request<{ data: { rel: string } }>('/api/v1/skills/bundle/file', {
      method: 'PUT',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async removeSkillBundleFile(path: string, rel: string, cwd?: string, sessionId?: string, signal?: AbortSignal): Promise<void> {
    const params = new URLSearchParams({ path, rel })
    if (cwd) params.set('cwd', cwd)
    if (sessionId) params.set('sessionId', sessionId)
    await this.request(`/api/v1/skills/bundle/file?${params}`, { method: 'DELETE', signal })
  }

  async setSkillModelInvocable(input: { path: string; modelInvocable: boolean; cwd?: string; sessionId?: string }, signal?: AbortSignal): Promise<{ modelInvocable: boolean }> {
    const result = await this.request<{ data: { modelInvocable: boolean } }>('/api/v1/skills/model-invocable', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async installSkillBundle(input: { source: string; root: string; cwd?: string }, signal?: AbortSignal): Promise<{ name: string; dest: string; path: string }> {
    const result = await this.request<{ data: { name: string; dest: string; path: string } }>('/api/v1/skills/install', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async uninstallSkillBundle(path: string, cwd?: string, sessionId?: string, signal?: AbortSignal): Promise<void> {
    const params = new URLSearchParams({ path })
    if (cwd) params.set('cwd', cwd)
    if (sessionId) params.set('sessionId', sessionId)
    await this.request(`/api/v1/skills/bundle?${params}`, { method: 'DELETE', signal })
  }

  async listAiSkills(sessionId?: string, signal?: AbortSignal): Promise<{ items: SkillBagItem[] }> {
    const path = sessionId
      ? `/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/skills`
      : '/api/v1/ai/skills'
    const result = await this.request<{ data: unknown }>(path, { signal })
    return { items: skillItemsFromBag(result.data) }
  }

  async listAiWorkspaces(signal?: AbortSignal): Promise<Array<{ workspaceId: string; path: string; title: string }>> {
    const result = await this.request<{ data: { items: Array<{ workspaceId: string; path: string; title: string }> } }>('/api/v1/ai/workspaces', { signal })
    return result.data.items
  }

  async pickAiWorkspaceDirectory(signal?: AbortSignal): Promise<string | null> {
    if (typeof window !== 'undefined' && window.fdeDesktop) {
      const picked = await window.fdeDesktop.pickDirectory()
      return picked.path
    }
    const result = await this.request<{ data: { path: string | null } }>('/api/v1/ai/workspaces/pick', { method: 'POST', signal })
    return result.data.path
  }

  async createAiWorkspace(input: { path: string; title?: string }, signal?: AbortSignal): Promise<{ workspaceId: string; path: string; title: string }> {
    const result = await this.request<{ data: { workspaceId: string; path: string; title: string } }>('/api/v1/ai/workspaces', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async listAiSessions(options: { includeBlank?: boolean; includeSubagents?: boolean; includeArchived?: boolean; cursor?: string } = {}, signal?: AbortSignal): Promise<AiSessionSummary[]> {
    const query = new URLSearchParams()
    if (options.includeBlank) query.set('includeBlank', 'true')
    if (options.includeSubagents) query.set('includeSubagents', 'true')
    if (options.includeArchived) query.set('includeArchived', 'true')
    if (options.cursor) query.set('cursor', options.cursor)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const result = await this.request<{ data: { items: AiSessionSummary[] } }>(`/api/v1/ai/sessions${suffix}`, { signal })
    return result.data.items
  }

  async exportAiSession(sessionId: string, signal?: AbortSignal): Promise<AiSessionTree> {
    const result = await this.request<{ data: AiSessionTree }>(
      `/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/export`,
      { signal },
    )
    return result.data
  }

  async restoreAiSessions(input: SessionRestoreInput<Array<{
    sessionId?: string
    title?: string
    files: AiSessionDiskFile[]
    members?: AiSessionTreeMember[]
  }>>, signal?: AbortSignal): Promise<{ sessions: Array<{ sessionId: string; title: string }>; warnings?: string[] }> {
    const result = await this.request<{ data: { sessions: Array<{ sessionId: string; title: string }>; warnings?: string[] } }>('/api/v1/ai/sessions/restore', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionRestoreBody(input)),
    })
    return result.data
  }

  async createAiSession(input: SessionCreateInput, signal?: AbortSignal): Promise<AiSessionCreateResult> {
    const result = await this.request<{ data: AiSessionCreateResult }>('/api/v1/ai/sessions', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionCreateBody(input)),
    })
    return result.data
  }

  async archiveAiSession(sessionId: string, signal?: AbortSignal): Promise<unknown> {
    const result = await this.request<{ data: unknown }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/archive`, {
      method: 'POST',
      signal,
    })
    return result.data
  }

  async forkAiSession(sessionId: string, signal?: AbortSignal): Promise<{ sessionId: string }> {
    const result = await this.request<{ data: { sessionId: string } }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/fork`, {
      method: 'POST',
      signal,
    })
    return result.data
  }

  async renameAiSession(sessionId: string, title: string, signal?: AbortSignal): Promise<{ title: string; seq: number }> {
    const result = await this.request<{ data: { title: string; seq: number } }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/rename`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    return result.data
  }

  async selectAiModel(sessionId: string, selection: AiModelSelection, signal?: AbortSignal): Promise<AiModelSelection> {
    const result = await this.request<{ data: { selected: AiModelSelection } }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/model`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selection),
    })
    return result.data.selected
  }

  async uploadAiAttachment(sessionId: string, input: { data: string; name?: string }, signal?: AbortSignal): Promise<{ receiptId: string; file?: { name?: string; bytes?: number } }> {
    const result = await this.request<{ data: { receiptId: string; file?: { name?: string; bytes?: number } } }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/attachments`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async promptAi(sessionId: string, input: { text: string; receiptIds?: string[]; requestId?: string; mode?: 'queue' | 'steer'; workspaceId?: string; clientTimeZone?: string }, signal?: AbortSignal): Promise<{ accepted: true; requestId: string }> {
    const result = await this.request<{ data: { accepted: true; requestId: string } }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async getAiResult(requestId: string, signal?: AbortSignal): Promise<{
    status: 'pending' | 'ready' | 'expired'
    requestId?: string
    kind?: string
    data?: unknown
    summary?: string
    sessionId?: string
  }> {
    const result = await this.request<{ data: {
      status: 'pending' | 'ready' | 'expired'
      requestId?: string
      kind?: string
      data?: unknown
      summary?: string
      sessionId?: string
    } }>(`/api/v1/ai/results/${encodeURIComponent(requestId)}`, { signal })
    return result.data
  }

  async decideAiApproval(sessionId: string, outcome: 'allowed-once' | 'rejected', signal?: AbortSignal): Promise<{ eventId: string; outcome: string }> {
    const result = await this.request<{ data: { eventId: string; outcome: string } }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/approval`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome }),
    })
    return result.data
  }

  async cancelAi(
    sessionId: string,
    options: { kind?: string; signal?: AbortSignal } = {},
  ): Promise<{ accepted: true }> {
    const kind = String(options.kind || '').trim()
    const result = await this.request<{ data: { accepted: true } }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
      signal: options.signal,
      headers: kind ? { 'Content-Type': 'application/json' } : undefined,
      body: kind ? JSON.stringify({ kind }) : undefined,
    })
    return result.data
  }

  async followAiSession(sessionId: string, onFrame: (frame: AiFollowFrame) => void, options: { maxMessages?: number; signal?: AbortSignal } = {}): Promise<void> {
    const query = new URLSearchParams({ maxMessages: String(options.maxMessages ?? 100) })
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/follow?${query.toString()}`, {
        signal: options.signal,
        headers: { Accept: 'text/event-stream' },
      })
    } catch (error) {
      if (options.signal?.aborted) return
      throw new RuntimeApiError(0, 'runtime_unreachable', error instanceof Error ? error.message : 'AI 会话流不可访问')
    }
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({}))
      throw new RuntimeApiError(response.status, payload?.error?.code ?? 'ai_stream_error', payload?.error?.message ?? `AI 会话流失败 (${response.status})`, payload?.correlationId)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const dataLines = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart())
        if (dataLines.length === 0) continue
        try {
          onFrame(JSON.parse(dataLines.join('\n')) as AiFollowFrame)
        } catch {
          // Ignore one malformed application frame; the stream remains useful and errors arrive separately.
        }
      }
    }
  }

  async listWorkspaceFiles(sessionIdOrOpts: string | { sessionId?: string; cwd?: string; path?: string }, path = '.', signal?: AbortSignal): Promise<{ path: string; entries: Array<{ name: string; type: 'file' | 'directory' | 'other'; size?: number }>; truncated?: boolean }> {
    const query = new URLSearchParams()
    if (typeof sessionIdOrOpts === 'string') {
      query.set('sessionId', sessionIdOrOpts)
      query.set('path', path)
    } else {
      if (sessionIdOrOpts.sessionId) query.set('sessionId', sessionIdOrOpts.sessionId)
      if (sessionIdOrOpts.cwd) query.set('cwd', sessionIdOrOpts.cwd)
      query.set('path', sessionIdOrOpts.path || '.')
    }
    const result = await this.request<{ data: { path: string; entries: Array<{ name: string; type: 'file' | 'directory' | 'other'; size?: number }>; truncated?: boolean } }>(`/api/v1/files?${query.toString()}`, { signal })
    return result.data
  }

  async catalogBag(kind: string, opts?: { sessionId?: string; cwd?: string; path?: string; workspaceId?: string }, signal?: AbortSignal): Promise<{
    kind: string
    href?: { panel?: string; tab?: string; section?: string }
    projections: string[]
    actions: string[]
    items: Array<{ kind: string; id: string; title: string; href?: unknown; fields?: unknown }>
    error?: string
  }> {
    const query = new URLSearchParams({ kind })
    if (opts?.sessionId) query.set('sessionId', opts.sessionId)
    if (opts?.cwd) query.set('cwd', opts.cwd)
    if (opts?.path) query.set('path', opts.path)
    if (opts?.workspaceId) query.set('workspaceId', opts.workspaceId)
    const result = await this.request<{ data: { kind: string; href?: { panel?: string; tab?: string; section?: string }; projections: string[]; actions: string[]; items: Array<{ kind: string; id: string; title: string; href?: unknown; fields?: unknown }>; error?: string } }>(`/api/v1/catalog?${query.toString()}`, { signal })
    return result.data
  }

  async catalogAction(body: { kind: string; action: string; sessionId?: string; cwd?: string; path?: string; id?: string; status?: string; params?: Record<string, unknown> }, signal?: AbortSignal): Promise<unknown> {
    const result = await this.request<{ data: unknown }>('/api/v1/catalog', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async catalogStream(opts: { kind: string; action: string; sessionId?: string; id?: string; path?: string; attachmentId?: string }, onFrame: (frame: unknown) => void, signal?: AbortSignal): Promise<void> {
    const query = new URLSearchParams({ kind: opts.kind, action: opts.action })
    if (opts.sessionId) query.set('sessionId', opts.sessionId)
    if (opts.id) query.set('id', opts.id)
    if (opts.path) query.set('path', opts.path)
    if (opts.attachmentId) query.set('attachmentId', opts.attachmentId)
    const response = await fetch(this.uiFetchUrl(`/api/v1/catalog/stream?${query.toString()}`), { signal })
    if (!response.ok || !response.body) {
      throw new RuntimeApiError(response.status, 'catalog_stream_failed', `跟不了这个流 (${response.status})`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let eventName = 'message'
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() || ''
      for (const chunk of chunks) {
        let data = ''
        for (const line of chunk.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim()
          else if (line.startsWith('data:')) data += line.slice(5).trim()
        }
        if (eventName === 'frame' && data) {
          try { onFrame(JSON.parse(data)) } catch { /* skip one malformed frame */ }
        }
        if (eventName === 'error' && data) {
          const payload = JSON.parse(data) as { message?: string }
          throw new RuntimeApiError(502, 'catalog_stream_failed', payload.message || '跟不了这个流')
        }
        eventName = 'message'
      }
    }
  }

  async deleteWorkspaceFile(name: string, sessionId?: string, signal?: AbortSignal): Promise<{ path: string }> {
    const query = new URLSearchParams({ name })
    if (sessionId) query.set('sessionId', sessionId)
    const result = await this.request<{ data: { path: string } }>(`/api/v1/files?${query.toString()}`, {
      method: 'DELETE',
      signal,
    })
    return result.data
  }

  async mkdirWorkspace(name: string, sessionId?: string, signal?: AbortSignal): Promise<{ path: string }> {
    const result = await this.request<{ data: { path: string } }>('/api/v1/files/mkdir', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sessionId }),
    })
    return result.data
  }

  async uploadWorkspaceFile(input: { name: string; data: string; sessionId?: string }, signal?: AbortSignal): Promise<{ path: string }> {
    const result = await this.request<{ data: { path: string } }>('/api/v1/files', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async readWorkspaceBytes(sessionId: string, path: string, signal?: AbortSignal): Promise<{ data?: string; size?: number; name?: string; path?: string; mime?: string }> {
    const query = new URLSearchParams({ path })
    if (sessionId) query.set('sessionId', sessionId)
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/v1/files/raw?${query.toString()}`, { signal })
    } catch (error) {
      throw new RuntimeApiError(0, 'runtime_unreachable', error instanceof Error ? error.message : '本地运行时不可访问')
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string; code?: string }; correlationId?: string }
      throw new RuntimeApiError(response.status, payload.error?.code ?? 'runtime_error', payload.error?.message ?? `请求失败 (${response.status})`, payload.correlationId)
    }
    const buf = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    const step = 0x8000
    for (let i = 0; i < buf.length; i += step) binary += String.fromCharCode(...buf.subarray(i, i + step))
    return {
      path,
      name: path.split('/').pop() || 'file',
      size: buf.length,
      mime: response.headers.get('content-type') || '',
      data: btoa(binary),
    }
  }

  async readWorkspaceFile(sessionId: string, path: string, signal?: AbortSignal): Promise<{ text?: string; path?: string }> {
    const query = new URLSearchParams({ path })
    if (sessionId) query.set('sessionId', sessionId)
    const result = await this.request<{ data: { text?: string; path?: string } }>(`/api/v1/files/content?${query.toString()}`, { signal })
    return result.data
  }

  async writeWorkspaceFile(input: { path: string; text: string; sessionId?: string }, signal?: AbortSignal): Promise<{ path: string }> {
    const result = await this.request<{ data: { path: string } }>('/api/v1/files/content', {
      method: 'PUT',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async listMemoryCards(includeFiled = false, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const path = includeFiled ? '/api/v1/memory/cards?include_filed=true' : '/api/v1/memory/cards'
    const result = await this.request<{ data: Record<string, unknown> }>(withWorkspaceCwd(path), { signal })
    return result.data
  }

  async memoryHealth(input: { offset?: number; dup_offset?: number } = {}, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const params = new URLSearchParams()
    if (Number(input.offset || 0) > 0) params.set('offset', String(Number(input.offset)))
    if (Number(input.dup_offset || 0) > 0) params.set('dup_offset', String(Number(input.dup_offset)))
    const suffix = params.size ? `?${params.toString()}` : ''
    const result = await this.request<{ data: Record<string, unknown> }>(withWorkspaceCwd(`/api/v1/memory/health${suffix}`), { signal })
    return result.data
  }

  async memoryHealthAct(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/memory/health/act', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspaceCwdBody({ ...body, nodded: true })),
    })
    return result.data
  }

  async getBriefingDefinition(signal?: AbortSignal): Promise<BriefingDefinition> {
    const result = await this.request<{ ok: true; data: BriefingDefinition }>(withWorkspaceCwd('/api/v1/briefing/definition'), { signal })
    return result.data
  }

  async putBriefingDefinition(body: {
    workspaceCwd?: string
    sections: BriefingSectionDef[]
    schedule: BriefingSchedule
    sources?: Array<Record<string, unknown>>
    delivery?: BriefingDelivery
  }, signal?: AbortSignal): Promise<BriefingDefinition> {
    const result = await this.request<{ ok: true; data: BriefingDefinition }>('/api/v1/briefing/definition', {
      method: 'PUT',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        workspaceCwd: typeof body.workspaceCwd === 'string' && body.workspaceCwd.startsWith('/')
          ? body.workspaceCwd
          : currentWorkspaceCwd(),
      }),
    })
    return result.data
  }

  async runBriefing(mode: 'full' | 'internal-only' = 'full', opts?: { sessionId?: string; workspaceCwd?: string; signal?: AbortSignal }): Promise<{ briefingId: string; briefing: BriefingSnapshot }> {
    const workspaceCwd = opts?.workspaceCwd && opts.workspaceCwd.startsWith('/') ? opts.workspaceCwd : currentWorkspaceCwd()
    const result = await this.request<{ ok: true; data: { briefingId: string; briefing: BriefingSnapshot } }>('/api/v1/briefing/run', {
      method: 'POST',
      signal: opts?.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        workspaceCwd,
        ...(opts?.sessionId ? { sessionId: opts.sessionId } : {}),
      }),
    })
    return result.data
  }

  async getLatestBriefing(onOpen = false, signal?: AbortSignal): Promise<{ definition: BriefingDefinition; briefing: BriefingSnapshot | null; schedule: BriefingSchedule }> {
    const path = withWorkspaceCwd(onOpen ? '/api/v1/briefing/latest?onOpen=1' : '/api/v1/briefing/latest')
    const result = await this.request<{ ok: true; data: { definition: BriefingDefinition; briefing: BriefingSnapshot | null; schedule: BriefingSchedule } }>(path, { signal })
    return result.data
  }

  async listBriefingMcpSources(signal?: AbortSignal): Promise<{ servers: McpServerV2[]; configured: string[] }> {
    const result = await this.request<{ ok: true; data: { servers: McpServerV2[]; configured: string[] } }>(withWorkspaceCwd('/api/v1/briefing/sources/mcp'), { signal })
    return result.data
  }

  async draftMemoryCard(label: string, cause: 'correction' | 'choice' = 'correction', origin?: string, sessionId?: string, signal?: AbortSignal): Promise<MemoryDraftCard> {
    const result = await this.request<{ data: MemoryDraftCard }>(withWorkspaceCwd('/api/v1/memory/cards'), {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspaceCwdBody({
        label,
        cause,
        ...(origin ? { origin } : {}),
        ...(sessionId ? { sessionId } : {}),
      })),
    })
    return result.data
  }

  async nodMemoryCard(id: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>(withWorkspaceCwd(`/api/v1/memory/cards/${encodeURIComponent(id)}/nod`), {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspaceCwdBody({ nodded: true })),
    })
    return result.data
  }

  async searchMemory(query: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>(withWorkspaceCwd(`/api/v1/memory/search?q=${encodeURIComponent(query)}`), { signal })
    return result.data
  }

  async search(query = '', signal?: AbortSignal): Promise<{ cwd: string; query: string; hits: SearchHit[] }> {
    const { currentAiTarget } = await import('@/lib/ai-target')
    const target = await currentAiTarget(signal).catch(() => ({ ok: false as const, error: '' }))
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    const cwd = target.ok ? target.cwd : currentWorkspaceCwd()
    if (cwd) params.set('cwd', cwd)
    if (target.ok) params.set('sessionId', target.sessionId)
    const suffix = params.size ? `?${params.toString()}` : ''
    const result = await this.request<{ data: { cwd: string; query: string; hits: SearchHit[] } }>(
      `/api/v1/search${suffix}`,
      { signal },
    )
    return result.data
  }

  async fetchContextPack(input: {
    workspaceCwd: string
    scopes: string[]
    query?: string
    entity?: Record<string, unknown>
    intentKind?: 'decision' | 'draft' | 'lookup'
    sessionId?: string
  }, signal?: AbortSignal): Promise<{ pack: Record<string, unknown>; warnings: string[] }> {
    const result = await this.request<{ data: Record<string, unknown>; warnings?: string[] }>('/api/v1/context/pack', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return { pack: result.data, warnings: result.warnings ?? [] }
  }

  async fetchCorpus(id: string, signal?: AbortSignal): Promise<{ ok: boolean; id: string; title?: string; text?: string; message?: string; href?: Record<string, unknown>; status?: string; origin?: string }> {
    const path = withWorkspaceCwd(`/api/v1/corpus/${encodeURIComponent(String(id || ''))}`)
    let response: Response
    try {
      response = await fetch(this.uiFetchUrl(path), { signal })
    } catch (error) {
      throw new RuntimeApiError(0, 'runtime_unreachable', error instanceof Error ? error.message : '本地运行时不可访问')
    }
    const payload = await response.json().catch(() => ({})) as {
      ok?: boolean
      id?: string
      title?: string
      text?: string
      message?: string
      href?: Record<string, unknown>
      status?: string
      origin?: string
      error?: { code?: string; message?: string } | string
      correlationId?: string
    }
    if (!response.ok) {
      const nested = payload?.error && typeof payload.error === 'object' ? payload.error : null
      throw new RuntimeApiError(
        response.status,
        nested?.code ?? (typeof payload?.error === 'string' ? payload.error : 'runtime_error'),
        nested?.message ?? payload?.message ?? `请求失败 (${response.status})`,
        payload?.correlationId,
      )
    }
    return {
      ok: Boolean(payload.ok),
      id: String(payload.id || id),
      title: payload.title,
      text: payload.text,
      message: payload.message,
      href: payload.href,
      status: payload.status,
      origin: payload.origin,
    }
  }

  async imState(sessionId?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
    const result = await this.request<{ data: Record<string, unknown> }>(`/api/v1/im/state${query}`, { signal })
    return result.data
  }

  async imCopyAttach(body: { requestId: string; index?: number; workspace?: string; path?: string; dests?: string[] }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this.lanAssist('/attach/copy', { method: 'POST', signal, body })
  }

  async imAttach(requestId: string, index: number, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const query = new URLSearchParams({ requestId, index: String(index) })
    const result = await this.request<{ data: Record<string, unknown> }>(`/api/v1/im/attach?${query.toString()}`, { signal })
    return result.data
  }

  async imThread(input: { peerId?: string; groupId?: string; requestId?: string } = {}, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const query = new URLSearchParams()
    if (input.peerId) query.set('peerId', input.peerId)
    if (input.groupId) query.set('groupId', input.groupId)
    if (input.requestId) query.set('requestId', input.requestId)
    const result = await this.request<{ data: Record<string, unknown> }>(`/api/v1/im/thread?${query.toString()}`, { signal })
    return result.data
  }

  async imTranslate(text: string, signal?: AbortSignal): Promise<{ ok?: boolean; out?: string; lang?: string; error?: string; hint?: string }> {
    return this.lanAssist('/translate', { method: 'POST', signal, body: { quote: text } }) as Promise<{ ok?: boolean; out?: string; lang?: string; error?: string; hint?: string }>
  }

  async imReply(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/reply', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imDraft(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/draft', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imPairMint(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/pair/mint', { method: 'POST', signal })
    return result.data
  }

  async imPairHandshake(body: { peerCode: string; door: string; peerName?: string }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/pair/handshake', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imPairAccept(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/pair/accept', { method: 'POST', signal })
    return result.data
  }

  async imPairReject(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/pair/reject', { method: 'POST', signal })
    return result.data
  }

  async imSaveProfile(body: { name: string; avatar?: string }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/profile', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imCreateGroup(body: { name: string; members: string[] }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/group', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imUpdateGroup(body: { groupId: string; name?: string; members?: string[]; pin?: boolean; mute?: boolean }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/group/update', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imDissolveGroup(groupId: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/group/dissolve', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId }),
    })
    return result.data
  }

  async imUnpair(peerId: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/unpair', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peerId }),
    })
    return result.data
  }

  async imWithdraw(body: { requestId?: string; messageId?: string; peerId: string }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/withdraw', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imMarkRead(requestId: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this.lanAssist('/read', { method: 'POST', signal, body: { requestId } })
  }

  async imPlaceLetters(body: { requestIds: string[]; workspace: string }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/place', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imShout(signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/shout', { method: 'POST', signal })
    return result.data
  }

  async imCompose(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/compose', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imSavePeer(body: { peerId: string; note?: string; door?: string; pin?: boolean; mute?: boolean }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/peer', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async imSleep(on: boolean, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/sleep', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on }),
    })
    return result.data
  }

  async imCancelPresend(requestId: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/presend/cancel', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    })
    return result.data
  }

  async imSend(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/im/send', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async listMcpServers(signal?: AbortSignal): Promise<{ mcp: McpServerV2[]; connectors: McpConnectorCard[]; resourceTools: string[] }> {
    const result = await this.request<{ data: { mcp: McpServerV2[]; connectors: McpConnectorCard[]; resourceTools?: string[] } }>('/api/v1/mcp/servers', { signal })
    const data = result.data
    return { mcp: data.mcp || [], connectors: data.connectors || [], resourceTools: Array.isArray(data.resourceTools) ? data.resourceTools : [] }
  }

  async listMcpProjection(input?: { sessionId?: string; cwd?: string }, signal?: AbortSignal): Promise<{ mcp: McpServerV2[]; resourceTools: string[] }> {
    const params = new URLSearchParams()
    if (input?.sessionId) params.set('sessionId', input.sessionId)
    if (input?.cwd) params.set('cwd', input.cwd)
    const query = params.toString()
    const result = await this.request<{ data: { mcp: McpServerV2[]; resourceTools?: string[] } }>(`/api/v1/mcp/projection${query ? `?${query}` : ''}`, { signal })
    const data = result.data
    return { mcp: data.mcp || [], resourceTools: Array.isArray(data.resourceTools) ? data.resourceTools : [] }
  }

  async addMcpServer(
    input: {
      serverName: string
      command?: string
      args?: string[]
      env?: Record<string, string>
      transport?: 'stdio' | 'streamable-http'
      url?: string
      headers?: Record<string, string>
    },
    signal?: AbortSignal,
  ): Promise<{ serverName: string; needsRestart: boolean; note?: string }> {
    const result = await this.request<{ data: { serverName: string; needsRestart: boolean }; note?: string }>('/api/v1/mcp/servers', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return { ...result.data, note: result.note }
  }

  async checkMcpHealth(serverName: string, signal?: AbortSignal): Promise<{ ok: boolean; message: string }> {
    const result = await this.request<{ data: { ok: boolean; message: string } }>(`/api/v1/mcp/health?serverName=${encodeURIComponent(serverName)}`, { signal })
    return result.data
  }

  async setMcpServerEnabled(serverName: string, enabled: boolean, signal?: AbortSignal): Promise<{ serverName: string; enabled: boolean; needsRestart: boolean; note?: string }> {
    const result = await this.request<{ data: { serverName: string; enabled: boolean; needsRestart: boolean }; note?: string }>(
      `/api/v1/mcp/servers/${encodeURIComponent(serverName)}/enabled`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      },
    )
    return { ...result.data, note: result.note }
  }

  async removeMcpServer(serverName: string, signal?: AbortSignal): Promise<{ serverName: string; needsRestart: boolean; note?: string }> {
    const result = await this.request<{ data: { serverName: string; needsRestart: boolean }; note?: string }>(
      `/api/v1/mcp/servers/${encodeURIComponent(serverName)}`,
      { method: 'DELETE', signal },
    )
    return { ...result.data, note: result.note }
  }

  async listBusinessConnections(workspaceId?: string, signal?: AbortSignal): Promise<BusinessConnectionRecord[]> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
    const result = await this.request<{ items: BusinessConnectionRecord[] }>(`/api/v1/business/connections${query}`, { signal })
    return result.items
  }

  async listBusinessApps(workspaceId?: string, signal?: AbortSignal): Promise<BusinessAppRecord[]> {
    const params = new URLSearchParams()
    if (workspaceId) params.set('workspaceId', workspaceId)
    const cwd = currentWorkspaceCwd()
    if (cwd) params.set('workspaceCwd', cwd)
    const query = params.toString() ? `?${params}` : ''
    const result = await this.request<{ items: BusinessAppRecord[] }>(`/api/v1/business/apps${query}`, { signal })
    return result.items
  }

  async createBusinessApp(input: { workspaceId: string; name: string; definition: JsonValue; changeNote?: string }, signal?: AbortSignal): Promise<BusinessAppRecord> {
    const result = await this.request<{ data: BusinessAppRecord }>('/api/v1/business/apps', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async updateBusinessApp(id: string, input: { name?: string; definition?: JsonValue; changeNote?: string }, signal?: AbortSignal): Promise<BusinessAppRecord> {
    const result = await this.request<{ data: BusinessAppRecord }>(`/api/v1/business/apps/${encodeURIComponent(id)}`, {
      method: 'PUT',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return result.data
  }

  async listFdeApps(signal?: AbortSignal): Promise<Array<{ id: string; name: string; slug: string }>> {
    const result = await this.request<{ data: Array<{ id: string; name: string; slug: string }> }>(
      withWorkspaceCwd('/api/v1/apps'),
      { signal },
    )
    return Array.isArray(result.data) ? result.data : []
  }

  async getDeclarativeApp(appId: string, signal?: AbortSignal) {
    const result = await this.request<{ ok: boolean; data: import('@/lib/app-spec').FdeAppDetail }>(
      `/api/v1/apps/${encodeURIComponent(appId)}`,
      { signal, cache: 'no-store' },
    )
    return result.data
  }

  async createDeclarativeApp(input: { workspaceCwd: string; workspaceId?: string; spec: JsonValue }, signal?: AbortSignal) {
    const result = await this.request<{ ok: boolean; data: { appId: string; revision: number }; errors?: { path: string; message: string }[] }>(
      '/api/v1/apps',
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    return result
  }

  async putDeclarativeAppSpec(appId: string, input: { spec: JsonValue; changeNote?: string }, signal?: AbortSignal) {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/v1/apps/${encodeURIComponent(appId)}/spec`, {
        method: 'PUT',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    } catch (error) {
      throw new RuntimeApiError(0, 'runtime_unreachable', error instanceof Error ? error.message : '本地运行时不可访问')
    }
    const payload = await response.json().catch(() => ({})) as {
      ok?: boolean
      data?: { revision: number }
      errors?: { path: string; message: string }[]
      error?: string
      correlationId?: string
    }
    if (response.status === 422) {
      return {
        ok: false,
        errors: payload.errors,
        error: payload.error,
      }
    }
    if (!response.ok) {
      throw new RuntimeApiError(
        response.status,
        (payload as { error?: { code?: string } })?.error?.code ?? 'runtime_error',
        (payload as { error?: { message?: string } })?.error?.message ?? `请求失败 (${response.status})`,
        payload.correlationId,
      )
    }
    return { ok: true, data: payload.data, errors: payload.errors, error: payload.error }
  }

  async activateDeclarativeApp(appId: string, signal?: AbortSignal) {
    return this.request<{ ok: boolean; data?: { status: string }; errors?: { path: string; message: string }[] }>(
      `/api/v1/apps/${encodeURIComponent(appId)}/activate`,
      { method: 'POST', signal },
    )
  }

  async trashDeclarativeApp(appId: string, signal?: AbortSignal) {
    return this.request<{ ok: boolean; data?: { deletedAt?: string } }>(
      `/api/v1/apps/${encodeURIComponent(appId)}`,
      { method: 'DELETE', signal },
    )
  }

  async restoreDeclarativeApp(appId: string, signal?: AbortSignal) {
    return this.request<{ ok: boolean; data?: { status?: string } }>(
      `/api/v1/apps/${encodeURIComponent(appId)}/restore`,
      { method: 'POST', signal },
    )
  }

  async purgeDeclarativeApp(appId: string, signal?: AbortSignal) {
    return this.request<{ ok: boolean; data?: { dropped?: string[] } }>(
      `/api/v1/apps/${encodeURIComponent(appId)}/purge`,
      { method: 'POST', signal },
    )
  }

  async rollbackDeclarativeApp(appId: string, revision: number, signal?: AbortSignal) {
    return this.request<{ ok: boolean; data: { revision: number } }>(
      `/api/v1/apps/${encodeURIComponent(appId)}/rollback`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision }),
      },
    )
  }

  async listAppRecords(
    slug: string,
    entity: string,
    workspaceCwd: string,
    query?: { filter?: Record<string, unknown>; page?: number; size?: number; sort?: string; dir?: string },
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({ workspace: workspaceCwd })
    if (query?.filter) params.set('filter', JSON.stringify(query.filter))
    if (query?.page) params.set('page', String(query.page))
    if (query?.size) params.set('size', String(query.size))
    if (query?.sort) params.set('sort', query.sort)
    if (query?.dir) params.set('dir', query.dir)
    const result = await this.request<{ ok: boolean; data: import('@/lib/app-spec').AppRecordList }>(
      `/api/v1/apps/${encodeURIComponent(slug)}/${encodeURIComponent(entity)}?${params}`,
      { signal },
    )
    return result.data
  }

  async createAppRecord(slug: string, entity: string, workspaceCwd: string, body: Record<string, unknown>, signal?: AbortSignal) {
    const result = await this.request<{ ok: boolean; data: Record<string, unknown>; errors?: { path: string; message: string }[] }>(
      `/api/v1/apps/${encodeURIComponent(slug)}/${encodeURIComponent(entity)}`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, workspace: workspaceCwd, workspaceCwd }),
      },
    )
    return result
  }

  async patchAppRecord(slug: string, entity: string, rid: string, workspaceCwd: string, body: Record<string, unknown>, signal?: AbortSignal) {
    const params = new URLSearchParams({ workspace: workspaceCwd })
    return this.request<{ ok: boolean; data: Record<string, unknown>; errors?: { path: string; message: string }[] }>(
      `/api/v1/apps/${encodeURIComponent(slug)}/${encodeURIComponent(entity)}/${encodeURIComponent(rid)}?${params}`,
      {
        method: 'PATCH',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
  }

  async runAppAction(slug: string, actionName: string, workspaceCwd: string, rids: string[], signal?: AbortSignal) {
    return this.request<{ ok: boolean; data: unknown }>(
      `/api/v1/apps/${encodeURIComponent(slug)}/actions/${encodeURIComponent(actionName)}`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rids, workspaceCwd, workspace: workspaceCwd }),
      },
    )
  }

  async getAppStat(slug: string, viewId: string, workspaceCwd: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ workspace: workspaceCwd })
    const result = await this.request<{ ok: boolean; data: { value: number; label: string } }>(
      `/api/v1/apps/${encodeURIComponent(slug)}/stats/${encodeURIComponent(viewId)}?${params}`,
      { signal },
    )
    return result.data
  }

  async listOperations(workspaceId?: string, signal?: AbortSignal): Promise<RuntimeOperation[]> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
    const result = await this.request<{ items: RuntimeOperation[] }>(`/api/v1/operations${query}`, { signal })
    return result.items
  }

  async planOperation(intent: OperationIntent & { plan?: Record<string, unknown> }, signal?: AbortSignal): Promise<RuntimeOperation> {
    const result = await this.request<{ data: RuntimeOperation }>('/api/v1/operations', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intent),
    })
    return result.data
  }

  async getOperationTrace(operationId: string, signal?: AbortSignal): Promise<OperationTrace> {
    const result = await this.request<{ data: OperationTrace }>(`/api/v1/operations/${operationId}/trace`, { signal })
    return result.data
  }

  async approveOperation(operationId: string, note = '', signal?: AbortSignal): Promise<RuntimeOperation> {
    const result = await this.request<{ data: RuntimeOperation }>(`/api/v1/operations/${operationId}/approve`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    return result.data
  }

  async bizPreview(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>(withWorkspaceCwd('/api/v1/biz/preview'), {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspaceCwdBody(body)),
    })
    return result.data
  }

  async bizLookup(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/biz/lookup', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async bizWrite(
    previewId: string,
    traceId?: string,
    workspace?: string,
    extraOrSignal?: AbortSignal | {
      source?: string
      changes?: JsonValue[]
      columns?: JsonValue[]
      kind?: string
      action?: string
      no?: string
      sessionId?: string
      speech?: string
      rollback_of_trace_id?: string
      rollbackOfTraceId?: string
    },
  ): Promise<Record<string, unknown>> {
    let signal: AbortSignal | undefined
    let extra: Record<string, unknown> = {}
    if (extraOrSignal && typeof extraOrSignal === 'object' && 'aborted' in extraOrSignal) {
      signal = extraOrSignal as AbortSignal
    } else if (extraOrSignal && typeof extraOrSignal === 'object') {
      extra = extraOrSignal as Record<string, unknown>
    }
    const result = await this.request<{ data: Record<string, unknown> }>(withWorkspaceCwd('/api/v1/biz/write'), {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preview_id: previewId,
        ...(traceId ? { trace_id: traceId } : {}),
        ...(workspace ? { workspace, cwd: workspace } : {}),
        ...extra,
      }),
    })
    return result.data
  }

  async bizRollbackPreview(traceId: string, signal?: AbortSignal): Promise<{
    audit: Record<string, unknown>
    preview: Record<string, unknown>
    sheet: Record<string, unknown>
    rollbackChanges: JsonValue[]
  }> {
    const result = await this.request<{
      data: {
        audit: Record<string, unknown>
        preview: Record<string, unknown>
        sheet: Record<string, unknown>
        rollbackChanges: JsonValue[]
      }
    }>(withWorkspaceCwd('/api/v1/biz/rollback/preview'), {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trace_id: traceId }),
    })
    return result.data
  }

  async bizDismissPreview(previewId?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await this.request<{ data: Record<string, unknown> }>('/api/v1/biz/preview/dismiss', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preview_id: previewId?.trim() || '' }),
    })
    return result.data
  }

  async listBizKinds(signal?: AbortSignal, workspaceCwd?: string): Promise<BizVocabSheet> {
    const cwd = workspaceCwd?.trim().startsWith('/') ? workspaceCwd.trim() : currentWorkspaceCwd()
    const path = cwd
      ? `/api/v1/biz/kinds?cwd=${encodeURIComponent(cwd)}`
      : withWorkspaceCwd('/api/v1/biz/kinds')
    const result = await this.request<{ data: BizVocabSheet }>(path, { signal })
    return result.data
  }

  async listBizSurfaces(workspaceCwd: string, limit = 20, signal?: AbortSignal): Promise<BizSurfaceRecord[]> {
    const q = new URLSearchParams({ workspace: workspaceCwd, limit: String(limit) })
    const result = await this.request<{ items: BizSurfaceRecord[] }>(`/api/v1/biz/surfaces?${q}`, { signal })
    return result.items
  }

  async getBizPendingSheet(signal?: AbortSignal, sessionId?: string): Promise<{ sheet: Record<string, unknown> | null; writePreview: Record<string, string> | null }> {
    const sid = String(sessionId || '').trim()
    const path = sid
      ? `/api/v1/biz/pending-sheet?sessionId=${encodeURIComponent(sid)}`
      : '/api/v1/biz/pending-sheet'
    const result = await this.request<{ data: { sheet: Record<string, unknown> | null; writePreview?: Record<string, string> | null } }>(withWorkspaceCwd(path), { signal })
    const writePreview = result.data.writePreview && typeof result.data.writePreview === 'object'
      ? result.data.writePreview
      : null
    return { sheet: result.data.sheet, writePreview }
  }

  async bizFocusKind(
    body: { sessionId: string; kind: string; workspace?: string },
    signal?: AbortSignal,
  ): Promise<{ sheet: Record<string, unknown> | null }> {
    const result = await this.request<{ data: { sheet: Record<string, unknown> | null } }>('/api/v1/biz/focus-kind', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return result.data
  }

  async listBizConnections(workspaceId: string, signal?: AbortSignal): Promise<BizConnectionWithHealth[]> {
    const q = new URLSearchParams({ workspace: workspaceId })
    const result = await this.request<{ items: BizConnectionWithHealth[] }>(`/api/v1/biz/connections?${q}`, { signal })
    return result.items
  }

  async listBizTraces(limit = 50, signal?: AbortSignal): Promise<{ rows: JsonValue[]; receipt: unknown }> {
    const result = await this.request<{ data: { rows: JsonValue[]; receipt: unknown } }>(withWorkspaceCwd(`/api/v1/biz/traces?limit=${limit}`), { signal })
    return result.data
  }

  async getBizTrace(traceId: string, signal?: AbortSignal): Promise<JsonValue | null> {
    const id = String(traceId || '').trim()
    if (!id) return null
    const q = new URLSearchParams({ id })
    const result = await this.request<{ data: { row?: JsonValue } }>(withWorkspaceCwd(`/api/v1/biz/traces?${q}`), { signal })
    return result.data?.row ?? null
  }

  async executeOperation(operationId: string, signal?: AbortSignal): Promise<RuntimeOperation> {
    const result = await this.request<{ data: RuntimeOperation }>(`/api/v1/operations/${operationId}/execute`, {
      method: 'POST',
      signal,
    })
    return result.data
  }

  private async lanAssist(path: string, init: { method?: string; signal?: AbortSignal; body?: Record<string, unknown> } = {}): Promise<Record<string, unknown>> {
    const route = path.startsWith('/') ? path : `/${path}`
    let response: Response
    try {
      response = await fetch(`/lan-assist${route}`, {
        method: init.method || (init.body ? 'POST' : 'GET'),
        signal: init.signal,
        headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
        body: init.body ? JSON.stringify(init.body) : undefined,
      })
    } catch (error) {
      throw new RuntimeApiError(0, 'runtime_unreachable', error instanceof Error ? error.message : '本地运行时不可访问')
    }
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok || payload.ok === false) {
      throw new RuntimeApiError(
        response.status,
        String(payload.error || 'runtime_error'),
        String(payload.hint || payload.error || `请求失败 (${response.status})`),
      )
    }
    return payload
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, init)
    } catch (error) {
      throw new RuntimeApiError(0, 'runtime_unreachable', error instanceof Error ? error.message : '本地运行时不可访问')
    }

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const nested = payload?.error && typeof payload.error === 'object' ? payload.error : null
      throw new RuntimeApiError(
        response.status,
        nested?.code ?? (typeof payload?.error === 'string' ? payload.error : 'runtime_error'),
        nested?.message ?? payload?.message ?? `请求失败 (${response.status})`,
        payload?.correlationId,
      )
    }
    return payload as T
  }
}

export const runtimeApi = new RuntimeApi()
