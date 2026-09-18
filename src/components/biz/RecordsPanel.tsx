import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, CircleAlert, Plus, Search } from 'lucide-react'
import clsx from 'clsx'
import { Card, Empty } from '@/components/ui'
import { BizPreviewDrawer } from '@/components/biz/BizPreviewDrawer'
import { SpecTable } from '@/components/apps/SpecTable'
import {
  formatSheetCellDisplayValue,
  type SheetColumn,
  isBizListQueryAction,
  normalizeSheetColumns,
  normalizeSheetRows,
  pickFilledSheetInput,
  pickSheetRowPatch,
  sheetRowKey,
  type SheetRow,
} from '@/lib/biz-sheet-display'
import { ContextChips } from '@/components/ai/ContextChips'
import { buildContextPack, renderContextForPrompt, type ContextPack } from '@/lib/context-pack'
import { loadCurrentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { useApp } from '@/store/app'
import {
  RuntimeApiError,
  runtimeApi,
  type BizSurfaceRecord,
  type BusinessAppRecord,
  type BusinessConnectionRecord,
} from '@/lib/runtime-api'
import { isFdeAppSpec } from '@/lib/app-spec'
import {
  listBizKindListSnapshots,
  peekBizKindListSheetBySurfaceId,
  peekBizKindListSheetForOperation,
  rememberBizKindListSheet,
} from '@/lib/biz-kind-list-cache'
import {
  extractSheetListWhere,
  briefQueryScopeLabel,
  extractBoundKindHints,
  listQueryFingerprint,
  listSnapshotCacheKey,
  operationBundlesAlign,
  sheetRowsFingerprint,
} from '@/lib/biz-list-query'
import {
  matchSurfaceIdForSheet,
  peekBizSurfaceSheet,
  rememberBizSurfaceSheet,
} from '@/lib/biz-surface-cache'
import {
  clearBizPendingSheet,
  clearBizPreviewDismissed,
  dismissBizPreviewId,
  isBizPreviewDismissed,
  peekBizPendingSheet,
  rememberBizPendingSheet,
} from '@/lib/biz-session-sheet'
import { isBizSurfaceTool } from '@/lib/biz-tool-events'
import { useEvents } from '@/lib/events'

const PAGE_SIZE = 10
const ROW_DISPLAY_INDEX_LABEL = '序号'

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
  surfaceId?: string
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

function isWritePreviewSheet(sheet: Record<string, unknown>) {
  const action = String(sheet.action || '')
  return Boolean(sheetPreviewId(sheet) && !isBizListQueryAction(action))
}

function isSingleRowWritePreview(sheet: Record<string, unknown>) {
  if (!isWritePreviewSheet(sheet)) return false
  const rowCount = Array.isArray(sheet.rows) ? sheet.rows.length : 0
  return rowCount <= 1
}

function sameSheetRowKeySet(a: SheetRow[], b: SheetRow[]) {
  const keysA = new Set(a.map((row, index) => sheetRowKey(row, index)))
  const keysB = new Set(b.map((row, index) => sheetRowKey(row, index)))
  if (keysA.size !== keysB.size) return false
  for (const key of keysB) if (!keysA.has(key)) return false
  return true
}

function incomingSheetRowCount(sheet: Record<string, unknown>) {
  return Array.isArray(sheet.rows) ? sheet.rows.length : 0
}

/** Empty lan-assist poll must not wipe a surfaced list (§9). */
function shouldRejectEmptyIncomingSheet(
  incoming: Record<string, unknown>,
  displayedRowCount: number,
) {
  if (displayedRowCount <= 0) return false
  const incomingCount = incomingSheetRowCount(incoming)
  if (incomingCount > 0) return false
  const action = String(incoming.action || '')
  if (isBizListQueryAction(action)) return true
  return false
}

function listRestoreDiffersFromIncoming(restore: ListRestoreSnapshot, incoming: Record<string, unknown>) {
  const incomingRows = normalizeSheetRows(incoming.rows)
  const restoreRows = restore.rows
  if (restoreRows.length > incomingRows.length) return true
  if (!sameSheetRowKeySet(restoreRows, incomingRows)) return true
  if (isWritePreviewSheet(incoming) && !isWritePreviewSheet(restore.sheet)) return true
  return false
}

function peekListPendingSheet() {
  const sheet = peekBizPendingSheet()
  if (!sheet) return null
  if (!isBizListQueryAction(String(sheet.action || ''))) return null
  const k = String(sheet.kind || '')
  return k ? sheet : null
}

function findSurfaceForKind(surfaces: BizSurfaceRecord[], k: string) {
  return surfaces.find((s) => s.kind === k && isBizListQueryAction(s.action))
    || surfaces.find((s) => s.kind === k)
}

function listRestoreFromSnapshot(snap: SheetSnapshot): ListRestoreSnapshot {
  const sheet = snap.sheet
  const restoreRows = normalizeSheetRows(sheet.rows)
  const restoreColumns = normalizeSheetColumns(sheet.columns)
  const action = String(sheet.action || '现查')
  return {
    rows: restoreRows,
    columns: restoreColumns,
    page: 1,
    draftEdits: {},
    sourceLabel: snap.connName ? `${snap.connName} · ${action}` : '',
    connName: snap.connName || '连接器',
    surfaceId: snap.surfaceId,
    sheet: { ...sheet, rows: restoreRows, columns: restoreColumns },
  }
}

function EditableSheetCell({
  value,
  column,
  onChange,
}: {
  value: unknown
  column?: SheetColumn
  onChange: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const raw = value == null ? '' : String(value)
  const display = formatSheetCellDisplayValue(value, column)
  const isEmpty = value == null || value === ''

  if (!editing) {
    return (
      <button
        type="button"
        title={display}
        className={clsx(
          'w-full min-h-8 rounded-sm border-0 bg-transparent px-2.5 py-1.5 text-left text-xs leading-snug',
          'hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/30',
          isEmpty ? 'text-ink-subtle' : 'text-ink',
          !isEmpty && 'truncate',
        )}
        onClick={(event) => {
          event.stopPropagation()
          setEditing(true)
        }}
      >
        {display}
      </button>
    )
  }

  return (
    <input
      autoFocus
      className="input h-8 w-full rounded-sm border-0 text-xs shadow-none ring-1 ring-brand/25 bg-white px-2"
      value={raw}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setEditing(false)}
    />
  )
}

export function RecordsPanel({ connections, apps, runtimeReady, onPlanWithTarget }: Props) {
  const activeWorkspaceCwd = useApp((state) => {
    const row = state.workspaces.find((item) => item.id === state.activeWorkspaceId)
    const cwd = typeof row?.cwd === 'string' ? row.cwd.trim() : ''
    return cwd.startsWith('/') ? cwd : ''
  })
  const [workspaceCwd, setWorkspaceCwd] = useState('')
  const [lanReady, setLanReady] = useState(true)
  const [gateHint, setGateHint] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [kind, setKind] = useState('')
  const [query, setQuery] = useState('')
  const [historySurfaceId, setHistorySurfaceId] = useState('')
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
  const [selectedRowKey, setSelectedRowKey] = useState('')
  const [listSheetMeta, setListSheetMeta] = useState<Record<string, unknown> | null>(null)
  const [page, setPage] = useState(1)
  const [draftEdits, setDraftEdits] = useState<Record<string, SheetRow>>({})
  const [createDraft, setCreateDraft] = useState<Record<string, string> | null>(null)
  const [drawer, setDrawer] = useState<{
    previewId: string
    sheet: Record<string, unknown>
    canWrite: boolean
    gateReason?: string
    originalRow?: SheetRow
    patch?: Record<string, unknown>
  } | null>(null)
  const [listRestore, setListRestore] = useState<ListRestoreSnapshot | null>(null)
  const [contextPack, setContextPack] = useState<ContextPack | null>(null)
  const [contextWarnings, setContextWarnings] = useState<string[]>([])
  const [omit, setOmit] = useState<Set<string>>(new Set())
  const [kindCatalog, setKindCatalog] = useState<Array<{ kind: string; label: string; can: string[] }>>([])
  const sheetSnapshots = useRef<Map<string, SheetSnapshot>>(new Map())
  const priorListSheetByKind = useRef<Map<string, SheetSnapshot>>(new Map())
  const listRestoreRef = useRef<ListRestoreSnapshot | null>(null)
  const listRestoreHydrateRef = useRef(false)
  const appliedSheetFpRef = useRef('')
  const activeListQueryFpRef = useRef('')
  const displayedRowCountRef = useRef(0)
  const historyPinnedSurfaceIdRef = useRef('')
  const showRecordsBack = Boolean(listRestore)
  const bizCwd = workspaceCwd || activeWorkspaceCwd

  const localApps = useMemo(
    () => apps.filter((app) => isFdeAppSpec(app.definition)),
    [apps],
  )
  const connectorOptions = useMemo(() => {
    const external = connections.map((c) => ({ id: c.id, label: c.name }))
    const local = localApps.map((a) => ({ id: `local:${a.id}`, label: `本地 · ${a.name}` }))
    return [...external, ...local]
  }, [connections, localApps])

  const kindLabel = useCallback((k: string) => {
    const row = kindCatalog.find((item) => item.kind === k)
    return row?.label || k
  }, [kindCatalog])

  const operationAnchor = useMemo(() => {
    const pendingSheet = peekBizPendingSheet()
    if (pendingSheet) return pendingSheet
    if (listSheetMeta && typeof listSheetMeta === 'object') return listSheetMeta
    if (kind) {
      const snap = sheetSnapshots.current.get(`kind:${kind}`)
      if (snap?.sheet) return snap.sheet
    }
    return null
  }, [kind, listSheetMeta, pending?.at, pending?.kind, rows.length])

  const surfacedKindChips = useMemo(() => {
    const anchor = operationAnchor
    const byKind = new Map<string, { kind: string; label: string; count: number; latestAt: number }>()
    const add = (k: string, count: number, at: number) => {
      if (!k) return
      const prev = byKind.get(k)
      const nextCount = count > 0 ? count : (prev?.count ?? 0)
      if (!prev || at >= prev.latestAt) {
        byKind.set(k, { kind: k, label: kindLabel(k), count: nextCount, latestAt: at })
      } else if (count > 0) {
        byKind.set(k, { ...prev, count })
      }
    }

    if (!anchor) {
      if (kind) add(kind, rows.length, Date.now())
      return [...byKind.values()]
    }

    const pool: Record<string, unknown>[] = [anchor]
    if (bizCwd) {
      for (const snap of listBizKindListSnapshots(bizCwd)) {
        if (operationBundlesAlign(anchor, snap.sheet)) pool.push(snap.sheet)
      }
    }
    for (const snap of sheetSnapshots.current.values()) {
      if (snap?.sheet && operationBundlesAlign(anchor, snap.sheet)) pool.push(snap.sheet)
    }

    const allowedKinds = new Set<string>()
    for (const hint of extractBoundKindHints(anchor)) allowedKinds.add(hint)
    if (!allowedKinds.size) {
      const only = String(anchor.kind || kind || '').trim()
      if (only) allowedKinds.add(only)
    }

    for (const sheet of pool) {
      const k = String(sheet.kind || '').trim()
      if (!k || !allowedKinds.has(k)) continue
      const rowCount = Array.isArray(sheet.rows) ? sheet.rows.length : 0
      add(k, rowCount, Date.now())
    }

    if (kind && allowedKinds.has(kind) && rows.length > 0) {
      add(kind, rows.length, Date.now())
    }

    return [...byKind.values()].sort((a, b) => b.latestAt - a.latestAt)
  }, [bizCwd, kind, kindLabel, operationAnchor, rows.length])

  const sessionSurfaces = useMemo(() => {
    const sorted = [...surfaces].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    const sessionKey = pending?.sessionId?.trim() || ''
    if (!sessionKey) return sorted
    const scoped = sorted.filter((row) => row.sessionId === sessionKey)
    return scoped.length ? scoped : sorted
  }, [pending?.sessionId, surfaces])

  const surfaceHistoryLabel = useCallback((surface: BizSurfaceRecord) => {
    const cached = sheetSnapshots.current.get(`surface:${surface.id}`)
    const sheet = cached?.sheet
      ?? (bizCwd ? peekBizSurfaceSheet(bizCwd, surface.id)?.sheet : undefined)
      ?? (bizCwd ? peekBizKindListSheetBySurfaceId(bizCwd, surface.id)?.sheet : undefined)
    const scope = sheet ? briefQueryScopeLabel(sheet) : ''
    const time = new Date(surface.createdAt).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    return [surface.kind, surface.action, scope || time].filter(Boolean).join(' · ')
  }, [bizCwd])

  const currentKindCan = useMemo(() => {
    const row = kindCatalog.find((item) => item.kind === kind)
    return row?.can?.length ? row.can : []
  }, [kind, kindCatalog])

  const rowActions = useMemo(
    () => currentKindCan.filter((action) => action !== '现查' && action !== '新建'),
    [currentKindCan],
  )

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
    if (activeWorkspaceCwd) setWorkspaceCwd(activeWorkspaceCwd)
  }, [activeWorkspaceCwd])

  useEffect(() => {
    if (!runtimeReady || !bizCwd) return
    let cancelled = false
    void runtimeApi.listBizKinds(undefined, bizCwd).then((data) => {
      if (cancelled) return
      setKindCatalog(data.kinds.map((row) => ({
        kind: row.kind,
        label: row.label,
        can: Array.isArray(row.can) ? row.can.map(String) : [],
      })))
    }).catch(() => {
      if (!cancelled) setKindCatalog([])
    })
    return () => { cancelled = true }
  }, [bizCwd, runtimeReady])

  const seedKindListSnapshot = useCallback((snapshot: SheetSnapshot) => {
    const k = String(snapshot.sheet.kind || '')
    if (!k) return
    const cacheKey = listSnapshotCacheKey(k, snapshot.sheet)
    sheetSnapshots.current.set(cacheKey, snapshot)
    sheetSnapshots.current.set(`kind:${k}`, snapshot)
    priorListSheetByKind.current.set(k, snapshot)
    activeListQueryFpRef.current = listQueryFingerprint(snapshot.sheet)
    if (snapshot.surfaceId) {
      sheetSnapshots.current.set(`surface:${snapshot.surfaceId}`, snapshot)
    }
    if (workspaceCwd) {
      rememberBizKindListSheet(workspaceCwd, snapshot.sheet, snapshot.connName, snapshot.surfaceId)
    }
  }, [workspaceCwd])

  const rememberSheet = useCallback((snapshot: SheetSnapshot) => {
    const k = String(snapshot.sheet.kind || '')
    const previewId = sheetPreviewId(snapshot.sheet)
    if (k && !isSingleRowWritePreview(snapshot.sheet)) {
      seedKindListSnapshot(snapshot)
    }
    if (previewId) sheetSnapshots.current.set(`preview:${previewId}`, snapshot)
    if (snapshot.surfaceId) sheetSnapshots.current.set(`surface:${snapshot.surfaceId}`, snapshot)
    if (snapshot.surfaceId && workspaceCwd) {
      rememberBizSurfaceSheet(workspaceCwd, snapshot.surfaceId, snapshot.sheet, snapshot.connName)
    }
  }, [seedKindListSnapshot, workspaceCwd])

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
    const postAction = !isBizListQueryAction(action)
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

  const ensureListRestoreBeforeWritePreview = useCallback((incomingSheet: Record<string, unknown>) => {
    if (listRestoreRef.current) return
    const incomingKind = String(incomingSheet.kind || kind || '')
    const incomingRows = normalizeSheetRows(incomingSheet.rows)
    const incomingCount = incomingRows.length

    const tryCommit = (candidate: ListRestoreSnapshot) => {
      if (listRestoreDiffersFromIncoming(candidate, incomingSheet)) {
        commitListRestore(candidate)
      }
    }

    if (rows.length > 0) {
      const larger = rows.length > incomingCount
      const different = incomingCount > 0 && !sameSheetRowKeySet(rows, incomingRows)
      if (larger || different) {
        tryCommit(captureListRestore())
        return
      }
    }

    const kindSnap = incomingKind ? sheetSnapshots.current.get(`kind:${incomingKind}`) : undefined
    if (kindSnap) {
      const snapRows = normalizeSheetRows(kindSnap.sheet.rows)
      if (snapRows.length > incomingCount || (snapRows.length > 0 && !sameSheetRowKeySet(snapRows, incomingRows))) {
        tryCommit(listRestoreFromSnapshot(kindSnap))
        if (listRestoreRef.current) return
      }
    }

    const prior = incomingKind ? priorListSheetByKind.current.get(incomingKind) : undefined
    if (prior) {
      tryCommit(listRestoreFromSnapshot(prior))
      if (listRestoreRef.current) return
    }

    if (workspaceCwd && incomingKind) {
      const sessionList = peekBizKindListSheetForOperation(workspaceCwd, incomingKind, incomingSheet)
      if (sessionList) {
        const snap: SheetSnapshot = {
          sheet: sessionList.sheet,
          connName: sessionList.connName,
          surfaceId: sessionList.surfaceId,
        }
        seedKindListSnapshot(snap)
        tryCommit(listRestoreFromSnapshot(snap))
        if (listRestoreRef.current) return
      }
    }

    for (const surface of surfaces) {
      if (surface.kind !== incomingKind) continue
      const isListSurface = surface.action === '现查' || (surface.rowCount ?? 0) > 1
      if (!isListSurface) continue
      const cached = sheetSnapshots.current.get(`surface:${surface.id}`)
      if (!cached || isSingleRowWritePreview(cached.sheet)) continue
      tryCommit(listRestoreFromSnapshot(cached))
      if (listRestoreRef.current) break
    }
  }, [captureListRestore, commitListRestore, kind, rows, seedKindListSnapshot, surfaces, workspaceCwd])

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
    if (!isWritePreviewSheet(snap.sheet)) {
      rememberBizPendingSheet(snap.sheet)
    }
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
    void runtimeApi.bizDismissPreview(previewId || undefined).catch(() => undefined)
  }, [drawer?.previewId, restoreRecordsList])

  const dismissPreviewDrawer = useCallback(() => {
    const pendingSheet = peekBizPendingSheet()
    const previewId = drawer?.previewId
      || (pendingSheet ? sheetPreviewId(pendingSheet) : '')
    if (previewId) dismissBizPreviewId(previewId)
    setDrawer(null)
    clearBizPendingSheet()
    if (listRestoreRef.current) restoreRecordsList()
    void runtimeApi.bizDismissPreview(previewId || undefined).catch(() => undefined)
  }, [drawer?.previewId, restoreRecordsList])

  const applySheet = useCallback((
    sheet: Record<string, unknown>,
    connName: string,
    surfaceId?: string,
    surfacedAt?: number,
  ) => {
    const nextFp = sheetRowsFingerprint(sheet)
    const sameSheet = nextFp && nextFp === appliedSheetFpRef.current
    if (sameSheet) return
    appliedSheetFpRef.current = nextFp
    activeListQueryFpRef.current = listQueryFingerprint(sheet)
    const normalizedCols = normalizeSheetColumns(sheet.columns)
    setColumns(normalizedCols)
    const normalizedRows = normalizeSheetRows(sheet.rows)
    setRows(normalizedRows)
    displayedRowCountRef.current = normalizedRows.length
    setDraftEdits({})
    setPage(1)
    const action = String(sheet.action || '现查')
    const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(
      surfacedAt ? new Date(surfacedAt) : new Date(),
    )
    setSourceLabel(`${connName} · ${action} ${time}`)
    const nextKind = String(sheet.kind || '')
    if (nextKind) setKind(nextKind)
    setStaleHint('')
    setListSheetMeta(sheet)
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
    if (!bizCwd) return
    try {
      setSurfaces(await runtimeApi.listBizSurfaces(bizCwd, 40))
    } catch { /* ignore */ }
  }, [bizCwd])

  const applyPendingSheet = useCallback((sheet: Record<string, unknown>, surfaceId?: string) => {
    const rowCount = incomingSheetRowCount(sheet)
    if (!rowCount && !sheet.kind) return false
    if (shouldRejectEmptyIncomingSheet(sheet, displayedRowCountRef.current)) return false
    if (
      historyPinnedSurfaceIdRef.current
      && surfaceId
      && surfaceId !== historyPinnedSurfaceIdRef.current
    ) {
      return false
    }
    if (
      historyPinnedSurfaceIdRef.current
      && !surfaceId
      && isBizListQueryAction(String(sheet.action || ''))
    ) {
      return false
    }
    const previewId = sheetPreviewId(sheet)
    const action = String(sheet.action || '')
    const isWritePreview = Boolean(previewId && !isBizListQueryAction(action))

    if (isWritePreview && isBizPreviewDismissed(sheet)) {
      if (listRestoreRef.current) restoreRecordsList()
      return true
    }

    const incomingQueryFp = listQueryFingerprint(sheet)
    if (incomingQueryFp && incomingQueryFp !== activeListQueryFpRef.current) {
      appliedSheetFpRef.current = ''
    }
    const incomingFp = sheetRowsFingerprint(sheet)
    if (incomingFp && incomingFp === appliedSheetFpRef.current) {
      if (isWritePreview) {
        setDrawer((prev) => prev ?? {
          previewId,
          sheet,
          canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
        })
      }
      return rowCount > 0 || Boolean(sheet.kind)
    }
    const conn = connections.find((c) => c.id === connectionId) || connections[0]
    if (isWritePreview) ensureListRestoreBeforeWritePreview(sheet)
    rememberBizPendingSheet(sheet)
    maybeSaveListRestore(sheet)
    applySheet(sheet, conn?.name || '连接器', surfaceId)
    if (!isWritePreview) setDrawer(null)
    if (isWritePreview) {
      setDrawer({
        previewId,
        sheet,
        canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
      })
    }
    return rowCount > 0 || Boolean(sheet.kind)
  }, [applySheet, connectionId, connections, ensureListRestoreBeforeWritePreview, maybeSaveListRestore, restoreRecordsList])

  const hydrateFromPending = useCallback(async (surfaceId?: string) => {
    if (historyPinnedSurfaceIdRef.current && !surfaceId) return false
    const cached = peekBizPendingSheet()
    if (cached) {
      if (isBizPreviewDismissed(cached)) {
        if (listRestoreRef.current) restoreRecordsList()
        return true
      }
      if (applyPendingSheet(cached, surfaceId)) return true
    }
    try {
      const { sheet } = await runtimeApi.getBizPendingSheet()
      if (!sheet || typeof sheet !== 'object') return false
      if (isBizPreviewDismissed(sheet)) {
        if (listRestoreRef.current) restoreRecordsList()
        return true
      }
      return applyPendingSheet(sheet, surfaceId)
    } catch {
      return false
    }
  }, [applyPendingSheet, restoreRecordsList])

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
    if (listRestoreRef.current) return
    const sheet = drawer?.sheet ?? peekBizPendingSheet()
    if (!sheet || !isWritePreviewSheet(sheet)) return
    if (surfaces.length === 0) return
    ensureListRestoreBeforeWritePreview(sheet)
    if (listRestoreRef.current || listRestoreHydrateRef.current) return

    const incomingKind = String(sheet.kind || kind || '')
    const incomingCount = normalizeSheetRows(sheet.rows).length
    const listSurface = surfaces.find((surface) => (
      surface.kind === incomingKind
      && surface.action === '现查'
      && (surface.rowCount ?? 0) > incomingCount
    ))
    if (!listSurface || !workspaceCwd || !connectionId) return

    listRestoreHydrateRef.current = true
    void (async () => {
      try {
        const conn = connections.find((c) => c.id === (listSurface.connectionId || connectionId)) || connections[0]
        const listWhere = extractSheetListWhere(sheet)
        const kindSnap = sheetSnapshots.current.get(
          listSnapshotCacheKey(incomingKind, { kind: incomingKind, action: '现查', where: listWhere }),
        ) || sheetSnapshots.current.get(`kind:${incomingKind}`)
        const restoreWhere = extractSheetListWhere(kindSnap?.sheet ?? sheet)
        const data = await runtimeApi.bizPreview({
          kind: incomingKind,
          action: '现查',
          system: conn?.provider || 'NocoBase',
          connectionId: listSurface.connectionId || connectionId,
          speech: `现查${incomingKind}`,
          ...(restoreWhere.length ? { where: restoreWhere } : {}),
        })
        const listSheet = (data.sheet && typeof data.sheet === 'object' ? data.sheet : data) as Record<string, unknown>
        const rowCount = Array.isArray(listSheet.rows) ? listSheet.rows.length : 0
        if (rowCount <= incomingCount) return
        const snap: SheetSnapshot = {
          sheet: listSheet,
          connName: conn?.name || '连接器',
          surfaceId: listSurface.id,
        }
        seedKindListSnapshot(snap)
        ensureListRestoreBeforeWritePreview(sheet)
      } catch {
        // no prior list — do not fake 返回
      } finally {
        listRestoreHydrateRef.current = false
      }
    })()
  }, [
    connectionId,
    connections,
    drawer?.sheet,
    ensureListRestoreBeforeWritePreview,
    kind,
    seedKindListSnapshot,
    surfaces,
    workspaceCwd,
  ])

  useEffect(() => {
    if (!runtimeReady || !workspaceCwd || activeLocalApp) return
    if (historyPinnedSurfaceIdRef.current) return
    void hydrateFromPending()
  }, [activeLocalApp, hydrateFromPending, runtimeReady, workspaceCwd])

  useEffect(() => {
    if (!runtimeReady || !workspaceCwd || activeLocalApp) return
    if (surfaces.length === 0) return
    if (kind) return
    const latest = surfaces[0]
    void (async () => {
      let listPending = peekListPendingSheet()
      if (!listPending) {
        try {
          const { sheet } = await runtimeApi.getBizPendingSheet()
          if (sheet && typeof sheet === 'object') {
            rememberBizPendingSheet(sheet)
            listPending = peekListPendingSheet()
          }
        } catch {
          listPending = null
        }
      }
      const seedKind = listPending ? String(listPending.kind || '') : latest.kind
      const connSurface = listPending
        ? (findSurfaceForKind(surfaces, seedKind) || latest)
        : latest
      setKind(seedKind)
      if (connSurface.connectionId) setConnectionId(connSurface.connectionId)
      if (listPending) {
        applyPendingSheet(listPending, connSurface.id)
        return
      }
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
  }, [activeLocalApp, applyPendingSheet, applySheet, hydrateFromPending, kind, runtimeReady, surfaces, workspaceCwd])

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
      historyPinnedSurfaceIdRef.current = ''
      rememberBizPendingSheet(payload.sheet)
      let surfaceId = typeof payload.surfaceId === 'string' ? payload.surfaceId : undefined
      applyPendingSheet(payload.sheet, surfaceId)
      void (async () => {
        if (!bizCwd) return
        try {
          const items = await runtimeApi.listBizSurfaces(bizCwd, 40)
          setSurfaces(items)
          if (!surfaceId) {
            surfaceId = matchSurfaceIdForSheet(items, payload.sheet as Record<string, unknown>, {
              sessionId: payload.sessionId,
              previewId: payload.previewId,
            })
          }
          if (!surfaceId) return
          const conn = connections.find((c) => c.id === connectionId) || connections[0]
          const connName = conn?.name || '连接器'
          rememberBizSurfaceSheet(bizCwd, surfaceId, payload.sheet as Record<string, unknown>, connName)
          rememberSheet({ sheet: payload.sheet as Record<string, unknown>, connName, surfaceId })
        } catch {
          // ignore list failure — in-memory cache still updated via applyPendingSheet
        }
      })()
    } else {
      void hydrateFromPending()
      void loadSurfaces()
    }
  })

  useEvents(['ai.tool.finished'], (event) => {
    const payload = event.payload as { tool?: string; ok?: boolean }
    if (!payload.ok) return
    if (!isBizSurfaceTool(String(payload.tool || ''))) return
    historyPinnedSurfaceIdRef.current = ''
    const cached = peekBizPendingSheet()
    if (cached) {
      applyPendingSheet(cached)
      return
    }
    void hydrateFromPending()
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
      let previewBody: Record<string, unknown> = { ...payloadExtra }
      if (action === '改行' && originalRow) {
        const draft = (payloadExtra.input && typeof payloadExtra.input === 'object')
          ? payloadExtra.input as SheetRow
          : originalRow
        const patch = pickSheetRowPatch(originalRow, draft, columns)
        if (!Object.keys(patch).length) {
          setError('请先修改至少一个字段后再预览改行')
          return
        }
        previewBody = { ...payloadExtra, input: patch }
      }
      if (action === '新建') {
        previewBody = { ...payloadExtra, input: pickFilledSheetInput((payloadExtra.input || {}) as Record<string, unknown>) }
      }
      const data = await runtimeApi.bizPreview({
        kind,
        action,
        system,
        connectionId,
        speech: `${action}${kind}`,
        ...previewBody,
      })
      const sheet = (data.sheet && typeof data.sheet === 'object' ? data.sheet : data) as Record<string, unknown>
      const previewId = sheetPreviewId(sheet)
      const canWrite = Boolean(sheet.canWrite ?? sheet.can_write ?? data.canWrite)
      if (!isBizListQueryAction(action) && previewId) ensureListRestoreBeforeWritePreview(sheet)
      maybeSaveListRestore(sheet)
      applySheet(sheet, conn?.name || '连接器')
      if (!isBizListQueryAction(action) && previewId) {
        clearBizPreviewDismissed(previewId)
        setDrawer({
          previewId,
          sheet,
          canWrite,
          gateReason: typeof data.hint === 'string' ? data.hint : undefined,
          originalRow,
          patch: action === '改行' && previewBody.input && typeof previewBody.input === 'object'
            ? previewBody.input as Record<string, unknown>
            : undefined,
        })
      }
      if (action === '新建') setCreateDraft(null)
      void loadSurfaces()
    } catch (cause) {
      setError(cause instanceof RuntimeApiError ? cause.message : cause instanceof Error ? cause.message : '预览失败')
    } finally {
      setLoading(false)
    }
  }, [activeLocalApp, applySheet, columns, connectionId, connections, ensureListRestoreBeforeWritePreview, kind, lanReady, loadSurfaces, maybeSaveListRestore])

  const resolveSurfaceSheet = useCallback((surface: BizSurfaceRecord): SheetSnapshot | null => {
    const mem = sheetSnapshots.current.get(`surface:${surface.id}`)
    if (mem?.sheet) return mem

    if (bizCwd) {
      const cached = peekBizSurfaceSheet(bizCwd, surface.id)
      if (cached) {
        return { sheet: cached.sheet, connName: cached.connName, surfaceId: surface.id }
      }
      const session = peekBizKindListSheetBySurfaceId(bizCwd, surface.id)
      if (session) {
        return { sheet: session.sheet, connName: session.connName, surfaceId: surface.id }
      }
    }

    if (surface.previewId) {
      const previewSnap = sheetSnapshots.current.get(`preview:${surface.previewId}`)
      if (previewSnap?.sheet) {
        return { ...previewSnap, surfaceId: surface.id }
      }
    }

    if (bizCwd && surface.previewId) {
      const byPreview = listBizKindListSnapshots(bizCwd).find((row) => {
        const pid = row.sheet.preview_id ?? row.sheet.previewId
        return typeof pid === 'string' && pid === surface.previewId
      })
      if (byPreview) {
        return { sheet: byPreview.sheet, connName: byPreview.connName, surfaceId: surface.id }
      }
    }

    return null
  }, [bizCwd])

  const loadSurface = useCallback(async (surface: BizSurfaceRecord) => {
    setHistorySurfaceId(surface.id)
    historyPinnedSurfaceIdRef.current = surface.id
    setDrawer(null)
    commitListRestore(null)
    appliedSheetFpRef.current = ''
    setRows([])
    setColumns([])
    setSourceLabel('')
    setKind(surface.kind)
    if (surface.connectionId) setConnectionId(surface.connectionId)
    setStaleHint('')
    setSelectedRow(null)
    setSelectedRowKey('')

    const snap = resolveSurfaceSheet(surface)
    if (!snap?.sheet) {
      setRows([])
      setColumns(Array.isArray(surface.columns) ? surface.columns as SheetColumn[] : [])
      setStaleHint('该条浮现的行已不在待确认区；请在 AI 会话里重新现查或改行。')
      return
    }

    const sheet = snap.sheet
    const incomingQueryFp = listQueryFingerprint(sheet)
    if (incomingQueryFp) activeListQueryFpRef.current = incomingQueryFp
    appliedSheetFpRef.current = ''
    applySheet(sheet, snap.connName, surface.id, surface.createdAt)
    if (isBizListQueryAction(String(sheet.action || surface.action || ''))) {
      rememberBizPendingSheet(sheet)
    }

    const action = String(sheet.action || surface.action || '')
    const writePreviewId = surface.previewId || sheetPreviewId(sheet)
    if (
      writePreviewId
      && !isBizListQueryAction(action)
      && !isBizPreviewDismissed({ previewId: writePreviewId, action })
    ) {
      setDrawer({
        previewId: writePreviewId,
        sheet,
        canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
      })
    }
  }, [applySheet, commitListRestore, resolveSurfaceSheet])

  const selectKind = useCallback((nextKind: string) => {
    setKind(nextKind)
    setStaleHint('')
    setSelectedRow(null)
    setSelectedRowKey('')
    historyPinnedSurfaceIdRef.current = ''
    const pendingSheet = peekBizPendingSheet()
    if (
      pendingSheet
      && String(pendingSheet.kind || '') === nextKind
      && operationBundlesAlign(pendingSheet, listSheetMeta || pendingSheet)
    ) {
      applyPendingSheet(pendingSheet)
      return
    }
    const anchor = peekBizPendingSheet() || listSheetMeta
    if (bizCwd) {
      const scoped = peekBizKindListSheetForOperation(bizCwd, nextKind, anchor)
      if (scoped) {
        applySheet(scoped.sheet, scoped.connName, scoped.surfaceId)
        return
      }
    }
    const queryFp = activeListQueryFpRef.current
    let keyed: SheetSnapshot | undefined
    if (queryFp) {
      try {
        const parsed = JSON.parse(queryFp) as { kind?: string; where?: unknown[] }
        if (!parsed.kind || parsed.kind === nextKind) {
          keyed = sheetSnapshots.current.get(listSnapshotCacheKey(nextKind, {
            kind: nextKind,
            action: '现查',
            where: parsed.where,
          }))
        }
      } catch {
        keyed = undefined
      }
    }
    let cached: SheetSnapshot | undefined = keyed
    if (!cached && anchor) {
      for (const snap of sheetSnapshots.current.values()) {
        const sheet = snap?.sheet
        if (!sheet || String(sheet.kind || '') !== nextKind) continue
        if (operationBundlesAlign(anchor, sheet)) {
          cached = snap
          break
        }
      }
    } else if (!cached && !anchor) {
      cached = sheetSnapshots.current.get(`kind:${nextKind}`)
    }
    if (cached?.sheet && (!anchor || operationBundlesAlign(anchor, cached.sheet))) {
      applySheet(cached.sheet, cached.connName, cached.surfaceId)
      return
    }
    const surface = surfaces.find((s) => {
      if (s.kind !== nextKind) return false
      if (!anchor) return true
      const cached = sheetSnapshots.current.get(`surface:${s.id}`)
      return cached?.sheet ? operationBundlesAlign(anchor, cached.sheet) : false
    })
    if (surface) {
      void loadSurface(surface)
    } else {
      setRows([])
      setColumns([])
      setStaleHint('还没有该型的行快照；请在 AI 会话里操作该业务后回到此页。')
    }
  }, [applySheet, bizCwd, listSheetMeta, loadSurface, surfaces])

  const tableRows = useMemo(() => {
    const previewSheet = drawer?.sheet
    if (previewSheet && isWritePreviewSheet(previewSheet)) {
      return normalizeSheetRows(previewSheet.rows)
    }
    return rows
  }, [drawer?.sheet, rows])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tableRows
    return tableRows.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)))
  }, [query, tableRows])

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

  const gridColumns = useMemo(
    () => tableColumns.filter((column) => column.key !== 'index'),
    [tableColumns],
  )

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
      const sheetChanges = Array.isArray(drawer.sheet.changes) ? drawer.sheet.changes : []
      const sheetColumns = Array.isArray(drawer.sheet.columns) ? drawer.sheet.columns : []
      await runtimeApi.bizWrite(drawer.previewId, undefined, sheetWorkspace, {
        source: 'workstation',
        changes: sheetChanges,
        columns: sheetColumns,
        kind: String(drawer.sheet.kind || ''),
        action: String(drawer.sheet.action || ''),
        no: String(drawer.sheet.no || drawer.sheet.clue || ''),
      })
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
    ? isBizListQueryAction(pending.action) || pending.source === 'ai'
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
          {surfacedKindChips.map((k) => (
            <button
              key={k.kind}
              type="button"
              disabled={!lanReady}
              className={clsx('btn !py-1', kind === k.kind && '!bg-ink !text-white !border-ink')}
              onClick={() => selectKind(k.kind)}
            >
              {k.label}
              {k.count > 0 && (
                <span className="text-[10px] opacity-70 ml-1 tabular-nums">{k.count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input className="input h-8 pl-8 w-48" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索当前记录" />
        </div>
        {currentKindCan.includes('新建') && (
        <button type="button" className="btn-brand !py-1" disabled={!lanReady || loading || !kind} onClick={openCreateForm}>
          <Plus size={13} /> 新建
        </button>
        )}
      </Card>

      {(pendingText || sessionSurfaces.length > 0) && (
        <div className="px-3 py-2 border border-blue-200 bg-blue-50 text-xs text-blue-800 flex flex-wrap items-center gap-2">
          {pendingText && (
            <button type="button" className="underline" onClick={() => { if (pending) void selectKind(pending.kind) }}>
              {pendingText}
            </button>
          )}
          {sessionSurfaces.length > 0 && (
            <select
              className="input h-7 text-xs ml-auto max-w-[320px]"
              value={historySurfaceId}
              onChange={(e) => {
                const id = e.target.value
                setHistorySurfaceId(id)
                if (!id) return
                const row = sessionSurfaces.find((s) => s.id === id)
                if (row) void loadSurface(row)
              }}
            >
              <option value="">本会话浮现历史</option>
              {sessionSurfaces.map((s) => (
                <option key={s.id} value={s.id}>{surfaceHistoryLabel(s)}</option>
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
              onClick={() => void runPreview('新建', { input: pickFilledSheetInput(createDraft) })}
            >
              预览新建
            </button>
            <button type="button" className="btn !py-1" onClick={() => setCreateDraft(null)}>取消</button>
          </div>
        </Card>
      )}

      <Card className="!p-0 overflow-hidden border-line">
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
        <div className="overflow-x-auto overflow-y-auto max-h-[min(70vh,560px)] [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-max border-separate border-spacing-0 text-xs text-ink">
            <thead>
              <tr className="text-left">
                <th className="sticky top-0 left-0 z-20 border-b-2 border-r border-line bg-surface-2 px-2 py-2 font-semibold text-ink-subtle whitespace-nowrap w-12 min-w-12 text-center">
                  {ROW_DISPLAY_INDEX_LABEL}
                </th>
                {gridColumns.map((column) => (
                  <th
                    key={column.key}
                    className="sticky top-0 z-10 border-b-2 border-r border-line bg-surface-2 px-3 py-2 font-semibold text-ink whitespace-nowrap min-w-[108px]"
                  >
                    {column.label || column.key}
                  </th>
                ))}
                <th className="sticky top-0 z-10 border-b-2 border-line bg-surface-2 px-3 py-2 font-semibold text-ink whitespace-nowrap min-w-[96px] text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => {
                const absoluteIndex = (page - 1) * PAGE_SIZE + index
                const displayIndex = absoluteIndex + 1
                const rowKey = sheetRowKey(row, absoluteIndex)
                const draftRow = getRowDraft(row, absoluteIndex)
                const isPending = pending?.action && !isBizListQueryAction(pending.action) && pending.kind === kind
                const isSelected = selectedRowKey === rowKey
                const zebra = index % 2 === 1
                const rowBg = isSelected
                  ? 'bg-brand-soft/80'
                  : isPending
                    ? 'bg-brand-soft/40'
                    : zebra
                      ? 'bg-surface-2/35'
                      : 'bg-white'
                return (
                  <tr
                    key={rowKey}
                    className={clsx(
                      rowBg,
                      !isSelected && 'hover:bg-surface-2/60',
                    )}
                    onClick={() => {
                      setSelectedRow(row)
                      setSelectedRowKey(rowKey)
                    }}
                  >
                    <td className={clsx('sticky left-0 z-[1] border-b border-r border-line/80 px-2 py-1 text-center tabular-nums text-ink-muted align-middle', rowBg)}>
                      <button
                        type="button"
                        className="w-full min-h-6 rounded-sm hover:bg-surface-2/50"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedRow(row)
                          setSelectedRowKey(rowKey)
                        }}
                      >
                        {displayIndex}
                      </button>
                    </td>
                    {gridColumns.map((column) => (
                      <td key={column.key} className={clsx('border-b border-r border-line/80 px-0 py-0 align-middle min-w-[108px] max-w-[300px]', rowBg)}>
                        <EditableSheetCell
                          column={column}
                          value={draftRow[column.key]}
                          onChange={(next) => updateDraftCell(row, absoluteIndex, column.key, next)}
                        />
                      </td>
                    ))}
                    <td className={clsx('border-b border-line/80 px-2.5 py-1.5 text-right whitespace-nowrap align-middle', rowBg)}>
                      {rowActions.map((rowAction, actionIndex) => (
                        <button
                          key={rowAction}
                          type="button"
                          className={clsx('btn !py-0.5 !text-[11px]', actionIndex < rowActions.length - 1 && 'mr-1')}
                          disabled={!lanReady || loading}
                          onClick={(e) => {
                            e.stopPropagation()
                            const extra = rowAction === '改行'
                              ? {
                                no: rowKey,
                                input: pickSheetRowPatch(row, draftRow, tableColumns),
                                originalRow: row,
                              }
                              : { no: rowKey }
                            void runPreview(rowAction, extra)
                          }}
                        >
                          {rowAction}
                        </button>
                      ))}
                    </td>
                  </tr>
                )
              })}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={gridColumns.length + 2} className="border border-line px-3 py-12 text-center text-sm text-ink-muted bg-white">
                    {loading ? '加载中…' : (staleHint || '当前型还没有可展示的行')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
            查看操作记录
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
          patch={drawer.patch}
          columns={columns}
          onClose={dismissPreviewDrawer}
          onConfirm={() => void confirmWrite()}
        />
      )}
    </div>
  )
}
