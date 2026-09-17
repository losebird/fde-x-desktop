import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, CircleAlert, Plus, Search, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { Card, Empty } from '@/components/ui'
import { BizPreviewDrawer } from '@/components/biz/BizPreviewDrawer'
import { SpecTable } from '@/components/apps/SpecTable'
import {
  formatSheetCellValue,
  normalizeSheetColumns,
  normalizeSheetRows,
  sheetRowKey,
  type SheetColumn,
  type SheetRow,
} from '@/lib/biz-sheet-display'
import { ContextChips } from '@/components/ai/ContextChips'
import { buildContextPack, renderContextForPrompt, type ContextPack } from '@/lib/context-pack'
import { loadCurrentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import {
  RuntimeApiError,
  runtimeApi,
  type BizSurfaceRecord,
  type BusinessAppRecord,
  type BusinessConnectionRecord,
} from '@/lib/runtime-api'
import { isFdeAppSpec } from '@/lib/app-spec'
import {
  clearBizPendingSheet,
  clearBizPreviewDismissed,
  dismissBizPreviewId,
  isBizPreviewDismissed,
  peekBizPendingSheet,
  rememberBizPendingSheet,
} from '@/lib/biz-session-sheet'
import { useEvents } from '@/lib/events'

const PAGE_SIZE = 10

type PendingSurface = {
  kind: string
  action: string
  previewId?: string
  rows: number
  canWrite?: boolean
  source?: string
  sessionId?: string
  at: number
}

type PendingSheetEvent = PendingSurface & {
  sheet?: Record<string, unknown>
}

type SheetSnapshot = {
  sheet: Record<string, unknown>
  connName: string
  surfaceId?: string
}

type ListRestoreSnapshot = {
  rows: SheetRow[]
  columns: SheetColumn[]
  page: number
  draftEdits: Record<string, SheetRow>
  sourceLabel: string
  connName: string
  surfaceId?: string
  sheet: Record<string, unknown>
}

type Props = {
  connections: BusinessConnectionRecord[]
  apps: BusinessAppRecord[]
  runtimeReady: boolean
  onPlan: () => void
  onPlanWithTarget?: (target: { targetRef: string; kind: string; no?: string }) => void
}

function formatBizPanelError(cause: unknown, fallback: string) {
  if (cause instanceof RuntimeApiError) {
    const msg = cause.message.trim()
    if (msg && !msg.includes('IM 调用失败')) return msg
    return fallback
  }
  if (cause instanceof Error && cause.message.trim()) return cause.message
  return fallback
}

function formatSurfaceTime(at: number) {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000))
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  return `${Math.round(mins / 60)} 小时前`
}

function sheetPreviewId(sheet: Record<string, unknown>) {
  const id = sheet.preview_id ?? sheet.previewId
  return typeof id === 'string' ? id : ''
}

function EditableSheetCell({
  value,
  onChange,
}: {
  value: unknown
  onChange: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const raw = value == null ? '' : String(value)

  if (!editing) {
    return (
      <button
        type="button"
        className="w-full min-h-8 rounded border border-transparent px-2 py-1.5 text-left text-sm hover:border-line hover:bg-white"
        onClick={(event) => {
          event.stopPropagation()
          setEditing(true)
        }}
      >
        {formatSheetCellValue(value)}
      </button>
    )
  }

  return (
    <input
      autoFocus
      className="input h-8 w-full text-xs"
      value={raw}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setEditing(false)}
    />
  )
}

