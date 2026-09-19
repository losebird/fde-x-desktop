import { useCallback, useEffect, useState } from 'react'
import { entityDef, fieldDef, visibleTableColumns, type FdeAppSpec, type FdeAppView } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { spec: FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
  reloadToken?: number
}

export function SpecCards({ app, view, workspaceCwd, previewRows, reloadToken }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(previewRows ?? [])
  const [error, setError] = useState('')
  const ent = entityDef(app.spec, view.entity)
  const columns = visibleTableColumns(app.spec, view)
  const titleField = ent?.titleField || columns[0]
  const rest = columns.filter((col) => col !== titleField).slice(0, 3)

  const load = useCallback(async () => {
    if (previewRows) {
      setRows(previewRows)
      return
    }
    if (app.status !== 'active') return
    try {
      const data = await runtimeApi.listAppRecords(app.spec.slug, view.entity, workspaceCwd, { page: 1, size: 48 })
      setRows(data.rows)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败')
    }
  }, [app.spec.slug, app.status, previewRows, view.entity, workspaceCwd])

  useEffect(() => { void load() }, [load, reloadToken])

  return (
    <div className="space-y-2" data-app-cards="true">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{view.label || ent?.label || '卡片'}</div>
        {previewRows && <span className="text-[10px] text-ink-muted border border-line px-1 rounded">示例</span>}
      </div>
      {error && <div className="text-xs text-accent-red">{error}</div>}
      {rows.length === 0 ? (
        <div className="border border-line rounded-lg px-3 py-8 text-center text-xs text-ink-muted">
          {app.status === 'active' ? '还没有条目。记下一条就会出现卡片。' : '还没有条目。'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((row) => (
            <div key={String(row.id)} className="border border-line rounded-lg bg-surface p-3 min-w-0" data-app-card="true">
              <div className="text-sm font-medium truncate">{String(row[titleField] ?? row.id)}</div>
              <div className="mt-2 space-y-1">
                {rest.map((col) => (
                  <div key={col} className="text-[11px] text-ink-muted truncate">
                    {fieldDef(app.spec, view.entity, col)?.label || col} · {String(row[col] ?? '—')}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
