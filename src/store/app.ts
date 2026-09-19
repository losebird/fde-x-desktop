// 全局状态层。统一来源,持久化到 localStorage,所有模块读写都过这里。
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type {
  Task, ScheduleEvent, FileNode, ChatThread, Agent, IMContact, IMMessage,
  BusinessTable, MCPServer, Skill, Notification, NewsItem,
  MetricCard, Workspace, User, ID, Workflow, FileVersion, ChatArtifact,
  IMAttachment, IMTopic, IMHandoffPackage,
} from '@/lib/types'
import { seedUser } from '@/data/seed'
import { runtimeApi } from '@/lib/runtime-api'

const PLAN_UNAVAILABLE = '计划服务未就绪'

// 文件历史保留上限。超出后丢弃最旧的(FIFO)。
export const MAX_FILE_VERSIONS = 20

// =======================================================
//                  Stage Manager 侧栏系统
// =======================================================
//
// 每个工作台 item(早报 / 计划 / 文件 / AI / 数据 / MCP / Skills / 记忆 / 设置)
// 都是 SidePanelItem,处于 4 状态之一:
//   closed - 不在 UI
//   tab    - 缩略图,占约 80px 宽,在 IM 左侧堆叠
//   half   - 半展开(60% width),peeking
//   full   - 全展开(用户设定 width),可拖拽
//
// 同一时间 full 最多 1 个(舞台),half 不限,tab 是默认态。
//
// 现存 drawers(ai/file/data)先保留兼容,但今后都用 setPanel 走 sidePanel。

export type PanelState = 'closed' | 'tab' | 'half' | 'full'

export type FloatingBox = {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  title?: string
}

export type FloatingKey = string

export function isAppFloatingKey(key: string): boolean {
  return key.startsWith('app:')
}

export function appIdFromFloatingKey(key: string): string | null {
  return isAppFloatingKey(key) ? key.slice(4) : null
}

export function toAppFloatingKey(appId: string): string {
  return `app:${appId}`
}

export interface SidePanelItem {
  id: string
  // 显示用
  label: string
  icon: string // lucide icon name
  emoji: string
  accent: string // tailwind color token
  // 状态和宽度
  state: PanelState
  width: number // px (full 时的目标宽度)
  // 提示
  pinned?: boolean // 默认钉住(早报常用半展)
  badge?: number // 红点未读数
  dirty?: boolean // 有改动未保存
  // 内容组件 key,StageModal 通过这个知道渲染谁
  view: 'im' | 'briefing' | 'plan' | 'files' | 'data' | 'mcp' | 'skills' | 'memory' | 'settings'
}

export const KEYWORD_TRIGGERS: {
  pattern: RegExp
  panel?: SidePanelItem['view']
  table?: string
  reply: string
}[] = [
  { pattern: /订单|order/i, panel: 'data', table: 'bt_orders', reply: '已为你打开业务应用中的「订单」数据视图；写入操作会先生成可审计的执行计划。' },
  { pattern: /客户|customer/i, panel: 'data', table: 'bt_customers', reply: '已展开业务应用中的「客户」数据视图，可继续查看操作记录和回退状态。' },
  { pattern: /产品|sku|库存/i, panel: 'data', table: 'bt_products', reply: '已展开业务应用中的「产品」数据视图，可继续创建查询或变更计划。' },
  { pattern: /合同/i, panel: 'data', table: 'bt_customers', reply: '已打开业务应用并定位到客户数据视图，可继续筛选合同相关记录。' },
  { pattern: /财务|收入|营收/i, panel: 'data', table: 'bt_orders', reply: '已打开业务应用的订单数据视图；聚合结果与外部系统记录会区分权威来源。' },
  { pattern: /^@ai\b|问\s?ai|问助手/i, reply: 'AI 已在主工作区。拟回、摘要等可直接在左侧继续处理。' },
  { pattern: /打开文件|查看文件|文件/i, panel: 'files', reply: '已为你打开文件面板,可搜索/预览/编辑。' },
  { pattern: /早报|今日|morning briefing/i, panel: 'briefing', reply: '早报面板已展开。' },
  { pattern: /任务|日程|计划|待办|工作流/i, panel: 'plan', reply: '已为你打开「计划」面板(待办/日程/工作流 三 Tab)。' },
]

interface UIState {
  activeWorkspaceId: ID
  setActiveWorkspace: (id: ID) => void
  activeChatId: ID | null
  setActiveChat: (id: ID | null) => void
  activeAiSessionId: string | null
  setActiveAiSessionId: (id: string | null) => void
  aiComposerDrafts: Record<ID, string>
  setAIComposerDraft: (chatId: ID, text: string) => void
  aiInboxDraft: string
  setAiInboxDraft: (text: string) => void
  imMuted: boolean
  setIMMuted: (v: boolean) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // ===== Stage Manager 侧栏 =====
  panels: SidePanelItem[]
  setPanelState: (id: string, state: PanelState) => void
  setPanelWidth: (id: string, w: number) => void
  togglePanel: (id: string, to?: PanelState) => void // 默认 full
  closePanel: (id: string) => void
  setPanelBadge: (id: string, badge: number | undefined) => void
  setPanelDirty: (id: string, dirty: boolean | undefined) => void

  // ===== 撕出浮窗(独立可拖拽、可缩放、不占侧栏; 每模块一窗，每个创建的应用也可各有一窗)=====
  floating: Partial<Record<FloatingKey, FloatingBox>>
  floatingZTop: number
  openFloating: (view: FloatingKey, opts?: { width?: number; height?: number; x?: number; y?: number; title?: string }) => void
  closeFloating: (view?: FloatingKey) => void
  dockFloating: (view?: FloatingKey) => void
  setFloatingBox: (view: FloatingKey, patch: Partial<Pick<FloatingBox, 'x' | 'y' | 'width' | 'height' | 'title'>>) => void
  focusFloating: (view: FloatingKey) => void
  filesBrowse: { workspaceId: string | null; parentId: string | null; selectedId: string | null }
  setFilesBrowse: (patch: Partial<AppState['filesBrowse']>) => void
  dataBrowse: { workspaceAppId: string | null }
  setDataBrowse: (patch: Partial<AppState['dataBrowse']>) => void
  memoryBrowse: { pane: string }
  setMemoryBrowse: (patch: Partial<AppState['memoryBrowse']>) => void

  // 当前激活(IM 联系人)
  activeThreadId: ID | null
  setActiveThread: (id: ID | null) => void
  openIMPanel: (threadId?: ID) => void
  imComposerDrafts: Record<ID, string>
  setIMComposerDraft: (threadId: ID, text: string) => void

