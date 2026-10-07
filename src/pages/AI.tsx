import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CircleAlert, GitBranch, LoaderCircle, MessageSquare, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2, Wifi, WifiOff, X,
} from 'lucide-react'
import clsx from 'clsx'
import { openFilesAtPath } from '@/lib/app-platform'
import { landRef } from '@/lib/open-ref'
import { currentAiTarget, isPrimarySession, resolvePrimarySessionId } from '@/lib/ai-target'
import { useApp } from '@/store/app'
import { clearAskAiNotice, getAskAiNotice, subscribeAskAiNotice } from '@/lib/ask-ai'
import { extractComposerBody } from '@/lib/im-ai'
import { proposeTerminalGrid } from '@/lib/terminal-fit'
import { terminalCloseAction } from '@/lib/terminal-occupancy'
import { useEvents } from '@/lib/events'
// @ts-expect-error runtime ESM helper
import { combineAbortSignal } from '../../runtime/live-probe.mjs'
import {
  runtimeApi,
  RuntimeApiError,
  type AiRuntimeStatus,
  type AiSessionSummary,
} from '@/lib/runtime-api'

const AiTerminal = lazy(() => import('@/components/AiTerminal').then((mod) => ({ default: mod.AiTerminal })))

const MIN_LEFT_OPEN = 720

function displayError(error: unknown) {
  if (error instanceof RuntimeApiError) return error.message
  return error instanceof Error ? error.message : 'AI 运行时发生未知错误'
}

function defaultBffOrigin() {
  const fromEnv = import.meta.env.VITE_FDE_RUNTIME_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, '')
  }
  const loc = window.location
  const host = loc.hostname || '127.0.0.1'
  const pagePort = Number(loc.port || (loc.protocol === 'https:' ? 443 : 80))
  const webToRuntimePort: Record<number, number> = { 5174: 4318, 5175: 4319 }
  const runtimePort = webToRuntimePort[pagePort] ?? 4318
  return `${loc.protocol}//${host}:${runtimePort}`
}

function runtimeOrigin(bffOrigin?: string | null) {
  return String(bffOrigin || defaultBffOrigin()).replace(/\/$/, '')
}

function dshAppSrc(bffOrigin?: string | null) {
  return `${runtimeOrigin(bffOrigin)}/dsh-app/`
}

function pinnedIdsFromBag(bag: unknown) {
  if (!bag || typeof bag !== 'object') return []
  const row = bag as { items?: Array<{ id: string; fields?: unknown }>; mutation?: { pinnedSessionIds?: string[] } }
  const pins = row.mutation?.pinnedSessionIds
  if (Array.isArray(pins)) return pins.map(String)
  return (row.items || []).filter((item) => {
    const fields = item.fields && typeof item.fields === 'object' ? item.fields as { pinned?: boolean } : {}
    return fields.pinned === true
  }).map((item) => item.id)
}

