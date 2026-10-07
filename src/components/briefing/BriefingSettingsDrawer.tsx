import { useEffect, useMemo, useState } from 'react'
import {
  runtimeApi,
  type BriefingDefinition,
  type BriefingDelivery,
  type BriefingSchedule,
  type BriefingSectionDef,
  type BizVocabKind,
  type McpServerV2,
} from '@/lib/runtime-api'
import { TASK_STATUSES } from '../../../runtime/briefing/defaults.mjs'

function mcpToolOptions(servers: McpServerV2[], serverName: string, savedTool: string) {
  const row = servers.find((item) => item.serverName === serverName)
  const tools = Array.isArray(row?.tools) ? row.tools.map(String).filter(Boolean) : []
  const saved = String(savedTool || '').trim()
  const names = saved ? [saved, ...tools] : tools
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

function kindFieldNames(kind: BizVocabKind | undefined) {
  const fields = Array.isArray(kind?.fields) ? kind.fields : []
  const names: string[] = []
  for (const field of fields) {
    if (typeof field === 'string' && field.trim()) names.push(field.trim())
    else if (field && typeof field === 'object') {
      const name = String((field as { name?: string; field?: string }).name || (field as { field?: string }).field || '').trim()
      if (name) names.push(name)
    }
  }
  return names
}

function filterEntries(params: Record<string, unknown> | undefined) {
  const filter = params?.filter && typeof params.filter === 'object' && !Array.isArray(params.filter)
    ? params.filter as Record<string, unknown>
    : {}
  return Object.entries(filter).map(([field, value]) => ({ field, value: String(value ?? '') }))
}

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

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

type FdeAppRow = { id: string; name: string; slug: string }
type StatView = { id: string; label: string }

export function BriefingSettingsDrawer({
  open,
  definition,
  onClose,
  onSaved,
}: {
  open: boolean
  definition: BriefingDefinition | null
  onClose: () => void
  onSaved: (def: BriefingDefinition) => void
}) {
  const [sections, setSections] = useState<BriefingSectionDef[]>(definition?.sections || [])
  const [schedule, setSchedule] = useState<BriefingSchedule>(definition?.schedule || { at: '08:30', onOpen: true })
  const [delivery, setDelivery] = useState<BriefingDelivery>(definition?.delivery || { peerId: '' })
  const [peers, setPeers] = useState<Array<{ id: string; name?: string }>>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mcpServers, setMcpServers] = useState<McpServerV2[]>([])
  const [apps, setApps] = useState<FdeAppRow[]>([])
  const [statViews, setStatViews] = useState<Record<string, StatView[]>>({})
  const [bizKinds, setBizKinds] = useState<BizVocabKind[]>([])

  useEffect(() => {
    if (!open || !definition) return
    setSections(definition.sections)
    setSchedule(definition.schedule || { at: '08:30', onOpen: true })
    setDelivery(definition.delivery || { peerId: '' })
  }, [open, definition])

  useEffect(() => {
    if (!open) return
    void runtimeApi.listBriefingMcpSources().then((data) => {
      setMcpServers(Array.isArray(data.servers) ? data.servers : [])
    }).catch(() => setMcpServers([]))
    void runtimeApi.listFdeApps().then((rows) => {
      setApps(Array.isArray(rows) ? rows.filter((row) => row.slug) : [])
    }).catch(() => setApps([]))
    const cwd = definition?.workspaceCwd && definition.workspaceCwd.startsWith('/')
      ? definition.workspaceCwd
      : ''
    void runtimeApi.listBizKinds(undefined, cwd || undefined).then((sheet) => {
      setBizKinds(Array.isArray(sheet?.kinds) ? sheet.kinds : [])
    }).catch(() => setBizKinds([]))
    void runtimeApi.imState().then((data) => {
      const rows = Array.isArray(data.peers) ? data.peers as Array<Record<string, unknown>> : []
      setPeers(rows.filter((row) => !row.unpaired).map((row) => ({
        id: String(row.id || ''),
        name: typeof row.name === 'string' ? row.name : undefined,
      })).filter((row) => row.id))
    }).catch(() => setPeers([]))
  }, [open, definition?.workspaceCwd])

  const slugsNeedingViews = useMemo(() => {
    const slugs = new Set<string>()
    for (const section of sections) {
      if (section.type !== 'app') continue
      const slug = String(section.params?.slug || '')
      if (slug) slugs.add(slug)
    }
    return [...slugs]
  }, [sections])

  useEffect(() => {
    let alive = true
    void (async () => {
      for (const slug of slugsNeedingViews) {
        if (statViews[slug]) continue
        const app = apps.find((row) => row.slug === slug)
        if (!app) continue
        try {
          const detail = await runtimeApi.getDeclarativeApp(app.id)
          const views = Array.isArray(detail?.spec?.views) ? detail.spec.views : []
          const stats = views
            .filter((view) => view && view.type === 'stat' && view.id)
            .map((view) => ({ id: String(view.id), label: String(view.label || view.id) }))
          if (alive) setStatViews((current) => ({ ...current, [slug]: stats }))
        } catch {
          if (alive) setStatViews((current) => ({ ...current, [slug]: [] }))
        }
      }
    })()
    return () => { alive = false }
  }, [slugsNeedingViews, apps, statViews])

  const move = (index: number, dir: -1 | 1) => {
    const next = [...sections]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    setSections(next)
  }

  const addSection = (type: BriefingSectionDef['type'], render: string, label: string) => {
    const params: Record<string, unknown> = type === 'tasks'
      ? { limit: 3, status: ['todo', 'doing'] }
      : type === 'events'
        ? { limit: 20 }
        : type === 'im'
          ? { limit: 8 }
          : type === 'memory'
            ? { layer: 'daily', limit: 5 }
            : type === 'biz'
              ? { action: '现查', filter: {} }
              : type === 'mcp'
                ? { summarize: true }
                : {}
    setSections([...sections, {
      id: `${type}-${Date.now().toString(36)}`,
      type,
      title: label,
      enabled: false,
      render,
      params,
    }])
  }

  const patchParams = (index: number, patch: Record<string, unknown>) => {
    const next = [...sections]
    const section = next[index]
    next[index] = { ...section, params: { ...section.params, ...patch } }
    setSections(next)
  }

  const save = () => {
    if (!definition) return
    setSaving(true)
    setError('')
    void runtimeApi.putBriefingDefinition({
      workspaceCwd: definition.workspaceCwd,
      sections,
      schedule,
      delivery,
    }).then((saved) => {
      onSaved(saved)
      onClose()
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : '保存失败')
    }).finally(() => setSaving(false))
  }

  const days = Array.isArray(schedule.days) ? schedule.days : [1, 2, 3, 4, 5]

  if (!open || !definition) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-surface border-l border-line flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">自定义早报</div>
            <div className="text-xs text-ink-muted">区块顺序与调度</div>
          </div>
          <button type="button" className="btn-ghost text-xs" onClick={onClose}>关闭</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sections.map((section, index) => (
            <div key={section.id} className="rounded-lg border border-line p-3 space-y-2">
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
                  className="input text-sm flex-1"
                  value={section.title}
                  onChange={(e) => {
                    const next = [...sections]
                    next[index] = { ...section, title: e.target.value }
                    setSections(next)
                  }}
                />
                <button type="button" className="btn-ghost text-xs" onClick={() => move(index, -1)}>上</button>
                <button type="button" className="btn-ghost text-xs" onClick={() => move(index, 1)}>下</button>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => setSections(sections.filter((_, i) => i !== index))}
                >
                  删
                </button>
              </div>
              <div className="text-[11px] text-ink-subtle">{section.type} · {section.render}</div>
              {section.type === 'tasks' && (
                <div className="space-y-1.5">
                  <input
                    type="number"
                    className="input text-sm w-full"
                    min={1}
                    value={Number(section.params?.limit) || 3}
                    onChange={(e) => patchParams(index, { limit: Number(e.target.value) || 3 })}
                  />
                  <div className="flex flex-wrap gap-2 text-xs">
                    {TASK_STATUSES.map((status) => {
                      const selected = Array.isArray(section.params?.status) ? section.params.status as string[] : ['todo', 'doing']
                      const on = selected.includes(status)
                      return (
                        <label key={status} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => {
                              const next = on ? selected.filter((item) => item !== status) : [...selected, status]
                              patchParams(index, { status: next.length ? next : ['todo'] })
                            }}
                          />
                          {status}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {(section.type === 'events' || section.type === 'im') && (
                <input
                  type="number"
                  className="input text-sm w-full"
                  min={1}
                  value={Number(section.params?.limit) || (section.type === 'events' ? 20 : 8)}
                  onChange={(e) => patchParams(index, { limit: Number(e.target.value) || 1 })}
                />
              )}
              {section.type === 'memory' && (
                <div className="flex gap-2">
                  <input
                    className="input text-sm flex-1"
                    placeholder="layer"
                    value={String(section.params?.layer || 'daily')}
                    onChange={(e) => patchParams(index, { layer: e.target.value })}
                  />
                  <input
                    type="number"
                    className="input text-sm w-20"
                    min={1}
                    value={Number(section.params?.limit) || 5}
                    onChange={(e) => patchParams(index, { limit: Number(e.target.value) || 5 })}
                  />
                </div>
              )}
              {section.type === 'biz' && (
                <div className="space-y-1.5">
                  <select
                    className="input text-sm w-full"
                    value={String(section.params?.kind || '')}
                    onChange={(e) => patchParams(index, { kind: e.target.value, filter: {} })}
                  >
                    <option value="">选择业务型</option>
                    {bizKinds.map((kind) => (
                      <option key={kind.kind} value={kind.kind}>{kind.label || kind.kind}</option>
                    ))}
                  </select>
                  <select
                    className="input text-sm w-full"
                    value={String(section.params?.action || '现查')}
                    onChange={(e) => patchParams(index, { action: e.target.value })}
                  >
                    <option value="现查">现查</option>
                  </select>
                  {filterEntries(section.params).map((entry, fi) => {
                    const fields = kindFieldNames(bizKinds.find((kind) => kind.kind === section.params?.kind))
                    return (
                      <div key={`${entry.field}-${fi}`} className="flex gap-1.5">
                        <select
                          className="input text-sm flex-1"
                          value={entry.field}
                          onChange={(e) => {
                            const rows = filterEntries(section.params)
                            rows[fi] = { ...entry, field: e.target.value }
                            patchParams(index, { filter: Object.fromEntries(rows.filter((row) => row.field).map((row) => [row.field, row.value])) })
                          }}
                        >
                          <option value="">字段</option>
                          {fields.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <input
                          className="input text-sm flex-1"
                          value={entry.value}
                          onChange={(e) => {
                            const rows = filterEntries(section.params)
                            rows[fi] = { ...entry, value: e.target.value }
                            patchParams(index, { filter: Object.fromEntries(rows.filter((row) => row.field).map((row) => [row.field, row.value])) })
                          }}
                        />
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => {
                            const rows = filterEntries(section.params).filter((_, i) => i !== fi)
                            patchParams(index, { filter: Object.fromEntries(rows.filter((row) => row.field).map((row) => [row.field, row.value])) })
                          }}
                        >
                          删
                        </button>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={!section.params?.kind}
                    onClick={() => {
                      const fields = kindFieldNames(bizKinds.find((kind) => kind.kind === section.params?.kind))
                      const current = filterEntries(section.params)
                      const used = new Set(current.map((row) => row.field))
                      const nextField = fields.find((name) => !used.has(name))
                      if (!nextField) return
                      patchParams(index, {
                        filter: Object.fromEntries([...current, { field: nextField, value: '' }].map((row) => [row.field, row.value])),
                      })
                    }}
                  >
                    + 条件
                  </button>
                </div>
              )}
              {section.type === 'app' && (
                <div className="flex gap-2">
                  <select
                    className="input text-sm flex-1"
                    value={String(section.params?.slug || '')}
                    onChange={(e) => patchParams(index, { slug: e.target.value, viewId: '' })}
                  >
                    <option value="">应用</option>
                    {apps.map((app) => (
                      <option key={app.slug} value={app.slug}>{app.name || app.slug}</option>
                    ))}
                  </select>
                  <select
                    className="input text-sm flex-1"
                    value={String(section.params?.viewId || '')}
                    disabled={!section.params?.slug}
                    onChange={(e) => patchParams(index, { viewId: e.target.value })}
                  >
                    <option value="">stat 视图</option>
                    {(statViews[String(section.params?.slug || '')] || []).map((view) => (
                      <option key={view.id} value={view.id}>{view.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {section.type === 'mcp' && (
                <div className="space-y-1.5">
                  <select
                    className="input text-sm w-full"
                    value={String(section.params?.server || '')}
                    onChange={(e) => {
                      const server = e.target.value
                      const tools = mcpToolOptions(mcpServers, server, '')
                      const tool = tools.includes(String(section.params?.tool || ''))
                        ? String(section.params?.tool || '')
                        : ''
                      const next = [...sections]
                      next[index] = {
                        ...section,
                        params: { ...section.params, server, tool },
                        enabled: server ? section.enabled : false,
                      }
                      setSections(next)
                    }}
                  >
                    <option value="">选择 MCP 服务器</option>
                    {mcpServers.map((row) => (
                      <option key={row.serverName} value={row.serverName}>{row.serverName}</option>
                    ))}
                  </select>
                  {!section.params?.server && (
                    <div className="text-xs text-accent-amber">先在 MCP 页添加服务器并重载核心</div>
                  )}
                  <select
                    className="input text-sm w-full"
                    value={String(section.params?.tool || '')}
                    disabled={!section.params?.server}
                    onChange={(e) => patchParams(index, { tool: e.target.value })}
                  >
                    <option value="">选择工具</option>
                    {mcpToolOptions(
                      mcpServers,
                      String(section.params?.server || ''),
                      String(section.params?.tool || ''),
                    ).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <textarea
                    className="input text-sm w-full font-mono"
                    rows={2}
                    placeholder="args JSON"
                    value={JSON.stringify(section.params?.args || {})}
                    onChange={(e) => {
                      try {
                        patchParams(index, { args: JSON.parse(e.target.value || '{}') })
                      } catch {
                        /* keep typing */
                      }
                    }}
                  />
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={section.params?.summarize !== false}
                      onChange={(e) => patchParams(index, { summarize: e.target.checked })}
                    />
                    summarize
                  </label>
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            {SECTION_TYPES.map((row) => (
              <button key={row.type} type="button" className="btn-ghost text-xs" onClick={() => addSection(row.type, row.render, row.label)}>
                + {row.label}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-line space-y-2">
            <div className="text-xs text-ink-muted">调度</div>
            <label className="flex items-center gap-2 text-sm">
              每天
              <input
                className="input text-sm w-24"
                value={schedule.at || '08:30'}
                onChange={(e) => setSchedule({ ...schedule, at: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              {DAY_LABELS.map((label, day) => (
                <label key={day} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={days.includes(day)}
                    onChange={() => {
                      const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort()
                      setSchedule({ ...schedule, days: next.length ? next : [day] })
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              tz
              <input
                className="input text-sm flex-1"
                value={schedule.tz || 'Asia/Shanghai'}
                onChange={(e) => setSchedule({ ...schedule, tz: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={schedule.onOpen !== false}
                onChange={(e) => setSchedule({ ...schedule, onOpen: e.target.checked })}
              />
              打开早报时若今日未生成则刷新
            </label>
            <div className="text-xs text-ink-muted pt-1">发往 IM</div>
            <select
              className="input text-sm w-full"
              value={delivery.peerId || ''}
              onChange={(e) => setDelivery({ peerId: e.target.value })}
            >
              <option value="">选择对端</option>
              {peers.map((peer) => (
                <option key={peer.id} value={peer.id}>{peer.name || peer.id}</option>
              ))}
            </select>
          </div>
          {error && <div className="text-xs text-accent-red">{error}</div>}
        </div>
        <div className="p-4 border-t border-line">
          <button type="button" className="btn-primary w-full" disabled={saving} onClick={save}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