  // AI 抽屉当前 Agent(null = 当前工作区还没有 Agent)
  activeAgentId: ID | null
  setActiveAgent: (id: ID) => void
  // 文件抽屉当前打开
  activeFileId: ID | null
  setActiveFile: (id: ID | null) => void
  // 业务数据抽屉当前表
  activeBusinessTable: ID | null
  setActiveBusinessTable: (id: ID | null) => void
  // 计划页面当前 Tab
  activePlanTab: 'todo' | 'schedule' | 'workflow'
  setActivePlanTab: (t: 'todo' | 'schedule' | 'workflow') => void
  // 业务应用内子视图（AI 浮现业务记录时自动切到 records）
  activeDataSubview: 'overview' | 'records' | 'operations'
  setActiveDataSubview: (v: 'overview' | 'records' | 'operations') => void
  focusBizRecordsPanel: () => void

  // 命令面板
  paletteOpen: boolean
  setPaletteOpen: (v: boolean) => void

  // 兼容旧 code:保留 drawers 接口,内部映射到 panels。
  drawers: Record<string, { visible: boolean; width: number }>
  setDrawerVisible: (k: string, v: boolean) => void
  toggleDrawer: (k: string) => void
  setDrawerWidth: (k: string, w: number) => void
}

interface State {
  user: User
  workspaces: Workspace[]
  addWorkspace: (workspace: Omit<Workspace, 'id' | 'createdAt'> & { id?: string }) => ID
  replaceWorkspaces: (workspaces: Workspace[]) => void
  updateWorkspace: (id: ID, patch: Partial<Omit<Workspace, 'id'>>) => void
  removeWorkspace: (id: ID) => boolean
  tasks: Task[]
  events: ScheduleEvent[]
  files: FileNode[]
  agents: Agent[]
  workflows: Workflow[]
  chats: ChatThread[]
  imContacts: IMContact[]
  imMessages: IMMessage[]
  imTopics: IMTopic[]
  businessTables: BusinessTable[]
  mcp: MCPServer[]
  skills: Skill[]
  notifications: Notification[]
  news: NewsItem[]
  metrics: MetricCard[]
  planServiceError: string | null
  selectedTaskId: ID | null
  hydratePlan: (workspaceId: ID) => Promise<void>
  selectTask: (id: ID | null) => void

  // tasks
  addTask: (t: Omit<Task, 'id' | 'createdAt'> & { sourceRef?: string }) => Promise<void>
  updateTask: (id: ID, patch: Partial<Task>) => Promise<void>
  removeTask: (id: ID) => Promise<void>
  cycleTaskStatus: (id: ID) => Promise<void>
  // events
  addEvent: (e: Omit<ScheduleEvent, 'id'>) => Promise<void>
  updateEvent: (id: ID, patch: Partial<ScheduleEvent>) => Promise<void>
  removeEvent: (id: ID) => Promise<void>
  // files
  addFile: (f: Omit<FileNode, 'id' | 'updatedAt'>) => void
  removeFile: (id: ID) => void
  toggleStar: (id: ID) => void
  // 保存文件:原地覆盖 content + 把旧版本压入 versionHistory(最多 20 条)
  saveFileContent: (id: ID, content: string, note?: string) => void
  // files
  rollbackToVersion: (fileId: ID, versionId: ID) => void
  // chats / agents
  sendMessage: (chatId: ID, msg: { role: 'user' | 'assistant' | 'system'; content: string; agentId?: ID }) => void
  newChat: (title: string, agentId: ID, opts?: { sourceThreadId?: ID }) => ID
  renameChat: (id: ID, title: string) => void
  toggleChatPinned: (id: ID) => void
  clearChat: (id: ID) => void
  removeChat: (id: ID) => void
  toggleAgent: (id: ID) => void
  addAgent: (a: Omit<Agent, 'id' | 'workspaceId'>) => ID
  updateAgent: (id: ID, patch: Partial<Agent>) => void
  removeAgent: (id: ID) => void
  // workflows
  toggleWorkflow: (id: ID) => Promise<void>
  addWorkflow: (w: Omit<Workflow, 'id' | 'createdAt'>) => Promise<void>
  removeWorkflow: (id: ID) => Promise<void>
  // im
  sendIM: (threadId: ID, text: string, opts?: { attachments?: IMAttachment[]; handoff?: IMHandoffPackage; topicId?: ID; replyToId?: ID; aiChatId?: ID }) => void
  updateIMContact: (id: ID, patch: Partial<IMContact>) => void
  addIMContact: (contact: Omit<IMContact, 'id'>) => ID
  removeIMContact: (id: ID) => void
  addIMTopic: (topic: Omit<IMTopic, 'id' | 'createdAt'>) => ID
  translateIMMessage: (id: ID) => void
  recallIMMessage: (id: ID) => boolean
  markIMRead: (threadId: ID) => void
  // 输入框关键词解析,返回助手回复文本(已自动触发了抽屉/表)
  parseIMInput: (text: string) => string
  // business tables
  addRow: (tableId: ID, row: Record<string, string | number>) => void
  updateRow: (tableId: ID, rowId: ID, patch: Record<string, string | number>) => void
  removeRow: (tableId: ID, rowId: ID) => void
  // MCP / skills
  toggleMCP: (id: ID) => void
  toggleSkill: (id: ID) => void
  // notifications
  markNotifRead: (id: ID) => void
  markAllNotifRead: () => void
  // utility
  resetDemo: () => void
}

export type AppState = State & UIState

const uid = (p = 'x') => `${p}_${Math.random().toString(36).slice(2, 9)}`
const now = () => new Date().toISOString()

