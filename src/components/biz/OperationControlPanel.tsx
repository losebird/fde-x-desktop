import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Check, ChevronDown, ChevronRight, FileClock, Loader2, Play, RefreshCw, Search, ShieldCheck, Workflow,
} from 'lucide-react'
import clsx from 'clsx'
import { Card, Tag } from '@/components/ui'
import {
  RuntimeApiError,
  runtimeApi,
  type OperationTrace,
  type RuntimeOperation,
} from '@/lib/runtime-api'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import type { BusinessTable } from '@/lib/types'
import type { JsonValue, RiskLevel } from '@/lib/contracts'

type Tone = 'default' | 'red' | 'amber' | 'blue' | 'purple' | 'teal' | 'green'

const STATE_LABEL: Record<string, string> = {
  draft: '待执行',
  awaiting_approval: '待审批',
  approved: '已批准待执行',
  executing: '执行中',
  succeeded: '已执行',
  failed: '失败',
  uncertain: '结果待确认',
  compensating: '回退中',
  compensated: '已回退',
  compensation_failed: '回退失败',
  cancelled: '已取消',
}

const STATE_TONE: Record<string, Tone> = {
  draft: 'blue',
  awaiting_approval: 'amber',
  approved: 'purple',
  executing: 'blue',
  succeeded: 'green',
  failed: 'red',
  uncertain: 'amber',
  compensating: 'purple',
  compensated: 'teal',
  compensation_failed: 'red',
  cancelled: 'default',
}

const RISK_LABEL: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '关键风险',
}

const RISK_TONE: Record<RiskLevel, Tone> = {
  low: 'green',
  medium: 'amber',
  high: 'red',
  critical: 'red',
}

function kindFromTargetRef(targetRef: string) {
  const match = targetRef.match(/\/table\/([^/]+)/u)
  return match ? decodeURIComponent(match[1]) : ''
}

function gateActionToRecordAction(action: string) {
  if (action === '现查') return 'record.read'
  if (action === '改行') return 'record.update'
  if (action === '新建') return 'record.create'
  if (action === '删除') return 'record.delete'
  return action
}

function planSummary(operation: RuntimeOperation): string {
  const plan = operation.plan && typeof operation.plan === 'object' ? operation.plan as Record<string, unknown> : {}
  const kind = String(plan.kind || '')
  const action = String(plan.action || operation.action)
  const previewId = String(plan.previewId || '')
  if (kind && previewId) return `${action} ${kind}（预览 ${previewId.slice(0, 8)}…）`
  if (kind) return `${action} ${kind}`
  return operation.action
}

type Props = {
  workspaceId: string
  tables: BusinessTable[]
  operations: RuntimeOperation[]
  runtimeReady: boolean
  onChanged: () => Promise<void>
  initialTarget?: { targetRef: string; kind: string; no?: string }
}

