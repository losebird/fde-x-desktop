import { useEffect, useState } from 'react'
import { fieldLabel } from '@/components/apps/SpecForm'
import { SpecForm } from '@/components/apps/SpecForm'
import { type FdeAppSpec } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id: string; spec: FdeAppSpec; status: string }
  entity: string
  rid: string
  workspaceCwd: string
  onEdit?: () => void
}

export function SpecDetail({ app, entity, rid, workspaceCwd, onEdit }: Props) {
  const [row, setRow] = useState<Record<string, unknown> | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (app.status !== 'active') return
    void runtimeApi.listAppRecords(app.spec.slug, entity, workspaceCwd, { size: 1 }).catch(() => null)
    void fetch(
      `${runtimeApi.baseUrl}/api/v1/apps/${encodeURIComponent(app.spec.slug)}/${encodeURIComponent(entity)}/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    ).then((r) => r.json()).then((j) => setRow(j.data ?? null)).catch(() => setRow(null))
  }, [app.spec.slug, app.status, entity, rid, workspaceCwd])

  const ent = app.spec.entities.find((e) => e.name === entity)
  if (!ent) return null

  if (editing) {
    return (
      <SpecForm
        app={app}
        entity={entity}
        workspaceCwd={workspaceCwd}
        rid={rid}
        initial={row ?? undefined}
        onDone={() => { setEditing(false); onEdit?.() }}
      />
    )
  }

  return (
    <div className="space-y-2">
      {ent.fields.map((f) => (
        <div key={f.name} className="text-xs">
          <span className="text-ink-muted">{fieldLabel(app.spec, entity, f.name)}：</span>
          <span>{String(row?.[f.name] ?? '—')}</span>
        </div>
      ))}
      {app.status === 'active' && (
        <button type="button" className="btn h-8" onClick={() => setEditing(true)}>编辑</button>
      )}
    </div>
  )
}
