import { useEffect, useState } from 'react'
import { DrawerShell } from '@/components/DrawerShell'
import {
  runtimeApi,
  type BriefingDefinition,
  type BriefingSchedule,
  type BriefingSectionDef,
} from '@/lib/runtime-api'

const SECTION_TYPES: Array<{ type: BriefingSectionDef['type']; label: string; render: string }> = [
  { type: 'tasks', label: '待办', render: 'list' },
  { type: 'events', label: '日程', render: 'timeline' },
  { type: 'im', label: '未读 IM', render: 'list' },
  { type: 'biz', label: '业务待审', render: 'list' },
  { type: 'memory', label: '记忆', render: 'list' },
  { type: 'app', label: '应用统计', render: 'stat' },
  { type: 'mcp', label: 'MCP 外部源', render: 'digest' },
  { type: 'ai', label: 'AI 摘要', render: 'digest' },
]

type Props = {
  open: boolean
  definition: BriefingDefinition | null
  onClose: () => void
  onSaved: (def: BriefingDefinition) => void
}

export function BriefingSettingsDrawer({ open, definition, onClose, onSaved }: Props) {
  const [sections, setSections] = useState<BriefingSectionDef[]>([])
  const [schedule, setSchedule] = useState<BriefingSchedule>({})
  const [mcpServers, setMcpServers] = useState<string[]>([])
  const [apps, setApps] = useState<Array<{ slug: string; name: string }>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !definition) return
    setSections(definition.sections.map((s) => ({ ...s })))
    setSchedule({ ...definition.schedule })
    void runtimeApi.listBriefingMcpSources().then((data) => {
      setMcpServers(data.servers.map((s) => s.serverName))
    }).catch(() => setMcpServers([]))
    void fetch(`${import.meta.env.VITE_FDE_RUNTIME_URL || ''}/api/v1/apps?${new URLSearchParams({ workspace: definition.workspaceCwd })}`)
      .then((r) => r.json())
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data as Array<{ id: string; name: string; slug?: string }> : []
        setApps(rows.map((r) => ({ slug: r.slug || r.id, name: r.name })))
      })
      .catch(() => setApps([]))
  }, [open, definition])

  if (!open || !definition) return null

  const move = (index: number, dir: -1 | 1) => {
    const next = [...sections]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    setSections(next)
  }

  const addSection = (type: string) => {
    const meta = SECTION_TYPES.find((t) => t.type === type)
    if (!meta) return
    const id = `${type}-${Date.now()}`
    setSections([...sections, {
      id,
      type: meta.type,
      title: meta.label,
      enabled: true,
      render: meta.render,
      params: type === 'mcp' ? { server: '', tool: '', args: {}, summarize: true } : {},
    }])
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const saved = await runtimeApi.putBriefingDefinition({
        sections,
        schedule,
        sources: definition.sources,
      })
      onSaved(saved)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md shadow-xl">
      <DrawerShell title="自定义早报" subtitle="区块顺序与调度" onClose={onClose}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="text-xs text-accent-red">{error}</div>}
          <div className="space-y-3">
            {sections.map((section, index) => (
              <div key={section.id} className="card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(e) => {
                      const next = [...sections]
                      next[index] = { ...section, enabled: e.target.checked }
                      setSections(next)
                    }}
                  />
                  <input
                    className="input flex-1 text-sm"
                    value={section.title}
                    onChange={(e) => {
                      const next = [...sections]
                      next[index] = { ...section, title: e.target.value }
                      setSections(next)
                    }}
                  />
                  <button type="button" className="btn-ghost text-xs" onClick={() => move(index, -1)}>上</button>
                  <button type="button" className="btn-ghost text-xs" onClick={() => move(index, 1)}>下</button>
                </div>
                <div className="text-xs text-ink-muted">{section.type} · {section.render}</div>
                {section.type === 'mcp' && (
                  <div className="space-y-1">
                    <select
                      className="input text-sm w-full"
                      value={String(section.params?.server || '')}
                      onChange={(e) => {
                        const next = [...sections]
                        next[index] = {
                          ...section,
                          params: { ...section.params, server: e.target.value },
                          enabled: e.target.value ? section.enabled : false,
                        }
                        setSections(next)
                      }}
                    >
                      <option value="">选择 MCP 服务器</option>
                      {mcpServers.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                    {!section.params?.server && (
                      <div className="text-xs text-accent-amber">先在 MCP 页添加服务器并重载核心</div>
                    )}
                    <input
                      className="input text-sm w-full"
                      placeholder="工具名"
                      value={String(section.params?.tool || '')}
                      onChange={(e) => {
                        const next = [...sections]
                        next[index] = { ...section, params: { ...section.params, tool: e.target.value } }
                        setSections(next)
                      }}
                    />
                    <textarea
                      className="input text-sm w-full font-mono"
                      rows={3}
                      placeholder="args JSON"
                      value={JSON.stringify(section.params?.args ?? {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const args = JSON.parse(e.target.value || '{}')
                          const next = [...sections]
                          next[index] = { ...section, params: { ...section.params, args } }
                          setSections(next)
                        } catch { /* keep typing */ }
                      }}
                    />
                  </div>
                )}
                {section.type === 'app' && (
                  <div className="flex gap-2">
                    <select
                      className="input text-sm flex-1"
                      value={String(section.params?.slug || '')}
                      onChange={(e) => {
                        const next = [...sections]
                        next[index] = { ...section, params: { ...section.params, slug: e.target.value } }
                        setSections(next)
                      }}
                    >
                      <option value="">应用</option>
                      {apps.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
                    </select>
                    <input
                      className="input text-sm flex-1"
                      placeholder="viewId"
                      value={String(section.params?.viewId || '')}
                      onChange={(e) => {
                        const next = [...sections]
                        next[index] = { ...section, params: { ...section.params, viewId: e.target.value } }
                        setSections(next)
                      }}
                    />
                  </div>
                )}
                {section.type === 'memory' && (
                  <div className="flex gap-2">
                    <input
                      className="input text-sm flex-1"
                      placeholder="layer"
                      value={String(section.params?.layer || 'daily')}
                      onChange={(e) => {
                        const next = [...sections]
                        next[index] = { ...section, params: { ...section.params, layer: e.target.value } }
                        setSections(next)
                      }}
                    />
                    <input
                      className="input text-sm w-20"
                      type="number"
                      value={Number(section.params?.limit || 5)}
                      onChange={(e) => {
                        const next = [...sections]
                        next[index] = { ...section, params: { ...section.params, limit: Number(e.target.value) } }
                        setSections(next)
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {SECTION_TYPES.map((t) => (
              <button key={t.type} type="button" className="btn text-xs" onClick={() => addSection(t.type)}>+ {t.label}</button>
            ))}
          </div>
          <div className="card p-3 space-y-2">
            <div className="text-sm font-medium">调度</div>
            <label className="text-xs text-ink-muted flex items-center gap-2">
              每天
              <input
                className="input w-24 text-sm"
                value={schedule.at || '08:30'}
                onChange={(e) => setSchedule({ ...schedule, at: e.target.value })}
              />
            </label>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={schedule.onOpen !== false}
                onChange={(e) => setSchedule({ ...schedule, onOpen: e.target.checked })}
              />
              打开早报时若今日未生成则刷新
            </label>
          </div>
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => void save()}>
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </DrawerShell>
    </div>
  )
}
