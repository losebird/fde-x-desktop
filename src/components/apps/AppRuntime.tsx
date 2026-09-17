import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { SpecKanban } from '@/components/apps/SpecKanban'
import { SpecStat } from '@/components/apps/SpecStat'
import { SpecTable } from '@/components/apps/SpecTable'
import { SpecForm } from '@/components/apps/SpecForm'
import { SpecEditor } from '@/components/apps/SpecEditor'
import { isFdeAppSpec, type FdeAppDetail, type FdeAppView } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: FdeAppDetail
  workspaceCwd: string
  previewMode?: boolean
  onChanged: () => void
}

function mockRows(spec: FdeAppDetail['spec']): Record<string, unknown>[] {
  const table = spec.views.find((v) => v.type === 'table')
  const entity = table?.entity || spec.entities[0]?.name
  const ent = spec.entities.find((e) => e.name === entity)
  if (!ent) return []
  const statusField = ent.fields.find((f) => f.type === 'enum')
  const statuses = statusField?.options ?? ['示例']
  return [0, 1, 2].map((i) => {
    const row: Record<string, unknown> = { id: `preview_${i}` }
    for (const f of ent.fields) {
      if (f.type === 'enum') row[f.name] = statuses[i % statuses.length]
      else if (f.type === 'date') row[f.name] = '2026-09-01'
      else if (f.type === 'number') row[f.name] = i + 1
      else row[f.name] = `${f.label || f.name} ${i + 1}`
    }
    return row
  })
}

export function AppRuntime({ app, workspaceCwd, previewMode, onChanged }: Props) {
  const spec = app.spec
  const views = spec.views
  const [viewId, setViewId] = useState(views[0]?.id || views[0]?.type || '0')
  const [showEditor, setShowEditor] = useState(false)
  const [detailRid, setDetailRid] = useState('')
  const previewRows = previewMode || app.status === 'draft' ? mockRows(spec) : undefined
  const current = views.find((v) => (v.id || v.type) === viewId) || views[0]

  const activate = async () => {
    await runtimeApi.activateDeclarativeApp(app.id)
    onChanged()
  }

  const archive = async () => {
    await runtimeApi.archiveDeclarativeApp(app.id)
    onChanged()
  }

  const rollback = async (revision: number) => {
    await runtimeApi.rollbackDeclarativeApp(app.id, revision)
    onChanged()
  }

  if (!isFdeAppSpec(spec)) {
    return <div className="px-4 py-3 text-xs text-ink-muted">不是 fde-app/v1 声明式应用</div>
  }

  return (
    <div className="border-t border-line">
      <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2">
        <div className="flex items-center rounded border border-line bg-surface p-0.5">
          {views.map((view) => {
            const key = view.id || `${view.type}-${view.entity}`
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setViewId(view.id || view.type); setDetailRid('') }}
                className={clsx(
                  'h-7 px-2.5 rounded text-xs transition-colors',
                  (view.id || view.type) === viewId ? 'bg-ink text-white' : 'text-ink-muted hover:bg-surface-2',
                )}
              >
                {view.label || view.type}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {app.status === 'draft' && (
            <button type="button" className="btn-brand h-7" onClick={() => void activate()}>采纳并激活</button>
          )}
          <button type="button" className="btn h-7" onClick={() => setShowEditor((v) => !v)}>编辑 spec</button>
          <select
            className="input h-7 text-xs"
            defaultValue=""
            onChange={(e) => {
              const rev = Number(e.target.value)
              if (rev > 0) void rollback(rev)
              e.target.value = ''
            }}
          >
            <option value="">版本回滚…</option>
            {app.revisions?.map((r) => (
              <option key={r.revision} value={r.revision}>修订 {r.revision}</option>
            ))}
          </select>
          {app.status === 'active' && (
            <button type="button" className="btn h-7" onClick={() => void archive()}>归档</button>
          )}
        </div>
      </div>
      {showEditor && <SpecEditor app={app} onSaved={onChanged} />}
      <div className="px-4 py-3">
        {current?.type === 'table' && (
          <SpecTable
            app={app}
            view={current}
            workspaceCwd={workspaceCwd}
            previewRows={previewRows}
            onSelectRid={setDetailRid}
            onRefresh={onChanged}
          />
        )}
        {current?.type === 'form' && (
          <SpecForm app={app} entity={current.entity} workspaceCwd={workspaceCwd} readOnly={app.status === 'archived'} onDone={onChanged} />
        )}
        {current?.type === 'kanban' && (
          <SpecKanban app={app} view={current} workspaceCwd={workspaceCwd} previewRows={previewRows} />
        )}
        {current?.type === 'stat' && (
          <SpecStat app={app} view={current} workspaceCwd={workspaceCwd} />
        )}
        {detailRid && current?.type === 'table' && (
          <div className="mt-4 border-t border-line pt-3">
            <SpecForm
              app={app}
              entity={current.entity}
              workspaceCwd={workspaceCwd}
              rid={detailRid}
              readOnly={app.status === 'archived'}
              onDone={onChanged}
            />
          </div>
        )}
        {app.status === 'archived' && (
          <div className="text-xs text-ink-muted mt-2">已归档，只读。</div>
        )}
      </div>
    </div>
  )
}
