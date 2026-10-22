import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { WorkflowToolPicker } from '@/components/plan/WorkflowToolPicker'
import { isHostGoalId, isHostJobId, isHostScheduleId } from '@/lib/plan-origin'
import { RuntimeApiError, runtimeApi } from '@/lib/runtime-api'
import type { ScheduleEvent, Task, Workflow, WorkflowStep } from '@/lib/types'
import { readStepTools, workflowToolCopy, workflowToolTier } from '@/lib/workflow-tool-copy'
import { PLAN_DAY_HOURS } from '../../../runtime/plan/plan-day-hours.mjs'
import { useApp, useCurrentWorkflows } from '@/store/app'

function PlanDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-md h-full border-l border-line shadow-[-8px_0_32px_rgba(0,0,0,0.08)] rounded-l-xl p-5 overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
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

const WORKFLOW_EMOJIS = ['🤖', '⚡', '🔁', '📬', '📝', '🗃️', '📊', '🔔']

type EditTarget =
  | { kind: 'task'; row: Task }
  | { kind: 'event'; row: ScheduleEvent }
  | { kind: 'workflow'; row: Workflow }

function formatAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function clockChoices(current: number, base: number[]) {
  const values = base.includes(current) ? [...base] : [...base, current]
  return values.sort((left, right) => left - right)
}

