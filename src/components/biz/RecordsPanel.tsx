import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, CircleAlert, Plus, Search } from 'lucide-react'
import clsx from 'clsx'
import { Card, Empty } from '@/components/ui'
import { BizPreviewDrawer } from '@/components/biz/BizPreviewDrawer'
import {
  cloneSheetRows,
  formatSheetCellDisplayValue,
  type SheetColumn,
  isBizListQueryAction,
  normalizeSheetColumns,
  normalizeSheetRows,
  pickFilledSheetInput,
  pickSheetRowPatch,
  sheetHasConfirmablePreviewChanges,
  sheetRowBusinessNo,
  sheetRowKey,
  sheetRowRenderKey,
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
import {
  listBizKindListSnapshots,
  peekBizKindListSheetBySurfaceId,
  peekBizKindListSheetForOperation,
  rememberBizKindListSheet,
} from '@/lib/biz-kind-list-cache'
import {
  extractBoundKindHints,
  historyOptionLabel,
  kindChipConditionLabels,
  kindChipShowsRowCount,
  listQueryFingerprint,
  coalesceKnownHitTotal,
  listSnapshotCacheKey,
  operationBundlesAlign,
  materializeOperationKindSheet,
  operationChipKey,
  operationKindMatches,
  operationKindHitSheets,
  sheetPrimaryRelation,
  sheetRowsFingerprint,
  shouldHoldSideKindView,
  shouldRejectIncomingCovering,
} from '@/lib/biz-list-query'
import {
  resolveConnectedKind,
  shouldSkipCoveringPending,
  type ConnectedKindRow,
} from '@/lib/connected-kind'
import {
  matchSurfaceIdForSheet,
  peekBizSurfaceSheet,
  rememberBizSurfaceSheet,
} from '@/lib/biz-surface-cache'
import {
  historyIdForSheet,
  historyMissHint,
  mergeHistorySurfaces,
  selectSessionHistorySurfaces,
  shouldBlockIncomingSheetForHistoryPin,
} from '@/lib/biz-records-history'
import {
  clearBizPendingSheet,
  clearBizPreviewDismissed,
  dismissBizPreviewId,
  isBizPreviewDismissed,
  peekBizPendingSheet,
  rememberBizPendingSheet,
  sheetBelongsToSession,
} from '@/lib/biz-session-sheet'
import { isBizSurfaceTool } from '@/lib/biz-tool-events'
import {
  resolveHitSetPickCancelSessionId,
  shouldCancelDshAfterHitSetPick,
  shouldAbortLeftoverAskForWritePreview,
} from '@/lib/biz-hit-set-pick-cancel'
import { useEvents } from '@/lib/events'

const PAGE_SIZE = 10
const ROW_DISPLAY_INDEX_LABEL = '序号'

function sheetHitState(sheet: Record<string, unknown> | null | undefined) {
  const state = String(sheet?.hitTotalState || '')
  if (state === 'known' || state === 'incomplete' || state === 'unknown') return state
  return ''
}

function hitFooterView(sheet: Record<string, unknown> | null | undefined) {
  if (!sheet || typeof sheet !== 'object') return null
  return coalesceKnownHitTotal(sheet, sheet)
}

function hitFooterText(sheet: Record<string, unknown> | null | undefined) {
  const view = hitFooterView(sheet)
  const state = sheetHitState(view)
  if (state === 'incomplete') return '不完整'
  if (state === 'unknown') return '总数未知'
  if (state === 'known' && view && view.hitTotal != null && Number.isFinite(Number(view.hitTotal))) {
    return `共 ${Number(view.hitTotal)} 条`
  }
  return '总数未知'
}

function hitMetaChanged(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
) {
  const a = hitFooterView(prev)
  const b = hitFooterView(next)
  if (String(a?.hitTotalState || '') !== String(b.hitTotalState || '')) return true
  const at = a?.hitTotal
  const bt = b.hitTotal
  if (at == null && bt == null) return false
  return Number(at) !== Number(bt)
}

function serverPageCount(sheet: Record<string, unknown>, shownOnPage: number) {
  const view = hitFooterView(sheet) || sheet
  const state = sheetHitState(view)
  const page = Number(sheet.page) > 0 ? Math.floor(Number(sheet.page)) : 1
  const rawPageSize = Number(sheet.pageSize)
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.floor(rawPageSize)
    : (shownOnPage > 0 ? shownOnPage : PAGE_SIZE)
  const total = Number(view.hitTotal)
  if (state === 'known' && Number.isFinite(total) && total >= 0 && pageSize > 0) {
    return Math.max(1, Math.ceil(total / pageSize))
  }
  if (view.pageFull === true || (pageSize > 0 && shownOnPage >= pageSize)) return page + 1
  return page
}

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

function isApproveAlreadyAtTarget(sheet: Record<string, unknown>) {
  if (sheet.alreadyAtTarget === true) return true
  if (String(sheet.action || '') !== '过审') return false
  const rowCount = Array.isArray(sheet.rows) ? sheet.rows.length : 0
  if (rowCount <= 0) return false
  return !sheetHasConfirmablePreviewChanges(sheet)
}

function shouldOpenWritePreviewDrawer(
  sheet: Record<string, unknown>,
  _historyPinned: boolean,
) {
  if (!isWritePreviewSheet(sheet)) return false
  if (isBizPreviewDismissed(sheet)) return false
  if (isApproveAlreadyAtTarget(sheet)) return true
  if (sheetHasConfirmablePreviewChanges(sheet)) return true
  return false
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

function listRestoreDiffersFromIncoming(restore: ListRestoreSnapshot, incoming: Record<string, unknown>) {
  const incomingRows = normalizeSheetRows(incoming.rows)
  const restoreRows = restore.rows
  if (restoreRows.length > incomingRows.length) return true
  if (!sameSheetRowKeySet(restoreRows, incomingRows)) return true
  if (isWritePreviewSheet(incoming) && !isWritePreviewSheet(restore.sheet)) return true
  return false
}

function listRestoreBelongsToIncoming(restore: ListRestoreSnapshot, incoming: Record<string, unknown>) {
  const incomingKind = String(incoming.kind || '').trim()
  const snapKind = String((restore.sheet && restore.sheet.kind) || '').trim()
  if (incomingKind && snapKind && incomingKind !== snapKind) return false
  const incomingSid = String(incoming.sessionId || '').trim()
  const snapSid = String((restore.sheet && restore.sheet.sessionId) || '').trim()
  if (incomingSid && snapSid && incomingSid !== snapSid) return false
  return true
}

function peekListPendingSheet(sessionId?: string) {
  const sheet = peekBizPendingSheet(sessionId)
  if (!sheet) return null
  if (!isBizListQueryAction(String(sheet.action || ''))) return null
  const k = String(sheet.kind || '')
  return k ? sheet : null
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

export function RecordsPanel({ connections, runtimeReady, onPlanWithTarget }: Props) {
  const activeAiSessionId = useApp((state) => state.activeAiSessionId)
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
  const [kindRelation, setKindRelation] = useState('')
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
  const [sheetIdentity, setSheetIdentity] = useState('')
  const [contextPack, setContextPack] = useState<ContextPack | null>(null)
  const [contextWarnings, setContextWarnings] = useState<string[]>([])
  const [omit, setOmit] = useState<Set<string>>(new Set())
  const [kindCatalog, setKindCatalog] = useState<ConnectedKindRow[]>([])
  const sheetSnapshots = useRef<Map<string, SheetSnapshot>>(new Map())
  const listRestoreRef = useRef<ListRestoreSnapshot | null>(null)
  const displayBeforeWriteRef = useRef<ListRestoreSnapshot | null>(null)
  const appliedSheetFpRef = useRef('')
  const activeListQueryFpRef = useRef('')
  const displayedRowCountRef = useRef(0)
  const historyPinnedSurfaceIdRef = useRef('')
  const historySessionIdRef = useRef('')
  const liveSessionIdRef = useRef('')
  const cancelledWritePreviewRef = useRef('')
  const operationKindViewRef = useRef('')
  const displayedSheetRef = useRef<Record<string, unknown> | null>(null)
  liveSessionIdRef.current = String(activeAiSessionId || '').trim()
  const peekActivePending = useCallback(() => {
    const sid = String(activeAiSessionId || historySessionIdRef.current || '').trim()
    return peekBizPendingSheet(sid || undefined)
  }, [activeAiSessionId])
  const showRecordsBack = Boolean(listRestore)
  const bizCwd = workspaceCwd || activeWorkspaceCwd

  const connectorOptions = useMemo(
    () => connections.map((c) => ({ id: c.id, label: c.name })),
    [connections],
  )

  const kindLabel = useCallback((k: string) => {
    const row = kindCatalog.find((item) => item.kind === k)
    return row?.label || k
  }, [kindCatalog])

  const operationAnchor = useMemo(() => {
    if (listSheetMeta && typeof listSheetMeta === 'object') return listSheetMeta
    return null
  }, [listSheetMeta])

  const surfacedKindChips = useMemo(() => {
    type KindChip = {
      chipKey: string
      kind: string
      relation?: string
      label: string
      count: number
      showCount: boolean
      conditions: string[]
    }
    const pendingSheet = peekActivePending()
    const anchor = (
      pendingSheet && operationAnchor && operationBundlesAlign(pendingSheet, operationAnchor)
        ? pendingSheet
        : (operationAnchor || pendingSheet)
    )
    const byKey = new Map<string, KindChip>()
    const resultKind = resolveConnectedKind(String(anchor?.kind || kind || '').trim(), kindCatalog)
      || String(anchor?.kind || kind || '').trim()
    const mainRelation = sheetPrimaryRelation(anchor)
    const put = (sideKind: string, relation: string, count: number, showCount: boolean) => {
      const name = String(sideKind || '').trim()
      if (!name) return
      const rel = String(relation || '').trim()
      const chipKey = operationChipKey(name, rel)
      if (byKey.has(chipKey)) return
      const conditions = [...new Set([
        ...kindChipConditionLabels(anchor, name),
        ...kindChipConditionLabels(operationAnchor, name),
        ...kindChipConditionLabels(pendingSheet, name),
      ])]
      byKey.set(chipKey, {
        chipKey,
        kind: name,
        ...(rel ? { relation: rel } : {}),
        label: kindLabel(name),
        count,
        showCount,
        conditions,
      })
    }

    if (!anchor) {
      if (kind) {
        put(kind, kindRelation, rows.length, kindChipShowsRowCount(kind, kind))
      }
      return [...byKey.values()]
    }

    const allowedKinds = [...new Set(extractBoundKindHints(anchor))]
    if (!allowedKinds.length && resultKind) allowedKinds.push(resultKind)
    const hits = [
      ...operationKindHitSheets(anchor),
      ...operationKindHitSheets(operationAnchor),
      ...operationKindHitSheets(pendingSheet),
    ]
    const peerTotals = new Map<string, number>()
    for (const source of [anchor, operationAnchor, pendingSheet]) {
      const peers = source && Array.isArray(source.peers) ? source.peers : []
      for (const peer of peers) {
        if (!peer || typeof peer !== 'object') continue
        const name = String(peer.kind || '').trim()
        const rel = String(peer.relation || '').trim()
        if (!name) continue
        const key = operationChipKey(name, rel)
        if (peerTotals.has(key)) continue
        const total = Number(peer.hitTotal)
        peerTotals.set(key, Number.isFinite(total) ? total : (Array.isArray(peer.rows) ? peer.rows.length : 0))
      }
    }
    for (const bound of allowedKinds) {
      const hit = hits.find((sheet) => operationKindMatches(bound, String(sheet.kind || ''), kindCatalog)
        && Array.isArray(sheet.rows))
      let count = hit && Array.isArray(hit.rows)
        ? hit.rows.length
        : (bound === kind ? rows.length : 0)
      let boundRelation = ''
      if (operationKindMatches(bound, resultKind, kindCatalog)) {
        boundRelation = mainRelation
        for (const source of [anchor, operationAnchor, pendingSheet]) {
          if (!source || typeof source !== 'object') continue
          const sourceKind = String(source.kind || '').trim()
          if (!operationKindMatches(bound, sourceKind, kindCatalog)) continue
          const state = String(source.hitTotalState || '')
          const total = Number(source.hitTotal)
          if (!Number.isFinite(total) || total < 0) continue
          if (state && state !== 'known') continue
          count = total
          break
        }
        put(bound, boundRelation, count, true)
        continue
      }
      const peerTotal = peerTotals.get(operationChipKey(bound, ''))
      if (peerTotal != null) {
        put(bound, '', peerTotal, true)
        continue
      }
      put(bound, '', count, kindChipShowsRowCount(bound, resultKind))
    }
    for (const [key, total] of peerTotals) {
      const [peerKind, peerRel = ''] = key.split('\0')
      if (!peerKind) continue
      if (
        operationKindMatches(peerKind, resultKind, kindCatalog)
        && (!peerRel || peerRel === mainRelation)
      ) continue
      put(peerKind, peerRel, total, true)
    }
    const order: string[] = []
    if (resultKind) order.push(operationChipKey(resultKind, mainRelation))
    for (const bound of allowedKinds) {
      const key = operationChipKey(bound, operationKindMatches(bound, resultKind, kindCatalog) ? mainRelation : '')
      if (!order.includes(key)) order.push(key)
    }
    for (const key of peerTotals.keys()) {
      if (!order.includes(key)) order.push(key)
    }
    return order.map((key) => byKey.get(key)).filter(Boolean) as KindChip[]
  }, [kind, kindCatalog, kindLabel, kindRelation, operationAnchor, peekActivePending, rows.length])

  const sessionKey = String(pending?.sessionId || activeAiSessionId || historySessionIdRef.current || '').trim()
  if (sessionKey) historySessionIdRef.current = sessionKey

  const sessionSurfaces = useMemo(() => {
    const byFp = new Map<string, BizSurfaceRecord>()
    const memory: BizSurfaceRecord[] = []
    const cachedIds = new Set<string>()
    const take = (id: string, snap: SheetSnapshot, fp: string) => {
      cachedIds.add(id)
      const rec: BizSurfaceRecord = {
        id,
        workspaceCwd: bizCwd,
        connectionId: null,
        kind: String(snap.sheet.kind || ''),
        action: String(snap.sheet.action || ''),
        previewId: sheetPreviewId(snap.sheet) || null,
        sessionId: typeof snap.sheet.sessionId === 'string' && snap.sheet.sessionId.trim()
          ? snap.sheet.sessionId.trim()
          : null,
        rowCount: Array.isArray(snap.sheet.rows) ? snap.sheet.rows.length : 0,
        columns: [],
        createdAt: Date.now(),
      }
      if (fp) {
        const prev = byFp.get(fp)
        if (!prev) byFp.set(fp, rec)
        else if (prev.id.startsWith('q:') && !id.startsWith('q:')) byFp.set(fp, rec)
      } else {
        memory.push(rec)
      }
    }
    for (const [key, snap] of sheetSnapshots.current.entries()) {
      if (!snap?.sheet) continue
      if (key.startsWith('kind:') && !key.includes(':q:')) continue
      const fp = listQueryFingerprint(snap.sheet)
      const id = snap.surfaceId || historyIdForSheet(snap.sheet, snap.surfaceId, fp)
      if (!id) continue
      take(id, snap, fp)
    }
    memory.push(...byFp.values())
    if (bizCwd) {
      for (const surface of surfaces) {
        if (peekBizSurfaceSheet(bizCwd, surface.id) || peekBizKindListSheetBySurfaceId(bizCwd, surface.id)) {
          cachedIds.add(surface.id)
        }
      }
    }
    return selectSessionHistorySurfaces(mergeHistorySurfaces(surfaces, memory), {
      sessionId: sessionKey,
      cachedIds,
    })
  }, [bizCwd, sessionKey, surfaces, sheetIdentity, listSheetMeta])

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
        resource: typeof row.resource === 'string' ? row.resource : undefined,
        catalogVersion: typeof row.catalogVersion === 'string' ? row.catalogVersion : undefined,
        aliases: [
          ...new Set([
            ...(Array.isArray(row.aliases) ? row.aliases.map(String) : []),
            ...Object.entries(data.aliases || {})
              .filter(([, canonical]) => canonical === row.kind)
              .map(([spoken]) => spoken)
              .filter((spoken) => spoken !== row.kind),
          ]),
        ],
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
    const restoreRows = cloneSheetRows(rows)
    const restoreColumns = columns.length > 0
      ? columns
      : normalizeSheetColumns(listSheetMeta?.columns)
    const base = listSheetMeta && typeof listSheetMeta === 'object'
      ? listSheetMeta
      : { kind, action: pending?.action || '现查' }
    const sheet = {
      ...base,
      kind: String(base.kind || kind || ''),
      rows: restoreRows,
      columns: restoreColumns,
    }
    const kindSnap = kind ? sheetSnapshots.current.get(`kind:${kind}`) : undefined
    return {
      rows: restoreRows,
      columns: restoreColumns,
      page,
      draftEdits,
      sourceLabel,
      connName: kindSnap?.connName || '连接器',
      surfaceId: kindSnap?.surfaceId,
      sheet,
    }
  }, [columns, draftEdits, kind, listSheetMeta, page, pending?.action, rows, sourceLabel])

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

  const rememberDisplayBeforeWrite = useCallback((incomingSheet: Record<string, unknown>) => {
    const incomingKind = String(incomingSheet.kind || '').trim()
    const shownKind = String((listSheetMeta && listSheetMeta.kind) || kind || '').trim()
    const shownAction = String((listSheetMeta && listSheetMeta.action) || '').trim()
    const stashedKind = String(displayBeforeWriteRef.current?.sheet?.kind || '').trim()
    const shownIsList = rows.length > 0 && (shownAction === '' || isBizListQueryAction(shownAction))
    if (displayBeforeWriteRef.current && stashedKind && shownKind && stashedKind !== shownKind && shownIsList) {
      displayBeforeWriteRef.current = null
    }
    if (displayBeforeWriteRef.current) return
    if (rows.length <= 0) return
    if (incomingKind && shownKind && incomingKind !== shownKind) return
    displayBeforeWriteRef.current = captureListRestore()
  }, [captureListRestore, kind, listSheetMeta, rows.length])

  const ensureListRestoreBeforeWritePreview = useCallback((incomingSheet: Record<string, unknown>) => {
    rememberDisplayBeforeWrite(incomingSheet)
    if (listRestoreRef.current && !listRestoreBelongsToIncoming(listRestoreRef.current, incomingSheet)) {
      commitListRestore(null)
    }
    if (listRestoreRef.current) return
    const incomingRows = normalizeSheetRows(incomingSheet.rows)
    const incomingCount = incomingRows.length
    if (rows.length <= 0) return
    const larger = rows.length > incomingCount
    const different = incomingCount > 0 && !sameSheetRowKeySet(rows, incomingRows)
    if (!larger && !different) return
    const candidate = captureListRestore()
    if (listRestoreDiffersFromIncoming(candidate, incomingSheet)) {
      commitListRestore(candidate)
    }
  }, [captureListRestore, commitListRestore, rememberDisplayBeforeWrite, rows])

  const applyDisplayedSnapshot = useCallback((snap: ListRestoreSnapshot) => {
    const liveSid = String(historySessionIdRef.current || activeAiSessionId || '').trim()
    const snapSid = String((snap.sheet && snap.sheet.sessionId) || '').trim()
    if (liveSid && snapSid && snapSid !== liveSid) return false
    setColumns(snap.columns)
    const nextRows = cloneSheetRows(snap.rows)
    setRows(nextRows)
    displayedRowCountRef.current = nextRows.length
    const restoreSheet: Record<string, unknown> = { ...snap.sheet, rows: nextRows, columns: snap.columns }
    const nextFp = sheetRowsFingerprint(restoreSheet)
    appliedSheetFpRef.current = nextFp
    setSheetIdentity(nextFp)
    setDraftEdits(snap.draftEdits)
    setPage(snap.page)
    setSourceLabel(snap.sourceLabel)
    setListSheetMeta(restoreSheet)
    displayedSheetRef.current = restoreSheet
    rememberSheet({
      sheet: restoreSheet,
      connName: snap.connName,
      surfaceId: snap.surfaceId,
    })
    if (!isWritePreviewSheet(restoreSheet)) {
      rememberBizPendingSheet(restoreSheet)
    }
    if (snap.surfaceId) setHistorySurfaceId(snap.surfaceId)
    const nextKind = String(restoreSheet.kind || '')
    if (nextKind) setKind(nextKind)
    const nextSessionId = typeof restoreSheet.sessionId === 'string' && restoreSheet.sessionId.trim()
      ? restoreSheet.sessionId.trim()
      : (historySessionIdRef.current || undefined)
    if (nextSessionId) historySessionIdRef.current = nextSessionId
    setPending({
      kind: String(restoreSheet.kind || ''),
      action: String(restoreSheet.action || ''),
      previewId: sheetPreviewId(restoreSheet) || undefined,
      rows: nextRows.length,
      canWrite: Boolean(restoreSheet.canWrite ?? restoreSheet.can_write),
      source: 'ai',
      sessionId: nextSessionId,
      at: Date.now(),
    })
    return true
  }, [activeAiSessionId, rememberSheet])

  const restoreRecordsList = useCallback(() => {
    const snap = listRestoreRef.current
    if (!snap) return false
    const ok = applyDisplayedSnapshot(snap)
    if (ok) commitListRestore(null)
    return ok
  }, [applyDisplayedSnapshot, commitListRestore])

  const handleRecordsBack = useCallback(() => {
    const pendingSheet = peekActivePending()
    const previewId = drawer?.previewId
      || (pendingSheet ? sheetPreviewId(pendingSheet) : '')
    if (previewId) dismissBizPreviewId(previewId)
    setDrawer(null)
    clearBizPendingSheet(String(activeAiSessionId || historySessionIdRef.current || '').trim() || undefined)
    displayBeforeWriteRef.current = null
    restoreRecordsList()
    void runtimeApi.bizDismissPreview(previewId || undefined).catch(() => undefined)
  }, [activeAiSessionId, drawer?.previewId, peekActivePending, restoreRecordsList])

  const dismissPreviewDrawer = useCallback(() => {
    const pendingSheet = peekActivePending()
    const previewId = drawer?.previewId
      || (pendingSheet ? sheetPreviewId(pendingSheet) : '')
    if (previewId) dismissBizPreviewId(previewId)
    setDrawer(null)
    const floated = displayBeforeWriteRef.current
    displayBeforeWriteRef.current = null
    const floatSheet = floated?.sheet && typeof floated.sheet === 'object' ? floated.sheet : {}
    const restoreRows = floated ? cloneSheetRows(floated.rows) : []
    if (floated && restoreRows.length) {
      const liveSid = String(historySessionIdRef.current || activeAiSessionId || '').trim()
      const restored: Record<string, unknown> = {
        ...floatSheet,
        rows: restoreRows,
        columns: floated.columns,
        action: String(floatSheet.action || '现查') === '现查' ? (floatSheet.action || '现查') : '现查',
        preview_id: '',
        previewId: '',
        canWrite: false,
        ...(liveSid ? { sessionId: liveSid } : {}),
      }
      applyDisplayedSnapshot({ ...floated, sheet: restored, rows: restoreRows })
      rememberBizPendingSheet(restored)
    }
    void runtimeApi.bizDismissPreview(previewId || undefined).then(() => {
      if (floated && restoreRows.length) {
        const liveSid = String(historySessionIdRef.current || activeAiSessionId || '').trim()
        rememberBizPendingSheet({
          ...floatSheet,
          rows: cloneSheetRows(restoreRows),
          action: String(floatSheet.action || '现查') === '现查' ? (floatSheet.action || '现查') : '现查',
          preview_id: '',
          previewId: '',
          canWrite: false,
          ...(liveSid ? { sessionId: liveSid } : {}),
        })
      }
    }).catch(() => undefined)
  }, [activeAiSessionId, applyDisplayedSnapshot, drawer?.previewId, peekActivePending])

  const applySheet = useCallback((
    sheet: Record<string, unknown>,
    connName: string,
    surfaceId?: string,
    surfacedAt?: number,
    keepPending = false,
  ) => {
    const normalizedCols = normalizeSheetColumns(sheet.columns)
    const normalizedRows = cloneSheetRows(sheet.rows)
    const appliedSheet = coalesceKnownHitTotal(
      { ...sheet, rows: normalizedRows, columns: normalizedCols },
      sheet,
    )
    const nextFp = sheetRowsFingerprint(sheet)
    const sameSheet = nextFp && nextFp === appliedSheetFpRef.current
    if (sameSheet) {
      if (hitMetaChanged(displayedSheetRef.current, appliedSheet)) {
        setListSheetMeta(appliedSheet)
        displayedSheetRef.current = appliedSheet
      }
      return
    }
    appliedSheetFpRef.current = nextFp
    activeListQueryFpRef.current = listQueryFingerprint(sheet)
    setSheetIdentity(nextFp)
    setColumns(normalizedCols)
    setRows(normalizedRows)
    displayedRowCountRef.current = normalizedRows.length
    setDraftEdits({})
    const serverPage = Number(sheet.page)
    setPage(Number.isFinite(serverPage) && serverPage > 0 ? Math.floor(serverPage) : 1)
    const action = String(sheet.action || '现查')
    const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(
      surfacedAt ? new Date(surfacedAt) : new Date(),
    )
    setSourceLabel(`${connName} · ${action} ${time}`)
    const nextKind = String(sheet.kind || '')
    if (nextKind) setKind(nextKind)
    setStaleHint('')
    setListSheetMeta(appliedSheet)
    displayedSheetRef.current = appliedSheet
    rememberSheet({ sheet: appliedSheet, connName, surfaceId: historyIdForSheet(appliedSheet, surfaceId, listQueryFingerprint(appliedSheet)) || surfaceId })
    if (!keepPending && !isWritePreviewSheet(appliedSheet)) {
      rememberBizPendingSheet(appliedSheet)
    }
    const historyId = historyIdForSheet(appliedSheet, surfaceId, listQueryFingerprint(appliedSheet))
    if (historyId && !historyPinnedSurfaceIdRef.current) setHistorySurfaceId(historyId)
    const nextSessionId = typeof sheet.sessionId === 'string' && sheet.sessionId.trim()
      ? sheet.sessionId.trim()
      : (historySessionIdRef.current || undefined)
    if (nextSessionId) historySessionIdRef.current = nextSessionId
    if (!keepPending) {
      setPending({
        kind: String(sheet.kind || ''),
        action: String(sheet.action || ''),
        previewId: sheetPreviewId(sheet) || undefined,
        rows: normalizedRows.length,
        canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
        source: 'ai',
        sessionId: nextSessionId,
        at: typeof surfacedAt === 'number' ? surfacedAt : Date.now(),
      })
    }
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

  const bindSurfaceIdIfKnown = useCallback(async (
    sheet: Record<string, unknown>,
    knownId?: string,
  ) => {
    if (!bizCwd) return
    let surfaceId = String(knownId || '').trim()
    try {
      const items = await runtimeApi.listBizSurfaces(bizCwd, 40)
      setSurfaces(items)
      if (!surfaceId) {
        surfaceId = matchSurfaceIdForSheet(items, sheet, {
          previewId: sheetPreviewId(sheet),
        }) || ''
      }
    } catch {
      return
    }
    if (!surfaceId) return
    const conn = connections.find((c) => c.id === connectionId) || connections[0]
    const connName = conn?.name || '连接器'
    rememberBizSurfaceSheet(bizCwd, surfaceId, sheet, connName)
    rememberSheet({ sheet, connName, surfaceId })
    if (!historyPinnedSurfaceIdRef.current) setHistorySurfaceId(surfaceId)
  }, [bizCwd, connectionId, connections, rememberSheet])

  const abortLeftoverAskTurn = (sheet: Record<string, unknown>) => {
    const previewId = sheetPreviewId(sheet)
    const action = String(sheet.action || '')
    if (!shouldAbortLeftoverAskForWritePreview(sheet)) return
    if (cancelledWritePreviewRef.current === previewId) return
    const cancelSessionId = resolveHitSetPickCancelSessionId({
      bindSheet: sheet,
      pendingSheet: sheet,
      activeAiSessionId: liveSessionIdRef.current,
      historySessionId: historySessionIdRef.current,
    })
    if (!cancelSessionId) return
    cancelledWritePreviewRef.current = previewId
    void runtimeApi.cancelAi(cancelSessionId, { kind: 'records-cancel' }).catch(() => undefined)
  }

  const applyPendingSheet = useCallback((sheet: Record<string, unknown>, surfaceId?: string) => {
    const connected = kindCatalog
    let next = sheet
    if (connected.length) {
      const incomingKind = String(sheet.kind || '').trim()
      const resolved = resolveConnectedKind(incomingKind, connected)
      if (!resolved) return false
      if (resolved !== incomingKind) next = { ...sheet, kind: resolved }
    }
    const liveSid = String(liveSessionIdRef.current || '').trim()
    if (liveSid && !sheetBelongsToSession(next, liveSid)) return false
    const rowCount = incomingSheetRowCount(next)
    if (!rowCount && !next.kind) return false
    if (shouldSkipCoveringPending(displayedSheetRef.current, next)) return false
    if (shouldRejectIncomingCovering(next, displayedRowCountRef.current, displayedSheetRef.current, connected)) return false
    if (shouldBlockIncomingSheetForHistoryPin(historyPinnedSurfaceIdRef.current, surfaceId)) {
      return false
    }
    const incomingKind = String(next.kind || '').trim()
    if (shouldHoldSideKindView(
      operationKindViewRef.current,
      next,
      displayedSheetRef.current,
      isWritePreviewSheet(next),
    )) {
      if (!isWritePreviewSheet(next)) rememberBizPendingSheet(next)
      return true
    }
    if (incomingKind) operationKindViewRef.current = incomingKind
    const previewId = sheetPreviewId(next)
    const action = String(next.action || '')
    const isWritePreview = Boolean(previewId && !isBizListQueryAction(action))

    if (isWritePreview && isBizPreviewDismissed(next)) {
      return true
    }

    if (isWritePreview) abortLeftoverAskTurn(next)

    if (isWritePreview) ensureListRestoreBeforeWritePreview(next)

    const incomingQueryFp = listQueryFingerprint(next)
    if (incomingQueryFp && incomingQueryFp !== activeListQueryFpRef.current) {
      appliedSheetFpRef.current = ''
    }
    const incomingFp = sheetRowsFingerprint(next)
    const historyPinned = Boolean(historyPinnedSurfaceIdRef.current)
    if (incomingFp && incomingFp === appliedSheetFpRef.current) {
      const appliedSheet = coalesceKnownHitTotal(
        { ...next, rows: cloneSheetRows(next.rows), columns: normalizeSheetColumns(next.columns) },
        next,
      )
      if (hitMetaChanged(displayedSheetRef.current, appliedSheet)) {
        setListSheetMeta(appliedSheet)
        displayedSheetRef.current = appliedSheet
      }
      if (shouldOpenWritePreviewDrawer(next, historyPinned)) {
        setDrawer((prev) => {
          const prevId = prev?.previewId || ''
          const prevAction = String(prev?.sheet?.action || '')
          if (prev && prevId === previewId && prevAction === action) return prev
          return {
            previewId,
            sheet: next,
            canWrite: Boolean(next.canWrite ?? next.can_write),
          }
        })
      }
      return rowCount > 0 || Boolean(next.kind)
    }
    const conn = connections.find((c) => c.id === connectionId) || connections[0]
    rememberBizPendingSheet(next)
    maybeSaveListRestore(next)
    applySheet(next, conn?.name || '连接器', surfaceId)
    if (!shouldOpenWritePreviewDrawer(next, historyPinned)) setDrawer(null)
    else {
      setDrawer({
        previewId,
        sheet: next,
        canWrite: Boolean(next.canWrite ?? next.can_write),
      })
    }
    void bindSurfaceIdIfKnown(next, surfaceId)
    return rowCount > 0 || Boolean(next.kind)
  }, [applySheet, bindSurfaceIdIfKnown, connectionId, connections, ensureListRestoreBeforeWritePreview, kindCatalog, maybeSaveListRestore])

  const applyPendingSheetRef = useRef(applyPendingSheet)
  applyPendingSheetRef.current = applyPendingSheet
  const peekActivePendingRef = useRef(peekActivePending)
  peekActivePendingRef.current = peekActivePending
  useEffect(() => {
    if (!kindCatalog.length) return
    const pending = peekActivePendingRef.current()
    if (pending) applyPendingSheetRef.current(pending)
  }, [kindCatalog])

  const hydrateFromPending = useCallback(async (surfaceId?: string) => {
    if (historyPinnedSurfaceIdRef.current && !surfaceId) return false
    const sid = String(liveSessionIdRef.current || historySessionIdRef.current || '').trim()
    const cached = peekBizPendingSheet(sid || undefined)
    if (cached && sheetBelongsToSession(cached, sid) && !isBizPreviewDismissed(cached)) {
      if (applyPendingSheet(cached, surfaceId)) return true
    }
    try {
      const { sheet } = await runtimeApi.getBizPendingSheet(undefined, sid || undefined)
      if (liveSessionIdRef.current !== sid) return false
      if (!sheet || typeof sheet !== 'object') return false
      if (isBizPreviewDismissed(sheet)) {
        return false
      }
      if (!sheetBelongsToSession(sheet, sid)) return false
      return applyPendingSheet(sheet, surfaceId)
    } catch {
      return false
    }
  }, [applyPendingSheet])

  useEffect(() => {
    if (!runtimeReady || !workspaceCwd) return
    historyPinnedSurfaceIdRef.current = ''
    operationKindViewRef.current = ''
    cancelledWritePreviewRef.current = ''
    const sid = String(activeAiSessionId || '').trim()
    liveSessionIdRef.current = sid
    historySessionIdRef.current = sid

    const clearDisplayedForSession = () => {
      appliedSheetFpRef.current = ''
      displayedSheetRef.current = null
      displayedRowCountRef.current = 0
      setRows([])
      setColumns([])
      setListSheetMeta(null)
      setPending(null)
      setDrawer(null)
      setKind('')
      setSheetIdentity('')
    }

    const cached = sid ? peekBizPendingSheet(sid) : null
    if (cached && sheetBelongsToSession(cached, sid) && !isBizPreviewDismissed(cached)) {
      applyPendingSheetRef.current(cached)
      return
    }

    clearDisplayedForSession()
    void runtimeApi.getBizPendingSheet(undefined, sid || undefined).then(({ sheet }) => {
      if (liveSessionIdRef.current !== sid) return
      if (
        sheet
        && typeof sheet === 'object'
        && !isBizPreviewDismissed(sheet)
        && sheetBelongsToSession(sheet, sid)
      ) {
        applyPendingSheetRef.current(sheet)
        return
      }
      if (liveSessionIdRef.current === sid) clearDisplayedForSession()
    }).catch(() => undefined)
  }, [activeAiSessionId, runtimeReady, workspaceCwd])

  useEffect(() => {
    if (connectionId) return
    const preferred = connectorOptions[0]
    if (preferred) setConnectionId(preferred.id)
  }, [connectionId, connectorOptions])

  useEffect(() => {
    if (runtimeReady) void probeLanAssist()
  }, [probeLanAssist, runtimeReady])

  useEffect(() => {
    void loadSurfaces()
  }, [loadSurfaces])

  const hydrateFromPendingRef = useRef(hydrateFromPending)
  hydrateFromPendingRef.current = hydrateFromPending
  useEffect(() => {
    if (!runtimeReady || !workspaceCwd) return
    if (historyPinnedSurfaceIdRef.current) return
    void hydrateFromPendingRef.current()
  }, [runtimeReady, workspaceCwd])

  useEffect(() => {
    if (!runtimeReady || !workspaceCwd) return
    if (surfaces.length === 0) return
    if (kind) return
    void (async () => {
      const sid = String(liveSessionIdRef.current || historySessionIdRef.current || '').trim()
      let listPending = peekListPendingSheet(sid || undefined)
      if (!listPending) {
        try {
          const { sheet } = await runtimeApi.getBizPendingSheet(undefined, sid || undefined)
          if (liveSessionIdRef.current !== sid) return
          if (sheet && typeof sheet === 'object' && sheetBelongsToSession(sheet, sid)) {
            rememberBizPendingSheet(sheet)
            listPending = peekListPendingSheet(sid || undefined)
          }
        } catch {
          listPending = null
        }
      }
      if (liveSessionIdRef.current !== sid) return
      if (listPending && sheetBelongsToSession(listPending, sid)) {
        const seedKind = String(listPending.kind || '')
        if (seedKind) setKind(seedKind)
        applyPendingSheetRef.current(listPending)
        return
      }
    })()
  }, [activeAiSessionId, runtimeReady, surfaces, workspaceCwd])

  useEvents(['biz.sheet.pending'], (event) => {
    const payload = event.payload as PendingSheetEvent
    const source = String(event.source || payload.source || '').trim()
    if (source === 'lan-assist') return
    if (payload.sheet && typeof payload.sheet === 'object') {
      const incomingSurfaceId = typeof payload.surfaceId === 'string' ? payload.surfaceId : undefined
      if (shouldBlockIncomingSheetForHistoryPin(historyPinnedSurfaceIdRef.current, incomingSurfaceId)) {
        return
      }
      const sheetWithSession = payload.sheet as Record<string, unknown>
      const eventSessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : ''
      const stamped = eventSessionId && !sheetWithSession.sessionId
        ? { ...sheetWithSession, sessionId: eventSessionId }
        : sheetWithSession
      rememberBizPendingSheet(stamped)
      const liveSid = String(liveSessionIdRef.current || '').trim()
      if (liveSid && !sheetBelongsToSession(stamped, liveSid)) return
      let surfaceId = incomingSurfaceId
      applyPendingSheet(stamped, surfaceId)
      void (async () => {
        if (!bizCwd) return
        if (liveSessionIdRef.current !== liveSid) return
        try {
          const items = await runtimeApi.listBizSurfaces(bizCwd, 40)
          setSurfaces(items)
          if (!surfaceId) {
            surfaceId = matchSurfaceIdForSheet(items, stamped, {
              sessionId: eventSessionId || String(stamped.sessionId || ''),
              previewId: payload.previewId,
            })
          }
          if (!surfaceId) return
          if (shouldBlockIncomingSheetForHistoryPin(historyPinnedSurfaceIdRef.current, surfaceId)) return
          const conn = connections.find((c) => c.id === connectionId) || connections[0]
          const connName = conn?.name || '连接器'
          rememberBizSurfaceSheet(bizCwd, surfaceId, stamped, connName)
          rememberSheet({ sheet: stamped, connName, surfaceId })
          if (!historyPinnedSurfaceIdRef.current) setHistorySurfaceId(surfaceId)
        } catch {
          // ignore list failure — in-memory cache still updated via applyPendingSheet
        }
      })()
    } else {
      if (historyPinnedSurfaceIdRef.current) return
      void hydrateFromPending()
      void loadSurfaces()
    }
  })

  useEvents(['ai.tool.finished'], (event) => {
    const payload = event.payload as { tool?: string; ok?: boolean }
    if (!payload.ok) return
    if (!isBizSurfaceTool(String(payload.tool || ''))) return
    if (historyPinnedSurfaceIdRef.current) return
    const cached = peekActivePending()
    if (cached && sheetBelongsToSession(cached, liveSessionIdRef.current)) {
      applyPendingSheet(cached)
      return
    }
    void hydrateFromPending()
  })

  const runPreview = useCallback(async (
    action: string,
    extra: Record<string, unknown> & { originalRow?: SheetRow } = {},
  ) => {
    if (!lanReady || !kind) return
    setLoading(true)
    setError('')
    setStaleHint('')
    const { originalRow, ...payloadExtra } = extra
    try {
      const conn = connections.find((c) => c.id === connectionId)
      const system = conn?.provider || 'NocoBase'
      const pendingSheet = peekActivePending()
      const bindSheet = (listSheetMeta && pendingSheet)
        ? { ...pendingSheet, ...listSheetMeta }
        : (listSheetMeta || pendingSheet)
      const waitingPick = Boolean(bindSheet && (bindSheet.ambiguous || bindSheet.listed) && !sheetPreviewId(bindSheet))
      let previewBody: Record<string, unknown> = { ...payloadExtra }
      if (action === '改行' && originalRow) {
        const draft = (payloadExtra.input && typeof payloadExtra.input === 'object')
          ? payloadExtra.input as SheetRow
          : originalRow
        const patch = pickSheetRowPatch(originalRow, draft, columns)
        if (!Object.keys(patch).length) {
          if (waitingPick) {
            const rest = { ...payloadExtra }
            delete rest.input
            previewBody = { ...rest, no: sheetRowBusinessNo(originalRow), picked: true }
          } else {
            setError('请先修改至少一个字段后再预览改行')
            return
          }
        } else {
          previewBody = { ...payloadExtra, input: patch, ...(waitingPick ? { picked: true } : {}) }
        }
      }
      if (action === '新建') {
        previewBody = { ...payloadExtra, input: pickFilledSheetInput((payloadExtra.input || {}) as Record<string, unknown>) }
      }
      const hopBind: Record<string, unknown> = {}
      if (bindSheet && typeof bindSheet === 'object') {
        const boundSpeech = String(bindSheet.speech || '').trim()
        if (boundSpeech) hopBind.speech = boundSpeech
        if (bindSheet.from && typeof bindSheet.from === 'object' && !Array.isArray(bindSheet.from)) {
          hopBind.from = bindSheet.from
        }
        if (Array.isArray(bindSheet.where) && bindSheet.where.length) hopBind.where = bindSheet.where
        if (Array.isArray(bindSheet.hopWhere) && bindSheet.hopWhere.length) hopBind.hopWhere = bindSheet.hopWhere
        if (Array.isArray(bindSheet.steps) && bindSheet.steps.length) hopBind.steps = bindSheet.steps
      }
      const data = await runtimeApi.bizPreview({
        kind,
        action,
        system,
        connectionId,
        speech: `${action}${kind}`,
        ...hopBind,
        ...previewBody,
      })
      const rawSheet = (data.sheet && typeof data.sheet === 'object' ? data.sheet : data) as Record<string, unknown>
      const sheet = (waitingPick || previewBody.picked === true)
        ? { ...rawSheet, picked: true }
        : rawSheet
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
      if (shouldCancelDshAfterHitSetPick(waitingPick, action, previewId)) {
        abortLeftoverAskTurn(sheet)
      }
      if (action === '新建') setCreateDraft(null)
      void loadSurfaces()
    } catch (cause) {
      setError(cause instanceof RuntimeApiError ? cause.message : cause instanceof Error ? cause.message : '预览失败')
    } finally {
      setLoading(false)
    }
  }, [activeAiSessionId, applySheet, columns, connectionId, connections, ensureListRestoreBeforeWritePreview, kind, lanReady, listSheetMeta, loadSurfaces, maybeSaveListRestore])

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

  const surfaceHistoryLabel = useCallback((surface: BizSurfaceRecord) => {
    const snap = resolveSurfaceSheet(surface)
    return historyOptionLabel(surface, snap?.sheet)
  }, [resolveSurfaceSheet])

  const loadSurface = useCallback(async (surface: BizSurfaceRecord) => {
    const openPreviewId = drawer?.previewId
      || sheetPreviewId(peekActivePending() || {})
    if (openPreviewId) {
      dismissBizPreviewId(openPreviewId)
      void runtimeApi.bizDismissPreview(openPreviewId).catch(() => undefined)
    }
    setHistorySurfaceId(surface.id)
    historyPinnedSurfaceIdRef.current = surface.id
    operationKindViewRef.current = surface.kind || ''
    setDrawer(null)
    commitListRestore(null)
    appliedSheetFpRef.current = ''
    setSheetIdentity('')
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
      displayedRowCountRef.current = 0
      setColumns(Array.isArray(surface.columns) ? surface.columns as SheetColumn[] : [])
      setListSheetMeta({ kind: surface.kind, action: surface.action, rows: [] })
      setPending({
        kind: surface.kind,
        action: surface.action,
        previewId: surface.previewId || undefined,
        rows: 0,
        source: 'ai',
        sessionId: surface.sessionId || undefined,
        at: surface.createdAt,
      })
      setStaleHint(historyMissHint({
        scope: surfaceHistoryLabel(surface),
      }))
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
    const previewSheet = writePreviewId ? { ...sheet, previewId: writePreviewId, action } : sheet
    if (shouldOpenWritePreviewDrawer(previewSheet, true)) {
      setDrawer({
        previewId: writePreviewId,
        sheet,
        canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
      })
    }
  }, [applySheet, commitListRestore, drawer?.previewId, resolveSurfaceSheet, surfaceHistoryLabel])

  const selectKind = useCallback((nextKind: string, nextRelation?: string) => {
    const pendingSheet = peekActivePending()
    const anchorForKind = pendingSheet || listSheetMeta
    const boundHints = extractBoundKindHints(anchorForKind)
    const spoken = String(nextKind || '').trim()
    const canonical = boundHints.includes(spoken)
      ? spoken
      : (resolveConnectedKind(spoken, kindCatalog) || spoken)
    const displayedKind = resolveConnectedKind(String(listSheetMeta?.kind || kind || ''), kindCatalog)
      || String(listSheetMeta?.kind || kind || '')
    if (canonical && canonical !== displayedKind) {
      appliedSheetFpRef.current = ''
    }
    setKind(canonical)
    setKindRelation(String(nextRelation || '').trim())
    setStaleHint('')
    setSelectedRow(null)
    setSelectedRowKey('')
    operationKindViewRef.current = canonical
    historyPinnedSurfaceIdRef.current = ''
    const anchor = anchorForKind
    const sessionId = String(liveSessionIdRef.current || historySessionIdRef.current || '').trim()
    const boundKinds = extractBoundKindHints(anchor)
    const hitSheets = [
      ...operationKindHitSheets(pendingSheet),
      ...operationKindHitSheets(listSheetMeta),
    ]
    const wantedRelation = String(nextRelation || '').trim()
    const hit = hitSheets.find((sheet) => (
      operationKindMatches(canonical, String(sheet.kind || ''), kindCatalog)
      && (!wantedRelation || String(sheet.relation || '').trim() === wantedRelation)
    ))
      || (anchor ? materializeOperationKindSheet(anchor, canonical, kindCatalog, wantedRelation) : null)

    const applyLocal = () => {
    const mainRel = sheetPrimaryRelation(anchor)
    if (hit) {
      const pendingKind = String(pendingSheet?.kind || '').trim()
      const sideView = Boolean(pendingSheet && !operationKindMatches(pendingKind, canonical, kindCatalog))
      if (
        !sideView
        && pendingSheet
        && operationKindMatches(pendingKind, canonical, kindCatalog)
        && operationBundlesAlign(pendingSheet, listSheetMeta || pendingSheet)
        && (!wantedRelation || wantedRelation === mainRel)
      ) {
        applyPendingSheet(pendingSheet)
        return
      }
      applySheet(hit, '连接器', undefined, undefined, sideView)
      return
    }
    if (boundKinds.some((name) => operationKindMatches(name, canonical, kindCatalog))) {
      setRows([])
      setColumns([])
      setStaleHint('还没有该型的行快照；请在 AI 会话里操作该业务后回到此页。')
      return
    }
    if (
      pendingSheet
      && operationKindMatches(String(pendingSheet.kind || ''), canonical, kindCatalog)
      && operationBundlesAlign(pendingSheet, listSheetMeta || pendingSheet)
      && (!wantedRelation || wantedRelation === mainRel)
    ) {
      applyPendingSheet(pendingSheet)
      return
    }
    if (bizCwd) {
      const scoped = peekBizKindListSheetForOperation(bizCwd, canonical, anchor)
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
        if (!parsed.kind || parsed.kind === canonical) {
          keyed = sheetSnapshots.current.get(listSnapshotCacheKey(canonical, {
            kind: canonical,
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
        if (!operationKindMatches(canonical, String(sheet.kind || ''), kindCatalog)) continue
        if (operationBundlesAlign(anchor, sheet)) {
          cached = snap
          break
        }
      }
    }
    if (cached?.sheet && (!anchor || operationBundlesAlign(anchor, cached.sheet))) {
      applySheet(cached.sheet, cached.connName, cached.surfaceId)
      return
    }
    const surface = surfaces.find((s) => {
      const surfaceKind = resolveConnectedKind(s.kind, kindCatalog) || s.kind
      if (surfaceKind !== canonical) return false
      const cachedSheet = sheetSnapshots.current.get(`surface:${s.id}`)
      if (!cachedSheet?.sheet) return false
      if (!anchor) return false
      return operationBundlesAlign(anchor, cachedSheet.sheet)
    })
    if (surface) {
      void loadSurface(surface)
    } else {
      setRows([])
      setColumns([])
      setStaleHint('还没有该型的行快照；请在 AI 会话里操作该业务后回到此页。')
    }
    }

    const mainRel = sheetPrimaryRelation(anchor)
    const peerChip = Boolean(String(wantedRelation || '').trim() && String(wantedRelation || '').trim() !== mainRel)
    const finishSelect = async () => {
      if (sessionId && anchor && !peerChip) {
        try {
          const data = await runtimeApi.bizFocusKind({
            sessionId,
            kind: canonical,
            ...(bizCwd ? { workspace: bizCwd } : {}),
          })
          if (data.sheet && typeof data.sheet === 'object') {
            const focusedKind = String(data.sheet.kind || '').trim()
            if (operationKindMatches(canonical, focusedKind, kindCatalog)) {
              applySheet(data.sheet, '连接器')
              return
            }
          }
        } catch {
          /* fall back to local materialize */
        }
      }
      applyLocal()
    }
    void finishSelect()
  }, [applySheet, applyPendingSheet, bizCwd, kind, kindCatalog, listSheetMeta, loadSurface, peekActivePending, surfaces])

  const tableRows = rows

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tableRows
    return tableRows.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)))
  }, [query, tableRows])

  useEffect(() => {
    setPage(1)
  }, [kind, query])

  const hitState = sheetHitState(listSheetMeta)
  const serverPaged = Boolean(hitState && listSheetMeta)
  const totalPages = serverPaged && listSheetMeta
    ? serverPageCount(listSheetMeta, filteredRows.length)
    : Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const displayPage = serverPaged && listSheetMeta && Number(listSheetMeta.page) > 0
    ? Math.floor(Number(listSheetMeta.page))
    : page
  const turnHitPage = useCallback(async (nextPage: number) => {
    if (!serverPaged || !listSheetMeta || !kind) {
      setPage(nextPage)
      return
    }
    setLoading(true)
    setError('')
    try {
      const conn = connections.find((item) => item.id === connectionId)
      const data = await runtimeApi.bizPreview({
        kind,
        action: '现查',
        system: conn?.provider || 'NocoBase',
        connectionId,
        speech: String(listSheetMeta.speech || ''),
        ...(listSheetMeta.from && typeof listSheetMeta.from === 'object' ? { from: listSheetMeta.from } : {}),
        ...(Array.isArray(listSheetMeta.where) && listSheetMeta.where.length ? { where: listSheetMeta.where } : {}),
        ...(Array.isArray(listSheetMeta.hopWhere) && listSheetMeta.hopWhere.length ? { hopWhere: listSheetMeta.hopWhere } : {}),
        ...(Array.isArray(listSheetMeta.steps) && listSheetMeta.steps.length ? { steps: listSheetMeta.steps } : {}),
        replay: true,
        page: nextPage,
      })
      const rawSheet = (data.sheet && typeof data.sheet === 'object' ? data.sheet : data) as Record<string, unknown>
      applySheet(rawSheet, conn?.name || '连接器')
    } catch (cause) {
      setError(cause instanceof RuntimeApiError ? cause.message : cause instanceof Error ? cause.message : '翻页失败')
    } finally {
      setLoading(false)
    }
  }, [applySheet, connectionId, connections, kind, listSheetMeta, serverPaged])
  const paginatedRows = useMemo(() => {
    if (serverPaged) return filteredRows
    const start = (page - 1) * PAGE_SIZE
    return filteredRows.slice(start, start + PAGE_SIZE)
  }, [filteredRows, page, serverPaged])

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
        sessionId: String(drawer.sheet.sessionId || ''),
        speech: String(drawer.sheet.speech || ''),
      })
      clearBizPreviewDismissed(drawer.previewId)
      clearBizPendingSheet(String(activeAiSessionId || historySessionIdRef.current || '').trim() || undefined)
      setNotice('已过账，表格保留本次预览行供核对')
      setDrawer(null)
      commitListRestore(null)
      void loadSurfaces()
    } catch (cause) {
      const failedPreviewId = drawer?.previewId
      setError(formatBizPanelError(cause, '过账失败，请重新预览后再试'))
      if (failedPreviewId) {
        dismissBizPreviewId(failedPreviewId)
        clearBizPendingSheet(String(activeAiSessionId || historySessionIdRef.current || '').trim() || undefined)
        setDrawer(null)
        displayBeforeWriteRef.current = null
        restoreRecordsList()
        void runtimeApi.bizDismissPreview(failedPreviewId).catch(() => undefined)
      }
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

  const connectorPicker = connectorOptions.length > 1 ? (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted shrink-0">
      <span>连接器</span>
      <select
        className="input h-7 text-xs max-w-[min(16rem,100%)]"
        value={connectionId}
        onChange={(event) => setConnectionId(event.target.value)}
      >
        {connectorOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
    </label>
  ) : null

  if (!connectorOptions.length) {
    return <Empty title="先在设置登记业务连接器" hint="登记后可在此对 AI 浮现的业务行做过账" />
  }

  const pendingText = pending
    ? isBizListQueryAction(pending.action)
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

      <Card className="!p-3 space-y-2">
        {connectorPicker}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {surfacedKindChips.map((k) => (
              <button
                key={k.chipKey}
                type="button"
                disabled={k.count <= 0 && !lanReady}
                className={clsx(
                  'btn !py-1',
                  kind === k.kind && (k.relation || '') === (kindRelation || sheetPrimaryRelation(listSheetMeta))
                    && '!bg-ink !text-white !border-ink',
                )}
                onClick={() => selectKind(k.kind, k.relation)}
              >
                {k.label}
                {k.conditions.map((text) => (
                  <span key={text} className="text-[10px] opacity-80 ml-1">{text}</span>
                ))}
                {k.showCount && k.count > 0 && (
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
        </div>
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
              className="input h-7 text-xs ml-auto max-w-[min(28rem,100%)]"
              value={historySurfaceId}
              title={(() => {
                const row = sessionSurfaces.find((s) => s.id === historySurfaceId)
                return row ? surfaceHistoryLabel(row) : '本会话浮现历史'
              })()}
              onChange={(e) => {
                const id = e.target.value
                setHistorySurfaceId(id)
                if (!id) {
                  historyPinnedSurfaceIdRef.current = ''
                  void hydrateFromPending()
                  return
                }
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
            <tbody key={sheetIdentity || 'empty'} data-sheet-fp={sheetIdentity || undefined}>
              {paginatedRows.map((row, index) => {
                const rowPageSize = serverPaged && listSheetMeta && Number(listSheetMeta.pageSize) > 0
                  ? Number(listSheetMeta.pageSize)
                  : PAGE_SIZE
                const absoluteIndex = (displayPage - 1) * rowPageSize + index
                const displayIndex = absoluteIndex + 1
                const rowKey = sheetRowRenderKey(row, absoluteIndex, sheetIdentity)
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
                            const recordId = row.fields && typeof row.fields === 'object' && row.fields.id != null
                              ? String(row.fields.id)
                              : ''
                            const extra = rowAction === '改行'
                              ? {
                                no: recordId || sheetRowBusinessNo(row),
                                input: pickSheetRowPatch(row, draftRow, tableColumns),
                                originalRow: row,
                              }
                              : { no: recordId || sheetRowBusinessNo(row) }
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
        <span data-records-footer={hitFooterText(listSheetMeta)} data-hit-total-state={hitState}>
          {hitFooterText(listSheetMeta)}{sourceLabel ? ` · ${sourceLabel}` : ''}
        </span>
        <div className="flex items-center gap-2">
          <span>第 {displayPage} / {totalPages} 页</span>
          <button type="button" className="btn h-7" disabled={displayPage <= 1 || loading} onClick={() => { if (serverPaged) void turnHitPage(displayPage - 1); else setPage((p) => Math.max(1, p - 1)) }}>上一页</button>
          <button type="button" className="btn h-7" disabled={displayPage >= totalPages || loading} onClick={() => { if (serverPaged) void turnHitPage(displayPage + 1); else setPage((p) => Math.min(totalPages, p + 1)) }}>下一页</button>
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
