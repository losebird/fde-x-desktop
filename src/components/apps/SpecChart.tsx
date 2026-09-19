import { useCallback, useEffect, useMemo, useState } from 'react'
import { entityDef, type FdeAppSpec, type FdeAppView } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { spec: FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
  reloadToken?: number
}

const PALETTE = ['#1f6feb', '#3f3f46', '#0f766e', '#b45309', '#7c3aed', '#be123c']

export function SpecChart({ app, view, workspaceCwd, previewRows, reloadToken }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(previewRows ?? [])
  const ent = entityDef(app.spec, view.entity)
  const groupBy = view.groupBy || ent?.fields.find((f) => f.type === 'enum')?.name || ''
  const options = ent?.fields.find((f) => f.name === groupBy)?.options ?? []

  const load = useCallback(async () => {
    if (previewRows) {
      setRows(previewRows)
      return
    }
    if (app.status !== 'active') return
    const data = await runtimeApi.listAppRecords(app.spec.slug, view.entity, workspaceCwd, { page: 1, size: 200 })
    setRows(data.rows)
  }, [app.spec.slug, app.status, previewRows, view.entity, workspaceCwd])

  useEffect(() => { void load() }, [load, reloadToken])

  const series = useMemo(() => {
    const keys = options.length ? options : [...new Set(rows.map((row) => String(row[groupBy] ?? '—')))]
    const fn = view.metric?.fn || 'count'
    const field = view.metric?.field
    return keys.map((key, i) => {
      const matched = rows.filter((row) => String(row[groupBy] ?? '') === key)
      let value = matched.length
      if ((fn === 'sum' || fn === 'avg') && field) {
        const nums = matched.map((row) => Number(row[field])).filter((n) => Number.isFinite(n))
        const sum = nums.reduce((a, b) => a + b, 0)
        value = fn === 'avg' && nums.length ? sum / nums.length : sum
      }
      return { key, value, color: PALETTE[i % PALETTE.length] }
    })
  }, [groupBy, options, rows, view.metric?.field, view.metric?.fn])

  const total = series.reduce((sum, row) => sum + Math.max(0, row.value), 0) || 1
  const max = Math.max(...series.map((row) => row.value), 1)
  let cursor = 0
  const slices = series.map((row) => {
    const frac = Math.max(0, row.value) / total
    const start = cursor
    cursor += frac
    return { ...row, start, end: cursor }
  })

  return (
    <div className="border border-line rounded-lg p-3 space-y-3" data-app-chart="true">
      <div className="text-sm font-medium">{view.label || '构成'}</div>
      <div className="flex flex-wrap items-center gap-4">
        <svg viewBox="0 0 36 36" className="w-28 h-28 shrink-0" role="img" aria-label={view.label || '图'}>
          {slices.map((slice) => {
            const a0 = slice.start * 2 * Math.PI - Math.PI / 2
            const a1 = slice.end * 2 * Math.PI - Math.PI / 2
            const x0 = 18 + 14 * Math.cos(a0)
            const y0 = 18 + 14 * Math.sin(a0)
            const x1 = 18 + 14 * Math.cos(a1)
            const y1 = 18 + 14 * Math.sin(a1)
            const large = slice.end - slice.start > 0.5 ? 1 : 0
            return (
              <path
                key={slice.key}
                d={`M18 18 L ${x0} ${y0} A 14 14 0 ${large} 1 ${x1} ${y1} Z`}
                fill={slice.color}
              />
            )
          })}
          <circle cx="18" cy="18" r="7" fill="white" />
        </svg>
        <div className="flex-1 min-w-[140px] space-y-1.5">
          {series.map((row) => (
            <div key={row.key} className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: row.color }} />
              <span className="truncate flex-1">{row.key || '—'}</span>
              <span className="tabular-nums">{Number.isInteger(row.value) ? row.value : row.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-16">
        {series.map((row) => (
          <div key={`bar-${row.key}`} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
            <div className="w-full rounded-sm" style={{ height: `${Math.max(6, (row.value / max) * 100)}%`, background: row.color }} />
          </div>
        ))}
      </div>
    </div>
  )
}
