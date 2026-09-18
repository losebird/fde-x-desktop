import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileClock, Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { Card, Tag } from '@/components/ui'
import { BizRollbackConfirmDrawer, rollbackDrawerChanges } from '@/components/biz/BizRollbackConfirmDrawer'
import { RuntimeApiError, runtimeApi } from '@/lib/runtime-api'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import type { PreviewChange } from '@/lib/biz-sheet-display'

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
  changes?: Array<{ label?: string; field?: string; key?: string; from?: unknown; to?: unknown }>
}

type Props = {
  runtimeReady: boolean
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

function formatError(cause: unknown) {
  if (cause instanceof RuntimeApiError) return cause.message
  return cause instanceof Error ? cause.message : String(cause)
}

export function OperationRecordPanel({ runtimeReady }: Props) {
  const [rows, setRows] = useState<BizTraceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [rollbackChanges, setRollbackChanges] = useState<PreviewChange[]>([])
  const [rollbackMeta, setRollbackMeta] = useState<{ kind: string; no: string; action: string; traceId: string } | null>(null)
  const [rollbackBusy, setRollbackBusy] = useState(false)
  const [rollbackError, setRollbackError] = useState('')

  const refresh = useCallback(async () => {
    if (!runtimeReady) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { rows: next } = await runtimeApi.listBizTraces(80)
      const mapped = (Array.isArray(next) ? next : []).map((row) => {
        const item = row as Record<string, unknown>
        const traceId = String(item.traceId || item.id || '')
        return {
          id: traceId,
          traceId,
          at: Number(item.at || 0),
          kind: String(item.kind || ''),
          no: String(item.no || ''),
          action: String(item.action || ''),
          receiptId: String(item.receiptId || item.receipt_id || ''),
          sessionId: String(item.sessionId || item.session_id || ''),
          source: String(item.source || ''),
          changesSummary: String(item.changesSummary || '—'),
          canRollback: Boolean(item.canRollback),
          changes: Array.isArray(item.changes) ? item.changes as BizTraceRow['changes'] : [],
        }
      }).filter((row) => row.traceId)
      setRows(mapped)
      if (!selectedId && mapped[0]) setSelectedId(mapped[0].traceId)
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

  const selected = useMemo(
    () => rows.find((row) => row.traceId === selectedId) ?? rows[0],
    [rows, selectedId],
  )

  const openRollback = (row: BizTraceRow) => {
    setRollbackError('')
    const changes = rollbackDrawerChanges(row.changes || [])
    if (!changes.length) {
      setRollbackError('没有可恢复的字段差异')
      return
    }
    setRollbackMeta({ kind: row.kind, no: row.no, action: row.action, traceId: row.traceId })
    setRollbackChanges(changes)
    setRollbackOpen(true)
  }

  const confirmRollback = async () => {
    if (!rollbackMeta) return
    setRollbackBusy(true)
    setRollbackError('')
    try {
      const data = await runtimeApi.bizRollbackPreview(rollbackMeta.traceId)
      const sheet = (data.sheet && typeof data.sheet === 'object' ? data.sheet : data.preview) as Record<string, unknown>
      const previewId = String(sheet?.preview_id || sheet?.previewId || '')
      if (!previewId) throw new Error('回退预览未返回 preview_id')
      const workspaceResult = loadCurrentWorkspaceCwd()
      const workspace = workspaceResult.ok ? workspaceResult.cwd : undefined
      await runtimeApi.bizWrite(previewId, undefined, workspace, { source: 'workstation' })
      setRollbackOpen(false)
      setRollbackMeta(null)
      await refresh()
    } catch (cause) {
      setRollbackError(formatError(cause))
    } finally {
      setRollbackBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 @4xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
      <Card className="!p-0 overflow-hidden min-w-0">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">操作历史</div>
            <div className="text-xs text-ink-muted mt-0.5">本工作区 AI 与工作台写入记录（含 trace）</div>
          </div>
          <button type="button" className="btn !py-1" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
        {error && <div className="px-4 py-2 text-xs text-accent-red border-b border-line bg-red-50">{error}</div>}
        {loading && rows.length === 0 ? (
          <div className="py-16 flex justify-center text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-muted px-4">
            还没有操作记录。在业务记录或 AI 会话中完成一次确认过账后，会出现在这里。
          </div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((row) => (
              <button
                key={row.traceId}
                type="button"
                onClick={() => setSelectedId(row.traceId)}
                className={clsx(
                  'w-full px-4 py-3 text-left flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-surface-2',
                  selected?.traceId === row.traceId && 'bg-brand-soft/50',
                )}
              >
                <div className="w-8 h-8 rounded border border-line bg-surface-2 flex items-center justify-center shrink-0">
                  <FileClock size={14} className="text-ink-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {row.action || '写入'}{row.kind ? ` · ${row.kind}` : ''}{row.no ? ` · ${row.no}` : ''}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-0.5 truncate">
                    {formatTraceTime(row.at)} · {sourceLabel(row.source)} · {row.changesSummary || '—'}
                  </div>
                </div>
                <Tag kind="default">{sourceLabel(row.source)}</Tag>
                {row.canRollback ? (
                  <Tag kind="amber">可回退</Tag>
                ) : null}
                <span className="font-mono text-[10px] text-ink-subtle truncate max-w-[120px]" title={row.traceId}>
                  {row.traceId.slice(0, 10)}…
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="min-w-0">
        <div className="text-sm font-medium mb-1">Trace 详情</div>
        <div className="text-xs text-ink-muted mb-4">选中一行查看回执与审查链接</div>
        {!selected ? (
          <div className="text-sm text-ink-muted">选择左侧一条记录。</div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-2 text-xs">
              <span className="text-ink-muted">时间</span><span>{formatTraceTime(selected.at)}</span>
              <span className="text-ink-muted">来源</span><span>{sourceLabel(selected.source)}</span>
              <span className="text-ink-muted">动作</span><span>{selected.action || '—'}</span>
              <span className="text-ink-muted">业务型</span><span>{selected.kind || '—'}</span>
              <span className="text-ink-muted">单号</span><span className="font-mono break-all">{selected.no || '—'}</span>
              <span className="text-ink-muted">变更摘要</span><span>{selected.changesSummary || '—'}</span>
              <span className="text-ink-muted">回执</span><span className="font-mono break-all">{selected.receiptId || '—'}</span>
              <span className="text-ink-muted">Trace</span><span className="font-mono break-all text-[11px]">{selected.traceId}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="btn !py-1 inline-flex items-center gap-1"
                href={`/api/v1/corpus/biz:${encodeURIComponent(selected.traceId)}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={12} /> 审查 corpus
              </a>
              {selected.canRollback ? (
                <button
                  type="button"
                  className="btn-brand !py-1"
                  disabled={rollbackBusy}
                  onClick={() => openRollback(selected)}
                >
                  <RotateCcw size={12} /> 回退
                </button>
              ) : (
                <span className="text-xs text-ink-muted self-center">无字段差异记录，不可回退</span>
              )}
            </div>
            {rollbackError && !rollbackOpen && (
              <div className="text-xs text-accent-red">{rollbackError}</div>
            )}
          </div>
        )}
      </Card>

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
          }}
          onConfirm={() => void confirmRollback()}
        />
      )}
    </div>
  )
}
