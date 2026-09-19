import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cardAction,
  cardGroupField,
  displayBlurb,
  displayTitle,
  entityDef,
  fieldDef,
  type FdeAppSpec,
  type FdeAppView,
} from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

type Props = {
  app: { spec: FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
  reloadToken?: number
}

const TONES = ['#C45C7A', '#6B4CA0', '#2F8F62', '#D46A1E', '#1F8FA8', '#8A4A2F', '#C43D6E', '#3D5A99']

function toneFor(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return TONES[hash % TONES.length]
}

export function SpecCards({ app, view, workspaceCwd, previewRows, reloadToken }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(previewRows ?? [])
  const [error, setError] = useState('')
  const ent = entityDef(app.spec, view.entity)
  const groupBy = cardGroupField(app.spec, view)
  const groupField = groupBy ? fieldDef(app.spec, view.entity, groupBy) : undefined
  const groupOptions = groupField?.options ?? []
  const openFiles = useApp((state) => state.togglePanel)
  const usesFiles = (app.spec.uses ?? []).includes('files')

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

  const groups = useMemo(() => {
    if (!groupBy) return [{ key: '', label: view.label || ent?.label || '卡片', rows }]
    const keys = groupOptions.length
      ? groupOptions.filter((opt) => rows.some((row) => String(row[groupBy] ?? '') === opt))
      : [...new Set(rows.map((row) => String(row[groupBy] ?? '')).filter(Boolean))]
    const leftover = rows.filter((row) => !keys.includes(String(row[groupBy] ?? '')))
    const listed = keys.map((key) => ({
      key,
      label: key,
      rows: rows.filter((row) => String(row[groupBy] ?? '') === key),
    }))
    if (leftover.length) listed.push({ key: '_other', label: view.label || ent?.label || '其他', rows: leftover })
    return listed.filter((group) => group.rows.length)
  }, [ent?.label, groupBy, groupOptions, rows, view.label])

  return (
    <div className="space-y-6" data-app-cards="true">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{view.label || ent?.label || '卡片'}</div>
        {previewRows && <span className="text-[10px] text-ink-muted border border-line px-1 rounded">示例</span>}
      </div>
      {error && <div className="text-xs text-accent-red">{error}</div>}
      {rows.length === 0 ? (
        <div className="border border-line rounded-xl px-3 py-10 text-center text-xs text-ink-muted">
          {app.status === 'active' ? '还没有条目。记下一条就会出现卡片。' : '还没有条目。'}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key || 'all'} className="space-y-3" data-app-card-group={group.key || 'all'}>
            {groups.length > 1 && (
              <div className="text-sm font-medium text-ink" data-app-card-group-label="true">{group.label}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {group.rows.map((row) => {
                const title = displayTitle(app.spec, view.entity, row)
                const blurb = displayBlurb(app.spec, view.entity, row, title)
                const action = cardAction(app.spec, view.entity, row)
                const toneKey = title || String(row.id)
                return (
                  <article
                    key={String(row.id)}
                    className="border border-line rounded-2xl bg-surface overflow-hidden min-w-0 shadow-card"
                    data-app-card="true"
                    data-app-card-title={title || undefined}
                  >
                    <div
                      className="min-h-[5.5rem] px-4 py-5 flex items-end text-white"
                      style={{ background: toneFor(toneKey) }}
                    >
                      <div className="text-[17px] font-semibold leading-snug line-clamp-2">{title || '未命名'}</div>
                    </div>
                    <div className="p-3.5 space-y-3">
                      {blurb && <p className="text-[13px] text-ink leading-relaxed line-clamp-3">{blurb}</p>}
                      {action?.kind === 'url' && (
                        <a
                          href={action.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-amber-100 text-amber-900 text-[12px] font-medium"
                          data-app-card-action="url"
                        >
                          打开
                        </a>
                      )}
                      {action?.kind === 'file' && usesFiles && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-amber-100 text-amber-900 text-[12px] font-medium"
                          data-app-card-action="file"
                          onClick={() => openFiles('files', 'full')}
                        >
                          打开
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
