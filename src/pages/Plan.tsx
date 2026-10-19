// 计划模块:三 Tab 合并 —— 待办 / 日程 / 工作流
import { useState, useMemo, useEffect, type ReactNode } from 'react'
import {
  Plus, Circle, CheckCircle2, CircleDot, Archive, Search, Filter, X, Trash2, ChevronDown,
  Clock, MapPin, Calendar as CalIcon, Repeat, Play, Power, Sparkles, Bot,
} from 'lucide-react'
import { askAiForResult } from '@/lib/ask-ai'
import { askOrigin } from '@/lib/ask-origin'
import { openRef } from '@/lib/open-ref'
import { planAppSource, planTaskAskFields } from '@/lib/plan-app-source'
import type { JsonSchemaLite } from '@/lib/json-schema-lite'
import clsx from 'clsx'
import { useApp, useCurrentWorkflows, useCurrentTasks } from '@/store/app'
import type { Task, ScheduleEvent, Workflow, WorkflowStep } from '@/lib/types'
import { Card, Tag, Empty, PageTitle } from '@/components/ui'
import { useEvents } from '@/lib/events'
import { ContextChips } from '@/components/ai/ContextChips'
import { buildContextPack, type ContextPack } from '@/lib/context-pack'
import { hostGoalStatusOnly, isHostGoalId, isHostJobId, isHostScheduleId } from '@/lib/plan-origin'
import { PlanTaskProposals } from '@/components/plan/PlanTaskProposals'
import { WorkflowToolPicker } from '@/components/plan/WorkflowToolPicker'
import { runtimeApi } from '@/lib/runtime-api'
import { readStepPreset, readStepTools, workflowToolCopy, workflowToolTier } from '@/lib/workflow-tool-copy'
import { PLAN_DAY_HOURS, planDayOffsetMinutes, planNowMarker, scheduleInstants } from '../../runtime/plan/plan-day-hours.mjs'
import { scheduleTriggerLabel } from '../../runtime/plan/schedule-outcome.mjs'

function RightDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-md h-full border-l border-line shadow-[-8px_0_32px_rgba(0,0,0,0.08)] rounded-l-xl p-5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-medium">{title}</h3>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

type Tab = 'todo' | 'schedule' | 'workflow'

export default function Plan() {
  const active = useApp((s) => s.activePlanTab)
  const setActive = useApp((s) => s.setActivePlanTab)
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId)
  const workspaces = useApp((s) => s.workspaces)
  const hydratePlan = useApp((s) => s.hydratePlan)
  const planServiceError = useApp((s) => s.planServiceError)

  const workspaceCwd = useMemo(() => {
    const row = workspaces.find((w) => w.id === activeWorkspaceId)
    const cwd = typeof row?.cwd === 'string' ? row.cwd.trim() : ''
    return cwd.startsWith('/') ? cwd : undefined
  }, [workspaces, activeWorkspaceId])

  useEffect(() => {
    if (activeWorkspaceId) void hydratePlan(activeWorkspaceId)
  }, [activeWorkspaceId, hydratePlan])

  useEvents(
    ['task.changed'],
    () => {
      if (activeWorkspaceId) void hydratePlan(activeWorkspaceId)
    },
    workspaceCwd ? { workspace: workspaceCwd } : undefined,
  )

  if (!activeWorkspaceId || !workspaces.some((w) => w.id === activeWorkspaceId)) {
    return <Empty title="先在顶栏选择工作区" hint="计划数据按工作区隔离，需要先有可用工作区。" />
  }

  return (
    <div>
      {planServiceError && (
        <div className="mb-3 text-sm px-3 py-2 rounded border bg-amber-50 text-amber-900 border-amber-100">
          {planServiceError}
        </div>
      )}
      <PageTitle
        title="计划"
        subtitle="待办 + 日程 + 自动化工作流 —— 一次性动作、有时间锚点的事、重复触发的规则。"
        actions={
          <div className="flex border border-line rounded overflow-hidden" data-plan-tab={active}>
            {[
              { k: 'todo', label: '待办', icon: Circle },
              { k: 'schedule', label: '日程', icon: CalIcon },
              { k: 'workflow', label: '工作流', icon: Repeat },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setActive(t.k as Tab)}
                className={clsx(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5',
                  active === t.k ? 'bg-ink text-white' : 'hover:bg-surface-2 text-ink-muted',
                )}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        }
      />
      {active === 'todo' && <TodoTab />}
      {active === 'schedule' && <ScheduleTab />}
      {active === 'workflow' && <WorkflowTab />}
    </div>
  )
}

// =======================================================
// Tab 1: 待办 (复用 Tasks 页面逻辑,但独立管理)
// =======================================================
const TODO_STATUSES = [
  { key: 'todo',     label: '待办',     icon: Circle },
  { key: 'doing',    label: '进行中',   icon: CircleDot },
  { key: 'done',     label: '已完成',   icon: CheckCircle2 },
  { key: 'archived', label: '已归档',   icon: Archive },
] as const

const PRIORITY_TAG: Record<Task['priority'], { kind: 'red'|'amber'|'blue'|'default'; label: string }> = {
  urgent: { kind: 'red',    label: '紧急' },
  high:   { kind: 'amber',  label: '高' },
  med:    { kind: 'blue',   label: '中' },
  low:    { kind: 'default',label: '低' },
}

type TaskAdvicePatch = Partial<Pick<Task, 'title' | 'notes' | 'status' | 'priority' | 'due' | 'tags'>>
type TaskAdviceSuggestion = { taskId: string; reason: string; patch: TaskAdvicePatch }
type TaskAdviceResult = { summary?: string; suggestions: TaskAdviceSuggestion[] }

