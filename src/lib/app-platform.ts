import {
  declaredPlatformUses,
  specHasUse,
  type FdeAppSpec,
  type FdePlatformUse,
} from '@/lib/app-spec'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { runtimeApi, type MemoryDraftCard } from '@/lib/runtime-api'
import { toAppFloatingKey, useApp } from '@/store/app'

export { declaredPlatformUses, specHasUse }

const LABELS: Record<FdePlatformUse, string> = {
  ai: '问 AI',
  float: '浮窗',
  files: '引用文件',
  memory: '起草记忆卡片',
  im: '拟回进输入框',
  briefing: '打开早报',
  biz: '打开业务记录',
}

export function platformUseLabel(use: FdePlatformUse): string {
  return LABELS[use]
}

type FilePickWaiter = { resolve: (path: string) => void }

let pendingFilePick: FilePickWaiter | null = null

export function isFilePickPending(): boolean {
  return Boolean(pendingFilePick)
}

export function requestFilePick(): Promise<string> {
  if (pendingFilePick) pendingFilePick.resolve('')
  return new Promise((resolve) => {
    pendingFilePick = {
      resolve: (path) => {
        pendingFilePick = null
        resolve(path)
      },
    }
  })
}

export function consumeFilePick(path: string): boolean {
  if (!pendingFilePick) return false
  const waiter = pendingFilePick
  pendingFilePick = null
  waiter.resolve(path)
  return true
}

export type BizPreviewIntent = {
  kind?: string
  action?: string
  map?: Record<string, unknown>
  rowId?: string
}

export function isBizPreviewStep(data: unknown): data is { step: 'preview'; intents: BizPreviewIntent[] } {
  if (!data || typeof data !== 'object') return false
  const row = data as { step?: string; intents?: unknown }
  return row.step === 'preview' && Array.isArray(row.intents)
}

function firstPeerId(mailbox: Record<string, unknown>): string {
  const bags = [mailbox.catalog, mailbox.conversations, mailbox.requests, mailbox.peers]
  for (const bag of bags) {
    if (!Array.isArray(bag) || !bag.length) continue
    const row = bag[0]
    if (!row || typeof row !== 'object') continue
    const id = String((row as { id?: string; peerId?: string }).id || (row as { peerId?: string }).peerId || '')
    if (id) return id
  }
  return ''
}

