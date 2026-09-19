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

const SERIES_COLOR_CLASSES = [
  'text-accent-blue',
  'text-brand',
  'text-accent-teal',
  'text-accent-amber',
  'text-accent-purple',
  'text-accent-red',
] as const

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
      return {
        key,
        value,
        colorClass: SERIES_COLOR_CLASSES[i % SERIES_COLOR_CLASSES.length],
      }
    })
  }, [groupBy, options, rows, view.metric?.field, view.metric?.fn])

  const rawTotal = series.reduce((sum, row) => sum + Math.max(0, row.value), 0)
  const total = rawTotal || 1
  const max = Math.max(...series.map((row) => row.value), 1)
  let cursor = 0
  const slices = series.map((row) => {
    const frac = Math.max(0, row.value) / total
    const start = cursor
    cursor += frac
    return { ...row, start, end: cursor }
  })

  const totalLabel = formatChartValue(rawTotal)

  return (
    <div className="border border-line rounded-xl p-3 space-y-2.5 bg-surface min-w-0" data-app-chart="true">
      <div className="text-sm font-medium">{view.label || '构成'}</div>
      <div className="flex flex-wrap items-center gap-3">
        <svg viewBox="0 0 36 36" className="w-[7.5rem] h-[7.5rem] shrink-0 text-ink" role="img" aria-label={view.label || '图'}>
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
                className={slice.colorClass}
                fill="currentColor"
                d={`M18 18 L ${x0} ${y0} A 14 14 0 ${large} 1 ${x1} ${y1} Z`}
              />
            )
          })}
          <circle cx="18" cy="18" r="7" className="fill-surface" />
          <text
            x="18"
            y="18.5"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-ink"
            style={{ fontSize: '5.5px', fontWeight: 600 }}
          >
            {totalLabel}
          </text>
        </svg>
        <div className="flex-1 min-w-[140px] space-y-1">
          {series.map((row) => {
            const pct = rawTotal > 0 ? (Math.max(0, row.value) / rawTotal) * 100 : 0
            return (
              <div key={row.key} className="flex items-center gap-2 text-[11px] min-w-0">
                <span className={`w-2 h-2 rounded-sm shrink-0 ${row.colorClass} bg-current`} />
                <span className="truncate flex-1 min-w-0">{row.key || '—'}</span>
                <span className="tabular-nums shrink-0">{formatChartValue(row.value)}</span>
                <span className="tabular-nums text-ink-muted shrink-0 w-9 text-right">
                  {pct < 10 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-24 pt-1">
        {series.map((row) => (
          <div key={`bar-${row.key}`} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
            <div
              className={`w-full rounded-sm min-h-[4px] ${row.colorClass} bg-current`}
              style={{ height: `${Math.max(8, (row.value / max) * 100)}%` }}
            />
            <span className="text-[9px] text-ink-muted truncate w-full text-center leading-tight" title={row.key}>
              {row.key || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatChartValue(value: number) {
  if (!Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
