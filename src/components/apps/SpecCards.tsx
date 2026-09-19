import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { ExternalLink, Play } from 'lucide-react'
import { AppCapabilityBar } from '@/components/apps/AppCapabilityBar'
import {
  cardAction,
  cardGroupField,
  displayBlurb,
  displayTitle,
  entityDef,
  fieldDef,
  type FdeAppSpec,
  type FdeAppView,
  type FdePlatformUse,
} from '@/lib/app-spec'
import { openAppHref, type AppOpenedMode } from '@/lib/app-platform'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id?: string; spec: FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
  reloadToken?: number
  recordActions?: ReactNode
  actionUses?: FdePlatformUse[]
}

const HERO_TONES = [
  'bg-accent-red',
  'bg-accent-amber',
  'bg-accent-blue',
  'bg-accent-purple',
  'bg-accent-teal',
  'bg-brand',
] as const

function heroToneClassFor(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return HERO_TONES[hash % HERO_TONES.length]
}

const primaryActionBaseClass =
  'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90'

export function SpecCards({ app, view, workspaceCwd, previewRows, reloadToken, recordActions, actionUses }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(previewRows ?? [])
  const [error, setError] = useState('')
  const [openProof, setOpenProof] = useState<{ href: string; mode: AppOpenedMode } | null>(null)
  const ent = entityDef(app.spec, view.entity)
  const groupBy = cardGroupField(app.spec, view)
  const groupField = groupBy ? fieldDef(app.spec, view.entity, groupBy) : undefined
  const groupOptions = groupField?.options ?? []
  const appId = String(app.id || '')

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

  const perCardActions = Boolean(appId && actionUses?.length)

  const handleOpenHref = (href: string, event?: MouseEvent<HTMLElement>) => {
    setOpenProof(openAppHref(href, event))
  }

  return (
    <div className="space-y-3" data-app-cards="true">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{view.label || ent?.label || '卡片'}</div>
        {previewRows && <span className="text-[10px] text-ink-muted border border-line px-1 rounded">示例</span>}
      </div>
      {error && <div className="text-xs text-accent-red">{error}</div>}
      {openProof && (
        <div
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] text-ink shadow-card"
          data-app-opened-proof="true"
          data-app-opened-href={openProof.href}
          data-app-opened-mode={openProof.mode}
        >
          <span className="font-medium">已打开</span>
          <span className="ml-1.5 break-all text-ink-muted">{openProof.href}</span>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="border border-line rounded-xl px-3 py-10 text-center text-xs text-ink-muted space-y-3">
          <div>{app.status === 'active' ? '还没有条目。记下一条就会出现卡片。' : '还没有条目。'}</div>
          {perCardActions ? (
            <AppCapabilityBar spec={app.spec} appId={appId} uses={actionUses} title={app.spec.name} />
          ) : recordActions}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key || 'all'} className="space-y-2" data-app-card-group={group.key || 'all'}>
            {Boolean(groupBy) && (
              <div className="text-xs font-semibold tracking-wide text-ink" data-app-card-group-label="true">{group.label}</div>
            )}
            <div
              className="grid gap-2.5"
              style={{
                gridTemplateColumns: group.rows.length >= 2
                  ? 'repeat(auto-fit, minmax(13.5rem, 1fr))'
                  : 'repeat(auto-fill, minmax(13.5rem, 13.5rem))',
              }}
            >
              {group.rows.map((row) => {
                const title = displayTitle(app.spec, view.entity, row)
                const blurb = displayBlurb(app.spec, view.entity, row, title)
                const action = cardAction(app.spec, view.entity, row)
                const toneKey = title || String(row.id)
                const heroTone = heroToneClassFor(toneKey)
                const play = Boolean(action?.play)
                return (
                  <article
                    key={String(row.id)}
                    className="border border-line rounded-xl bg-surface overflow-hidden min-w-0 shadow-pop flex flex-col"
                    data-app-card="true"
                    data-app-card-title={title || undefined}
                  >
                    <div
                      className={`relative h-28 shrink-0 flex items-center justify-center p-3 ${heroTone}`}
                    >
                      <h3 className="text-white text-[17px] font-semibold leading-snug line-clamp-2 text-center">
                        {title || '未命名'}
                      </h3>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 p-2.5 bg-surface">
                      {blurb ? (
                        <p className="text-[11px] text-ink-muted leading-snug line-clamp-3" data-app-card-blurb="true">{blurb}</p>
                      ) : null}
                      {action?.kind === 'url' && (
                        <a
                          href={action.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${primaryActionBaseClass} ${play ? 'bg-accent-amber text-ink' : 'bg-brand text-white'}`}
                          data-app-card-action={play ? 'play' : 'url'}
                          data-app-card-href={action.href}
                          onClick={(event) => handleOpenHref(action.href, event)}
                        >
                          {play ? (
                            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                          ) : (
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          )}
                          {play ? '播放' : '打开'}
                        </a>
                      )}
                      {action?.kind === 'file' && (
                        <button
                          type="button"
                          className={`${primaryActionBaseClass} bg-brand text-white`}
                          data-app-card-action="file"
                          data-app-card-href={action.href}
                          onClick={() => handleOpenHref(action.href)}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          打开
                        </button>
                      )}
                      {perCardActions ? (
                        <AppCapabilityBar
                          spec={app.spec}
                          appId={appId}
                          uses={actionUses}
                          title={title || app.spec.name}
                          rowId={String(row.id)}
                        />
                      ) : null}
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
