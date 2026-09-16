// 任务模块:列表 + Tab(状态)+ 过滤器 + 新建表单 + 行内状态切换
import { useState, useMemo } from 'react'
import {
  Plus, Circle, CheckCircle2, CircleDot, Archive, Search, Filter, X, Trash2, ChevronDown,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import type { Task } from '@/lib/types'
import { PageTitle, Card, Tag, Empty } from '@/components/ui'

const STATUSES = [
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

export default function Tasks() {
  const tasks = useApp((s) => s.tasks)
  const addTask = useApp((s) => s.addTask)
  const updateTask = useApp((s) => s.updateTask)
  const removeTask = useApp((s) => s.removeTask)
  const cycleStatus = useApp((s) => s.cycleTaskStatus)

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
      if (tab !== 'todo' && tab !== 'doing' && tab !== 'done' && tab !== 'archived') return false
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
    addTask({
      title: draft.title,
      priority: draft.priority,
      due: draft.due || undefined,
      tags: draft.tags,
      status: 'todo',
    })
    setDraft({ title: '', priority: 'med', due: '', tags: [] })
    setShowNew(false)
  }

  return (
    <div>
      <PageTitle
        title="任务"
        subtitle="把待办看作「明日还剩什么」,而不是「今天还有多少」。"
        actions={
          <>
            <button className="btn"><Filter size={14} /> 视图</button>
            <button className="btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> 新建任务</button>
          </>
        }
      />

      {/* Tab + 过滤 */}
      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            {STATUSES.map((s) => (
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
              <input
                className="input pl-8 h-8 w-44"
                placeholder="搜索任务"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="relative">
              <select
                className="input h-8 pr-8 text-sm appearance-none"
                value={tag ?? ''}
                onChange={(e) => setTag(e.target.value || null)}
              >
                <option value="">所有标签</option>
                {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
            </div>
          </div>
        </div>
      </Card>

      {/* 任务表格 */}
      {filtered.length === 0 ? (
        <Empty title="这个筛选下没有任务" hint="可以新建一个,或切换其它 Tab" action={
          <button className="btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> 新建任务</button>
        } />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted border-b border-line">
                <th className="w-10 px-4 py-2.5"></th>
                <th className="px-2 py-2.5">任务</th>
                <th className="w-24 px-2 py-2.5">优先级</th>
                <th className="w-28 px-2 py-2.5">截止</th>
                <th className="w-44 px-2 py-2.5">标签</th>
                <th className="w-12 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/40">
                  <td className="pl-4 pr-1 py-2.5 align-top">
                    <button
                      onClick={() => cycleStatus(t.id)}
                      className="text-ink-muted hover:text-brand"
                      title="切换状态"
                    >
                      {t.status === 'done' && <CheckCircle2 size={16} className="text-brand" />}
                      {t.status === 'doing' && <CircleDot size={16} className="text-accent-amber" />}
                      {t.status === 'todo'  && <Circle size={16} />}
                      {t.status === 'archived' && <Archive size={16} className="text-ink-subtle" />}
                    </button>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="font-medium">{t.title}</div>
                    {t.notes && <div className="text-xs text-ink-muted mt-0.5">{t.notes}</div>}
                  </td>
                  <td className="px-2 py-2.5">
                    <Tag kind={PRIORITY_TAG[t.priority].kind}>{PRIORITY_TAG[t.priority].label}</Tag>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-ink-muted">
                    {t.due ?? '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {t.tags.map((g) => <Tag key={g}>#{g}</Tag>)}
                    </div>
                  </td>
                  <td className="pr-4 py-2.5">
                    <button
                      onClick={() => removeTask(t.id)}
                      className="btn-ghost p-1 text-ink-subtle hover:text-accent-red"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* 新建抽屉 */}
      {showNew && (
        <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={() => setShowNew(false)}>
          <div className="bg-surface w-[420px] h-full border-l border-line p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">新建任务</h3>
              <button className="btn-ghost p-1" onClick={() => setShowNew(false)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-muted">标题</label>
                <input
                  className="input mt-1"
                  value={draft.title}
                  autoFocus
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="例如:完成 scene#39 demo"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-muted">优先级</label>
                  <select
                    className="input mt-1"
                    value={draft.priority}
                    onChange={(e) => setDraft({ ...draft, priority: e.target.value as Task['priority'] })}
                  >
                    <option value="urgent">紧急</option>
                    <option value="high">高</option>
                    <option value="med">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-ink-muted">截止</label>
                  <input
                    type="date"
                    className="input mt-1"
                    value={draft.due}
                    onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-muted">标签 (逗号分隔)</label>
                <input
                  className="input mt-1"
                  placeholder="例如: scene, prototype"
                  value={draft.tags.join(', ')}
                  onChange={(e) =>
                    setDraft({ ...draft, tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button className="btn" onClick={() => setShowNew(false)}>取消</button>
                <button className="btn-primary" onClick={submit}>创建</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