function withClock(iso: string, hour: number, minute: number) {
  const date = new Date(iso)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function EditActions({
  saving,
  canSave,
  conflict,
  error,
  onClose,
  onSave,
  onReload,
  onOverwrite,
  onHistory,
}: {
  saving: boolean
  canSave: boolean
  conflict: boolean
  error: string
  onClose: () => void
  onSave: () => void
  onReload: () => void
  onOverwrite: () => void
  onHistory: () => void
}) {
  return (
    <div className="pt-4 border-t border-line space-y-3">
      {error ? <div className="text-xs text-accent-red">{error}</div> : null}
      {conflict ? (
        <div className="text-sm text-amber-900" data-plan-conflict>
          这条在你打开后被改过
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn" onClick={onReload} data-plan-reload>看最新</button>
            <button type="button" className="btn" onClick={onOverwrite} data-plan-overwrite>仍覆盖</button>
          </div>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost h-7 px-2 text-[11px]" onClick={onHistory}>查看历史</button>
        <button type="button" className="btn" onClick={onClose}>取消</button>
        <button type="button" className="btn-primary" disabled={!canSave || saving} onClick={onSave} data-plan-save>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}

function useEditSave(onClose: () => void, onReload: () => void) {
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function run(work: (force: boolean) => Promise<void>, force = false) {
    setSaving(true)
    setError('')
    if (!force) setConflict(false)
    try {
      await work(force)
      onClose()
    } catch (cause) {
      if (cause instanceof RuntimeApiError && cause.status === 409) setConflict(true)
      else setError(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return {
    conflict,
    error,
    saving,
    run,
    reload: () => {
      setConflict(false)
      setError('')
      onReload()
    },
  }
}

function TaskEdit({
  row,
  onClose,
  onOpenHistory,
  onReload,
}: {
  row: Task
  onClose: () => void
  onOpenHistory: () => void
  onReload: () => void
}) {
  const updateTask = useApp((state) => state.updateTask)
  const [base] = useState(row)
  const host = isHostGoalId(base.id)
  const save = useEditSave(onClose, onReload)
  const [title, setTitle] = useState(base.title)
  const [notes, setNotes] = useState(base.notes || '')
  const [status, setStatus] = useState(base.status)
  const [priority, setPriority] = useState(base.priority)
  const [due, setDue] = useState((base.due || '').slice(0, 10))
  const [tags, setTags] = useState(base.tags.join(', '))

  function patch() {
    const next: Partial<Task> = {}
    if (!host && title.trim() !== base.title) next.title = title.trim()
    if (!host && notes !== (base.notes || '')) next.notes = notes
    if (status !== base.status) next.status = status
    if (!host && priority !== base.priority) next.priority = priority
    if (!host && due !== (base.due || '').slice(0, 10)) next.due = due
    if (!host) {
      const nextTags = tags.split(',').map((item) => item.trim()).filter(Boolean)
      if (nextTags.join('\u0000') !== base.tags.join('\u0000')) next.tags = nextTags
    }
    return next
  }

  const next = patch()
  const canSave = host ? Boolean(next.status) : Boolean(title.trim()) && Object.keys(next).length > 0

  function submit(force: boolean) {
    const body = patch()
    if (!Object.keys(body).length) return
    const workspaceId = useApp.getState().activeWorkspaceId || undefined
    void save.run(async () => {
      await updateTask(base.id, { ...body, workspaceId }, force || !base.updatedAt ? undefined : { expectedUpdatedAt: base.updatedAt })
    }, force)
  }

  return (
    <div className="space-y-4">
      {host ? <div className="text-sm text-ink-muted" data-plan-host>来自 Host，只能改状态</div> : null}
      {base.updatedAt ? <div className="text-[11px] text-ink-muted">上次修改：{formatAt(base.updatedAt)}</div> : null}
      <div>
        <label className="text-xs text-ink-muted">标题</label>
        <input className="input mt-1.5 w-full" value={title} disabled={host} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div>
        <label className="text-xs text-ink-muted">备注</label>
        <textarea className="input mt-1.5 w-full" rows={3} value={notes} disabled={host} onChange={(event) => setNotes(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink-muted">状态</label>
          <select className="input mt-1.5 w-full" value={status} onChange={(event) => setStatus(event.target.value as Task['status'])}>
            <option value="todo">待办</option>
            <option value="doing">进行中</option>
            <option value="done">已完成</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-muted">优先级</label>
          <select className="input mt-1.5 w-full" value={priority} disabled={host} onChange={(event) => setPriority(event.target.value as Task['priority'])}>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="med">中</option>
            <option value="low">低</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-ink-muted">截止</label>
        <input type="date" className="input mt-1.5 w-full" value={due} disabled={host} onChange={(event) => setDue(event.target.value)} />
      </div>
      <div>
        <label className="text-xs text-ink-muted">标签 (逗号分隔)</label>
        <input className="input mt-1.5 w-full" value={tags} disabled={host} onChange={(event) => setTags(event.target.value)} />
      </div>
      <EditActions
        saving={save.saving}
        canSave={canSave}
        conflict={save.conflict}
        error={save.error}
        onClose={onClose}
        onSave={() => submit(false)}
        onReload={save.reload}
        onOverwrite={() => submit(true)}
        onHistory={onOpenHistory}
      />
    </div>
  )
}

function EventEdit({
  row,
  onClose,
  onOpenHistory,
  onReload,
}: {
  row: ScheduleEvent
  onClose: () => void
  onOpenHistory: () => void
  onReload: () => void
}) {
  const updateEvent = useApp((state) => state.updateEvent)
  const workflows = useCurrentWorkflows()
  const [base] = useState(row)
  const host = isHostScheduleId(base.id)
  const save = useEditSave(onClose, onReload)
  const start = new Date(base.start)
  const end = new Date(base.end)
  const [title, setTitle] = useState(base.title)
  const [startH, setStartH] = useState(start.getHours())
  const [startM, setStartM] = useState(start.getMinutes())
  const [endH, setEndH] = useState(end.getHours())
  const [endM, setEndM] = useState(end.getMinutes())
  const [kind, setKind] = useState(base.kind)
  const [location, setLocation] = useState(base.location || '')
  const [workflowId, setWorkflowId] = useState(base.workflowId || '')
  const [recurrence, setRecurrence] = useState<ScheduleEvent['recurrence']>(base.recurrence || 'once')
  const hours = clockChoices(start.getHours(), clockChoices(end.getHours(), [...PLAN_DAY_HOURS, 22]))
  const startMinutes = clockChoices(start.getMinutes(), [0, 15, 30, 45])
  const endMinutes = clockChoices(end.getMinutes(), [0, 15, 30, 45])

  function changed() {
    const patch: {
      title?: string
      start?: string
      end?: string
      kind?: ScheduleEvent['kind']
      location?: string
      workflowId?: string | null
      recurrence?: 'once' | 'daily' | null
    } = {}
    if (title.trim() !== base.title) patch.title = title.trim()
    if (startH !== start.getHours() || startM !== start.getMinutes()) patch.start = withClock(base.start, startH, startM)
    if (endH !== end.getHours() || endM !== end.getMinutes()) patch.end = withClock(base.end, endH, endM)
    if (kind !== base.kind) patch.kind = kind
    if (location.trim() !== (base.location || '')) patch.location = location.trim()
    const nextRecurrence = workflowId ? recurrence || 'once' : null
    const prevId = base.workflowId || ''
    const prevRecurrence = base.workflowId ? base.recurrence || 'once' : null
    if (workflowId !== prevId || nextRecurrence !== prevRecurrence) {
      patch.workflowId = workflowId || null
      patch.recurrence = nextRecurrence
    }
    return patch
  }

  const next = changed()
  const canSave = !host && Boolean(title.trim()) && Object.keys(next).length > 0

  function submit(force: boolean) {
    const body = changed()
    if (!Object.keys(body).length) return
    void save.run(async () => {
      await updateEvent(base.id, body, force || !base.updatedAt ? undefined : { expectedUpdatedAt: base.updatedAt })
    }, force)
  }

  return (
    <div className="space-y-4">
      {host ? <div className="text-sm text-ink-muted" data-plan-host>来自 Host，不能在这里改</div> : null}
      {base.updatedAt ? <div className="text-[11px] text-ink-muted">上次修改：{formatAt(base.updatedAt)}</div> : null}
      <div>
        <label className="text-xs text-ink-muted">标题</label>
        <input className="input mt-1.5 w-full" value={title} disabled={host} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink-muted">开始</label>
          <div className="flex gap-1 mt-1.5">
            <select className="input flex-1" value={startH} disabled={host} onChange={(event) => setStartH(Number(event.target.value))}>
              {hours.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
            </select>
            <select className="input flex-1" value={startM} disabled={host} onChange={(event) => setStartM(Number(event.target.value))}>
              {startMinutes.map((minute) => <option key={minute} value={minute}>{minute.toString().padStart(2, '0')}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-ink-muted">结束</label>
          <div className="flex gap-1 mt-1.5">
            <select className="input flex-1" value={endH} disabled={host} onChange={(event) => setEndH(Number(event.target.value))}>
              {hours.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
            </select>
            <select className="input flex-1" value={endM} disabled={host} onChange={(event) => setEndM(Number(event.target.value))}>
              {endMinutes.map((minute) => <option key={minute} value={minute}>{minute.toString().padStart(2, '0')}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs text-ink-muted">{workflowToolCopy.scheduleWorkflow}</label>
        <select className="input mt-1.5 w-full" value={workflowId} disabled={host} onChange={(event) => setWorkflowId(event.target.value)}>
          <option value="">{workflowToolCopy.scheduleNone}</option>
          {workflows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      {workflowId ? (
        <div>
          <label className="text-xs text-ink-muted">{workflowToolCopy.scheduleRecurrence}</label>
          <select className="input mt-1.5 w-full" value={recurrence} disabled={host} onChange={(event) => setRecurrence(event.target.value === 'daily' ? 'daily' : 'once')}>
            <option value="once">{workflowToolCopy.scheduleOnce}</option>
            <option value="daily">{workflowToolCopy.scheduleDaily}</option>
          </select>
        </div>
      ) : null}
      <div>
        <label className="text-xs text-ink-muted">类型</label>
        <select className="input mt-1.5 w-full" value={kind} disabled={host} onChange={(event) => setKind(event.target.value as ScheduleEvent['kind'])}>
          <option value="focus">深聊 / 专注</option>
          <option value="meeting">会议</option>
          <option value="reminder">提醒</option>
          <option value="external">外部</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-ink-muted">地点</label>
        <input className="input mt-1.5 w-full" value={location} disabled={host} onChange={(event) => setLocation(event.target.value)} />
      </div>
      <EditActions
        saving={save.saving}
        canSave={canSave}
        conflict={save.conflict}
        error={save.error}
        onClose={onClose}
        onSave={() => submit(false)}
        onReload={save.reload}
        onOverwrite={() => submit(true)}
        onHistory={onOpenHistory}
      />
    </div>
  )
}

function triggerOf(row: Workflow, draft: {
  triggerKind: Workflow['trigger']['kind']
  triggerExpr: string
  triggerPatterns: string
  triggerOn: 'task.done' | 'file.save' | 'order.new' | 'im.received'
}): Workflow['trigger'] {
  if (draft.triggerKind === 'cron') {
    const tz = row.trigger.kind === 'cron' ? row.trigger.tz : undefined
    return tz ? { kind: 'cron', expr: draft.triggerExpr, tz } : { kind: 'cron', expr: draft.triggerExpr }
  }
  if (draft.triggerKind === 'keyword') {
    return { kind: 'keyword', patterns: draft.triggerPatterns.split(',').map((item) => item.trim()).filter(Boolean) }
  }
  if (draft.triggerKind === 'event') return { kind: 'event', on: draft.triggerOn }
  return { kind: 'manual' }
}

function WorkflowEdit({
  row,
  onClose,
  onOpenHistory,
  onReload,
}: {
  row: Workflow
  onClose: () => void
  onOpenHistory: () => void
  onReload: () => void
}) {
  const updateWorkflow = useApp((state) => state.updateWorkflow)
  const workspaceId = useApp((state) => state.activeWorkspaceId)
  const [base] = useState(row)
  const host = isHostJobId(base.id)
  const save = useEditSave(onClose, onReload)
  const aiStep = base.steps.find((step) => step.kind === 'ai') ?? null
  const originalTools = aiStep ? readStepTools(aiStep) : null
  const [name, setName] = useState(base.name)
  const [description, setDescription] = useState(base.description)
  const [status, setStatus] = useState(base.status)
  const [category, setCategory] = useState(base.category)
  const [emoji, setEmoji] = useState(base.emoji)
  const [triggerKind, setTriggerKind] = useState(base.trigger.kind)
  const [triggerExpr, setTriggerExpr] = useState(base.trigger.kind === 'cron' ? base.trigger.expr : '0 9 * * *')
  const [triggerPatterns, setTriggerPatterns] = useState(base.trigger.kind === 'keyword' ? base.trigger.patterns.join(', ') : '')
  const [triggerOn, setTriggerOn] = useState(base.trigger.kind === 'event' ? base.trigger.on : 'task.done' as const)
  const [prompt, setPrompt] = useState(aiStep && typeof aiStep.config.prompt === 'string' ? aiStep.config.prompt : '')
  const [showTools, setShowTools] = useState(Boolean(originalTools))
  const [toolsDirty, setToolsDirty] = useState(false)
  const [selectedTools, setSelectedTools] = useState<string[]>(originalTools ?? [])
  const [pendingDanger, setPendingDanger] = useState<string[]>([])
  const [toolNote, setToolNote] = useState('')
  const [catalog, setCatalog] = useState<{ tools: Array<{ name: string; tier: string }> } | null>(null)
  const [catalogNote, setCatalogNote] = useState('')

  useEffect(() => {
    if (!workspaceId || host) return
    let cancelled = false
    setCatalogNote(workflowToolCopy.loading)
    void runtimeApi.listWorkflowTools(workspaceId).then((list) => {
      if (cancelled) return
      setCatalog({ tools: Array.isArray(list.tools) ? list.tools : [] })
      setCatalogNote('')
    }).catch((cause: unknown) => {
      if (cancelled) return
      setCatalog(null)
      setCatalogNote(cause instanceof Error && cause.message ? cause.message : workflowToolCopy.unavailable)
    })
    return () => {
      cancelled = true
    }
  }, [workspaceId, host])

  function toggleTool(toolName: string, tier: 'read' | 'propose' | 'danger' | 'wait', checked: boolean) {
    if (tier === 'danger' && checked) {
      setPendingDanger([toolName])
      return
    }
    setPendingDanger((current) => current.filter((item) => item !== toolName))
    setToolsDirty(true)
    setSelectedTools((current) => {
      const next = checked ? (current.includes(toolName) ? current : [...current, toolName]) : current.filter((item) => item !== toolName)
      if (next.length === 0) {
        setToolNote(workflowToolCopy.emptyList)
        return current
      }
      setToolNote('')
      return next
    })
  }

  function confirmDangerTool() {
    if (pendingDanger.length === 0) return
    const names = pendingDanger
    setToolsDirty(true)
    setSelectedTools((current) => {
      const next = [...current]
      for (const toolName of names) {
        if (!next.includes(toolName)) next.push(toolName)
      }
      return next
    })
    setPendingDanger([])
    setToolNote('')
  }

  function nextTrigger() {
    return triggerOf(base, { triggerKind, triggerExpr, triggerPatterns, triggerOn })
  }

  function nextSteps() {
    if (!aiStep) return null
    const promptChanged = prompt !== (typeof aiStep.config.prompt === 'string' ? aiStep.config.prompt : '')
    if (!promptChanged && !toolsDirty) return null
    const tools = toolsDirty ? selectedTools : originalTools
    return base.steps.map((step) => {
      if (step.id !== aiStep.id) return step
      const config: WorkflowStep['config'] = { ...step.config, prompt: prompt.trim() }
      if (tools) config.tools = tools
      return { ...step, kind: step.kind, label: step.label, id: step.id, config }
    })
  }

  function changed() {
    const patch: {
      name?: string
      description?: string
      status?: Workflow['status']
      category?: Workflow['category']
      emoji?: string
      trigger?: Workflow['trigger']
      steps?: Workflow['steps']
    } = {}
    if (host) {
      if (base.status === 'active' && status === 'paused') patch.status = 'paused'
      return patch
    }
    if (name.trim() !== base.name) patch.name = name.trim()
    if (description !== base.description) patch.description = description
    if (status !== base.status) patch.status = status
    if (category !== base.category) patch.category = category
    if (emoji !== base.emoji) patch.emoji = emoji
    if (JSON.stringify(nextTrigger()) !== JSON.stringify(base.trigger)) patch.trigger = nextTrigger()
    const steps = nextSteps()
    if (steps) patch.steps = steps
    return patch
  }

  const next = changed()
  const canSave = host
    ? Boolean(next.status)
    : Boolean(name.trim()) && pendingDanger.length === 0 && Object.keys(next).length > 0

  function submit(force: boolean) {
    const body = changed()
    if (!Object.keys(body).length) return
    const tools = body.steps?.some((step) => step.config && Object.prototype.hasOwnProperty.call(step.config, 'tools'))
    let confirmDanger: string[] | undefined
    if (tools) {
      if (!catalog) {
        save.run(async () => {
          throw new Error(catalogNote || workflowToolCopy.unavailable)
        })
        return
      }
      const chosen = body.steps?.flatMap((step) => (Array.isArray(step.config.tools) ? step.config.tools : [])) ?? []
      const tiers = new Map(catalog.tools.map((item) => [item.name, workflowToolTier(item.tier)]))
      if (chosen.some((toolName) => !tiers.has(toolName)) || chosen.length === 0) {
        save.run(async () => {
          throw new Error(chosen.length === 0 ? workflowToolCopy.emptyList : workflowToolCopy.unavailable)
        })
        return
      }
      confirmDanger = chosen.filter((toolName) => tiers.get(toolName) === 'danger').sort()
    }
    void save.run(async () => {
      await updateWorkflow(
        base.id,
        body,
        {
          ...(force || !base.updatedAt ? {} : { expectedUpdatedAt: base.updatedAt }),
          ...(confirmDanger ? { confirmDanger } : {}),
        },
      )
    }, force)
  }

  return (
    <div className="space-y-4">
      {host ? <div className="text-sm text-ink-muted" data-plan-host>来自 Host，只能暂停</div> : null}
      {base.updatedAt ? <div className="text-[11px] text-ink-muted">上次修改：{formatAt(base.updatedAt)}</div> : null}
      <div>
        <label className="text-xs text-ink-muted">名称</label>
        <input className="input mt-1.5 w-full" value={name} disabled={host} onChange={(event) => setName(event.target.value)} />
      </div>
      <div>
        <label className="text-xs text-ink-muted">描述</label>
        <textarea className="input mt-1.5 w-full" rows={3} value={description} disabled={host} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink-muted">状态</label>
          <select
            className="input mt-1.5 w-full"
            value={status}
            disabled={host && base.status !== 'active'}
            onChange={(event) => setStatus(event.target.value === 'active' ? 'active' : 'paused')}
          >
            <option value="paused">已暂停</option>
            {host ? null : <option value="active">已启用</option>}
            {host && base.status === 'active' ? <option value="active">已启用</option> : null}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-muted">分类</label>
          <select className="input mt-1.5 w-full" value={category} disabled={host} onChange={(event) => setCategory(event.target.value as Workflow['category'])}>
            <option value="system">系统</option>
            <option value="data">数据</option>
            <option value="im">IM</option>
            <option value="file">文件</option>
            <option value="memory">记忆</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-ink-muted">触发方式</label>
        <select className="input mt-1.5 w-full" value={triggerKind} disabled={host} onChange={(event) => setTriggerKind(event.target.value as Workflow['trigger']['kind'])}>
          <option value="manual">手动</option>
          <option value="cron">定时</option>
          <option value="keyword">关键字</option>
          <option value="event">事件</option>
        </select>
      </div>
      {triggerKind === 'cron' ? (
        <div>
          <label className="text-xs text-ink-muted">Cron 表达式</label>
          <input className="input mt-1.5 w-full font-mono" value={triggerExpr} disabled={host} onChange={(event) => setTriggerExpr(event.target.value)} />
        </div>
      ) : null}
      {triggerKind === 'keyword' ? (
        <div>
          <label className="text-xs text-ink-muted">触发关键字 (逗号分隔)</label>
          <input className="input mt-1.5 w-full" value={triggerPatterns} disabled={host} onChange={(event) => setTriggerPatterns(event.target.value)} />
        </div>
      ) : null}
      {triggerKind === 'event' ? (
        <div>
          <label className="text-xs text-ink-muted">触发事件</label>
          <select className="input mt-1.5 w-full" value={triggerOn} disabled={host} onChange={(event) => setTriggerOn(event.target.value as 'task.done' | 'file.save' | 'order.new' | 'im.received')}>
            <option value="task.done">任务完成</option>
            <option value="file.save">文件保存</option>
            <option value="order.new">新订单</option>
            <option value="im.received">收到 IM</option>
          </select>
        </div>
      ) : null}
      {aiStep ? (
        <div>
          <label className="text-xs text-ink-muted">提示</label>
          <textarea className="input mt-1.5 w-full" rows={3} value={prompt} disabled={host} onChange={(event) => setPrompt(event.target.value)} />
        </div>
      ) : null}
      {!host && aiStep && showTools && catalog ? (
        <WorkflowToolPicker
          tools={catalog.tools}
          selected={selectedTools}
          pendingDanger={pendingDanger.length > 0 ? pendingDanger.join('、') : null}
          note={toolNote}
          onToggle={toggleTool}
          onConfirmDanger={confirmDangerTool}
          onCancelDanger={() => setPendingDanger([])}
        />
      ) : null}
      {!host && aiStep && showTools && !catalog ? <div className="text-xs text-ink-muted">{catalogNote || workflowToolCopy.loading}</div> : null}
      {!host && aiStep && !showTools ? (
        <button type="button" className="btn" onClick={() => setShowTools(true)}>改工具</button>
      ) : null}
      <div>
        <label className="text-xs text-ink-muted">图标</label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {WORKFLOW_EMOJIS.map((item) => (
            <button
              key={item}
              type="button"
              disabled={host}
              onClick={() => setEmoji(item)}
              className={clsx('w-8 h-8 rounded border flex items-center justify-center text-lg', emoji === item ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-2')}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <EditActions
        saving={save.saving}
        canSave={canSave}
        conflict={save.conflict}
        error={save.error}
        onClose={onClose}
        onSave={() => submit(false)}
        onReload={save.reload}
        onOverwrite={() => submit(true)}
        onHistory={onOpenHistory}
      />
    </div>
  )
}

export function PlanEditDrawer({
  target,
  epoch,
  onClose,
  onOpenHistory,
  onReload,
}: {
  target: EditTarget | null
  epoch: number
  onClose: () => void
  onOpenHistory: () => void
  onReload: () => void
}) {
  const tasks = useApp((state) => state.tasks)
  const events = useApp((state) => state.events)
  const workflows = useApp((state) => state.workflows)
  const live = !target
    ? null
    : target.kind === 'task'
      ? tasks.find((row) => row.id === target.row.id) ?? target.row
      : target.kind === 'event'
        ? events.find((row) => row.id === target.row.id) ?? target.row
        : workflows.find((row) => row.id === target.row.id) ?? target.row
  const title = target?.kind === 'event' ? '编辑日程' : target?.kind === 'workflow' ? '编辑工作流' : '编辑待办'
  const formKey = live ? `${target?.kind}:${live.id}:${epoch}` : 'closed'
  return (
    <PlanDrawer open={Boolean(target && live)} onClose={onClose} title={title}>
      {target?.kind === 'task' && live && 'status' in live && 'priority' in live ? (
        <TaskEdit key={formKey} row={live as Task} onClose={onClose} onOpenHistory={onOpenHistory} onReload={onReload} />
      ) : null}
      {target?.kind === 'event' && live && 'start' in live ? (
        <EventEdit key={formKey} row={live as ScheduleEvent} onClose={onClose} onOpenHistory={onOpenHistory} onReload={onReload} />
      ) : null}
      {target?.kind === 'workflow' && live && 'steps' in live ? (
        <WorkflowEdit key={formKey} row={live as Workflow} onClose={onClose} onOpenHistory={onOpenHistory} onReload={onReload} />
      ) : null}
    </PlanDrawer>
  )
}
