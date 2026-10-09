// MCP 管理:服务器列表 + 状态切换 + 添加
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plug, Plus, Wrench, Search, Activity } from 'lucide-react'
import clsx from 'clsx'
import { PageTitle, Card, Tag, Empty } from '@/components/ui'
import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { runtimeApi, type McpConnectorCard, type McpDiscoverRow, type McpRecipe, type McpServerV2 } from '@/lib/runtime-api'
import { lastModuleBag, rememberModuleBag } from '@/lib/module-catalog-cache'

type McpBag = { mcp: McpServerV2[]; connectors: McpConnectorCard[]; resourceTools: string[] }

const MCP_STATUS: Record<McpServerV2['status'], { label: string; kind: 'green' | 'amber' | 'default' }> = {
  loaded: { label: '已加载', kind: 'green' },
  'needs-reload': { label: '需重载', kind: 'amber' },
  configured: { label: '已配置', kind: 'default' },
  failed: { label: '失败', kind: 'amber' },
  disabled: { label: '已停用', kind: 'default' },
}

const emptyDraft = () => ({
  name: '',
  transport: 'stdio' as 'stdio' | 'streamable-http',
  command: '',
  args: '',
  env: '',
  url: '',
  headers: '',
  recipeId: '',
  fieldValues: {} as Record<string, string>,
})

function mcpCommandLabel(row: { transport: string; url?: string; command?: string; args?: string[] }) {
  if (row.transport === 'streamable-http') return row.url || ''
  return [row.command, ...(Array.isArray(row.args) ? row.args : [])].filter(Boolean).join(' ')
}

function parseLines(text: string) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)
}

function parseEnv(text: string) {
  const env: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    env[line.slice(0, idx).trim()] = line.slice(idx + 1)
  }
  return Object.keys(env).length ? env : undefined
}

function parseHeaders(text: string) {
  const headers: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return Object.keys(headers).length ? headers : undefined
}

function envText(env?: Record<string, string>) {
  if (!env) return ''
  return Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n')
}

function headersText(headers?: Record<string, string>) {
  if (!headers) return ''
  return Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\n')
}

