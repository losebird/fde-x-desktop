// FDE-X 内部能力契约。
// UI 只依赖这些端口，不直接依赖 DSH、LAN Assist 或 Semantic OS 的内部模块与存储。

import type { ID } from './types'

export type Authority = 'workstation' | 'semantic' | 'external'
export type ObjectRef = `fde://${Authority}/${string}/${string}`
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type HealthState = 'healthy' | 'degraded' | 'unavailable' | 'unknown'
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface ActorContext {
  actorId: ID
  workspaceId: ID
  sessionId?: ID
  correlationId: ID
  causationId?: ID
}

export interface DomainEvent<T extends JsonValue = JsonValue> {
  id: ID
  type: string
  schemaVersion: number
  source: ObjectRef
  subject?: ObjectRef
  occurredAt: string
  correlationId: ID
  causationId?: ID
  data: T
}

export interface PageQuery {
  cursor?: string
  limit?: number
}

export interface PageResult<T> {
  items: T[]
  nextCursor?: string
}

export interface CapabilityHealth {
  capability: string
  state: HealthState
  version?: string
  detail?: string
  checkedAt: string
}

export interface AIRequest {
  conversationId: ID
  agentId: ID
  content: string
  attachments?: ObjectRef[]
  contextRefs?: ObjectRef[]
  mode?: 'standard' | 'deep'
  modelRoute?: string
}

export interface AIRunResult {
  runId: ID
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  artifactRefs: ObjectRef[]
}

export interface AIPort {
  health(): Promise<CapabilityHealth>
  submit(context: ActorContext, request: AIRequest): Promise<AIRunResult>
  cancel(context: ActorContext, runId: ID): Promise<void>
  getTrace(runId: ID): Promise<JsonValue>
}

export interface IMSendRequest {
  threadId: ID
  text: string
  topicId?: ID
  replyToId?: ID
  attachmentRefs?: ObjectRef[]
}

export interface IMPort {
  health(): Promise<CapabilityHealth>
  send(context: ActorContext, request: IMSendRequest): Promise<{ messageId: ID; receiptRef?: ObjectRef }>
  summarize(context: ActorContext, threadId: ID, range?: { from?: string; to?: string }): Promise<{ summary: string; sourceRefs: ObjectRef[] }>
  draftReply(context: ActorContext, threadId: ID, instruction?: string): Promise<{ text: string; sourceRefs: ObjectRef[] }>
}

export interface SemanticSearchHit {
  semanticRef: ObjectRef
  title: string
  excerpt: string
  score: number
  sourceRefs: ObjectRef[]
}

export interface SemanticPort {
  // 语义域保留自己的 FalkorDB/FalkorDBLite 与检索索引；此端口不暴露底层存储。
  health(): Promise<CapabilityHealth>
  search(context: ActorContext, query: string, options?: { workspaceId?: ID; limit?: number }): Promise<SemanticSearchHit[]>
  decisionBrief(context: ActorContext, subjectRefs: ObjectRef[]): Promise<JsonValue>
  remember(context: ActorContext, input: { kind: string; content: JsonValue; sourceRefs: ObjectRef[] }): Promise<{ semanticRef: ObjectRef }>
}

export type OperationState =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'uncertain'
  | 'compensating'
  | 'compensated'
  | 'compensation_failed'
  | 'cancelled'

export interface OperationIntent {
  workspaceId: ID
  connectionId?: ID
  appId?: ID
  targetRef: ObjectRef
  action: string
  operationKind: 'read' | 'write'
  riskLevel: RiskLevel
  input: JsonValue
  executionMode?: 'dry_run' | 'live'
  expectedVersion?: string
  compensation?: JsonValue
}

export interface OperationRecord extends OperationIntent {
  id: ID
  state: OperationState
  requestedBy: ID
  correlationId: ID
  createdAt: string
  updatedAt: string
}