export default function AI() {
  const { chatId } = useParams()
  const nav = useNavigate()
  const liveWorkspaces = useApp((s) => s.workspaces)
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId)
  const replaceWorkspaces = useApp((s) => s.replaceWorkspaces)
  const setActiveAiSessionId = useApp((s) => s.setActiveAiSessionId)
  const storedActiveAiSessionId = useApp((s) => s.activeAiSessionId)
  const aiInboxDraft = useApp((s) => s.aiInboxDraft)
  const setAiInboxDraft = useApp((s) => s.setAiInboxDraft)
  const workspaceCwd = liveWorkspaces.find((item) => item.id === activeWorkspaceId)?.cwd

  const [runtimeStatus, setRuntimeStatus] = useState<AiRuntimeStatus | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [sessionNotice, setSessionNotice] = useState('')
  const [remoteSessions, setRemoteSessions] = useState<AiSessionSummary[]>([])
  const [presetRoster, setPresetRoster] = useState<Array<{ id: string; name?: string; description?: string }>>([])
  const [loadingRuntime, setLoadingRuntime] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const [createSessionError, setCreateSessionError] = useState('')
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)
  const [chatMenu, setChatMenu] = useState<{ id: string } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [leftForced, setLeftForced] = useState<boolean | null>(null)
  const [width, setWidth] = useState(1200)
  const [dropActive, setDropActive] = useState(false)
  const [memoryReady, setMemoryReady] = useState<Record<string, unknown> | null>(null)
  const [askAiNotice, setAskAiNotice] = useState(() => getAskAiNotice())
  const [workspaceActions, setWorkspaceActions] = useState<string[]>([])
  const [pinnedSessionIds, setPinnedSessionIds] = useState<string[]>([])
  const [sessionLane, setSessionLane] = useState<'live' | 'archived'>('live')

  const rootRef = useRef<HTMLDivElement>(null)
  const dshFrameRef = useRef<HTMLIFrameElement>(null)
  const activeIdRef = useRef<string | undefined>(undefined)
  const bffOriginRef = useRef('')
  const forkWaitRef = useRef<number | null>(null)
  const forkPendingRef = useRef(false)

  const inboxInflightRef = useRef(false)
  const flushInboxDraftRef = useRef<() => void>(() => {})
  const ensureWorkspaceSessionRef = useRef('')
  const restoreHoldUntilRef = useRef(0)
  const connectedAtRef = useRef(0)
  const workspaceCwdRef = useRef(workspaceCwd)
  const [dshFrameSrc, setDshFrameSrc] = useState('')
  const [sessionAccessory, setSessionAccessory] = useState('')
  const [terminalBag, setTerminalBag] = useState<{ items: Array<{ id: string; title: string }>; actions: string[] }>({ items: [], actions: [] })
  const [terminalId, setTerminalId] = useState('')
  const [terminalNote, setTerminalNote] = useState('')
  const terminalAttachMap = useRef<Record<string, string>>({})
  const terminalBandRef = useRef<HTMLDivElement>(null)
  const terminalBagRef = useRef(terminalBag)
  terminalBagRef.current = terminalBag

  const runtimeConnected = runtimeStatus?.connected === true
  const visibleSessions = useMemo(
    () => {
      const rows = remoteSessions.filter((session) => {
        if (!isPrimarySession(session)) return false
        if (workspaceCwd && session.cwd && session.cwd !== workspaceCwd) return false
        return true
      })
      if (!pinnedSessionIds.length) return rows
      const rank = new Map(pinnedSessionIds.map((id, index) => [id, index]))
      return [...rows].sort((a, b) => {
        const pa = rank.has(a.sessionId) ? rank.get(a.sessionId)! : Number.MAX_SAFE_INTEGER
        const pb = rank.has(b.sessionId) ? rank.get(b.sessionId)! : Number.MAX_SAFE_INTEGER
        return pa - pb
      })
    },
    [remoteSessions, workspaceCwd, pinnedSessionIds],
  )
  const wantedSessionId = runtimeConnected
    ? (chatId
      || (storedActiveAiSessionId && remoteSessions.some((session) => session.sessionId === storedActiveAiSessionId)
        ? storedActiveAiSessionId
        : ''))
    : ''
  const activeId = wantedSessionId
    ? (resolvePrimarySessionId(wantedSessionId, remoteSessions) || undefined)
    : undefined

  useEffect(() => {
    if (!chatId || !remoteSessions.length) return
    const primary = resolvePrimarySessionId(chatId, remoteSessions)
    if (primary && primary !== chatId) nav(`/ai/${primary}`, { replace: true })
  }, [chatId, remoteSessions, nav])

  const leftOpen = leftForced ?? width >= MIN_LEFT_OPEN
  const activeWorkspace = liveWorkspaces.find((item) => item.id === activeWorkspaceId)
  const activeSession = visibleSessions.find((session) => session.sessionId === activeId)

  useEffect(() => {
    if (!activeId) {
      setTerminalBag({ items: [], actions: [] })
      setTerminalId('')
      setTerminalNote('')
      return
    }
    let alive = true
    void runtimeApi.catalogBag('terminal', { sessionId: activeId }).then((bag) => {
      if (!alive) return
      const items = Array.isArray(bag.items) ? bag.items.map((row) => ({ id: row.id, title: row.title })) : []
      setTerminalBag({ items, actions: Array.isArray(bag.actions) ? bag.actions : [] })
      setTerminalId((current) => current || items[0]?.id || '')
    }).catch(() => {
      if (alive) setTerminalBag({ items: [], actions: [] })
    })
    return () => { alive = false }
  }, [activeId])

  function attachmentFor(termId: string) {
    if (!terminalAttachMap.current[termId]) {
      terminalAttachMap.current[termId] = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `att-${Date.now()}`
    }
    return terminalAttachMap.current[termId]
  }

  const dropStoppedTerminal = useCallback((id: string) => {
    const sid = String(activeId || '')
    const bag = terminalBagRef.current
    const close = terminalCloseAction(bag.actions)
    const finish = (items: Array<{ id: string; title: string }>, actions: string[]) => {
      const next = items.filter((row) => row.id !== id)
      delete terminalAttachMap.current[id]
      setTerminalNote('')
      setTerminalBag({ items: next, actions })
      if (!next.length) {
        setTerminalId('')
        setSessionAccessory('')
        return
      }
      setTerminalId((current) => (current === id ? next[0].id : current))
    }
    const afterList = () => {
      if (!sid) {
        finish(bag.items, bag.actions)
        return
      }
      void runtimeApi.catalogBag('terminal', { sessionId: sid }).then((fresh) => {
        const items = Array.isArray(fresh.items) ? fresh.items.map((row) => ({ id: row.id, title: row.title })) : []
        finish(items, Array.isArray(fresh.actions) ? fresh.actions : bag.actions)
      }).catch(() => finish(bag.items, bag.actions))
    }
    if (close && sid) {
      void runtimeApi.catalogAction({
        kind: 'terminal',
        action: close,
        sessionId: sid,
        id,
      }).then(() => afterList()).catch(() => afterList())
      return
    }
    afterList()
  }, [activeId])

  const suspectStoppedTerminal = useCallback((id: string) => {
    const sid = String(activeId || '')
    if (!sid) return
    void runtimeApi.catalogBag('terminal', { sessionId: sid }).then((fresh) => {
      const items = Array.isArray(fresh.items) ? fresh.items : []
      if (items.some((row) => row.id === id)) return
      dropStoppedTerminal(id)
    }).catch(() => undefined)
  }, [activeId, dropStoppedTerminal])

  async function reloadRemoteSessions(signal?: AbortSignal) {
    const sessions = await runtimeApi.listAiSessions({ includeBlank: true, includeSubagents: true, includeArchived: sessionLane === 'archived' }, signal)
    setRemoteSessions(sessions)
    return sessions
  }

  useEffect(() => {
    if (!runtimeConnected) return
    void reloadRemoteSessions().catch(() => undefined)
  }, [sessionLane])

  function tellDsh(op: string, extra: Record<string, unknown> = {}) {
    const origin = runtimeOrigin(bffOriginRef.current || runtimeStatus?.bffOrigin)
    if (!origin) return
    dshFrameRef.current?.contentWindow?.postMessage({ type: 'fde-x-dsh', op, ...extra }, origin)
  }

  function mimeFromName(name: string) {
    const lower = name.toLowerCase()
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

  async function attachDroppedFile(raw: string) {
    const json = raw.startsWith('fde-file:') ? raw.slice('fde-file:'.length) : raw
    const payload = JSON.parse(json) as { path?: string; name?: string; sessionId?: string }
    if (!payload.path || !payload.name) return
    const query = new URLSearchParams({ path: payload.path })
    if (payload.sessionId) query.set('sessionId', payload.sessionId)
    const response = await fetch(`/api/v1/files/raw?${query.toString()}`)
    if (!response.ok) throw new Error('无法读取该文件')
    const buffer = await response.arrayBuffer()
    const type = (response.headers.get('content-type') || mimeFromName(payload.name)).split(';')[0]
    tellDsh('attachFiles', {
      sessionId: activeIdRef.current || '',
      files: [{ name: payload.name, type, base64: await bytesToBase64(buffer) }],
    })
    setSessionNotice(`已把 ${payload.name} 放到输入框`)
  }

  useEffect(() => {
    activeIdRef.current = activeId
    if (activeId) setActiveAiSessionId(activeId)
  }, [activeId, setActiveAiSessionId])
  useEffect(() => {
    workspaceCwdRef.current = workspaceCwd
  }, [workspaceCwd])
  useEffect(() => {
    bffOriginRef.current = runtimeStatus?.bffOrigin || ''
  }, [runtimeStatus?.bffOrigin])

  useEffect(() => {
    function isFdeFile(transfer: DataTransfer | null) {
      if (!transfer) return false
      const types = [...transfer.types]
      return types.includes('application/x-fde-file') || types.includes('text/plain')
    }
    function onDragOver(event: DragEvent) {
      if (!isFdeFile(event.dataTransfer)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      setDropActive(true)
    }
    function onDragEnd() {
      setDropActive(false)
    }
    function onDrop(event: DragEvent) {
      const raw = event.dataTransfer?.getData('application/x-fde-file') || event.dataTransfer?.getData('text/plain') || ''
      if (!raw.includes('fde-file') && !raw.startsWith('{')) {
        setDropActive(false)
        return
      }
      event.preventDefault()
      setDropActive(false)
      const payload = raw.startsWith('fde-file:') || raw.startsWith('{') ? raw : ''
      if (!payload) return
      void attachDroppedFile(payload).catch((error) => {
        setSessionNotice(error instanceof Error ? error.message : '拖入文件失败')
      })
    }
    function onRestore(event: Event) {
      const detail = (event as CustomEvent<{ sessionIds?: string[]; sessions?: Array<{ sessionId?: string; title?: string }> }>).detail
      const sessionIds = Array.isArray(detail?.sessionIds) ? detail.sessionIds.filter(Boolean) : []
      const sid = sessionIds[0]
      if (!sid) return
      const titles = new Map((detail?.sessions || []).map((row) => [String(row.sessionId || ''), String(row.title || '').trim()]))
      restoreHoldUntilRef.current = Date.now() + 60_000
      setSessionNotice('正在打开复原后的会话…')
      void (async () => {
        const deadline = Date.now() + 10_000
        let found: AiSessionSummary | undefined
        while (Date.now() < deadline) {
          const rows = await runtimeApi.listAiSessions({ includeBlank: true, includeSubagents: true }).catch(() => [])
          found = rows.find((row) => row.sessionId === sid)
          if (found) {
            setRemoteSessions(rows.map((row) => (titles.get(row.sessionId) ? { ...row, title: titles.get(row.sessionId)! } : row)))
            break
          }
          await new Promise((wait) => { window.setTimeout(wait, 500) })
        }
        if (!found) {
          setSessionNotice('复原已写盘，但列表尚未刷新')
          return
        }
        const openId = resolvePrimarySessionId(sid, rows) || (isPrimarySession(found) ? sid : '')
        if (!openId) {
          setSessionNotice('复原的是子会话，父会话不在列表里')
          return
        }
        const title = titles.get(openId) || titles.get(sid) || found.title || ''
        nav(`/ai/${openId}`)
        const origin = bffOriginRef.current || defaultBffOrigin()
        setDshFrameSrc(`${dshAppSrc(origin)}?restore=${Date.now()}#fde-session=${encodeURIComponent(openId)}`)
        const select = () => tellDsh('select', {
          sessionId: openId,
          ...(title ? { title } : {}),
          ...(workspaceCwdRef.current ? { cwd: workspaceCwdRef.current } : {}),
        })
        if (title) tellDsh('rename', { sessionId: sid, title })
        select()
        for (const ms of [1500, 4000, 8000, 16000]) {
          window.setTimeout(() => {
            select()
            if (title) tellDsh('rename', { sessionId: sid, title })
          }, ms)
        }
        setSessionNotice('已复原交接会话')
      })()
    }
    function onTranscript(event: Event) {
      const detail = (event as CustomEvent<{ sessionIds?: string[] }>).detail
      const sessionIds = Array.isArray(detail?.sessionIds) ? detail.sessionIds.filter(Boolean) : []
      if (!sessionIds.length) return
      tellDsh('transcript', { sessionIds })
    }
    function onPrompt(event: Event) {
      const detail = (event as CustomEvent<{ text?: string; fillThreadId?: string; readOnly?: boolean }>).detail
      const text = String(detail?.text || '').trim()
      const fillThreadId = String(detail?.fillThreadId || '').trim()
      if (fillThreadId) {
        const sid = String(detail?.sessionId || useApp.getState().activeAiSessionId || '').trim()
        if (sid) useApp.getState().setIMFillBind({ sessionId: sid, threadId: fillThreadId })
      }
      void currentAiTarget().then((target) => {
        if (!target.ok) {
          setSessionNotice(target.error)
          return
        }
        const sid = target.sessionId
        nav(`/ai/${sid}`)
        tellDsh('select', {
          sessionId: sid,
          ...(target.workspaceId && !target.workspaceId.startsWith('ws_') ? { workspaceId: target.workspaceId } : {}),
          ...(target.cwd ? { cwd: target.cwd } : {}),
        })
        if (detail?.readOnly) {
          tellDsh('readAssistant', { sessionId: sid })
          return
        }
        if (!text) return
        tellDsh('prompt', { sessionId: sid, text })
      }).catch((error) => {
        setSessionNotice(error instanceof Error ? error.message : '没问出去')
      })
    }
    function onAttach(event: Event) {
      const detail = (event as CustomEvent<{ path?: string; name?: string; sessionId?: string }>).detail
      if (!detail?.path || !detail.name) return
      void attachDroppedFile(JSON.stringify(detail)).catch((error) => {
        setSessionNotice(error instanceof Error ? error.message : '附加文件失败')
      })
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragend', onDragEnd)
    window.addEventListener('fde-x-attach-file', onAttach as EventListener)
    window.addEventListener('fde-x-ai-prompt', onPrompt as EventListener)
    window.addEventListener('fde-x-ai-transcript', onTranscript as EventListener)
    window.addEventListener('fde-x-ai-restore', onRestore as EventListener)
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<{ sessionId?: string; title?: string; accessory?: string }>).detail
      const sid = String(detail?.sessionId || '').trim()
      const title = String(detail?.title || '').trim()
      const accessory = String(detail?.accessory || '').trim()
      if (accessory) setSessionAccessory(accessory)
      if (!sid) {
        if (!accessory) nav('/ai')
        return
      }
      void reloadRemoteSessions().then((rows) => {
        if (title) {
          setRemoteSessions(rows.map((row) => (row.sessionId === sid ? { ...row, title } : row)))
        }
        nav(`/ai/${sid}`)
        tellDsh('select', {
          sessionId: sid,
          ...(title ? { title } : {}),
          ...(workspaceCwdRef.current ? { cwd: workspaceCwdRef.current } : {}),
        })
      }).catch(() => undefined)
    }
    window.addEventListener('fde-x-ai-open', onOpen as EventListener)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragend', onDragEnd)
      window.removeEventListener('fde-x-attach-file', onAttach as EventListener)
      window.removeEventListener('fde-x-ai-prompt', onPrompt as EventListener)
      window.removeEventListener('fde-x-ai-transcript', onTranscript as EventListener)
      window.removeEventListener('fde-x-ai-restore', onRestore as EventListener)
      window.removeEventListener('fde-x-ai-open', onOpen as EventListener)
    }
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? el.clientWidth)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    let active = true
    async function bootstrap() {
      setLoadingRuntime(true)
      setRuntimeError(null)
      try {
        let status = await runtimeApi.aiStatus(abort.signal)
        if (!status.connected) status = await runtimeApi.connectAi(abort.signal)
        if (!active) return
        setRuntimeStatus(status)
        const [sessions, roster, dshWorkspaces, workspaceBag] = await Promise.all([
          runtimeApi.listAiSessions({ includeBlank: true, includeSubagents: true }, abort.signal),
          runtimeApi.listAiPresets(abort.signal).catch(() => ({ presets: [] as Array<{ id: string }> })),
          runtimeApi.listAiWorkspaces(abort.signal).catch(() => []),
          runtimeApi.catalogBag('workspace', {}, abort.signal).catch(() => ({ actions: [] as string[] })),
        ])
        if (!active) return
        setRemoteSessions(sessions)
        setPresetRoster(Array.isArray(roster.presets) ? roster.presets : [])
        setWorkspaceActions(Array.isArray(workspaceBag.actions) ? workspaceBag.actions : [])
        setPinnedSessionIds(pinnedIdsFromBag(workspaceBag))
        if (dshWorkspaces.length) {
          const mapped = dshWorkspaces.map((item) => ({
            id: item.workspaceId,
            name: item.title || item.path.split('/').filter(Boolean).at(-1) || item.path,
            emoji: '📁',
            desc: item.path,
            cwd: item.path,
            createdAt: new Date().toISOString(),
          }))
          replaceWorkspaces(mapped)
          const current = mapped.find((item) => item.id === activeWorkspaceId) || mapped[0]
          if (current?.cwd) {
            void runtimeApi.ensureWorkspace({ id: current.id, name: current.name, description: current.desc, cwd: current.cwd }).catch(() => undefined)
          }
        }
      } catch (error) {
        if (!active || abort.signal.aborted) return
        setRuntimeError(displayError(error))
        try {
          setRuntimeStatus(await runtimeApi.aiStatus())
        } catch {
          setRuntimeStatus(null)
        }
      } finally {
        if (active) setLoadingRuntime(false)
      }
    }
    void bootstrap()
    return () => {
      active = false
      abort.abort()
    }
  }, [replaceWorkspaces])

  useEffect(() => {
    if (!runtimeConnected || !activeId) return
    if (chatId !== activeId) nav(`/ai/${activeId}`, { replace: true })
  }, [activeId, chatId, nav, runtimeConnected])

  useEffect(() => {
    if (!runtimeConnected) {
      setMemoryReady(null)
      return
    }
    let alive = true
    const ac = new AbortController()
    void runtimeApi.memoryReady(combineAbortSignal(ac.signal, 5000)).then((row) => {
      if (!alive) return
      if (!row || row.probe === 'failed' || typeof row.ready !== 'boolean') return
      setMemoryReady(row)
    }).catch(() => undefined)
    return () => {
      alive = false
      ac.abort()
    }
  }, [runtimeConnected])
  useEvents(['memory.engine.changed'], (event) => {
    const payload = event.payload
    if (!payload || typeof payload !== 'object') return
    const row = payload as Record<string, unknown>
    if (row.probe === 'failed' || typeof row.ready !== 'boolean') return
    setMemoryReady(row)
  })

  useEffect(() => {
    if (runtimeConnected) connectedAtRef.current = Date.now()
  }, [runtimeConnected])

  useEffect(() => {
    if (loadingRuntime || !runtimeConnected || !activeWorkspace?.id || activeWorkspace.id.startsWith('ws_')) return
    if (Date.now() < restoreHoldUntilRef.current) return
    if (Date.now() - connectedAtRef.current < 8000) return
    if (visibleSessions.length > 0) {
      ensureWorkspaceSessionRef.current = ''
      return
    }
    const key = `${activeWorkspace.id}:${activeWorkspace.cwd || ''}`
    if (ensureWorkspaceSessionRef.current === key || creatingSession) return
    ensureWorkspaceSessionRef.current = key
    createRemoteSession()
  }, [loadingRuntime, runtimeConnected, activeWorkspaceId, workspaceCwd, visibleSessions.length, creatingSession])

  useEffect(() => {
    if (!runtimeConnected || loadingRuntime) {
      setDshFrameSrc('')
      return
    }
    const sid = chatId || activeId || ''
    if (!sid) {
      setDshFrameSrc('')
      return
    }
    const base = dshAppSrc(runtimeStatus?.bffOrigin)
    setDshFrameSrc((prev) => {
      const prevRoot = prev.split('#')[0].split('?')[0]
      if (prev && prevRoot === base.replace(/\/$/, '')) return prev
      return `${base}#fde-session=${encodeURIComponent(sid)}`
    })
  }, [runtimeConnected, loadingRuntime, runtimeStatus?.bffOrigin, chatId, activeId])

  const flushInboxDraft = () => {
    const text = useApp.getState().aiInboxDraft.trim()
    if (!text) {
      inboxInflightRef.current = false
      return
    }
    if (!runtimeConnected) return
    if (inboxInflightRef.current) return
    inboxInflightRef.current = true
    void currentAiTarget().then((target) => {
      if (!target.ok) {
        inboxInflightRef.current = false
        setSessionNotice(target.error)
        return
      }
      nav(`/ai/${target.sessionId}`)
      tellDsh('select', {
        sessionId: target.sessionId,
        ...(target.workspaceId && !target.workspaceId.startsWith('ws_') ? { workspaceId: target.workspaceId } : {}),
        ...(target.cwd ? { cwd: target.cwd } : {}),
      })
      tellDsh('compose', { sessionId: target.sessionId, text })
    }).catch((error) => {
      inboxInflightRef.current = false
      setSessionNotice(error instanceof Error ? error.message : '没放进输入框')
    })
  }
  flushInboxDraftRef.current = flushInboxDraft

  useEffect(() => {
    flushInboxDraft()
  }, [aiInboxDraft, runtimeConnected, dshFrameSrc])

  useEffect(() => {
    if (!runtimeConnected || !activeId) return
    const row = visibleSessions.find((session) => session.sessionId === activeId)
    if (!row) return
    tellDsh('select', {
      sessionId: activeId,
      ...(row.title ? { title: row.title } : {}),
      ...(activeWorkspaceId && !activeWorkspaceId.startsWith('ws_') ? { workspaceId: activeWorkspaceId } : {}),
      ...(activeWorkspace?.cwd ? { cwd: activeWorkspace.cwd } : {}),
    })
  }, [runtimeConnected, activeId, activeWorkspaceId])

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.origin !== runtimeOrigin(bffOriginRef.current)) return
      const data = event.data
      if (data?.type === 'fde-x-dsh-error' && typeof data.message === 'string') {
        if (forkWaitRef.current) window.clearTimeout(forkWaitRef.current)
        forkPendingRef.current = false
        inboxInflightRef.current = false
        setCreatingSession(false)
        setSessionNotice(data.message)
        setRuntimeError(data.message)
        return
      }
      if (data?.type === 'fde-x-dsh-ready' && data.op === 'composed') {
        inboxInflightRef.current = false
        setAiInboxDraft('')
        setSessionNotice('已放入当前会话输入框')
        return
      }
      if (data?.type === 'fde-x-dsh-ready' && data.op === 'transcript') {
        window.dispatchEvent(new CustomEvent('fde-x-im-transcript', { detail: { sessions: data.sessions || [] } }))
        return
      }
      if (data?.type === 'fde-x-dsh-ready' && data.op === 'assistant' && typeof data.text === 'string') {
        const bind = useApp.getState().imFillBind
        const sid = String(data.sessionId || '')
        if (bind && sid && bind.sessionId === sid) {
          const body = extractComposerBody(data.text)
          useApp.getState().setIMFillBind(null)
          useApp.getState().setIMComposerDraft(bind.threadId, body)
          window.dispatchEvent(new CustomEvent('fde-x-im-fill', { detail: { threadId: bind.threadId, text: body } }))
          setSessionNotice(body ? '已放进 IM 输入框' : '左边写完了，但没有可放进输入框的正文')
        }
        return
      }
      if (data?.type === 'fde-x-dsh-ready' && (data.op === 'openFile' || data.op === 'land')) {
        const kind = data.op === 'openFile' ? 'file' : String(data.kind || 'file')
        const path = typeof data.path === 'string' ? data.path : ''
        const cwd = typeof data.cwd === 'string' ? data.cwd : ''
        if (kind === 'file') {
          if (path && !openFilesAtPath(path, { cwd })) {
            setSessionNotice('无法在当前工作区打开这个文件')
          } else if (!path) {
            landRef('file', { path })
          }
          return
        }
        landRef(kind, {
          sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
          path,
          tab: typeof data.tab === 'string' ? data.tab : '',
          taskId: typeof data.taskId === 'string' ? data.taskId : '',
        })
        return
      }
      if (!data || data.type !== 'fde-x-dsh-ready' || typeof data.sessionId !== 'string') return
      if (forkWaitRef.current) window.clearTimeout(forkWaitRef.current)
      forkPendingRef.current = false
      setCreatingSession(false)
      if (!data.op && useApp.getState().aiInboxDraft.trim()) {
        inboxInflightRef.current = false
        flushInboxDraftRef.current()
      }
      if (!useApp.getState().aiInboxDraft.trim()) setSessionNotice('')
      setRuntimeError(null)
      void reloadRemoteSessions().then((sessions) => {
        if (data.op === 'archived') return
        const openId = resolvePrimarySessionId(data.sessionId, sessions) || data.sessionId
        nav(`/ai/${openId}`)
      })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [nav])

  useEffect(() => {
    const close = () => {
      setChatMenu(null)
      setDeleteConfirmId(null)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  useEffect(() => subscribeAskAiNotice(() => setAskAiNotice(getAskAiNotice())), [])

  const selectChat = (sessionId: string) => {
    nav(`/ai/${sessionId}`)
    const row = visibleSessions.find((session) => session.sessionId === sessionId)
    tellDsh('select', {
      sessionId,
      ...(row?.title ? { title: row.title } : {}),
      ...(activeWorkspaceId && !activeWorkspaceId.startsWith('ws_') ? { workspaceId: activeWorkspaceId } : {}),
      ...(activeWorkspace?.cwd ? { cwd: activeWorkspace.cwd } : {}),
    })
  }

  const createRemoteSession = (presetId?: string) => {
    const workspaceId = activeWorkspace?.id
    if (!workspaceId || workspaceId.startsWith('ws_')) {
      const message = '当前顶栏工作区还不是 DSH 工作区，请先在顶栏选择一个真实工作区'
      setCreateSessionError(message)
      setRuntimeError(message)
      return
    }
    setCreateSessionError('')
    setCreatingSession(true)
    setRuntimeError(null)
    setAgentMenuOpen(false)
    void runtimeApi.createAiSession({
      workspaceId,
      ...(presetId ? { agentPreset: presetId } : {}),
    }).then(async (created) => {
      const sessions = await reloadRemoteSessions()
      const sid = created.sessionId
      nav(`/ai/${sid}`)
      tellDsh('select', { sessionId: sid, workspaceId })
      if (!sessions.some((row) => row.sessionId === sid)) {
        setSessionNotice('会话已创建，正在同步到列表')
      }
    }).catch((cause) => {
      const message = cause instanceof Error ? cause.message : '新建会话失败'
      setCreateSessionError(message)
      setRuntimeError(message)
    }).finally(() => setCreatingSession(false))
  }

  const startRename = (sessionId: string, title: string) => {
    setRenamingId(sessionId)
    setRenameValue(title)
    setChatMenu(null)
  }

  const saveRename = () => {
    const title = renameValue.trim()
    const targetId = renamingId
    setRenamingId(null)
    if (!targetId || !title) return
    tellDsh('rename', { sessionId: targetId, title })
    setRemoteSessions((current) => current.map((session) => (
      session.sessionId === targetId ? { ...session, title } : session
    )))
  }

  const forkManagedChat = (sessionId: string) => {
    setChatMenu(null)
    setSessionNotice('正在分叉会话…')
    setRuntimeError('正在分叉会话…')
    forkPendingRef.current = true
    tellDsh('fork', { sessionId })
    if (forkWaitRef.current) window.clearTimeout(forkWaitRef.current)
    forkWaitRef.current = window.setTimeout(() => {
      if (!forkPendingRef.current) return
      forkPendingRef.current = false
      const message = '分叉超时：请用已经聊完一轮的会话再试。'
      setSessionNotice(message)
      setRuntimeError(message)
    }, 5000)
  }

  const deleteManagedChat = (sessionId: string) => {
    if (deleteConfirmId !== sessionId) {
      setDeleteConfirmId(sessionId)
      return
    }
    setChatMenu(null)
    const next = visibleSessions.find((session) => session.sessionId !== sessionId)
    if (next) nav(`/ai/${next.sessionId}`)
    const finish = () => {
      setDeleteConfirmId(null)
      if (!next) nav('/ai')
      return reloadRemoteSessions().then(setRemoteSessions)
    }
    void runtimeApi.catalogAction({ kind: 'workspace', action: 'archiveSession', sessionId, id: sessionId }).then(finish).catch((error) => {
      setRuntimeError(displayError(error))
      setSessionNotice(displayError(error))
      setDeleteConfirmId(null)
    })
  }

  const statusBanner = loadingRuntime
    ? { tone: 'info' as const, icon: LoaderCircle, text: '正在连接本地核心运行时…', spinning: true }
    : runtimeConnected
      ? askAiNotice
        ? {
            tone: 'warn' as const,
            icon: CircleAlert,
            text: askAiNotice.text,
            spinning: false,
          }
        : {
          tone: (sessionNotice || runtimeError) ? 'warn' as const : 'ok' as const,
          icon: (sessionNotice || runtimeError) ? CircleAlert : Wifi,
          text: sessionNotice || runtimeError || (activeSession && !activeSession.cwd
            ? '当前会话没有绑定工作区目录，输入框会锁住。请新建会话或换一条有目录的会话。'
            : [
                '已连接本地核心，对话由 DSH 会话页运行。',
                memoryReady?.ready === false
                  ? (String(memoryReady.reason || '').includes('exited') || String(memoryReady.detail || '').includes('exited')
                    ? '语义引擎正在拉起。'
                    : '语义引擎未就绪。')
                  : '',
              ].filter(Boolean).join(' ')),
          spinning: false,
        }
      : {
          tone: 'warn' as const,
          icon: WifiOff,
          text: runtimeError ? `核心未接通。${runtimeError}` : '核心未接通，无法打开 AI 会话。',
          spinning: false,
        }

  return (
    <div ref={rootRef} className="h-full flex flex-col bg-surface overflow-hidden">
      <div className={clsx(
        'shrink-0 px-3 py-1.5 text-[11px] flex items-center gap-2 border-b',
        statusBanner.tone === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : statusBanner.tone === 'info' ? 'bg-brand-soft text-brand border-brand/20' : 'bg-amber-50 text-amber-800 border-amber-100',
      )}>
        {(() => {
          const StatusIcon = statusBanner.icon
          return <StatusIcon size={12} className={statusBanner.spinning ? 'animate-spin' : ''} />
        })()}
        <span className="truncate">{statusBanner.text}</span>
        {activeId && terminalBag.actions.length > 0 && (
          <button
            type="button"
            className="btn-ghost h-6 px-2 text-[11px] ml-auto"
            onClick={() => setSessionAccessory((current) => current === 'terminal' ? '' : 'terminal')}
          >
            终端
          </button>
        )}
        {askAiNotice?.sessionId ? (
          <button
            type="button"
            className="shrink-0 btn h-7 px-2 ml-auto"
            onClick={() => {
              selectChat(askAiNotice.sessionId!)
              clearAskAiNotice()
            }}
          >
            打开会话
          </button>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {!runtimeConnected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-ink-muted px-6 text-center">
            本地核心还没接通。请重新执行 `pnpm dev`；本机第二套请用 `pnpm run dev:peer`。
          </div>
        ) : (
          <>
            <aside className={clsx('shrink-0 border-r border-line bg-white flex flex-col', leftOpen ? 'w-56' : 'w-12')}>
              <div className={clsx('flex items-center border-b border-line', leftOpen ? 'justify-between p-2' : 'justify-center py-2')}>
                {leftOpen && <span className="text-xs font-medium text-ink-subtle px-1">会话</span>}
                <button className="btn-ghost p-1 text-ink-subtle" title={leftOpen ? '收起会话栏' : '展开会话栏'} onClick={() => setLeftForced(leftOpen ? false : true)}>
                  {leftOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {leftOpen && workspaceActions.includes('unarchiveSession') && (
                  <div className="flex gap-1 px-2 pt-2">
                    <button type="button" className={clsx('btn-ghost h-7 px-2 text-[11px]', sessionLane === 'live' && 'text-brand')} onClick={() => setSessionLane('live')}>进行中</button>
                    <button type="button" className={clsx('btn-ghost h-7 px-2 text-[11px]', sessionLane === 'archived' && 'text-brand')} onClick={() => setSessionLane('archived')}>归档</button>
                  </div>
                )}
                {leftOpen ? (
                  <ul className="p-2 space-y-1">
                    {visibleSessions.map((session) => {
                      const active = session.sessionId === activeId
                      return (
                        <li key={session.sessionId}>
                          <div className={clsx('w-full px-2 py-2 rounded flex items-start gap-2 group', active ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
                            <button type="button" className="flex-1 min-w-0 text-left flex items-start gap-2" onClick={() => selectChat(session.sessionId)}>
                              <MessageSquare size={16} className="mt-0.5 shrink-0 text-ink-muted" />
                              <div className="min-w-0">
                                {renamingId === session.sessionId ? (
                                  <input
                                    className="w-full bg-white border border-brand/40 rounded px-1.5 py-0.5 text-sm outline-none"
                                    value={renameValue}
                                    autoFocus
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => setRenameValue(event.target.value)}
                                    onBlur={saveRename}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault()
                                        saveRename()
                                      }
                                      if (event.key === 'Escape') setRenamingId(null)
                                    }}
                                  />
                                ) : (
                                  <div className={clsx('text-sm truncate', active && 'font-medium')}>{session.title}</div>
                                )}
                                <div className="text-[11px] text-ink-muted truncate mt-0.5">
                                  {pinnedSessionIds.includes(session.sessionId) ? '置顶 · ' : ''}
                                  {new Date(session.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </button>
                            <div className="relative shrink-0">
                              <button
                                type="button"
                                className={clsx('btn-ghost p-1 text-ink-subtle opacity-0 group-hover:opacity-100', chatMenu?.id === session.sessionId && 'opacity-100')}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setChatMenu((current) => current?.id === session.sessionId ? null : { id: session.sessionId })
                                  setDeleteConfirmId(null)
                                }}
                                title="管理会话"
                              >
                                <MoreHorizontal size={12} />
                              </button>
                              {chatMenu?.id === session.sessionId && (
                                <div className="absolute z-30 right-0 top-7 w-36 bg-surface border border-line rounded-lg shadow-pop p-1" onClick={(event) => event.stopPropagation()}>
                                  <button className="w-full px-2.5 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-surface-2" onClick={() => startRename(session.sessionId, session.title)}>
                                    <Pencil size={12} /> 重命名
                                  </button>
                                  <button className="w-full px-2.5 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-surface-2" onClick={() => forkManagedChat(session.sessionId)}>
                                    <GitBranch size={12} /> 分叉会话
                                  </button>
                                  {workspaceActions.includes('pinSession') && !session.archived && !pinnedSessionIds.includes(session.sessionId) && (
                                    <button className="w-full px-2.5 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-surface-2" onClick={() => {
                                      setChatMenu(null)
                                      void runtimeApi.catalogAction({ kind: 'workspace', action: 'pinSession', sessionId: session.sessionId, id: session.sessionId }).then((bag) => {
                                        setPinnedSessionIds(pinnedIdsFromBag(bag))
                                      }).catch((error) => {
                                        setRuntimeError(displayError(error))
                                        setSessionNotice(displayError(error))
                                      })
                                    }}>
                                      置顶
                                    </button>
                                  )}
                                  {workspaceActions.includes('unpinSession') && pinnedSessionIds.includes(session.sessionId) && (
                                    <button className="w-full px-2.5 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-surface-2" onClick={() => {
                                      setChatMenu(null)
                                      void runtimeApi.catalogAction({ kind: 'workspace', action: 'unpinSession', sessionId: session.sessionId, id: session.sessionId }).then((bag) => {
                                        setPinnedSessionIds(pinnedIdsFromBag(bag))
                                      }).catch((error) => {
                                        setRuntimeError(displayError(error))
                                        setSessionNotice(displayError(error))
                                      })
                                    }}>
                                      取消置顶
                                    </button>
                                  )}
                                  {session.archived && workspaceActions.includes('unarchiveSession') ? (
                                    <button className="w-full px-2.5 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-surface-2" onClick={() => {
                                      setChatMenu(null)
                                      void runtimeApi.catalogAction({ kind: 'workspace', action: 'unarchiveSession', sessionId: session.sessionId, id: session.sessionId }).then(() => reloadRemoteSessions().then(setRemoteSessions)).catch((error) => {
                                        setRuntimeError(displayError(error))
                                        setSessionNotice(displayError(error))
                                      })
                                    }}>
                                      恢复
                                    </button>
                                  ) : workspaceActions.includes('archiveSession') ? (
                                    <button className="w-full px-2.5 py-1.5 rounded text-xs flex items-center gap-2 text-accent-red hover:bg-red-50" onClick={() => deleteManagedChat(session.sessionId)}>
                                      <Trash2 size={12} /> {deleteConfirmId === session.sessionId ? '再次点击归档' : '归档'}
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="py-2 space-y-1">
                    {visibleSessions.map((session) => (
                      <button
                        key={session.sessionId}
                        type="button"
                        title={session.title}
                        onClick={() => selectChat(session.sessionId)}
                        className={clsx('w-full flex justify-center py-1.5', session.sessionId === activeId ? 'bg-brand-soft' : 'hover:bg-surface-2')}
                      >
                        <MessageSquare size={16} className="text-ink-muted" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={clsx('border-t border-line', leftOpen ? 'p-2' : 'p-1.5')}>
                <button className={clsx('btn-primary w-full', !leftOpen && 'px-1')} onClick={() => setAgentMenuOpen(true)} title="新建会话">
                  <Plus size={14} />
                  {leftOpen && <span className="ml-1.5">新会话</span>}
                </button>
              </div>
            </aside>
            <div className="flex-1 min-h-0 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0 min-w-0 relative">
                {!activeId ? (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted px-6 text-center">
                    当前工作区还没有会话
                  </div>
                ) : dshFrameSrc ? (
                  <iframe
                    ref={dshFrameRef}
                    title="DSH 会话"
                    src={dshFrameSrc}
                    allow="clipboard-read; clipboard-write"
                    className="absolute inset-0 w-full h-full border-0 bg-white"
                    onLoad={() => {
                      const sid = activeIdRef.current
                      if (!sid) return
                      tellDsh('select', {
                        sessionId: sid,
                        ...(activeWorkspaceId && !activeWorkspaceId.startsWith('ws_') ? { workspaceId: activeWorkspaceId } : {}),
                        ...(workspaceCwdRef.current ? { cwd: workspaceCwdRef.current } : {}),
                      })
                    }}
                  />
                ) : null}
                {dropActive && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand/15 border-2 border-dashed border-brand text-sm font-medium text-brand pointer-events-auto">
                    放到这里，发给当前会话
                  </div>
                )}
              </div>
              {sessionAccessory === 'terminal' && activeId && (
                <div className="shrink-0 border-t border-line px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-ink-muted">终端 · 当前会话</div>
                    <div className="flex items-center gap-1">
                      {terminalBag.actions.includes('create') && (
                        <button
                          type="button"
                          className="btn-ghost h-7 px-2 text-[11px]"
                          onClick={() => {
                            const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `term-${Date.now()}`
                            setTerminalNote('')
                            const band = terminalBandRef.current
                            const grid = proposeTerminalGrid(band?.clientWidth || 0, band?.clientHeight || 0)
                            void runtimeApi.catalogAction({
                              kind: 'terminal',
                              action: 'create',
                              sessionId: activeId,
                              id,
                              params: { id, cols: grid.cols, rows: grid.rows },
                            }).then((bag) => {
                              const next = bag && typeof bag === 'object' ? bag as { items?: Array<{ id: string; title: string }>; actions?: string[]; mutation?: { id?: string } } : {}
                              const items = Array.isArray(next.items) ? next.items.map((row) => ({ id: row.id, title: row.title })) : []
                              setTerminalBag({ items, actions: Array.isArray(next.actions) ? next.actions : terminalBag.actions })
                              setTerminalId(String(next.mutation?.id || id))
                            }).catch((error) => setTerminalNote(displayError(error)))
                          }}
                        >
                          打开
                        </button>
                      )}
                      <button type="button" className="btn-ghost h-7 px-2 text-[11px]" onClick={() => setSessionAccessory('')}>
                        关闭
                      </button>
                    </div>
                  </div>
                  {terminalBag.items.length > 1 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {terminalBag.items.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          className={clsx('btn-ghost h-7 px-2 text-[11px]', terminalId === row.id && 'text-brand')}
                          onClick={() => setTerminalId(row.id)}
                        >
                          {row.title || row.id}
                        </button>
                      ))}
                    </div>
                  )}
                  <div ref={terminalBandRef} className="mt-1.5 h-48 w-full overflow-hidden bg-ink">
                    {terminalId && terminalBag.actions.includes('follow') ? (
                      <Suspense fallback={<div className="text-xs text-ink-muted p-2">终端加载中…</div>}>
                        <AiTerminal
                          sessionId={activeId}
                          terminalId={terminalId}
                          attachmentId={attachmentFor(terminalId)}
                          canWrite={terminalBag.actions.includes('write')}
                          canResize={terminalBag.actions.includes('resize')}
                          onError={setTerminalNote}
                          onStopped={dropStoppedTerminal}
                          onSuspectStopped={suspectStoppedTerminal}
                        />
                      </Suspense>
                    ) : (
                      <div className="text-xs text-ink-muted p-2">
                        {terminalBag.items.length
                          ? terminalBag.items.map((row) => row.title || row.id).join(' · ')
                          : (terminalBag.actions.length ? '当前会话还没有终端。' : '当前核心没有把终端投影到这一块。')}
                      </div>
                    )}
                  </div>
                  {terminalNote && <div className="text-[11px] text-accent-red mt-1">{terminalNote}</div>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {agentMenuOpen && createPortal(
        <div className="fixed inset-0 z-[200] bg-ink/20 flex items-center justify-center p-4" onClick={() => setAgentMenuOpen(false)}>
          <div className="bg-surface border border-line rounded-xl shadow-pop w-full max-w-sm overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">新建 AI 会话</div>
                <div className="text-xs text-ink-muted mt-0.5">选择 Agent preset，工作区使用顶栏当前目录</div>
              </div>
              <button className="btn-ghost p-1" onClick={() => setAgentMenuOpen(false)} aria-label="关闭">
                <X size={15} />
              </button>
            </div>
            {createSessionError && <div className="px-4 py-2 text-xs text-accent-red border-b border-line">{createSessionError}</div>}
            {creatingSession && <div className="px-4 py-2 text-xs text-ink-muted border-b border-line">正在创建会话…</div>}
            <div className="p-2 max-h-[60vh] overflow-auto">
              {presetRoster.map((preset) => (
                <button
                  key={preset.id}
                  disabled={creatingSession}
                  onClick={() => createRemoteSession(preset.id)}
                  className="w-full px-3 py-2.5 flex items-center gap-3 text-left rounded-lg hover:bg-surface-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{preset.name ?? preset.id}</div>
                    {preset.description && <div className="text-xs text-ink-muted mt-0.5 line-clamp-2">{preset.description}</div>}
                  </div>
                </button>
              ))}
              {presetRoster.length === 0 && <div className="px-3 py-8 text-center text-sm text-ink-muted">没有可用的 Agent preset</div>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