export function RecordsPanel({ connections, apps, runtimeReady, onPlan, onPlanWithTarget }: Props) {
  const [workspaceCwd, setWorkspaceCwd] = useState('')
  const [lanReady, setLanReady] = useState(true)
  const [gateHint, setGateHint] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [kind, setKind] = useState('')
  const [query, setQuery] = useState('')
  const [columns, setColumns] = useState<SheetColumn[]>([])
  const [rows, setRows] = useState<SheetRow[]>([])
  const [sourceLabel, setSourceLabel] = useState('')
  const [pending, setPending] = useState<PendingSurface | null>(null)
  const [surfaces, setSurfaces] = useState<BizSurfaceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [staleHint, setStaleHint] = useState('')
  const [selectedRow, setSelectedRow] = useState<SheetRow | null>(null)
  const [page, setPage] = useState(1)
  const [draftEdits, setDraftEdits] = useState<Record<string, SheetRow>>({})
  const [createDraft, setCreateDraft] = useState<Record<string, string> | null>(null)
  const [drawer, setDrawer] = useState<{
    previewId: string
    sheet: Record<string, unknown>
    canWrite: boolean
    gateReason?: string
    originalRow?: SheetRow
  } | null>(null)
  const [listRestore, setListRestore] = useState<ListRestoreSnapshot | null>(null)
  const [contextPack, setContextPack] = useState<ContextPack | null>(null)
  const [contextWarnings, setContextWarnings] = useState<string[]>([])
  const [omit, setOmit] = useState<Set<string>>(new Set())
  const sheetSnapshots = useRef<Map<string, SheetSnapshot>>(new Map())
  const listRestoreRef = useRef<ListRestoreSnapshot | null>(null)
  const showRecordsBack = Boolean(listRestore)

  const localApps = useMemo(
    () => apps.filter((app) => isFdeAppSpec(app.definition)),
    [apps],
  )
  const connectorOptions = useMemo(() => {
    const external = connections.map((c) => ({ id: c.id, label: c.name }))
    const local = localApps.map((a) => ({ id: `local:${a.id}`, label: `本地 · ${a.name}` }))
    return [...external, ...local]
  }, [connections, localApps])

  const surfacedKinds = useMemo(() => {
    const byKind = new Map<string, { kind: string; label: string; latestAt: number }>()
    for (const surface of surfaces) {
      const k = surface.kind
      if (!k) continue
      const at = surface.createdAt || 0
      const prev = byKind.get(k)
      if (!prev || at > prev.latestAt) {
        byKind.set(k, { kind: k, label: k, latestAt: at })
      }
    }
    if (pending?.kind && !byKind.has(pending.kind)) {
      byKind.set(pending.kind, { kind: pending.kind, label: pending.kind, latestAt: pending.at })
    }
    return [...byKind.values()].sort((a, b) => b.latestAt - a.latestAt)
  }, [surfaces, pending])

  const pendingRowTotal = pending?.rows ?? 0
  const hasSurfacedData = rows.length > 0
    || (pendingRowTotal > 0 && Boolean(pending?.kind))
    || surfaces.some((s) => (s.rowCount ?? 0) > 0)

  const activeLocalApp = useMemo(() => {
    if (!connectionId.startsWith('local:')) return null
    const appId = connectionId.slice('local:'.length)
    const app = localApps.find((a) => a.id === appId)
    if (!app || !isFdeAppSpec(app.definition)) return null
    const spec = app.definition
    const tableView = spec.views.find((v) => v.type === 'table') || spec.views[0]
    return { app, spec, tableView }
  }, [connectionId, localApps])

  useEffect(() => {
    const ws = loadCurrentWorkspaceCwd()
    if (ws.ok) setWorkspaceCwd(ws.cwd)
  }, [])

  const rememberSheet = useCallback((snapshot: SheetSnapshot) => {
    const k = String(snapshot.sheet.kind || '')
    const previewId = sheetPreviewId(snapshot.sheet)
    if (k) sheetSnapshots.current.set(`kind:${k}`, snapshot)
    if (previewId) sheetSnapshots.current.set(`preview:${previewId}`, snapshot)
    if (snapshot.surfaceId) sheetSnapshots.current.set(`surface:${snapshot.surfaceId}`, snapshot)
  }, [])

  const captureListRestore = useCallback((): ListRestoreSnapshot => {
    const kindSnap = kind ? sheetSnapshots.current.get(`kind:${kind}`) : undefined
    const snapRows = kindSnap?.sheet ? normalizeSheetRows(kindSnap.sheet.rows) : []
    const snapCols = kindSnap?.sheet ? normalizeSheetColumns(kindSnap.sheet.columns) : []
    const restoreRows = rows.length > 0 ? rows : snapRows
    const restoreColumns = columns.length > 0 ? columns : snapCols
    const sheet = kindSnap?.sheet
      ? { ...kindSnap.sheet, rows: restoreRows, columns: restoreColumns }
      : { kind, rows: restoreRows, columns: restoreColumns, action: '现查' }
    return {
      rows: restoreRows,
      columns: restoreColumns,
      page,
      draftEdits,
      sourceLabel: sourceLabel || (kindSnap?.connName ? `${kindSnap.connName} · 现查` : ''),
      connName: kindSnap?.connName || '连接器',
      surfaceId: kindSnap?.surfaceId,
      sheet,
    }
  }, [columns, draftEdits, kind, page, rows, sourceLabel])

  const commitListRestore = useCallback((snap: ListRestoreSnapshot | null) => {
    listRestoreRef.current = snap
    setListRestore(snap)
  }, [])

  const shouldSaveListRestore = useCallback((incomingSheet: Record<string, unknown>) => {
    const kindSnap = kind ? sheetSnapshots.current.get(`kind:${kind}`) : undefined
    const snapRowCount = kindSnap?.sheet && Array.isArray(kindSnap.sheet.rows)
      ? kindSnap.sheet.rows.length
      : 0
    const currentRows = rows.length > 0 ? rows.length : snapRowCount
    if (currentRows === 0) return false
    const action = String(incomingSheet.action || '')
    const incomingCount = Array.isArray(incomingSheet.rows) ? incomingSheet.rows.length : 0
    const postAction = action !== '现查'
    const narrowing = incomingCount > 0 && incomingCount < currentRows
    if (listRestoreRef.current) {
      return currentRows > 1 && (postAction || narrowing)
    }
    if (currentRows > 1 && (postAction || narrowing)) return true
    return narrowing
  }, [kind, rows.length])

  const maybeSaveListRestore = useCallback((incomingSheet: Record<string, unknown>) => {
    if (!shouldSaveListRestore(incomingSheet)) return
    commitListRestore(captureListRestore())
  }, [captureListRestore, commitListRestore, shouldSaveListRestore])

  const restoreRecordsList = useCallback(() => {
    const snap = listRestoreRef.current
    if (!snap) return false
    setColumns(snap.columns)
    setRows(snap.rows)
    setDraftEdits(snap.draftEdits)
    setPage(snap.page)
    setSourceLabel(snap.sourceLabel)
    rememberSheet({
      sheet: snap.sheet,
      connName: snap.connName,
      surfaceId: snap.surfaceId,
    })
    rememberBizPendingSheet(snap.sheet)
    commitListRestore(null)
    return true
  }, [commitListRestore, rememberSheet])

  const handleRecordsBack = useCallback(() => {
    const pendingSheet = peekBizPendingSheet()
    const previewId = drawer?.previewId
      || (pendingSheet ? sheetPreviewId(pendingSheet) : '')
    if (previewId) dismissBizPreviewId(previewId)
    setDrawer(null)
    clearBizPendingSheet()
    restoreRecordsList()
    void runtimeApi.bizDismissPreview().catch(() => undefined)
  }, [drawer?.previewId, restoreRecordsList])

  const dismissPreviewDrawer = useCallback(() => {
    handleRecordsBack()
  }, [handleRecordsBack])

  const applySheet = useCallback((sheet: Record<string, unknown>, connName: string, surfaceId?: string) => {
    const normalizedCols = normalizeSheetColumns(sheet.columns)
    setColumns(normalizedCols)
    setRows(normalizeSheetRows(sheet.rows))
    setDraftEdits({})
    setPage(1)
    const action = String(sheet.action || '现查')
    const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
    setSourceLabel(`${connName} · ${action} ${time}`)
    const nextKind = String(sheet.kind || '')
    if (nextKind) setKind(nextKind)
    setStaleHint('')
    rememberSheet({ sheet, connName, surfaceId })
  }, [rememberSheet])

  const probeLanAssist = useCallback(async () => {
    try {
      await runtimeApi.getBizPendingSheet()
      setLanReady(true)
      setGateHint('')
    } catch {
      setLanReady(false)
      setGateHint('事务底座未就绪')
    }
  }, [])

  const loadSurfaces = useCallback(async () => {
    if (!workspaceCwd) return
    try {
      setSurfaces(await runtimeApi.listBizSurfaces(workspaceCwd, 20))
    } catch { /* ignore */ }
  }, [workspaceCwd])

  const applyPendingSheet = useCallback((sheet: Record<string, unknown>, surfaceId?: string) => {
    const rowCount = Array.isArray(sheet.rows) ? sheet.rows.length : 0
    if (!rowCount && !sheet.kind) return false
    const conn = connections.find((c) => c.id === connectionId) || connections[0]
    const previewId = sheetPreviewId(sheet)
    const action = String(sheet.action || '')
    const isWritePreview = Boolean(previewId && action !== '现查')
    if (isWritePreview && isBizPreviewDismissed(sheet)) {
      if (listRestoreRef.current) return true
      maybeSaveListRestore(sheet)
      applySheet(sheet, conn?.name || '连接器', surfaceId)
      return rowCount > 0 || Boolean(sheet.kind)
    }
    rememberBizPendingSheet(sheet)
    maybeSaveListRestore(sheet)
    applySheet(sheet, conn?.name || '连接器', surfaceId)
    if (isWritePreview) {
      setDrawer({
        previewId,
        sheet,
        canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
      })
    }
    return rowCount > 0 || Boolean(sheet.kind)
  }, [applySheet, connectionId, connections, maybeSaveListRestore])

  const hydrateFromPending = useCallback(async (surfaceId?: string) => {
    const cached = peekBizPendingSheet()
    if (cached) {
      if (isBizPreviewDismissed(cached)) {
        if (listRestoreRef.current) return true
      } else if (applyPendingSheet(cached, surfaceId)) {
        return true
      }
    }
    try {
      const { sheet } = await runtimeApi.getBizPendingSheet()
      if (!sheet || typeof sheet !== 'object') return false
      if (isBizPreviewDismissed(sheet)) {
        if (listRestoreRef.current) return true
        return applyPendingSheet(sheet, surfaceId)
      }
      return applyPendingSheet(sheet, surfaceId)
    } catch {
      return false
    }
  }, [applyPendingSheet])

  useEffect(() => {
    if (!connectionId && connectorOptions[0]) setConnectionId(connectorOptions[0].id)
  }, [connectionId, connectorOptions])

  useEffect(() => {
    if (runtimeReady) void probeLanAssist()
  }, [probeLanAssist, runtimeReady])

  useEffect(() => {
    void loadSurfaces()
  }, [loadSurfaces])

  useEffect(() => {
    if (!runtimeReady || !workspaceCwd || activeLocalApp) return
    void hydrateFromPending()
  }, [activeLocalApp, hydrateFromPending, runtimeReady, workspaceCwd])

  useEffect(() => {
    if (!runtimeReady || !workspaceCwd || activeLocalApp) return
    if (surfaces.length === 0) return
    const latest = surfaces[0]
    if (kind) return
    setKind(latest.kind)
    if (latest.connectionId) setConnectionId(latest.connectionId)
    void (async () => {
      const cached = sheetSnapshots.current.get(`surface:${latest.id}`) || sheetSnapshots.current.get(`kind:${latest.kind}`)
      if (cached) {
        applySheet(cached.sheet, cached.connName, latest.id)
        return
      }
      const matchedPending = await hydrateFromPending(latest.id)
      if (!matchedPending) {
        setStaleHint('该条浮现的行已不在待确认区；请在 AI 会话里重新现查或改行，不要在此整表浏览。')
        setRows([])
        setColumns(Array.isArray(latest.columns) ? latest.columns as SheetColumn[] : [])
      }
    })()
  }, [activeLocalApp, applySheet, hydrateFromPending, kind, runtimeReady, surfaces, workspaceCwd])

  useEvents(['biz.sheet.pending'], (event) => {
    const payload = event.payload as PendingSheetEvent
    const rowCount = typeof payload.rows === 'number' ? payload.rows : 0
    const nextPending: PendingSurface = {
      kind: String(payload.kind || ''),
      action: String(payload.action || ''),
      previewId: payload.previewId,
      rows: rowCount,
      canWrite: payload.canWrite,
      source: payload.source,
      sessionId: payload.sessionId,
      at: Date.now(),
    }
    setPending(nextPending)
    if (payload.sheet && typeof payload.sheet === 'object') {
      applyPendingSheet(payload.sheet)
    } else {
      void hydrateFromPending()
    }
    void loadSurfaces()
  })

  const runPreview = useCallback(async (
    action: string,
    extra: Record<string, unknown> & { originalRow?: SheetRow } = {},
  ) => {
    if (!lanReady || activeLocalApp || !kind) return
    setLoading(true)
    setError('')
    setStaleHint('')
    const { originalRow, ...payloadExtra } = extra
    try {
      const conn = connections.find((c) => c.id === connectionId)
      const system = conn?.provider || 'NocoBase'
      const data = await runtimeApi.bizPreview({
        kind,
        action,
        system,
        connectionId,
        speech: `${action}${kind}`,
        ...payloadExtra,
      })
      const sheet = (data.sheet && typeof data.sheet === 'object' ? data.sheet : data) as Record<string, unknown>
      const previewId = sheetPreviewId(sheet)
      const canWrite = Boolean(sheet.canWrite ?? sheet.can_write ?? data.canWrite)
      maybeSaveListRestore(sheet)
      applySheet(sheet, conn?.name || '连接器')
      if (action !== '现查' && previewId) {
        clearBizPreviewDismissed(previewId)
        setDrawer({
          previewId,
          sheet,
          canWrite,
          gateReason: typeof data.hint === 'string' ? data.hint : undefined,
          originalRow,
        })
      }
      if (action === '新建') setCreateDraft(null)
      void loadSurfaces()
    } catch (cause) {
      setError(cause instanceof RuntimeApiError ? cause.message : cause instanceof Error ? cause.message : '预览失败')
    } finally {
      setLoading(false)
    }
  }, [activeLocalApp, applySheet, connectionId, connections, kind, lanReady, loadSurfaces, maybeSaveListRestore])

  const loadSurface = useCallback(async (surface: BizSurfaceRecord) => {
    setKind(surface.kind)
    if (surface.connectionId) setConnectionId(surface.connectionId)
    setStaleHint('')
    const cached = sheetSnapshots.current.get(`surface:${surface.id}`) || sheetSnapshots.current.get(`kind:${surface.kind}`)
    if (cached) {
      maybeSaveListRestore(cached.sheet)
      applySheet(cached.sheet, cached.connName, surface.id)
      if (surface.previewId && surface.action !== '现查' && !isBizPreviewDismissed({ previewId: surface.previewId, action: surface.action })) {
        setDrawer({
          previewId: surface.previewId,
          sheet: cached.sheet,
          canWrite: true,
        })
      }
      return
    }
    const hydrated = await hydrateFromPending(surface.id)
    if (!hydrated) {
      setRows([])
      setColumns(Array.isArray(surface.columns) ? surface.columns as SheetColumn[] : [])
      setStaleHint('该条浮现的行已不在待确认区；请在 AI 会话里重新现查或改行。')
    } else if (surface.previewId && surface.action !== '现查' && !isBizPreviewDismissed({ previewId: surface.previewId, action: surface.action })) {
      const snap = sheetSnapshots.current.get(`surface:${surface.id}`)
      setDrawer({
        previewId: surface.previewId,
        sheet: snap?.sheet || { kind: surface.kind, action: surface.action },
        canWrite: true,
      })
    }
  }, [applySheet, hydrateFromPending, maybeSaveListRestore])

  const selectKind = useCallback((nextKind: string) => {
    setKind(nextKind)
    setStaleHint('')
    const cached = sheetSnapshots.current.get(`kind:${nextKind}`)
    if (cached) {
      applySheet(cached.sheet, cached.connName, cached.surfaceId)
      return
    }
    const surface = surfaces.find((s) => s.kind === nextKind)
    if (surface) {
      void loadSurface(surface)
    } else {
      setRows([])
      setColumns([])
      setStaleHint('还没有该型的行快照；请在 AI 会话里操作该业务后回到此页。')
    }
  }, [applySheet, loadSurface, surfaces])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)))
  }, [query, rows])

  useEffect(() => {
    setPage(1)
  }, [kind, query])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredRows.slice(start, start + PAGE_SIZE)
  }, [filteredRows, page])

  const tableColumns = useMemo(() => {
    if (columns.length) return columns
    const sample = filteredRows[0]
    if (sample) {
      return Object.keys(sample)
        .filter((key) => !['fields', 'preview_id', 'previewId', 'canWrite', 'can_write'].includes(key))
        .slice(0, 8)
        .map((key) => ({ key, label: key }))
    }
    return []
  }, [columns, filteredRows])

  const getRowDraft = useCallback((row: SheetRow, index: number) => {
    const key = sheetRowKey(row, index)
    return { ...row, ...(draftEdits[key] ?? {}) }
  }, [draftEdits])

  const updateDraftCell = useCallback((row: SheetRow, index: number, columnKey: string, value: string) => {
    const key = sheetRowKey(row, index)
    setDraftEdits((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? row), [columnKey]: value },
    }))
  }, [])

  const openCreateForm = () => {
    const next: Record<string, string> = {}
    for (const column of tableColumns) next[column.key] = ''
    setCreateDraft(next)
  }

  const confirmWrite = async () => {
    if (!drawer?.previewId) {
      setError('缺少预览令牌，请重新改行预览后再过账')
      return
    }
    setLoading(true)
    setError('')
    try {
      const sheetWorkspace = typeof drawer.sheet.workspace === 'string' ? drawer.sheet.workspace : undefined
      await runtimeApi.bizWrite(drawer.previewId, undefined, sheetWorkspace)
      clearBizPreviewDismissed(drawer.previewId)
      clearBizPendingSheet()
      setNotice('已过账，表格保留本次预览行供核对')
      setDrawer(null)
      commitListRestore(null)
      void loadSurfaces()
    } catch (cause) {
      setError(formatBizPanelError(cause, '过账失败，请重新预览后再试'))
    } finally {
      setLoading(false)
    }
  }

  const askAiForRow = async () => {
    if (!selectedRow) return
    const target = await loadCurrentAiTarget()
    if (!target.ok) {
      setError(target.error)
      return
    }
    const entity = {
      kind: 'biz-row' as const,
      ref: `fde://external/table/${kind}/${String(selectedRow.orderId ?? selectedRow.no ?? '')}`,
      fields: selectedRow,
    }
    try {
      const packed = await buildContextPack({ scopes: ['workspace', 'biz', 'memory'], entity })
      setContextPack(packed.pack)
      setContextWarnings(packed.warnings)
      const text = [
        renderContextForPrompt(packed.pack, omit),
        `请结合上述业务记录行协助我（型：${kind}）。`,
      ].join('\n')
      await runtimeApi.promptAi(target.sessionId, { text })
      setNotice('已交给当前 AI')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '发给 AI 失败')
    }
  }

  if (!connectorOptions.length) {
    return <Empty title="先在设置登记业务连接器" hint="登记后可在此对 AI 浮现的业务行做过账" />
  }

  if (activeLocalApp && workspaceCwd) {
    const { app, spec, tableView } = activeLocalApp
    if (!tableView) {
      return <Empty title="该应用没有表格视图" hint="在应用编辑器中添加 table 视图" />
    }
    return (
      <div className="space-y-3">
        <Card className="!p-3 flex items-center gap-2 flex-wrap">
          {connectorOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={clsx('btn !py-1', connectionId === opt.id && '!bg-ink !text-white !border-ink')}
              onClick={() => setConnectionId(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </Card>
        <SpecTable
          app={{ id: app.id, spec, status: app.status }}
          view={tableView}
          workspaceCwd={workspaceCwd}
          onRefresh={() => undefined}
        />
      </div>
    )
  }

  const pendingText = pending
    ? pending.action === '现查' || pending.source === 'ai'
      ? `AI 刚查了 ${pending.kind} · ${pending.rows} 行${pending.sessionId ? ` · 会话 ${pending.sessionId.slice(0, 8)}` : ''} · ${formatSurfaceTime(pending.at)}`
      : `AI 拟改 ${pending.kind} ${pending.rows} 行 · 待确认`
    : ''

  if (!hasSurfacedData) {
    return (
      <div className="space-y-3">
        {gateHint && (
          <div className="border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 flex items-start gap-2">
            <CircleAlert size={13} className="mt-0.5 shrink-0" />
            <span>{gateHint}。等底座恢复后，AI 在会话里的现查/改行会浮现到这里。</span>
          </div>
        )}
        <Empty
          title="还没有 AI 查过或改过的业务记录"
          hint="在左侧 AI 会话里现查、改行、新建或过账后，对应行会出现在这里；本页不会列出全部型芯片，也不会整表倾倒源系统。"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {gateHint && (
        <div className="border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 flex items-start gap-2">
          <CircleAlert size={13} className="mt-0.5 shrink-0" />
          <span>{gateHint}。已浮现的行仍可查看，新的预览/过账需等底座恢复。</span>
        </div>
      )}
      {error && <div className="border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-accent-red">{error}</div>}
      {notice && <div className="border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">{notice}</div>}
      {staleHint && <div className="border border-line bg-surface-2 px-3 py-2.5 text-xs text-ink-muted">{staleHint}</div>}

      <Card className="!p-3 flex items-center gap-2 flex-wrap">
        {connectorOptions.length > 1 && connectorOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={clsx('btn !py-1', connectionId === opt.id && '!bg-ink !text-white !border-ink')}
            onClick={() => setConnectionId(opt.id)}
          >
            {opt.label}
          </button>
        ))}
        <div className="flex items-center gap-1 flex-wrap">
          {surfacedKinds.map((k) => (
            <button
              key={k.kind}
              type="button"
              disabled={!lanReady}
              className={clsx('btn !py-1', kind === k.kind && '!bg-ink !text-white !border-ink')}
              onClick={() => selectKind(k.kind)}
            >
              {k.label}
              <span className="text-[10px] opacity-70 ml-1">
                {kind === k.kind ? (filteredRows.length || (pending?.kind === k.kind ? pending.rows : 0) || surfaces.find((s) => s.kind === k.kind)?.rowCount || 0) : ''}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input className="input h-8 pl-8 w-48" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索当前记录" />
        </div>
        <button type="button" className="btn-brand !py-1" disabled={!lanReady || loading || !kind} onClick={openCreateForm}>
          <Plus size={13} /> 新建
        </button>
        <button type="button" className="btn-brand !py-1" onClick={onPlan}><ShieldCheck size={13} /> 规划数据操作</button>
      </Card>

      {(pendingText || surfaces.length > 0) && (
        <div className="px-3 py-2 border border-blue-200 bg-blue-50 text-xs text-blue-800 flex flex-wrap items-center gap-2">
          {pendingText && (
            <button type="button" className="underline" onClick={() => { if (pending) void selectKind(pending.kind) }}>
              {pendingText}
            </button>
          )}
          {surfaces.length > 0 && (
            <select
              className="input h-7 text-xs ml-auto max-w-[240px]"
              defaultValue=""
              onChange={(e) => {
                const row = surfaces.find((s) => s.id === e.target.value)
                if (row) void loadSurface(row)
              }}
            >
              <option value="">本会话浮现历史</option>
              {surfaces.map((s) => (
                <option key={s.id} value={s.id}>{s.kind} · {s.action} · {new Date(s.createdAt).toLocaleString('zh-CN')}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {createDraft && (
        <Card className="!p-3 space-y-3">
          <div className="text-sm font-medium">新建{kind ? ` · ${kind}` : ''}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {tableColumns.map((column) => (
              <label key={column.key} className="space-y-1">
                <span className="text-xs text-ink-muted">{column.label || column.key}</span>
                <input
                  className="input h-8 w-full text-xs"
                  value={createDraft[column.key] ?? ''}
                  onChange={(e) => setCreateDraft((prev) => prev ? { ...prev, [column.key]: e.target.value } : prev)}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-brand !py-1"
              disabled={!lanReady || loading}
              onClick={() => void runPreview('新建', { input: createDraft })}
            >
              预览新建
            </button>
            <button type="button" className="btn !py-1" onClick={() => setCreateDraft(null)}>取消</button>
          </div>
        </Card>
      )}

      <Card className="!p-0 overflow-x-auto">
        {(showRecordsBack || sourceLabel) && (
          <div className="px-3 py-2 border-b border-line text-xs text-ink-muted bg-surface-2 flex flex-wrap items-center gap-2">
            {showRecordsBack && (
              <button type="button" className="btn !py-0.5 !text-[11px]" onClick={handleRecordsBack}>
                <ArrowLeft size={12} /> 返回
              </button>
            )}
            {sourceLabel && <span>来源：{sourceLabel}</span>}
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted border-b border-line bg-surface-2">
              {tableColumns.map((column) => <th key={column.key} className="px-3 py-2.5 font-medium whitespace-nowrap">{column.label || column.key}</th>)}
              <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => {
              const absoluteIndex = (page - 1) * PAGE_SIZE + index
              const rowKey = sheetRowKey(row, absoluteIndex)
              const draftRow = getRowDraft(row, absoluteIndex)
              const isPending = pending?.action && pending.action !== '现查' && pending.kind === kind
              return (
                <tr
                  key={rowKey}
                  className={clsx(
                    'border-b border-line last:border-0 hover:bg-surface-2/60',
                    isPending && 'bg-brand-soft/40',
                    selectedRow === row && 'bg-brand-soft/70',
                  )}
                  onClick={() => setSelectedRow(row)}
                >
                  {tableColumns.map((column) => (
                    <td key={column.key} className="px-3 py-2 align-top min-w-[120px]">
                      <EditableSheetCell
                        value={draftRow[column.key]}
                        onChange={(next) => updateDraftCell(row, absoluteIndex, column.key, next)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right whitespace-nowrap align-top">
                    <button
                      type="button"
                      className="btn !py-0.5 !text-[11px] mr-1"
                      disabled={!lanReady || loading}
                      onClick={(e) => {
                        e.stopPropagation()
                        void runPreview('改行', { no: rowKey, input: draftRow, originalRow: row })
                      }}
                    >
                      改行
                    </button>
                    <button type="button" className="btn !py-0.5 !text-[11px] mr-1" disabled={!lanReady || loading} onClick={(e) => { e.stopPropagation(); void runPreview('删除', { no: rowKey }) }}>删除</button>
                    <button type="button" className="btn !py-0.5 !text-[11px]" disabled={!lanReady || loading} onClick={(e) => { e.stopPropagation(); void runPreview('过审', { no: rowKey }) }}>过审</button>
                  </td>
                </tr>
              )
            })}
            {paginatedRows.length === 0 && (
              <tr><td colSpan={tableColumns.length + 1} className="px-3 py-12 text-center text-sm text-ink-muted">{loading ? '加载中…' : (staleHint || '当前型还没有可展示的行')}</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>共 {filteredRows.length} 条{sourceLabel ? ` · ${sourceLabel}` : ''}</span>
        <div className="flex items-center gap-2">
          <span>第 {page} / {totalPages} 页</span>
          <button type="button" className="btn h-7" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
          <button type="button" className="btn h-7" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-brand !py-1" disabled={!selectedRow} onClick={() => void askAiForRow()}>
          <Bot size={13} /> 交给当前 AI
        </button>
        <ContextChips
          pack={contextPack}
          warnings={contextWarnings}
          omit={omit}
          onToggleOmit={(key) => setOmit((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
          })}
        />
        {selectedRow && onPlanWithTarget && (
          <button
            type="button"
            className="btn !py-1"
            onClick={() => onPlanWithTarget({
              targetRef: `fde://external/NocoBase/table/${kind}/${String(selectedRow.orderId ?? '')}`,
              kind,
              no: String(selectedRow.orderId ?? ''),
            })}
          >
            带入操作控制
          </button>
        )}
      </div>

      {drawer && (
        <BizPreviewDrawer
          sheet={drawer.sheet}
          canWrite={drawer.canWrite}
          loading={loading}
          gateReason={drawer.gateReason}
          originalRow={drawer.originalRow}
          columns={columns}
          onClose={dismissPreviewDrawer}
          onConfirm={() => void confirmWrite()}
        />
      )}
    </div>
  )
}