export interface BusinessApplicationPort {
  health(): Promise<CapabilityHealth>
  listConnections(context: ActorContext): Promise<PageResult<JsonValue>>
  listApplications(context: ActorContext): Promise<PageResult<JsonValue>>
  planOperation(context: ActorContext, intent: OperationIntent): Promise<OperationRecord>
  approveOperation(context: ActorContext, operationId: ID, note?: string): Promise<OperationRecord>
  executeOperation(context: ActorContext, operationId: ID): Promise<OperationRecord>
  compensateOperation(context: ActorContext, operationId: ID, reason: string): Promise<OperationRecord>
  getOperationTrace(context: ActorContext, operationId: ID): Promise<JsonValue>
}

export interface FilePort {
  health(): Promise<CapabilityHealth>
  list(context: ActorContext, parentRef?: ObjectRef): Promise<PageResult<JsonValue>>
  read(context: ActorContext, fileRef: ObjectRef, versionId?: ID): Promise<JsonValue>
  write(context: ActorContext, fileRef: ObjectRef, content: JsonValue, expectedVersion?: string): Promise<{ versionId: ID }>
  preview(context: ActorContext, fileRef: ObjectRef): Promise<{ mediaType: string; payload: JsonValue }>
}

export interface ToolPort {
  health(): Promise<CapabilityHealth>
  list(context: ActorContext): Promise<PageResult<JsonValue>>
  invoke(context: ActorContext, toolName: string, input: JsonValue): Promise<{ invocationId: ID; output: JsonValue }>
}

export interface SkillPort {
  health(): Promise<CapabilityHealth>
  list(context: ActorContext): Promise<PageResult<JsonValue>>
  install(context: ActorContext, source: JsonValue): Promise<{ skillId: ID; status: string }>
  setEnabled(context: ActorContext, skillId: ID, enabled: boolean): Promise<void>
}

export interface PersonalPlanPort {
  // 日程、待办和提醒是人的承诺与时间锚点，不因接入 AI 而自动变成工作流。
  listTasks(context: ActorContext, query?: PageQuery): Promise<PageResult<JsonValue>>
  listEvents(context: ActorContext, query?: PageQuery): Promise<PageResult<JsonValue>>
  createTask(context: ActorContext, input: JsonValue): Promise<{ taskId: ID }>
  createEvent(context: ActorContext, input: JsonValue): Promise<{ eventId: ID }>
  askAI(context: ActorContext, request: { action: 'create' | 'break_down' | 'prioritize' | 'summarize'; input: JsonValue }): Promise<JsonValue>
}

export interface WorkflowPort {
  // 工作流只负责自动执行：时间、事件或人工触发后，按步骤调用 AI、工具、IM、文件或业务系统。
  list(context: ActorContext, query?: PageQuery): Promise<PageResult<JsonValue>>
  validate(context: ActorContext, definition: JsonValue): Promise<JsonValue>
  run(context: ActorContext, workflowId: ID, input?: JsonValue): Promise<{ runId: ID }>
  cancel(context: ActorContext, runId: ID): Promise<void>
}

export interface BriefingPort {
  listDefinitions(context: ActorContext): Promise<PageResult<JsonValue>>
  saveDefinition(context: ActorContext, definition: JsonValue): Promise<{ definitionId: ID }>
  generate(context: ActorContext, definitionId: ID): Promise<{ briefingId: ID; artifactRef: ObjectRef }>
}

export interface SettingsPort {
  get(context: ActorContext, namespace: string): Promise<JsonValue>
  set(context: ActorContext, namespace: string, value: JsonValue): Promise<void>
  diagnose(context: ActorContext): Promise<CapabilityHealth[]>
}

export interface WorkstationPorts {
  ai: AIPort
  im: IMPort
  semantic: SemanticPort
  businessApplications: BusinessApplicationPort
  files: FilePort
  tools: ToolPort
  skills: SkillPort
  personalPlan: PersonalPlanPort
  workflows: WorkflowPort
  briefings: BriefingPort
  settings: SettingsPort
}
