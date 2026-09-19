import { useEffect, useState } from 'react'
import { type FdeAppView } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id: string; spec: import('@/lib/app-spec').FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
  variant?: 'hero' | 'tile'
  tileIndex?: number
}

const STAT_VALUE_ACCENTS = [
  'text-accent-red',
  'text-accent-amber',
  'text-accent-blue',
  'text-accent-purple',
  'text-accent-teal',
  'text-ink',
] as const

function statValueClass(label: string, tileIndex?: number) {
  if (tileIndex === 0) return 'text-brand'
  let hash = 0
  for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  return STAT_VALUE_ACCENTS[hash % STAT_VALUE_ACCENTS.length]
}

export function SpecStat({ app, view, workspaceCwd, previewRows, variant = 'hero', tileIndex }: Props) {
  const [value, setValue] = useState<number | string>(() => {
    if (!previewRows) return '—'
    return metricFromRows(previewRows, view)
  })
  const [label, setLabel] = useState(view.label || '统计')

  useEffect(() => {
    if (previewRows) {
      setValue(metricFromRows(previewRows, view))
      setLabel(view.label || '统计')
      return
    }
    if (app.status !== 'active' || !view.id) return
    void runtimeApi.getAppStat(app.spec.slug, view.id, workspaceCwd).then((data) => {
      setValue(data.value)
      setLabel(data.label)
    }).catch(() => setValue('—'))
  }, [app.spec.slug, app.status, previewRows, view, workspaceCwd])

  if (variant === 'tile') {
    return (
      <div
        className="border border-line rounded-xl bg-surface-2 px-4 py-4 min-w-0 shadow-card"
        data-app-stat="true"
      >
        <div className="text-[11px] font-medium text-ink-muted truncate">{label}</div>
        <div className={`text-3xl font-semibold tabular-nums mt-2 tracking-tight ${statValueClass(label, tileIndex)}`}>
          {formatStat(value)}
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-8">
      <div className="text-3xl font-semibold tabular-nums">{formatStat(value)}</div>
      <div className="text-xs text-ink-muted mt-2">{label}</div>
    </div>
  )
}

function metricFromRows(rows: Record<string, unknown>[], view: FdeAppView): number {
  const fn = view.metric?.fn || 'count'
  if (fn === 'count') return rows.length
  const field = view.metric?.field
  if (!field) return rows.length
  const nums = rows.map((row) => Number(row[field])).filter((n) => Number.isFinite(n))
  if (!nums.length) return 0
  const sum = nums.reduce((a, b) => a + b, 0)
  return fn === 'avg' ? sum / nums.length : sum
}

function formatStat(value: number | string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value)
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