function mockTranslation(text: string): string {
  const pairs: Array<[RegExp, string]> = [
    [/scene#39 我先看了下,整体方向对的 👍/i, "I've reviewed scene #39. The overall direction looks right. 👍"],
    [/顺的。我有个点 — 早起应该默认关 IM\?/i, 'It works well. One question: should IM be muted by default in the morning?'],
    [/评审资料我先发你,你看下是否要提前看/i, "I'll send you the review materials first. See if you want to go through them in advance."],
  ]
  return pairs.find(([pattern]) => pattern.test(text))?.[1]
    ?? `English: ${text.replace(/[，。]/g, ' ').replace(/：/g, ': ')}`
}

// ---- 默认侧栏 items (右侧吸附工作台面板) ----
const defaultPanels = (): SidePanelItem[] => [
  { id: 'im',       label: 'IM',     icon: 'MessageCircleMore', emoji: '💬', accent: 'bg-slate-700',  state: 'closed', width: 560, badge: 0, view: 'im' },
  { id: 'briefing', label: '早报',   icon: 'Newspaper',     emoji: '🌅', accent: 'bg-amber-500',  state: 'tab',   width: 560, pinned: true, view: 'briefing' },
  { id: 'plan',     label: '计划',   icon: 'ClipboardList', emoji: '📋', accent: 'bg-blue-500',   state: 'closed', width: 600, view: 'plan' },
  { id: 'files',    label: '文件',   icon: 'Folder',        emoji: '📁', accent: 'bg-emerald-500', state: 'closed', width: 580, view: 'files' },
  { id: 'data',     label: '业务应用', icon: 'Database',      emoji: '🗃️', accent: 'bg-cyan-500',   state: 'closed', width: 760, view: 'data' },
  { id: 'mcp',      label: 'MCP',    icon: 'Plug',          emoji: '🔌', accent: 'bg-rose-500',   state: 'closed', width: 520, view: 'mcp' },
  { id: 'skills',   label: 'Skills', icon: 'Wand2',         emoji: '🪄', accent: 'bg-indigo-500', state: 'closed', width: 520, view: 'skills' },
  { id: 'memory',   label: '记忆',   icon: 'Brain',         emoji: '🧠', accent: 'bg-fuchsia-500', state: 'closed', width: 800, view: 'memory' },
  { id: 'settings', label: '设置',   icon: 'Settings',      emoji: '⚙️', accent: 'bg-slate-500',  state: 'closed', width: 520, view: 'settings' },
]

// 兼容老 drawers 接口(转换到 panels)
const defaultDrawers = (): Record<string, { visible: boolean; width: number }> => ({
  ai: { visible: false, width: 420 },
  file: { visible: false, width: 520 },
  data: { visible: false, width: 520 },
  search: { visible: false, width: 520 },
})

const buildInitial = () => ({
  user: seedUser,
  workspaces: [],
  tasks: [],
  events: [],
  files: [],
  agents: [],
  workflows: [],
  chats: [],
  imContacts: [],
  imMessages: [],
  imTopics: [],
  businessTables: [],
  mcp: [],
  skills: [],
  notifications: [],
  news: [],
  metrics: [],
})

// 找 panel by view key
const findPanelByView = (panels: SidePanelItem[], view: SidePanelItem['view']) =>
  panels.find((p) => p.view === view)

// 浮窗 z-index 单调递增,保证最近点击永远在最上层
const FLOATING_BASE_Z = 60

function maxFloatingZ(floating: Partial<Record<FloatingKey, FloatingBox>>, zTop: number): number {
  const peaks = Object.values(floating).map((b) => b?.zIndex ?? 0)
  return Math.max(zTop, FLOATING_BASE_Z, ...peaks)
}

function nextZ(state: Pick<AppState, 'floating' | 'floatingZTop'>): number {
  return maxFloatingZ(state.floating, state.floatingZTop) + 1
}

export function getTopFloatingView(
  floating: Partial<Record<FloatingKey, FloatingBox>>,
): FloatingKey | null {
  let top: FloatingKey | null = null
  let max = -1
  for (const [view, box] of Object.entries(floating) as [FloatingKey, FloatingBox | undefined][]) {
    if (box && box.zIndex > max) {
      max = box.zIndex
      top = view
    }
  }
  return top
}

function omitFloating(
  floating: Partial<Record<FloatingKey, FloatingBox>>,
  view: FloatingKey,
): Partial<Record<FloatingKey, FloatingBox>> {
  if (!floating[view]) return floating
  const next = { ...floating }
  delete next[view]
  return next
}

function withPanelFull(panels: SidePanelItem[], id: string): SidePanelItem[] {
  return panels.map((p) => {
    if (p.id === id) return { ...p, state: 'full' as const }
    if (p.state === 'full' || p.state === 'half') return { ...p, state: 'tab' as const }
    return p
  })
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...buildInitial(),
      // ====== UI 初始 ======
      activeWorkspaceId: '',
      // 切工作区:清掉 ws 内的"当前选择",避免指向另一个 ws 的对象。
      // activeAgentId 重置为目标工作区的第一个运行中 Agent(旧值 'a_main' 在别的 ws 不存在)。
      setActiveWorkspace: (id) => {
        set((s) => {
          if (!s.workspaces.some((w) => w.id === id)) return {}
          const wsAgents = s.agents.filter((a) => a.workspaceId === id)
          const nextAgent =
            wsAgents.find((a) => a.status === 'active')?.id ?? wsAgents[0]?.id ?? null
          return {
            activeWorkspaceId: id,
            activeChatId: null,
            activeAiSessionId: null,
            activeFileId: null,
            activeAgentId: nextAgent,
            selectedTaskId: null,
          }
        })
        void get().hydratePlan(id)
      },
      replaceWorkspaces: (workspaces) =>
        set((s) => {
          if (!workspaces.length) return {}
          const byCwd = new Map(s.workspaces.filter((row) => row.cwd).map((row) => [row.cwd as string, row]))
          const byId = new Map(s.workspaces.map((row) => [row.id, row]))
          const merged = workspaces.map((item) => {
            const prev = (item.cwd && byCwd.get(item.cwd)) || byId.get(item.id)
            return prev
              ? { ...prev, ...item, name: item.name || prev.name, emoji: prev.emoji || item.emoji, color: prev.color || item.color }
              : item
          })
          const seen = new Set(merged.map((row) => row.id))
          const seenCwd = new Set(merged.map((row) => row.cwd).filter(Boolean))
          const extras = s.workspaces.filter((row) => !seen.has(row.id) && !(row.cwd && seenCwd.has(row.cwd)))
          const next = [...merged, ...extras]
          const keep = next.some((row) => row.id === s.activeWorkspaceId) ? s.activeWorkspaceId : next[0].id
          return { workspaces: next, activeWorkspaceId: keep }
        }),
      addWorkspace: (workspace) => {
        const id = workspace.id || uid('ws')
        set((s) => ({
          workspaces: s.workspaces.some((row) => row.id === id || (workspace.cwd && row.cwd === workspace.cwd))
            ? s.workspaces.map((row) => (row.id === id || (workspace.cwd && row.cwd === workspace.cwd)) ? { ...row, ...workspace, id } : row)
            : [...s.workspaces, { ...workspace, id, createdAt: now() }],
          // 新工作区带一个根目录，文件模块打开后不会是空白。
          files: [...s.files, {
            id: uid('froot'), name: workspace.name, kind: 'folder', size: 0,
            updatedAt: now(), parentId: null, workspaceId: id,
          }],
        }))
        return id
      },
      updateWorkspace: (id, patch) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        })),
      removeWorkspace: (id) => {
        const state = get()
        if (state.workspaces.length <= 1 || !state.workspaces.some((w) => w.id === id)) return false
        const nextWorkspace = state.workspaces.find((w) => w.id !== id)!
        const nextAgents = state.agents.filter((a) => a.workspaceId === nextWorkspace.id)
        const nextAgent = nextAgents.find((a) => a.status === 'active')?.id ?? nextAgents[0]?.id ?? null
        set((s) => ({
          workspaces: s.workspaces.filter((w) => w.id !== id),
          files: s.files.filter((f) => f.workspaceId !== id),
          agents: s.agents.filter((a) => a.workspaceId !== id),
          chats: s.chats.filter((c) => c.workspaceId !== id),
          workflows: s.workflows.filter((w) => w.workspaceId !== id),
          activeWorkspaceId: s.activeWorkspaceId === id ? nextWorkspace.id : s.activeWorkspaceId,
          activeChatId: s.activeWorkspaceId === id ? null : s.activeChatId,
          activeAiSessionId: s.activeWorkspaceId === id ? null : s.activeAiSessionId,
          activeFileId: s.activeWorkspaceId === id ? null : s.activeFileId,
          activeAgentId: s.activeWorkspaceId === id ? nextAgent : s.activeAgentId,
        }))
        return true
      },
      activeChatId: 'c1',
      setActiveChat: (id) => set({ activeChatId: id }),
      activeAiSessionId: null,
      setActiveAiSessionId: (id) => set({ activeAiSessionId: id }),
      aiComposerDrafts: {},
      setAIComposerDraft: (chatId, text) =>
        set((s) => ({ aiComposerDrafts: { ...s.aiComposerDrafts, [chatId]: text }, activeChatId: chatId })),
      aiInboxDraft: '',
      setAiInboxDraft: (text) => set({ aiInboxDraft: text }),
      imMuted: true,
      setIMMuted: (v) => set({ imMuted: v }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // ===== Stage Manager =====
      panels: defaultPanels(),
      // 任何时候只有一个面板能占舞台。切到 full 时,把其他所有非 closed 的面板全退回 tab。
      setPanelState: (id, state) =>
        set((s) => ({
          panels: s.panels.map((p) => {
            if (p.id === id) return { ...p, state }
            if (state === 'full' && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
            return p
          }),
        })),
      setPanelWidth: (id, w) =>
        set((s) => ({
          panels: s.panels.map((p) => (p.id === id ? { ...p, width: Math.max(360, Math.min(1280, w)) } : p)),
        })),
      togglePanel: (id, to = 'full') =>
        set((s) => ({
          panels: s.panels.map((p) => {
            if (p.id === id) return { ...p, state: to }
            // 切到 full 时,把其他非 closed 全退到 tab(强制单舞台)
            if (to === 'full' && (p.state === 'full' || p.state === 'half')) return { ...p, state: 'tab' }
            return p
          }),
          // 如果该面板已撕出为浮窗,切回嵌入态时应关闭浮窗,避免重叠
          floating: omitFloating(s.floating, id as SidePanelItem['view']),
        })),
      closePanel: (id) =>
        set((s) => ({
          panels: s.panels.map((p) => (p.id === id ? { ...p, state: 'closed' } : p)),
          floating: omitFloating(s.floating, id as SidePanelItem['view']),
        })),
      setPanelBadge: (id, badge) =>
        set((s) => ({ panels: s.panels.map((p) => (p.id === id ? { ...p, badge } : p)) })),
      setPanelDirty: (id, dirty) =>
        set((s) => ({ panels: s.panels.map((p) => (p.id === id ? { ...p, dirty } : p)) })),

      // ===== 撕出浮窗 =====
      floating: {},
      floatingZTop: FLOATING_BASE_Z,
      openFloating: (view, opts) => {
        const w = opts?.width ?? 720
        const h = opts?.height ?? 560
        const offset = (Math.random() * 60) | 0
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
        const vh = typeof window !== 'undefined' ? window.innerHeight - 40 : 800
        const x = opts?.x ?? Math.max(40, Math.round((vw - w) / 2) + offset - 30)
        const y = opts?.y ?? Math.max(40, Math.round((vh - h) / 2) + offset - 30)
        set((s) => {
          const existing = s.floating[view]
          if (existing) {
            const z = nextZ(s)
            return {
              floating: {
                ...s.floating,
                [view]: {
                  ...existing,
                  ...(opts?.x != null ? { x: opts.x } : {}),
                  ...(opts?.y != null ? { y: opts.y } : {}),
                  ...(opts?.width != null ? { width: opts.width } : {}),
                  ...(opts?.height != null ? { height: opts.height } : {}),
                  ...(opts?.title != null ? { title: opts.title } : {}),
                  zIndex: z,
                },
              },
              floatingZTop: z,
            }
          }
          const z = nextZ(s)
          return {
            floating: {
              ...s.floating,
              [view]: { x, y, width: w, height: h, zIndex: z, ...(opts?.title ? { title: opts.title } : {}) },
            },
            floatingZTop: z,
          }
        })
      },
      closeFloating: (view) =>
        set((s) => {
          const target = view ?? getTopFloatingView(s.floating)
          if (!target || !s.floating[target]) return {}
          return { floating: omitFloating(s.floating, target) }
        }),
      dockFloating: (view) => {
        set((s) => {
          const target = view ?? getTopFloatingView(s.floating)
          if (!target || !s.floating[target]) return {}
          const appId = appIdFromFloatingKey(target)
          const floating = omitFloating(s.floating, target)
          if (appId) {
            const dataPanel = s.panels.find((p) => p.id === 'data')
            const already = dataPanel?.state === 'full' || dataPanel?.state === 'half'
            return {
              floating,
              dataBrowse: { ...s.dataBrowse, workspaceAppId: appId },
              activeDataSubview: 'overview' as const,
              ...(already ? {} : { panels: withPanelFull(s.panels, 'data') }),
            }
          }
          const panel = s.panels.find((p) => p.id === target || p.view === target)
          const already = panel?.state === 'full' || panel?.state === 'half'
          if (already) return { floating }
          return { floating, panels: withPanelFull(s.panels, panel?.id ?? target) }
        })
      },
      setFloatingBox: (view, patch) =>
        set((s) => {
          const box = s.floating[view]
          if (!box) return {}
          return { floating: { ...s.floating, [view]: { ...box, ...patch } } }
        }),
      focusFloating: (view) =>
        set((s) => {
          const box = s.floating[view]
          if (!box) return {}
          const z = nextZ(s)
          return {
            floating: { ...s.floating, [view]: { ...box, zIndex: z } },
            floatingZTop: z,
          }
        }),
      filesBrowse: { workspaceId: null, parentId: null, selectedId: null },
      setFilesBrowse: (patch) =>
        set((s) => ({ filesBrowse: { ...s.filesBrowse, ...patch } })),
      dataBrowse: { workspaceAppId: null },
      setDataBrowse: (patch) =>
        set((s) => ({ dataBrowse: { ...s.dataBrowse, ...patch } })),
      memoryBrowse: { pane: 'home' },
      setMemoryBrowse: (patch) =>
        set((s) => ({ memoryBrowse: { ...s.memoryBrowse, ...patch } })),

      activeThreadId: 'im1',
      setActiveThread: (id) => set({ activeThreadId: id }),
      openIMPanel: (threadId) => {
        if (threadId) set({ activeThreadId: threadId })
        get().togglePanel('im', 'full')
      },
      imComposerDrafts: {},
      setIMComposerDraft: (threadId, text) =>
        set((s) => ({ imComposerDrafts: { ...s.imComposerDrafts, [threadId]: text } })),

      activeAgentId: 'a_main',
      setActiveAgent: (id) => set({ activeAgentId: id }),
      activeFileId: null,
      setActiveFile: (id) => set({ activeFileId: id }),
      activeBusinessTable: 'bt_orders',
      setActiveBusinessTable: (id) => set({ activeBusinessTable: id }),
      activePlanTab: 'todo',
      setActivePlanTab: (t) => set({ activePlanTab: t }),
      activeDataSubview: 'overview',
      setActiveDataSubview: (v) => set({ activeDataSubview: v }),
      focusBizRecordsPanel: () => {
        set((s) => {
          if (s.floating.data) {
            const z = nextZ(s)
            return {
              activeDataSubview: 'records',
              floating: {
                ...s.floating,
                data: { ...s.floating.data, zIndex: z },
              },
              floatingZTop: z,
            }
          }
          return {
            activeDataSubview: 'records',
            panels: s.panels.map((p) => {
              if (p.id === 'data') return { ...p, state: 'full' }
              if (p.state === 'full' || p.state === 'half') return { ...p, state: 'tab' }
              return p
            }),
            floating: omitFloating(s.floating, 'data'),
          }
        })
      },

      paletteOpen: false,
      setPaletteOpen: (v) => set({ paletteOpen: v }),

      // ===== 抽屉兼容层 =====
      drawers: defaultDrawers(),
      setDrawerVisible: (k, v) => {
        // 把老接口映射到 panels
        const viewMap: Record<string, SidePanelItem['view']> = { file: 'files', data: 'data', search: 'files' }
        const view = viewMap[k]
        if (view) {
          get().togglePanel(view, v ? 'full' : 'closed')
        }
        set((s) => ({ drawers: { ...s.drawers, [k]: { ...s.drawers[k], visible: v } } }))
      },
      toggleDrawer: (k) => {
        const viewMap: Record<string, SidePanelItem['view']> = { file: 'files', data: 'data' }
        const view = viewMap[k]
        if (view) {
          const cur = get().panels.find((p) => p.view === view)
          get().togglePanel(view, cur?.state === 'full' ? 'closed' : 'full')
        }
        set((s) => ({ drawers: { ...s.drawers, [k]: { ...s.drawers[k], visible: !s.drawers[k].visible } } }))
      },
      setDrawerWidth: (k, w) => {
        const viewMap: Record<string, SidePanelItem['view']> = { file: 'files', data: 'data' }
        const view = viewMap[k]
        if (view) get().setPanelWidth(view, w)
        set((s) => ({ drawers: { ...s.drawers, [k]: { ...s.drawers[k], width: w } } }))
      },

      planServiceError: null,
      selectedTaskId: null,
      selectTask: (id) => set({ selectedTaskId: id }),
      hydratePlan: async (workspaceId) => {
        const ws = get().workspaces.find((w) => w.id === workspaceId)
        if (!ws) return
        try {
          await runtimeApi.ensureWorkspace({ id: workspaceId, name: ws.name, description: ws.desc })
          const from = Date.now() - 366 * 24 * 60 * 60 * 1000
          const to = Date.now() + 366 * 24 * 60 * 60 * 1000
          const [tasks, events, workflows] = await Promise.all([
            runtimeApi.listTasks(workspaceId),
            runtimeApi.listEvents(workspaceId, from, to),
            runtimeApi.listWorkflows(workspaceId),
          ])
          set({ tasks, events, workflows, planServiceError: null })
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
        }
      },

      // ===== Data mutations =====
      addTask: async (t) => {
        const workspaceId = get().activeWorkspaceId
        if (!workspaceId) return
        try {
          const created = await runtimeApi.createTask({
            workspaceId,
            title: t.title,
            priority: t.priority,
            dueAt: t.due,
            tags: t.tags,
            sourceRef: t.sourceRef,
            status: t.status,
          })
          set((s) => ({ tasks: [created, ...s.tasks], planServiceError: null }))
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
          throw new Error(PLAN_UNAVAILABLE)
        }
      },
      updateTask: async (id, patch) => {
        try {
          const updated = await runtimeApi.updateTask(id, {
            title: patch.title,
            notes: patch.notes,
            status: patch.status,
            priority: patch.priority,
            dueAt: patch.due === undefined ? undefined : patch.due || null,
            tags: patch.tags,
          })
          set((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? updated : x)), planServiceError: null }))
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
          throw new Error(PLAN_UNAVAILABLE)
        }
      },
      removeTask: async (id) => {
        try {
          await runtimeApi.deleteTask(id)
          set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id), planServiceError: null }))
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
          throw new Error(PLAN_UNAVAILABLE)
        }
      },
      cycleTaskStatus: async (id) => {
        const task = get().tasks.find((x) => x.id === id)
        if (!task) return
        const order: Task['status'][] = ['todo', 'doing', 'done', 'archived']
        const next = order[(order.indexOf(task.status) + 1) % order.length]
        await get().updateTask(id, { status: next })
      },

      addEvent: async (e) => {
        const workspaceId = get().activeWorkspaceId
        if (!workspaceId) return
        try {
          const created = await runtimeApi.createEvent({
            workspaceId,
            title: e.title,
            startAt: e.start,
            endAt: e.end,
            kind: e.kind,
            location: e.location,
          })
          set((s) => ({ events: [...s.events, created], planServiceError: null }))
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
          throw new Error(PLAN_UNAVAILABLE)
        }
      },
      updateEvent: async (id, patch) => {
        try {
          const updated = await runtimeApi.updateEvent(id, {
            title: patch.title,
            startAt: patch.start,
            endAt: patch.end,
            kind: patch.kind,
            location: patch.location === undefined ? undefined : patch.location || null,
          })
          set((s) => ({ events: s.events.map((x) => (x.id === id ? updated : x)), planServiceError: null }))
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
          throw new Error(PLAN_UNAVAILABLE)
        }
      },
      removeEvent: async (id) => {
        try {
          await runtimeApi.deleteEvent(id)
          set((s) => ({ events: s.events.filter((x) => x.id !== id), planServiceError: null }))
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
          throw new Error(PLAN_UNAVAILABLE)
        }
      },

      addFile: (f) => set((s) => ({ files: [{ ...f, id: uid('f'), updatedAt: now(), workspaceId: s.activeWorkspaceId }, ...s.files] })),
      removeFile: (id) => set((s) => ({
        files: s.files.filter((x) => x.id !== id),
        activeFileId: s.activeFileId === id ? null : s.activeFileId,
      })),
      toggleStar: (id) =>
        set((s) => ({ files: s.files.map((x) => (x.id === id ? { ...x, starred: !x.starred } : x)) })),

      // 保存:原地覆盖 + 版本历史。版本保留上限 MAX_FILE_VERSIONS,FIFO。
      saveFileContent: (id, content, note) =>
        set((s) => {
          const target = s.files.find((f) => f.id === id)
          if (!target) return {}
          const ts = now()
          const history = target.versionHistory ?? []
          const ver: FileVersion = {
            id: uid('fv'),
            ts: target.updatedAt,
            content: target.content ?? '',
            size: target.size,
            note,
          }
          const newHistory = [ver, ...history].slice(0, MAX_FILE_VERSIONS)
          return {
            files: s.files.map((f) =>
              f.id === id
                ? { ...f, content, updatedAt: ts, size: content.length, versionHistory: newHistory, dirty: true }
                : f,
            ),
          }
        }),
      // 回滚:把指定版本设为当前,并把当前版本作为新历史项追加
      rollbackToVersion: (fileId, versionId) =>
        set((s) => {
          const target = s.files.find((f) => f.id === fileId)
          if (!target) return {}
          const ver = (target.versionHistory ?? []).find((v) => v.id === versionId)
          if (!ver) return {}
          const ts = now()
          const nowVer: FileVersion = {
            id: uid('fv'),
            ts: target.updatedAt,
            content: target.content ?? '',
            size: target.size,
            note: `已回滚到 ${ver.ts}`,
          }
          const newHistory = [nowVer, ...(target.versionHistory ?? []).filter((v) => v.id !== versionId)]
            .slice(0, MAX_FILE_VERSIONS)
          return {
            files: s.files.map((f) =>
              f.id === fileId
                ? { ...f, content: ver.content, updatedAt: ts, size: ver.content.length, versionHistory: newHistory }
                : f,
            ),
          }
        }),

      sendMessage: (chatId, msg) => {
        const userMsg: ChatThread['messages'][number] = {
          id: uid('m'),
          role: msg.role,
          content: msg.content,
          ts: now(),
        }
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId ? { ...c, messages: [...c.messages, userMsg], updatedAt: now() } : c,
          ),
        }))
        const reply = mockAssistantReply(msg.content, get().agents, msg.agentId ?? get().activeAgentId ?? undefined)
        setTimeout(() => {
          set((s) => ({
            chats: s.chats.map((c) =>
              c.id === chatId
                ? {
                    ...c,
                    messages: [
                      ...c.messages,
                      { id: uid('m'), role: 'assistant', content: reply.content, ts: now(), artifacts: reply.artifacts },
                    ],
                    updatedAt: now(),
                  }
                : c,
            ),
          }))
        }, 600)
      },
      newChat: (title, agentId, opts) => {
        const id = uid('c')
        set((s) => ({
          chats: [
            ...s.chats,
            {
              id,
              title,
              agentId,
              messages: [],
              updatedAt: now(),
              workspaceId: s.activeWorkspaceId,
              sourceThreadId: opts?.sourceThreadId,
            },
          ],
          activeChatId: id,
        }))
        return id
      },
      renameChat: (id, title) =>
        set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, title } : c)) })),
      toggleChatPinned: (id) =>
        set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) })),
      clearChat: (id) =>
        set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, messages: [], updatedAt: now() } : c)) })),
      removeChat: (id) =>
        set((s) => {
          const target = s.chats.find((c) => c.id === id)
          const remainingChats = s.chats.filter((c) => c.id !== id)
          const sameWorkspace = remainingChats.filter((c) => c.workspaceId === (target?.workspaceId ?? s.activeWorkspaceId))
          const nextChatId = [...sameWorkspace].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt))[0]?.id ?? null
          return {
            chats: remainingChats,
            activeChatId: s.activeChatId === id ? nextChatId : s.activeChatId,
          }
        }),
      toggleAgent: (id) =>
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a)),
        })),
      addAgent: (a) => {
        const id = uid('ag')
        set((s) => ({ agents: [...s.agents, { ...a, id, workspaceId: s.activeWorkspaceId }] }))
        return id
      },
      updateAgent: (id, patch) =>
        set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      removeAgent: (id) =>
        set((s) => {
          const removed = s.agents.find((a) => a.id === id)
          const remainingAgents = s.agents.filter((a) => a.id !== id)
          const remainingChats = s.chats.filter((c) => c.agentId !== id)
          const sameWorkspaceAgents = remainingAgents.filter(
            (a) => a.workspaceId === (removed?.workspaceId ?? s.activeWorkspaceId),
          )
          const nextAgentId =
            sameWorkspaceAgents.find((a) => a.status === 'active')?.id ??
            sameWorkspaceAgents[0]?.id ??
            null

          return {
            agents: remainingAgents,
            chats: remainingChats,
            activeAgentId: s.activeAgentId === id ? nextAgentId : s.activeAgentId,
            activeChatId: s.activeChatId && remainingChats.some((c) => c.id === s.activeChatId)
              ? s.activeChatId
              : null,
          }
        }),

      toggleWorkflow: async (id) => {
        const wf = get().workflows.find((w) => w.id === id)
        if (!wf) return
        const status = wf.status === 'active' ? 'paused' : 'active'
        try {
          const updated = await runtimeApi.updateWorkflow(id, { status })
          set((s) => ({
            workflows: s.workflows.map((w) => (w.id === id ? updated : w)),
            planServiceError: null,
          }))
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
          throw new Error(PLAN_UNAVAILABLE)
        }
      },
      addWorkflow: async (w) => {
        const workspaceId = get().activeWorkspaceId
        if (!workspaceId) return
        try {
          const created = await runtimeApi.createWorkflow({
            workspaceId,
            name: w.name,
            description: w.description,
            status: w.status,
            trigger: w.trigger,
            steps: w.steps,
            category: w.category,
            emoji: w.emoji,
          })
          set((s) => ({ workflows: [created, ...s.workflows], planServiceError: null }))
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
          throw new Error(PLAN_UNAVAILABLE)
        }
      },
      removeWorkflow: async (id) => {
        try {
          await runtimeApi.deleteWorkflow(id)
          set((s) => ({ workflows: s.workflows.filter((w) => w.id !== id), planServiceError: null }))
        } catch {
          set({ planServiceError: PLAN_UNAVAILABLE })
          throw new Error(PLAN_UNAVAILABLE)
        }
      },

      sendIM: (threadId, text, opts) =>
        set((s) => ({
          imMessages: [
            ...s.imMessages,
            {
              id: uid('mm'), threadId, authorId: 'u_self', text, ts: now(), read: true,
              attachments: opts?.attachments, handoff: opts?.handoff, topicId: opts?.topicId,
              replyToId: opts?.replyToId, aiChatId: opts?.aiChatId,
            },
          ],
        })),
      updateIMContact: (id, patch) =>
        set((s) => ({ imContacts: s.imContacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      addIMContact: (contact) => {
        const id = uid(contact.kind === 'topic-group' ? 'img' : 'im')
        set((s) => ({ imContacts: [...s.imContacts, { ...contact, id }] }))
        return id
      },
      removeIMContact: (id) =>
        set((s) => ({
          imContacts: s.imContacts.filter((c) => c.id !== id),
          imMessages: s.imMessages.filter((m) => m.threadId !== id),
          imTopics: s.imTopics.filter((t) => t.groupId !== id),
          activeThreadId: s.activeThreadId === id ? s.imContacts.find((c) => c.id !== id)?.id ?? null : s.activeThreadId,
        })),
      addIMTopic: (topic) => {
        const id = uid('topic')
        set((s) => ({ imTopics: [...s.imTopics, { ...topic, id, createdAt: now() }] }))
        return id
      },
      translateIMMessage: (id) =>
        set((s) => ({
          imMessages: s.imMessages.map((m) => m.id === id
            ? { ...m, translation: mockTranslation(m.text) }
            : m),
        })),
      recallIMMessage: (id) => {
        const target = get().imMessages.find((m) => m.id === id)
        if (!target || target.authorId !== 'u_self' || Date.now() - new Date(target.ts).getTime() > 15000) return false
        set((s) => ({ imMessages: s.imMessages.map((m) => m.id === id ? { ...m, text: '', attachments: undefined, handoff: undefined, recalledAt: now() } : m) }))
        return true
      },
      markIMRead: (threadId) =>
        set((s) => ({
          imMessages: s.imMessages.map((m) => (m.threadId === threadId ? { ...m, read: true } : m)),
        })),

      parseIMInput: (text) => {
        const trimmed = text.trim()
        if (!trimmed) return ''
        const hit = KEYWORD_TRIGGERS.find((t) => t.pattern.test(trimmed))
        if (hit) {
          if (hit.panel) {
            get().togglePanel(hit.panel, 'full')
          }
          if (hit.table) set({ activeBusinessTable: hit.table })
          return hit.reply
        }
        if (/^(hi|hello|你好|嗨|在吗)/i.test(trimmed)) {
          return '在的。需要查数据、拟回或打开文件，直接点输入栏按钮，或说"看下 Q3 订单"。'
        }
        return `收到:"${trimmed.slice(0, 40)}"。要查订单/客户/产品，直接告诉我；要拟回/摘要，点输入栏按钮。`
      },

      addRow: (tableId, row) =>
        set((s) => ({
          businessTables: s.businessTables.map((t) =>
            t.id === tableId ? { ...t, rows: [{ ...row, id: uid('r') }, ...t.rows] } : t,
          ),
        })),
      updateRow: (tableId, rowId, patch) =>
        set((s) => ({
          businessTables: s.businessTables.map((t) =>
            t.id === tableId
              ? { ...t, rows: t.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) }
              : t,
          ),
        })),
      removeRow: (tableId, rowId) =>
        set((s) => ({
          businessTables: s.businessTables.map((t) =>
            t.id === tableId ? { ...t, rows: t.rows.filter((r) => r.id !== rowId) } : t,
          ),
        })),

      toggleMCP: (id) =>
        set((s) => ({
          mcp: s.mcp.map((m) =>
            m.id === id
              ? { ...m, status: m.status === 'connected' ? 'disconnected' : 'connected' }
              : m,
          ),
        })),
      toggleSkill: (id) =>
        set((s) => ({ skills: s.skills.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k)) })),

      markNotifRead: (id) =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotifRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      resetDemo: () =>
        set(() => ({ ...buildInitial(), panels: defaultPanels(), drawers: defaultDrawers(), activeAiSessionId: null })),
    }),
    {
      name: 'scene-39-workstation',
      storage: createJSONStorage(() => localStorage),
      version: 17,
      partialize: (state) => ({
        panels: state.panels,
        drawers: state.drawers,
        floating: state.floating,
        floatingZTop: state.floatingZTop,
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
        imMuted: state.imMuted,
        imComposerDrafts: state.imComposerDrafts,
        aiComposerDrafts: state.aiComposerDrafts,
        activeAiSessionId: state.activeAiSessionId,
      }),
      // 升级映射:
      //   v3 → v4 重置面板默认宽度(640→560 等,避免旧宽度把 IM 挤窄)
      //   v4 → v5 给所有"工作区域"对象打 ws_personal 标签(兼容旧 seed 无 workspaceId)
      //   v5 → v6 给 Agent 补 skillIds,给演示会话补产物卡片,文件树补 web/ppt
      //   v6 → v7 IM 联系人/话题群显式建模,补话题和输入草稿状态
      //   v7 → v8 修复曾被空数组持久化的联系人/群数据,补 AI 输入草稿
      //   v8 → v9 AI-first:旧的全屏面板退到缩略图,进入应用时不再遮住 AI 主屏
      //   v9 → v10 AI 固定为主工作区,移除旧 AI 面板并新增右侧 IM 功能面板
      migrate: (persisted: any, from) => {
        if (!persisted) return persisted
        if (from < 13) {
          delete persisted.chats
          delete persisted.mcp
          delete persisted.skills
          delete persisted.memory
          delete persisted.notifications
          delete persisted.imContacts
          delete persisted.imMessages
          delete persisted.imTopics
          delete persisted.businessTables
          delete persisted.tasks
          delete persisted.events
          delete persisted.files
          delete persisted.agents
          delete persisted.workflows
          delete persisted.news
          delete persisted.metrics
        }
        if (from < 4) persisted.panels = defaultPanels()
        if (!persisted.panels) persisted.panels = defaultPanels()
        if (!persisted.drawers) persisted.drawers = defaultDrawers()
        if (from < 7) {
          persisted.imComposerDrafts = persisted.imComposerDrafts ?? {}
          delete persisted.imAIRequest
        }
        if (from < 8) {
          persisted.aiComposerDrafts = persisted.aiComposerDrafts ?? {}
        }
        if (from < 9) {
          persisted.panels = (persisted.panels ?? defaultPanels()).map((panel: SidePanelItem) => ({
            ...panel,
            state: panel.state === 'full' || panel.state === 'half' ? 'tab' : panel.state,
          }))
        }
        if (from < 10) {
          const current = (persisted.panels ?? []).filter((panel: SidePanelItem) => panel.id !== 'ai' && panel.view !== ('ai' as any))
          const imPanel = defaultPanels().find((panel) => panel.id === 'im')!
          persisted.panels = current.some((panel: SidePanelItem) => panel.id === 'im') ? current : [imPanel, ...current]
          if (persisted.floating?.panelId === 'ai') persisted.floating = null
        }
        if (from < 17) {
          const raw = persisted.floating
          if (raw && typeof raw === 'object' && 'panelId' in raw) {
            const { panelId, ...box } = raw as { panelId: SidePanelItem['view']; x: number; y: number; width: number; height: number; zIndex: number }
            if ((panelId as string) !== 'ai') persisted.floating = { [panelId]: box }
            else persisted.floating = {}
            persisted.floatingZTop = box.zIndex ?? FLOATING_BASE_Z
          } else if (!raw || raw === null) {
            persisted.floating = {}
          }
          if (typeof persisted.floatingZTop !== 'number') {
            const vals = Object.values(persisted.floating ?? {}) as FloatingBox[]
            persisted.floatingZTop = vals.length ? Math.max(...vals.map((b) => b.zIndex)) : FLOATING_BASE_Z
          }
        }
        if (from < 15) {
          persisted.panels = (persisted.panels ?? defaultPanels()).map((panel: SidePanelItem) => (
            panel.id === 'memory' ? { ...panel, width: Math.max(Number(panel.width) || 0, 800) } : panel
          ))
        }
        if (from < 16) persisted.activeAiSessionId = persisted.activeAiSessionId || null
        return persisted
      },
    },
  ),
)

