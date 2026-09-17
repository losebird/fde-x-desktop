// IM 工作区：联系人/话题群、消息流、AI 协作输入区
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Search, Send, Paperclip, Plus, Command, ChevronsLeft, ChevronsRight,
  Smile, History, Settings2, Users, UserRound, BellOff, Pin, Trash2, X,
  Check, MessageSquareText, ListTodo, Languages, Forward, Brain,
  Sparkles, ChevronRight, ChevronDown, Play, Copy, MoreHorizontal, LoaderCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { useParams } from 'react-router-dom'
import { useApp } from '@/store/app'
import { runtimeApi } from '@/lib/runtime-api'
import { isPrimarySession, loadCurrentAiTarget, loadCurrentWorkspaceCwd, sessionMatchesCwd } from '@/lib/ai-target'
import { IM_AVATARS, imAvatar } from '@/lib/im-avatar'
import { buildImAiPrompt, extractComposerBody, isUnsafeToSend, lastIncomingText, threadExcerpt } from '@/lib/im-ai'
import type {
  ChatThread, FileNode, IMAIAction, IMAttachment, IMContact, IMHandoffPackage, IMMessage,
} from '@/lib/types'

function withdrawnOf(row: Record<string, unknown>, to: string, outgoing: boolean) {
  if (row.status === 'withdrawn' || row.withdrawn === true) return true
  const list = Array.isArray(row.withdrawn) ? row.withdrawn.map(String) : []
  if (!list.length) return false
  return outgoing ? list.includes(to) : true
}

function ImFace({ avatar, name, size = 36, group = false }: { avatar?: string; name?: string; size?: number; group?: boolean }) {
  const face = imAvatar(avatar)
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: face.color, fontSize: Math.max(12, size * 0.42) }}
      title={name}
    >
      {group ? <Users size={Math.max(12, size * 0.4)} className="text-white" /> : face.emoji}
    </div>
  )
}

const AI_ACTIONS: { id: IMAIAction; label: string; hint: string }[] = [
  { id: 'draft', label: '拟回', hint: '按对面来信起草回复，写好后放进输入框，不自动发送' },
  { id: 'adopt', label: '采纳', hint: '把来信交给左边干活，结论放进输入框，不自动发送' },
  { id: 'precedent', label: '先例', hint: '先查当时口径，再给可改的建议' },
  { id: 'handoff', label: '交接', hint: '选择会话和文件，生成交接包' },
  { id: 'local', label: '问本机', hint: '本机作答，不寄给对方' },
  { id: 'summary', label: '摘要', hint: '本机归纳这场对话，不寄给对方' },
]
const EMOJIS = ['👍', '👌', '🙏', '✅', '🎉', '😅', '😂', '🤔', '📌', '📎']

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/25 flex items-center justify-center p-4" onClick={onClose}>
      <div className={clsx('w-full max-h-[86vh] overflow-hidden bg-white border border-line rounded-xl shadow-2xl flex flex-col', wide ? 'max-w-3xl' : 'max-w-lg')} onClick={(event) => event.stopPropagation()}>
        <div className="h-12 px-4 border-b border-line flex items-center justify-between shrink-0">
          <div className="text-sm font-semibold">{title}</div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-2 text-ink-muted"><X size={15} /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function fileIcon(kind: FileNode['kind']) {
  return kind === 'image' ? '🖼️' : kind === 'folder' ? '📁' : kind === 'sheet' ? '📊' : kind === 'ppt' ? '📽️' : kind === 'web' ? '🌐' : '📄'
}

function kindFromName(name: string): FileNode['kind'] {
  const lower = name.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'sheet'
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif') || lower.endsWith('.svg')) return 'image'
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'web'
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'ppt'
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'doc'
  if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a')) return 'audio'
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.py') || lower.endsWith('.css')) return 'code'
  return 'doc'
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('读不出这个文件'))
    reader.readAsDataURL(file)
  })
}

function mimeFromName(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.md')) return 'text/markdown'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html'
  if (lower.endsWith('.csv')) return 'text/csv'
  return 'application/octet-stream'
}

const EMPTY_CONTACTS: IMContact[] = []
const SKIP_DIRS = new Set(['node_modules', '.git'])
const HANDOFF_MIME = 'application/vnd.dsh.handoff+json'
const HANDOFF_NAME = 'dsh-handoff.json'

function isHandoffAttach(item: Record<string, unknown>) {
  return String(item.mime || '') === HANDOFF_MIME || String(item.name || '') === HANDOFF_NAME
}

function utf8ToB64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function packHandoffAttach(pkg: IMHandoffPackage, cwd: string) {
  const workspace = cwd.split('/').filter(Boolean).at(-1) || cwd || pkg.sourceWorkspaceId
  const turns = pkg.transcript?.length ? pkg.transcript : []
  const pack = {
    v: 2,
    kind: 'handoff',
    title: pkg.title,
    workspace,
    at: Date.now(),
    sessionIds: pkg.sourceChatIds,
    sessions: pkg.sessions || [],
    fileIds: pkg.fileIds,
    turns,
    excerpt: String((turns.at(-1)?.text || pkg.summary || pkg.title)).slice(0, 240),
    truncated: false,
  }
  const json = JSON.stringify(pack)
  return {
    name: HANDOFF_NAME,
    mime: HANDOFF_MIME,
    size: new TextEncoder().encode(json).length,
    data: utf8ToB64(json),
  }
}

function parseHandoffPack(raw: string) {
  let text = String(raw || '').trim()
  if (!text) return null
  if (text[0] !== '{') {
    try {
      const bin = atob(text.replace(/\s/g, ''))
      text = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)))
    } catch {
      return null
    }
  }
  try {
    const obj = JSON.parse(text) as Record<string, unknown>
    if (!obj || obj.kind !== 'handoff') return null
    return obj
  } catch {
    return null
  }
}

function handoffSessionsFromPack(parsed: Record<string, unknown> | null): IMHandoffPackage['sessions'] | undefined {
  if (!parsed || !Array.isArray(parsed.sessions)) return undefined
  return parsed.sessions as IMHandoffPackage['sessions']
}

function handoffSessionIdsFromPack(parsed: Record<string, unknown> | null): string[] {
  if (!parsed || !Array.isArray(parsed.sessionIds)) return []
  return parsed.sessionIds.map((item) => String(item)).filter(Boolean)
}

function isHandoffSummaryText(text: string) {
  return String(text || '').trimStart().startsWith('交接概述')
}

function rowHandoffFlagTrue(value: unknown) {
  return value === true || value === 'true' || value === 1
}

function mergeHandoffPackages(
  next?: IMHandoffPackage,
  prev?: IMHandoffPackage,
): IMHandoffPackage | undefined {
  if (!next && !prev) return undefined
  if (!next) return prev
  if (!prev) return next
  const sessions = next.sessions?.length ? next.sessions : prev.sessions
  const sourceChatIds = next.sourceChatIds?.length ? next.sourceChatIds : prev.sourceChatIds
  const sessionsLoading = sessions?.length
    ? false
    : (next.sessionsLoading ?? prev.sessionsLoading)
  return {
    ...prev,
    ...next,
    ...(sessions ? { sessions } : {}),
    ...(sourceChatIds?.length ? { sourceChatIds } : {}),
    ...(sessionsLoading ? { sessionsLoading: true } : { sessionsLoading: false }),
  }
}

function buildThreadHandoff(input: {
  row: Record<string, unknown>
  threadId: string
  text: string
  rawAttach: Array<Record<string, unknown>>
  files: IMAttachment[]
  created: number
}): IMHandoffPackage | undefined {
  const { row, threadId, text, rawAttach, files, created } = input
  const packedAttach = rawAttach.find((item) => isHandoffAttach(item))
  const handoffAttachIndex = rawAttach.findIndex((item) => isHandoffAttach(item))
  const hasPack = Boolean(packedAttach) || rowHandoffFlagTrue(row.handoff) || isHandoffSummaryText(text)
  if (!hasPack && !(row.handoff && typeof row.handoff === 'object')) return undefined
  const parsedPack = packedAttach && typeof packedAttach.data === 'string' && packedAttach.data
    ? parseHandoffPack(String(packedAttach.data))
    : null
  const packSessions = handoffSessionsFromPack(parsedPack)
  const packSessionIds = handoffSessionIdsFromPack(parsedPack)
  const packTitle = parsedPack && typeof parsedPack.title === 'string' && parsedPack.title.trim()
    ? String(parsedPack.title).trim()
    : '工作交接'
  const needsLazySessions = !packSessions?.length && (Boolean(packedAttach) || rowHandoffFlagTrue(row.handoff) || isHandoffSummaryText(text))
  return {
    id: `${row.id || threadId}-handoff`,
    title: packTitle,
    summary: text,
    sourceWorkspaceId: String(row.workspace || parsedPack?.workspace || ''),
    sourceChatIds: packSessionIds,
    fileIds: files.filter((item) => item.name !== HANDOFF_NAME).map((item) => item.fileId),
    ...(packSessions?.length ? { sessions: packSessions } : {}),
    ...(handoffAttachIndex >= 0 ? { attachIndex: handoffAttachIndex } : {}),
    ...(needsLazySessions ? { sessionsLoading: false } : {}),
    createdAt: created ? new Date(created).toISOString() : new Date().toISOString(),
    status: 'sent',
  }
}

function handoffPackSessionLine(pkg: IMHandoffPackage) {
  if (pkg.sessionsLoading && !pkg.sessions?.length) return '正在读取会话文件…'
  const files = handoffSessionFiles(pkg)
  if (!files.length) return '0 个会话文件'
  const kb = files.reduce((sum, file) => sum + Number(file.size || 0), 0)
  return `${files.length} 个会话文件 · ${Math.max(1, Math.round(kb / 1024))} KB`
}

function handoffAttachIndices(message: IMMessage): number[] {
  const preferred = message.handoff?.attachIndex
  const out: number[] = []
  if (typeof preferred === 'number' && preferred >= 0) out.push(preferred)
  for (let index = 0; index < 12; index += 1) {
    if (!out.includes(index)) out.push(index)
  }
  return out
}

function messageBody(message: IMMessage) {
  const text = String(message.text || '').trim()
  if (text && text !== '（附件）' && !/^附件\s+/u.test(text)) return text
  if (message.handoff?.summary) return String(message.handoff.summary).trim()
  const names = (message.attachments || []).map((item) => item.name).filter(Boolean)
  if (names.length) return names.join('、')
  return text
}

function speakSessionFileError(cause: unknown) {
  const msg = cause instanceof Error ? cause.message : String(cause || '读不出会话文件')
  if (/404|not_found|接口不存在/i.test(msg)) return '本地核心还是旧进程，导不出会话文件。请重载核心后再预览、再放入输入区。'
  return msg
}

function handoffSessionFiles(pkg: IMHandoffPackage) {
  return (pkg.sessions || []).flatMap((row) => (row.files || []).map((file) => ({
    sessionId: row.sessionId,
    sessionTitle: row.title || row.sessionId,
    name: file.name,
    size: Number(file.size || 0),
  })))
}

function handoffSessionCount(pkg: IMHandoffPackage) {
  if (pkg.sessions?.length) return pkg.sessions.length
  if (pkg.sourceChatIds?.length) return pkg.sourceChatIds.length
  const line = String(pkg.summary || '').split('\n').find((row) => row.startsWith('Agent 会话：'))
  const names = line ? line.slice('Agent 会话：'.length).trim() : ''
  if (!names || names === '未选会话') return 0
  return names.split('、').map((item) => item.trim()).filter(Boolean).length
}

async function listWorkspaceFlat(): Promise<FileNode[]> {
  const target = await loadCurrentAiTarget()
  if (!target.ok) throw new Error(target.error)
  const out: FileNode[] = []
  const now = new Date().toISOString()
  const walk = async (dir: string, depth: number) => {
    if (depth > 8 || out.length >= 2000) return
    const listing = await runtimeApi.listWorkspaceFiles({ sessionId: target.sessionId, cwd: target.cwd, path: dir })
    const parentId = dir === '.' ? null : dir
    const kids = [...(listing.entries || [])].sort((a, b) => {
      const ad = a.type === 'directory' ? 0 : 1
      const bd = b.type === 'directory' ? 0 : 1
      if (ad !== bd) return ad - bd
      return a.name.localeCompare(b.name)
    })
    for (const entry of kids) {
      if (!entry.name || SKIP_DIRS.has(entry.name)) continue
      const path = dir === '.' ? entry.name : `${dir.replace(/\/$/, '')}/${entry.name}`
      if (entry.type === 'directory') {
        out.push({ id: path, name: entry.name, kind: 'folder', size: 0, parentId, updatedAt: now })
        await walk(path, depth + 1)
        continue
      }
      if (entry.type !== 'file') continue
      out.push({
        id: path,
        name: entry.name,
        kind: kindFromName(entry.name),
        size: Number(entry.size || 0),
        parentId,
        updatedAt: now,
      })
    }
  }
  await walk('.', 0)
  return out
}

