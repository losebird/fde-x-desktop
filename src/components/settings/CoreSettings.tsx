import { useEffect, useState } from 'react'
import { Bot, ChevronDown, ChevronRight, Copy, Trash2, Upload } from 'lucide-react'
import { Card, Tag } from '@/components/ui'
import { runtimeApi, type AiPresetRecord } from '@/lib/runtime-api'
import { PresetImportDrawer, sourceLabel } from '@/components/settings/PresetImportDrawer'
import { ModelsProvidersSection } from '@/components/settings/ModelsProvidersSection'
import { HostNsPanel } from '@/components/settings/HostNsPanel'
import { hostText } from '@/lib/host-text'

export function CoreSettings() {
  const [connected, setConnected] = useState(false)
  const [bffOrigin, setBffOrigin] = useState('')
  const [note, setNote] = useState('')
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [presets, setPresets] = useState<AiPresetRecord[]>([])
  const [presetActions, setPresetActions] = useState<string[]>([])
  const [plugins, setPlugins] = useState<Array<{ id: string; title: string; fields?: Record<string, unknown> }>>([])
  const [pluginActions, setPluginActions] = useState<string[]>([])
  const [modelQuery, setModelQuery] = useState('')
  const [openBundle, setOpenBundle] = useState('')
  const [includeEnabled, setIncludeEnabled] = useState<Record<string, boolean>>({})
  const [copyFrom, setCopyFrom] = useState('')
  const [copyId, setCopyId] = useState('')
  const [copyName, setCopyName] = useState('')
  const [busy, setBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const refreshModels = () => {
    void runtimeApi.aiModels().then((catalog) => {
      setModels((catalog.groups || []).flatMap((group) => group.models.map((model) => ({ id: model.id, name: model.name }))))
    }).catch(() => setModels([]))
  }

  const load = () => {
    void runtimeApi.aiStatus().then((status) => {
      setConnected(Boolean(status.connected))
      if (status.bffOrigin) setBffOrigin(String(status.bffOrigin))
    }).catch(() => setConnected(false))
    refreshModels()
    void runtimeApi.listAiPresets().then((data) => {
      setPresets(data.presets || [])
      setPresetActions(Array.isArray(data.actions) ? data.actions : [])
      if (data.presets?.[0]?.id) setCopyFrom((current) => current || data.presets[0].id)
    }).catch(() => setPresets([]))
    void runtimeApi.catalogBag('plugin').then((bag) => {
      setPluginActions(Array.isArray(bag.actions) ? bag.actions : [])
      setPlugins(Array.isArray(bag.items) ? bag.items.map((row) => ({
        id: row.id,
        title: row.title,
        fields: row.fields && typeof row.fields === 'object' ? row.fields as Record<string, unknown> : {},
      })) : [])
      if (bag.error) setNote(String(bag.error))
    }).catch((cause) => {
      setPlugins([])
      setPluginActions([])
      setNote(cause instanceof Error ? cause.message : '插件目录读失败')
    })
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0"><Bot size={16} /></div>
          <div>
            <div className="text-base font-medium">模型与提供方</div>
            <div className="text-xs text-ink-muted mt-0.5">与 DSH Models 页同一账本：展开一行编辑卡，改密钥、网关与模型目录。不要嵌 DSH 整页。</div>
          </div>
        </div>
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
                if (status.bffOrigin) setBffOrigin(String(status.bffOrigin))
                const label = status.bffOrigin || bffOrigin || '本地 BFF'
                setNote(status.connected ? `${label} 与 DSH 已重载` : '核心已停下')
                load()
              }).catch((cause) => {
                setNote(cause instanceof Error ? cause.message : '重载失败')
              }).finally(() => setBusy(false))
            }}
          >
            重载核心
          </button>
          <span className="text-[11px] text-ink-subtle">
            停掉再拉起{bffOrigin ? ` ${bffOrigin} ` : ' '}本地 BFF 和 DSH。界面不用关，对话会短暂断开。
          </span>
        </div>

        <ModelsProvidersSection
          connected={connected}
          busy={busy}
          setBusy={setBusy}
          note={note}
          setNote={setNote}
          onModelsRefresh={refreshModels}
        />

        {models.length > 0 && (
          <div className="mt-4 space-y-2">
            <input
              className="input w-full text-xs"
              value={modelQuery}
              onChange={(event) => setModelQuery(event.target.value)}
              placeholder="搜索模型 id 或名称"
            />
            <div className="flex flex-wrap gap-1.5">
              {models.filter((model) => {
                const q = modelQuery.trim().toLowerCase()
                if (!q) return true
                return model.id.toLowerCase().includes(q) || model.name.toLowerCase().includes(q)
              }).map((model) => (
                <span key={model.id} className="px-2.5 py-1 rounded-full border border-line bg-surface-2 text-xs" title={model.id}>{model.name}</span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="text-base font-medium">插件</div>
        <div className="text-xs text-ink-muted mt-0.5 mb-3">当前宿主加载的插件。未知能力落这里。</div>
        {plugins.length === 0 ? (
          <div className="text-sm text-ink-muted py-6 text-center">{note && note.includes('插件') ? note : '没有插件目录'}</div>
        ) : (
          <div className="space-y-2">
            {plugins.filter((plugin) => !String(plugin.id).startsWith('include:')).map((plugin) => {
              const enabled = plugin.fields?.enabled
              const phase = plugin.fields?.fiberPhase
              const bundle = plugin.fields?.bundle === true
              const enableAction = bundle ? 'setBundleEnabled' : 'setPluginEnabled'
              const childRows = Array.isArray(plugin.fields?.rows) ? plugin.fields.rows as Array<Record<string, unknown>> : []
              const open = openBundle === plugin.id
              const meta = plugin.fields?.meta && typeof plugin.fields.meta === 'object' ? plugin.fields.meta as Record<string, unknown> : {}
              const title = hostText(meta.title) || plugin.title
              const hint = hostText(meta.description)
              return (
                <div key={plugin.id} className="rounded-lg border border-line">
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    {childRows.length > 0 ? (
                      <button
                        type="button"
                        className="mt-0.5 text-ink-subtle shrink-0"
                        onClick={() => setOpenBundle(open ? '' : plugin.id)}
                        aria-expanded={open}
                      >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    ) : <span className="w-3.5 shrink-0" />}
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => childRows.length && setOpenBundle(open ? '' : plugin.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{title}</span>
                        {enabled === true && <Tag kind="green">启用</Tag>}
                        {enabled === false && <Tag kind="default">停用</Tag>}
                        {bundle && <Tag kind="amber">可选包</Tag>}
                        {typeof phase === 'string' && phase && <Tag kind="default">{phase}</Tag>}
                      </div>
                      {hint && <div className="text-xs text-ink-muted mt-0.5 leading-5">{hint}</div>}
                      <div className="text-[11px] text-ink-subtle mt-0.5 font-mono truncate">{plugin.id}</div>
                    </button>
                    {pluginActions.includes(enableAction) && typeof enabled === 'boolean' && (
                      <button
                        type="button"
                        className="btn-ghost h-8 px-2 text-xs shrink-0"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true)
                          void runtimeApi.catalogAction({
                            kind: 'plugin',
                            action: enableAction,
                            id: plugin.id,
                            params: bundle
                              ? { name: String(plugin.fields?.name || plugin.id), enabled: !enabled }
                              : { enabled: !enabled },
                          }).then(() => {
                            if (bundle) setNote('已改可选包，用上面的「重载核心」生效')
                            load()
                          }).catch((cause) => setNote(cause instanceof Error ? cause.message : '改不了这条插件')).finally(() => setBusy(false))
                        }}
                      >
                        {enabled ? '停用' : '启用'}
                      </button>
                    )}
                  </div>
                  {open && childRows.map((row, index) => {
                    const entryId = String(row.entryId || row.id || '')
                    const moduleName = String(row.moduleName || row.name || entryId)
                    const childMeta = row.meta && typeof row.meta === 'object' ? row.meta as Record<string, unknown> : {}
                    const child = plugins.find((item) => item.id === entryId || item.fields?.entryId === entryId || item.fields?.moduleName === moduleName)
                    const childEnabled = includeEnabled[entryId] ?? (typeof child?.fields?.enabled === 'boolean'
                      ? child.fields.enabled
                      : enabled === true)
                    const childTitle = hostText(childMeta.title) || moduleName
                    const childHint = hostText(childMeta.description)
                    return (
                      <div key={entryId || String(index)} className="flex items-start gap-3 px-3 py-2.5 border-t border-line">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm">{childTitle}</span>
                            {childEnabled ? <Tag kind="green">运行中</Tag> : <Tag kind="default">已停</Tag>}
                          </div>
                          {childHint && <div className="text-xs text-ink-muted mt-0.5 leading-5">{childHint}</div>}
                          <div className="text-[11px] text-ink-subtle mt-0.5 font-mono truncate">{moduleName}</div>
                        </div>
                        {pluginActions.includes('setPluginEnabled') && entryId && (
                          <button
                            type="button"
                            className="btn-ghost h-8 px-2 text-xs shrink-0"
                            disabled={busy}
                            onClick={() => {
                              setBusy(true)
                              void runtimeApi.catalogAction({
                                kind: 'plugin',
                                action: 'setPluginEnabled',
                                id: entryId,
                                params: { id: entryId, enabled: !childEnabled },
                              }).then((result) => {
                                const mutation = result && typeof result === 'object' ? (result as { mutation?: { target?: string; enabled?: boolean; changed?: boolean } }).mutation : null
                                const target = String(mutation?.target || entryId)
                                if (mutation && typeof mutation.enabled === 'boolean') {
                                  setIncludeEnabled((current) => ({ ...current, [target]: mutation.enabled === true }))
                                }
                                setNote(mutation?.changed === false ? 'Host 没有改这条子组件' : '已改子组件，用上面的「重载核心」生效')
                                load()
                              }).catch((cause) => setNote(cause instanceof Error ? cause.message : '改不了这条插件')).finally(() => setBusy(false))
                            }}
                          >
                            {childEnabled ? '停用' : '启用'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <HostNsPanel
        home="core"
        title="Host 配置"
        hint="这一节只放别处没有活口的 Host 项。模型与提供方、外观、账户、画布壳不在这里。"
      />

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
                </div>
                {preset.description && <div className="text-xs text-ink-muted mt-0.5">{preset.description}</div>}
                <div className="text-[11px] text-ink-subtle mt-0.5 font-mono">{preset.id}</div>
              </div>
              {preset.source === 'user' && presetActions.includes('deletePreset') && (
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
        {presetActions.includes('copy') && (
          <>
            <div className="grid grid-cols-1 @md:grid-cols-3 gap-2">
              <label className="block">
                <div className="text-xs font-medium text-ink mb-1.5">从哪个复制</div>
                <select className="input w-full text-sm" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                  {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name || preset.id}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-medium text-ink mb-1.5">新 id</div>
                <input className="input w-full font-mono text-xs" value={copyId} onChange={(e) => setCopyId(e.target.value)} placeholder="my-writer" />
              </label>
              <label className="block">
                <div className="text-xs font-medium text-ink mb-1.5">显示名</div>
                <input className="input w-full text-sm" value={copyName} onChange={(e) => setCopyName(e.target.value)} />
              </label>
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
          </>
        )}
      </Card>
      <PresetImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void runtimeApi.listAiPresets().then((data) => {
            setPresets(data.presets || [])
            setPresetActions(Array.isArray(data.actions) ? data.actions : [])
            setNote('已导入 preset。新会话时可见；若未出现请重载核心。')
          })
        }}
      />
    </div>
  )
}
