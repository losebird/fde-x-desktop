import { useEffect, useState } from 'react'
import { Card } from '@/components/ui'
import { RuntimeApiError, runtimeApi, type PlanTaskProposal } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

const OP_LABEL: Record<PlanTaskProposal['op'], string> = {
  insert: '新建',
  update: '修改',
  delete: '删除',
}

function messageOf(cause: unknown) {
  if (cause instanceof RuntimeApiError) return cause.message
  if (cause instanceof Error) return cause.message
  return ''
}

export function PlanTaskProposals() {
  const workspaceId = useApp((s) => s.activeWorkspaceId)
  const hydratePlan = useApp((s) => s.hydratePlan)
  const [items, setItems] = useState<PlanTaskProposal[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

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

  async function decide(id: string, decision: 'confirm' | 'reject') {
    if (!workspaceId) return
    setBusyId(id)
    setError('')
    try {
      await runtimeApi.decidePlanTaskProposal(id, decision)
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
              </div>
              <button
                type="button"
                className="btn h-7"
                data-plan-task-proposal-confirm={item.id}
                disabled={busyId === item.id}
                onClick={() => { void decide(item.id, 'confirm') }}
              >
                确认
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
