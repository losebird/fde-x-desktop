import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { revealAi } from '@/lib/open-ref'
import { RuntimeApiError, runtimeApi, type PlanHistoryEntry } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

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

const FIELD_LABEL: Record<string, string> = {
  title: '标题',
  notes: '备注',
  status: '状态',
  priority: '优先级',
  dueAt: '截止',
  tags: '标签',
  name: '名称',
  description: '描述',
  steps: '步骤',
  trigger: '触发',
  tools: '工具',
  location: '地点',
  kind: '类型',
  startAt: '开始',
  endAt: '结束',
  workflowId: '工作流',
  recurrence: '重复',
  category: '分类',
  emoji: '图标',
  sourceRef: '来源',
  timezone: '时区',
  allDay: '全天',
}

const VALUE_LABEL: Record<string, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
  archived: '已归档',
  low: '低',
  med: '中',
  high: '高',
  urgent: '紧急',
  active: '已启用',
  paused: '已暂停',
  once: '到点一次',
  daily: '每天这个时间',
  meeting: '会议',
  focus: '深聊 / 专注',
  reminder: '提醒',
  external: '外部',
}

function formatAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function actorLabel(actor: string) {
  if (actor === 'ai') return 'AI'
  if (actor === 'system') return '系统'
  return '你'
}

function showValue(value: unknown) {
  if (value == null || value === '') return '空'
  if (typeof value === 'string') return VALUE_LABEL[value] || value
  if (typeof value === 'number' || typeof value === 'boolean') return VALUE_LABEL[String(value)] || String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '空'
    return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('、')
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function ChangeLines({ entry }: { entry: PlanHistoryEntry }) {
  if (entry.kind === 'run') {
    const trigger = entry.run?.trigger === 'schedule' ? '日程' : '手动'
    return (
      <div className="text-sm">
        <span>运行（{trigger}） {entry.label}</span>
        {entry.run?.sessionId ? (
          <button
            type="button"
            className="btn-ghost h-7 px-2 text-[11px] ml-2"
            onClick={() => revealAi(entry.run?.sessionId)}
          >
            打开会话
          </button>
        ) : null}
      </div>
    )
  }
  if (entry.legacy || !entry.changes) {
    return <div className="text-sm">{entry.label}</div>
  }
  if (entry.changes.length === 0) {
    return <div className="text-sm">{entry.label}</div>
  }
  return (
    <div className="text-sm space-y-1">
      {entry.changes.map((change) => (
        <div key={change.field}>
          {FIELD_LABEL[change.field] || change.field}：{showValue(change.before)} → {showValue(change.after)}
        </div>
      ))}
    </div>
  )
}

export function PlanHistoryDrawer({
  open,
  title,
  targetRef,
  onClose,
}: {
  open: boolean
  title: string
  targetRef: string
  onClose: () => void
}) {
  const workspaceId = useApp((state) => state.activeWorkspaceId)
  const [entries, setEntries] = useState<PlanHistoryEntry[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !workspaceId || !targetRef) return
    let cancelled = false
    setLoading(true)
    setError('')
    void runtimeApi.listPlanHistory(workspaceId, targetRef).then((row) => {
      if (cancelled) return
      setEntries(Array.isArray(row.entries) ? row.entries : [])
      setNote(typeof row.note === 'string' ? row.note : '')
      setLoading(false)
    }).catch((cause: unknown) => {
      if (cancelled) return
      const message = cause instanceof RuntimeApiError && cause.message
        ? cause.message
        : '读不到历史'
      setError(message)
      setEntries([])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, workspaceId, targetRef])

  return (
    <PlanDrawer open={open} onClose={onClose} title={`历史 · ${title}`}>
      {note ? <div className="mb-3 text-sm text-ink-muted" data-plan-history-note>{note}</div> : null}
      {loading ? <p className="text-sm text-ink-muted">正在读取历史</p> : null}
      {error ? <div className="text-sm text-accent-red">{error}</div> : null}
      {!loading && !error && entries.length === 0 ? <p className="text-sm text-ink-muted">还没有记录</p> : null}
      <ul className="space-y-3">
        {entries.map((entry, index) => (
          <li key={`${entry.at}:${entry.action}:${index}`} className="border-b border-line pb-3" data-plan-history-entry={entry.action}>
            <div className="text-[11px] text-ink-muted mb-1">
              {formatAt(entry.at)} · {actorLabel(entry.actor)} · {entry.label}
              {entry.via === 'organize' ? ' · 整理' : ''}
            </div>
            <ChangeLines entry={entry} />
          </li>
        ))}
      </ul>
    </PlanDrawer>
  )
}
