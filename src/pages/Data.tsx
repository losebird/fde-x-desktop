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
import { RecordsPanel } from '@/components/biz/RecordsPanel'
import { OperationControlPanel } from '@/components/biz/OperationControlPanel'

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
  const activeWorkspaceId = useApp((state) => state.activeWorkspaceId)
  const workspace = useApp((state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId))
  const view = useApp((state) => state.activeDataSubview)
  const setView = useApp((state) => state.setActiveDataSubview)
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
            <ViewButton active={view === 'operations'} onClick={() => setView('operations')}>操作记录</ViewButton>
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
        <RecordsPanel
          connections={connections}
          apps={apps}
          runtimeReady={!error}
          onPlan={() => setView('operations')}
          onPlanWithTarget={() => setView('operations')}
        />
      )}
      {view === 'operations' && (
        <OperationControlPanel runtimeReady={!error} />
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
      <div className="text-[11px] text-ink-subtle">过账在业务记录确认；历史与回退见「操作记录」。</div>
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
              onCreated={(appId) => {
                void onCreated()
                if (appId) setSelectedId(appId)
              }}
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
            <button type="button" className="btn justify-between" onClick={onOpenOperations}><span className="inline-flex items-center gap-1.5"><Workflow size={13} /> 操作记录</span><ArrowRight size={12} /></button>
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

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatError(cause: unknown) {
  if (cause instanceof RuntimeApiError) return cause.message
  return cause instanceof Error ? cause.message : String(cause)
}