export function OperationControlPanel({
  workspaceId,
  tables,
  operations,
  runtimeReady,
  onChanged,
  initialTarget,
}: Props) {
  const defaultTable = tables[0]
  const [targetRef, setTargetRef] = useState(initialTarget?.targetRef ?? 'fde://external/NocoBase/table/采购单')
  const [action, setAction] = useState('改行')
  const [operationKind, setOperationKind] = useState<'read' | 'write'>('write')
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('high')
  const [executionMode, setExecutionMode] = useState<'dry_run' | 'live'>('dry_run')
  const [payload, setPayload] = useState('{\n  "status": "approved"\n}')
  const [advanced, setAdvanced] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionId, setActionId] = useState('')
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(operations[0]?.id ?? '')
  const [trace, setTrace] = useState<OperationTrace | null>(null)
  const [traceLoading, setTraceLoading] = useState(false)
  const [kindCatalog, setKindCatalog] = useState<Array<{ kind: string; can: string[] }>>([])

  useEffect(() => {
    if (!runtimeReady) return
    let cancelled = false
    const ws = loadCurrentWorkspaceCwd()
    if (!ws.ok) return
    void runtimeApi.listBizKinds().then((data) => {
      if (cancelled) return
      setKindCatalog(data.kinds.map((row) => ({
        kind: row.kind,
        can: Array.isArray(row.can) ? row.can.map(String) : [],
      })))
    }).catch(() => {
      if (!cancelled) setKindCatalog([])
    })
    return () => { cancelled = true }
  }, [runtimeReady])

  const actionOptions = useMemo(() => {
    const kindName = kindFromTargetRef(targetRef) || defaultTable?.name || ''
    const row = kindCatalog.find((item) => item.kind === kindName)
    const can = row?.can?.length ? row.can : []
    return can.map((value) => [value, value] as [string, string])
  }, [defaultTable?.name, kindCatalog, targetRef])

  useEffect(() => {
    if (!actionOptions.length) return
    if (!actionOptions.some(([value]) => value === action)) {
      setAction(actionOptions[0][0])
    }
  }, [action, actionOptions])

  useEffect(() => {
    if (initialTarget) {
      setTargetRef(initialTarget.targetRef)
      if (initialTarget.no) {
        setPayload(JSON.stringify({ no: initialTarget.no, status: 'approved' }, null, 2))
      }
    }
  }, [initialTarget])

  useEffect(() => {
    if (!selectedId && operations[0]) setSelectedId(operations[0].id)
  }, [operations, selectedId])

  const selected = operations.find((item) => item.id === selectedId)

  const grouped = useMemo(() => ({
    awaiting: operations.filter((o) => o.state === 'awaiting_approval'),
    approved: operations.filter((o) => o.state === 'approved' || (o.state === 'draft' && o.executionMode === 'live')),
    done: operations.filter((o) => ['succeeded', 'uncertain', 'compensated'].includes(o.state)),
    failed: operations.filter((o) => ['failed', 'compensation_failed'].includes(o.state)),
  }), [operations])

  const loadTrace = useCallback(async (id: string) => {
    setTraceLoading(true)
    setError('')
    try {
      setTrace(await runtimeApi.getOperationTrace(id))
    } catch (cause) {
      setError(formatError(cause))
      setTrace(null)
    } finally {
      setTraceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) void loadTrace(selectedId)
    else setTrace(null)
  }, [loadTrace, selectedId])

  const plan = async () => {
    setSubmitting(true)
    setError('')
    try {
      let input: JsonValue
      try {
        input = JSON.parse(payload) as JsonValue
      } catch {
        setError('输入数据不是有效 JSON')
        return
      }
      const recordAction = gateActionToRecordAction(action)
      let planPayload: Record<string, unknown> | undefined
      if (executionMode === 'live' && operationKind === 'write') {
        const preview = await runtimeApi.bizPreview({
          targetRef,
          action: recordAction,
          input,
          speech: action,
        })
        const sheet = (preview.sheet && typeof preview.sheet === 'object' ? preview.sheet : preview) as Record<string, unknown>
        const previewId = String(sheet.preview_id || sheet.previewId || preview.preview_id || '')
        if (!previewId) throw new Error(typeof preview.hint === 'string' ? preview.hint : '预览未返回 preview_id')
        planPayload = {
          kind: String(sheet.kind || defaultTable?.id || ''),
          action,
          previewId,
          sheetDigest: String(sheet.digest || ''),
          rows: Array.isArray(sheet.rows) ? sheet.rows.map((r: { no?: string }) => r.no).filter(Boolean) : [],
        }
      }
      const operation = await runtimeApi.planOperation({
        workspaceId,
        targetRef: targetRef as `fde://external/${string}/${string}`,
        action: recordAction,
        operationKind,
        riskLevel,
        executionMode,
        input,
        plan: planPayload,
      })
      setSelectedId(operation.id)
      await onChanged()
      await loadTrace(operation.id)
    } catch (cause) {
      setError(formatError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  const runAction = async (kind: 'approve' | 'execute') => {
    if (!selected) return
    setActionId(selected.id)
    setError('')
    try {
      if (kind === 'approve') {
        await runtimeApi.approveOperation(selected.id, '由本机用户在业务应用控制面确认')
      } else {
        await runtimeApi.executeOperation(selected.id)
      }
      await onChanged()
      await loadTrace(selected.id)
    } catch (cause) {
      const err = cause instanceof RuntimeApiError ? cause : null
      if (err?.code === 'preview_expired') {
        setError('预览已过期，请回到业务记录重新预览或在左侧重新生成计划')
      } else {
        setError(formatError(cause))
      }
    } finally {
      setActionId('')
    }
  }

  const renderList = (title: string, items: RuntimeOperation[]) => {
    if (!items.length) return null
    return (
      <div className="px-4 py-2 border-b border-line">
        <div className="text-[10px] text-ink-muted uppercase tracking-wide mb-1">{title}</div>
        {items.map((operation) => (
          <button key={operation.id} type="button" onClick={() => setSelectedId(operation.id)} className={clsx('w-full px-2 py-2 text-left flex items-center gap-3 hover:bg-surface-2 rounded', selectedId === operation.id && 'bg-brand-soft/70')}>
            <div className={clsx('w-7 h-7 border flex items-center justify-center shrink-0', operation.operationKind === 'write' ? 'border-amber-200 bg-amber-50 text-accent-amber' : 'border-blue-200 bg-blue-50 text-accent-blue')}>
              {operation.operationKind === 'write' ? <Workflow size={13} /> : <Search size={13} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{planSummary(operation)}</div>
              <div className="text-[11px] text-ink-muted mt-0.5 truncate font-mono">{operation.targetRef}</div>
            </div>
            <Tag kind={RISK_TONE[operation.riskLevel]}>{RISK_LABEL[operation.riskLevel]}</Tag>
            <Tag kind={STATE_TONE[operation.state] ?? 'default'}>{STATE_LABEL[operation.state] ?? operation.state}</Tag>
            <ChevronRight size={13} className="text-ink-subtle" />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 @4xl:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
      <div className="space-y-3">
        <Card>
          <div className="flex items-center gap-2 mb-3"><ShieldCheck size={15} className="text-brand" /><div className="text-sm font-medium">新建操作计划</div></div>
          <div className="space-y-2.5">
            <Field label="目标对象"><input className="input font-mono text-xs" value={targetRef} onChange={(event) => setTargetRef(event.target.value)} /></Field>
            <Field label="操作">
              <Select value={action} onChange={setAction} options={actionOptions} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="类型"><Select value={operationKind} onChange={(value) => setOperationKind(value as 'read' | 'write')} options={[['read', '读取'], ['write', '写入']]} /></Field>
              <Field label="风险"><Select value={riskLevel} onChange={(value) => setRiskLevel(value as RiskLevel)} options={Object.entries(RISK_LABEL)} /></Field>
            </div>
            <Field label="执行方式"><Select value={executionMode} onChange={(value) => setExecutionMode(value as 'dry_run' | 'live')} options={[['dry_run', '仅验证，不产生副作用'], ['live', '真实执行（先预览再过账）']]} /></Field>
            <button type="button" className="text-xs text-brand underline" onClick={() => setAdvanced((v) => !v)}>{advanced ? '收起高级 JSON' : '高级：手写 JSON'}</button>
            {advanced && (
              <Field label="输入 JSON"><textarea className="input min-h-24 font-mono text-xs resize-y" value={payload} onChange={(event) => setPayload(event.target.value)} /></Field>
            )}
            <button type="button" className="btn-brand w-full" disabled={submitting || !runtimeReady || !targetRef.trim()} onClick={() => void plan()}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <FileClock size={14} />} 生成可审计计划
            </button>
          </div>
        </Card>
        <div className="border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
          中风险及以上写入必须审批。live 执行使用计划中的 preview_id 过账；预览过期会返回 409。
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        {error && <div className="border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-accent-red">{error}</div>}
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">操作记录</div>
              <div className="text-xs text-ink-muted mt-0.5">按审批状态分组</div>
            </div>
            <span className="text-xs text-ink-muted">{operations.length} 条</span>
          </div>
          {operations.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">还没有操作记录。左侧创建的第一条记录会保存在事务数据库中。</div>
          ) : (
            <>
              {renderList('待审批', grouped.awaiting)}
              {renderList('已批准待执行', grouped.approved)}
              {renderList('已执行', grouped.done)}
              {renderList('失败', grouped.failed)}
            </>
          )}
        </Card>

        {selected && (
          <Card>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">{planSummary(selected)} <span className="font-mono text-[10px] text-ink-subtle">{selected.id}</span></div>
                <div className="text-xs text-ink-muted mt-1">关联 ID：<span className="font-mono">{selected.correlationId}</span></div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selected.state === 'awaiting_approval' && <button type="button" className="btn !py-1" disabled={actionId === selected.id} onClick={() => void runAction('approve')}><Check size={12} /> 审批</button>}
                {['draft', 'approved'].includes(selected.state) && (
                  <button type="button" className="btn-brand !py-1" disabled={actionId === selected.id} onClick={() => void runAction('execute')}>
                    <Play size={12} /> {selected.executionMode === 'dry_run' ? '执行验证' : '执行过账'}
                  </button>
                )}
                <button type="button" className="btn !py-1" disabled={traceLoading} onClick={() => void loadTrace(selected.id)}><RefreshCw size={12} className={traceLoading ? 'animate-spin' : ''} /> Trace</button>
              </div>
            </div>
            <div className="grid grid-cols-2 @2xl:grid-cols-5 gap-2 mb-4">
              <TraceMetric label="审批" value={trace?.approvals.length ?? 0} />
              <TraceMetric label="步骤" value={trace?.steps.length ?? 0} />
              <TraceMetric label="快照" value={trace?.snapshots.length ?? 0} />
              <TraceMetric label="回执" value={trace?.receipts.length ?? 0} />
              <TraceMetric label="回退" value={trace?.compensations.length ?? 0} />
            </div>
            {trace && trace.steps.length > 0 && (
              <div className="border border-line bg-surface-2 px-3 py-2.5 text-xs mb-3 space-y-1">
                <div className="text-ink-muted font-medium">审计时间线</div>
                {trace.steps.map((step, index) => {
                  const row = step as { kind?: string; state?: string }
                  return <div key={index}>{row.kind ?? 'step'} · {row.state ?? ''}</div>
                })}
              </div>
            )}
            <div className="border border-line bg-surface-2 px-3 py-2.5 text-xs">
              <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-2">
                <span className="text-ink-muted">当前状态</span><span><Tag kind={STATE_TONE[selected.state] ?? 'default'}>{STATE_LABEL[selected.state] ?? selected.state}</Tag></span>
                <span className="text-ink-muted">执行方式</span><span>{selected.executionMode === 'dry_run' ? '验证模式' : '真实执行（biz_write）'}</span>
                <span className="text-ink-muted">计划</span><pre className="font-mono whitespace-pre-wrap break-all">{JSON.stringify(selected.plan, null, 2)}</pre>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs text-ink-muted">{label}<div className="mt-1">{children}</div></label>
}

function Select({ value, options, onChange }: { value: string; options: string[][]; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <select className="input appearance-none pr-8" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
    </div>
  )
}

function TraceMetric({ label, value }: { label: string; value: number }) {
  return <div className="border border-line bg-surface-2 px-3 py-2"><div className="text-[10px] text-ink-muted">{label}</div><div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div></div>
}

function formatError(cause: unknown) {
  if (cause instanceof RuntimeApiError) return cause.message
  return cause instanceof Error ? cause.message : String(cause)
}
