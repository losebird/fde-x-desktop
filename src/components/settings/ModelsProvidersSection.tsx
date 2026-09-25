import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { Tag } from '@/components/ui'
import { runtimeApi, type ModelsSettingsRow, type ModelsSettingsSnapshot } from '@/lib/runtime-api'

const LIST_COLLAPSE_AT = 4

type EditorMode =
  | { kind: 'edit'; provider: string }
  | { kind: 'add-catalog'; provider: string }
  | { kind: 'add-custom' }

type ModelRow = { id: string; name?: string; contextWindow?: number; maxTokens?: number; reasoningEfforts?: unknown }

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink mb-1.5">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-ink-subtle mt-1 leading-5">{hint}</div> : null}
    </label>
  )
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function modelRowsFromProfile(profile: Record<string, unknown> | undefined): ModelRow[] {
  const raw = profile?.models
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    if (!row || typeof row !== 'object') return null
    const id = asString((row as ModelRow).id)
    if (!id) return null
    return { ...(row as ModelRow), id, name: asString((row as ModelRow).name) || id }
  }).filter(Boolean) as ModelRow[]
}

function draftFromUser(row: ModelsSettingsRow): Record<string, unknown> {
  const base = row.userProfile && typeof row.userProfile === 'object'
    ? structuredClone(row.userProfile)
    : {}
  return base
}

function mergeDiscover(existing: ModelRow[], picked: ModelRow[]): ModelRow[] {
  const byId = new Map(existing.map((m) => [m.id, m]))
  for (const candidate of picked) {
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate)
  }
  return [...byId.values()]
}

