// 计划模块:三 Tab 合并 —— 待办 / 日程 / 工作流
import { useState, useMemo, useEffect, type ReactNode } from 'react'
import {
  Plus, Circle, CheckCircle2, CircleDot, Archive, Search, Filter, X, Trash2, ChevronDown,
  Clock, MapPin, Calendar as CalIcon, Repeat, Zap, Play, Power,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp, useCurrentWorkflows, useCurrentTasks } from '@/store/app'
import type { Task, ScheduleEvent, Workflow, WorkflowStep } from '@/lib/types'
import { Card, Tag, Empty, PageTitle } from '@/components/ui'

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

  useEffect(() => {
    if (activeWorkspaceId) void hydratePlan(activeWorkspaceId)
  }, [activeWorkspaceId, hydratePlan])

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
          <div className="flex border border-line rounded overflow-hidden">
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

function TodoTab() {
  const tasks = useCurrentTasks()
  const addTask = useApp((s) => s.addTask)
  const removeTask = useApp((s) => s.removeTask)
  const cycleStatus = useApp((s) => s.cycleTaskStatus)
  const selectedTaskId = useApp((s) => s.selectedTaskId)

  const [tab, setTab] = useState<Task['status']>('todo')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<Pick<Task, 'title'|'priority'|'due'|'tags'>>({
    title: '', priority: 'med', due: '', tags: [],
  })

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
          </div>
        </div>
      </Card>

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
            <div key={t.id} className={clsx(
              'min-w-[280px] grid grid-cols-[28px_minmax(0,1fr)_28px] @md:grid-cols-[28px_minmax(0,1fr)_80px_60px_28px] @xl:grid-cols-[28px_minmax(0,1fr)_96px_64px_minmax(0,1.2fr)_28px] items-center px-3 py-2.5 border-b border-line last:border-b-0 hover:bg-surface-2/40 group',
              selectedTaskId === t.id && 'bg-brand-soft/40 ring-1 ring-brand/30',
            )}>
              <button onClick={() => void cycleStatus(t.id)} className="text-ink-muted hover:text-brand flex items-center justify-center" title="切换状态">
                {t.status === 'done' && <CheckCircle2 size={16} className="text-brand" />}
                {t.status === 'doing' && <CircleDot size={16} className="text-accent-amber" />}
                {t.status === 'todo'  && <Circle size={16} />}
                {t.status === 'archived' && <Archive size={16} className="text-ink-subtle" />}
              </button>
              <div className="min-w-0 px-2">
                <div className="font-medium text-sm truncate">{t.title}</div>
                {t.notes && <div className="text-xs text-ink-muted mt-0.5 truncate">{t.notes}</div>}
              </div>
              <div className="hidden @md:block text-xs text-ink-muted truncate">{t.due ?? '—'}</div>
              <div className="hidden @md:block"><Tag kind={PRIORITY_TAG[t.priority].kind}>{PRIORITY_TAG[t.priority].label}</Tag></div>
              <div className="hidden @xl:flex gap-1 flex-wrap min-w-0 overflow-hidden"><div className="flex gap-1 flex-wrap">{t.tags.slice(0, 2).map((g) => <Tag key={g}>#{g}</Tag>)}{t.tags.length > 2 && <Tag>+{t.tags.length - 2}</Tag>}</div></div>
              <button onClick={() => void removeTask(t.id)} className="btn-ghost p-1 text-ink-subtle hover:text-accent-red flex items-center justify-center" title="删除">
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
    </div>
  )
}

// =======================================================
// Tab 2: 日程
// =======================================================
const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i)

const KIND_TONE: Record<ScheduleEvent['kind'], { bg: string; tag: 'blue'|'green'|'amber'|'purple' }> = {
  meeting:  { bg: 'bg-blue-50 border-blue-200 text-accent-blue',     tag: 'blue' },
  focus:    { bg: 'bg-brand-soft border-brand/30 text-brand',       tag: 'green' },
  reminder: { bg: 'bg-amber-50 border-amber-200 text-accent-amber', tag: 'amber' },
  external: { bg: 'bg-purple-50 border-purple-200 text-accent-purple', tag: 'purple' },
}

