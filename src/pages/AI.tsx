import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CircleAlert, GitBranch, LoaderCircle, MessageSquare, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2, Wifi, WifiOff, X,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { extractComposerBody } from '@/lib/im-ai'
import {
  runtimeApi,
  RuntimeApiError,
  type AiRuntimeStatus,
  type AiSessionSummary,
} from '@/lib/runtime-api'

const MIN_LEFT_OPEN = 720

function displayError(error: unknown) {
  if (error instanceof RuntimeApiError) return error.message
  return error instanceof Error ? error.message : 'AI 运行时发生未知错误'
}

function defaultBffOrigin() {
  const protocol = window.location.protocol
  const hostname = window.location.hostname || '127.0.0.1'
  const pagePort = window.location.port
  const runtimePort = pagePort === '5175' ? '4319' : '4318'
  return `${protocol}//${hostname}:${runtimePort}`
}

function runtimeOrigin(bffOrigin?: string | null) {
  return String(bffOrigin || defaultBffOrigin()).replace(/\/$/, '')
}

function dshAppSrc(bffOrigin?: string | null) {
  return `${runtimeOrigin(bffOrigin)}/dsh-app/`
}

export default function AI() {
  const { chatId } = useParams()
  const nav = useNavigate()
  const liveWorkspaces = useApp((s) => s.workspaces)
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId)
  const replaceWorkspaces = useApp((s) => s.replaceWorkspaces)
  const setActiveAiSessionId = useApp((s) => s.setActiveAiSessionId)
  const aiInboxDraft = useApp((s) => s.aiInboxDraft)
  const setAiInboxDraft = useApp((s) => s.setAiInboxDraft)
  const workspaceCwd = liveWorkspaces.find((item) => item.id === activeWorkspaceId)?.cwd

  const [runtimeStatus, setRuntimeStatus] = useState<AiRuntimeStatus | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [sessionNotice, setSessionNotice] = useState('')
  const [remoteSessions, setRemoteSessions] = useState<AiSessionSummary[]>([])
  const [hiddenSessionIds, setHiddenSessionIds] = useState<string[]>([])
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

  const rootRef = useRef<HTMLDivElement>(null)
  const dshFrameRef = useRef<HTMLIFrameElement>(null)
  const activeIdRef = useRef<string | undefined>(undefined)
  const bffOriginRef = useRef('')
  const forkWaitRef = useRef<number | null>(null)
  const forkPendingRef = useRef(false)
  const fillThreadRef = useRef('')
  const ensureWorkspaceSessionRef = useRef('')
  const restoreHoldUntilRef = useRef(0)
  const connectedAtRef = useRef(0)
  const workspaceCwdRef = useRef(workspaceCwd)
  const [dshFrameSrc, setDshFrameSrc] = useState('')

  const runtimeConnected = runtimeStatus?.connected === true
  const visibleSessions = useMemo(
    () => remoteSessions.filter((session) => {
      if (session.origin === 'subagent') return false
      if (hiddenSessionIds.includes(session.sessionId)) return false
      if (workspaceCwd && session.cwd && session.cwd !== workspaceCwd) return false
      return true
    }),
    [remoteSessions, workspaceCwd, hiddenSessionIds],
  )
  const activeId = runtimeConnected
    ? (chatId || visibleSessions[0]?.sessionId)
    : undefined

  const leftOpen = leftForced ?? width >= MIN_LEFT_OPEN
  const activeWorkspace = liveWorkspaces.find((item) => item.id === activeWorkspaceId)
  const activeSession = visibleSessions.find((session) => session.sessionId === activeId)

  async function reloadRemoteSessions(signal?: AbortSignal) {
    const sessions = await runtimeApi.listAiSessions({ includeBlank: true }, signal)
    setRemoteSessions(sessions)
    return sessions
  }

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
        const rows = await runtimeApi.listAiSessions({ includeBlank: true }).catch(() => [])
        setRemoteSessions(rows.map((row) => (titles.get(row.sessionId) ? { ...row, title: titles.get(row.sessionId)! } : row)))
        const title = titles.get(sid) || ''
        nav(`/ai/${sid}`)
        const origin = bffOriginRef.current || defaultBffOrigin()
        setDshFrameSrc(`${dshAppSrc(origin)}?restore=${Date.now()}#fde-session=${encodeURIComponent(sid)}`)
        if (title) tellDsh('rename', { sessionId: sid, title })
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
      const sid = activeIdRef.current || ''
      if (!sid) {
        setSessionNotice('当前工作区还没有打开的会话')
        return
      }
      fillThreadRef.current = String(detail?.fillThreadId || '')
      if (detail?.readOnly) {
        tellDsh('readAssistant', { sessionId: sid })
        return
      }
      const text = String(detail?.text || '').trim()
      if (!text) return
      tellDsh('prompt', { sessionId: sid, text })
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
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragend', onDragEnd)
      window.removeEventListener('fde-x-attach-file', onAttach as EventListener)
      window.removeEventListener('fde-x-ai-prompt', onPrompt as EventListener)
      window.removeEventListener('fde-x-ai-transcript', onTranscript as EventListener)
      window.removeEventListener('fde-x-ai-restore', onRestore as EventListener)
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
        const [sessions, roster, dshWorkspaces] = await Promise.all([
          runtimeApi.listAiSessions({ includeBlank: true }, abort.signal),
          runtimeApi.listAiPresets(abort.signal).catch(() => ({ presets: [] as Array<{ id: string }> })),
          runtimeApi.listAiWorkspaces(abort.signal).catch(() => []),
        ])
        if (!active) return
        setRemoteSessions(sessions)
        setPresetRoster(Array.isArray(roster.presets) ? roster.presets : [])
        if (dshWorkspaces.length) {
          replaceWorkspaces(dshWorkspaces.map((item) => ({
            id: item.workspaceId,
            name: item.title || item.path.split('/').filter(Boolean).at(-1) || item.path,
            emoji: '📁',
            desc: item.path,
            cwd: item.path,
            createdAt: new Date().toISOString(),
          })))
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
    const tick = () => {
      void runtimeApi.memoryReady().then((row) => {
        if (alive) setMemoryReady(row)
      }).catch(() => undefined)
    }
    tick()
    const timer = window.setInterval(tick, 8000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [runtimeConnected])

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
    setDshFrameSrc(`${dshAppSrc(runtimeStatus?.bffOrigin)}${sid ? `#fde-session=${encodeURIComponent(sid)}` : ''}`)
  }, [runtimeConnected, loadingRuntime, activeWorkspaceId, runtimeStatus?.bffOrigin, chatId, activeId])

  useEffect(() => {
    const text = aiInboxDraft.trim()
    if (!text || !runtimeConnected || !activeId) return
    tellDsh('compose', { sessionId: activeId, text })
  }, [aiInboxDraft, runtimeConnected, activeId])

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
        setCreatingSession(false)
        setSessionNotice(data.message)
        setRuntimeError(data.message)
        return
      }
      if (data?.type === 'fde-x-dsh-ready' && data.op === 'composed') {
        setAiInboxDraft('')
        setSessionNotice('已放入当前会话输入框')
        return
      }
      if (data?.type === 'fde-x-dsh-ready' && data.op === 'transcript') {
        window.dispatchEvent(new CustomEvent('fde-x-im-transcript', { detail: { sessions: data.sessions || [] } }))
        return
      }
      if (data?.type === 'fde-x-dsh-ready' && data.op === 'assistant' && typeof data.text === 'string') {
        const threadId = fillThreadRef.current
        const body = extractComposerBody(data.text)
        fillThreadRef.current = ''
        if (threadId) {
          useApp.getState().setIMComposerDraft(threadId, body)
          window.dispatchEvent(new CustomEvent('fde-x-im-fill', { detail: { threadId, text: body } }))
          setSessionNotice(body ? '已放进 IM 输入框' : '左边写完了，但没有可放进输入框的正文')
        }
        return
      }
      if (!data || data.type !== 'fde-x-dsh-ready' || typeof data.sessionId !== 'string') return
      if (forkWaitRef.current) window.clearTimeout(forkWaitRef.current)
      forkPendingRef.current = false
      setCreatingSession(false)
      setSessionNotice('')
      setRuntimeError(null)
      void reloadRemoteSessions().then(() => {
        if (data.op === 'archived') return
        nav(`/ai/${data.sessionId}`)
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
    void runtimeApi.archiveAiSession(sessionId).then(() => {
      setHiddenSessionIds((current) => current.includes(sessionId) ? current : [...current, sessionId])
      setDeleteConfirmId(null)
      if (!next) nav('/ai')
    }).catch((error) => {
      setRuntimeError(displayError(error))
      setSessionNotice(displayError(error))
      setDeleteConfirmId(null)
    })
  }

  const statusBanner = loadingRuntime
    ? { tone: 'info' as const, icon: LoaderCircle, text: '正在连接本地核心运行时…', spinning: true }
    : runtimeConnected
      ? {
          tone: (sessionNotice || runtimeError || memoryReady?.ready === false) ? 'warn' as const : 'ok' as const,
          icon: (sessionNotice || runtimeError || memoryReady?.ready === false) ? CircleAlert : Wifi,
          text: sessionNotice || runtimeError || (activeSession && !activeSession.cwd
            ? '当前会话没有绑定工作区目录，输入框会锁住。请新建会话或换一条有目录的会话。'
            : memoryReady?.ready === false
              ? (String(memoryReady.reason || '').includes('exited') || String(memoryReady.detail || '').includes('exited')
                ? '已连接本地核心。语义引擎刚退出，正在重新拉起，稍后记忆工具可用。'
                : `已连接本地核心，但语义引擎未就绪（${String(memoryReady.detail || memoryReady.reason || 'NOT_READY')}）。记忆工具会失败，去设置 → 语义记忆看原因。`)
              : '已连接本地核心，对话由 DSH 会话页运行。'),
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
                                  <button className="w-full px-2.5 py-1.5 rounded text-xs flex items-center gap-2 text-accent-red hover:bg-red-50" onClick={() => deleteManagedChat(session.sessionId)}>
                                    <Trash2 size={12} /> {deleteConfirmId === session.sessionId ? '再次点击删除' : '删除'}
                                  </button>
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
            <div className="flex-1 min-h-0 min-w-0 relative">
              {dshFrameSrc ? (
                <iframe
                  key={dshFrameSrc}
                  ref={dshFrameRef}
                  title="DSH 会话"
                  src={dshFrameSrc}
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
