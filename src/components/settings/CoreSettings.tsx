import { useEffect, useState, type ReactNode } from 'react'
import { Bot, ChevronDown, Copy, Trash2, Upload } from 'lucide-react'
import clsx from 'clsx'
import { Card, Tag } from '@/components/ui'
import { runtimeApi, type AiPresetRecord } from '@/lib/runtime-api'
import { PresetImportDrawer, sourceLabel } from '@/components/settings/PresetImportDrawer'

const PROVIDER_LIST_COLLAPSE_AT = 4

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink mb-1.5">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-ink-subtle mt-1 leading-5">{hint}</div> : null}
    </label>
  )
}

export function CoreSettings() {
  const [connected, setConnected] = useState(false)
  const [note, setNote] = useState('')
  const [providers, setProviders] = useState<Array<{ provider: string; displayName: string; active: boolean; configured: boolean; keyRef: string }>>([])
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [panel, setPanel] = useState<null | 'catalog' | 'custom'>(null)
  const [formError, setFormError] = useState('')
  const [pickProvider, setPickProvider] = useState('')
  const [pickKey, setPickKey] = useState('')
  const [custom, setCustom] = useState({
    route: '',
    displayName: '',
    baseURL: '',
    api: 'openai-completions',
    apiKey: '',
    modelId: '',
    modelName: '',
  })
  const [foundModels, setFoundModels] = useState<Array<{ id: string; name: string }>>([])
  const [pickedModels, setPickedModels] = useState<string[]>([])
  const [presets, setPresets] = useState<AiPresetRecord[]>([])
  const [copyFrom, setCopyFrom] = useState('')
  const [copyId, setCopyId] = useState('')
  const [copyName, setCopyName] = useState('')
  const [busy, setBusy] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const load = () => {
    void runtimeApi.aiStatus().then((status) => setConnected(Boolean(status.connected))).catch(() => setConnected(false))
    void runtimeApi.listAiProviders().then((data) => {
      setProviders(data.providers || [])
      const next = (data.providers || []).find((row) => !row.configured)
      if (next) setPickProvider((current) => current || next.provider)
    }).catch(() => setProviders([]))
    void runtimeApi.aiModels().then((catalog) => {
      setModels((catalog.groups || []).flatMap((group) => group.models.map((model) => ({ id: model.id, name: model.name }))))
    }).catch(() => setModels([]))
    void runtimeApi.listAiPresets().then((data) => {
      setPresets(data.presets || [])
      if (data.presets?.[0]?.id) setCopyFrom((current) => current || data.presets[0].id)
    }).catch(() => setPresets([]))
  }

  useEffect(() => { load() }, [])

  const configuredProviders = providers.filter((row) => row.configured)
  const canCollapseProviders = providers.length > PROVIDER_LIST_COLLAPSE_AT
  const showProviderList = !canCollapseProviders || providersOpen

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0"><Bot size={16} /></div>
          <div>
            <div className="text-base font-medium">模型与提供方</div>
            <div className="text-xs text-ink-muted mt-0.5">添加官方提供方或自定义网关，获取模型列表后写入本机核心。不要嵌 DSH 整页。</div>
          </div>
        </div>
        {!connected && <div className="mb-3 text-xs text-ink-muted">先打开 AI 页连上核心，创建后才会进正在跑的 DSH；未连接时仍会写入配置文件。</div>}
        {note && <div className="mb-3 text-xs text-ink-muted">{note}</div>}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setNote('正在重载核心…')
              void runtimeApi.reloadAi().then((status) => {
                setConnected(Boolean(status.connected))
                setNote(status.connected ? '4318 与 DSH 已重载' : '核心已停下')
                load()
              }).catch((cause) => {
                setNote(cause instanceof Error ? cause.message : '重载失败')
              }).finally(() => setBusy(false))
            }}
          >
            重载核心
          </button>
          <span className="text-[11px] text-ink-subtle">停掉再拉起 4318 本地核心和 DSH。界面不用关，对话会短暂断开。</span>
        </div>
        {providers.length > 0 && (
          <div className="mb-4">
            {canCollapseProviders && (
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-line hover:bg-surface-2 text-left"
                aria-expanded={providersOpen}
                onClick={() => setProvidersOpen((open) => !open)}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {providers.length} 个提供方
                    {configuredProviders.length > 0 ? ` · ${configuredProviders.length} 已配置` : ''}
                  </div>
                  {!providersOpen && (
                    <div className="text-[11px] text-ink-subtle mt-0.5 truncate">
                      {configuredProviders.length > 0
                        ? configuredProviders.map((row) => row.displayName).join('、')
                        : '未配置密钥，展开后添加'}
                    </div>
                  )}
                </div>
                <span className="flex items-center gap-1.5 shrink-0 text-xs text-ink-muted">
                  {providersOpen ? '收起' : '展开'}
                  <ChevronDown size={14} className={clsx('text-ink-subtle transition-transform', providersOpen && 'rotate-180')} />
                </span>
              </button>
            )}
            {showProviderList && (
              <div className={clsx('space-y-2', canCollapseProviders && 'mt-2')}>
                {providers.map((row) => (
                  <div key={row.provider} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-line">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{row.displayName}</div>
                      <div className="text-[11px] text-ink-subtle font-mono">{row.provider}</div>
                    </div>
                    <Tag kind={row.configured ? 'green' : 'amber'}>{row.configured ? 'API 密钥已配置' : 'API 密钥缺失'}</Tag>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {models.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {models.map((model) => (
              <span key={model.id} className="px-2.5 py-1 rounded-full border border-line bg-surface-2 text-xs">{model.name}</span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-2">
          <button type="button" className="h-12 rounded-xl border border-dashed border-line text-sm text-ink-muted hover:border-brand hover:text-ink" onClick={() => { setFormError(''); setPanel(panel === 'catalog' ? null : 'catalog') }}>
            + 添加提供方
          </button>
          <button type="button" className="h-12 rounded-xl border border-dashed border-line text-sm text-ink-muted hover:border-brand hover:text-ink" onClick={() => { setFormError(''); setPanel(panel === 'custom' ? null : 'custom') }}>
            + 添加自定义提供方
          </button>
        </div>

        {panel === 'catalog' && (
          <div className="mt-4 p-4 rounded-xl border border-line bg-surface-2 space-y-3">
            <div className="text-sm font-medium">添加提供方</div>
            {formError && <div className="text-xs text-accent-red">{formError}</div>}
            <Field label="提供方">
              <select className="input w-full text-sm" value={pickProvider} onChange={(e) => setPickProvider(e.target.value)}>
                {providers.map((row) => (
                  <option key={row.provider} value={row.provider}>{row.displayName}{row.configured ? '（已配置）' : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="API 密钥">
              <input className="input w-full" type="password" value={pickKey} onChange={(e) => setPickKey(e.target.value)} placeholder="输入 API 密钥" />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setPanel(null)}>取消</button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !pickProvider || !pickKey.trim()}
                onClick={() => {
                  setBusy(true)
                  setFormError('')
                  void runtimeApi.addAiProvider({ provider: pickProvider, apiKey: pickKey.trim() }).then(() => {
                    setPickKey('')
                    setPanel(null)
                    setNote('提供方已保存。请重新连接核心后，在会话右侧切换模型。')
                    load()
                  }).catch((cause) => setFormError(cause instanceof Error ? cause.message : '添加失败')).finally(() => setBusy(false))
                }}
              >{busy ? '保存中…' : '保存'}</button>
            </div>
          </div>
        )}

        {panel === 'custom' && (
          <div className="mt-4 p-4 rounded-xl border border-line bg-surface-2 space-y-3">
            <div className="text-sm font-medium">自定义提供方</div>
            {formError && <div className="text-xs text-accent-red">{formError}</div>}
            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
              <Field label="提供方 ID" hint="小写字母开头，只能含小写字母、数字和连字符。">
                <input className="input w-full font-mono text-xs" value={custom.route} onChange={(e) => setCustom((c) => ({ ...c, route: e.target.value }))} placeholder="grok2api" />
              </Field>
              <Field label="显示名">
                <input className="input w-full" value={custom.displayName} onChange={(e) => setCustom((c) => ({ ...c, displayName: e.target.value }))} />
              </Field>
              <Field label="API 地址">
                <input className="input w-full font-mono text-xs" value={custom.baseURL} onChange={(e) => setCustom((c) => ({ ...c, baseURL: e.target.value }))} placeholder="http://127.0.0.1:8000/v1" />
              </Field>
              <Field label="API 协议">
                <select className="input w-full text-sm" value={custom.api} onChange={(e) => setCustom((c) => ({ ...c, api: e.target.value }))}>
                  <option value="openai-completions">openai-completions</option>
                  <option value="openai-responses">openai-responses</option>
                  <option value="anthropic-messages">anthropic-messages</option>
                  <option value="google-generative-ai">google-generative-ai</option>
                </select>
              </Field>
              <Field label="API 密钥">
                <input className="input w-full" type="password" value={custom.apiKey} onChange={(e) => setCustom((c) => ({ ...c, apiKey: e.target.value }))} />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn w-full"
                  disabled={busy || !custom.baseURL.trim()}
                  onClick={() => {
                    setBusy(true)
                    setFormError('')
                    void runtimeApi.discoverAiModels({
                      provider: custom.route.trim() || undefined,
                      baseURL: custom.baseURL.trim(),
                      api: custom.api,
                      apiKey: custom.apiKey.trim() || undefined,
                    }).then((rows) => {
                      setFoundModels(rows)
                      setPickedModels(rows.map((row) => row.id))
                      if (!rows.length) setFormError('没有返回模型，请手工填模型 ID')
                    }).catch((cause) => setFormError(cause instanceof Error ? cause.message : '获取模型失败')).finally(() => setBusy(false))
                  }}
                >{busy ? '正在获取…' : '获取可用模型'}</button>
              </div>
            </div>
            {foundModels.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border border-line bg-white p-2 space-y-1">
                <div className="flex justify-between text-[11px] text-ink-subtle px-1 mb-1">
                  <span>选择要加入的模型</span>
                  <button type="button" className="underline" onClick={() => setPickedModels(pickedModels.length === foundModels.length ? [] : foundModels.map((row) => row.id))}>
                    {pickedModels.length === foundModels.length ? '取消全选' : '全选'}
                  </button>
                </div>
                {foundModels.map((row) => (
                  <label key={row.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={pickedModels.includes(row.id)}
                      onChange={() => setPickedModels((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])}
                    />
                    <span className="font-mono text-xs">{row.id}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
              <Field label="模型 ID" hint="拉不到列表时再手工填。">
                <input className="input w-full font-mono text-xs" value={custom.modelId} onChange={(e) => setCustom((c) => ({ ...c, modelId: e.target.value }))} placeholder="grok-4.6" />
              </Field>
              <Field label="模型显示名">
                <input className="input w-full" value={custom.modelName} onChange={(e) => setCustom((c) => ({ ...c, modelName: e.target.value }))} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setPanel(null)}>取消</button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !custom.route.trim() || !custom.baseURL.trim() || (pickedModels.length === 0 && !custom.modelId.trim())}
                onClick={() => {
                  setBusy(true)
                  setFormError('')
                  void runtimeApi.addCustomAiProvider({
                    route: custom.route.trim(),
                    displayName: custom.displayName.trim() || undefined,
                    baseURL: custom.baseURL.trim(),
                    api: custom.api,
                    apiKey: custom.apiKey.trim() || undefined,
                    modelId: custom.modelId.trim() || undefined,
                    modelName: custom.modelName.trim() || undefined,
                    models: pickedModels.map((id) => ({ id, name: foundModels.find((row) => row.id === id)?.name || id })),
                    reasoning: true,
                  }).then((data) => {
                    setPanel(null)
                    setFoundModels([])
                    setPickedModels([])
                    setCustom({ route: '', displayName: '', baseURL: '', api: 'openai-completions', apiKey: '', modelId: '', modelName: '' })
                    setNote(String(data.hint || '已保存自定义提供方。请重新连接核心。'))
                    load()
                  }).catch((cause) => setFormError(cause instanceof Error ? cause.message : '创建失败')).finally(() => setBusy(false))
                }}
              >{busy ? '创建中…' : '创建提供方'}</button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="text-base font-medium">Agent 预设</div>
            <div className="text-xs text-ink-muted mt-0.5">可导入开源 preset；用户来源可删，随包与 FDE 预设不可删。</div>
          </div>
          <button type="button" className="btn h-8 px-2 shrink-0" onClick={() => setImportOpen(true)}><Upload size={14} /> 导入</button>
        </div>
        <div className="space-y-2 mb-4 mt-3">
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-line">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{preset.name || preset.id}</span>
                  {preset.isDefault && <Tag kind="blue">默认</Tag>}
                  <Tag kind="default">{sourceLabel(preset.source)}</Tag>
                  {preset.hasLocalCode && <Tag kind="amber">含本地代码</Tag>}
                  <Tag kind={preset.trust === 'system' ? 'green' : 'amber'}>{preset.trust === 'system' ? '系统' : '我的'}</Tag>
                </div>
                <div className="text-[11px] text-ink-subtle mt-0.5 font-mono">{preset.id}</div>
              </div>
              {preset.source === 'user' && (
                <button
                  type="button"
                  className="btn-ghost h-8 px-2 text-accent-red"
                  onClick={() => {
                    if (!window.confirm(`删除预设 ${preset.name || preset.id}？`)) return
                    void runtimeApi.deleteAiPreset(preset.id).then((data) => setPresets(data.presets || [])).catch((cause) => setNote(cause instanceof Error ? cause.message : '删除失败'))
                  }}
                ><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 @md:grid-cols-3 gap-2">
          <Field label="从哪个复制">
            <select className="input w-full text-sm" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name || preset.id}</option>)}
            </select>
          </Field>
          <Field label="新 id">
            <input className="input w-full font-mono text-xs" value={copyId} onChange={(e) => setCopyId(e.target.value)} placeholder="my-writer" />
          </Field>
          <Field label="显示名">
            <input className="input w-full text-sm" value={copyName} onChange={(e) => setCopyName(e.target.value)} />
          </Field>
        </div>
        <button
          type="button"
          className="btn-primary mt-3"
          disabled={busy || !copyFrom || !copyId.trim()}
          onClick={() => {
            setBusy(true)
            void runtimeApi.copyAiPreset({ from: copyFrom, id: copyId.trim(), name: copyName.trim() || undefined })
              .then((data) => {
                setPresets(data.presets || [])
                setCopyId('')
                setCopyName('')
                setNote('已复制预设')
              })
              .catch((cause) => setNote(cause instanceof Error ? cause.message : '复制失败'))
              .finally(() => setBusy(false))
          }}
        ><Copy size={14} /> 复制为新预设</button>
      </Card>
      <PresetImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void runtimeApi.listAiPresets().then((data) => {
            setPresets(data.presets || [])
            setNote('已导入 preset。新会话时可见；若未出现请重载核心。')
          })
        }}
      />
    </div>
  )
}