function openFilesModule(selectedId?: string) {
  const state = useApp.getState()
  const cwd = loadCurrentWorkspaceCwd()
  const href = String(selectedId || '').replace(/^file:\/\//i, '')
  const parent = href.includes('/') ? href.split('/').slice(0, -1).join('/') || '.' : '.'
  state.setFilesBrowse({
    workspaceId: cwd.ok ? cwd.workspaceId : state.activeWorkspaceId,
    parentId: href ? parent : '.',
    selectedId: href || null,
  })
  if (href) state.setActiveFile(href)
  state.togglePanel('files', 'full')
}

async function draftImReply(spec: FdeAppSpec): Promise<string> {
  const text = [
    `${spec.name}`,
    spec.description || '',
    '这条只放进输入框。请人过目后点发送，不要自动群发。',
  ].filter(Boolean).join('\n')
  const mailbox = await runtimeApi.imState().catch(() => ({} as Record<string, unknown>))
  const state = useApp.getState()
  const peerId = firstPeerId(mailbox) || String(state.activeThreadId || 'im1')
  state.openIMPanel(peerId)
  state.setIMComposerDraft(peerId, text)
  await new Promise((resolve) => window.setTimeout(resolve, 50))
  const live = useApp.getState()
  const threadId = String(live.activeThreadId || peerId)
  live.setIMComposerDraft(threadId, text)
  window.dispatchEvent(new CustomEvent('fde-x-im-fill', { detail: { threadId, text } }))
  await runtimeApi.imCompose({ text, peerId: threadId }).catch(() => undefined)
  return '已放进 IM 输入框，点发送才会发出'
}

export async function startBizPreviews(intents: BizPreviewIntent[]): Promise<string> {
  const first = intents.find((row) => row && row.kind && row.action)
  if (!first?.kind || !first?.action) {
    throw new Error('没有可预览的业务动作')
  }
  const map = first.map && typeof first.map === 'object' && !Array.isArray(first.map) ? first.map : {}
  await runtimeApi.bizPreview({
    kind: first.kind,
    action: first.action,
    speech: `${first.action}${first.kind}`,
    ...map,
  })
  useApp.getState().focusBizRecordsPanel()
  return '已打开业务预览，确认后才写入'
}

export async function lookupBizKind(kind: string): Promise<string> {
  const name = String(kind || '').trim()
  if (!name) throw new Error('没有业务型')
  await runtimeApi.bizPreview({
    kind: name,
    action: '现查',
    speech: `现查${name}`,
  })
  useApp.getState().focusBizRecordsPanel()
  return '已现查业务记录，写外部仍要预览确认'
}

export type DeclaredPlatformUseResult = string | MemoryDraftCard

export function isMemoryDraftCard(value: DeclaredPlatformUseResult): value is MemoryDraftCard {
  return Boolean(value && typeof value === 'object' && 'id' in value && 'body' in value)
}

export async function runDeclaredPlatformUse(
  use: FdePlatformUse,
  spec: FdeAppSpec,
  appId?: string,
): Promise<DeclaredPlatformUseResult> {
  const state = useApp.getState()
  if (use === 'ai') {
    const cwd = loadCurrentWorkspaceCwd()
    if (!cwd.ok) throw new Error(cwd.error)
    const created = await runtimeApi.createAiSession({ cwd: cwd.cwd })
    const title = `${spec.name} · 问`
    await runtimeApi.renameAiSession(created.sessionId, title).catch(() => undefined)
    state.setActiveAiSessionId(created.sessionId)
    if (state.sidebarCollapsed) state.toggleSidebar()
    window.dispatchEvent(new CustomEvent('fde-x-ai-open', {
      detail: { sessionId: created.sessionId, title },
    }))
    await runtimeApi.promptAi(created.sessionId, {
      text: `我正在用应用「${spec.name}」。${spec.description || ''}请根据这个应用里已有的记录帮我。不要写外部业务系统。`,
    })
    return '已打开 AI 会话'
  }
  if (use === 'float') {
    const id = String(appId || '').trim()
    if (!id) throw new Error('没有可撕出的应用')
    const width = Math.min(1180, Math.max(420, Math.round(window.innerWidth * 0.82)))
    const height = Math.min(820, Math.max(360, Math.round(window.innerHeight * 0.84)))
    const existing = Object.keys(state.floating).filter((key) => key.startsWith('app:')).length
    const offset = existing * 28
    state.openFloating(toAppFloatingKey(id), {
      width,
      height,
      x: Math.max(16, Math.round((window.innerWidth - width) / 2) + offset),
      y: Math.max(16, Math.round((window.innerHeight - height) / 2) + offset),
      title: spec.name,
    })
    return '已打开浮窗'
  }
  if (use === 'files') {
    openFilesModule()
    return '已打开文件模块，应用只留引用'
  }
  if (use === 'memory') {
    const card = await runtimeApi.draftMemoryCard(
      `${spec.name}\n${spec.description || ''}\n应用动作只起草卡片，等人点头才入档。`,
      'choice',
    )
    return card
  }
  if (use === 'im') {
    return draftImReply(spec)
  }
  if (use === 'briefing') {
    state.togglePanel('briefing', 'full')
    return '已打开早报'
  }
  if (use === 'biz') {
    state.focusBizRecordsPanel()
    return '已打开业务记录。写外部要预览确认。'
  }
  throw new Error('未知能力')
}

export function openFilesAtPath(path: string) {
  openFilesModule(path)
}
