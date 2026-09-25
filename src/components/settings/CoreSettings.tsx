import { useEffect, useState } from 'react'
import { Bot, Copy, Trash2, Upload } from 'lucide-react'
import { Card, Tag } from '@/components/ui'
import { runtimeApi, type AiPresetRecord } from '@/lib/runtime-api'
import { PresetImportDrawer, sourceLabel } from '@/components/settings/PresetImportDrawer'
import { ModelsProvidersSection } from '@/components/settings/ModelsProvidersSection'

export function CoreSettings() {
  const [connected, setConnected] = useState(false)
  const [bffOrigin, setBffOrigin] = useState('')
  const [note, setNote] = useState('')
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [presets, setPresets] = useState<AiPresetRecord[]>([])
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
      if (data.presets?.[0]?.id) setCopyFrom((current) => current || data.presets[0].id)
    }).catch(() => setPresets([]))
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
          <div className="flex flex-wrap gap-1.5 mt-4">
            {models.map((model) => (
              <span key={model.id} className="px-2.5 py-1 rounded-full border border-line bg-surface-2 text-xs">{model.name}</span>
            ))}
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
