import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity, AppWindow, ArrowRight, Bot, Check, ChevronDown, ChevronRight,
  CircleAlert, Database, ExternalLink, FileClock, Loader2, Play, Plus,
  RefreshCw, Search, ShieldCheck, Table2, Workflow,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { Card, PageTitle, Tag } from '@/components/ui'
import {
  RuntimeApiError,
  runtimeApi,
  type BusinessAppRecord,
  type BusinessConnectionRecord,
  type OperationTrace,
  type RuntimeHealth,
  type RuntimeOperation,
} from '@/lib/runtime-api'
import { loadCurrentAiTarget } from '@/lib/ai-target'
import type { BusinessTable } from '@/lib/types'
import type { JsonValue, RiskLevel } from '@/lib/contracts'
import { AppCreateWizard } from '@/components/apps/AppCreateWizard'
import { AppRuntime } from '@/components/apps/AppRuntime'
import { isFdeAppSpec, type FdeAppDetail } from '@/lib/app-spec'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'

type View = 'overview' | 'records' | 'operations'
type Tone = 'default' | 'red' | 'amber' | 'blue' | 'purple' | 'teal' | 'green'

const STATE_LABEL: Record<string, string> = {
  draft: '待执行',
  awaiting_approval: '待审批',
  approved: '已审批',
  executing: '执行中',
  succeeded: '已验证',
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

export default function Data() {
  const tables = useApp((state) => state.businessTables)
  const activeWorkspaceId = useApp((state) => state.activeWorkspaceId)
  const workspace = useApp((state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId))
  const [view, setView] = useState<View>('overview')
  const [health, setHealth] = useState<RuntimeHealth | null>(null)
  const [connections, setConnections] = useState<BusinessConnectionRecord[]>([])
  const [apps, setApps] = useState<BusinessAppRecord[]>([])
  const [operations, setOperations] = useState<RuntimeOperation[]>([])
  const [catalogCount, setCatalogCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await runtimeApi.ensureWorkspace({
        id: activeWorkspaceId,
        name: workspace?.name ?? '当前工作区',
        description: workspace?.desc ?? '',
      })
      const [nextHealth, nextConnections, nextApps, nextOperations, mailbox] = await Promise.all([
        runtimeApi.health(),
        runtimeApi.listBusinessConnections(activeWorkspaceId),
        runtimeApi.listBusinessApps(activeWorkspaceId),
        runtimeApi.listOperations(activeWorkspaceId),
        runtimeApi.imState().catch(() => ({})),
      ])
      setHealth(nextHealth)
      setConnections(nextConnections)
      setApps(nextApps)
      setOperations(nextOperations)
      const catalog = Array.isArray((mailbox as { catalog?: unknown[] }).catalog) ? (mailbox as { catalog: unknown[] }).catalog : []
      setCatalogCount(catalog.length)
    } catch (cause) {
      setError(formatError(cause))
      setHealth(null)
      setConnections([])
      setApps([])
      setOperations([])
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, workspace?.desc, workspace?.name])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pendingApproval = operations.filter((item) => item.state === 'awaiting_approval').length
  const unresolved = operations.filter((item) => ['failed', 'uncertain', 'compensation_failed'].includes(item.state)).length

  return (
    <div className="min-w-0">
      <PageTitle
        title="业务应用"
        subtitle="连接业务系统、创建应用，并用可审计的操作链路管理每一次变更"
        actions={
          <div className="flex items-center rounded border border-line bg-surface p-0.5">
            <ViewButton active={view === 'overview'} onClick={() => setView('overview')}>应用</ViewButton>
            <ViewButton active={view === 'records'} onClick={() => setView('records')}>业务记录</ViewButton>
            <ViewButton active={view === 'operations'} onClick={() => setView('operations')} badge={pendingApproval}>操作控制</ViewButton>
          </div>
        }
      />

      <AuthorityStrip health={health} loading={loading} error={error} catalogCount={catalogCount} onRefresh={refresh} />

      {view === 'overview' && (
        <Overview
          apps={apps}
          connections={connections}
          operations={operations}
          pendingApproval={pendingApproval}
          unresolved={unresolved}
          workspaceId={activeWorkspaceId}
          onCreated={refresh}
          onOpenRecords={() => setView('records')}
          onOpenOperations={() => setView('operations')}
        />
      )}
      {view === 'records' && (
        <RecordBrowser tables={tables} runtimeReady={!error} onPlan={() => setView('operations')} />
      )}
      {view === 'operations' && (
        <OperationControl
          workspaceId={activeWorkspaceId}
          tables={tables}
          operations={operations}
          runtimeReady={!error}
          onChanged={refresh}
        />
      )}
    </div>
  )
}

