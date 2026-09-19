import { useEffect, useState } from 'react'
import { type FdeAppView } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id: string; spec: import('@/lib/app-spec').FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
  variant?: 'hero' | 'tile'
}

export function SpecStat({ app, view, workspaceCwd, previewRows, variant = 'hero' }: Props) {
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
      <div className="border border-line rounded-xl bg-surface-2 px-3 py-4 min-w-0" data-app-stat="true">
        <div className="text-[12px] text-ink-muted truncate">{label}</div>
        <div className="text-3xl font-semibold tabular-nums mt-1.5 tracking-tight">{formatStat(value)}</div>
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
