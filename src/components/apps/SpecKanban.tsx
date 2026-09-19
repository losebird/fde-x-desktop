import { useCallback, useEffect, useState } from 'react'
import { entityDef, type FdeAppView } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id: string; spec: import('@/lib/app-spec').FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
}

export function SpecKanban({ app, view, workspaceCwd, previewRows }: Props) {
  const ent = entityDef(app.spec, view.entity)
  const groupField = view.groupBy || ''
  const field = ent?.fields.find((f) => f.name === groupField)
  const columns = field?.type === 'enum' ? field.options ?? [] : []
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [dragId, setDragId] = useState('')

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

  const onDrop = async (status: string) => {
    if (!dragId || previewRows || app.status !== 'active') return
    await runtimeApi.patchAppRecord(app.spec.slug, view.entity, dragId, workspaceCwd, { [groupField]: status })
    setDragId('')
    await load()
  }

  if (!groupField || columns.length === 0) {
    return <div className="text-xs text-ink-muted">看板需要按 enum 字段分列。</div>
  }

  return (
    <div className="flex gap-3 overflow-x-auto" data-app-kanban="true">
      {columns.map((col) => (
        <div
          key={col}
          data-app-kanban-column={col}
          className="border border-line bg-surface-2 min-h-[120px] p-2 min-w-[160px] flex-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => void onDrop(col)}
        >
          <div className="text-xs font-medium mb-2">{col}</div>
          <div className="space-y-2">
            {rows.filter((r) => String(r[groupField]) === col).map((row) => (
              <div
                key={String(row.id)}
                data-app-kanban-card={String(row.id)}
                draggable={!previewRows && app.status === 'active'}
                onDragStart={() => setDragId(String(row.id))}
                className="border border-line bg-white px-2 py-1.5 text-xs cursor-grab touch-none"
              >
                {String(row[ent?.titleField || 'id'] ?? row.id)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