function ViewButton({ active, badge, children, onClick }: { active: boolean; badge?: number; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'h-7 px-2.5 rounded text-xs transition-colors inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20',
        active ? 'bg-ink text-white' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
      {!!badge && <span className={clsx('min-w-4 h-4 px-1 rounded text-[9px]', active ? 'bg-white/20' : 'bg-amber-100 text-amber-800')}>{badge}</span>}
    </button>
  )
}

function AuthorityStrip({ health, loading, error, catalogCount, onRefresh }: { health: RuntimeHealth | null; loading: boolean; error: string; catalogCount: number; onRefresh: () => Promise<void> }) {
  const state = error ? 'offline' : health?.state ?? 'checking'
  return (
    <div className={clsx(
      'mb-4 border px-3 py-2.5 flex items-start gap-3',
      state === 'offline' ? 'bg-red-50 border-red-200' : state === 'healthy' ? 'bg-brand-soft border-brand/25' : 'bg-amber-50 border-amber-200',
    )}>
      <div className={clsx(
        'mt-0.5 w-7 h-7 flex items-center justify-center border',
        state === 'offline' ? 'bg-white border-red-200 text-accent-red' : state === 'healthy' ? 'bg-white border-brand/25 text-brand' : 'bg-white border-amber-200 text-accent-amber',
      )}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : state === 'offline' ? <CircleAlert size={14} /> : <ShieldCheck size={14} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {state === 'offline' ? '本地运行时未连接' : state === 'healthy' ? '事务底座运行正常' : '正在检查事务底座'}
        </div>
        <div className="text-xs text-ink-muted mt-0.5 leading-relaxed">
          {error
            ? `${error}。当前仍可浏览原型数据，但不能创建可审计操作。请启动本地运行时后重试。`
            : `事务记录由 SQLite 管理${health ? ` · ${health.persistence.database.tableCount} 张表 · ${health.persistence.migrations.length} 个迁移` : ''}；词表 ${catalogCount > 0 ? `已配 ${catalogCount} 项` : '未配'}；外部业务记录仍以源系统为准。`}
        </div>
      </div>
      <button type="button" className="btn !py-1 shrink-0" disabled={loading} onClick={() => void onRefresh()}>
        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 刷新
      </button>
    </div>
  )
}