function WorkspaceFileTree({
  files, selectedIds, onToggle, note,
}: {
  files: FileNode[]
  selectedIds: string[]
  onToggle: (file: FileNode) => void
  note?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const query = q.trim().toLowerCase()
  const byId = useMemo(() => new Map(files.map((row) => [row.id, row])), [files])
  const byParent = useMemo(() => {
    const map = new Map<string | null, FileNode[]>()
    for (const row of files) {
      const key = row.parentId
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return map
  }, [files])
  const matchIds = useMemo(() => {
    if (!query) return null
    const hits = new Set<string>()
    for (const row of files) {
      if (row.kind === 'folder') continue
      if (!row.name.toLowerCase().includes(query) && !row.id.toLowerCase().includes(query)) continue
      hits.add(row.id)
      let parent = row.parentId
      while (parent) {
        hits.add(parent)
        parent = byId.get(parent)?.parentId ?? null
      }
    }
    return hits
  }, [files, query, byId])

  useEffect(() => {
    const roots = (byParent.get(null) ?? []).filter((row) => row.kind === 'folder').map((row) => row.id)
    if (!query) {
      setOpen(new Set(roots))
      return
    }
    setOpen(new Set([...matchIds ?? []].filter((id) => byId.get(id)?.kind === 'folder')))
  }, [query, matchIds, byParent, byId])

  const toggleOpen = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderNode = (node: FileNode, depth: number): ReactNode => {
    if (matchIds && !matchIds.has(node.id)) return null
    const pad = { paddingLeft: 8 + depth * 14 }
    if (node.kind === 'folder') {
      const expanded = open.has(node.id)
      const kids = byParent.get(node.id) ?? []
      return (
        <div key={node.id}>
          <button type="button" className="w-full flex items-center gap-1 py-1 pr-2 rounded hover:bg-surface-2 text-xs text-left" style={pad} onClick={() => toggleOpen(node.id)}>
            {expanded ? <ChevronDown size={12} className="shrink-0 text-ink-subtle" /> : <ChevronRight size={12} className="shrink-0 text-ink-subtle" />}
            <span>📁</span>
            <span className="truncate">{node.name}</span>
          </button>
          {expanded && kids.map((kid) => renderNode(kid, depth + 1))}
        </div>
      )
    }
    const checked = selectedIds.includes(node.id)
    return (
      <label key={node.id} className="flex items-center gap-2 py-1 pr-2 rounded hover:bg-surface-2 text-xs cursor-pointer" style={pad}>
        <span className="w-3 shrink-0" />
        <input type="checkbox" checked={checked} onChange={() => onToggle(node)} />
        <span>{fileIcon(node.kind)}</span>
        <span className="truncate" title={node.id}>{node.name}</span>
      </label>
    )
  }

  const roots = byParent.get(null) ?? []
  const shown = query ? (matchIds?.size ?? 0) : files.filter((row) => row.kind !== 'folder').length

  return (
    <div>
      <div className="relative mb-2">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索文件名或路径" className="input w-full pl-8 text-sm h-8" />
      </div>
      <div className="max-h-56 overflow-y-auto border border-line rounded p-1">
        {roots.map((node) => renderNode(node, 0))}
        {!shown && <div className="p-4 text-center text-xs text-ink-subtle">{note || (query ? '没有匹配的文件' : '这个工作区没有文件')}</div>}
      </div>
    </div>
  )
}

export function IMWorkspace({ compact = false }: { compact?: boolean }) {
  const params = useParams<{ threadId?: string }>()
  const [liveContacts, setLiveContacts] = useState<IMContact[] | null>(null)
  const [liveMessages, setLiveMessages] = useState<IMMessage[] | null>(null)
  const [doorPort, setDoorPort] = useState('')
  const [pairCode, setPairCode] = useState('')
  const [pairHint, setPairHint] = useState('')
  const [pairAsk, setPairAsk] = useState<{ fromName: string; door: string } | null>(null)
  const [pairWait, setPairWait] = useState('')
  const [pairBusy, setPairBusy] = useState(false)
  const [aiHint, setAiHint] = useState('')
  const [imBanner, setImBanner] = useState<{ kind: 'working' | 'ok' | 'err'; text: string } | null>(null)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [selfName, setSelfName] = useState('本机')
  const [selfAvatar, setSelfAvatar] = useState('leaf')
  const [selfId, setSelfId] = useState('u_self')
  const contacts = liveContacts ?? EMPTY_CONTACTS
  const contactsRef = useRef<IMContact[]>([])
  const markedReadRef = useRef(new Set<string>())
  const pendingPresendRef = useRef<{ id: string; threadId: string; text: string } | null>(null)
  const seenPresendIdRef = useRef('')
  const handoffSessionsFetchRef = useRef(new Set<string>())
  const openContactRef = useRef<IMContact | undefined>(undefined)
  const messages = liveMessages ?? []
  const topics = useApp((s) => s.imTopics)
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId)
  const composerDrafts = useApp((s) => s.imComposerDrafts)
  const markIMRead = useApp((s) => s.markIMRead)

  const setActiveThread = useApp((s) => s.setActiveThread)
  const activeThreadId = useApp((s) => s.activeThreadId)
  const [wsFiles, setWsFiles] = useState<FileNode[]>([])
  const [filesNote, setFilesNote] = useState('')

  useEffect(() => {
    if (params.threadId && params.threadId !== activeThreadId) setActiveThread(params.threadId)
  }, [params.threadId, activeThreadId, setActiveThread])

  useEffect(() => {
    const needsSessions = (row: IMMessage) => {
      if (row.handoff?.sessions?.length) return false
      if (row.handoff) return true
      return isHandoffSummaryText(row.text || '')
    }
    for (const message of messages.filter(needsSessions)) {
      if (handoffSessionsFetchRef.current.has(message.id)) continue
      handoffSessionsFetchRef.current.add(message.id)
      void (async () => {
        try {
          setLiveMessages((prev) => (prev ?? []).map((row) => {
            if (row.id !== message.id) return row
            const handoff = row.handoff || buildThreadHandoff({
              row: { id: row.id, handoff: true },
              threadId: row.threadId,
              text: row.text,
              rawAttach: [],
              files: row.attachments || [],
              created: new Date(row.ts).getTime(),
            })
            if (!handoff) return row
            return { ...row, handoff: { ...handoff, sessionsLoading: true } }
          }))
          for (const index of handoffAttachIndices(message)) {
            const got = await runtimeApi.imAttach(message.id, index).catch(() => null)
            const raw = got && typeof got.data === 'string' ? got.data : ''
            if (!raw) continue
            const parsed = parseHandoffPack(raw)
            const rows = handoffSessionsFromPack(parsed)
            if (!rows?.length) continue
            const sessionIds = handoffSessionIdsFromPack(parsed)
            setLiveMessages((prev) => (prev ?? []).map((row) => {
              if (row.id !== message.id) return row
              const base = row.handoff || buildThreadHandoff({
                row: { id: row.id, handoff: true },
                threadId: row.threadId,
                text: row.text,
                rawAttach: [],
                files: row.attachments || [],
                created: new Date(row.ts).getTime(),
              })
              if (!base) return row
              return {
                ...row,
                handoff: {
                  ...base,
                  sessions: rows,
                  sessionsLoading: false,
                  ...(sessionIds.length && !base.sourceChatIds.length ? { sourceChatIds: sessionIds } : {}),
                },
              }
            }))
            return
          }
          setLiveMessages((prev) => (prev ?? []).map((row) => (
            row.id === message.id && row.handoff && !row.handoff.sessions?.length
              ? { ...row, handoff: { ...row.handoff, sessionsLoading: false } }
              : row
          )))
        } finally {
          handoffSessionsFetchRef.current.delete(message.id)
        }
      })()
    }
  }, [messages])

  const applyMailbox = (data: Record<string, unknown>) => {
    const self = data.self && typeof data.self === 'object' ? data.self as Record<string, unknown> : null
    if (self) {
      if (self.id) setSelfId(String(self.id))
      if (self.displayName) setSelfName(String(self.displayName))
      if (self.avatar) setSelfAvatar(String(self.avatar))
    }
    const hasRoster = Array.isArray(data.peers)
    const peers = hasRoster ? data.peers as Array<Record<string, unknown>> : []
    const groups = Array.isArray(data.groups) ? data.groups as Array<Record<string, unknown>> : []
    const people = peers.filter((peer) => !peer.unpaired).map((peer) => {
      const kept = contactsRef.current.find((row) => row.id === String(peer.id || ''))?.avatar
      const face = imAvatar(String(peer.avatar || kept || ''))
      return {
        id: String(peer.id || ''),
        kind: 'contact' as const,
        name: String(peer.note || peer.displayName || peer.id || ''),
        displayName: String(peer.displayName || ''),
        handle: String(peer.door || peer.id || ''),
        avatarColor: face.color,
        avatar: face.id,
        online: Boolean(peer.online),
        pinned: Boolean(peer.pin),
        muted: Boolean(peer.mute),
        note: String(peer.note || ''),
        staffId: String(peer.staffId || ''),
      }
    })
    const rooms = groups.map((group) => {
      const members = Array.isArray(group.members) ? group.members.map((id) => String(id)) : []
      return {
        id: String(group.id || ''),
        kind: 'topic-group' as const,
        name: String(group.name || '话题群'),
        handle: `${members.length} 人`,
        avatarColor: '#1A1A1A',
        online: true,
        pinned: Boolean(group.pin),
        muted: Boolean(group.mute),
        memberIds: members,
      }
    })
    const nextContacts = [...people, ...rooms]
    if (hasRoster) {
      contactsRef.current = nextContacts
      setLiveContacts(nextContacts)
    }
    const requests = Array.isArray(data.requests) ? data.requests as Array<Record<string, unknown>> : []
    const me = String(self?.id || selfId)
    let latestPresend: { id: string; threadId: string; text: string } | null = null
    const mapped: IMMessage[] = []
    for (const row of requests) {
      const to = Array.isArray(row.to) ? String(row.to[0] || '') : ''
      const from = String(row.from || '')
      const outgoing = row.kind === 'outgoing'
      const groupId = String(row.groupId || '')
      const parentId = String(row.threadId || '')
      const created = Number(row.createdAt || row.updatedAt || 0)
      const threadId = groupId || (outgoing ? to : from)
      const text = String(row.body || row.excerpt || row.last || '')
      const rawAttach = Array.isArray(row.attachments) ? row.attachments as Array<Record<string, unknown>> : []
      let files = rawAttach.flatMap((item, index) => {
        if (isHandoffAttach(item)) return []
        const name = String(item.name || 'file')
        const mime = String(item.mime || '')
        return [{
          id: `${String(row.id || threadId)}::${index}`,
          fileId: String(item.fileId || name),
          name,
          kind: mime.startsWith('image/') ? 'image' as const : kindFromName(name),
          size: Number(item.size || 0),
          mime: mime || undefined,
        }]
      })
      if (!files.length) {
        const listed = text.match(/^附件\s+(.+)$/u)?.[1] || ''
        if (listed) {
          files = listed.split('、').map((name, index) => ({
            id: `${row.id || threadId}-att-${index}`,
            fileId: name.trim(),
            name: name.trim(),
            kind: kindFromName(name.trim()),
            size: 0,
            mime: undefined,
          })).filter((item) => item.name)
        }
      }
      const handoff = buildThreadHandoff({ row, threadId, text, rawAttach, files, created })
      if (outgoing && row.status === 'presend') {
        latestPresend = { id: String(row.id || ''), threadId, text }
        continue
      }
      mapped.push({
        id: String(row.id || ''),
        threadId,
        parentId,
        topic: Boolean(row.topic) || Boolean(groupId && !parentId),
        authorId: outgoing || from === me ? me : from,
        fromName: String(row.fromName || ''),
        text,
        ts: created ? new Date(created).toISOString() : new Date().toISOString(),
        read: markedReadRef.current.has(String(row.id || '')) || !row.unread,
        pending: row.status === 'queued' || row.status === 'retry',
        attachments: files.length ? files : undefined,
        handoff,
        recalledAt: withdrawnOf(row, to, outgoing)
          ? new Date(Number(row.updatedAt || created) || Date.now()).toISOString()
          : undefined,
      })
    }
    pendingPresendRef.current = latestPresend
    const fromThread = Array.isArray(data.conversations) || requests.some((row) => Object.prototype.hasOwnProperty.call(row, 'body'))
    setLiveMessages((prev) => {
      const byId = new Map((prev ?? []).map((row) => [row.id, row]))
      if (fromThread) {
        const threads = new Set(mapped.map((row) => row.threadId))
        for (const row of prev ?? []) {
          if (threads.has(row.threadId) && !mapped.some((item) => item.id === row.id)) byId.delete(row.id)
        }
      }
      for (const row of mapped) {
        const old = byId.get(row.id)
        if (!old) {
          byId.set(row.id, row)
          continue
        }
        byId.set(row.id, {
          ...old,
          ...row,
          text: old.attachments?.length && !row.attachments?.length && (row.text === '（附件）' || /^附件\s+/u.test(row.text))
            ? old.text
            : (row.text.length >= old.text.length ? row.text : old.text),
          attachments: row.attachments?.length ? row.attachments : old.attachments,
          handoff: mergeHandoffPackages(row.handoff, old.handoff) ?? row.handoff ?? old.handoff,
          read: markedReadRef.current.has(row.id) || row.read || old.read,
        })
      }
      return [...byId.values()]
    })
    if (latestPresend && latestPresend.id !== seenPresendIdRef.current) {
      seenPresendIdRef.current = latestPresend.id
      const current = useApp.getState().imComposerDrafts[latestPresend.threadId] || ''
      if (!current.trim()) useApp.getState().setIMComposerDraft(latestPresend.threadId, latestPresend.text)
    }
    if (!latestPresend && hasRoster) seenPresendIdRef.current = ''
    if (hasRoster || 'pairAsk' in data) {
      const ask = data.pairAsk && typeof data.pairAsk === 'object' ? data.pairAsk as Record<string, unknown> : null
      if (ask && ask.from) {
        setPairAsk({
          fromName: String(ask.fromName || '同事'),
          door: String(ask.door || ''),
        })
      } else {
        setPairAsk(null)
      }
      const wait = data.pairWait && typeof data.pairWait === 'object' ? data.pairWait as Record<string, unknown> : null
      setPairWait(wait && wait.displayName ? String(wait.displayName) : '')
      if (data.doorPort != null) setDoorPort(String(data.doorPort))
    }
  }

  const pullThread = (contact?: IMContact | null) => {
    const row = contact ?? openContactRef.current
    if (!row) return Promise.resolve()
    const query = row.kind === 'topic-group' ? { groupId: row.id } : { peerId: row.id }
    return runtimeApi.imThread(query).then(applyMailbox)
  }

  useEffect(() => {
    let alive = true
    const pull = () => {
      void runtimeApi.imMailbox().then((data) => {
        if (alive) applyMailbox(data)
      }).catch(() => undefined)
    }
    void runtimeApi.imMailbox().then(async (data) => {
      if (!alive) return
      applyMailbox(data)
      await runtimeApi.imShout().catch(() => undefined)
      const again = await runtimeApi.imMailbox().catch(() => null)
      if (alive && again) applyMailbox(again)
    }).catch(() => undefined)
    const timer = window.setInterval(pull, 2000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const [q, setQ] = useState('')
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<IMAttachment[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [manageTarget, setManageTarget] = useState<{ panel: 'me' | 'add' | 'group' | 'detail'; id?: string }>({ panel: 'add' })
  const openManage = (panel: 'me' | 'add' | 'group' | 'detail', id?: string) => {
    setManageTarget({ panel, id })
    setManageOpen(true)
  }

  const [handoffOpen, setHandoffOpen] = useState(false)
  const [pendingHandoff, setPendingHandoff] = useState<IMHandoffPackage | null>(null)
  const [preview, setPreview] = useState<{
    title: string
    body: string
    path?: string
    image?: string
    data?: string
    mime?: string
    requestId?: string
    index?: number
  } | null>(null)
  const [sending, setSending] = useState(false)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [topicDraft, setTopicDraft] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: IMMessage } | null>(null)
  const [forwardMessage, setForwardMessage] = useState<IMMessage | null>(null)
  const [composerHeight, setComposerHeight] = useState(168)
  const [clock, setClock] = useState(Date.now())
  const endRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listContentRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const chatPaneRef = useRef<HTMLDivElement>(null)
  const composerResizeRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const filtered = useMemo(() => {
    const sorted = [...contacts].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
    if (!q) return sorted
    return sorted.filter((c) => c.name.includes(q) || c.handle.includes(q))
  }, [contacts, q])
  const people = filtered.filter((c) => c.kind === 'contact')
  const groups = filtered.filter((c) => c.kind === 'topic-group')
  const activeContact = contacts.find((c) => c.id === activeThreadId) ?? contacts[0]
  openContactRef.current = activeContact
  useEffect(() => {
    void pullThread(activeContact)
  }, [activeContact?.id])
  const byTime = (a: IMMessage, b: IMMessage) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  const groupTopics = messages.filter((m) => m.threadId === activeContact?.id && m.topic && !m.parentId)
  const activeMsgs = messages.filter((m) => {
    if (m.threadId !== activeContact?.id) return false
    if (activeContact?.kind !== 'topic-group') return true
    if (selectedTopicId) return m.id === selectedTopicId || m.parentId === selectedTopicId
    return Boolean(m.topic && !m.parentId)
  }).slice().sort(byTime)
  const allThreadMsgs = messages.filter((m) => m.threadId === activeContact?.id).slice().sort(byTime)
  const lastFor = (id: string) => messages.filter((m) => m.threadId === id).slice().sort(byTime).at(-1)
  const unreadFor = (id: string) => messages.filter((m) => m.threadId === id && !m.read && !markedReadRef.current.has(m.id) && m.authorId !== selfId && m.authorId !== 'u_self').length
  const latestKey = `${activeContact?.id || ''}:${selectedTopicId || ''}:${activeMsgs.at(-1)?.id || ''}:${activeMsgs.length}`

  useEffect(() => {
    if (!activeContact) return
    setSelectedTopicId(null)
  }, [activeContact?.id, activeContact?.kind])
  useEffect(() => {
    if (!activeContact) return
    const unread = messages.filter((m) => m.threadId === activeContact.id && !m.read && !markedReadRef.current.has(m.id))
    if (!unread.length) return
    unread.forEach((m) => markedReadRef.current.add(m.id))
    const ids = new Set(unread.map((m) => m.id))
    setLiveMessages((prev) => (prev ?? []).map((row) => ids.has(row.id) ? { ...row, read: true } : row))
    void Promise.all(unread.map((m) => runtimeApi.imMarkRead(m.id).catch(() => undefined)))
  }, [activeContact?.id, messages])
  useEffect(() => {
    if (!activeContact) return
    setInput(composerDrafts[activeContact.id] ?? '')
  }, [activeContact?.id, composerDrafts[activeContact?.id ?? '']])
  useEffect(() => {
    setAttachments([])
    setPendingHandoff(null)
  }, [activeContact?.id])
  const jumpToLatest = () => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    endRef.current?.scrollIntoView({ block: 'end', inline: 'nearest' })
  }
  useLayoutEffect(() => {
    jumpToLatest()
    const a = window.requestAnimationFrame(() => jumpToLatest())
    const b = window.setTimeout(jumpToLatest, 80)
    const c = window.setTimeout(jumpToLatest, 400)
    return () => {
      window.cancelAnimationFrame(a)
      window.clearTimeout(b)
      window.clearTimeout(c)
    }
  }, [latestKey, composerHeight, activeContact?.id, selectedTopicId])
  useEffect(() => {
    const el = listRef.current
    const inner = listContentRef.current
    if (!el || !inner) return
    const ro = new ResizeObserver(() => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight
      if (gap < 320) jumpToLatest()
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [activeContact?.id])
  useEffect(() => {
    const n = contacts.reduce((sum, contact) => sum + (contact.id === activeContact?.id ? 0 : unreadFor(contact.id)), 0)
    const badge = n || undefined
    if (useApp.getState().panels.find((panel) => panel.id === 'im')?.badge === badge) return
    useApp.getState().setPanelBadge('im', badge)
  }, [messages, contacts, activeContact?.id, selfId])
  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const onFill = (event: Event) => {
      const detail = (event as CustomEvent<{ threadId?: string; text?: string }>).detail
      const threadId = String(detail?.threadId || '')
      const text = String(detail?.text || '')
      if (threadId) fillComposer(threadId, text)
    }
    window.addEventListener('fde-x-im-fill', onFill as EventListener)
    return () => window.removeEventListener('fde-x-im-fill', onFill as EventListener)
  }, [activeContact?.id])
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!composerResizeRef.current) return
      const next = composerResizeRef.current.startHeight + composerResizeRef.current.startY - e.clientY
      const pane = chatPaneRef.current?.clientHeight ?? window.innerHeight
      const max = Math.max(132, pane - 48 - 96)
      setComposerHeight(Math.max(132, Math.min(max, next)))
    }
    const onUp = () => { composerResizeRef.current = null; document.body.style.cursor = '' }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [])

  const setComposer = (value: string) => {
    setInput(value)
    if (activeContact) useApp.getState().setIMComposerDraft(activeContact.id, value)
  }

  const fillComposer = (threadId: string, text: string) => {
    const body = extractComposerBody(text)
    if (!body) {
      useApp.getState().setIMComposerDraft(threadId, '')
      if (activeContact?.id === threadId) setInput('')
      setAiHint('左边写完了，但没有可放进输入框的正文')
      return
    }
    useApp.getState().setIMComposerDraft(threadId, body)
    if (activeContact?.id === threadId) setInput(body)
    setAiHint('已放入输入框，确认后发送')
  }

  const showLetterBytes = (name: string, mime: string, data: string, size: number) => {
    const kind = kindFromName(name)
    const type = mime || mimeFromName(name)
    if (kind === 'image' || type.startsWith('image/')) {
      const src = data.startsWith('data:') ? data : `data:${type || 'image/png'};base64,${data}`
      setPreview({ title: name, body: '', image: src, data, mime: type })
      return
    }
    let text = data
    try {
      const compact = data.replace(/\s/g, '')
      if (compact.length > 8 && /^[A-Za-z0-9+/=]+$/.test(compact)) {
        const bin = atob(compact)
        text = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)))
      }
    } catch { /* 不是 base64 就当正文 */ }
    setPreview({ title: name, body: text.slice(0, 16000) || `二进制附件 · ${Math.max(1, Math.round(size / 1024))} KB`, data, mime: type })
  }

  const previewLetterAttach = (message: IMMessage, att: IMAttachment) => {
    setPreview({ title: att.name, body: '正在打开附件…' })
    const encoded = att.id.split('::')
    const requestId = encoded.length === 2 ? encoded[0] : message.id
    const index = encoded.length === 2 && Number.isFinite(Number(encoded[1])) ? Number(encoded[1]) : Math.max(0, (message.attachments || []).indexOf(att))
    void runtimeApi.imAttach(requestId, index).then((got) => {
      if (got && got.ok !== false && got.data) {
        showLetterBytes(String(got.name || att.name), String(got.mime || ''), String(got.data), Number(got.size || att.size || 0))
        setPreview((current) => current ? { ...current, requestId, index } : current)
        return
      }
      previewFile(att)
    }).catch(() => previewFile(att))
  }

  const previewFile = (att: IMAttachment) => {
    if (att.data && (att.kind === 'image' || (att.mime || '').startsWith('image/'))) {
      setPreview({ title: att.name, body: '', image: `data:${att.mime || mimeFromName(att.name)};base64,${att.data}`, data: att.data, mime: att.mime || mimeFromName(att.name) })
      return
    }
    setPreview({ title: att.name, body: '正在打开…', path: att.fileId })
    void (async () => {
      try {
        const target = await loadCurrentAiTarget()
        if (!target.ok) {
          setPreview({ title: att.name, body: `路径：${att.fileId}\n大小：${Math.max(1, Math.round(att.size / 1024))} KB\n${target.error}`, path: att.fileId })
          return
        }
        if (att.kind === 'image') {
          const query = new URLSearchParams({ path: att.fileId, sessionId: target.sessionId })
          setPreview({
            title: att.name,
            body: '',
            path: att.fileId,
            image: `/api/v1/files/raw?${query.toString()}`,
          })
          return
        }
        const file = await runtimeApi.readWorkspaceFile(target.sessionId, att.fileId)
        const body = typeof file.text === 'string' && file.text.trim()
          ? file.text.slice(0, 12000)
          : `二进制或空文件。路径：${att.fileId}\n大小：${Math.max(1, Math.round(att.size / 1024))} KB`
        setPreview({ title: att.name, body, path: att.fileId })
      } catch (cause) {
        setPreview({ title: att.name, body: cause instanceof Error ? cause.message : '打不开这个文件', path: att.fileId })
      }
    })()
  }

  const previewHandoff = (pkg: IMHandoffPackage) => {
    const files = pkg.fileIds.length ? pkg.fileIds.join('\n') : '未选文件'
    const sessionLines = (pkg.sessions || []).map((row) => `${row.title}（${row.files.length} 个会话文件）`).join('\n')
      || (pkg.sourceChatIds.length ? pkg.sourceChatIds.join('\n') : '未选会话')
    setPreview({
      title: pkg.title,
      body: `${pkg.summary}\n\n会话文件\n${sessionLines}\n\n工作区文件\n${files}`,
    })
  }

  const savePreviewLocal = async () => {
    if (!preview) return
    try {
      let blob: Blob
      if (preview.data) {
        const bin = atob(preview.data.replace(/\s/g, ''))
        blob = new Blob([Uint8Array.from(bin, (ch) => ch.charCodeAt(0))], { type: preview.mime || 'application/octet-stream' })
      } else if (preview.image) {
        blob = await (await fetch(preview.image)).blob()
      } else if (preview.body) {
        blob = new Blob([preview.body], { type: 'text/plain;charset=utf-8' })
      } else {
        throw new Error('没有可保存的内容')
      }
      const name = preview.title || '附件'
      const picker = (window as Window & { showSaveFilePicker?: (opts: { suggestedName: string }) => Promise<{ createWritable: () => Promise<{ write: (file: Blob) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker
      if (typeof picker === 'function') {
        const handle = await picker({ suggestedName: name })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = name
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setAiHint(cause instanceof Error ? cause.message : '没另存成')
    }
  }

  const savePreviewWorkspace = async () => {
    if (!preview || preview.requestId == null || preview.index == null) {
      setAiHint('先打开这封信里的附件再保存到工作区')
      return
    }
    try {
      const target = await loadCurrentAiTarget()
      if (!target.ok) throw new Error(target.error)
      const got = await runtimeApi.imCopyAttach({ requestId: preview.requestId, index: preview.index, workspace: target.cwd })
      if (got.ok === false) throw new Error(String(got.hint || got.error || '没保存到工作区'))
      setAiHint(`已保存到工作区 ${String(got.path || '')}`)
    } catch (cause) {
      setAiHint(cause instanceof Error ? cause.message : '没保存到工作区')
    }
  }

  const handleSend = () => {
    if (!activeContact || sending) return
    const text = input.trim()
    if (!text && attachments.length === 0 && !pendingHandoff) return
    if (text && isUnsafeToSend(text)) {
      setAiHint('这段里有令牌或过账字样，不能寄给对方。改掉后再发。')
      return
    }
    const pending = pendingPresendRef.current
    const toSend = attachments.slice()
    const handoff = pendingHandoff
    setSending(true)
    setAiHint('正在发送…')
    void runtimeApi.imSleep(false).catch(() => undefined).then(async () => {
      if (pending && pending.threadId === activeContact.id && pending.text.trim() === text && toSend.length === 0 && !handoff) {
        const sent = await runtimeApi.imSend({ requestId: pending.id })
        if (sent && sent.ok === false) throw new Error(String(sent.hint || sent.error || '没发出去'))
        return runtimeApi.imState()
      }
      if (pending && pending.threadId === activeContact.id) {
        await runtimeApi.imCancelPresend(pending.id).catch(() => undefined)
      }
      const target = await loadCurrentAiTarget().catch(() => ({ ok: false as const, error: '当前工作区还没有可用的 AI 会话' }))
      const packed: Array<Record<string, unknown>> = []
      if (handoff) packed.push(packHandoffAttach(handoff, target.ok ? target.cwd : ''))
      if (toSend.length) {
        for (const item of toSend) {
          if (item.data) {
            packed.push({
              name: item.name,
              mime: item.mime || mimeFromName(item.name),
              size: item.size,
              data: item.data,
            })
            continue
          }
          if (!target.ok) throw new Error(target.error)
          const file = await runtimeApi.readWorkspaceBytes(target.sessionId, item.fileId)
          const data = String(file.data || '')
          if (!data) throw new Error(`读不出附件 ${item.name}`)
          packed.push({
            name: item.name,
            mime: file.mime || mimeFromName(item.name),
            size: Number(file.size || item.size || 0),
            data,
          })
        }
        if (packed.filter((item) => item.name !== HANDOFF_NAME).length !== toSend.length) {
          throw new Error('附件没有全部读进信里')
        }
      }
      const body: Record<string, unknown> = {
        excerpt: text || (handoff ? handoff.summary : (toSend.map((item) => item.name).join('、') || '（附件）')),
        attachments: packed,
      }
      if (target.ok) {
        body.sessionId = target.sessionId
        body.workspace = target.cwd
      }
      if (activeContact.kind === 'topic-group') {
        body.groupId = activeContact.id
        if (selectedTopicId) body.threadId = selectedTopicId
      } else {
        body.to = [activeContact.id]
      }
      const composed = await runtimeApi.imCompose(body)
      const requestId = String(composed.requestId || composed.id || '')
      if (composed.ok === false || !requestId) throw new Error(String(composed.hint || composed.error || '没写成'))
      const sent = await runtimeApi.imSend({ requestId })
      if (sent && sent.ok === false) throw new Error(String(sent.hint || sent.error || '没发出去'))
      setLiveMessages((prev) => [...(prev ?? []).filter((row) => row.id !== requestId), {
        id: requestId,
        threadId: activeContact.id,
        authorId: selfId,
        fromName: selfName,
        text,
        ts: new Date().toISOString(),
        read: true,
        attachments: toSend.length ? toSend : undefined,
        handoff: handoff || undefined,
      }])
      return runtimeApi.imMailbox()
    }).then(async (state) => {
      applyMailbox(state)
      await pullThread(activeContact).catch(() => undefined)
      setComposer('')
      setAttachments([])
      setPendingHandoff(null)
      setEmojiOpen(false)
      setAiHint('')
    }).catch((cause) => {
      setAiHint(cause instanceof Error ? cause.message : '没发出去')
    }).finally(() => {
      setSending(false)
    })
  }

  const runAIAction = (action: IMAIAction, quoted?: string) => {
    if (!activeContact) return
    setEmojiOpen(false)
    if (action === 'handoff') {
      setHandoffOpen(true)
      return
    }
    const quote = String(quoted || '').trim()
    void (async () => {
      setAiHint('')
      const target = await loadCurrentAiTarget()
      if (!target.ok) {
        setAiHint(target.error)
        return
      }
      const turns = allThreadMsgs.map((row) => ({
        authorId: row.authorId,
        fromName: row.fromName,
        text: row.text,
        recalledAt: row.recalledAt,
        attachmentNames: (row.attachments || []).map((item) => item.name),
      }))
      const thread = threadExcerpt(turns, selfId, activeContact.name)
      const incoming = quote || lastIncomingText(turns, selfId)
      if (action === 'adopt' || action === 'draft') {
        if (!incoming) {
          setAiHint(action === 'draft' ? '对面还没有来信，拟回要用对方发来的那条' : '还没有可采纳的来信')
          return
        }
      }
      const built = buildImAiPrompt(action, {
        who: activeContact.name,
        quote: action === 'precedent' || action === 'local' || action === 'summary' ? quote : incoming,
        thread,
        extra: action === 'precedent' || action === 'local' ? (quote || input) : '',
        workspace: target.cwd,
      })
      window.dispatchEvent(new CustomEvent('fde-x-ai-prompt', {
        detail: {
          text: built.text,
          fillThreadId: built.fill ? activeContact.id : '',
        },
      }))
      setAiHint(built.hint)
    })().catch((cause) => setAiHint(cause instanceof Error ? cause.message : '没发起'))
  }

  const selectContact = (id: string) => {
    setActiveThread(id)
  }

  const attachFile = (file: FileNode) => {
    if (file.kind === 'folder') return
    setAttachments((items) => items.some((x) => x.fileId === file.id) ? items : [...items, {
      id: `att_${Math.random().toString(36).slice(2, 8)}`, fileId: file.id, name: file.name, kind: file.kind, size: file.size,
    }])
  }

  const attachNativeFiles = (list: File[]) => {
    const files = list.filter((file) => file && file.size > 0)
    if (!files.length) return
    void Promise.all(files.map(async (file) => {
      const data = await fileToBase64(file)
      const name = file.name || `image-${Date.now()}.png`
      return {
        id: `att_${Math.random().toString(36).slice(2, 8)}`,
        fileId: name,
        name,
        kind: kindFromName(name),
        size: file.size,
        mime: file.type || mimeFromName(name),
        data,
      } satisfies IMAttachment
    })).then((rows) => {
      setAttachments((items) => [...items, ...rows])
      setAiHint(`已加入 ${rows.length} 个附件，确认后发送`)
    }).catch((cause) => setAiHint(cause instanceof Error ? cause.message : '贴不上这个文件'))
  }

  const continueHandoff = (message: IMMessage) => {
    if (!message.handoff) return
    if (imBanner?.kind === 'working') return
    setImBanner({ kind: 'working', text: '正在复原交接会话，请稍候…' })
    setAiHint('正在复原交接会话…')
    void (async () => {
      let sessions = message.handoff?.sessions || []
      if (!sessions.length) {
        for (let index = 0; index < 12 && !sessions.length; index += 1) {
          const got = await runtimeApi.imAttach(message.id, index).catch(() => null)
          if (!got || got.ok === false) continue
          const parsed = parseHandoffPack(String(got.data || ''))
          const rows = parsed && Array.isArray(parsed.sessions) ? parsed.sessions as IMHandoffPackage['sessions'] : []
          if (rows?.length) sessions = rows
        }
      }
      if (!sessions.length) throw new Error('交接包里没有 AI 会话文件（请确认发出时预览里已有 session.v3.jsonl.zstd）')
      const workspace = loadCurrentWorkspaceCwd()
      if (!workspace.ok) throw new Error(workspace.error)
      const workspaceId = workspace.workspaceId.startsWith('ws_') ? '' : workspace.workspaceId
      const restored = await runtimeApi.restoreAiSessions({
        ...(workspaceId ? { workspaceId } : {}),
        cwd: workspace.cwd,
        sessions: sessions.map((row) => ({ title: row.title, files: row.files })),
      })
      const ids = (restored.sessions || []).map((row) => row.sessionId).filter(Boolean)
      if (!ids.length) throw new Error('会话没有复原出来')
      window.dispatchEvent(new CustomEvent('fde-x-ai-restore', {
        detail: {
          sessionIds: ids,
          sessions: restored.sessions || [],
        },
      }))
      const ok = restored.warnings?.length
        ? `复原成功，但：${restored.warnings.join('；')}`
        : `已复原 ${ids.length} 个 AI 会话，请看左边会话列表`
      setAiHint(ok)
      setImBanner({ kind: 'ok', text: ok })
    })().catch((cause) => {
      const text = cause instanceof Error ? cause.message : '没复原成'
      setAiHint(text)
      setImBanner({ kind: 'err', text })
    })
  }

  const translateMessage = (message: IMMessage) => {
    const text = messageBody(message)
    if (!text) {
      setImBanner({ kind: 'err', text: '这条没有可翻译的正文' })
      return
    }
    setImBanner({ kind: 'working', text: '正在翻译…' })
    void runtimeApi.imTranslate(text).then((got) => {
      const out = String(got.out || '').trim()
      if (got.ok === false || !out) throw new Error(String(got.hint || got.error || '没译出来'))
      setTranslations((current) => ({ ...current, [message.id]: out }))
      setImBanner({ kind: 'ok', text: '已译成英文，看这条消息下面' })
    }).catch((cause) => setImBanner({ kind: 'err', text: cause instanceof Error ? cause.message : '翻译失败' }))
  }

  const rememberMessage = (message: IMMessage) => {
    const text = messageBody(message)
    if (!text) {
      setImBanner({ kind: 'err', text: '这条没有可记的正文' })
      return
    }
    setImBanner({ kind: 'working', text: '正在写成记忆卡片…' })
    void runtimeApi.draftMemoryCard(`IM · ${activeContact?.name || ''}\n${text}`, 'correction').then(() => {
      setImBanner({ kind: 'ok', text: '已写成记忆卡片，打开记忆页可点头入档' })
      useApp.getState().togglePanel('memory', 'full')
    }).catch((cause) => setImBanner({ kind: 'err', text: cause instanceof Error ? cause.message : '没写成卡片' }))
  }

  const forwardTo = (peer: { id: string; name: string; avatarColor?: string }) => {
    if (!forwardMessage) return
    const source = forwardMessage
    const text = messageBody(source)
    setImBanner({ kind: 'working', text: `正在转发给 ${peer.name}…` })
    void (async () => {
      const packed: Array<Record<string, unknown>> = []
      for (const [index, att] of (source.attachments || []).entries()) {
        const got = await runtimeApi.imAttach(source.id, letterIndexOf(att, index)).catch(() => null)
        if (!got || got.ok === false || !got.data) continue
        packed.push({
          name: att.name,
          mime: att.mime || String(got.mime || mimeFromName(att.name)),
          size: Number(got.size || att.size || 0),
          data: got.data,
        })
      }
      if (source.handoff) {
        for (let index = 0; index < 8; index += 1) {
          const got = await runtimeApi.imAttach(source.id, index).catch(() => null)
          if (!got || got.ok === false) continue
          if (got.name === HANDOFF_NAME || got.mime === HANDOFF_MIME) {
            packed.push({ name: HANDOFF_NAME, mime: HANDOFF_MIME, size: Number(got.size || 0), data: got.data })
            break
          }
        }
      }
      if (!text && !packed.length) throw new Error('这条没有可转发的内容')
      const composed = await runtimeApi.imCompose({
        excerpt: text ? `转发：\n${text}` : '（转发附件）',
        to: [peer.id],
        attachments: packed,
      })
      const requestId = String(composed.requestId || composed.id || '')
      if (composed.ok === false || !requestId) throw new Error(String(composed.hint || composed.error || '没写成'))
      const sent = await runtimeApi.imSend({ requestId })
      if (sent && sent.ok === false) throw new Error(String(sent.hint || sent.error || '没发出去'))
      setForwardMessage(null)
      setImBanner({ kind: 'ok', text: `已转发给 ${peer.name}` })
    })().catch((cause) => setImBanner({ kind: 'err', text: cause instanceof Error ? cause.message : '转发失败' }))
  }

  const createTopic = () => {
    if (!activeContact || activeContact.kind !== 'topic-group' || !topicDraft.trim()) return
    const id = useApp.getState().addIMTopic({ groupId: activeContact.id, title: topicDraft.trim(), createdBy: 'u_self' })
    setSelectedTopicId(id)
    setTopicDraft('')
  }

  useEffect(() => {
    if (!filePickerOpen && !handoffOpen) return
    let alive = true
    setFilesNote('正在列出工作区文件…')
    void listWorkspaceFlat().then((items) => {
      if (!alive) return
      setWsFiles(items)
      setFilesNote(items.length ? '' : '这个工作区没有可附的文件')
    }).catch((cause) => {
      if (!alive) return
      setWsFiles([])
      setFilesNote(cause instanceof Error ? cause.message : '列不出工作区文件')
    })
    return () => { alive = false }
  }, [filePickerOpen, handoffOpen])

  const setPaletteOpen = useApp((s) => s.setPaletteOpen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true) }
      if (e.key === 'Escape') { setPaletteOpen(false); setContextMenu(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPaletteOpen])

  const panels = useApp((s) => s.panels)
  const activePanel = panels.find((p) => p.state === 'full') ?? panels.find((p) => p.state === 'half')
  const panelOpen = !!activePanel
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440))
  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth)
      const pane = chatPaneRef.current?.clientHeight
      if (!pane) return
      const max = Math.max(132, pane - 48 - 96)
      setComposerHeight((h) => Math.min(h, max))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const overlayPanel = panelOpen && vw < 1200
  const [pinnedContacts, setPinnedContacts] = useState(false)
  const contactsCollapsed = compact ? !pinnedContacts : (panelOpen && !overlayPanel && !pinnedContacts)

  const renderContactButton = (c: IMContact, compact = false) => {
    const unread = unreadFor(c.id)
    const isActive = c.id === activeContact?.id
    if (compact) return (
      <button key={c.id} onClick={() => selectContact(c.id)} className={clsx('relative rounded-full shrink-0', isActive && 'ring-2 ring-brand ring-offset-2')} title={c.name}>
        <ImFace avatar={c.avatar} name={c.name} size={36} group={c.kind === 'topic-group'} />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-accent-red text-white text-[9px] flex items-center justify-center">{unread}</span>}
      </button>
    )
    const last = lastFor(c.id)
    return (
      <button key={c.id} onClick={() => selectContact(c.id)} className={clsx('w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-surface-2', isActive && 'bg-brand-soft border-l-2 border-brand')}>
        <ImFace avatar={c.avatar} name={c.name} size={36} group={c.kind === 'topic-group'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1"><span className="text-sm font-medium truncate">{c.name}</span>{c.pinned && <Pin size={10} className="text-brand" />}{c.muted && <BellOff size={10} className="text-ink-subtle" />}</div>
          <div className="text-xs text-ink-muted truncate">{last ? last.text || `${last.attachments?.length ?? 0} 个附件` : c.handle}</div>
        </div>
        {unread > 0 && <span className="px-1.5 min-w-5 h-5 rounded-full bg-accent-red text-white text-[10px] flex items-center justify-center">{unread}</span>}
      </button>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-white">
      {!pairAsk && pairWait && (
        <div className="shrink-0 px-4 py-2.5 bg-surface-2 border-b border-line text-sm text-ink-muted">
          已向 {pairWait} 发出配对，等对面在 IM 里点确定。
        </div>
      )}
      {pairAsk && (
        <div className="shrink-0 px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-3 z-10">
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-medium">{pairAsk.fromName}</span> 要和你配对
            {pairAsk.door ? <span className="text-ink-muted"> · {pairAsk.door}</span> : null}
            {pairBusy && <span className="block text-xs text-ink-muted mt-0.5">正在通知对端…</span>}
            {pairHint && !pairBusy && <span className="block text-xs text-accent-red mt-0.5">{pairHint}</span>}
          </div>
          <button
            type="button"
            className="btn h-8 px-3"
            disabled={pairBusy}
            onClick={() => {
              setPairBusy(true)
              setPairHint('')
              void runtimeApi.imPairReject().then(() => runtimeApi.imState()).then(applyMailbox).catch((cause) => setPairHint(cause instanceof Error ? cause.message : '拒绝失败')).finally(() => setPairBusy(false))
            }}
          >拒绝</button>
          <button
            type="button"
            className="btn-primary h-8 px-3"
            disabled={pairBusy}
            onClick={() => {
              setPairBusy(true)
              setPairHint('')
              void runtimeApi.imPairAccept()
                .then((data) => {
                  if (data.ok === false) setPairHint(String(data.hint || data.error || '配对失败'))
                  return runtimeApi.imState()
                })
                .then(applyMailbox)
                .catch((cause) => setPairHint(cause instanceof Error ? cause.message : '配对失败'))
                .finally(() => setPairBusy(false))
            }}
          >确定</button>
        </div>
      )}
      <div className="flex-1 min-h-0 flex relative">
        {overlayPanel && compact && <div className="absolute inset-0 z-20 bg-black/20" onClick={() => activePanel && useApp.getState().setPanelState(activePanel.id, 'tab')} />}
        <div className="flex-1 min-w-0 flex flex-col bg-white">
          <div className="flex-1 min-h-0 flex">
              {contactsCollapsed ? (
                <div className="w-14 bg-white border-r border-line flex flex-col items-center shrink-0 py-2 gap-1.5 overflow-y-auto">
                  <button onClick={() => setPinnedContacts(true)} className="p-1.5 rounded hover:bg-surface-2 text-ink-muted" title="展开会话列表"><ChevronsRight size={16} /></button>
                  <div className="w-6 border-t border-line my-1" />
                  {filtered.map((c) => renderContactButton(c, true))}
                </div>
              ) : (
                <div className="w-64 bg-white border-r border-line flex flex-col shrink-0">
                  <div className="p-2 border-b border-line flex gap-1.5">
                    <div className="relative flex-1"><Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索联系人或话题群" className="w-full pl-7 pr-2 py-1.5 text-xs border border-line rounded focus:outline-none focus:border-brand" /></div>
                    <button onClick={() => openManage('add')} className="p-1.5 rounded border border-line hover:bg-surface-2 text-ink-muted" title="联系人和群管理"><Settings2 size={13} /></button>
                    {panelOpen && <button onClick={() => setPinnedContacts(false)} className="p-1.5 rounded hover:bg-surface-2 text-ink-muted" title="收起会话列表"><ChevronsLeft size={13} /></button>}
                  </div>
                  <div className="flex-1 overflow-auto">
                    <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-ink-subtle flex items-center gap-1"><UserRound size={10} /> 联系人 · {people.length}</div>
                    {people.map((c) => renderContactButton(c))}
                    {people.length === 0 && (
                      <div className="px-3 py-4 text-xs text-ink-muted leading-5">
                        还没有配对同事。本机门牌 <span className="font-mono">{doorPort ? `127.0.0.1:${doorPort}` : '连接核心后显示'}</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn h-7 px-2"
                            onClick={() => {
                              void runtimeApi.imPairMint().then((data) => {
                                const nested = data.pairCode && typeof data.pairCode === 'object' ? data.pairCode as Record<string, unknown> : null
                                const code = String(data.code ?? nested?.code ?? '')
                                setPairCode(code)
                                setPairHint(code ? `配对码 ${code}` : String(data.hint ?? '已开码'))
                              }).catch((cause) => setPairHint(cause instanceof Error ? cause.message : '开码失败'))
                            }}
                          >开码</button>
                          <button type="button" className="btn h-7 px-2" onClick={() => useApp.getState().togglePanel('settings', 'full')}>打开设置配对</button>
                        </div>
                        {pairCode && <div className="mt-2 font-mono text-sm text-ink">{pairCode}</div>}
                        {pairHint && <div className="mt-1">{pairHint}</div>}
                        <div className="mt-3 text-[11px] text-ink-subtle">本机第二套：另开终端 <span className="font-mono">pnpm run dev:peer</span>。门牌填对面 IM 里显示的「本机门牌」，不要填 5174/5175。</div>
                      </div>
                    )}
                    <div className="px-3 py-2 mt-1 border-t border-line text-[10px] uppercase tracking-wide text-ink-subtle flex items-center gap-1"><Users size={10} /> 话题群 · {groups.length}</div>
                    {groups.map((c) => renderContactButton(c))}
                  </div>
                  <div className="p-2 border-t border-line space-y-1">
                    <button type="button" onClick={() => openManage('add')} className="w-full px-2 py-1.5 text-xs text-ink-muted hover:bg-surface-2 rounded flex items-center gap-1.5"><Plus size={12} /> 添加同事 / 话题群</button>
                    <button type="button" onClick={() => openManage('me')} className="w-full px-2 py-1.5 text-xs text-ink-muted hover:bg-surface-2 rounded flex items-center gap-1.5">
                      <ImFace avatar={selfAvatar} name={selfName} size={18} />
                      <span className="truncate">{selfName || '我的资料'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div ref={chatPaneRef} className="flex-1 min-h-0 min-w-[380px] bg-white flex flex-col overflow-hidden">
                {activeContact ? <>
                  <div className="h-12 border-b border-line flex items-center px-4 gap-3 shrink-0">
                    <ImFace avatar={activeContact.avatar} name={activeContact.name} size={32} group={activeContact.kind === 'topic-group'} />
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium flex items-center gap-1.5">{activeContact.name}{selectedTopicId && activeContact.kind === 'topic-group' ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted">话题</span> : <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted">{activeContact.kind === 'topic-group' ? '话题群' : '联系人'}</span>}</div><div className="text-[10px] text-ink-muted truncate">{activeContact.kind === 'topic-group' ? (selectedTopicId ? '跟帖会进当前话题' : `${activeContact.handle}`) : `${activeContact.online ? '在线' : '离线'} · ${activeContact.handle}`}</div></div>
                    {selectedTopicId && activeContact.kind === 'topic-group' && (
                      <button type="button" className="text-xs text-ink-muted hover:text-ink" onClick={() => setSelectedTopicId(null)}>返回群</button>
                    )}
                    <button onClick={() => setHistoryOpen(true)} className="px-2 py-1 text-xs text-ink-muted hover:bg-surface-2 rounded flex items-center gap-1"><History size={12} /> 记录</button>
                    <button onClick={() => activeContact && openManage('detail', activeContact.id)} className="p-1.5 text-ink-muted hover:bg-surface-2 rounded" title="当前会话资料"><Settings2 size={14} /></button>
                  </div>
                  {imBanner && (
                    <div className={clsx(
                      'px-4 py-3 text-sm font-medium flex items-center gap-2 shrink-0 border-b',
                      imBanner.kind === 'working' && 'bg-amber-100 text-amber-950 border-amber-200',
                      imBanner.kind === 'ok' && 'bg-brand-soft text-brand border-brand/20',
                      imBanner.kind === 'err' && 'bg-red-50 text-accent-red border-red-200',
                    )}>
                      {imBanner.kind === 'working' && <LoaderCircle size={16} className="animate-spin shrink-0" />}
                      <span className="flex-1">{imBanner.text}</span>
                      {imBanner.kind !== 'working' && (
                        <button type="button" className="p-1 rounded hover:bg-black/5" onClick={() => setImBanner(null)} aria-label="关闭">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                    <div ref={listContentRef} className="space-y-3 pb-8">
                    {activeMsgs.length === 0 && <div className="text-center text-sm text-ink-subtle mt-12">{activeContact.kind === 'topic-group' ? (selectedTopicId ? '还没有跟帖' : '发一条，成为群里的话题') : `与 ${activeContact.name} 开始对话`}<div className="text-xs mt-2">拟回与先例会由 AI 生成后自动回填输入框</div></div>}
                    {activeMsgs.map((m) => {
                      const isMe = m.authorId === selfId || m.authorId === 'u_self'
                      const followCount = messages.filter((row) => row.parentId === m.id).length
                      if (activeContact.kind === 'topic-group' && !selectedTopicId && m.topic) {
                        return (
                          <button key={m.id} type="button" onClick={() => setSelectedTopicId(m.id)} className="w-full text-left rounded-2xl border border-line bg-white px-4 py-3 hover:border-brand/40">
                            <div className="text-[11px] text-ink-muted mb-1">{isMe ? '我' : (m.fromName || contacts.find((c) => c.id === m.authorId)?.name || activeContact.name)} · {new Date(m.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="text-sm text-ink whitespace-pre-wrap">{m.text}</div>
                            <div className="mt-2 text-xs text-brand">{followCount} 条跟帖 · 点开进话题</div>
                          </button>
                        )
                      }
                      const isAssistant = m.authorId === 'u_assistant'
                      const author = contacts.find((c) => c.id === m.authorId)
                      return <div key={m.id} className={clsx('flex', isMe ? 'justify-end' : 'justify-start')} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, message: m }) }}>
                        <div className="max-w-[76%]">
                          {!isMe && <div className="text-[10px] text-ink-muted mb-0.5">{isAssistant ? '助手' : author?.name ?? activeContact.name}</div>}
                          <div className={clsx('px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words', isMe ? 'bg-brand text-white' : isAssistant ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-surface-2 text-ink')}>
                            {!m.recalledAt && m.text && !(m.attachments?.length && (/^附件\s+/u.test(m.text) || m.text === '（附件）' || m.attachments.every((att) => m.text.includes(att.name)))) && <div>{m.text}</div>}
                            {m.attachments?.length ? <div className={clsx('mt-2 grid gap-1.5', m.text && !(/^附件\s+/u.test(m.text) || m.text === '（附件）' || m.attachments.every((att) => m.text.includes(att.name))) && 'pt-2 border-t')}>{m.attachments.map((att, index) => <button key={att.id} type="button" onClick={() => previewLetterAttach(m, att)} className={clsx('rounded text-left overflow-hidden', att.kind === 'image' ? '' : (isMe ? 'px-2 py-1.5 bg-white/12 hover:bg-white/20 flex items-center gap-2' : 'px-2 py-1.5 bg-white border border-line hover:border-brand flex items-center gap-2'))}>{att.kind === 'image' ? <LetterThumb requestId={m.id} index={letterIndexOf(att, index)} name={att.name} /> : <><span>{fileIcon(att.kind)}</span><span className="min-w-0 flex-1"><span className="block text-xs truncate">{att.name}</span><span className={clsx('block text-[9px]', isMe ? 'text-white/65' : 'text-ink-subtle')}>{att.size ? `${Math.max(1, Math.round(att.size / 1024))} KB` : '附件'}</span></span></>}</button>)}</div> : null}
                            {m.handoff && <div className={clsx('mt-2 rounded-lg overflow-hidden text-left', isMe ? 'bg-white text-ink' : 'bg-white border border-line')}><div className="px-3 py-2 bg-ink text-white flex items-center gap-2"><MessageSquareText size={14} /><div className="flex-1"><div className="text-xs font-semibold">{m.handoff.title}</div><div className="text-[9px] text-white/65">交接包 · {handoffSessionCount(m.handoff)} 个 Agent 会话 · {handoffPackSessionLine(m.handoff)}{m.handoff.fileIds.length ? ` · ${m.handoff.fileIds.length} 个工作区文件` : ''}</div></div></div><div className="p-3 text-xs whitespace-pre-wrap leading-5">{m.handoff.summary}</div><div className="px-3 pb-3 flex gap-2"><button onClick={() => previewHandoff(m.handoff!)} className="flex-1 px-2 py-1.5 rounded border border-line hover:bg-surface-2">打开详情</button><button onClick={() => continueHandoff(m)} className="flex-1 px-2 py-1.5 rounded bg-brand text-white flex items-center justify-center gap-1"><Play size={11} /> 接着做</button></div></div>}
                            {(m.translation || translations[m.id]) && <div className={clsx('mt-2 pt-2 border-t text-xs leading-5', isMe ? 'border-white/20 text-white/85' : 'border-line text-ink-muted')}><span className="text-[9px] uppercase tracking-wide opacity-70">English</span><div>{m.translation || translations[m.id]}</div></div>}
                            {m.recalledAt && <div className={clsx('italic text-xs', isMe ? 'text-white/70' : 'text-ink-subtle')}>{isMe ? '你撤回了一条消息' : '对方撤回了一条消息'}</div>}
                          </div>
                          <div className={clsx('text-[10px] mt-0.5 flex items-center gap-2', isMe ? 'justify-end text-ink-subtle' : 'text-ink-subtle')}><span>{new Date(m.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>{m.pending && isMe && <button type="button" className="text-accent-red hover:underline" onClick={() => { void runtimeApi.imSleep(false).catch(() => undefined).then(() => runtimeApi.imSend({ requestId: m.id })).then(() => runtimeApi.imState()).then(applyMailbox).catch((cause) => setAiHint(cause instanceof Error ? cause.message : '没发出去')) }}>未发出 · 再送</button>}{isMe && !m.recalledAt && !m.pending && clock - new Date(m.ts).getTime() <= 120000 && (
                              <button
                                type="button"
                                className="text-brand hover:underline"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (!activeContact) return
                                  const peers = activeContact.kind === 'topic-group' ? (activeContact.memberIds || []) : [activeContact.id]
                                  void Promise.all(peers.map((peerId) => runtimeApi.imWithdraw({ requestId: m.id, peerId }))).then((results) => {
                                    const fail = results.find((row) => row && row.ok === false)
                                    if (fail) throw new Error(String(fail.hint || fail.error || '撤回失败'))
                                    return runtimeApi.imState()
                                  }).then(applyMailbox).catch((cause) => setAiHint(cause instanceof Error ? cause.message : '撤回失败'))
                                }}
                              >
                                撤回 {Math.max(0, Math.ceil((120000 - Math.max(0, clock - new Date(m.ts).getTime())) / 1000))}s
                              </button>
                            )}</div>
                        </div>
                      </div>
                    })}
                    <div ref={endRef} />
                    </div>
                  </div>

                  <div className="border-t border-line p-3 shrink-0 relative z-10 bg-white" style={{ height: composerHeight }}>
                    <div
                      className="absolute top-0 left-0 right-0 h-3 -translate-y-1/2 cursor-ns-resize group z-10 flex items-center justify-center"
                      title="向上拖动放大输入区"
                      onPointerDown={(e) => { composerResizeRef.current = { startY: e.clientY, startHeight: composerHeight }; document.body.style.cursor = 'ns-resize'; e.currentTarget.setPointerCapture(e.pointerId) }}
                    >
                      <div className="w-14 h-1 rounded-full bg-line group-hover:bg-brand transition-colors" />
                    </div>
                    <div
                      className="border border-line rounded-lg overflow-visible focus-within:border-brand bg-white h-full flex flex-col"
                      onDragOver={(event) => {
                        if ([...event.dataTransfer.types].includes('Files')) {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'copy'
                        }
                      }}
                      onDrop={(event) => {
                        const files = [...event.dataTransfer.files]
                        if (!files.length) return
                        event.preventDefault()
                        attachNativeFiles(files)
                      }}
                    >
                      <div className="px-2 py-1.5 border-b border-line bg-surface-2/55 flex items-center gap-1 flex-wrap">
                        {AI_ACTIONS.map((action) => <button key={action.id} onClick={() => runAIAction(action.id)} title={action.hint} className="px-2 py-1 text-[11px] rounded border border-line bg-white text-ink hover:border-brand hover:text-brand hover:bg-brand-soft flex items-center gap-1">{action.id === 'draft' && <Sparkles size={10} />}{action.label}</button>)}
                        <div className="relative"><button onClick={() => setEmojiOpen((v) => !v)} className="px-2 py-1 text-[11px] rounded border border-line bg-white hover:border-brand flex items-center gap-1"><Smile size={11} /> 表情</button>{emojiOpen && <div className="absolute bottom-full mb-1 left-0 bg-white border border-line rounded-md shadow-lg p-1.5 z-30 flex gap-0.5">{EMOJIS.map((emo) => <button key={emo} className="w-7 h-7 rounded hover:bg-surface-2 text-base" onClick={() => { setComposer(`${input}${emo}`); setEmojiOpen(false) }}>{emo}</button>)}</div>}</div>
                        <button onClick={() => setFilePickerOpen(true)} className="px-2 py-1 text-[11px] rounded border border-line bg-white hover:border-brand flex items-center gap-1"><Paperclip size={11} /> 文件</button>
                        <button onClick={() => setHistoryOpen(true)} className="px-2 py-1 text-[11px] rounded border border-line bg-white hover:border-brand flex items-center gap-1"><History size={11} /> 记录</button>
                        <div className="relative"><button onClick={() => setMoreOpen((v) => !v)} className="p-1.5 rounded hover:bg-line text-ink-muted" title="更多"><MoreHorizontal size={14} /></button>{moreOpen && <div className="absolute bottom-full mb-1 left-0 bg-white border border-line rounded-md shadow-lg py-1 min-w-44 z-30"><button onClick={() => { useApp.getState().togglePanel('data', 'full'); setMoreOpen(false) }} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-2">打开业务数据</button><button onClick={() => { useApp.getState().togglePanel('plan', 'full'); setMoreOpen(false) }} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-2">打开计划</button><button onClick={() => { setPaletteOpen(true); setMoreOpen(false) }} className="w-full px-3 py-1.5 text-xs text-left hover:bg-surface-2 flex items-center gap-2"><Command size={12} /> 全局搜索</button></div>}</div>
                      </div>
                      {(attachments.length > 0 || pendingHandoff) && (
                        <div className="px-3 pt-2 flex gap-1.5 flex-wrap">
                          {attachments.map((att) => (
                            <span key={att.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-line bg-surface-2 text-[11px]">
                              <button type="button" className="inline-flex items-center gap-1.5 min-w-0" title="预览" onClick={() => previewFile(att)}>
                                {att.data && att.kind === 'image' ? <img src={`data:${att.mime || mimeFromName(att.name)};base64,${att.data}`} alt="" className="w-5 h-5 rounded object-cover" /> : <span>{fileIcon(att.kind)}</span>}
                                <span className="max-w-36 truncate">{att.name}</span>
                              </button>
                              <button type="button" onClick={() => setAttachments((items) => items.filter((x) => x.id !== att.id))}><X size={10} /></button>
                            </span>
                          ))}
                          {pendingHandoff && handoffSessionFiles(pendingHandoff).map((file) => (
                            <span key={`${file.sessionId}:${file.name}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-brand/30 bg-brand-soft text-brand text-[11px]" title={`${file.sessionTitle} · ${file.name}`}>
                              <span>🧠</span>
                              <span className="max-w-48 truncate">{file.sessionTitle} / {file.name}</span>
                              <span className="text-[10px] opacity-80">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                            </span>
                          ))}
                          {pendingHandoff && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-brand/30 bg-brand-soft text-brand text-[11px]">
                              <button type="button" className="inline-flex items-center gap-1.5" title="预览交接" onClick={() => previewHandoff(pendingHandoff)}>
                                <MessageSquareText size={11} /> 交接包 · {handoffSessionCount(pendingHandoff)} 会话 · {handoffSessionFiles(pendingHandoff).length} 个会话文件 · {pendingHandoff.fileIds.length} 个工作区文件
                              </button>
                              <button type="button" onClick={() => setPendingHandoff(null)}><X size={10} /></button>
                            </span>
                          )}
                        </div>
                      )}
                      <textarea value={input} onChange={(e) => setComposer(e.target.value)} onPaste={(event) => {
                          const fromFiles = [...(event.clipboardData?.files || [])]
                          const fromItems = [...(event.clipboardData?.items || [])]
                            .filter((item) => item.type.startsWith('image/'))
                            .map((item) => item.getAsFile())
                            .filter((file): file is File => !!file)
                          const images = [...fromFiles, ...fromItems].filter((file, index, all) => (
                            (file.type.startsWith('image/') || kindFromName(file.name) === 'image')
                            && all.findIndex((row) => row === file || (row.name === file.name && row.size === file.size)) === index
                          ))
                          if (!images.length) return
                          event.preventDefault()
                          attachNativeFiles(images)
                        }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} placeholder={activeContact.kind === 'topic-group' ? (selectedTopicId ? '写跟帖… Enter 发送' : '发一条成为话题… Enter 发送') : `发给 ${activeContact.name}… Enter 发送，Shift+Enter 换行`} className="w-full min-h-0 flex-1 px-3 py-2 text-sm resize-none focus:outline-none bg-transparent" />
                      <div className="px-2 py-1.5 border-t border-line flex items-center gap-2"><span className="text-[10px] text-ink-subtle flex-1">{aiHint || (activeContact.kind === 'topic-group' ? (selectedTopicId ? '跟帖进当前话题' : '发送后成为一条话题') : 'AI 结果会先回填，不会自动发送')}</span><button onClick={handleSend} disabled={sending || (!input.trim() && attachments.length === 0 && !pendingHandoff)} className="px-3 py-1.5 text-xs bg-brand text-white rounded hover:bg-brand/90 disabled:opacity-40 flex items-center gap-1"><Send size={12} /> {sending ? '发送中' : '发送'}</button></div>
                    </div>
                  </div>
                </> : <div className="flex-1 flex items-center justify-center text-sm text-ink-subtle">选择联系人或话题群开始对话</div>}
              </div>
          </div>
        </div>
      </div>

      {contextMenu && <div className="fixed z-[100] w-44 bg-white border border-line rounded-lg shadow-xl py-1" style={{ left: Math.min(contextMenu.x, window.innerWidth - 190), top: Math.min(contextMenu.y, window.innerHeight - 270) }} onClick={(e) => e.stopPropagation()}>
        <ContextButton icon={<Brain size={13} />} label="问本机这条" onClick={() => { runAIAction('local', messageBody(contextMenu.message)); setContextMenu(null) }} />
        <ContextButton icon={<Sparkles size={13} />} label="按这条拟回" onClick={() => { runAIAction('draft', messageBody(contextMenu.message)); setContextMenu(null) }} />
        <ContextButton icon={<Copy size={13} />} label="采纳这条" onClick={() => {
          const row = contextMenu.message
          const mine = row.authorId === selfId || row.authorId === 'u_self'
          if (mine) setImBanner({ kind: 'err', text: '采纳要用对面的来信' })
          else runAIAction('adopt', messageBody(row))
          setContextMenu(null)
        }} />
        <ContextButton icon={<Languages size={13} />} label="翻译这条" onClick={() => { translateMessage(contextMenu.message); setContextMenu(null) }} />
        <ContextButton icon={<ListTodo size={13} />} label="摘成待办" onClick={() => {
          const title = messageBody(contextMenu.message).slice(0, 60) || 'IM 待办'
          useApp.getState().addTask({ title, status: 'todo', priority: 'med', tags: ['IM'] })
          useApp.getState().setActivePlanTab('todo')
          useApp.getState().togglePanel('plan', 'full')
          setImBanner({ kind: 'ok', text: '已放进待办' })
          setContextMenu(null)
        }} />
        <ContextButton icon={<Forward size={13} />} label="转发给……" onClick={() => { setForwardMessage(contextMenu.message); setContextMenu(null) }} />
        <ContextButton icon={<Brain size={13} />} label="能不能记进档案" onClick={() => { rememberMessage(contextMenu.message); setContextMenu(null) }} />
      </div>}

      {filePickerOpen && <FilePicker files={wsFiles} note={filesNote} selected={attachments} onToggle={attachFile} onRemove={(id) => setAttachments((items) => items.filter((x) => x.fileId !== id))} onClose={() => setFilePickerOpen(false)} />}
      {historyOpen && activeContact && <HistoryDialog contact={activeContact} messages={allThreadMsgs} contacts={contacts} onPreview={(message, att) => previewLetterAttach(message, att)} onClose={() => setHistoryOpen(false)} />}
      {manageOpen && (
        <ContactManager
          contacts={contacts}
          messages={messages}
          doorPort={doorPort}
          selfName={selfName}
          selfAvatar={selfAvatar}
          onRefresh={() => runtimeApi.imState().then(applyMailbox)}
          initialPanel={manageTarget.panel}
          initialId={manageTarget.id}
          onSelect={selectContact}
          onClose={() => setManageOpen(false)}
        />
      )}

      {handoffOpen && activeContact && <HandoffDialog activeContact={activeContact} files={wsFiles} filesNote={filesNote} workspaceId={activeWorkspaceId} onClose={() => setHandoffOpen(false)} onConfirm={(pkg, chosenFiles) => { setPendingHandoff(pkg); setAttachments(chosenFiles); setComposer(pkg.summary); setHandoffOpen(false) }} />}
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          {preview.path && <div className="mb-2 text-[11px] text-ink-subtle font-mono break-all">{preview.path}</div>}
          {preview.image && <img src={preview.image} alt={preview.title} className="max-h-[60vh] w-auto max-w-full mx-auto mb-3 rounded border border-line" />}
          {preview.body && <div className="max-h-[60vh] overflow-auto text-sm whitespace-pre-wrap leading-6">{preview.body}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => void savePreviewLocal()}>另存为</button>
            <button type="button" className="btn-primary" onClick={() => void savePreviewWorkspace()}>保存到工作区</button>
          </div>
        </Modal>
      )}
      {forwardMessage && (
        <Modal title="转发消息" onClose={() => setForwardMessage(null)}>
          <div className="text-xs text-ink-muted mb-3 p-3 rounded bg-surface-2 whitespace-pre-wrap max-h-40 overflow-auto">{messageBody(forwardMessage) || '（附件 / 交接包）'}</div>
          <div className="space-y-1">
            {contacts.filter((c) => c.id !== activeContact?.id).map((c) => (
              <button key={c.id} type="button" onClick={() => forwardTo(c)} className="w-full px-3 py-2 rounded hover:bg-surface-2 flex items-center gap-2 text-left">
                <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs" style={{ background: c.avatarColor }}>{c.name.slice(0, 1)}</div>
                <span className="text-sm">{c.name}</span>
                <ChevronRight size={13} className="ml-auto" />
              </button>
            ))}
            {contacts.filter((c) => c.id !== activeContact?.id).length === 0 && <div className="py-6 text-center text-xs text-ink-subtle">没有其他联系人可转</div>}
          </div>
        </Modal>
      )}
    </div>
  )
}

function letterIndexOf(att: IMAttachment, fallback: number) {
  const encoded = att.id.split('::')
  if (encoded.length === 2 && Number.isFinite(Number(encoded[1]))) return Number(encoded[1])
  return fallback
}

function LetterThumb({ requestId, index, name }: { requestId: string; index: number; name: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    void runtimeApi.imAttach(requestId, index).then((got) => {
      if (!alive || !got.data) return
      const type = String(got.mime || mimeFromName(name) || 'image/png')
      const data = String(got.data)
      setSrc(data.startsWith('data:') ? data : `data:${type};base64,${data}`)
    }).catch(() => undefined)
    return () => { alive = false }
  }, [requestId, index, name])
  if (!src) return <span className="text-xs">{name}</span>
  return <img src={src} alt={name} className="max-w-[240px] max-h-44 rounded-md object-cover block" />
}

function ContextButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="w-full px-3 py-2 text-xs text-left hover:bg-surface-2 flex items-center gap-2 text-ink-muted hover:text-ink">{icon}{label}</button>
}

function FilePicker({ files, note, selected, onToggle, onRemove, onClose }: { files: FileNode[]; note?: string; selected: IMAttachment[]; onToggle: (file: FileNode) => void; onRemove: (id: string) => void; onClose: () => void }) {
  return (
    <Modal title="选择工作区文件" onClose={onClose} wide>
      <WorkspaceFileTree
        files={files}
        selectedIds={selected.map((item) => item.fileId)}
        onToggle={(file) => selected.some((item) => item.fileId === file.id) ? onRemove(file.id) : onToggle(file)}
        note={note}
      />
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-ink-muted">已选 {selected.length} 个文件</span>
        <button type="button" onClick={onClose} className="btn-primary px-4 py-2 text-sm">放入输入区</button>
      </div>
    </Modal>
  )
}

function HistoryDialog({ contact, messages, contacts, onPreview, onClose }: { contact: IMContact; messages: IMMessage[]; contacts: IMContact[]; onPreview: (message: IMMessage, att: IMAttachment) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const list = messages.filter((m) => !q || m.text.includes(q) || m.attachments?.some((a) => a.name.includes(q)))
  return <Modal title={`${contact.name} · 历史聊天记录`} onClose={onClose} wide><div className="relative mb-4"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索消息、附件或交接包" className="input w-full pl-8 text-sm" /></div><div className="space-y-2">{list.map((m) => <div key={m.id} className="p-3 border border-line rounded-lg"><div className="flex items-center justify-between text-[10px] text-ink-subtle mb-1"><span>{m.authorId === 'u_self' ? '我' : m.authorId === 'u_assistant' ? '助手' : contacts.find((c) => c.id === m.authorId)?.name ?? contact.name}</span><span>{new Date(m.ts).toLocaleString('zh-CN')}</span></div><div className="text-sm whitespace-pre-wrap">{m.text}</div>{m.attachments?.length ? <div className="mt-2 flex flex-wrap gap-1">{m.attachments.map((a) => <button key={a.id} type="button" onClick={() => onPreview(m, a)} className="px-2 py-1 rounded bg-surface-2 text-xs hover:text-brand">{fileIcon(a.kind)} {a.name}</button>)}</div> : null}{m.handoff && <div className="mt-2 p-2 rounded bg-brand-soft text-xs text-brand">交接包：{m.handoff.title}</div>}</div>)}{list.length === 0 && <div className="py-12 text-center text-sm text-ink-subtle">没有匹配记录</div>}</div></Modal>
}

function ContactManager({
  contacts, messages, doorPort, selfName, selfAvatar, initialPanel, initialId, onRefresh, onSelect, onClose,
}: {
  contacts: IMContact[]
  messages: IMMessage[]
  doorPort: string
  selfName: string
  selfAvatar: string
  initialPanel?: 'me' | 'add' | 'group' | 'detail'
  initialId?: string
  onRefresh: () => void | Promise<unknown>
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const people = contacts.filter((c) => c.kind === 'contact')
  const groups = contacts.filter((c) => c.kind === 'topic-group')
  const focused = contacts.find((c) => c.id === initialId)
  const [panel, setPanel] = useState<'me' | 'add' | 'group' | 'detail'>(initialPanel ?? (focused ? 'detail' : 'add'))
  const [selectedId, setSelectedId] = useState(initialId ?? people[0]?.id ?? '')
  const selected = contacts.find((c) => c.id === selectedId)
  const [name, setName] = useState(selfName)
  const [avatar, setAvatar] = useState(selfAvatar || 'leaf')
  const [peerCode, setPeerCode] = useState('')
  const [door, setDoor] = useState('')
  const [minted, setMinted] = useState('')
  const [hint, setHint] = useState('')
  const [groupName, setGroupName] = useState(focused?.kind === 'topic-group' ? focused.name : '')
  const [memberIds, setMemberIds] = useState<string[]>(focused?.kind === 'topic-group' ? focused.memberIds ?? [] : [])
  const [editNote, setEditNote] = useState(focused?.note || '')
  const [editDoor, setEditDoor] = useState(focused?.handle || '')
  const [editPinned, setEditPinned] = useState(Boolean(focused?.pinned))
  const [editMuted, setEditMuted] = useState(Boolean(focused?.muted))
  const [busy, setBusy] = useState(false)

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try { await work() } finally { setBusy(false) }
  }

  return (
    <Modal title={panel === 'detail' && selected ? selected.name : panel === 'me' ? '我的资料' : panel === 'group' ? '新建话题群' : panel === 'add' ? '添加同事' : '联系人与话题群'} onClose={onClose} wide>
      <div className="grid grid-cols-[220px_minmax(0,1fr)] min-h-[480px]">
        <aside className="border-r border-line pr-3 flex flex-col gap-3">
          <button type="button" onClick={() => setPanel('me')} className={clsx('w-full p-2 rounded-lg flex items-center gap-2 text-left', panel === 'me' ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
            <ImFace avatar={selfAvatar} name={selfName} size={32} />
            <span className="min-w-0"><span className="block text-sm truncate">{selfName || '我'}</span><span className="block text-[10px] text-ink-muted">头像与称呼</span></span>
          </button>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-ink-subtle mb-1">联系人 · {people.length}</div>
            <div className="space-y-0.5 max-h-40 overflow-auto">
              {people.map((c) => (
                <button key={c.id} type="button" onClick={() => { setSelectedId(c.id); setMemberIds([]); setEditNote(c.note || ''); setEditDoor(c.handle); setEditPinned(Boolean(c.pinned)); setEditMuted(Boolean(c.muted)); setPanel('detail') }} className={clsx('w-full p-1.5 rounded flex items-center gap-2 text-left', panel === 'detail' && selectedId === c.id ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
                  <ImFace avatar={c.avatar} name={c.name} size={24} />
                  <span className="text-xs truncate">{c.name}</span>
                </button>
              ))}
              {people.length === 0 && <div className="text-[11px] text-ink-subtle px-1">还没有配对同事</div>}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-ink-subtle mb-1">话题群 · {groups.length}</div>
            <div className="space-y-0.5 max-h-28 overflow-auto">
              {groups.map((c) => (
                <button key={c.id} type="button" onClick={() => { setSelectedId(c.id); setMemberIds(c.memberIds ?? []); setGroupName(c.name); setEditPinned(Boolean(c.pinned)); setEditMuted(Boolean(c.muted)); setPanel('detail') }} className={clsx('w-full p-1.5 rounded flex items-center gap-2 text-left', panel === 'detail' && selectedId === c.id ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
                  <ImFace name={c.name} size={24} group />
                  <span className="text-xs truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <button type="button" onClick={() => setPanel('add')} className={clsx('btn w-full h-8 text-xs', panel === 'add' && 'border-brand')}>添加同事</button>
            <button type="button" onClick={() => setPanel('group')} className={clsx('btn w-full h-8 text-xs', panel === 'group' && 'border-brand')}>新建话题群</button>
          </div>
        </aside>
        <div className="pl-5">
          {hint && <div className="mb-3 text-xs text-ink-muted">{hint}</div>}
          {panel === 'me' && (
            <div>
              <div className="text-sm font-medium mb-1">我的资料</div>
              <div className="text-xs text-ink-muted mb-4">头像会随配对和发信带给对方。</div>
              <div className="flex items-center gap-3 mb-4">
                <ImFace avatar={avatar} name={name} size={52} />
                <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="显示名称" />
              </div>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {IM_AVATARS.map((item) => (
                  <button key={item.id} type="button" onClick={() => setAvatar(item.id)} className={clsx('p-2 rounded-lg border flex flex-col items-center gap-1', avatar === item.id ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand/50')}>
                    <ImFace avatar={item.id} size={36} />
                    <span className="text-[10px] text-ink-muted">{item.label}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="btn-primary" disabled={busy || !name.trim()} onClick={() => void run(async () => {
                const data = await runtimeApi.imSaveProfile({ name: name.trim(), avatar })
                setHint(data.ok === false ? String(data.hint || data.error || '没保存') : '已保存。好友下次收到消息会看到新头像。')
                await onRefresh()
              })}>保存资料</button>
            </div>
          )}
          {panel === 'add' && (
            <div>
              <div className="text-sm font-medium mb-1">添加同事</div>
              <div className="text-xs text-ink-muted mb-4">在这边开码或填码，不用去设置。本机门牌 <span className="font-mono">{doorPort ? `127.0.0.1:${doorPort}` : '连接后显示'}</span></div>
              <div className="flex flex-wrap gap-2 mb-4">
                <button type="button" className="btn" disabled={busy} onClick={() => void run(async () => {
                  const data = await runtimeApi.imPairMint()
                  const nested = data.pairCode && typeof data.pairCode === 'object' ? data.pairCode as Record<string, unknown> : null
                  const code = String(data.code ?? nested?.code ?? '')
                  setMinted(code)
                  setHint(code ? `配对码 ${code}，给对面填。` : String(data.hint ?? '已开码'))
                })}>开码</button>
                {minted && <span className="input h-8 px-2 font-mono text-sm">{minted}</span>}
              </div>
              <label className="block text-xs text-ink-muted mb-1">对方配对码</label>
              <input className="input w-full mb-3" value={peerCode} onChange={(e) => setPeerCode(e.target.value)} placeholder="六位数字" />
              <label className="block text-xs text-ink-muted mb-1">对方门牌</label>
              <input className="input w-full mb-4 font-mono" value={door} onChange={(e) => setDoor(e.target.value)} placeholder="127.0.0.1:19527" />
              <button type="button" className="btn-primary" disabled={busy || !peerCode.trim() || !door.trim()} onClick={() => void run(async () => {
                const data = await runtimeApi.imPairHandshake({ peerCode: peerCode.trim(), door: door.trim() })
                setHint(data.ok === false ? String(data.hint ?? data.error ?? '握手失败') : '已发出，等对面 IM 点确定')
                await onRefresh()
              })}>填码配对</button>
            </div>
          )}
          {panel === 'group' && (
            <div>
              <div className="text-sm font-medium mb-1">新建话题群</div>
              <div className="text-xs text-ink-muted mb-4">至少勾选一个已配对的同事。</div>
              <label className="block text-xs text-ink-muted mb-1">群名</label>
              <input className="input w-full mb-3" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              <div className="text-xs text-ink-muted mb-2">成员 · 已选 {memberIds.length}</div>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto border border-line rounded-lg p-2 mb-4">
                {people.map((person) => (
                  <label key={person.id} className={clsx('p-2 rounded border flex items-center gap-2 text-xs cursor-pointer', memberIds.includes(person.id) ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand/50')}>
                    <input type="checkbox" checked={memberIds.includes(person.id)} onChange={() => setMemberIds((ids) => ids.includes(person.id) ? ids.filter((id) => id !== person.id) : [...ids, person.id])} />
                    <ImFace avatar={person.avatar} name={person.name} size={24} />
                    <span className="truncate">{person.name}</span>
                  </label>
                ))}
                {people.length === 0 && <div className="col-span-2 text-xs text-ink-subtle p-2">先配对同事再建模</div>}
              </div>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void run(async () => {
                if (!groupName.trim() || memberIds.length < 1) {
                  setHint('先写群名，并勾选至少一个已配对的人')
                  return
                }
                const data = await runtimeApi.imCreateGroup({ name: groupName.trim(), members: memberIds })
                if (data.ok === false) {
                  setHint(String(data.hint || data.error || '没建成'))
                  return
                }
                setHint('话题群已建立')
                setGroupName('')
                setMemberIds([])
                await onRefresh()
                setPanel('detail')
                if (typeof data.groupId === 'string') setSelectedId(data.groupId)
              })}>创建话题群</button>
            </div>
          )}
          {panel === 'detail' && selected && selected.kind === 'contact' && (
            <div className="text-sm">
              <div className="text-lg font-medium mb-2">{selected.displayName || selected.name}</div>
              <div className="text-xs text-ink-muted space-y-1 mb-4">
                <div>对面名字 <span className="text-ink">{selected.displayName || selected.name}</span></div>
                <div>稳定 ID <span className="font-mono">{selected.id.slice(0, 18)}…</span></div>
                <div>在线 {selected.online ? '在线' : '离线'}</div>
              </div>
              <label className="block text-xs text-ink-muted mb-1">备注名（对面仍看到自己的名字）</label>
              <input className="input w-full mb-3" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
              <label className="block text-xs text-ink-muted mb-1">本机员工引用（对面看不见登录口令）</label>
              <input className="input w-full mb-3 bg-surface-2" value={selected.staffId || '只存引用，不存登录口令'} readOnly />
              <label className="block text-xs text-ink-muted mb-1">对方地址（IP:端口）</label>
              <input className="input w-full mb-4 font-mono" value={editDoor} onChange={(e) => setEditDoor(e.target.value)} />
              <label className="flex items-center justify-between py-3 border-t border-line text-sm">置顶
                <input type="checkbox" checked={editPinned} onChange={(e) => setEditPinned(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between py-3 border-b border-line text-sm mb-3">免打扰
                <input type="checkbox" checked={editMuted} onChange={(e) => setEditMuted(e.target.checked)} />
              </label>
              <p className="text-[11px] text-ink-subtle mb-4">解配只删本机这一条。对面重装必须重新配对，不能沿用旧地址。</p>
              <div className="flex justify-between gap-2">
                <button type="button" className="btn" disabled={busy} onClick={() => void run(async () => {
                  if (!window.confirm(`解除与 ${selected.name} 的配对？`)) return
                  await runtimeApi.imUnpair(selected.id)
                  await onRefresh()
                  setPanel('add')
                })}>解配</button>
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={onClose}>取消</button>
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => void run(async () => {
                    await runtimeApi.imSavePeer({ peerId: selected.id, note: editNote, door: editDoor, pin: editPinned, mute: editMuted })
                    setHint('已保存')
                    await onRefresh()
                  })}>保存</button>
                </div>
              </div>
            </div>
          )}
          {panel === 'detail' && selected && selected.kind === 'topic-group' && (
            <div className="text-sm">
              <div className="text-lg font-medium mb-2">{selected.name}</div>
              <div className="text-xs text-ink-muted mb-4">
                成员 我、{people.filter((p) => (memberIds.length ? memberIds : selected.memberIds ?? []).includes(p.id)).map((p) => p.name).join('、') || '未选'}
                <div>话题 {messages.filter((m) => m.threadId === selected.id && m.topic && !m.parentId).length} 条</div>
              </div>
              <label className="block text-xs text-ink-muted mb-1">群名</label>
              <input className="input w-full mb-3" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              <div className="text-xs text-ink-muted mb-2">勾上的人在群里。自己不能踢。</div>
              <div className="space-y-1 mb-4">
                {people.map((person) => {
                  const checked = (memberIds.length ? memberIds : selected.memberIds ?? []).includes(person.id)
                  return (
                    <label key={person.id} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = memberIds.length ? memberIds : selected.memberIds ?? []
                          setMemberIds(current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id])
                        }}
                      />
                      {person.name}
                    </label>
                  )
                })}
              </div>
              <label className="flex items-center justify-between py-3 border-t border-line">置顶
                <input type="checkbox" checked={editPinned} onChange={(e) => setEditPinned(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between py-3 border-b border-line mb-3">免打扰
                <input type="checkbox" checked={editMuted} onChange={(e) => setEditMuted(e.target.checked)} />
              </label>
              <p className="text-[11px] text-ink-subtle mb-4">解散只删本机这一群。话题和跟帖一起走。</p>
              <div className="flex justify-between gap-2">
                <button type="button" className="btn" disabled={busy} onClick={() => void run(async () => {
                  if (!window.confirm(`解散话题群「${selected.name}」？`)) return
                  await runtimeApi.imDissolveGroup(selected.id)
                  await onRefresh()
                  setPanel('group')
                })}>解散群</button>
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={onClose}>取消</button>
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => void run(async () => {
                    const members = memberIds.length ? memberIds : selected.memberIds ?? []
                    if (members.length < 1) {
                      setHint('话题群至少要留一个人')
                      return
                    }
                    const data = await runtimeApi.imUpdateGroup({ groupId: selected.id, name: groupName.trim() || selected.name, members, pin: editPinned, mute: editMuted })
                    setHint(data.ok === false ? String(data.hint || data.error || '没改成') : '已保存')
                    await onRefresh()
                  })}>保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function HandoffDialog({
  activeContact, files, filesNote, workspaceId, onClose, onConfirm,
}: {
  activeContact: IMContact
  files: FileNode[]
  filesNote?: string
  workspaceId: string
  onClose: () => void
  onConfirm: (pkg: IMHandoffPackage, files: IMAttachment[]) => void
}) {
  const [sessions, setSessions] = useState<Array<{ sessionId: string; title: string }>>([])
  const [sessionNote, setSessionNote] = useState('读取会话…')
  const [chatIds, setChatIds] = useState<string[]>([])
  const [fileIds, setFileIds] = useState<string[]>([])
  const [packing, setPacking] = useState(false)
  const [sessionPreview, setSessionPreview] = useState('')
  const [packHint, setPackHint] = useState('')
  const [workspacePath, setWorkspacePath] = useState(workspaceId)

  useEffect(() => {
    let alive = true
    void loadCurrentAiTarget().then(async (target) => {
      if (!target.ok) {
        if (alive) {
          setSessions([])
          setSessionNote(target.error)
        }
        return
      }
      if (alive && target.cwd) setWorkspacePath(target.cwd)
      const rows = (await runtimeApi.listAiSessions({ includeBlank: true }))
        .filter((row) => isPrimarySession(row) && sessionMatchesCwd(row, target.cwd))
        .map((row) => ({ sessionId: row.sessionId, title: row.title || row.sessionId }))
      if (!alive) return
      setSessions(rows)
      setSessionNote(rows.length ? '' : '当前工作区还没有可用的 AI 会话')
      const preferred = useApp.getState().activeAiSessionId
      setChatIds(preferred && rows.some((row) => row.sessionId === preferred) ? [preferred] : rows[0] ? [rows[0].sessionId] : [])
    }).catch((cause) => {
      if (!alive) return
      setSessions([])
      setSessionNote(cause instanceof Error ? cause.message : '列不出会话')
    })
    return () => { alive = false }
  }, [])

  const selected = sessions.filter((row) => chatIds.includes(row.sessionId))
  const names = selected.map((row) => row.title).join('、')
  const sessionFileLine = selected.map((row) => row.title).join('、') || '未选会话'
  const summary = `交接概述\n\n工作区：${workspacePath}\nAgent 会话：${sessionFileLine}\n会话文件：放入输入区后会带上每个会话的原始 session 文件\n工作区文件：${fileIds.join('、') || '无'}\n待继续：接收方点「接着做」会新建 AI 会话并复原这些 session 文件。未经确认不要执行、不要发 IM。`
  const toggle = (list: string[], id: string, setList: (v: string[]) => void) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const confirm = () => {
    const chosen = files.filter((f) => fileIds.includes(f.id)).map((f) => ({ id: `att_${f.id}`, fileId: f.id, name: f.name, kind: f.kind, size: f.size }))
    if (!chatIds.length && !fileIds.length) return
    setPacking(true)
    setPackHint('')
    void Promise.all(chatIds.map(async (id) => {
      const bundle = await runtimeApi.exportAiSession(id)
      const title = sessions.find((row) => row.sessionId === id)?.title || id
      if (!bundle.files?.length) throw new Error(`「${title}」没有可交接的会话文件`)
      return { sessionId: id, title, files: bundle.files }
    })).then((exported) => {
      const sessionLines = exported.map((row) => {
        const files = (row.files || []).map((file) => `${file.name}（${Math.max(1, Math.round(Number(file.size || 0) / 1024))} KB）`).join('、')
        return `${row.title}：${files || '没有会话文件'}`
      }).join('\n')
      const pkg: IMHandoffPackage = {
        id: `handoff_${Math.random().toString(36).slice(2, 9)}`,
        title: `${activeContact.name} · 工作交接`,
        summary: `交接概述\n\n工作区：${workspacePath}\nAgent 会话：${names || '未选会话'}\n会话文件：\n${sessionLines || '无'}\n工作区文件：${fileIds.join('、') || '无'}\n待继续：接收方点「接着做」会新建 AI 会话并复原这些 session 文件。未经确认不要执行、不要发 IM。`,
        sourceWorkspaceId: workspacePath || workspaceId,
        sourceChatIds: chatIds,
        fileIds,
        sessions: exported,
        createdAt: new Date().toISOString(),
        status: 'sent',
      }
      onConfirm(pkg, chosen)
    }).catch((cause) => {
      setPackHint(speakSessionFileError(cause))
    }).finally(() => setPacking(false))
  }

  return (
    <Modal title="生成 Agent 会话与文件交接包" onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium mb-2">1. 选择要交接的 Agent 会话</div>
          <div className="space-y-1 max-h-48 overflow-y-auto border border-line rounded p-2">
            {sessions.map((row) => (
              <label key={row.sessionId} className="flex items-start gap-2 p-2 rounded hover:bg-surface-2 text-xs">
                <input type="checkbox" className="mt-0.5" checked={chatIds.includes(row.sessionId)} onChange={() => toggle(chatIds, row.sessionId, setChatIds)} />
                <span>🧠</span>
                <span className="min-w-0">
                  <span className="block truncate">{row.title}</span>
                  <span className="text-[10px] text-ink-subtle">{row.sessionId}</span>
                </span>
              </label>
            ))}
            {!sessions.length && <div className="p-4 text-center text-xs text-ink-subtle">{sessionNote}</div>}
          </div>
          <button
            type="button"
            className="btn h-7 px-2 mt-2 text-[11px]"
            disabled={!chatIds.length || packing}
            onClick={() => {
              setPacking(true)
              setPackHint('')
              setSessionPreview('正在读取会话文件…')
              void Promise.all(chatIds.map(async (id) => {
                const bundle = await runtimeApi.exportAiSession(id)
                const title = sessions.find((row) => row.sessionId === id)?.title || id
                const lines = (bundle.files || []).map((file) => `${file.name} · ${Math.max(1, Math.round(Number(file.size || 0) / 1024))} KB`)
                return `${title}\n${lines.join('\n') || '没有会话文件'}`
              })).then((rows) => {
                setSessionPreview(rows.join('\n\n'))
              }).catch((cause) => {
                setSessionPreview('')
                setPackHint(speakSessionFileError(cause))
              }).finally(() => setPacking(false))
            }}
          >预览所选会话文件</button>
          {sessionPreview && <div className="mt-2 max-h-40 overflow-auto border border-line rounded p-2 text-[11px] leading-5 whitespace-pre-wrap">{sessionPreview}</div>}
        </div>
        <div>
          <div className="text-xs font-medium mb-2">2. 选择当前工作区文件</div>
          <WorkspaceFileTree
            files={files}
            selectedIds={fileIds}
            onToggle={(file) => toggle(fileIds, file.id, setFileIds)}
            note={filesNote}
          />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-xs font-medium mb-2">3. 概述</div>
        <div className="p-3 rounded-lg bg-surface-2 text-xs leading-5 whitespace-pre-wrap">{summary}</div>
      </div>
      <div className="mt-4 p-3 rounded-lg border border-brand/30 bg-brand-soft text-xs text-brand">确认后先放入 IM 输入区。对方点「接着做」会在 AI 里新建会话，并把这些会话文件复原进去。</div>
      {packHint && <div className="mt-3 text-xs text-accent-red leading-5">{packHint}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost px-3 py-2 text-sm">取消</button>
        <button type="button" onClick={confirm} disabled={packing || (chatIds.length === 0 && fileIds.length === 0)} className="btn-primary px-4 py-2 text-sm disabled:opacity-40">{packing ? '读取会话…' : '放入输入区'}</button>
      </div>
    </Modal>
  )
}
