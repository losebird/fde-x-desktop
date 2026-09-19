import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity, AppWindow, ArrowRight, Bot, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, Database, ExternalLink, FileClock, Loader2, Play, Plus,
  RefreshCw, Search, ShieldCheck, Table2, Trash2, Workflow, X,
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
import { isFdeAppSpec, specHasUse, type FdeAppDetail } from '@/lib/app-spec'
import { runDeclaredPlatformUse } from '@/lib/app-platform'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { RecordsPanel } from '@/components/biz/RecordsPanel'
import { OperationControlPanel } from '@/components/biz/OperationControlPanel'

type View = 'overview' | 'records' | 'operations'
type Tone = 'default' | 'red' | 'amber' | 'blue' | 'purple' | 'teal' | 'green'

type DataSurfaceSnap = {
  workspaceId: string
  health: RuntimeHealth | null
  connections: BusinessConnectionRecord[]
  apps: BusinessAppRecord[]
  operations: RuntimeOperation[]
  catalogCount: number
  error: string
  details: Record<string, FdeAppDetail>
}

let dataSurfaceSnap: DataSurfaceSnap | null = null

function peekDataSurface(workspaceId: string): DataSurfaceSnap | null {
  return dataSurfaceSnap?.workspaceId === workspaceId ? dataSurfaceSnap : null
}

function rememberDataSurface(row: Omit<DataSurfaceSnap, 'details'> & { details?: Record<string, FdeAppDetail> }) {
  const prev = dataSurfaceSnap?.workspaceId === row.workspaceId ? dataSurfaceSnap.details : {}
  dataSurfaceSnap = { ...row, details: { ...prev, ...(row.details || {}) } }
}