export default function MCP() {
  const [mcp, setMcp] = useState<McpServerV2[]>([])
  const [connectors, setConnectors] = useState<McpConnectorCard[]>([])
  const [resourceTools, setResourceTools] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [healthNotes, setHealthNotes] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState('')

  const load = useCallback(() => {
    const cached = lastModuleBag<McpBag>('mcp')
    if (cached) {
      setMcp(cached.mcp || [])
      setConnectors(cached.connectors || [])
      setResourceTools(cached.resourceTools || [])
    }
    void runtimeApi.listMcpServers().then(async (data) => {
      const first = {
        mcp: data.mcp || [],
        connectors: data.connectors || [],
        resourceTools: Array.isArray(data.resourceTools) ? data.resourceTools : [],
      }
      rememberModuleBag('mcp', first)
      setMcp(first.mcp)
      setConnectors(first.connectors)
      setResourceTools(first.resourceTools)
      const folder = loadCurrentWorkspaceCwd()
      const target = await currentAiTarget()
      return runtimeApi.listMcpProjection({
        sessionId: target.ok ? target.sessionId : '',
        cwd: target.ok ? target.cwd : (folder.ok ? folder.cwd : ''),
      })
    }).then((proj) => {
      if (!proj) return
      const next = {
        mcp: proj.mcp || [],
        connectors: lastModuleBag<McpBag>('mcp')?.connectors || [],
        resourceTools: Array.isArray(proj.resourceTools) ? proj.resourceTools : [],
      }
      rememberModuleBag('mcp', next)
      setMcp(next.mcp)
      setResourceTools(next.resourceTools)
    }).catch((cause) => {
      if (lastModuleBag<McpBag>('mcp')) return
      setError(cause instanceof Error ? cause.message : '加载 MCP 列表失败')
      setMcp([])
      setConnectors([])
      setResourceTools([])
    })
  }, [])

  useEffect(() => { load() }, [load])

  const [q, setQ] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [recipes, setRecipes] = useState<McpRecipe[]>([])
  const [discovered, setDiscovered] = useState<McpDiscoverRow[]>([])

  const filteredMcp = mcp.filter((m) => (
    m.serverName.includes(q)
    || (m.command || '').includes(q)
    || (m.url || '').includes(q)
    || m.tools.some((t) => t.includes(q))
  ))
  const loadedCount = mcp.filter((m) => m.status === 'loaded').length

  const applyRecipe = (recipe: McpRecipe) => {
    if (!recipe.available) {
      setError(recipe.hint || '该配方在此安装里不可用')
      return
    }
    setDraft({
      ...emptyDraft(),
      name: recipe.serverName,
      transport: recipe.transport,
      command: recipe.command || '',
      args: Array.isArray(recipe.args) ? recipe.args.join('\n') : '',
      recipeId: recipe.id,
      fieldValues: Object.fromEntries((recipe.fields || []).map((field) => [field.key, ''])),
    })
  }

  const applyDiscover = (row: McpDiscoverRow) => {
    if (row.present) return
    setDraft({
      ...emptyDraft(),
      name: row.serverName,
      transport: row.transport,
      command: row.command || '',
      args: Array.isArray(row.args) ? row.args.join('\n') : '',
      env: envText(row.env),
      url: row.url || '',
      headers: headersText(row.headers),
    })
  }

  const openEditor = (row?: McpServerV2) => {
    void runtimeApi.listMcpRecipes().then(setRecipes).catch(() => setRecipes([]))
    if (!row) {
      void runtimeApi.listMcpDiscover().then(setDiscovered).catch(() => setDiscovered([]))
      setEditing('')
      setDraft(emptyDraft())
      setShowAdd(true)
      return
    }
    setEditing(row.serverName)
    setDraft({
      name: row.serverName,
      transport: row.transport,
      command: row.command || '',
      args: Array.isArray(row.args) ? row.args.join('\n') : '',
      env: envText(row.env),
      url: row.url || '',
      headers: headersText(row.headers),
    })
    setShowAdd(true)
  }

  const runHealth = (serverName: string) => {
    void runtimeApi.checkMcpHealth(serverName).then((result) => {
      setHealthNotes((current) => ({ ...current, [serverName]: result.ok ? result.message : `未通过：${result.message}` }))
    }).catch((cause) => {
      setHealthNotes((current) => ({ ...current, [serverName]: cause instanceof Error ? cause.message : '健康检查失败' }))
    })
  }

  const runReload = () => {
    setReloading(true)
    setError('正在重载核心…')
    void runtimeApi.reloadAi().then(() => {
      setError('')
      load()
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : '重载失败')
    }).finally(() => setReloading(false))
  }

  const runEnabled = (serverName: string, enabled: boolean) => {
    setSaving(true)
    void runtimeApi.setMcpServerEnabled(serverName, enabled).then((result) => {
      setError(result.note || '')
      load()
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : '改不了启用状态')
    }).finally(() => setSaving(false))
  }

  const runDelete = (serverName: string) => {
    setSaving(true)
    void runtimeApi.removeMcpServer(serverName).then((result) => {
      setError(result.note || '')
      load()
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : '删除失败')
    }).finally(() => setSaving(false))
  }

  const saveDraft = () => {
    const serverName = (editing || draft.name.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32))
    if (!serverName) {
      setError('serverName 不合法')
      return
    }
    setSaving(true)
    setError('')
    const fieldEnv = Object.fromEntries(
      Object.entries(draft.fieldValues).filter(([key, value]) => key !== 'url' && String(value || '').trim()),
    )
    const mergedEnv = { ...(parseEnv(draft.env) || {}), ...fieldEnv }
    const urlFromFields = String(draft.fieldValues.url || '').trim()
    const body = draft.transport === 'stdio'
      ? {
          serverName,
          transport: 'stdio' as const,
          command: draft.command.trim(),
          args: parseLines(draft.args),
          env: Object.keys(mergedEnv).length ? mergedEnv : undefined,
        }
      : {
          serverName,
          transport: 'streamable-http' as const,
          url: urlFromFields || draft.url.trim(),
          headers: parseHeaders(draft.headers),
        }
    void runtimeApi.addMcpServer(body)
      .then((result) => {
        setShowAdd(false)
        setEditing('')
        setDraft(emptyDraft())
        setError(result.note || '已写入配置，需重载核心生效')
        load()
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '保存失败'))
      .finally(() => setSaving(false))
  }

  return (
    <div>
      <PageTitle
        title="MCP 管理"
        subtitle={`模型上下文协议服务器 · ${loadedCount} / ${mcp.length} 已加载`}
        actions={
          <>
            <button type="button" className="btn" disabled={reloading || saving} onClick={runReload}>重载核心</button>
            <button type="button" className="btn-primary" onClick={() => openEditor()}><Plus size={14} /> 添加服务器</button>
          </>
        }
      />

      <div className="grid grid-cols-1 @md:grid-cols-3 gap-3 mb-6">
        <Card>
          <div className="text-xs text-ink-muted">在线</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{loadedCount}</div>
        </Card>
        <Card>
          <div className="text-xs text-ink-muted">总工具数</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{mcp.reduce((s, x) => s + x.tools.length, 0)}</div>
        </Card>
        <Card>
          <div className="text-xs text-ink-muted">业务连接器</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{connectors.length}</div>
        </Card>
      </div>

      <Card className="mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            className="input pl-8 h-8 w-64"
            placeholder="搜索 MCP（名称 / 命令 / URL）"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </Card>

      {error && <div className="mb-3 text-xs text-accent-red">{error}</div>}

      <div className="space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-subtle mb-2">MCP 服务器</div>
          {filteredMcp.length === 0 && (
            <Empty title="没有 MCP 服务器" hint="添加后会写入 DSH 配置，需重载核心生效" />
          )}
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
            {filteredMcp.map((m) => {
              const meta = MCP_STATUS[m.status]
              return (
                <div key={m.serverName} className="card p-4 hover:shadow-pop transition-shadow flex flex-col">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded bg-surface-2 flex items-center justify-center shrink-0">
                      <Plug size={16} className="text-ink-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium break-words">{m.serverName}</div>
                      <div className="text-xs text-ink-muted mt-0.5 break-words leading-relaxed font-mono">
                        {mcpCommandLabel(m)}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Tag kind="default">{m.transport}</Tag>
                        <Tag kind={meta.kind}>{meta.label}</Tag>
                        <Tag kind="default">投影 {m.tools.length}</Tag>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.tools.slice(0, 8).map((t) => (
                      <Tag key={t}>
                        <Wrench size={10} /> {t}
                      </Tag>
                    ))}
                    {m.tools.length > 8 && <Tag>+{m.tools.length - 8}</Tag>}
                    {m.tools.length === 0 && <span className="text-xs text-ink-subtle">暂无工具投影</span>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-line flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className="btn h-7 px-2 text-xs" disabled={saving || reloading} onClick={() => runEnabled(m.serverName, Boolean(m.disabled))}>
                        {m.disabled ? '启用' : '停用'}
                      </button>
                      <button type="button" className="btn h-7 px-2 text-xs" disabled={saving || reloading} onClick={() => openEditor(m)}>
                        编辑
                      </button>
                      <button type="button" className="btn h-7 px-2 text-xs" disabled={saving || reloading} onClick={() => runDelete(m.serverName)}>
                        删除
                      </button>
                      <button type="button" className="btn h-7 px-2 text-xs" onClick={() => runHealth(m.serverName)}>
                        <Activity size={12} /> 健康检查
                      </button>
                    </div>
                    {healthNotes[m.serverName] && (
                      <span className="text-[11px] text-ink-muted truncate">{healthNotes[m.serverName]}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-ink-subtle mb-2">资源工具</div>
          {resourceTools.length === 0 && (
            <Empty title="没有 MCP 资源" hint="先添加服务器并重载核心。会话投影到 list_mcp_resources 后，这里列出资源工具。" />
          )}
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
            {resourceTools.map((name) => (
              <div key={name} className="card p-4 flex flex-col">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded bg-surface-2 flex items-center justify-center shrink-0">
                    <Wrench size={16} className="text-ink-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium break-words font-mono">{name}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-ink-subtle mb-2">业务连接器</div>
          {connectors.length === 0 && (
            <Empty title="暂无业务连接器" hint="在设置业务连接器里绑定 lookup 或袋里的 MCP/Skills" />
          )}
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
            {connectors.map((c) => (
              <div key={c.id} className="card p-4 flex flex-col">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-ink-muted mt-0.5">{c.provider}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Tag kind={c.online ? 'green' : 'amber'}>{c.online ? '在线' : '未就绪'}</Tag>
                  {c.catalogVersion ? <Tag kind="default">目录 {c.catalogVersion}</Tag> : null}
                  <Tag kind={c.lookupRegistered ? 'green' : 'default'}>{c.lookupRegistered ? '已登记 lookup' : '未登记 lookup'}</Tag>
                </div>
                <div className="mt-3 pt-3 border-t border-line">
                  <Link to="/settings" className="text-xs text-brand hover:underline">去设置登记</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={() => { setShowAdd(false); setEditing('') }}>
          <div className="bg-surface w-[480px] h-full border-l border-line p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">{editing ? '编辑 MCP 服务器' : '添加 MCP 服务器'}</h3>
              <button type="button" className="btn-ghost p-1" onClick={() => { setShowAdd(false); setEditing('') }}>×</button>
            </div>
            <div className="space-y-3">
              {!editing && recipes.length > 0 && (
                <div>
                  <div className="text-xs text-ink-muted mb-1">配方</div>
                  <div className="flex flex-wrap gap-2">
                    {recipes.map((recipe) => (
                      <button
                        key={recipe.id}
                        type="button"
                        className={clsx('btn h-8 px-3 text-xs', draft.recipeId === recipe.id && 'btn-primary')}
                        disabled={!recipe.available}
                        title={recipe.hint}
                        onClick={() => applyRecipe(recipe)}
                      >
                        {recipe.title}
                      </button>
                    ))}
                  </div>
                  {draft.recipeId && recipes.find((row) => row.id === draft.recipeId)?.hint && (
                    <div className="text-[11px] text-ink-muted mt-1">{recipes.find((row) => row.id === draft.recipeId)?.hint}</div>
                  )}
                </div>
              )}
              {!editing && discovered.length > 0 && (
                <div>
                  <div className="text-xs text-ink-muted mb-1">本机发现</div>
                  <div className="flex flex-wrap gap-2">
                    {discovered.map((row) => (
                      <button
                        key={row.serverName}
                        type="button"
                        className={clsx('btn h-8 px-3 text-xs', !draft.recipeId && draft.name === row.serverName && 'btn-primary')}
                        disabled={row.present}
                        title={row.present ? '已在档案里' : mcpCommandLabel(row)}
                        onClick={() => applyDiscover(row)}
                      >
                        {row.serverName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-ink-muted">serverName</label>
                <input className="input mt-1 font-mono" value={draft.name}
                  disabled={Boolean(editing)}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="如 rss-reader" />
              </div>
              <div>
                <div className="text-xs text-ink-muted mb-1">传输</div>
                <div className="flex gap-2">
                  <button type="button" className={clsx('btn h-8 px-3 text-xs', draft.transport === 'stdio' && 'btn-primary')} onClick={() => setDraft({ ...draft, transport: 'stdio' })}>stdio</button>
                  <button type="button" className={clsx('btn h-8 px-3 text-xs', draft.transport === 'streamable-http' && 'btn-primary')} onClick={() => setDraft({ ...draft, transport: 'streamable-http' })}>streamable-http</button>
                </div>
              </div>
              {draft.transport === 'stdio' ? (
                <>
                  {(recipes.find((row) => row.id === draft.recipeId)?.fields || []).filter((field) => field.key !== 'url').map((field) => (
                    <div key={field.key}>
                      <label className="text-xs text-ink-muted">{field.label}</label>
                      <input
                        className="input mt-1"
                        type={field.secret ? 'password' : 'text'}
                        value={draft.fieldValues[field.key] || ''}
                        onChange={(e) => setDraft({ ...draft, fieldValues: { ...draft.fieldValues, [field.key]: e.target.value } })}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-ink-muted">启动命令</label>
                    <input className="input mt-1 font-mono" value={draft.command}
                      onChange={(e) => setDraft({ ...draft, command: e.target.value })} placeholder="npx" />
                  </div>
                  <div>
                    <label className="text-xs text-ink-muted">参数（一行一个）</label>
                    <textarea className="input mt-1 font-mono text-xs" rows={3} value={draft.args}
                      onChange={(e) => setDraft({ ...draft, args: e.target.value })} placeholder="-y" />
                  </div>
                  <div>
                    <label className="text-xs text-ink-muted">环境变量（KEY=VALUE）</label>
                    <textarea className="input mt-1 font-mono text-xs" rows={4} value={draft.env}
                      onChange={(e) => setDraft({ ...draft, env: e.target.value })} placeholder="TOKEN=…" />
                  </div>
                </>
              ) : (
                <>
                  {(recipes.find((row) => row.id === draft.recipeId)?.fields || []).filter((field) => field.key === 'url').map((field) => (
                    <div key={field.key}>
                      <label className="text-xs text-ink-muted">{field.label}</label>
                      <input
                        className="input mt-1 font-mono"
                        value={draft.fieldValues.url || draft.url}
                        onChange={(e) => setDraft({
                          ...draft,
                          url: e.target.value,
                          fieldValues: { ...draft.fieldValues, url: e.target.value },
                        })}
                        placeholder="https://…"
                      />
                    </div>
                  ))}
                  {!(recipes.find((row) => row.id === draft.recipeId)?.fields || []).some((field) => field.key === 'url') && (
                  <div>
                    <label className="text-xs text-ink-muted">URL</label>
                    <input className="input mt-1 font-mono" value={draft.url}
                      onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" />
                  </div>
                  )}
                  <div>
                    <label className="text-xs text-ink-muted">Headers（每行 Key: Value）</label>
                    <textarea className="input mt-1 font-mono text-xs" rows={3} value={draft.headers}
                      onChange={(e) => setDraft({ ...draft, headers: e.target.value })} placeholder="Authorization: Bearer …" />
                  </div>
                </>
              )}
              <div className="text-xs text-ink-muted p-3 rounded bg-surface-2 border border-line">
                已写入配置，需重载核心生效。请到
                {' '}
                <Link to="/settings" className="text-brand hover:underline">设置 → AI 核心</Link>
                {' '}
                点击「重载核心」。
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn" onClick={() => { setShowAdd(false); setEditing('') }}>取消</button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving || !(editing || draft.name.trim()) || (draft.transport === 'stdio' ? !draft.command.trim() : !draft.url.trim())}
                  onClick={saveDraft}
                >
                  {saving ? '保存中' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
