import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileClock, FileSearch, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { Card, Tag } from '@/components/ui'
import { DrawerShell } from '@/components/DrawerShell'
import { BizRollbackConfirmDrawer, rollbackDrawerChanges } from '@/components/biz/BizRollbackConfirmDrawer'
import { PreviewChangesList, rollbackChangesFromAudit } from '@/components/biz/PreviewChangesList'
import { RuntimeApiError, runtimeApi } from '@/lib/runtime-api'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import {
  formatSheetCellDisplayValue,
  normalizeSheetColumns,
  type PreviewChange,
} from '@/lib/biz-sheet-display'
import {
  isPermanentRollbackFailure,
  normalizeRollbackBadge,
  type BizRollbackBadge,
} from '@/lib/biz-rollback-outcome'
import {
  HISTORY_PAGE_SIZE,
  actionTone,
  collectActionTokens,
  historyRecordStatus,
  historyRowMatches,
  historySearchHaystack,
  paginateHistory,
} from '@/lib/biz-operation-history'

export type BizTraceRow = {
  id: string
  traceId: string
  at: number
  kind: string
  no: string
  action: string
  receiptId?: string
  sessionId?: string
  source?: string
  changesSummary?: string
  canRollback?: boolean
  rollbackBadge?: BizRollbackBadge
  rollbackState?: string
  changes?: Array<{ label?: string; field?: string; key?: string; from?: unknown; to?: unknown }>
  columns?: Array<{ key?: string; label?: string; enums?: Record<string, string> }>
}

type Props = {
  runtimeReady: boolean
}

const RECORD_ACTION_ALIASES: Record<string, string> = {
  'record.update': '改行',
  'record.create': '新建',
  'record.delete': '删除',
  'record.read': '现查',
}

function formatTraceTime(at: number) {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function sourceLabel(source?: string) {
  if (source === 'ai') return 'AI'
  if (source === 'workstation') return '工作台'
  return source || '—'
}

function normalizeTraceAction(action: string) {
  const trimmed = String(action || '').trim()
  if (RECORD_ACTION_ALIASES[trimmed]) return RECORD_ACTION_ALIASES[trimmed]
  if (trimmed.startsWith('record.')) return trimmed
  return trimmed || '写入'
}

function formatError(cause: unknown) {
  if (cause instanceof RuntimeApiError) return cause.message
  return cause instanceof Error ? cause.message : String(cause)
}

function RollbackStatusTag({ badge, action }: { badge?: BizRollbackBadge; action?: string }) {
  const status = historyRecordStatus(action || '', badge)
  if (!status) return null
  return <Tag kind={status.kind}>{status.label}</Tag>
}

function traceDisplayChanges(row: BizTraceRow): PreviewChange[] {
  const columns = normalizeSheetColumns(row.columns)
  const changes = Array.isArray(row.changes) ? row.changes : []
  return changes.map((item) => {
    const key = String(item.field || item.key || '').trim()
    const col = columns.find((c) => c.key === key)
    const label = String(item.label || col?.label || key).trim() || '字段'
    const from = formatSheetCellDisplayValue(item.from, col)
    const to = formatSheetCellDisplayValue(item.to, col)
    if (from === to) return null
    return { label, from, to }
  }).filter(Boolean) as PreviewChange[]
}

function listChangeDetail(row: BizTraceRow): string {
  const diffs = traceDisplayChanges(row)
  if (!diffs.length) {
    const summary = String(row.changesSummary || '').trim()
    return summary && summary !== '—' ? summary : '—'
  }
  const parts = diffs.slice(0, 2).map((item) => `${item.label}：${item.from}→${item.to}`)
  if (diffs.length > 2) parts.push(`等 ${diffs.length} 项`)
  return parts.join('；')
}

function looksLikeJsonDump(text: string) {
  const raw = String(text || '').trim()
  if (!raw) return false
  if (!(raw.startsWith('{') || raw.startsWith('['))) return false
  try {
    JSON.parse(raw)
    return true
  } catch {
    return /"(ok|error|traceId|receipt)"\s*:/.test(raw)
  }
}

function originTextFromCorpus(result: { ok?: boolean; title?: string; text?: string; message?: string }) {
  const text = String(result.text || '').trim()
  if (result.ok && text && !looksLikeJsonDump(text)) {
    return { ok: true as const, title: String(result.title || '当时原文'), text }
  }
  const message = String(result.message || '').trim()
  return {
    ok: false as const,
    message: message || '暂时读不出当时对话或记下的文本。不是回退，也不是业务表。',
  }
}

type CorpusView =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; title: string; text: string }
  | { state: 'error'; message: string }

