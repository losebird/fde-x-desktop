import { useEffect, useState } from 'react'
import { type FdeAppView } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id: string; spec: import('@/lib/app-spec').FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
}

export function SpecStat({ app, view, workspaceCwd }: Props) {
  const [value, setValue] = useState<number | string>('—')
  const [label, setLabel] = useState(view.label || '统计')

  useEffect(() => {
    if (app.status !== 'active' || !view.id) return
    void runtimeApi.getAppStat(app.spec.slug, view.id, workspaceCwd).then((data) => {
      setValue(data.value)
      setLabel(data.label)
    }).catch(() => setValue('—'))
  }, [app.spec.slug, app.status, view.id, workspaceCwd])

  return (
    <div className="text-center py-8">
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-ink-muted mt-2">{label}</div>
    </div>
  )
}
