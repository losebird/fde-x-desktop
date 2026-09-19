import { useCallback, useEffect, useState } from 'react'
import { displayTitle, entityDef, fieldDef, looksLikeGeneratedCode, visibleTableColumns, type FdeAppSpec, type FdeAppView } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { spec: FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
  reloadToken?: number
}

export function SpecFeed({ app, view, workspaceCwd, previewRows, reloadToken }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(previewRows ?? [])
  const [error, setError] = useState('')
  const ent = entityDef(app.spec, view.entity)
  const columns = visibleTableColumns(app.spec, view)
  const titleField = ent?.titleField || columns[0]
  const numberField = ent?.fields.find((f) => f.type === 'number')
  const dateField = ent?.fields.find((f) => f.type === 'date' || f.type === 'datetime')
  const enumField = ent?.fields.find((f) => f.type === 'enum')

  const load = useCallback(async () => {
    if (previewRows) {
      setRows(previewRows)
      return
    }
    if (app.status !== 'active') return
    try {
      const data = await runtimeApi.listAppRecords(app.spec.slug, view.entity, workspaceCwd, {
        page: 1,
        size: 50,
        sort: view.sort?.field || dateField?.name,
        dir: view.sort?.dir || 'desc',
      })
      setRows(data.rows)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败')
    }
  }, [app.spec.slug, app.status, dateField?.name, previewRows, view.entity, view.sort?.dir, view.sort?.field, workspaceCwd])

  useEffect(() => { void load() }, [load, reloadToken])

  return (
    <div className="border border-line rounded-xl overflow-hidden bg-surface" data-app-feed="true">
      <div className="px-3 py-2 border-b border-line flex items-center justify-between">
        <div className="text-sm font-medium">{view.label || '流水'}</div>
        {previewRows && <span className="text-[10px] text-ink-muted border border-line px-1 rounded">示例</span>}
      </div>
      {error && <div className="px-3 py-1.5 text-xs text-accent-red">{error}</div>}
      {rows.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-ink-muted" data-app-feed-empty="true">
          {app.status === 'active' ? '还没有记录。上面记下一条就会出现在这里。' : '还没有记录。'}
        </div>
      ) : (
        <div className="divide-y divide-line">
          {rows.map((row) => (
            <div key={String(row.id)} className="px-3 py-2 flex items-start gap-2.5" data-app-feed-row="true">
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate" data-app-feed-title="true">{displayTitle(app.spec, view.entity, row) || '—'}</div>
                <div className="text-[11px] text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {enumField && row[enumField.name] != null && (
                    <span className="text-[10px] bg-surface-2 border border-line rounded-full px-1.5 py-px leading-tight">
                      {String(row[enumField.name])}
                    </span>
                  )}
                  {dateField && row[dateField.name] != null && <span>{String(row[dateField.name])}</span>}
                  {columns.filter((col) => col !== titleField && col !== numberField?.name && col !== dateField?.name && col !== enumField?.name).slice(0, 2).map((col) => {
                    const text = String(row[col] ?? '')
                    if (!text || looksLikeGeneratedCode(text)) return null
                    return <span key={col}>{fieldDef(app.spec, view.entity, col)?.label || col} {text}</span>
                  })}
                </div>
              </div>
              {numberField && (
                <div className="text-base font-semibold tabular-nums shrink-0 pt-px">
                  {String(row[numberField.name] ?? '')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