// =======================================================
//  Workspace-aware selector hooks
//  用法:把页面里 useApp(s => s.agents) 换成 useCurrentAgents(),
//  自动按 activeWorkspaceId 过滤。用 useShallow 包装避免新数组引用触发无限循环。
// =======================================================

export function useCurrentWorkspace() {
  return useApp((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? s.workspaces[0])
}
export function useWorkspaces() {
  return useApp((s) => s.workspaces)
}
export function useCurrentAgents(): Agent[] {
  return useApp(useShallow((s) => s.agents.filter((a) => a.workspaceId === s.activeWorkspaceId)))
}
export function useCurrentChats(): ChatThread[] {
  return useApp(useShallow((s) => s.chats.filter((c) => c.workspaceId === s.activeWorkspaceId)))
}
export function useCurrentFiles(): FileNode[] {
  return useApp(useShallow((s) => s.files.filter((f) => f.workspaceId === s.activeWorkspaceId)))
}
export function useCurrentWorkflows(): Workflow[] {
  return useApp(useShallow((s) => s.workflows.filter((w) => w.workspaceId === s.activeWorkspaceId)))
}
export function useCurrentTasks(): Task[] {
  return useApp(useShallow((s) => s.tasks))
}

function mockAssistantReply(prompt: string, agents: Agent[], agentId?: ID): { content: string; artifacts?: ChatArtifact[] } {
  const p = prompt.toLowerCase()
  const agent = agents.find((a) => a.id === agentId)
  const who = agent ? `${agent.emoji} ${agent.name}` : '主助手'
  if (prompt.includes('【拟回】')) {
    return { content: `【拟回草案】\n\n收到，这块我先按你说的方向推进，今天把结论同步你。有阻塞我第一时间提。\n\n（点 IM 输入栏「采纳」可直接发到会话）` }
  }
  if (prompt.includes('【采纳】')) {
    return { content: `[${who}] 已记录。这条回复已经发到 IM，需要再改一版随时说。` }
  }
  if (prompt.includes('【先例】')) {
    return { content: `[${who}] 先例参考：\n1. 同类沟通通常先确认范围，再给时间点。\n2. 口径上避免承诺未评审的排期。\n3. 可引用记忆：上次复盘会纪要里的「先关阻塞项」。` }
  }
  if (prompt.includes('【交接】')) {
    return { content: `[${who}] 交接说明\n· 背景：当前 IM 会话需跟进\n· 现状：双方已对齐方向，细节待确认\n· 待办：回消息、补材料、同步结论\n· 风险：若今日未回复可能错过窗口\n· 建议回复：先确认收到，再给下一步时间。` }
  }
  if (prompt.includes('【问本机】')) {
    return { content: `[${who}] 本机相关资料：\n· 文件：Q4 计划.md、评审资料\n· 记忆：本周优先级与阻塞项\n· 数据：订单/客户表可从右侧数据面板打开\n如需我打开某一份，直接说名字。` }
  }
  if (prompt.includes('【摘要】')) {
    return { content: `[${who}] 对话摘要：\n1. 共识：方向已对齐\n2. 待办：回消息、补材料\n3. 阻塞：暂无明确阻塞\n4. 下一步：今日内给出结论。` }
  }
  if (p.includes('海报') || p.includes('poster')) {
    return {
      content: `[${who}] 海报已生成。点卡片可直接预览，再点「在文件面板打开」可继续编辑。`,
      artifacts: [{ id: uid('art'), kind: 'poster', title: 'scene39 发布海报', subtitle: '900 × 1200 · PNG', fileId: 'f_poster', preview: 'https://placehold.co/900x1200/1F3A2E/F4E9C8?text=FDE-X' }],
    }
  }
  if (p.includes('网页') || p.includes('落地页') || p.includes('web')) {
    return {
      content: `[${who}] 落地页已经写成 HTML，可在会话内嵌预览。`,
      artifacts: [{ id: uid('art'), kind: 'web', title: '工作台落地页', subtitle: 'HTML · 可直接预览', fileId: 'f_web' }],
    }
  }
  if (p.includes('看板') || p.includes('dashboard')) {
    return {
      content: `[${who}] 经营看板已生成，点击即可全屏预览。`,
      artifacts: [{ id: uid('art'), kind: 'dashboard', title: 'Q3 经营看板', subtitle: '收入 / DAU / NPS', fileId: 'f_dash' }],
    }
  }
  if (p.includes('ppt') || p.includes('路演') || p.includes('幻灯')) {
    return {
      content: `[${who}] PPT 大纲已转成 3 页演示稿，可翻页预览。`,
      artifacts: [{ id: uid('art'), kind: 'ppt', title: 'scene39 路演', subtitle: '3 页 · PPT', fileId: 'f_ppt' }],
    }
  }
  if (p.includes('图片') || p.includes('配图')) {
    return {
      content: `[${who}] 已生成一张配图，可点开查看大图。`,
      artifacts: [{ id: uid('art'), kind: 'image', title: '架构图 v2', subtitle: 'PNG', fileId: 'f4', preview: 'https://placehold.co/800x500/E7F0E9/2F6B3A?text=Architecture+v2' }],
    }
  }
  if (p.includes('总结') || p.includes('复盘')) {
    return { content: `[${who}] 整理今日:\n1. 关键产出 3 项\n2. 阻塞/风险:无\n3. 明日优先级:延续主线。` }
  }
  if (p.includes('计划') || p.includes('排期')) {
    return { content: `[${who}] 主线任务已排序: 紧急 → 高 → 中,详见任务页。` }
  }
  if (p.includes('风险')) {
    return { content: `[${who}] 当前 1 项紧急任务 + 1 项合同续签提醒。先关这两件。` }
  }
  if (p.includes('数据') || p.includes('指标')) {
    return { content: `[${who}] 本月关键指标(来自 DataBuddy mock):DAU 12.4k (+8.2%)、留存 42% (+2pp)、收入 ¥84.2w (+6.4%)。` }
  }
  if (/订单|客户|产品/.test(prompt)) {
    return { content: `[${who}] 已在右侧为你展开对应业务数据表。` }
  }
  return { content: `[${who}] 收到:"${prompt.slice(0, 40)}"。已记到当前会话,稍后给结构化反馈。` }
}