function ScheduleTab() {
  const events = useApp((s) => s.events)
  const addEvent = useApp((s) => s.addEvent)
  const removeEvent = useApp((s) => s.removeEvent)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [openNew, setOpenNew] = useState(false)
  const [draft, setDraft] = useState({
    title: '', startH: 14, startM: 0, endH: 14, endM: 30,
    kind: 'focus' as ScheduleEvent['kind'], location: '',
  })

  const todayKey = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
  const todays = useMemo(() => events.filter((e) => todayKey(e.start)), [events])

  function toPos(start: string) {
    const d = new Date(start)
    return d.getHours() * 60 + d.getMinutes()
  }
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

  function submit() {
    if (!draft.title.trim()) return
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    base.setHours(draft.startH, draft.startM, 0, 0)
    const end = new Date(base)
    end.setHours(draft.endH, draft.endM, 0, 0)
    void addEvent({ title: draft.title, start: base.toISOString(), end: end.toISOString(), kind: draft.kind, location: draft.location || undefined })
      .then(() => {
        setDraft({ title: '', startH: 14, startM: 0, endH: 14, endM: 30, kind: 'focus', location: '' })
        setOpenNew(false)
      })
      .catch(() => undefined)
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
                <div className="absolute left-0 right-0" style={{ top: `${4.5 * 56 + 14}px` }}>
                  <span className="absolute -left-1 -top-1.5 w-2 h-2 rounded-full bg-accent-red" />
                  <span className="block h-px bg-accent-red" />
                </div>
                {todays.map((e) => {
                  const startMin = toPos(e.start) - 7 * 60
                  const endMin = toPos(e.end) - 7 * 60
                  const top = (startMin / 60) * 56
                  const height = ((endMin - startMin) / 60) * 56
                  return (
                    <div key={e.id} className={clsx('absolute left-2 right-2 rounded border px-2 py-1.5 text-xs overflow-hidden', KIND_TONE[e.kind].bg)} style={{ top, height: Math.max(height, 24) }}>
                      <div className="font-medium truncate">{e.title}</div>
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
                    </div>
                    <button className="btn-ghost p-1 text-ink-subtle hover:text-accent-red opacity-0 group-hover:opacity-100" onClick={() => void removeEvent(e.id)}>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-muted">开始</label>
              <div className="flex gap-1 mt-1.5">
                <select className="input flex-1" value={draft.startH} onChange={(e) => setDraft({ ...draft, startH: Number(e.target.value) })}>
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  <option value={21}>21</option><option value={22}>22</option>
                </select>
                <select className="input flex-1" value={draft.startM} onChange={(e) => setDraft({ ...draft, startM: Number(e.target.value) })}>
                  {[0,15,30,45].map((m) => <option key={m} value={m}>{m.toString().padStart(2,'0')}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-ink-muted">结束</label>
              <div className="flex gap-1 mt-1.5">
                <select className="input flex-1" value={draft.endH} onChange={(e) => setDraft({ ...draft, endH: Number(e.target.value) })}>
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  <option value={21}>21</option><option value={22}>22</option>
                </select>
                <select className="input flex-1" value={draft.endM} onChange={(e) => setDraft({ ...draft, endM: Number(e.target.value) })}>
                  {[0,15,30,45].map((m) => <option key={m} value={m}>{m.toString().padStart(2,'0')}</option>)}
                </select>
              </div>
            </div>
          </div>
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
            <button className="btn-primary" onClick={submit}>创建</button>
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

function WorkflowTab() {
  const workflows = useCurrentWorkflows()
  const toggleWorkflow = useApp((s) => s.toggleWorkflow)
  const removeWorkflow = useApp((s) => s.removeWorkflow)
  const addWorkflow = useApp((s) => s.addWorkflow)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | Workflow['status']>('all')
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<{
    name: string
    description: string
    category: Workflow['category']
    triggerKind: Workflow['trigger']['kind']
    triggerExpr: string
    triggerPatterns: string
    triggerOn: 'task.done' | 'file.save' | 'order.new' | 'im.received'
    emoji: string
  }>({
    name: '',
    description: '',
    category: 'system',
    triggerKind: 'manual',
    triggerExpr: '0 9 * * *',
    triggerPatterns: '',
    triggerOn: 'task.done',
    emoji: '🤖',
  })

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
    const steps: WorkflowStep[] = [
      { id: uid('s'), kind: 'delay', label: '本版不自动跑 AI 或记忆', config: {} },
    ]
    void addWorkflow({
      name: draft.name.trim(),
      description: draft.description.trim() || '自动创建的工作流',
      category: draft.category,
      trigger: buildTrigger(),
      emoji: draft.emoji,
      status: 'paused',
      steps,
    }).then(() => {
      setDraft({
        name: '', description: '', category: 'system', triggerKind: 'manual',
        triggerExpr: '0 9 * * *', triggerPatterns: '', triggerOn: 'task.done', emoji: '🤖',
      })
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
              { k: 'active', label: '运行中', count: workflows.filter((w) => w.status === 'active').length },
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
          <button className="btn-primary" title="新建工作流" onClick={() => setShowNew(true)}><Plus size={14} /> 新建</button>
        </div>
      </Card>

      {visible.length === 0 ? (
        <Empty title="没有匹配的工作流" hint="试试清空筛选,或新建一条工作流" />
      ) : (
        <div className="space-y-3">
          {visible.map((w) => (
            <Card key={w.id}>
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">{w.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-medium">{w.name}</div>
                    <Tag kind={w.status === 'active' ? 'green' : 'default'}>{w.status === 'active' ? '运行中' : '已暂停'}</Tag>
                    <Tag kind="blue">{w.category}</Tag>
                    {w.lastRunStatus && (
                      <Tag kind={w.lastRunStatus === 'success' ? 'green' : w.lastRunStatus === 'failed' ? 'red' : 'amber'}>
                        {w.lastRunStatus === 'running' && <Zap size={10} className="inline mr-0.5" />}
                        {w.lastRunStatus}
                      </Tag>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">{w.description}</div>
                  {/* trigger 信息 */}
                  <div className="mt-2 text-[11px] text-ink-muted font-mono bg-surface-2 px-2 py-1 rounded inline-block">
                    {w.trigger.kind === 'cron' && <>⏰ cron · {w.trigger.expr}{w.trigger.tz ? ` · ${w.trigger.tz}` : ''}</>}
                    {w.trigger.kind === 'keyword' && <>🔑 keyword · {w.trigger.patterns.join(', ')}</>}
                    {w.trigger.kind === 'event' && <>⚡ on {w.trigger.on}</>}
                    {w.trigger.kind === 'manual' && <>👆 手动触发</>}
                  </div>
                  {/* 步骤时间线 */}
                  <div className="mt-3 flex items-center gap-1 flex-wrap">
                    {w.steps.map((s, i) => (
                      <span key={s.id} className="flex items-center gap-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-line">{s.label}</span>
                        {i < w.steps.length - 1 && <span className="text-ink-subtle">→</span>}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-ink-muted flex items-center gap-3">
                    {w.lastRunAt && (
                      <span>上次运行: {new Date(w.lastRunAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button type="button" className="btn" disabled title="本版不自动运行"><Play size={12} /> 运行</button>
                  <button
                    type="button"
                    onClick={() => void toggleWorkflow(w.id)}
                    className="btn"
                    title={w.status === 'active' ? '暂停' : '启用'}
                  >
                    <Power size={12} /> {w.status === 'active' ? '暂停' : '启用'}
                  </button>
                  <button onClick={() => void removeWorkflow(w.id)} className="btn-ghost p-1 text-ink-subtle hover:text-accent-red" title="删除">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
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
            新建后默认 paused，可到列表点击「启用」。本版不自动运行。
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-line">
            <button className="btn" onClick={() => setShowNew(false)}>取消</button>
            <button className="btn-primary" onClick={submit}>创建</button>
          </div>
        </div>
      </RightDrawer>
    </div>
  )
}

const uid = (p = 'x') => `${p}_${Math.random().toString(36).slice(2, 9)}`