export function OperationRecordPanel({ runtimeReady }: Props) {
  const [rows, setRows] = useState<BizTraceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [kindCatalog, setKindCatalog] = useState<Array<{ kind: string; label: string; can: string[] }>>([])
  const [traceOpen, setTraceOpen] = useState(false)
  const [selected, setSelected] = useState<BizTraceRow | null>(null)
  const [corpusView, setCorpusView] = useState<CorpusView>({ state: 'idle' })
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [rollbackChanges, setRollbackChanges] = useState<PreviewChange[]>([])
  const [rollbackMeta, setRollbackMeta] = useState<{ kind: string; no: string; action: string; traceId: string } | null>(null)
  const [rollbackBusy, setRollbackBusy] = useState(false)
  const [rollbackError, setRollbackError] = useState('')
  const [rollbackPreviewId, setRollbackPreviewId] = useState('')
  const [rollbackFeedback, setRollbackFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const showRollbackFeedback = useCallback((kind: 'success' | 'error', text: string) => {
    const message = text.trim()
    if (!message) return
    setRollbackFeedback({ kind, text: message })
  }, [])

  useEffect(() => {
    if (!rollbackFeedback) return
    const timer = window.setTimeout(() => setRollbackFeedback(null), 12000)
    return () => window.clearTimeout(timer)
  }, [rollbackFeedback])

  const kindLabel = useCallback((k: string) => {
    const row = kindCatalog.find((item) => item.kind === k)
    return row?.label || k
  }, [kindCatalog])

  const refresh = useCallback(async () => {
    if (!runtimeReady) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { rows: next } = await runtimeApi.listBizTraces(200)
      const mapped = (Array.isArray(next) ? next : []).map((row) => {
        const item = row as Record<string, unknown>
        const traceId = String(item.traceId || item.id || '')
        return {
          id: traceId,
          traceId,
          at: Number(item.at || 0),
          kind: String(item.kind || ''),
          no: String(item.no || ''),
          action: normalizeTraceAction(String(item.action || '')),
          receiptId: String(item.receiptId || item.receipt_id || ''),
          sessionId: String(item.sessionId || item.session_id || ''),
          source: String(item.source || ''),
          changesSummary: String(item.changesSummary || '—'),
          rollbackBadge: normalizeRollbackBadge(
            Boolean(item.canRollback),
            typeof item.rollbackBadge === 'string' ? item.rollbackBadge : undefined,
            typeof item.rollbackState === 'string' ? item.rollbackState : undefined,
          ),
          canRollback: normalizeRollbackBadge(
            Boolean(item.canRollback),
            typeof item.rollbackBadge === 'string' ? item.rollbackBadge : undefined,
            typeof item.rollbackState === 'string' ? item.rollbackState : undefined,
          ) === 'can',
          rollbackState: String(item.rollbackState || 'none'),
          changes: Array.isArray(item.changes) ? item.changes as BizTraceRow['changes'] : [],
          columns: Array.isArray(item.columns) ? item.columns as BizTraceRow['columns'] : [],
        }
      }).filter((row) => row.traceId)
      setRows(mapped)
    } catch (cause) {
      setError(formatError(cause))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [runtimeReady])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!runtimeReady) return
    const workspace = loadCurrentWorkspaceCwd()
    const cwd = workspace.ok ? workspace.cwd : undefined
    void runtimeApi.listBizKinds(undefined, cwd).then((data) => {
      const kinds = Array.isArray(data.kinds) ? data.kinds : []
      setKindCatalog(kinds.map((k) => ({
        kind: String(k.kind || ''),
        label: String(k.label || k.kind || ''),
        can: Array.isArray(k.can) ? k.can.map((item) => String(item || '').trim()).filter(Boolean) : [],
      })))
    }).catch(() => undefined)
  }, [runtimeReady])

  const openTrace = (row: BizTraceRow) => {
    setSelected(row)
    setCorpusView({ state: 'idle' })
    setRollbackError('')
    setTraceOpen(true)
  }

  const closeTrace = () => {
    setTraceOpen(false)
    setSelected(null)
    setCorpusView({ state: 'idle' })
    setRollbackError('')
  }

  const reviewCorpus = async (traceId: string) => {
    setCorpusView({ state: 'loading' })
    try {
      const result = await runtimeApi.fetchCorpus(`biz:${traceId}`)
      const origin = originTextFromCorpus(result)
      if (origin.ok) {
        setCorpusView({ state: 'ok', title: origin.title, text: origin.text })
        return
      }
      setCorpusView({ state: 'error', message: origin.message })
    } catch (cause) {
      const message = cause instanceof RuntimeApiError ? cause.message : formatError(cause)
      setCorpusView({
        state: 'error',
        message: message || '暂时读不出当时对话或记下的文本。不是回退，也不是业务表。',
      })
    }
  }

  const openRollback = async (row: BizTraceRow) => {
    setRollbackError('')
    setRollbackPreviewId('')
    const columns = normalizeSheetColumns(row.columns)
    const changes = traceDisplayChanges(row)
    const resolved = changes.length
      ? changes
      : rollbackChangesFromAudit((row.changes || []).map((item) => {
        const key = String(item.field || item.key || '').trim()
        const col = columns.find((c) => c.key === key)
        return { ...item, label: item.label || col?.label || key }
      }))
    if (!resolved.length) {
      const message = '没有可恢复的字段差异'
      showRollbackFeedback('error', message)
      setRollbackError(message)
      return
    }
    setRollbackMeta({
      kind: kindLabel(row.kind),
      no: row.no,
      action: normalizeTraceAction(row.action),
      traceId: row.traceId,
    })
    setRollbackChanges(resolved)
    setRollbackOpen(true)
    setRollbackBusy(true)
    try {
      const data = await runtimeApi.bizRollbackPreview(row.traceId)
      const serverChanges = rollbackDrawerChanges(
        row.changes || [],
        Array.isArray(data.rollbackChanges) ? data.rollbackChanges as Array<{ label?: string; field?: string; from?: unknown; to?: unknown }> : undefined,
      )
      if (serverChanges.length) setRollbackChanges(serverChanges)
      const sheet = (data.sheet && typeof data.sheet === 'object' ? data.sheet : data.preview) as Record<string, unknown>
      const previewId = String(sheet?.preview_id || sheet?.previewId || '')
      if (!previewId) throw new Error('回退预览未返回 preview_id')
      setRollbackPreviewId(previewId)
    } catch (cause) {
      const message = formatError(cause) || '回退预览失败'
      setRollbackError(message)
      showRollbackFeedback('error', message)
      if (isPermanentRollbackFailure(cause)) {
        await refresh()
        setSelected((prev) => (prev && prev.traceId === row.traceId
          ? { ...prev, canRollback: false, rollbackBadge: 'blocked', rollbackState: 'blocked' }
          : prev))
      }
    } finally {
      setRollbackBusy(false)
    }
  }

  const confirmRollback = async () => {
    if (!rollbackMeta) return
    setRollbackBusy(true)
    setRollbackError('')
    let previewId = rollbackPreviewId.trim()
    try {
      if (!previewId) {
        const data = await runtimeApi.bizRollbackPreview(rollbackMeta.traceId)
        const serverChanges = rollbackDrawerChanges(
          selected?.changes || [],
          Array.isArray(data.rollbackChanges) ? data.rollbackChanges as Array<{ label?: string; field?: string; from?: unknown; to?: unknown }> : undefined,
        )
        if (serverChanges.length) setRollbackChanges(serverChanges)
        const sheet = (data.sheet && typeof data.sheet === 'object' ? data.sheet : data.preview) as Record<string, unknown>
        previewId = String(sheet?.preview_id || sheet?.previewId || '')
        if (!previewId) throw new Error('回退预览未返回 preview_id')
        setRollbackPreviewId(previewId)
      }
      const workspaceResult = loadCurrentWorkspaceCwd()
      const workspace = workspaceResult.ok ? workspaceResult.cwd : undefined
      await runtimeApi.bizWrite(previewId, undefined, workspace, {
        source: 'workstation',
        rollback_of_trace_id: rollbackMeta.traceId,
        sessionId: selected?.sessionId || '',
      })
      void runtimeApi.bizDismissPreview(previewId).catch(() => undefined)
      const successText = '已回退并写回。'
      showRollbackFeedback('success', successText)
      setRollbackOpen(false)
      setRollbackMeta(null)
      setRollbackPreviewId('')
      setRollbackError('')
      closeTrace()
      await refresh()
    } catch (cause) {
      const message = formatError(cause) || '回退写回失败'
      setRollbackError(message)
      showRollbackFeedback('error', message)
      if (isPermanentRollbackFailure(cause)) {
        await refresh()
        setSelected((prev) => (prev && prev.traceId === rollbackMeta.traceId
          ? { ...prev, canRollback: false, rollbackBadge: 'blocked', rollbackState: 'blocked' }
          : prev))
      }
    } finally {
      setRollbackBusy(false)
    }
  }

  const listLine = useCallback((row: BizTraceRow) => {
    const action = normalizeTraceAction(row.action)
    const kind = kindLabel(row.kind)
    const parts = [action]
    if (kind) parts.push(kind)
    if (row.no) parts.push(row.no)
    return parts.join(' · ')
  }, [kindLabel])

  const rowHaystack = useCallback((row: BizTraceRow) => historySearchHaystack([
    kindLabel(row.kind),
    row.kind,
    normalizeTraceAction(row.action),
    row.no,
    row.changesSummary,
    listChangeDetail(row),
  ]), [kindLabel])

  const actionTokens = useMemo(() => {
    const items: string[] = []
    for (const row of kindCatalog) items.push(...row.can)
    for (const row of rows) items.push(normalizeTraceAction(row.action))
    return collectActionTokens(items)
  }, [kindCatalog, rows])

  useEffect(() => {
    setPage(1)
  }, [query])

  const filteredRows = useMemo(
    () => rows.filter((row) => historyRowMatches(rowHaystack(row), query)),
    [query, rowHaystack, rows],
  )

  const paged = useMemo(
    () => paginateHistory(filteredRows, page, HISTORY_PAGE_SIZE),
    [filteredRows, page],
  )

  useEffect(() => {
    if (paged.page !== page) setPage(paged.page)
  }, [page, paged.page])

  const selectedChanges = useMemo(
    () => (selected ? traceDisplayChanges(selected) : []),
    [selected],
  )

  return (
    <>
      {rollbackFeedback && (
        <div
          className={
            rollbackFeedback.kind === 'success'
              ? 'fixed top-4 left-1/2 z-[100] -translate-x-1/2 max-w-lg w-[min(calc(100%-2rem),32rem)] px-4 py-3 rounded-lg border border-teal-200 bg-teal-50 text-sm text-teal-950 shadow-lg'
              : 'fixed top-4 left-1/2 z-[100] -translate-x-1/2 max-w-lg w-[min(calc(100%-2rem),32rem)] px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-accent-red shadow-lg'
          }
          role="alert"
          aria-live="assertive"
        >
          {rollbackFeedback.text}
        </div>
      )}
      <Card className="!p-0 overflow-hidden min-w-0 w-full">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">操作历史</div>
            <div className="text-xs text-ink-muted mt-0.5">本工作区 AI 与工作台写入记录；点一条可展开详情</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                className="input h-8 pl-8 w-48"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="对象、动作、单号、变更摘要"
                aria-label="搜索操作历史"
              />
            </div>
            <button type="button" className="btn !py-1" disabled={loading} onClick={() => void refresh()}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>
        </div>
        {rollbackFeedback && (
          <div
            className={
              rollbackFeedback.kind === 'success'
                ? 'px-4 py-2 text-xs text-teal-900 border-b border-teal-200 bg-teal-50'
                : 'px-4 py-2 text-xs text-accent-red border-b border-line bg-red-50'
            }
            role="status"
          >
            {rollbackFeedback.text}
          </div>
        )}
        {error && <div className="px-4 py-2 text-xs text-accent-red border-b border-line bg-red-50">{error}</div>}
        {loading && rows.length === 0 ? (
          <div className="py-16 flex justify-center text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-muted px-4">
            还没有操作记录。在业务记录或 AI 会话中完成一次确认过账后，会出现在这里。
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-muted px-4">
            没有匹配的操作记录。
          </div>
        ) : (
          <>
            <div className="divide-y divide-line">
              {paged.rows.map((row) => {
                const action = normalizeTraceAction(row.action)
                const tone = actionTone(action, actionTokens)
                const status = historyRecordStatus(action, row.rollbackBadge)
                return (
                  <button
                    key={row.traceId}
                    type="button"
                    onClick={() => openTrace(row)}
                    className="w-full px-4 py-3 text-left flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-surface-2"
                    data-history-action={action}
                    data-history-action-tone={tone}
                    data-history-status={status?.label || ''}
                    data-history-status-tone={status?.kind || ''}
                  >
                    <div className="w-8 h-8 rounded border border-line bg-surface-2 flex items-center justify-center shrink-0">
                      <FileClock size={14} className="text-ink-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{listLine(row)}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5 line-clamp-2">
                        {formatTraceTime(row.at)} · {sourceLabel(row.source)} · {listChangeDetail(row)}
                      </div>
                    </div>
                    <Tag kind={tone}>{action}</Tag>
                    <Tag kind="default">{sourceLabel(row.source)}</Tag>
                    <RollbackStatusTag badge={row.rollbackBadge} action={row.action} />
                  </button>
                )
              })}
            </div>
            <div className="px-4 py-2 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
              <span>共 {filteredRows.length} 条</span>
              <div className="flex items-center gap-2">
                <span data-history-page={paged.page} data-history-page-size={HISTORY_PAGE_SIZE} data-history-total-pages={paged.totalPages}>
                  第 {paged.page} / {paged.totalPages} 页
                </span>
                <button
                  type="button"
                  className="btn h-7"
                  disabled={paged.page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  上一页
                </button>
                <button
                  type="button"
                  className="btn h-7"
                  disabled={paged.page >= paged.totalPages}
                  onClick={() => setPage((current) => Math.min(paged.totalPages, current + 1))}
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {traceOpen && selected && (
        <div
          className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end"
          onClick={closeTrace}
          role="presentation"
        >
          <div
            className="h-full w-full max-w-md shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <DrawerShell
              title="操作 trace"
              subtitle={`${formatTraceTime(selected.at)} · ${sourceLabel(selected.source)}`}
              onClose={closeTrace}
            >
              <div className="flex-1 overflow-auto p-4 space-y-4 text-sm">
                <div className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-2 text-xs">
                  <span className="text-ink-muted">时间</span><span>{formatTraceTime(selected.at)}</span>
                  <span className="text-ink-muted">来源</span><span>{sourceLabel(selected.source)}</span>
                  <span className="text-ink-muted">动作</span><span>{normalizeTraceAction(selected.action)}</span>
                  <span className="text-ink-muted">业务型</span><span>{kindLabel(selected.kind) || '—'}</span>
                  <span className="text-ink-muted">单号</span><span className="font-mono break-all">{selected.no || '—'}</span>
                  <span className="text-ink-muted">变更摘要</span><span>{selected.changesSummary || '—'}</span>
                  <span className="text-ink-muted">回执</span><span className="font-mono break-all">{selected.receiptId || '—'}</span>
                  <span className="text-ink-muted">Trace</span><span className="font-mono break-all text-[11px]">{selected.traceId}</span>
                </div>

                {selectedChanges.length > 0 && (
                  <div>
                    <div className="text-xs text-ink-muted mb-2">变更字段</div>
                    <PreviewChangesList changes={selectedChanges} />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn !py-1 inline-flex items-center gap-1"
                    disabled={corpusView.state === 'loading'}
                    onClick={() => void reviewCorpus(selected.traceId)}
                  >
                    {corpusView.state === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <FileSearch size={12} />}
                    审查 corpus
                  </button>
                  {selected.rollbackBadge === 'can' ? (
                    <button
                      type="button"
                      className="btn-brand !py-1"
                      disabled={rollbackBusy}
                      onClick={() => void openRollback(selected)}
                    >
                      <RotateCcw size={12} /> 回退
                    </button>
                  ) : selected.rollbackBadge === 'rolled_back' ? (
                    <span className="text-xs text-ink-muted self-center">本条已回退</span>
                  ) : selected.rollbackBadge === 'blocked' ? (
                    <span className="text-xs text-ink-muted self-center">本条无法回退</span>
                  ) : (
                    <span className="text-xs text-ink-muted self-center">无字段差异记录，不可回退</span>
                  )}
                </div>

                {corpusView.state === 'ok' && (
                  <div className="rounded border border-line bg-surface-2 px-3 py-3 text-xs space-y-2">
                    <div className="font-medium text-ink">{corpusView.title || '当时原文'}</div>
                    <pre className="whitespace-pre-wrap text-ink-muted font-sans leading-relaxed max-h-48 overflow-auto">{corpusView.text}</pre>
                  </div>
                )}
                {corpusView.state === 'error' && (
                  <div className="rounded border border-line bg-surface-2 px-3 py-3 text-xs text-ink-muted">
                    {corpusView.message}
                  </div>
                )}

                {rollbackError && !rollbackOpen && (
                  <div className="text-xs text-accent-red">{rollbackError}</div>
                )}
              </div>
            </DrawerShell>
          </div>
        </div>
      )}

      {rollbackOpen && rollbackMeta && (
        <BizRollbackConfirmDrawer
          kind={rollbackMeta.kind}
          recordNo={rollbackMeta.no}
          action={rollbackMeta.action}
          changes={rollbackChanges}
          loading={rollbackBusy}
          error={rollbackError}
          onClose={() => {
            setRollbackOpen(false)
            setRollbackError('')
            setRollbackPreviewId('')
          }}
          onConfirm={() => void confirmRollback()}
        />
      )}
    </>
  )
}
