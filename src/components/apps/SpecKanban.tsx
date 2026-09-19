import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import clsx from 'clsx'
import { displayTitle, entityDef, type FdeAppView } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id: string; spec: import('@/lib/app-spec').FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
}

type DragUi = { id: string; title: string; x: number; y: number; over: string; started: boolean }

const DRAG_THRESHOLD = 4

export function SpecKanban({ app, view, workspaceCwd, previewRows }: Props) {
  const ent = entityDef(app.spec, view.entity)
  const groupField = view.groupBy || ''
  const field = ent?.fields.find((f) => f.name === groupField)
  const columns = field?.type === 'enum' ? field.options ?? [] : []
  const titleField = ent?.titleField || 'id'
  const live = !previewRows && app.status === 'active'
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; from: string; originX: number; originY: number } | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [dragUi, setDragUi] = useState<DragUi | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (previewRows) {
      setRows(previewRows)
      return
    }
    if (app.status !== 'active') return
    const data = await runtimeApi.listAppRecords(app.spec.slug, view.entity, workspaceCwd, { size: 100 })
    setRows(data.rows)
  }, [app.spec.slug, app.status, previewRows, view.entity, workspaceCwd])

  useEffect(() => { void load() }, [load])

  const columnAt = (clientX: number, clientY: number) => {
    const board = boardRef.current
    if (!board) return ''
    for (const el of board.querySelectorAll<HTMLElement>('[data-app-kanban-column]')) {
      const r = el.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return el.dataset.appKanbanColumn || ''
      }
    }
    return ''
  }

  const endDrag = () => {
    dragRef.current = null
    setDragUi(null)
  }

  const commitDrop = async (rid: string, from: string, over: string) => {
    if (!live || busy || !over || !columns.includes(over) || over === from) {
      endDrag()
      return
    }
    setBusy(true)
    setError('')
    setRows((prev) => prev.map((row) => (String(row.id) === rid ? { ...row, [groupField]: over } : row)))
    endDrag()
    try {
      await runtimeApi.patchAppRecord(app.spec.slug, view.entity, rid, workspaceCwd, { [groupField]: over })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '未能改状态')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>, row: Record<string, unknown>) => {
    if (!live || busy || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const from = String(row[groupField] ?? '')
    dragRef.current = { id: String(row.id), from, originX: event.clientX, originY: event.clientY }
    setDragUi({
      id: String(row.id),
      title: displayTitle(app.spec, view.entity, row) || String(row[titleField] ?? row.id),
      x: event.clientX,
      y: event.clientY,
      over: from,
      started: false,
    })
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragRef.current
    if (!session) return
    const dx = event.clientX - session.originX
    const dy = event.clientY - session.originY
    const started = Math.hypot(dx, dy) >= DRAG_THRESHOLD
    const over = started ? (columnAt(event.clientX, event.clientY) || session.from) : session.from
    setDragUi((prev) => prev && prev.id === session.id
      ? { ...prev, x: event.clientX, y: event.clientY, over, started }
      : prev)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragRef.current
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!session) {
      endDrag()
      return
    }
    const started = Math.hypot(event.clientX - session.originX, event.clientY - session.originY) >= DRAG_THRESHOLD
    if (!started) {
      endDrag()
      return
    }
    void commitDrop(session.id, session.from, columnAt(event.clientX, event.clientY))
  }

  if (!groupField || columns.length === 0) {
    return <div className="text-xs text-ink-muted">看板需要按 enum 字段分列。</div>
  }

  return (
    <div className="space-y-2">
      {previewRows && (
        <div className="text-xs text-ink-muted" data-app-preview-sample="true">
          下面是示例，不是已有业务数据。激活后不会变成真实记录。
        </div>
      )}
      {error && <div className="text-xs text-accent-red">{error}</div>}
      <div
        ref={boardRef}
        className="flex gap-3 overflow-x-auto"
        data-app-kanban="true"
        data-app-kanban-dragging={dragUi?.started ? dragUi.id : undefined}
      >
        {columns.map((col) => (
          <div
            key={col}
            data-app-kanban-column={col}
            data-app-kanban-over={dragUi?.started && dragUi.over === col ? 'true' : undefined}
            className={clsx(
              'border min-h-[120px] p-2 min-w-[160px] flex-1',
              dragUi?.started && dragUi.over === col ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2',
            )}
          >
            <div className="text-xs font-medium mb-2">{col}</div>
            <div className="space-y-2">
              {rows.filter((r) => String(r[groupField]) === col).map((row) => (
                <div
                  key={String(row.id)}
                  data-app-kanban-card={String(row.id)}
                  onPointerDown={(event) => onPointerDown(event, row)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={endDrag}
                  className={clsx(
                    'border border-line bg-white px-2 py-1.5 text-xs touch-none select-none',
                    live ? 'cursor-grab' : '',
                    dragUi?.started && dragUi.id === String(row.id) ? 'opacity-40 cursor-grabbing' : '',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {previewRows && (
                      <span className="inline-flex items-center rounded border border-line bg-surface-2 px-1 py-px text-[10px] text-ink-muted">示例</span>
                    )}
                    <span>{displayTitle(app.spec, view.entity, row) || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {dragUi?.started && (
        <div
          className="fixed z-50 pointer-events-none border border-brand bg-white px-2 py-1.5 text-xs shadow-md min-w-[140px]"
          style={{ left: dragUi.x + 10, top: dragUi.y + 10 }}
          data-app-kanban-ghost={dragUi.id}
        >
          {dragUi.title}
        </div>
      )}
    </div>
  )
}