function rememberAppDetail(workspaceId: string, detail: FdeAppDetail) {
  const prev = peekDataSurface(workspaceId)
  rememberDataSurface({
    workspaceId,
    health: prev?.health ?? null,
    connections: prev?.connections ?? [],
    apps: prev?.apps ?? [],
    operations: prev?.operations ?? [],
    catalogCount: prev?.catalogCount ?? 0,
    error: prev?.error ?? '',
    details: { [detail.id]: detail },
  })
}

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
  const snap = peekDataSurface(activeWorkspaceId)
  const [health, setHealth] = useState<RuntimeHealth | null>(snap?.health ?? null)
  const [connections, setConnections] = useState<BusinessConnectionRecord[]>(snap?.connections ?? [])
  const [apps, setApps] = useState<BusinessAppRecord[]>(snap?.apps ?? [])
  const [operations, setOperations] = useState<RuntimeOperation[]>(snap?.operations ?? [])
  const [catalogCount, setCatalogCount] = useState(snap?.catalogCount ?? 0)
  const [loading, setLoading] = useState(!snap)
  const [error, setError] = useState(snap?.error ?? '')

  const refresh = useCallback(async () => {
    const warm = peekDataSurface(activeWorkspaceId)
    if (!warm) {
      setLoading(true)
      setError('')
    }
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
      const catalog = Array.isArray((mailbox as { catalog?: unknown[] }).catalog) ? (mailbox as { catalog: unknown[] }).catalog : []
      setHealth(nextHealth)
      setConnections(nextConnections)
      setApps(nextApps)
      setOperations(nextOperations)
      setCatalogCount(catalog.length)
      setError('')
      rememberDataSurface({
        workspaceId: activeWorkspaceId,
        health: nextHealth,
        connections: nextConnections,
        apps: nextApps,
        operations: nextOperations,
        catalogCount: catalog.length,
        error: '',
      })
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

      {view === 'records' && (
        <AuthorityStrip health={health} loading={loading} error={error} catalogCount={catalogCount} onRefresh={refresh} />
      )}

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

function catalogApps(apps: BusinessAppRecord[]) {
  return apps.filter((app) => app.status !== 'archived')
}

function AppCatalogRow({
  app, onOpen, onDelete,
}: {
  app: BusinessAppRecord
  onOpen: () => void
  onDelete: () => void
}) {
  const running = app.status === 'active'
  return (
    <div data-app-row={app.id} className="px-4 py-3 flex items-center gap-3 hover:bg-surface-2 transition-colors">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 flex items-center gap-3 text-left">
        <div className="w-9 h-9 border border-line bg-surface-2 flex items-center justify-center text-brand shrink-0">
          {app.appKind === 'generated' ? <Bot size={16} /> : <AppWindow size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate" data-app-row-name={app.name}>{app.name}</div>
          <div className="text-xs text-ink-muted mt-0.5">修订 {app.currentRevision} · {isFdeAppSpec(app.definition) ? app.status : app.appKind === 'generated' ? '草稿' : '系统应用'} · {formatTime(app.updatedAt)}</div>
        </div>
        <Tag kind={running ? 'green' : 'amber'}>
          {running ? '运行中' : '草稿'}
        </Tag>
        <ChevronRight size={14} className="text-ink-subtle" />
      </button>
      <button type="button" className="btn h-7 shrink-0" onClick={onDelete}>
        <Trash2 size={12} /> 删除
      </button>
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
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [dialogAppId, setDialogAppId] = useState('')
  const workspaceAppId = useApp((state) => state.dataBrowse.workspaceAppId) || ''
  const setDataBrowse = useApp((state) => state.setDataBrowse)
  const setWorkspaceAppId = (id: string) => setDataBrowse({ workspaceAppId: id || null })
  const [deleteTarget, setDeleteTarget] = useState<BusinessAppRecord | null>(null)
  const [declarativeApp, setDeclarativeApp] = useState<FdeAppDetail | null>(() => {
    if (!workspaceAppId) return null
    return peekDataSurface(useApp.getState().activeWorkspaceId)?.details[workspaceAppId] ?? null
  })
  const [workspaceCwd, setWorkspaceCwd] = useState(() => {
    const cwd = loadCurrentWorkspaceCwd()
    return cwd.ok ? cwd.cwd : ''
  })
  const visibleApps = catalogApps(apps)
  const runningApps = visibleApps.filter((app) => app.status === 'active')
  const draftApps = visibleApps.filter((app) => app.status !== 'active')
  const showDrafts = draftsOpen || runningApps.length === 0
  const openAppId = workspaceAppId || dialogAppId
  const selected = apps.find((app) => app.id === openAppId) || null
  const workspaceApp = visibleApps.find((app) => app.id === workspaceAppId) || null

  useEffect(() => {
    const cwd = loadCurrentWorkspaceCwd()
    if (cwd.ok) setWorkspaceCwd(cwd.cwd)
  }, [])

  useEffect(() => {
    const id = workspaceAppId || ((selected && isFdeAppSpec(selected.definition)) ? selected.id : '')
    if (!id) {
      setDeclarativeApp(null)
      return
    }
    if (selected && selected.id === id && !isFdeAppSpec(selected.definition)) {
      setDeclarativeApp(null)
      return
    }
    const cached = peekDataSurface(useApp.getState().activeWorkspaceId)?.details[id]
    if (cached) setDeclarativeApp(cached)
    const cwd = loadCurrentWorkspaceCwd()
    if (cwd.ok) setWorkspaceCwd(cwd.cwd)
    void runtimeApi.getDeclarativeApp(id).then((detail) => {
      setDeclarativeApp(detail)
      rememberAppDetail(useApp.getState().activeWorkspaceId, detail)
    }).catch(() => {
      if (!cached) setDeclarativeApp(null)
    })
  }, [workspaceAppId, selected?.id, selected?.currentRevision, selected?.definition])

  const openApp = (app: BusinessAppRecord) => {
    if (app.status === 'active' && isFdeAppSpec(app.definition)) {
      setDialogAppId('')
      setWorkspaceAppId(app.id)
      return
    }
    setWorkspaceAppId('')
    setDialogAppId(app.id)
  }

  const afterRuntimeChange = async (appId: string) => {
    await onCreated()
    const detail = await runtimeApi.getDeclarativeApp(appId).catch(() => null)
    if (detail) {
      setDeclarativeApp(detail)
      rememberAppDetail(useApp.getState().activeWorkspaceId, detail)
    }
    if (detail?.status === 'active' && dialogAppId === appId) {
      setDialogAppId('')
      setWorkspaceAppId(appId)
    }
  }

  if (workspaceAppId) {
    return (
      <div className="space-y-3" data-app-workspace="true">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn h-8" onClick={() => setWorkspaceAppId('')}>
            <ChevronLeft size={14} /> 返回列表
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{workspaceApp?.name || declarativeApp?.name || ''}</div>
          </div>
          <Tag kind="green">运行中</Tag>
          {declarativeApp && specHasUse(declarativeApp.spec, 'float') && (
            <button
              type="button"
              className="btn h-8"
              data-app-use="float"
              onClick={() => {
                void runDeclaredPlatformUse('float', declarativeApp.spec, workspaceAppId)
              }}
            >
              浮窗
            </button>
          )}
        </div>
        <Card className="!p-0 overflow-hidden">
          {declarativeApp && workspaceCwd && declarativeApp.id === workspaceAppId ? (
            <AppRuntime
              app={declarativeApp}
              workspaceCwd={workspaceCwd}
              variant="workspace"
              onChanged={() => { void afterRuntimeChange(workspaceAppId) }}
              onRequestDelete={workspaceApp ? () => setDeleteTarget(workspaceApp) : undefined}
            />
          ) : (
            <div className="px-4 py-8 text-sm text-ink-muted">正在打开工作面…</div>
          )}
        </Card>
        {deleteTarget && (
          <AppDeleteConfirm
            app={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onDone={async () => {
              setDeleteTarget(null)
              setWorkspaceAppId('')
              setDialogAppId('')
              await onCreated()
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 @3xl:grid-cols-4 gap-3">
        <Metric icon={AppWindow} label="业务应用" value={visibleApps.length} hint={`${visibleApps.filter((item) => item.appKind === 'generated').length} 个由 AI 创建`} />
        <Metric icon={Database} label="系统连接" value={connections.length} hint={`${connections.filter((item) => item.status === 'connected').length} 个已接通`} />
        <Metric icon={FileClock} label="待审批" value={pendingApproval} hint="写入不会绕过确认" tone={pendingApproval ? 'amber' : 'default'} />
        <Metric icon={Activity} label="异常待处理" value={unresolved} hint={`${operations.length} 次操作留有记录`} tone={unresolved ? 'red' : 'default'} />
      </div>

      <div className="grid grid-cols-1 @3xl:grid-cols-[1.12fr_.88fr] gap-4">
        <Card className="!p-0 overflow-hidden">
          <div data-app-catalog="true">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">我的业务应用</div>
              <div className="text-xs text-ink-muted mt-0.5">列表是目录，没有官方台账。主入口是创建应用：描述需求，生成你自己的应用。</div>
            </div>
            <button type="button" className="btn-primary !py-1" data-app-create-entry="true" onClick={() => setShowCreate((value) => !value)}><Plus size={12} /> 创建应用</button>
          </div>
          {showCreate && (
            <AppCreateWizard
              workspaceId={workspaceId}
              onDraftReady={() => { void onCreated() }}
              onActivated={(appId) => {
                void onCreated()
                setShowCreate(false)
                setDialogAppId('')
                setWorkspaceAppId(appId)
              }}
              onClose={() => setShowCreate(false)}
            />
          )}
          {visibleApps.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-muted">这里没有官方台账。描述你的需求，生成你自己的应用。</div>
          ) : (
            <div className="divide-y divide-line">
              {runningApps.length > 0 && (
                <div data-app-catalog-section="running">
                  <div className="px-4 py-2 text-[11px] text-ink-muted bg-surface">运行中</div>
                  <div className="divide-y divide-line">
                    {runningApps.map((app) => (
                      <AppCatalogRow key={app.id} app={app} onOpen={() => openApp(app)} onDelete={() => setDeleteTarget(app)} />
                    ))}
                  </div>
                </div>
              )}
              {draftApps.length > 0 && (
                <div data-app-catalog-section="drafts">
                  <button
                    type="button"
                    data-app-drafts-toggle="true"
                    data-app-drafts-open={showDrafts ? 'true' : 'false'}
                    className="w-full px-4 py-2 flex items-center justify-between gap-2 text-left hover:bg-surface-2"
                    onClick={() => setDraftsOpen((value) => !value)}
                  >
                    <span className="text-[11px] text-ink-muted">草稿 · {draftApps.length}</span>
                    <ChevronDown size={14} className={clsx('text-ink-subtle transition-transform', showDrafts ? 'rotate-180' : '')} />
                  </button>
                  {showDrafts && (
                    <div className="divide-y divide-line bg-surface-2">
                      {draftApps.map((app) => (
                        <AppCatalogRow key={app.id} app={app} onOpen={() => openApp(app)} onDelete={() => setDeleteTarget(app)} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
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

      {dialogAppId && selected && (
        <div className="fixed inset-0 z-[80] bg-ink/25 flex items-center justify-center p-4" data-app-open-dialog="true" onClick={() => setDialogAppId('')}>
          <div className="w-full max-w-3xl max-h-[86vh] overflow-hidden bg-surface border border-line rounded-xl shadow-2xl flex flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="h-12 px-4 border-b border-line flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{selected.name}</div>
                <div className="text-[11px] text-ink-muted">草稿预览 · 采纳后进入工作面，不在列表页填表</div>
              </div>
              <button type="button" className="btn-ghost p-1.5" onClick={() => setDialogAppId('')} aria-label="关闭预览"><X size={15} /></button>
            </div>
            <div className="overflow-y-auto">
              {declarativeApp && workspaceCwd && isFdeAppSpec(selected.definition) && (
                <AppRuntime
                  app={declarativeApp}
                  workspaceCwd={workspaceCwd}
                  variant="dialog"
                  previewMode={declarativeApp.status !== 'active'}
                  onChanged={() => { void afterRuntimeChange(selected.id) }}
                  onRequestDelete={() => setDeleteTarget(selected)}
                />
              )}
              {!isFdeAppSpec(selected.definition) && (
                <AppDraftEditor
                  app={selected}
                  connections={connections}
                  onSaved={onCreated}
                  onOpenRecords={onOpenRecords}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <AppDeleteConfirm
          app={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDone={async () => {
            const id = deleteTarget.id
            setDeleteTarget(null)
            if (dialogAppId === id) setDialogAppId('')
            if (workspaceAppId === id) setWorkspaceAppId('')
            await onCreated()
          }}
        />
      )}
    </div>
  )
}

function AppDeleteConfirm({
  app, onCancel, onDone,
}: {
  app: BusinessAppRecord
  onCancel: () => void
  onDone: () => Promise<void>
}) {
  const [hardDelete, setHardDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const active = app.status === 'active'

  const confirm = async () => {
    setBusy(true)
    setNote('')
    try {
      if (!active) {
        await runtimeApi.discardDeclarativeApp(app.id)
      } else if (hardDelete) {
        await runtimeApi.purgeDeclarativeApp(app.id)
      } else {
        await runtimeApi.archiveDeclarativeApp(app.id)
      }
      await onDone()
    } catch (cause) {
      setNote(formatError(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-ink/30 flex items-center justify-center p-4" data-app-delete-confirm="true" onClick={onCancel}>
      <div className="w-full max-w-md bg-surface border border-line rounded-xl shadow-2xl p-4 space-y-3" onClick={(event) => event.stopPropagation()}>
        <div className="text-sm font-medium">{active ? '删除运行中的应用' : '删除草稿'}</div>
        {active ? (
          <div className="text-xs text-ink-muted leading-relaxed">
            再确认一次。默认只从列表拿掉（归档），台账表先留着。只有勾选「连数据一起删」才会硬删这张应用自己的表。
          </div>
        ) : (
          <div className="text-xs text-ink-muted leading-relaxed">
            确认后这条草稿从列表拿掉。同名草稿按各自一条删，不会当成同一个。
          </div>
        )}
        {active && (
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              data-app-hard-delete="true"
              checked={hardDelete}
              onChange={(event) => setHardDelete(event.target.checked)}
            />
            <span>连数据一起删（硬删表，不可恢复）</span>
          </label>
        )}
        {note && <div className="text-xs text-accent-red">{note}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn h-8" disabled={busy} onClick={onCancel}>取消</button>
          <button type="button" className="btn-brand h-8" disabled={busy} onClick={() => void confirm()}>
            {busy ? '处理中' : active && hardDelete ? '确认硬删' : '确认删除'}
          </button>
        </div>
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