const TaskAdviceSchema: JsonSchemaLite = {
  type: 'object',
  required: ['suggestions'],
  properties: {
    summary: { type: 'string' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['taskId', 'reason', 'patch'],
        properties: {
          taskId: { type: 'string' },
          reason: { type: 'string' },
          patch: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              notes: { type: 'string' },
              status: { enum: ['todo', 'doing', 'done', 'archived'] },
              priority: { enum: ['urgent', 'high', 'med', 'low'] },
              due: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  },
}

function formatAdvicePatch(patch: TaskAdvicePatch): string {
  const parts: string[] = []
  if (patch.title !== undefined) parts.push(`标题 → ${patch.title}`)
  if (patch.notes !== undefined) parts.push(`备注 → ${patch.notes}`)
  if (patch.status !== undefined) parts.push(`状态 → ${patch.status}`)
  if (patch.priority !== undefined) parts.push(`优先级 → ${patch.priority}`)
  if (patch.due !== undefined) parts.push(`截止 → ${patch.due || '—'}`)
  if (patch.tags !== undefined) parts.push(`标签 → ${patch.tags.join(', ') || '—'}`)
  return parts.length ? parts.join('；') : '（无字段变更）'
}

function planSourceButton(task: Task, selectTask: (id: Task['id']) => void) {
  const handle = planAppSource(task.sourceRef || '')
  if (!handle) return null
  const row = handle.kind === 'row'
  return (
    <button
      type="button"
      className="text-xs text-ink-muted mt-0.5"
      data-plan-source={row ? 'row' : 'app'}
      data-plan-source-app={handle.ledgerId}
      {...(row ? { 'data-plan-source-rid': handle.rid } : {})}
      onClick={(event) => {
        event.stopPropagation()
        selectTask(task.id)
        openRef(handle.href)
      }}
    >
      {row ? '打开记录' : '打开应用'}
    </button>
  )
}

function TodoTab() {
  const tasks = useCurrentTasks()
  const addTask = useApp((s) => s.addTask)
  const removeTask = useApp((s) => s.removeTask)
  const updateTask = useApp((s) => s.updateTask)
  const cycleStatus = useApp((s) => s.cycleTaskStatus)
  const selectedTaskId = useApp((s) => s.selectedTaskId)
  const selectTask = useApp((s) => s.selectTask)

  useEffect(() => {
    if (!selectedTaskId) return
    document.querySelector('[data-plan-task-selected]')?.scrollIntoView({ block: 'nearest' })
  }, [selectedTaskId])

  const [tab, setTab] = useState<Task['status']>('todo')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const [organizeLoading, setOrganizeLoading] = useState(false)
  const [organizeError, setOrganizeError] = useState('')
  const [organizeAdvice, setOrganizeAdvice] = useState<TaskAdviceResult | null>(null)
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(() => new Set())
  const [applyingKey, setApplyingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Pick<Task, 'title'|'priority'|'due'|'tags'>>({
    title: '', priority: 'med', due: '', tags: [],
  })
  const [ctxPack, setCtxPack] = useState<ContextPack | null>(null)
  const [ctxWarnings, setCtxWarnings] = useState<string[]>([])
  const [ctxOmit, setCtxOmit] = useState<Set<string>>(() => new Set())
  const [askError, setAskError] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const selectedTask = tasks.find((row) => row.id === selectedTaskId) || null
  const taskPackKey = tasks.map((row) => `${row.id}:${row.status}`).join('|')

  useEffect(() => {
    let cancelled = false
    const query = selectedTask ? selectedTask.title : '整理待办'
    const scopes = selectedTask
      ? (['workspace', 'tasks', 'memory'] as const)
      : (['tasks'] as const)
    setCtxOmit(new Set())
    void buildContextPack({
      scopes: [...scopes],
      query,
      intentKind: 'lookup',
    }).then((packed) => {
      if (cancelled) return
      setCtxPack(packed.pack)
      setCtxWarnings(packed.warnings || [])
    }).catch(() => {
      if (cancelled) return
      setCtxPack(null)
      setCtxWarnings([])
    })
    return () => { cancelled = true }
  }, [taskPackKey, selectedTaskId, selectedTask?.title])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((t) => t.tags.forEach((x) => set.add(x)))
    return Array.from(set)
  }, [tasks])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (tab !== 'archived' && t.status === 'archived') return false
      if (tab === 'archived' && t.status !== 'archived') return false
      if (tab === 'todo' && t.status !== 'todo') return false
      if (tab === 'doing' && t.status !== 'doing') return false
      if (tab === 'done' && t.status !== 'done') return false
      if (q && !t.title.includes(q)) return false
      if (tag && !t.tags.includes(tag)) return false
      return true
    })
  }, [tasks, tab, q, tag])

  const counts = useMemo(() => {
    const m: Record<Task['status'], number> = { todo: 0, doing: 0, done: 0, archived: 0 }
    tasks.forEach((t) => { m[t.status]++ })
    return m
  }, [tasks])

  function submit() {
    if (!draft.title.trim()) return
    void addTask({
      title: draft.title,
      priority: draft.priority,
      due: draft.due || undefined,
      tags: draft.tags,
      status: 'todo',
    }).then(() => {
      setDraft({ title: '', priority: 'med', due: '', tags: [] })
      setShowNew(false)
    }).catch(() => undefined)
  }

  async function runOrganizeTodos() {
    setOrganizeOpen(true)
    setOrganizeLoading(true)
    setOrganizeError('')
    setOrganizeAdvice(null)
    setAppliedKeys(new Set())
    const result = await askAiForResult<TaskAdviceResult>({
      intent: '整理待办',
      prompt: '根据以下待办给出去重/合并/优先级建议，用 fde_submit_result 提交',
      schema: TaskAdviceSchema,
      context: ['tasks'],
      omit: ctxOmit,
      taskIds: filtered.map((row) => row.id),
    })
    setOrganizeLoading(false)
    if (!result.ok) {
      if (result.error === 'timeout') {
        setOrganizeError('AI 没有提交结构化结果，可在 AI 页查看它说了什么')
      } else if (result.error === 'schema_mismatch' && result.raw && typeof result.raw === 'object') {
        setOrganizeAdvice(result.raw as TaskAdviceResult)
        setOrganizeError('返回结构与约定不完全一致，请谨慎应用')
      } else {
        setOrganizeError(result.error === '核心未连接' ? result.error : `整理失败：${result.error}`)
      }
      return
    }
    setOrganizeAdvice(result.data)
  }

  async function runAskSelected() {
    if (!selectedTask) return
    setAskLoading(true)
    setAskError('')
    const fields: Record<string, unknown> = {
      status: selectedTask.status,
      priority: selectedTask.priority,
    }
    if (selectedTask.notes) fields.notes = selectedTask.notes
    if (selectedTask.due) fields.due = selectedTask.due
    if (selectedTask.tags.length) fields.tags = selectedTask.tags.join(', ')
    const asked = await planTaskAskFields(selectedTask.sourceRef || '')
    const result = await askOrigin(`task:${selectedTask.id}`, {
      title: selectedTask.title,
      text: selectedTask.notes || selectedTask.title,
      status: selectedTask.status,
      fields: { ...fields, ...asked },
      tail: '请结合上述来源实体推进这项待办。禁止过账。',
      omit: ctxOmit,
      taskIds: [selectedTask.id],
      revealAi: true,
    })
    setAskLoading(false)
    if (!result.ok) setAskError(result.error)
  }

  async function applySuggestion(suggestion: TaskAdviceSuggestion, key: string) {
    if (appliedKeys.has(key) || applyingKey) return
    const patch = suggestion.patch
    if (!patch || !Object.keys(patch).length) return
    const task = tasks.find((t) => t.id === suggestion.taskId)
    if (!task) {
      setOrganizeError('任务已不存在，请刷新列表后重试')
      return
    }
    const nextPatch = isHostGoalId(suggestion.taskId)
      ? hostGoalStatusOnly(patch as Record<string, unknown>)
      : patch
    if (!Object.keys(nextPatch).length) {
      setOrganizeError('Host goal 只能改状态')
      return
    }
    setApplyingKey(key)
    setOrganizeError('')
    try {
      await updateTask(suggestion.taskId, nextPatch as TaskAdvicePatch)
      setAppliedKeys((prev) => new Set(prev).add(key))
    } catch (cause) {
      setOrganizeError(cause instanceof Error ? cause.message : '应用建议失败')
    } finally {
      setApplyingKey(null)
    }
  }

  return (
    <div>
      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            {TODO_STATUSES.map((s) => (
              <button
                key={s.key}
                onClick={() => setTab(s.key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm',
                  tab === s.key ? 'bg-ink text-white' : 'hover:bg-surface-2 text-ink-muted',
                )}
              >
                <s.icon size={14} />
                {s.label}
                <span className={clsx('text-[11px] tabular-nums', tab === s.key ? 'text-white/70' : 'text-ink-subtle')}>
                  {counts[s.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input className="input pl-8 h-8 w-44" placeholder="搜索任务" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="relative">
              <select className="input h-8 pr-8 text-sm appearance-none" value={tag ?? ''} onChange={(e) => setTag(e.target.value || null)}>
                <option value="">所有标签</option>
                {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
            </div>
            <button
              type="button"
              className="btn h-8"
              disabled={organizeLoading}
              title="整理待办"
              onClick={() => void runOrganizeTodos()}
            >
              <Sparkles size={14} /> {organizeLoading ? '整理中…' : '整理待办'}
            </button>
            <button
              type="button"
              className="btn h-8"
              disabled={!selectedTask || askLoading}
              title="交给当前 AI"
              onClick={() => void runAskSelected()}
            >
              <Bot size={14} /> {askLoading ? '交给中…' : '交给当前 AI'}
            </button>
            <ContextChips
              pack={ctxPack}
              warnings={ctxWarnings}
              omit={ctxOmit}
              onToggleOmit={(key) => setCtxOmit((prev) => {
                const next = new Set(prev)
                if (next.has(key)) next.delete(key)
                else next.add(key)
                return next
              })}
            />
          </div>
        </div>
      </Card>
      {askError && <div className="text-xs text-accent-red mb-3">{askError}</div>}

      <PlanTaskProposals />
      {filtered.length === 0 ? (
        <Empty title="这个筛选下没有任务" hint="可以新建一个,或切换其它 Tab" action={
          <button className="btn-primary" title="新建任务" onClick={() => setShowNew(true)}><Plus size={14} /> 新建任务</button>
        } />
      ) : (
        <Card className="p-0 overflow-x-auto">
          {/* 表头:用容器查询控制列显示;窄屏只显示 状态+任务+操作,中等加截止/优先级,宽屏全显 */}
          <div className="min-w-[280px] grid grid-cols-[28px_minmax(0,1fr)_28px] @md:grid-cols-[28px_minmax(0,1fr)_80px_60px_28px] @xl:grid-cols-[28px_minmax(0,1fr)_96px_64px_minmax(0,1.2fr)_28px] text-xs text-ink-muted uppercase tracking-wider border-b border-line px-3 py-2.5">
            <div></div>
            <div>任务</div>
            <div className="hidden @md:block">截止</div>
            <div className="hidden @md:block">优先级</div>
            <div className="hidden @xl:block">标签</div>
            <div></div>
          </div>
          {filtered.map((t) => (
            <div
              key={t.id}
              data-plan-task={t.id}
              data-plan-task-title={t.title}
              {...(selectedTaskId === t.id ? { 'data-plan-task-selected': 'true' } : {})}
              className={clsx(
              'min-w-[280px] grid grid-cols-[28px_minmax(0,1fr)_28px] @md:grid-cols-[28px_minmax(0,1fr)_80px_60px_28px] @xl:grid-cols-[28px_minmax(0,1fr)_96px_64px_minmax(0,1.2fr)_28px] items-center px-3 py-2.5 border-b border-line last:border-b-0 hover:bg-surface-2/40 group',
              selectedTaskId === t.id && 'bg-brand-soft/40 ring-1 ring-brand/30',
            )}>
              <button onClick={() => void cycleStatus(t.id)} className="text-ink-muted hover:text-brand flex items-center justify-center" title={isHostGoalId(t.id) ? '切换 Host goal 状态' : '切换状态'}>
                {t.status === 'done' && <CheckCircle2 size={16} className="text-brand" />}
                {t.status === 'doing' && <CircleDot size={16} className="text-accent-amber" />}
                {t.status === 'todo'  && <Circle size={16} />}
                {t.status === 'archived' && <Archive size={16} className="text-ink-subtle" />}
              </button>
              <div className="min-w-0 px-2 cursor-pointer" onClick={() => selectTask(t.id)}>
                <div className="font-medium text-sm truncate">{t.title}</div>
                {planSourceButton(t, selectTask)}
                {t.notes && <div className="text-xs text-ink-muted mt-0.5 truncate">{t.notes}</div>}
              </div>
              <div className="hidden @md:block text-xs text-ink-muted truncate">{t.due ?? '—'}</div>
              <div className="hidden @md:block"><Tag kind={PRIORITY_TAG[t.priority].kind}>{PRIORITY_TAG[t.priority].label}</Tag></div>
              <div className="hidden @xl:flex gap-1 flex-wrap min-w-0 overflow-hidden"><div className="flex gap-1 flex-wrap">{t.tags.slice(0, 2).map((g) => <Tag key={g}>#{g}</Tag>)}{t.tags.length > 2 && <Tag>+{t.tags.length - 2}</Tag>}</div></div>
              <button onClick={() => void removeTask(t.id)} className="btn-ghost p-1 text-ink-subtle hover:text-accent-red flex items-center justify-center" title={isHostGoalId(t.id) ? '归档 Host goal' : '删除'}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-3 text-right">
        <button className="btn-primary" title="新建任务" onClick={() => setShowNew(true)}><Plus size={14} /> 新建任务</button>
      </div>

      <RightDrawer open={showNew} onClose={() => setShowNew(false)} title="新建任务">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-muted">标题</label>
            <input className="input mt-1.5 w-full" value={draft.title} autoFocus onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="例如:完成 scene#39 demo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-muted">优先级</label>
              <select className="input mt-1.5 w-full" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Task['priority'] })}>
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="med">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-muted">截止</label>
              <input type="date" className="input mt-1.5 w-full" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-muted">标签 (逗号分隔)</label>
            <input className="input mt-1.5 w-full" placeholder="例如: scene, prototype" value={draft.tags.join(', ')} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button className="btn" onClick={() => setShowNew(false)}>取消</button>
            <button className="btn-primary" onClick={submit}>创建</button>
          </div>
        </div>
      </RightDrawer>

      <RightDrawer
        open={organizeOpen}
        onClose={() => {
          if (!organizeLoading) setOrganizeOpen(false)
        }}
        title="整理建议"
      >
        {organizeLoading && (
          <p className="text-sm text-ink-muted">已向当前 AI 会话发送整理请求，等待结构化结果…</p>
        )}
        {!organizeLoading && organizeError && (
          <div className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-4">{organizeError}</div>
        )}
        {!organizeLoading && organizeAdvice?.summary && (
          <p className="text-sm text-ink-muted mb-4">{organizeAdvice.summary}</p>
        )}
        {!organizeLoading && organizeAdvice?.suggestions?.length ? (
          <ul className="space-y-3">
            {organizeAdvice.suggestions.map((suggestion, index) => {
              const key = `${suggestion.taskId}:${index}`
              const task = tasks.find((t) => t.id === suggestion.taskId)
              const applied = appliedKeys.has(key)
              const busy = applyingKey === key
              return (
                <li key={key} className="border border-line rounded-lg p-3 bg-surface-2/30">
                  <div className="text-sm font-medium truncate">{task?.title ?? `任务 ${suggestion.taskId}`}</div>
                  <p className="text-xs text-ink-muted mt-1">{suggestion.reason}</p>
                  <p className="text-xs text-ink-subtle mt-2">{formatAdvicePatch(suggestion.patch)}</p>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={applied || busy || !task || !Object.keys(suggestion.patch || {}).length}
                      onClick={() => void applySuggestion(suggestion, key)}
                    >
                      {applied ? '已应用' : busy ? '应用中…' : '应用'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          !organizeLoading && !organizeError && <p className="text-sm text-ink-muted">暂无建议</p>
        )}
      </RightDrawer>
    </div>
  )
}

// =======================================================
// Tab 2: 日程
// =======================================================
const HOURS = PLAN_DAY_HOURS

const KIND_TONE: Record<ScheduleEvent['kind'], { bg: string; tag: 'blue'|'green'|'amber'|'purple' }> = {
  meeting:  { bg: 'bg-blue-50 border-blue-200 text-accent-blue',     tag: 'blue' },
  focus:    { bg: 'bg-brand-soft border-brand/30 text-brand',       tag: 'green' },
  reminder: { bg: 'bg-amber-50 border-amber-200 text-accent-amber', tag: 'amber' },
  external: { bg: 'bg-purple-50 border-purple-200 text-accent-purple', tag: 'purple' },
}

function localDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function emptyEventDraft() {
  return {
    title: '',
    date: localDateValue(new Date()),
    start: '14:00',
    end: '14:30',
    kind: 'focus' as ScheduleEvent['kind'],
    location: '',
    workflowId: '',
    recurrence: 'once' as 'once' | 'daily',
  }
}

function eventTriggerRun(event: ScheduleEvent, workflows: Workflow[]) {
  if (!event.workflowId) return null
  const workflow = workflows.find((row) => row.id === event.workflowId)
  if (!workflow) return null
  return workflow.runs.find((run) => run.eventId === event.id) || null
}

function TriggerStatus({ event, workflows }: { event: ScheduleEvent; workflows: Workflow[] }) {
  const run = eventTriggerRun(event, workflows)
  if (!run) return null
  const label = scheduleTriggerLabel(run)
  if (!label) return null
  if (run.sessionId) {
    return (
      <button
        type="button"
        className="opacity-80 text-[11px] underline truncate text-left"
        onClick={(click) => {
          click.stopPropagation()
          openRef({ panel: 'ai', sessionId: run.sessionId })
        }}
      >
        {label}
      </button>
    )
  }
  return <div className="opacity-80 text-[11px] truncate">{label}</div>
}

function ScheduleTab() {
  const events = useApp((s) => s.events)
  const workflows = useCurrentWorkflows()
  const addEvent = useApp((s) => s.addEvent)
  const removeEvent = useApp((s) => s.removeEvent)
  const toggleWorkflow = useApp((s) => s.toggleWorkflow)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [openNew, setOpenNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [draft, setDraft] = useState(emptyEventDraft)

  const todayKey = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
  const todays = useMemo(() => events.filter((e) => todayKey(e.start)), [events])

  const weekStart = useMemo(() => {
    const d = new Date()
    const weekday = d.getDay()
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday
    d.setDate(d.getDate() + mondayOffset)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
      return day
    }),
    [weekStart],
  )

  const dayLabel = (d: Date) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(d)

  const eventsOnDay = (d: Date) => events.filter((e) => {
    const start = new Date(e.start)
    return start.getFullYear() === d.getFullYear()
      && start.getMonth() === d.getMonth()
      && start.getDate() === d.getDate()
  })

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const nowMarker = planNowMarker(clock)
  const selectedWorkflow = workflows.find((row) => row.id === draft.workflowId)
  const bindPaused = Boolean(draft.workflowId && selectedWorkflow?.status === 'paused')

  async function submit() {
    if (saving || !draft.title.trim() || !draft.date || !draft.start || !draft.end) return
    const range = scheduleInstants(draft.date, draft.start, draft.end)
    setSaving(true)
    try {
      if (bindPaused) await toggleWorkflow(draft.workflowId)
      await addEvent({
        title: draft.title,
        start: range.start,
        end: range.end,
        kind: draft.kind,
        location: draft.location || undefined,
        workflowId: draft.workflowId || undefined,
        recurrence: draft.workflowId ? draft.recurrence : undefined,
      })
      setDraft(emptyEventDraft())
      setOpenNew(false)
    } catch {
      return
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex border border-line rounded overflow-hidden">
          <button className={clsx('px-3 py-1.5 text-sm', view === 'day'  && 'bg-ink text-white')} onClick={() => setView('day')}>日</button>
          <button className={clsx('px-3 py-1.5 text-sm', view === 'week' && 'bg-ink text-white')} onClick={() => setView('week')}>周</button>
        </div>
        <button className="btn-primary" title="新事件" onClick={() => setOpenNew(true)}><Plus size={14} /> 新事件</button>
      </div>

      {view === 'day' && (
        <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-6">
          <Card className="@3xl:col-span-2 p-0 overflow-hidden">
            <div className="grid grid-cols-[64px_1fr]">
              <div className="border-r border-line">
                {HOURS.map((h) => (
                  <div key={h} className="h-14 border-b border-line text-[10px] text-ink-muted flex items-start justify-end pr-2 pt-1">
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              <div className="relative">
                {HOURS.map((h) => <div key={h} className="h-14 border-b border-line" />)}
                {nowMarker != null && (
                  <div className="absolute left-0 right-0" style={{ top: `${nowMarker}px` }} data-now-marker="">
                    <span className="absolute -left-1 -top-1.5 w-2 h-2 rounded-full bg-accent-red" />
                    <span className="block h-px bg-accent-red" />
                  </div>
                )}
                {todays.map((e) => {
                  const startMin = planDayOffsetMinutes(e.start)
                  const endMin = planDayOffsetMinutes(e.end)
                  const top = (startMin / 60) * 56
                  const height = ((endMin - startMin) / 60) * 56
                  const triggerLabel = scheduleTriggerLabel(eventTriggerRun(e, workflows))
                  return (
                    <div key={e.id} className={clsx('absolute left-2 right-2 rounded border px-2 py-1.5 text-xs overflow-hidden', KIND_TONE[e.kind].bg)} style={{ top, height: Math.max(height, triggerLabel ? 52 : 24) }}>
                      <div className="font-medium truncate">{e.title}</div>
                      {e.workflowId && (
                        <div className="opacity-70 text-[11px] truncate">
                          {workflowToolCopy.scheduleWorkflow} {workflows.find((row) => row.id === e.workflowId)?.name || e.workflowId}
                          {' · '}
                          {e.recurrence === 'daily' ? workflowToolCopy.scheduleDaily : workflowToolCopy.scheduleOnce}
                        </div>
                      )}
                      <TriggerStatus event={e} workflows={workflows} />
                      <div className="opacity-70 text-[11px]">
                        {new Date(e.start).getHours().toString().padStart(2, '0')}:{new Date(e.start).getMinutes().toString().padStart(2, '0')}–
                        {new Date(e.end).getHours().toString().padStart(2, '0')}:{new Date(e.end).getMinutes().toString().padStart(2, '0')}
                        {e.location && <> · {e.location}</>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
          <div className="space-y-3">
            <Card>
              <div className="text-sm font-medium mb-3">今日清单</div>
              <ul className="space-y-2">
                {todays.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-sm group">
                    <Clock size={14} className="text-ink-muted mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{e.title}</div>
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5">
                        <Tag kind={KIND_TONE[e.kind].tag}>{e.kind}</Tag>
                        {e.location && <><MapPin size={10} /> {e.location}</>}
                      </div>
                      <TriggerStatus event={e} workflows={workflows} />
                    </div>
                    <button
                      className="btn-ghost p-1 text-ink-subtle hover:text-accent-red opacity-0 group-hover:opacity-100"
                      onClick={() => void removeEvent(e.id)}
                      title={isHostScheduleId(e.id) ? '清除 Host 日程' : '删除'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {view === 'week' && (
        <Card className="overflow-x-auto">
          <div className="min-w-[760px] grid grid-cols-7 gap-px bg-line border border-line rounded overflow-hidden">
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((label, idx) => (
              <div key={label} className="bg-surface-2 p-3">
                <div className="text-xs font-medium">{label}</div>
                <div className="text-[11px] text-ink-subtle">{dayLabel(weekDays[idx])}</div>
              </div>
            ))}
            {weekDays.map((day) => {
              const dayEvents = eventsOnDay(day)
              return (
                <div key={day.toISOString()} className="bg-surface min-h-[120px] p-2 space-y-1">
                  {dayEvents.length === 0 ? (
                    <div className="text-[11px] text-ink-subtle px-1 py-2">暂无日程</div>
                  ) : dayEvents.map((e) => (
                    <div key={e.id} className={clsx('p-1.5 rounded border text-[11px]', KIND_TONE[e.kind].bg)}>
                      <div className="font-medium truncate">{e.title}</div>
                      <div className="opacity-70">
                        {new Date(e.start).getHours().toString().padStart(2, '0')}:{new Date(e.start).getMinutes().toString().padStart(2, '0')}
                      </div>
                      <TriggerStatus event={e} workflows={workflows} />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <RightDrawer open={openNew} onClose={() => setOpenNew(false)} title="新建事件">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-muted">标题</label>
            <input className="input mt-1.5 w-full" autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="例如:产品评审" />
          </div>
          <div>
            <label className="text-xs text-ink-muted">日期</label>
            <input type="date" className="input mt-1.5 w-full" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-muted">开始</label>
              <input type="time" className="input mt-1.5 w-full" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-ink-muted">结束</label>
              <input type="time" className="input mt-1.5 w-full" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-muted">{workflowToolCopy.scheduleWorkflow}</label>
            <select className="input mt-1.5 w-full" value={draft.workflowId} onChange={(e) => setDraft({ ...draft, workflowId: e.target.value })}>
              <option value="">{workflowToolCopy.scheduleNone}</option>
              {workflows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            {bindPaused && (
              <p className="mt-1.5 text-xs text-accent-amber">该工作流已暂停，到点不会运行</p>
            )}
          </div>
          {draft.workflowId && (
            <div>
              <label className="text-xs text-ink-muted">{workflowToolCopy.scheduleRecurrence}</label>
              <select className="input mt-1.5 w-full" value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value === 'daily' ? 'daily' : 'once' })}>
                <option value="once">{workflowToolCopy.scheduleOnce}</option>
                <option value="daily">{workflowToolCopy.scheduleDaily}</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-ink-muted">类型</label>
            <select className="input mt-1.5 w-full" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ScheduleEvent['kind'] })}>
              <option value="focus">深聊 / 专注</option>
              <option value="meeting">会议</option>
              <option value="reminder">提醒</option>
              <option value="external">外部</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-muted">地点</label>
            <input className="input mt-1.5 w-full" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="会议室 A / 线上" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button className="btn" onClick={() => setOpenNew(false)}>取消</button>
            <button className="btn-primary" onClick={() => void submit()} disabled={saving}>{bindPaused ? '绑定并启用' : '创建'}</button>
          </div>
        </div>
      </RightDrawer>
    </div>
  )
}

// =======================================================
// Tab 3: 工作流 (Workflows)
// =======================================================
const WORKFLOW_EMOJIS = ['🤖', '⚡', '🔁', '📬', '📝', '🗃️', '📊', '🔔']

const SAVED_ONLY = '本版仅保存，不自动执行'

function emptyWorkflowDraft(): {
  name: string
  description: string
  category: Workflow['category']
  triggerKind: Workflow['trigger']['kind']
  triggerExpr: string
  triggerPatterns: string
  triggerOn: 'task.done' | 'file.save' | 'order.new' | 'im.received'
  emoji: string
  stepKind: 'ai' | 'delay'
  prompt: string
  sourceRef: string
} {
  return {
    name: '',
    description: '',
    category: 'system',
    triggerKind: 'manual',
    triggerExpr: '0 9 * * *',
    triggerPatterns: '',
    triggerOn: 'task.done',
    emoji: '🤖',
    stepKind: 'ai',
    prompt: '',
    sourceRef: '',
  }
}

function workflowRunWords(workflow: Workflow): { hold: string; outcome: string } {
  const hold = workflow.status === 'active' ? '已启用' : '已暂停'
  const state = workflow.runs[0]?.state
  if (state === 'queued') return { hold: '', outcome: '排队' }
  if (state === 'running' || state === 'waiting') return { hold: '', outcome: '运行中' }
  if (state === 'succeeded') return { hold, outcome: '成功' }
  if (state === 'failed' || state === 'cancelled') return { hold, outcome: '失败' }
  return { hold, outcome: '' }
}

function WorkflowTab() {
  const workflows = useCurrentWorkflows()
  const workspaceId = useApp((s) => s.activeWorkspaceId)
  const planServiceError = useApp((s) => s.planServiceError)
  const toggleWorkflow = useApp((s) => s.toggleWorkflow)
  const runWorkflow = useApp((s) => s.runWorkflow)
  const workflowRunSubmitIds = useApp((s) => s.workflowRunSubmitIds)
  const removeWorkflow = useApp((s) => s.removeWorkflow)
  const addWorkflow = useApp((s) => s.addWorkflow)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | Workflow['status']>('all')
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState(emptyWorkflowDraft)
  const [catalog, setCatalog] = useState<{
    tools: Array<{ name: string; tier: string }>
    defaults: string[]
    presets: Array<{
      id: string
      name: string
      hasDanger: boolean
      unavailable?: string
      tools: Array<{ name: string; tier: string; selectable: boolean; reason?: string; blocksRun?: boolean }>
    }>
  } | null>(null)
  const [catalogNote, setCatalogNote] = useState('')
  const [selectedTools, setSelectedTools] = useState<string[] | null>(null)
  const [pendingDanger, setPendingDanger] = useState<string[]>([])
  const [presetId, setPresetId] = useState('')
  const [toolNote, setToolNote] = useState('')

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    setCatalog(null)
    setCatalogNote(workflowToolCopy.loading)
    void runtimeApi.listWorkflowTools(workspaceId).then((row) => {
      if (cancelled) return
      setCatalog({
        tools: Array.isArray(row.tools) ? row.tools : [],
        defaults: Array.isArray(row.defaults) ? row.defaults.filter((name) => typeof name === 'string' && name) : [],
        presets: Array.isArray(row.presets) ? row.presets : [],
      })
      setCatalogNote('')
    }).catch((error: unknown) => {
      if (cancelled) return
      setCatalog(null)
      setCatalogNote(error instanceof Error && error.message ? error.message : workflowToolCopy.unavailable)
    })
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  useEffect(() => {
    if (!showNew || !catalog || selectedTools) return
    const initial = catalog.defaults.filter((name) => workflowToolTier(catalog.tools.find((row) => row.name === name)?.tier || '') !== 'danger')
    setSelectedTools(initial)
  }, [showNew, catalog, selectedTools])

  function openNew() {
    setDraft(emptyWorkflowDraft())
    setSelectedTools(null)
    setPendingDanger([])
    setPresetId('')
    setToolNote('')
    setShowNew(true)
  }

  function applyPreset(id: string) {
    setPresetId(id)
    if (!id || !catalog) {
      setPendingDanger([])
      return
    }
    const preset = catalog.presets.find((row) => row.id === id)
    if (!preset) return
    if (preset.unavailable) {
      setPendingDanger([])
      setToolNote(`${preset.name} ${preset.unavailable}`)
      return
    }
    const selectable = preset.tools.filter((tool) => tool.selectable !== false && tool.blocksRun !== true)
    const danger = selectable.filter((tool) => workflowToolTier(tool.tier) === 'danger').map((tool) => tool.name)
    const safe = selectable.filter((tool) => workflowToolTier(tool.tier) !== 'danger').map((tool) => tool.name)
    setSelectedTools(safe)
    setPendingDanger(danger)
    const excluded = preset.tools.filter((tool) => tool.selectable === false).map((tool) => tool.name)
    const waiting = preset.tools.filter((tool) => tool.blocksRun === true).map((tool) => tool.name)
    const notes = []
    if (excluded.length > 0) notes.push(`${workflowToolCopy.excludedLabel} ${excluded.join('、')}`)
    if (waiting.length > 0) notes.push(`${workflowToolCopy.waitSkipped} ${waiting.join('、')}`)
    setToolNote(notes.join(' '))
  }

  function toggleTool(name: string, tier: 'read' | 'propose' | 'danger' | 'wait', checked: boolean) {
    if (tier === 'danger' && checked) {
      setPendingDanger([name])
      return
    }
    setPendingDanger((current) => current.filter((item) => item !== name))
    setSelectedTools((current) => {
      const list = current ?? []
      const next = checked ? (list.includes(name) ? list : [...list, name]) : list.filter((item) => item !== name)
      if (next.length === 0) {
        setToolNote(workflowToolCopy.emptyList)
        return list
      }
      setToolNote('')
      return next
    })
  }

  function confirmDangerTool() {
    if (pendingDanger.length === 0) return
    const names = pendingDanger
    setSelectedTools((current) => {
      const next = [...(current ?? [])]
      for (const name of names) {
        if (!next.includes(name)) next.push(name)
      }
      return next
    })
    setPendingDanger([])
    setToolNote('')
  }

  const visible = workflows.filter((w) => {
    if (filter !== 'all' && w.status !== filter) return false
    if (q && !w.name.includes(q) && !w.description.includes(q)) return false
    return true
  })

  function buildTrigger(): Workflow['trigger'] {
    switch (draft.triggerKind) {
      case 'cron': return { kind: 'cron', expr: draft.triggerExpr }
      case 'keyword': return { kind: 'keyword', patterns: draft.triggerPatterns.split(',').map((x) => x.trim()).filter(Boolean) }
      case 'event': return { kind: 'event', on: draft.triggerOn }
      default: return { kind: 'manual' }
    }
  }

  function submit() {
    if (!draft.name.trim()) return
    const prompt = draft.prompt.trim()
    const sourceRef = draft.sourceRef.trim()
    if (draft.stepKind === 'ai' && !prompt) return
    let confirmDanger: string[] | undefined
    let step: WorkflowStep
    if (draft.stepKind === 'ai') {
      if (!catalog) {
        setToolNote(catalogNote || workflowToolCopy.unavailable)
        return
      }
      const tools = selectedTools ?? []
      if (tools.length === 0) {
        setToolNote(workflowToolCopy.emptyList)
        return
      }
      const tiers = new Map(catalog.tools.map((row) => [row.name, workflowToolTier(row.tier)]))
      if (tools.some((name) => !tiers.has(name))) {
        setToolNote(workflowToolCopy.unavailable)
        return
      }
      confirmDanger = tools.filter((name) => tiers.get(name) === 'danger').sort()
      const config: WorkflowStep['config'] = presetId ? { prompt, tools, presetId } : { prompt, tools }
      if (sourceRef) config.sourceRef = sourceRef
      step = {
        id: uid('s'),
        kind: 'ai',
        label: 'AI',
        config,
      }
    } else {
      step = { id: uid('s'), kind: 'delay', label: '等待', config: {} }
    }
    void addWorkflow({
      name: draft.name.trim(),
      description: draft.description.trim() || '自动创建的工作流',
      category: draft.category,
      trigger: buildTrigger(),
      emoji: draft.emoji,
      status: 'paused',
      steps: [step],
    }, confirmDanger).then(() => {
      setDraft(emptyWorkflowDraft())
      setSelectedTools(null)
      setPendingDanger([])
      setPresetId('')
      setToolNote('')
      setShowNew(false)
    }).catch(() => undefined)
  }

  return (
    <div>
      <Card className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex border border-line rounded overflow-hidden">
            {[
              { k: 'all', label: '全部', count: workflows.length },
              { k: 'active', label: '已启用', count: workflows.filter((w) => w.status === 'active').length },
              { k: 'paused', label: '已暂停', count: workflows.filter((w) => w.status === 'paused').length },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setFilter(t.k as any)}
                className={clsx(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5',
                  filter === t.k ? 'bg-ink text-white' : 'hover:bg-surface-2 text-ink-muted',
                )}
              >
                {t.label}
                <span className={clsx('text-[11px] tabular-nums', filter === t.k ? 'text-white/70' : 'text-ink-subtle')}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input className="input pl-8 h-8 w-full" placeholder="搜索工作流" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex-1" />
          <button className="btn-primary" title="新建工作流" onClick={openNew}><Plus size={14} /> 新建</button>
        </div>
      </Card>

      {visible.length === 0 ? (
        <Empty title="没有匹配的工作流" hint="试试清空筛选,或新建一条工作流" />
      ) : (
        <div className="space-y-3">
          {visible.map((w) => {
            const words = workflowRunWords(w)
            const submitting = workflowRunSubmitIds.includes(w.id)
            return (
            <Card key={w.id}>
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">{w.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-medium">{w.name}</div>
                    {words.hold ? (
                      <Tag kind={w.status === 'active' ? 'green' : 'default'}>{words.hold}</Tag>
                    ) : null}
                    <Tag kind="blue">{w.category}</Tag>
                    {words.outcome ? (
                      <Tag kind={words.outcome === '成功' ? 'green' : words.outcome === '失败' ? 'red' : 'amber'}>
                        {words.outcome}
                      </Tag>
                    ) : null}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">{w.description}</div>
                  {/* trigger 信息 */}
                  <div className="mt-2 text-[11px] text-ink-muted font-mono bg-surface-2 px-2 py-1 rounded inline-block">
                    {w.trigger.kind === 'cron' && <>⏰ cron · {w.trigger.expr}{w.trigger.tz ? ` · ${w.trigger.tz}` : ''}</>}
                    {w.trigger.kind === 'keyword' && <>🔑 keyword · {w.trigger.patterns.join(', ')}</>}
                    {w.trigger.kind === 'event' && <>⚡ on {w.trigger.on}</>}
                    {w.trigger.kind === 'manual' && <>👆 手动触发</>}
                  </div>
                  {(w.trigger.kind === 'keyword' || w.trigger.kind === 'event') && (
                    <div className="mt-2 text-xs text-ink-muted">{SAVED_ONLY}</div>
                  )}
                  {/* 步骤时间线 */}
                  <div className="mt-3 flex items-center gap-1 flex-wrap">
                    {w.steps.map((s, i) => (
                      <span key={s.id} className="flex items-center gap-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-line">{s.label}</span>
                        {i < w.steps.length - 1 && <span className="text-ink-subtle">→</span>}
                      </span>
                    ))}
                  </div>
                  {w.steps.filter((s) => s.kind === 'ai').map((s) => {
                    const explicit = readStepTools(s)
                    const shown = explicit ?? (catalog?.defaults ?? [])
                    const fromPreset = readStepPreset(s)
                    const presetName = catalog?.presets.find((row) => row.id === fromPreset)?.name || fromPreset
                    return (
                      <div key={`${s.id}-tools`} className="mt-2 text-[11px] text-ink-muted">
                        {fromPreset ? <div>{workflowToolCopy.presetFrom} {presetName}</div> : null}
                        <div>
                          {workflowToolCopy.allowedLabel}{' '}
                          {shown.length === 0 ? workflowToolCopy.allowedUnknown : shown.join('、')}
                        </div>
                      </div>
                    )
                  })}
                  {w.lastRunAt && (
                    <div className="mt-2 text-[11px] text-ink-muted flex items-center gap-3 flex-wrap">
                      <span>上次运行: {new Date(w.lastRunAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    className="btn"
                    disabled={isHostJobId(w.id) || submitting}
                    title={isHostJobId(w.id) ? '不运行 Host job' : '运行'}
                    onClick={() => void runWorkflow(w.id)}
                  >
                    <Play size={12} /> {submitting ? '正在提交' : '运行'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleWorkflow(w.id)}
                    className="btn"
                    disabled={isHostJobId(w.id) && w.status !== 'active'}
                    title={isHostJobId(w.id)
                      ? (w.status === 'active' ? '暂停 Host job' : 'Host 没有启用这个动作')
                      : (w.status === 'active' ? '暂停' : '启用')}
                  >
                    <Power size={12} /> {w.status === 'active' ? '暂停' : '启用'}
                  </button>
                  <button onClick={() => void removeWorkflow(w.id)} className="btn-ghost p-1 text-ink-subtle hover:text-accent-red" title={isHostJobId(w.id) ? '停止 Host job' : '删除'}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
            )
          })}
        </div>
      )}

      <RightDrawer open={showNew} onClose={() => setShowNew(false)} title="新建工作流">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-muted">名称</label>
            <input className="input mt-1.5 w-full" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="例如:每日早报生成" />
          </div>
          <div>
            <label className="text-xs text-ink-muted">描述</label>
            <textarea className="input mt-1.5 w-full" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="这个工作流做什么…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-muted">分类</label>
              <select className="input mt-1.5 w-full" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Workflow['category'] })}>
                <option value="system">系统</option>
                <option value="data">数据</option>
                <option value="im">IM</option>
                <option value="file">文件</option>
                <option value="memory">记忆</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-muted">触发方式</label>
              <select className="input mt-1.5 w-full" value={draft.triggerKind} onChange={(e) => setDraft({ ...draft, triggerKind: e.target.value as Workflow['trigger']['kind'] })}>
                <option value="manual">手动</option>
                <option value="cron">定时</option>
                <option value="keyword">关键字</option>
                <option value="event">事件</option>
              </select>
            </div>
          </div>
          {draft.triggerKind === 'cron' && (
            <div>
              <label className="text-xs text-ink-muted">Cron 表达式</label>
              <input className="input mt-1.5 w-full font-mono" value={draft.triggerExpr} onChange={(e) => setDraft({ ...draft, triggerExpr: e.target.value })} placeholder="0 9 * * *" />
            </div>
          )}
          {draft.triggerKind === 'keyword' && (
            <div>
              <label className="text-xs text-ink-muted">触发关键字 (逗号分隔)</label>
              <input className="input mt-1.5 w-full" value={draft.triggerPatterns} onChange={(e) => setDraft({ ...draft, triggerPatterns: e.target.value })} placeholder="早报, 日报, 复盘" />
            </div>
          )}
          {draft.triggerKind === 'event' && (
            <div>
              <label className="text-xs text-ink-muted">触发事件</label>
              <select className="input mt-1.5 w-full" value={draft.triggerOn} onChange={(e) => setDraft({ ...draft, triggerOn: e.target.value as any })}>
                <option value="task.done">任务完成</option>
                <option value="file.save">文件保存</option>
                <option value="order.new">新订单</option>
                <option value="im.received">收到 IM</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-ink-muted">步骤</label>
            <select className="input mt-1.5 w-full" value={draft.stepKind} onChange={(e) => setDraft({ ...draft, stepKind: e.target.value === 'delay' ? 'delay' : 'ai' })}>
              <option value="ai">AI</option>
              <option value="delay">等待</option>
            </select>
          </div>
          {draft.stepKind === 'ai' && (
            <>
              <div>
                <label className="text-xs text-ink-muted">提示</label>
                <textarea className="input mt-1.5 w-full" rows={3} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} placeholder="这一步让 AI 做什么" />
              </div>
              <div>
                <label className="text-xs text-ink-muted">来源引用 (可选)</label>
                <input className="input mt-1.5 w-full" value={draft.sourceRef} onChange={(e) => setDraft({ ...draft, sourceRef: e.target.value })} placeholder="app:app_ 后接 32 位十六进制" />
              </div>
              {catalog ? (
                <>
                  <div>
                    <label className="text-xs text-ink-muted">{workflowToolCopy.presetLabel}</label>
                    <select className="input mt-1.5 w-full" value={presetId} onChange={(event) => applyPreset(event.target.value)}>
                      <option value="">{workflowToolCopy.presetNone}</option>
                      {catalog.presets.map((preset) => (
                        <option key={preset.id} value={preset.id} disabled={Boolean(preset.unavailable)}>{preset.name}</option>
                      ))}
                    </select>
                    {catalog.presets.filter((preset) => preset.unavailable).map((preset) => (
                      <div key={`${preset.id}-unavailable`} className="mt-1 text-xs text-ink-muted">{preset.name} {preset.unavailable}</div>
                    ))}
                  </div>
                  <WorkflowToolPicker
                    tools={catalog.tools}
                    selected={selectedTools ?? []}
                    pendingDanger={pendingDanger.length > 0 ? pendingDanger.join('、') : null}
                    note={toolNote}
                    onToggle={toggleTool}
                    onConfirmDanger={confirmDangerTool}
                    onCancelDanger={() => setPendingDanger([])}
                  />
                </>
              ) : (
                <div className="text-xs text-ink-muted">{catalogNote || workflowToolCopy.loading}</div>
              )}
            </>
          )}
          <div>
            <label className="text-xs text-ink-muted">图标</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {WORKFLOW_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setDraft({ ...draft, emoji })}
                  className={clsx('w-8 h-8 rounded border flex items-center justify-center text-lg', draft.emoji === emoji ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-2')}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-ink-muted p-3 rounded bg-surface-2 border border-line">
            新建后默认 paused，可到列表点击「启用」或「运行」。关键字和事件触发只保存。{SAVED_ONLY}
          </div>
          {showNew && planServiceError && (
            <div className="text-xs text-accent-red">{planServiceError}</div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button className="btn" onClick={() => setShowNew(false)}>取消</button>
            <button className="btn-primary" onClick={submit} disabled={draft.stepKind === 'ai' && pendingDanger.length > 0}>创建</button>
          </div>
        </div>
      </RightDrawer>
    </div>
  )
}

const uid = (p = 'x') => `${p}_${Math.random().toString(36).slice(2, 9)}`
