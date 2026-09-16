// 全部业务类型集中地。store、组件、seed 都引这一份。
import type { ReactNode } from 'react'

export type ID = string

export interface Workspace {
  id: ID
  name: string
  emoji: string
  desc: string
  color?: string // tailwind 颜色 token (e.g. 'blue' | 'amber' | 'violet')
  // 关联的本地目录仅持久化可展示信息；FileSystemDirectoryHandle 单独保存在 IndexedDB。
  localDirectoryName?: string
  localDirectoryLinkedAt?: string
  cwd?: string
  createdAt?: string
}

export interface User {
  id: ID
  name: string
  handle: string
  avatarColor: string
}

export interface Task {
  id: ID
  title: string
  notes?: string
  status: 'todo' | 'doing' | 'done' | 'archived'
  priority: 'low' | 'med' | 'high' | 'urgent'
  due?: string // ISO date
  tags: string[]
  project?: string
  createdAt: string
}

export interface ScheduleEvent {
  id: ID
  title: string
  start: string // ISO datetime
  end: string
  location?: string
  attendees?: string[]
  kind: 'meeting' | 'focus' | 'reminder' | 'external'
}

export interface FileNode {
  id: ID
  name: string
  kind: 'folder' | 'image' | 'doc' | 'sheet' | 'pdf' | 'code' | 'json' | 'markdown' | 'audio' | 'web' | 'ppt'
  size: number // bytes
  updatedAt: string
  starred?: boolean
  parentId: ID | null
  // 内嵌内容,小文件直接放进来,避免再发一次 fetch
  content?: string
  meta?: Record<string, string | number>
  // 版本历史:每次保存时把旧版本压入。最多保留 MAX_VERSIONS 条,超出后弹掉最旧的。
  // 历史项 content 不导出到主树,只在「版本历史」面板展示。
  versionHistory?: FileVersion[]
  // 是否被改造过(剥离 dirty 标记),用于侧栏小红点
  dirty?: boolean
  // 工作区隔离:文件归属哪个 workspace
  workspaceId?: ID
}

export interface FileVersion {
  id: ID
  ts: string
  content: string
  size: number
  note?: string // 可选:用户填的版本说明,如 "修订了 1.2 节的措辞"
}

// 自动化工作流。语义:"当 trigger 命中时,按 steps 顺序执行"。和 Task/Schedule 并列。
export interface Workflow {
  id: ID
  name: string
  description: string
  status: 'active' | 'paused'
  // 触发方式: cron 表达式 / 关键字触发 / 手动
  trigger:
    | { kind: 'cron'; expr: string; tz?: string }
    | { kind: 'keyword'; patterns: string[] }
    | { kind: 'manual' }
    | { kind: 'event'; on: 'task.done' | 'file.save' | 'order.new' | 'im.received' }
  // 执行步骤
  steps: WorkflowStep[]
  // 上次运行
  lastRunAt?: string
  lastRunStatus?: 'success' | 'failed' | 'running'
  // 元信息
  category: 'data' | 'im' | 'file' | 'memory' | 'system'
  emoji: string
  createdAt: string
  // 工作区隔离
  workspaceId?: ID
}

export interface WorkflowStep {
  id: ID
  kind: 'tool.call' | 'im.send' | 'data.query' | 'file.write' | 'memory.add' | 'delay'
  label: string
  config: Record<string, string | number>
}

export type ArtifactKind = 'image' | 'poster' | 'web' | 'dashboard' | 'ppt' | 'file'

export interface ChatArtifact {
  id: ID
  kind: ArtifactKind
  title: string
  subtitle?: string
  fileId?: ID
  preview?: string
}

export interface ChatMessage {
  id: ID
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string
  ts: string
  toolName?: string
  toolResult?: string
  artifacts?: ChatArtifact[]
  usage?: { prompt?: number; completion?: number; total?: number }
}

export type IMAIAction = 'draft' | 'adopt' | 'precedent' | 'handoff' | 'local' | 'summary'
export type IMContactKind = 'contact' | 'topic-group'

export interface IMAttachment {
  id: ID
  fileId: ID
  name: string
  kind: FileNode['kind']
  size: number
  mime?: string
  data?: string
}

export interface IMHandoffPackage {
  id: ID
  title: string
  summary: string
  sourceWorkspaceId: ID
  sourceChatIds: ID[]
  sourceThreadIds?: ID[] // v7 兼容字段
  fileIds: ID[]
  transcript?: Array<{ role: 'user' | 'assistant'; text: string }>
  sessions?: Array<{
    sessionId: string
    title: string
    files: Array<{ name: string; size?: number; data: string }>
  }>
  createdAt: string
  status: 'sent' | 'opened' | 'accepted'
}

export interface IMTopic {
  id: ID
  groupId: ID
  title: string
  description?: string
  createdBy: ID
  createdAt: string
  closed?: boolean
}

export interface ChatThread {
  id: ID
  title: string
  agentId: ID
  messages: ChatMessage[]
  pinned?: boolean
  updatedAt: string
  // 工作区隔离
  workspaceId?: ID
  // 从某个 IM 会话唤起的协助线程
  sourceThreadId?: ID
}

export interface Agent {
  id: ID
  name: string
  desc: string
  emoji: string
  tools: string[]
  skillIds?: ID[]
  status: 'active' | 'paused'
  // 完整 Agent 配置
  role?: string
  model?: string
  systemPrompt?: string
  memoryMode?: 'workspace' | 'session' | 'off'
  temperature?: number
  maxSteps?: number
  // 工作区隔离
  workspaceId?: ID
}

export interface IMContact {
  id: ID
  kind: IMContactKind
  name: string
  handle: string
  avatarColor: string
  avatar?: string
  online: boolean
  pinned?: boolean
  muted?: boolean
  note?: string
  displayName?: string
  staffId?: string
  memberIds?: ID[]
  ownerId?: ID
  announcement?: string
}

export interface IMMessage {
  id: ID
  threadId: ID
  authorId: ID
  text: string
  ts: string
  read?: boolean
  topicId?: ID
  topic?: boolean
  parentId?: ID
  fromName?: string
  replyToId?: ID
  attachments?: IMAttachment[]
  handoff?: IMHandoffPackage
  aiChatId?: ID
  translation?: string
  recalledAt?: string
  pending?: boolean
}

export interface BusinessRow {
  id: ID
  [key: string]: string | number
}

export interface BusinessTable {
  id: ID
  name: string
  columns: { key: string; label: string; type: 'text' | 'number' | 'date' | 'status' | 'amount' }[]
  rows: BusinessRow[]
}

export interface MCPServer {
  id: ID
  name: string
  desc: string
  status: 'connected' | 'disconnected' | 'pending'
  tools: string[]
  category: string
}

export interface Skill {
  id: ID
  name: string
  desc: string
  emoji: string
  enabled: boolean
  triggers: string[]
  source: 'builtin' | 'user' | 'marketplace'
}

export interface Notification {
  id: ID
  kind: 'info' | 'success' | 'warning' | 'error'
  title: string
  body?: string
  ts: string
  read?: boolean
  href?: string
}

export interface NewsItem {
  id: ID
  title: string
  source: string
  category: 'market' | 'product' | 'team' | 'system'
  ts: string
  summary?: string
  delta?: number
}

export interface MetricCard {
  id: ID
  label: string
  value: string | number
  delta?: number // percent
  unit?: string
  hint?: string
}

export interface KBItem { // knowledge base / 早报小卡
  id: ID
  title: string
  body: ReactNode
  meta?: string
}

export type Severity = 'info' | 'success' | 'warning' | 'error'