export function ModelsProvidersSection({
  connected,
  busy,
  setBusy,
  note,
  setNote,
  onModelsRefresh,
}: {
  connected: boolean
  busy: boolean
  setBusy: (value: boolean) => void
  note: string
  setNote: (value: string) => void
  onModelsRefresh: () => void
}) {
  const [snapshot, setSnapshot] = useState<ModelsSettingsSnapshot | null>(null)
  const [loadError, setLoadError] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [editor, setEditor] = useState<EditorMode | null>(null)
  const [formError, setFormError] = useState('')

  const load = useCallback(() => {
    setLoadError('')
    void runtimeApi.getModelsSettings().then((data) => {
      setSnapshot(data)
    }).catch((cause) => {
      setLoadError(cause instanceof Error ? cause.message : '加载失败')
      setSnapshot(null)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const rows = snapshot?.rows || []
  const configuredCount = rows.filter((row) => row.credentialConfigured).length
  const canCollapse = rows.length > LIST_COLLAPSE_AT
  const showList = !canCollapse || listOpen

  const expandedProvider = editor?.kind === 'edit' ? editor.provider : null

  const protocolChoices = useMemo(() => {
    const fromServer = snapshot?.protocolChoices || []
    if (fromServer.length) return fromServer
    return ['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai']
  }, [snapshot?.protocolChoices])

  return (
    <>
      {!connected && (
        <div className="mb-3 text-xs text-ink-muted">先打开 AI 页连上核心，保存才会进正在跑的 DSH；未连接时只能看快照。</div>
      )}
      {note && <div className="mb-3 text-xs text-ink-muted">{note}</div>}
      {loadError && <div className="mb-3 text-xs text-accent-red">{loadError}</div>}

      {rows.length > 0 && (
        <div className="mb-4">
          {canCollapse && (
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-line hover:bg-surface-2 text-left"
              aria-expanded={listOpen}
              onClick={() => setListOpen((open) => !open)}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {rows.length} 个提供方{configuredCount > 0 ? ` · ${configuredCount} 已配置密钥` : ''}
                </div>
                {!listOpen && (
                  <div className="text-[11px] text-ink-subtle mt-0.5 truncate">
                    {configuredCount > 0 ? rows.filter((r) => r.credentialConfigured).map((r) => r.displayName).join('、') : '展开后编辑'}
                  </div>
                )}
              </div>
              <ChevronDown size={14} className={clsx('text-ink-subtle transition-transform', listOpen && 'rotate-180')} />
            </button>
          )}
          {showList && (
            <div className={clsx('space-y-2', canCollapse && 'mt-2')}>
              {rows.map((row) => (
                <div key={row.provider} className="rounded-lg border border-line">
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex items-center gap-2">
                      <span
                        className={clsx(
                          'w-2 h-2 rounded-full shrink-0',
                          row.credentialConfigured ? 'bg-accent-green' : 'bg-accent-red',
                        )}
                        title={row.credentialConfigured ? 'API 密钥已配置' : 'API 密钥缺失'}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{row.displayName}</div>
                        <div className="text-[11px] text-ink-subtle font-mono truncate">{row.provider}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                      <Tag kind={row.credentialConfigured ? 'green' : 'amber'}>
                        {row.credentialConfigured ? '已配置' : '缺失'}
                      </Tag>
                      <button
                        type="button"
                        className="btn h-8 px-2 text-xs"
                        onClick={() => {
                          setFormError('')
                          setEditor({ kind: 'edit', provider: row.provider })
                        }}
                      >
                        <Pencil size={12} /> 编辑
                      </button>
                      {row.removable && (
                        <button
                          type="button"
                          className="btn-ghost h-8 px-2 text-xs text-accent-red"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(`删除提供方 ${row.displayName}？`)) return
                            setBusy(true)
                            const ns = row.settingsNs || 'llm-pi-ai'
                            const rev = row.revision
                            void runtimeApi.mutateModelsSettings({
                              ns,
                              ops: [{ op: 'unset', path: ['providers', row.provider] }],
                              expectedRevision: rev,
                            }).then(async () => {
                              const derived = `${row.provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
                              if (!row.apiKeyEnv || row.apiKeyEnv === derived) {
                                await runtimeApi.setModelsCredential({ ref: row.keyRef, action: 'delete' }).catch(() => undefined)
                              }
                              setNote('已删除，请重载核心。')
                              setEditor(null)
                              load()
                              onModelsRefresh()
                            }).catch((cause) => setNote(cause instanceof Error ? cause.message : '删除失败')).finally(() => setBusy(false))
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedProvider === row.provider && editor?.kind === 'edit' && (
                    <ProviderEditorCard
                      row={row}
                      protocolChoices={protocolChoices}
                      writable={Boolean(snapshot?.writable)}
                      busy={busy}
                      formError={formError}
                      setFormError={setFormError}
                      setBusy={setBusy}
                      onClose={() => setEditor(null)}
                      onSaved={() => {
                        setNote('已保存。若模型列表有变，请重载核心。')
                        load()
                        onModelsRefresh()
                      }}
                      setNote={setNote}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 @md:grid-cols-2 gap-2">
        <button
          type="button"
          className="h-12 rounded-xl border border-dashed border-line text-sm text-ink-muted hover:border-brand hover:text-ink"
          onClick={() => {
            setFormError('')
            const pick = rows.find((row) => row.kind === 'catalog')?.provider || rows[0]?.provider || ''
            setEditor({ kind: 'add-catalog', provider: pick })
          }}
        >
          + 添加提供方
        </button>
        <button
          type="button"
          className="h-12 rounded-xl border border-dashed border-line text-sm text-ink-muted hover:border-brand hover:text-ink"
          onClick={() => {
            setFormError('')
            setEditor({ kind: 'add-custom' })
          }}
        >
          + 添加自定义提供方
        </button>
      </div>

      {editor?.kind === 'add-catalog' && (
        <AddCatalogCard
          rows={rows.filter((row) => row.kind === 'catalog')}
          provider={editor.provider}
          onProviderChange={(provider) => setEditor({ kind: 'add-catalog', provider })}
          busy={busy}
          formError={formError}
          setFormError={setFormError}
          setBusy={setBusy}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setNote('提供方已保存。请重载核心后在会话右侧切换模型。')
            setEditor(null)
            load()
            onModelsRefresh()
          }}
          setNote={setNote}
        />
      )}

      {editor?.kind === 'add-custom' && (
        <AddCustomCard
          protocolChoices={protocolChoices}
          busy={busy}
          formError={formError}
          setFormError={setFormError}
          setBusy={setBusy}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setNote('已创建自定义提供方，请重载核心。')
            setEditor(null)
            load()
            onModelsRefresh()
          }}
        />
      )}
    </>
  )
}

function ProviderEditorCard({
  row,
  protocolChoices,
  writable,
  busy,
  formError,
  setFormError,
  setBusy,
  onClose,
  onSaved,
  setNote,
}: {
  row: ModelsSettingsRow
  protocolChoices: string[]
  writable: boolean
  busy: boolean
  formError: string
  setFormError: (value: string) => void
  setBusy: (value: boolean) => void
  onClose: () => void
  onSaved: () => void
  setNote: (value: string) => void
}) {
  const layout = row.settingsNs === 'llm-deepseek' ? 'deepseek' : row.settingsNs === 'llm-pi-ai' ? 'pi-ai' : 'unknown'
  const fallback = (row.profile && typeof row.profile === 'object' ? row.profile : {}) as Record<string, unknown>
  const [draft, setDraft] = useState<Record<string, unknown>>(() => draftFromUser(row))
  const [committedOriginal, setCommittedOriginal] = useState<unknown>(() => row.userProfile)
  const [expectedRevision, setExpectedRevision] = useState<number | undefined>(() => row.revision)
  const [keyDraft, setKeyDraft] = useState('')
  const [customOpen, setCustomOpen] = useState(true)
  const [models, setModels] = useState<ModelRow[]>(() => {
    const overridden = row.modelsOverridden
    return modelRowsFromProfile(overridden ? draft : fallback)
  })
  const [discoverRows, setDiscoverRows] = useState<ModelRow[] | null>(null)
  const [discoverPick, setDiscoverPick] = useState<Set<string>>(new Set())
  const [discoverQuery, setDiscoverQuery] = useState('')

  const ownsIdentity = layout === 'pi-ai' && row.declared
  const modelsOverridden = Object.prototype.hasOwnProperty.call(draft, 'models')

  const baseURL = asString(draft.baseURL) ?? asString(fallback.baseURL) ?? ''
  const api = asString(draft.api) ?? asString(fallback.api) ?? protocolChoices[0] ?? 'openai-completions'

  const apply = () => {
    setFormError('')
    setBusy(true)
    const settingsPath = row.settingsPath.length ? row.settingsPath : layout === 'pi-ai' ? ['providers', row.provider] : []
    const keyOnly = settingsPath.length === 0 || layout === 'unknown'
    if (keyOnly) {
      const keyTrimmed = keyDraft.trim()
      if (!keyTrimmed) {
        setFormError('请输入 API 密钥')
        setBusy(false)
        return
      }
      void runtimeApi.setModelsCredential({ ref: row.keyRef, value: keyTrimmed }).then(() => {
        setKeyDraft('')
        onSaved()
        onClose()
      }).catch((cause) => {
        const message = cause instanceof Error ? cause.message : '保存失败'
        setFormError(message)
        setNote(message)
      }).finally(() => setBusy(false))
      return
    }
    const nextDraft = { ...draft }
    if (layout === 'pi-ai') nextDraft.models = models
    if (keyDraft.trim() && layout === 'pi-ai' && !asString(fallback.apiKeyEnv) && !asString(draft.apiKeyEnv) && keyDraft.trim()) {
      nextDraft.apiKeyEnv = row.keyRef
    }
    const ns = row.settingsNs || 'llm-pi-ai'
    void runtimeApi.applyModelsSettingsProvider({
      ns,
      provider: row.provider,
      settingsPath,
      draft: layout === 'unknown' ? {} : nextDraft,
      committedOriginal,
      expectedRevision,
      apiKey: keyDraft,
      keyRef: row.keyRef,
    }).then((data) => {
      if (data.view?.revision !== undefined) setExpectedRevision(data.view.revision)
      if (data.view?.user && settingsPath.length) {
        const segments = settingsPath
        let subtree: unknown = data.view.user
        for (const segment of segments) {
          if (!subtree || typeof subtree !== 'object') { subtree = undefined; break }
          subtree = (subtree as Record<string, unknown>)[segment]
        }
        setCommittedOriginal(subtree)
      }
      setKeyDraft('')
      onSaved()
      onClose()
    }).catch((cause) => {
      const message = cause instanceof Error ? cause.message : '保存失败'
      setFormError(message)
      setNote(message)
    }).finally(() => setBusy(false))
  }

  const resetModels = () => {
    setDraft((current) => {
      const next = { ...current }
      delete next.models
      return next
    })
    setModels(modelRowsFromProfile(fallback))
  }

  const filteredDiscover = (discoverRows || []).filter((m) => {
    const q = discoverQuery.trim().toLowerCase()
    if (!q) return true
    return m.id.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q)
  })

  return (
    <div className="px-3 pb-3 pt-2 border-t border-line bg-surface-2/40 space-y-3">
      <div className="text-sm font-medium">编辑 · {row.displayName}</div>
      {formError && <div className="text-xs text-accent-red">{formError}</div>}
      {!writable && <div className="text-xs text-ink-muted">当前部署只读，无法写入。</div>}

      <Field label="API 密钥" hint="只写不回显；留空则保留现有密钥。">
        <input
          className="input w-full"
          type="password"
          autoComplete="off"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder={row.credentialConfigured ? '已配置（输入新值以更换）' : '输入 API 密钥'}
          disabled={busy || !writable}
        />
      </Field>

      {layout !== 'unknown' && (
        <details open={customOpen} onToggle={(e) => setCustomOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="text-xs font-medium text-ink cursor-pointer select-none">自定义设置</summary>
          <div className="mt-3 space-y-3">
            {ownsIdentity && (
              <Field label="显示名称">
                <input
                  className="input w-full"
                  value={asString(draft.displayName) || ''}
                  onChange={(e) => setDraft((c) => ({ ...c, displayName: e.target.value }))}
                  disabled={busy || !writable}
                />
              </Field>
            )}
            {(layout === 'pi-ai' || layout === 'deepseek') && (
              <Field label="API 地址">
                <input
                  className="input w-full font-mono text-xs"
                  value={asString(draft.baseURL) || ''}
                  placeholder={asString(fallback.baseURL) || 'https://…'}
                  onChange={(e) => setDraft((c) => ({ ...c, baseURL: e.target.value }))}
                  disabled={busy || !writable}
                />
              </Field>
            )}
            {ownsIdentity && (
              <Field label="API 协议">
                <select
                  className="input w-full text-sm"
                  value={api}
                  onChange={(e) => setDraft((c) => ({ ...c, api: e.target.value }))}
                  disabled={busy || !writable}
                >
                  {protocolChoices.map((choice) => (
                    <option key={choice} value={choice}>{choice}</option>
                  ))}
                </select>
              </Field>
            )}
            {layout === 'pi-ai' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-ink">模型目录</div>
                  {modelsOverridden && (
                    <button type="button" className="text-[11px] underline text-ink-muted" disabled={busy || !writable} onClick={resetModels}>
                      恢复默认
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-40 overflow-auto rounded-lg border border-line bg-white p-2">
                  {models.map((model, index) => (
                    <div key={model.id} className="flex items-center gap-2 text-sm">
                      <input
                        className="input flex-1 font-mono text-xs"
                        value={model.id}
                        readOnly
                      />
                      <input
                        className="input flex-1 text-xs"
                        value={model.name || ''}
                        onChange={(e) => {
                          const name = e.target.value
                          setModels((list) => {
                            const next = list.map((m, i) => (i === index ? { ...m, name } : m))
                            setDraft((c) => ({ ...c, models: next }))
                            return next
                          })
                        }}
                        disabled={busy || !writable}
                      />
                      <button
                        type="button"
                        className="btn-ghost h-8 px-2 text-accent-red"
                        disabled={busy || !writable}
                        onClick={() => {
                          const next = models.filter((_, i) => i !== index)
                          setModels(next)
                          setDraft((c) => ({ ...c, models: next }))
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {models.length === 0 && <div className="text-[11px] text-ink-subtle">暂无模型行</div>}
                </div>
                <button
                  type="button"
                  className="btn w-full"
                  disabled={busy || !writable || !baseURL.trim()}
                  onClick={() => {
                    setBusy(true)
                    setFormError('')
                    void runtimeApi.discoverAiModels({
                      provider: row.provider,
                      baseURL: baseURL.trim(),
                      api,
                      apiKey: keyDraft.trim() || undefined,
                    }).then((found) => {
                      if (!found.length) {
                        setFormError('没有返回模型')
                        return
                      }
                      const known = new Set(models.map((m) => m.id))
                      setDiscoverRows(found.map((f) => ({ id: f.id, name: f.name })))
                      setDiscoverPick(new Set(found.filter((f) => !known.has(f.id)).map((f) => f.id)))
                    }).catch((cause) => setFormError(cause instanceof Error ? cause.message : '获取失败')).finally(() => setBusy(false))
                  }}
                >
                  获取可用模型
                </button>
                {discoverRows && (
                  <div className="rounded-lg border border-line bg-white p-2 space-y-2">
                    <input
                      className="input w-full text-xs"
                      placeholder="搜索模型 id 或名称"
                      value={discoverQuery}
                      onChange={(e) => setDiscoverQuery(e.target.value)}
                    />
                    <div className="max-h-36 overflow-auto space-y-1">
                      {filteredDiscover.map((m) => (
                        <label key={m.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={discoverPick.has(m.id)}
                            onChange={() => {
                              setDiscoverPick((current) => {
                                const next = new Set(current)
                                if (next.has(m.id)) next.delete(m.id)
                                else next.add(m.id)
                                return next
                              })
                            }}
                          />
                          <span className="font-mono">{m.id}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn" onClick={() => { setDiscoverRows(null); setDiscoverPick(new Set()) }}>取消</button>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={discoverPick.size === 0}
                        onClick={() => {
                          const picked = (discoverRows || []).filter((m) => discoverPick.has(m.id))
                          const next = mergeDiscover(models, picked)
                          setModels(next)
                          setDraft((c) => ({ ...c, models: next }))
                          setDiscoverRows(null)
                          setDiscoverPick(new Set())
                        }}
                      >
                        添加所选
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>取消</button>
        <button type="button" className="btn-primary" disabled={busy || !writable} onClick={apply}>应用</button>
      </div>
    </div>
  )
}

function AddCatalogCard({
  rows,
  provider,
  onProviderChange,
  busy,
  formError,
  setFormError,
  setBusy,
  onClose,
  onSaved,
  setNote,
}: {
  rows: ModelsSettingsRow[]
  provider: string
  onProviderChange: (provider: string) => void
  busy: boolean
  formError: string
  setFormError: (value: string) => void
  setBusy: (value: boolean) => void
  onClose: () => void
  onSaved: () => void
  setNote: (value: string) => void
}) {
  const [key, setKey] = useState('')
  const row = rows.find((r) => r.provider === provider)

  return (
    <div className="mt-4 p-4 rounded-xl border border-line bg-surface-2 space-y-3">
      <div className="text-sm font-medium">添加提供方</div>
      {formError && <div className="text-xs text-accent-red">{formError}</div>}
      <Field label="提供方">
        <select className="input w-full text-sm" value={provider} onChange={(e) => onProviderChange(e.target.value)}>
          {rows.map((r) => (
            <option key={r.provider} value={r.provider}>{r.displayName}{r.credentialConfigured ? '（已配置）' : ''}</option>
          ))}
        </select>
      </Field>
      <Field label="API 密钥">
        <input className="input w-full" type="password" value={key} onChange={(e) => setKey(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>取消</button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !provider || !key.trim()}
          onClick={() => {
            setBusy(true)
            setFormError('')
            void runtimeApi.addAiProvider({ provider, apiKey: key.trim() }).then(onSaved).catch((cause) => {
              setFormError(cause instanceof Error ? cause.message : '保存失败')
              setNote(formError)
            }).finally(() => setBusy(false))
          }}
        >
          保存
        </button>
      </div>
      {row && row.settingsNs && row.settingsPath.length > 0 && (
        <p className="text-[11px] text-ink-subtle">保存密钥后可在列表点「编辑」改折叠字段与模型目录。</p>
      )}
    </div>
  )
}

function AddCustomCard({
  protocolChoices,
  busy,
  formError,
  setFormError,
  setBusy,
  onClose,
  onSaved,
}: {
  protocolChoices: string[]
  busy: boolean
  formError: string
  setFormError: (value: string) => void
  setBusy: (value: boolean) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [route, setRoute] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [api, setApi] = useState(protocolChoices[0] || 'openai-completions')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<ModelRow[]>([])
  const [discoverRows, setDiscoverRows] = useState<ModelRow[] | null>(null)
  const [discoverPick, setDiscoverPick] = useState<Set<string>>(new Set())
  const [manualId, setManualId] = useState('')

  const create = () => {
    setFormError('')
    setBusy(true)
    const payloadModels = models.length
      ? models
      : manualId.trim() ? [{ id: manualId.trim(), name: manualId.trim() }] : []
    void runtimeApi.addCustomAiProvider({
      route: route.trim(),
      displayName: displayName.trim() || undefined,
      baseURL: baseURL.trim(),
      api,
      apiKey: apiKey.trim() || undefined,
      models: payloadModels.map((m) => ({ id: m.id, name: m.name || m.id })),
    }).then(onSaved).catch((cause) => setFormError(cause instanceof Error ? cause.message : '创建失败')).finally(() => setBusy(false))
  }

  return (
    <div className="mt-4 p-4 rounded-xl border border-line bg-surface-2 space-y-3">
      <div className="text-sm font-medium">添加自定义提供方</div>
      {formError && <div className="text-xs text-accent-red">{formError}</div>}
      <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
        <Field label="提供方 ID" hint="小写字母开头，只能含小写字母、数字和连字符。">
          <input className="input w-full font-mono text-xs" value={route} onChange={(e) => setRoute(e.target.value)} />
        </Field>
        <Field label="显示名称">
          <input className="input w-full" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="API 地址">
          <input className="input w-full font-mono text-xs" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} />
        </Field>
        <Field label="API 协议">
          <select className="input w-full text-sm" value={api} onChange={(e) => setApi(e.target.value)}>
            {protocolChoices.map((choice) => (
              <option key={choice} value={choice}>{choice}</option>
            ))}
          </select>
        </Field>
        <Field label="API 密钥">
          <input className="input w-full" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            className="btn w-full"
            disabled={busy || !baseURL.trim()}
            onClick={() => {
              setBusy(true)
              void runtimeApi.discoverAiModels({
                provider: route.trim() || undefined,
                baseURL: baseURL.trim(),
                api,
                apiKey: apiKey.trim() || undefined,
              }).then((found) => {
                setDiscoverRows(found.map((f) => ({ id: f.id, name: f.name })))
                setDiscoverPick(new Set(found.map((f) => f.id)))
              }).catch((cause) => setFormError(cause instanceof Error ? cause.message : '获取失败')).finally(() => setBusy(false))
            }}
          >
            获取可用模型
          </button>
        </div>
      </div>
      {discoverRows && (
        <div className="rounded-lg border border-line bg-white p-2 space-y-2 max-h-48 overflow-auto">
          {discoverRows.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={discoverPick.has(m.id)}
                onChange={() => {
                  setDiscoverPick((current) => {
                    const next = new Set(current)
                    if (next.has(m.id)) next.delete(m.id)
                    else next.add(m.id)
                    return next
                  })
                }}
              />
              <span className="font-mono">{m.id}</span>
            </label>
          ))}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={discoverPick.size === 0}
            onClick={() => {
              const picked = discoverRows.filter((m) => discoverPick.has(m.id))
              setModels(mergeDiscover(models, picked))
              setDiscoverRows(null)
              setDiscoverPick(new Set())
            }}
          >
            添加所选
          </button>
        </div>
      )}
      <Field label="模型 ID（无列表时手填）">
        <input className="input w-full font-mono text-xs" value={manualId} onChange={(e) => setManualId(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>取消</button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !route.trim() || !baseURL.trim() || (models.length === 0 && !manualId.trim())}
          onClick={create}
        >
          创建
        </button>
      </div>
    </div>
  )
}
