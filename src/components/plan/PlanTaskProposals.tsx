import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui'
import { useEvents } from '@/lib/events'
import { RuntimeApiError, runtimeApi, type PlanTaskProposal } from '@/lib/runtime-api'
import { useApp } from '@/store/app'
import { canonicalWorkspaceCwd } from '../../../runtime/cwd.mjs'

const OP_LABEL: Record<PlanTaskProposal['op'], string> = {
  insert: '新建',
  update: '修改',
}

const FIELD_LABEL: Record<string, string> = {
  title: '标题',
  notes: '备注',
  status: '状态',
  priority: '优先级',
  dueAt: '截止',
  tags: '标签',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: '紧急',
  high: '高',
  med: '中',
  low: '低',
}

const STATUS_LABEL: Record<string, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
  archived: '已归档',
}

function messageOf(cause: unknown) {
  if (cause instanceof RuntimeApiError) return cause.message
  if (cause instanceof Error) return cause.message
  return ''
}

function showValue(key: string, value: unknown) {
  if (value == null || value === '') return '—'
  if (key === 'priority' && typeof value === 'string') return PRIORITY_LABEL[value] || value
  if (key === 'status' && typeof value === 'string') return STATUS_LABEL[value] || value
  if (key === 'tags' && Array.isArray(value)) return value.map(String).join(', ') || '—'
  if (key === 'dueAt' && typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (match) return `${Number(match[2])}/${Number(match[3])}`
  }
  return String(value)
}

function diffLines(item: PlanTaskProposal) {
  const before = item.before && typeof item.before === 'object' ? item.before : {}
  const change = item.change && typeof item.change === 'object' ? item.change : {}
  const lines: string[] = []
  for (const key of ['title', 'notes', 'status', 'priority', 'dueAt', 'tags']) {
    if (!Object.prototype.hasOwnProperty.call(change, key)) continue
    const from = before[key]
    const to = change[key]
    lines.push(item.op === 'insert'
      ? `${FIELD_LABEL[key]} ${showValue(key, to)}`
      : `${FIELD_LABEL[key]} ${showValue(key, from)} → ${showValue(key, to)}`)
  }
  return lines
}

export function PlanTaskProposals({ onDecided }: { onDecided?: (taskId: string) => void }) {
  const workspaceId = useApp((s) => s.activeWorkspaceId)
  const workspaces = useApp((s) => s.workspaces)
  const hydratePlan = useApp((s) => s.hydratePlan)
  const [items, setItems] = useState<PlanTaskProposal[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const workspaceCwd = useMemo(() => {
    const row = workspaces.find((item) => item.id === workspaceId)
    return canonicalWorkspaceCwd(row?.cwd) || undefined
  }, [workspaces, workspaceId])

  const reload = useCallback(async () => {
    if (!workspaceId) return
    try {
      setItems(await runtimeApi.listPlanTaskProposals(workspaceId))
      setError('')
    } catch (cause) {
      setError(messageOf(cause))
    }
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId) {
      setItems([])
      setError('')
      return
    }
    let cancelled = false
    void runtimeApi.listPlanTaskProposals(workspaceId).then((rows) => {
      if (cancelled) return
      setItems(rows)
      setError('')
    }).catch((cause) => {
      if (!cancelled) setError(messageOf(cause))
    })
    return () => { cancelled = true }
  }, [workspaceId])

  useEvents(
    ['task.proposal.changed'],
    () => { void reload() },
    workspaceCwd ? { workspace: workspaceCwd } : undefined,
  )

  useEffect(() => {
    if (!workspaceId) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void reload()
    }, 15_000)
    return () => window.clearInterval(id)
  }, [workspaceId, reload])

  async function decide(id: string, decision: 'confirm' | 'reject') {
    if (!workspaceId) return
    const taskId = items.find((item) => item.id === id)?.taskId || ''
    setBusyId(id)
    setError('')
    try {
      await runtimeApi.decidePlanTaskProposal(id, decision, workspaceId)
      if (taskId) onDecided?.(taskId)
      if (decision === 'confirm') await hydratePlan(workspaceId)
    } catch (cause) {
      setError(messageOf(cause))
    }
    try {
      setItems(await runtimeApi.listPlanTaskProposals(workspaceId))
    } catch (cause) {
      setError(messageOf(cause))
    }
    setBusyId('')
  }

  if (items.length === 0 && !error) return null

  return (
    <div data-plan-task-proposals className="mb-4">
      <Card className="!p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <div className="text-sm font-medium">待确认的任务修改</div>
          <div className="text-xs text-ink-muted mt-0.5">确认后才按提案写入任务。</div>
        </div>
        {error && <div className="px-4 py-2 text-xs text-accent-red">{error}</div>}
        <div className="divide-y divide-line">
          {items.map((item) => (
            <div key={item.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 text-xs">
                <div className="font-medium">{OP_LABEL[item.op]}</div>
                <div className="text-ink-muted mt-1">{item.title}</div>
                {diffLines(item).map((line) => (
                  <div key={line} className="text-ink-muted mt-1">{line}</div>
                ))}
                {item.card?.notice ? (
                  <div className="text-xs text-ink-muted mt-1">{item.card.notice}</div>
                ) : null}
                {item.card?.business ? (
                  <div className="text-xs text-ink-muted mt-1">
                    <div>{item.card.business.headline}</div>
                    {item.card.business.lines.map((line, index) => (
                      <div key={`${line}-${index}`}>{line}</div>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="btn h-7"
                data-plan-task-proposal-confirm={item.id}
                disabled={busyId === item.id || item.card?.confirm.enabled === false}
                onClick={() => { void decide(item.id, 'confirm') }}
              >
                {item.card?.confirm.label || '确认'}
              </button>
              <button
                type="button"
                className="btn h-7"
                data-plan-task-proposal-reject={item.id}
                disabled={busyId === item.id}
                onClick={() => { void decide(item.id, 'reject') }}
              >
                拒绝
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