function asAppDef(value: JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function AppDraftEditor({
  app, connections, onSaved, onOpenRecords,
}: {
  app: BusinessAppRecord
  connections: BusinessConnectionRecord[]
  onSaved: () => Promise<void>
  onOpenRecords: () => void
}) {
  const def = asAppDef(app.definition)
  const [goal, setGoal] = useState(String(def.goal || ''))
  const [screens, setScreens] = useState(Array.isArray(def.screens) ? def.screens.map(String).join('\n') : '')
  const [permissions, setPermissions] = useState(Array.isArray(def.permissions) ? def.permissions.map(String).join('\n') : String(def.permissions || ''))
  const [sources, setSources] = useState<string[]>(Array.isArray(def.dataSources) ? def.dataSources.map(String) : [])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const next = asAppDef(app.definition)
    setGoal(String(next.goal || ''))
    setScreens(Array.isArray(next.screens) ? next.screens.map(String).join('\n') : '')
    setPermissions(Array.isArray(next.permissions) ? next.permissions.map(String).join('\n') : String(next.permissions || ''))
    setSources(Array.isArray(next.dataSources) ? next.dataSources.map(String) : [])
    setNote('')
  }, [app.id, app.currentRevision])

  const save = async () => {
    setSaving(true)
    setNote('')
    try {
      await runtimeApi.updateBusinessApp(app.id, {
        definition: {
          ...def,
          kind: 'ai-generated-draft',
          goal: goal.trim(),
          screens: screens.split('\n').map((row) => row.trim()).filter(Boolean),
          permissions: permissions.split('\n').map((row) => row.trim()).filter(Boolean),
          dataSources: sources,
        },
        changeNote: '更新应用草稿',
      })
      setNote('已保存草稿')
      await onSaved()
    } catch (cause) {
      setNote(formatError(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-3 border-t border-line bg-surface-2 space-y-3">
      <div className="text-sm font-medium">草稿 · {app.name}</div>
      <label className="block text-xs text-ink-muted">目标
        <input className="input mt-1 w-full" value={goal} onChange={(event) => setGoal(event.target.value)} />
      </label>
      <div className="text-xs text-ink-muted">数据源（已有连接器）</div>
      <div className="flex flex-wrap gap-2">
        {connections.length === 0 && <span className="text-xs text-ink-subtle">还没有连接器</span>}
        {connections.map((row) => {
          const on = sources.includes(row.id)
          return (
            <button
              key={row.id}
              type="button"
              className={clsx('btn h-7 px-2 text-xs', on && 'bg-brand-soft border-brand/30 text-brand')}
              onClick={() => setSources((current) => on ? current.filter((id) => id !== row.id) : [...current, row.id])}
            >
              {row.name || row.id}
            </button>
          )
        })}
      </div>
      <label className="block text-xs text-ink-muted">屏幕（一行一个）
        <textarea className="input mt-1 w-full" rows={3} value={screens} onChange={(event) => setScreens(event.target.value)} />
      </label>
      <label className="block text-xs text-ink-muted">权限说明（一行一条）
        <textarea className="input mt-1 w-full" rows={2} value={permissions} onChange={(event) => setPermissions(event.target.value)} />
      </label>
      {note && <div className="text-xs text-ink-muted">{note}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-brand h-8" disabled={saving} onClick={() => void save()}>{saving ? '保存中' : '保存草稿'}</button>
        <button type="button" className="btn h-8" onClick={onOpenRecords}>业务记录</button>
        <button
          type="button"
          className="btn h-8"
          onClick={() => {
            void loadCurrentAiTarget().then((target) => {
              if (!target.ok) {
                setNote(target.error)
                return
              }
              return runtimeApi.promptAi(target.sessionId, {
                text: `【业务应用草稿】名称：${app.name}\n目标：${goal}\n数据源：${sources.join(', ') || '无'}\n请给出 screens / permissions 草案。不要过账。`,
              })
            }).then(() => setNote('已发给当前 AI 会话')).catch((cause) => setNote(cause instanceof Error ? cause.message : '没问出去'))
          }}
        >
          问当前 AI
        </button>
      </div>
      <div className="text-[11px] text-ink-subtle">过账仍走「操作控制」，不会因为保存草稿而写外部系统。</div>
    </div>
  )
}

function Overview({
  apps, connections, operations, pendingApproval, unresolved, workspaceId, onCreated, onOpenRecords, onOpenOperations,
}: {
  apps: BusinessAppRecord[]
  connections: BusinessConnectionRecord[]
  operations: RuntimeOperation[]
  pendingApproval: number
  unresolved: number
  workspaceId: string
  onCreated: () => Promise<void>
  onOpenRecords: () => void
  onOpenOperations: () => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [declarativeApp, setDeclarativeApp] = useState<FdeAppDetail | null>(null)
  const [workspaceCwd, setWorkspaceCwd] = useState('')
  const selected = apps.find((app) => app.id === selectedId) || null

  useEffect(() => {
    if (!selected || !isFdeAppSpec(selected.definition)) {
      setDeclarativeApp(null)
      return
    }
    const cwd = loadCurrentWorkspaceCwd()
    if (cwd.ok) setWorkspaceCwd(cwd.cwd)
    void runtimeApi.getDeclarativeApp(selected.id).then(setDeclarativeApp).catch(() => setDeclarativeApp(null))
  }, [selected?.id, selected?.currentRevision, selected?.definition])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 @3xl:grid-cols-4 gap-3">
        <Metric icon={AppWindow} label="业务应用" value={apps.length} hint={`${apps.filter((item) => item.appKind === 'generated').length} 个由 AI 创建`} />
        <Metric icon={Database} label="系统连接" value={connections.length} hint={`${connections.filter((item) => item.status === 'connected').length} 个已接通`} />
        <Metric icon={FileClock} label="待审批" value={pendingApproval} hint="写入不会绕过确认" tone={pendingApproval ? 'amber' : 'default'} />
        <Metric icon={Activity} label="异常待处理" value={unresolved} hint={`${operations.length} 次操作留有记录`} tone={unresolved ? 'red' : 'default'} />
      </div>

      <div className="grid grid-cols-1 @3xl:grid-cols-[1.12fr_.88fr] gap-4">
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">我的业务应用</div>
              <div className="text-xs text-ink-muted mt-0.5">应用定义、版本和权限归工作台管理</div>
            </div>
            <button type="button" className="btn-primary !py-1" onClick={() => setShowCreate((value) => !value)}><Plus size={12} /> AI 创建应用</button>
          </div>
          {showCreate && (
            <AppCreateWizard
              workspaceId={workspaceId}
              onCreated={onCreated}
              onClose={() => setShowCreate(false)}
            />
          )}
          <div className="divide-y divide-line">
            {apps.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink-muted">还没有应用。先创建草稿，再为它选择数据源和权限。</div>
            ) : apps.map((app) => (
              <button key={app.id} type="button" onClick={() => setSelectedId(app.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface-2 transition-colors">
                <div className="w-9 h-9 border border-line bg-surface-2 flex items-center justify-center text-brand shrink-0">
                  {app.appKind === 'generated' ? <Bot size={16} /> : <AppWindow size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{app.name}</div>
                  <div className="text-xs text-ink-muted mt-0.5">修订 {app.currentRevision} · {isFdeAppSpec(app.definition) ? app.status : app.appKind === 'generated' ? '草稿' : '系统应用'} · {formatTime(app.updatedAt)}</div>
                </div>
                <Tag kind={app.status === 'active' ? 'green' : app.status === 'archived' ? 'default' : 'amber'}>
                  {app.status === 'active' ? '运行中' : app.status === 'archived' ? '已归档' : '草稿'}
                </Tag>
                <ChevronRight size={14} className="text-ink-subtle" />
              </button>
            ))}
          </div>
          {selected && declarativeApp && workspaceCwd && (
            <AppRuntime
              app={declarativeApp}
              workspaceCwd={workspaceCwd}
              onChanged={() => { void onCreated(); void runtimeApi.getDeclarativeApp(selected.id).then(setDeclarativeApp) }}
            />
          )}
          {selected && !isFdeAppSpec(selected.definition) && (
            <AppDraftEditor
              app={selected}
              connections={connections}
              onSaved={onCreated}
              onOpenRecords={onOpenRecords}
            />
          )}
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <div className="text-sm font-medium">业务系统与数据源</div>
            <div className="text-xs text-ink-muted mt-0.5">连接状态不等于操作成功，成功必须有源系统回执</div>
          </div>
          <div className="divide-y divide-line">
            {connections.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink-muted">尚未配置业务系统连接。</div>
            ) : connections.map((connection) => (
              <div key={connection.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent-amber shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{connection.name}</div>
                  <div className="text-xs text-ink-muted mt-0.5 truncate">{connection.provider} · {connection.connectionKind}</div>
                </div>
                <Tag kind={connection.status === 'connected' ? 'green' : 'amber'}>{connection.status === 'connected' ? '已接通' : '待启用'}</Tag>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-line bg-surface-2 grid grid-cols-2 gap-2">
            <button type="button" className="btn justify-between" onClick={onOpenRecords}><span className="inline-flex items-center gap-1.5"><Table2 size={13} /> 浏览记录</span><ArrowRight size={12} /></button>
            <button type="button" className="btn justify-between" onClick={onOpenOperations}><span className="inline-flex items-center gap-1.5"><Workflow size={13} /> 操作控制</span><ArrowRight size={12} /></button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, hint, tone = 'default' }: { icon: typeof AppWindow; label: string; value: number; hint: string; tone?: 'default' | 'amber' | 'red' }) {
  return (
    <Card className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        <Icon size={14} className={tone === 'red' ? 'text-accent-red' : tone === 'amber' ? 'text-accent-amber' : 'text-ink-subtle'} />
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-2">{value}</div>
      <div className="text-xs text-ink-muted mt-1 truncate">{hint}</div>
    </Card>
  )
}

function RecordBrowser({ tables, runtimeReady, onPlan }: { tables: BusinessTable[]; runtimeReady: boolean; onPlan: () => void }) {
  const [tableId, setTableId] = useState(tables[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [liveRows, setLiveRows] = useState<Array<Record<string, unknown>> | null>(null)
  useEffect(() => {
    if (!runtimeReady) {
      setLiveRows([])
      return
    }
    void runtimeApi.bizPreview({ kind: '采购单', action: '现查', speech: '现查采购单' }).then((data) => {
      const sheet = data.sheet && typeof data.sheet === 'object' ? data.sheet as { rows?: Array<{ no?: string; status?: string; fields?: Record<string, unknown> }> } : null
      setLiveRows((sheet?.rows ?? []).map((row) => ({ orderId: row.no, status: row.status, ...(row.fields ?? {}) })))
    }).catch(() => setLiveRows([]))
  }, [runtimeReady])
  const table = tables.find((item) => item.id === tableId) ?? tables[0]
  const rows = useMemo(() => {
    const source = liveRows ?? []
    const normalized = query.trim().toLowerCase()
    if (!normalized) return source
    return source.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(normalized)))
  }, [query, liveRows])

  const columns = useMemo(() => {
    const sample = rows[0]
    if (sample) return Object.keys(sample).slice(0, 8).map((key) => ({ key, label: key }))
    return (table?.columns ?? []).map((column) => ({ key: column.key, label: column.label }))
  }, [rows, table])

  return (
    <div className="space-y-3">
      <Card className="!p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button type="button" className="btn !py-1 !bg-ink !text-white !border-ink">
            采购单<span className="text-[10px] opacity-70">{liveRows?.length ?? 0}</span>
          </button>
        </div>
        <div className="ml-auto relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input className="input h-8 pl-8 w-48" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索当前记录" />
        </div>
        <button type="button" className="btn-brand !py-1" onClick={onPlan}><ShieldCheck size={13} /> 规划数据操作</button>
      </Card>

      <div className="px-3 py-2 border border-blue-200 bg-blue-50 text-xs text-blue-800 flex items-start gap-2">
        <CircleAlert size={13} className="mt-0.5 shrink-0" />
        <span>这里是闸现查结果，不是原型表。修改必须从“操作控制”发起。</span>
      </div>

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted border-b border-line bg-surface-2">
              {columns.map((column) => <th key={column.key} className="px-3 py-2.5 font-medium">{column.label}</th>)}
              <th className="px-3 py-2.5 font-medium text-right">来源</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.orderId ?? index)} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2.5 whitespace-nowrap">
                    {String(row[column.key] ?? '')}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right"><Tag>现查</Tag></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="px-3 py-12 text-center text-sm text-ink-muted">没有匹配记录</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function OperationControl({ workspaceId, tables, operations, runtimeReady, onChanged }: {
  workspaceId: string
  tables: BusinessTable[]
  operations: RuntimeOperation[]
  runtimeReady: boolean
  onChanged: () => Promise<void>
}) {
  const defaultTable = tables[0]
  const [targetRef, setTargetRef] = useState('fde://external/NocoBase/table/采购单')
  const [action, setAction] = useState('record.update')
  const [operationKind, setOperationKind] = useState<'read' | 'write'>('write')
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('high')
  const [executionMode, setExecutionMode] = useState<'dry_run' | 'live'>('dry_run')
  const [payload, setPayload] = useState('{\n  "status": "approved"\n}')
  const [submitting, setSubmitting] = useState(false)
  const [actionId, setActionId] = useState('')
  const [error, setError] = useState('')
  const [previewId, setPreviewId] = useState('')
  const [selectedId, setSelectedId] = useState(operations[0]?.id ?? '')
  const [trace, setTrace] = useState<OperationTrace | null>(null)
  const [traceLoading, setTraceLoading] = useState(false)

  useEffect(() => {
    if (!selectedId && operations[0]) setSelectedId(operations[0].id)
  }, [operations, selectedId])

  const selected = operations.find((item) => item.id === selectedId)

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
      const operation = await runtimeApi.planOperation({
        workspaceId,
        targetRef: targetRef as `fde://external/${string}/${string}`,
        action,
        operationKind,
        riskLevel,
        executionMode,
        input,
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

  const runAction = async (kind: 'approve' | 'execute' | 'write') => {
    if (!selected) return
    setActionId(selected.id)
    setError('')
    try {
      if (kind === 'approve') await runtimeApi.approveOperation(selected.id, '由本机用户在业务应用控制面确认')
      else if (kind === 'write') {
        if (!previewId) throw new Error('请先预览拿到 preview_id')
        await runtimeApi.bizWrite(previewId)
        setPreviewId('')
      } else if (selected.executionMode === 'live') {
        const preview = await runtimeApi.bizPreview({
          targetRef: selected.targetRef,
          action: selected.action,
          input: selected.input,
          speech: selected.action,
        })
        const id = typeof preview.preview_id === 'string' ? preview.preview_id : ''
        if (!id) throw new Error(typeof preview.hint === 'string' ? preview.hint : '预览未返回 preview_id，未写入源系统')
        setPreviewId(id)
      } else {
        await runtimeApi.executeOperation(selected.id)
      }
      await onChanged()
      await loadTrace(selected.id)
    } catch (cause) {
      setError(formatError(cause))
    } finally {
      setActionId('')
    }
  }

  return (
    <div className="grid grid-cols-1 @4xl:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
      <div className="space-y-3">
        <Card>
          <div className="flex items-center gap-2 mb-3"><ShieldCheck size={15} className="text-brand" /><div className="text-sm font-medium">新建操作计划</div></div>
          <div className="space-y-2.5">
            <Field label="目标对象"><input className="input font-mono text-xs" value={targetRef} onChange={(event) => setTargetRef(event.target.value)} /></Field>
            <Field label="操作"><input className="input font-mono text-xs" value={action} onChange={(event) => setAction(event.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="类型"><Select value={operationKind} onChange={(value) => setOperationKind(value as 'read' | 'write')} options={[['read', '读取'], ['write', '写入']]} /></Field>
              <Field label="风险"><Select value={riskLevel} onChange={(value) => setRiskLevel(value as RiskLevel)} options={Object.entries(RISK_LABEL)} /></Field>
            </div>
            <Field label="执行方式"><Select value={executionMode} onChange={(value) => setExecutionMode(value as 'dry_run' | 'live')} options={[['dry_run', '仅验证，不产生副作用'], ['live', '真实执行（先预览再过账）']]} /></Field>
            <Field label="输入 JSON"><textarea className="input min-h-24 font-mono text-xs resize-y" value={payload} onChange={(event) => setPayload(event.target.value)} /></Field>
            <button type="button" className="btn-brand w-full" disabled={submitting || !runtimeReady || !targetRef.trim() || !action.trim()} onClick={() => void plan()}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <FileClock size={14} />} 生成可审计计划
            </button>
          </div>
        </Card>
        <div className="border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
          中风险及以上写入必须审批。真实执行先预览拿到 preview_id，再确认过账；闸拒绝时不会伪造成功。
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        {error && <div className="border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-accent-red">{error}</div>}
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">操作记录</div>
              <div className="text-xs text-ink-muted mt-0.5">意图、审批、步骤、快照、回执与回退共用同一关联 ID</div>
            </div>
            <span className="text-xs text-ink-muted">{operations.length} 条</span>
          </div>
          {operations.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">还没有操作记录。左侧创建的第一条记录会保存在事务数据库中。</div>
          ) : (
            <div className="divide-y divide-line">
              {operations.map((operation) => (
                <button key={operation.id} type="button" onClick={() => setSelectedId(operation.id)} className={clsx('w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-surface-2', selectedId === operation.id && 'bg-brand-soft/70')}>
                  <div className={clsx('w-7 h-7 border flex items-center justify-center shrink-0', operation.operationKind === 'write' ? 'border-amber-200 bg-amber-50 text-accent-amber' : 'border-blue-200 bg-blue-50 text-accent-blue')}>
                    {operation.operationKind === 'write' ? <Workflow size={13} /> : <Search size={13} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{operation.action}</div>
                    <div className="text-[11px] text-ink-muted mt-0.5 truncate font-mono">{operation.targetRef}</div>
                  </div>
                  <Tag kind={RISK_TONE[operation.riskLevel]}>{RISK_LABEL[operation.riskLevel]}</Tag>
                  <Tag kind={STATE_TONE[operation.state] ?? 'default'}>{STATE_LABEL[operation.state] ?? operation.state}</Tag>
                  <ChevronRight size={13} className="text-ink-subtle" />
                </button>
              ))}
            </div>
          )}
        </Card>

        {selected && (
          <Card>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">操作详情 <span className="font-mono text-[10px] text-ink-subtle">{selected.id}</span></div>
                <div className="text-xs text-ink-muted mt-1">关联 ID：<span className="font-mono">{selected.correlationId}</span></div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selected.state === 'awaiting_approval' && <button type="button" className="btn !py-1" disabled={actionId === selected.id} onClick={() => void runAction('approve')}><Check size={12} /> 审批</button>}
                {['draft', 'approved'].includes(selected.state) && <button type="button" className="btn-brand !py-1" disabled={actionId === selected.id} onClick={() => void runAction('execute')}><Play size={12} /> {selected.executionMode === 'dry_run' ? '执行验证' : '预览写入'}</button>}
                {previewId && <button type="button" className="btn-brand !py-1" disabled={actionId === selected.id} onClick={() => void runAction('write')}>确认过账</button>}
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
            <div className="border border-line bg-surface-2 px-3 py-2.5 text-xs">
              <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-2">
                <span className="text-ink-muted">当前状态</span><span><Tag kind={STATE_TONE[selected.state] ?? 'default'}>{STATE_LABEL[selected.state] ?? selected.state}</Tag></span>
                <span className="text-ink-muted">执行方式</span><span>{selected.executionMode === 'dry_run' ? '验证模式，不产生副作用' : '真实执行，必须等待连接器回执'}</span>
                <span className="text-ink-muted">幂等键</span><span className="font-mono break-all">{selected.idempotencyKey}</span>
                <span className="text-ink-muted">输入</span><pre className="font-mono whitespace-pre-wrap break-all">{JSON.stringify(selected.input, null, 2)}</pre>
              </div>
            </div>
            {trace && trace.receipts.length > 0 && (
              <div className="mt-3 px-3 py-2.5 border border-brand/25 bg-brand-soft text-xs text-brand flex items-start gap-2">
                <ShieldCheck size={13} className="mt-0.5 shrink-0" /><span>已保存验证回执。此回执只证明计划通过本地验证，不代表外部业务系统已经发生变更。</span>
              </div>
            )}
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

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatError(cause: unknown) {
  if (cause instanceof RuntimeApiError) return cause.message
  return cause instanceof Error ? cause.message : String(cause)
}
