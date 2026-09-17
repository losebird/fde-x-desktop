// MCP 管理:服务器列表 + 状态切换 + 添加
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plug, Plus, Wrench, Search, Activity } from 'lucide-react'
import clsx from 'clsx'
import { PageTitle, Card, Tag, Empty } from '@/components/ui'
import { runtimeApi, type McpConnectorCard, type McpServerV2 } from '@/lib/runtime-api'

const MCP_STATUS: Record<McpServerV2['status'], { label: string; kind: 'green' | 'amber' | 'default' }> = {
  live: { label: '在线', kind: 'green' },
  'needs-reload': { label: '需重载', kind: 'amber' },
  configured: { label: '已配置', kind: 'default' },
}

export default function MCP() {
  const [mcp, setMcp] = useState<McpServerV2[]>([])
  const [connectors, setConnectors] = useState<McpConnectorCard[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [healthNotes, setHealthNotes] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    void runtimeApi.listMcpServers().then((data) => {
      setMcp(data.mcp || [])
      setConnectors(data.connectors || [])
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : '加载 MCP 列表失败')
      setMcp([])
      setConnectors([])
    })
  }, [])

  useEffect(() => { load() }, [load])

  const [q, setQ] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    transport: 'stdio' as 'stdio' | 'streamable-http',
    command: '',
    url: '',
    headers: '',
  })

  const filteredMcp = mcp.filter((m) => m.serverName.includes(q) || (m.command || '').includes(q) || (m.url || '').includes(q))
  const liveCount = mcp.filter((m) => m.status === 'live').length

  const runHealth = (serverName: string) => {
    void runtimeApi.checkMcpHealth(serverName).then((result) => {
      setHealthNotes((current) => ({ ...current, [serverName]: result.ok ? result.message : `未通过：${result.message}` }))
    }).catch((cause) => {
      setHealthNotes((current) => ({ ...current, [serverName]: cause instanceof Error ? cause.message : '健康检查失败' }))
    })
  }

  return (
    <div>
      <PageTitle
        title="MCP 管理"
        subtitle={`模型上下文协议服务器 · ${liveCount} / ${mcp.length} 在线`}
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> 添加服务器</button>
        }
      />

      <div className="grid grid-cols-1 @md:grid-cols-3 gap-3 mb-6">
        <Card>
          <div className="text-xs text-ink-muted">在线</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{liveCount}</div>
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
                        {m.transport === 'streamable-http' ? m.url : m.command}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Tag kind="default">{m.transport}</Tag>
                        <Tag kind={meta.kind}>{meta.label}</Tag>
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
                    <button type="button" className="btn h-7 px-2 text-xs" onClick={() => runHealth(m.serverName)}>
                      <Activity size={12} /> 健康检查
                    </button>
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
          <div className="text-xs uppercase tracking-wider text-ink-subtle mb-2">业务连接器</div>
          {connectors.length === 0 && (
            <Empty title="暂无业务连接器" hint="在设置中登记 lookup 后此处显示状态" />
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
        <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={() => setShowAdd(false)}>
          <div className="bg-surface w-[480px] h-full border-l border-line p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">添加 MCP 服务器</h3>
              <button type="button" className="btn-ghost p-1" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-muted">serverName</label>
                <input className="input mt-1 font-mono" value={draft.name}
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
                <div>
                  <label className="text-xs text-ink-muted">启动命令</label>
                  <input className="input mt-1 font-mono" value={draft.command}
                    onChange={(e) => setDraft({ ...draft, command: e.target.value })} placeholder="npx -y …" />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-ink-muted">URL</label>
                    <input className="input mt-1 font-mono" value={draft.url}
                      onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" />
                  </div>
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
                <button type="button" className="btn" onClick={() => setShowAdd(false)}>取消</button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving || !draft.name.trim() || (draft.transport === 'stdio' ? !draft.command.trim() : !draft.url.trim())}
                  onClick={() => {
                    const serverName = draft.name.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
                    if (!serverName) {
                      setError('serverName 不合法')
                      return
                    }
                    const headers: Record<string, string> = {}
                    for (const line of draft.headers.split('\n')) {
                      const idx = line.indexOf(':')
                      if (idx <= 0) continue
                      headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
                    }
                    setSaving(true)
                    setError('')
                    void runtimeApi.addMcpServer(
                      draft.transport === 'stdio'
                        ? { serverName, transport: 'stdio', command: draft.command.trim() }
                        : { serverName, transport: 'streamable-http', url: draft.url.trim(), headers: Object.keys(headers).length ? headers : undefined },
                    )
                      .then((result) => {
                        setShowAdd(false)
                        setDraft({ name: '', transport: 'stdio', command: '', url: '', headers: '' })
                        setError(result.note || '已写入配置，需重载核心生效')
                        load()
                      })
                      .catch((cause) => setError(cause instanceof Error ? cause.message : '保存失败'))
                      .finally(() => setSaving(false))
                  }}
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
