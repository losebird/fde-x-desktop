import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { revealAi } from '@/lib/open-ref'
import {
  actorLabel,
  entryKindBadge,
  formatPlanStamp,
  runOutcomeLabel,
  visiblePlanChanges,
  type VisiblePlanChange,
} from '@/lib/plan-history-view'
import { RuntimeApiError, runtimeApi, type PlanHistoryEntry } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

function PlanDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-md h-full border-l border-line shadow-[-8px_0_32px_rgba(0,0,0,0.08)] rounded-l-xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function ChangeRow({ change }: { change: VisiblePlanChange }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-1.5">
      <div className="text-[11px] text-ink-subtle pt-0.5">{change.label}</div>
      {change.created ? (
        <div className="text-[13px] text-ink leading-5 break-words">{change.after}</div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] leading-5 min-w-0">
          <span className="text-ink-muted line-through decoration-line break-all">{change.before}</span>
          <span className="text-ink-subtle" aria-hidden>→</span>
          <span className="text-ink break-words">{change.after}</span>
        </div>
      )}
    </div>
  )
}

function HistoryCard({ entry }: { entry: PlanHistoryEntry }) {
  const badge = entryKindBadge(entry)
  const changes = visiblePlanChanges(entry)
  const run = entry.kind === 'run' ? entry.run : undefined

  return (
    <li className="relative pl-5" data-plan-history-entry={entry.action}>
      <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-ink/70" aria-hidden />
      <div className="flex items-center gap-2 text-[11px] text-ink-muted">
        <span>{formatPlanStamp(entry.at)}</span>
        <span aria-hidden>·</span>
        <span>{actorLabel(entry.actor)}</span>
        <span className="inline-flex items-center rounded-full bg-surface-2 px-1.5 py-px text-[10px] text-ink-muted">
          {badge}
        </span>
      </div>
      {run ? (
        <div className="mt-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5">
          <div className="text-[13px] text-ink">
            {run.trigger === 'schedule' ? '按日程跑了一次' : '手动跑了一次'}
            {runOutcomeLabel(entry) ? ` · ${runOutcomeLabel(entry)}` : ''}
          </div>
          {run.message ? <div className="mt-1 text-[12px] text-ink-muted">{run.message}</div> : null}
          {run.sessionId ? (
            <button
              type="button"
              className="btn-ghost h-7 px-2 text-[11px] mt-2 -ml-2"
              onClick={() => revealAi(run.sessionId)}
            >
              打开会话
            </button>
          ) : null}
        </div>
      ) : changes.length > 0 ? (
        <div className="mt-2 rounded-lg border border-line bg-surface-2/40 px-3 py-1.5 divide-y divide-line/80">
          {changes.map((change) => (
            <ChangeRow key={change.field} change={change} />
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[13px] text-ink-muted">{entry.label}</div>
      )}
    </li>
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
    <PlanDrawer open={open} onClose={onClose}>
      <div className="px-5 pt-5 pb-3 border-b border-line shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-ink-subtle tracking-wide">记录</div>
            <h3 className="text-[15px] font-medium leading-snug mt-0.5 truncate" title={title}>{title || '这条记录'}</h3>
          </div>
          <button className="btn-ghost p-1 shrink-0" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </div>
        {note ? <div className="mt-2 text-[12px] text-ink-muted" data-plan-history-note>{note}</div> : null}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? <p className="text-sm text-ink-muted">正在读取记录</p> : null}
        {error ? <div className="text-sm text-accent-red">{error}</div> : null}
        {!loading && !error && entries.length === 0 ? (
          <div className="text-sm text-ink-muted">
            <div className="font-medium text-ink">还没有记录</div>
            <p className="mt-1 text-[13px]">新建、编辑、整理或运行之后，会出现在这里。</p>
          </div>
        ) : null}
        <ul className="relative space-y-5 before:absolute before:left-[3px] before:top-2 before:bottom-2 before:w-px before:bg-line">
          {entries.map((entry, index) => (
            <HistoryCard key={`${entry.at}:${entry.action}:${index}`} entry={entry} />
          ))}
        </ul>
      </div>
    </PlanDrawer>
  )
}
