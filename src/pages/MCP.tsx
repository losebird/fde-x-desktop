// MCP 管理:服务器列表 + 状态切换 + 添加
import { useEffect, useState } from 'react'
import { Plug, Plus, Wrench, Search, CircleDot, CheckCircle2, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import type { MCPServer } from '@/lib/types'
import { PageTitle, Card, Tag, Empty } from '@/components/ui'
import { runtimeApi } from '@/lib/runtime-api'

const STATUS_META: Record<MCPServer['status'], { label: string; tone: 'green' | 'amber' | 'red'; dot: string }> = {
  connected:    { label: '已连接',  tone: 'green', dot: 'bg-brand' },
  pending:      { label: '连接中',  tone: 'amber', dot: 'bg-accent-amber' },
  disconnected: { label: '未连接',  tone: 'red',   dot: 'bg-accent-red' },
}

export default function MCP() {
  const [mcp, setMcp] = useState<MCPServer[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void runtimeApi.listMcpServers().then((items) => {
      setMcp(items.map((item) => ({
        id: item.id,
        name: item.name,
        desc: item.desc,
        category: item.category,
        status: item.status === 'connected' ? 'connected' : item.status === 'disconnected' ? 'disconnected' : 'pending',
        tools: item.tools,
      })))
    }).catch(() => setMcp([]))
  }, [])

  const [q, setQ] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<{ name: string; desc: string; command: string; category: string }>({
    name: '', desc: '', command: 'npx -y @example/mcp-server', category: '工具',
  })

  const filtered = mcp.filter((m) => m.name.includes(q) || m.desc.includes(q) || m.category.includes(q))
  const grouped = filtered.reduce<Record<string, MCPServer[]>>((acc, m) => {
    (acc[m.category] = acc[m.category] || []).push(m)
    return acc
  }, {})

  const connectedCount = mcp.filter((m) => m.status === 'connected').length

  return (
    <div>
      <PageTitle
        title="MCP 管理"
        subtitle={`模型上下文协议服务器 · ${connectedCount} / ${mcp.length} 已连接`}
        actions={
          <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> 添加服务器</button>
        }
      />

      <div className="grid grid-cols-1 @md:grid-cols-3 gap-3 mb-6">
        <Card>
          <div className="text-xs text-ink-muted">已连接</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{connectedCount}</div>
        </Card>
        <Card>
          <div className="text-xs text-ink-muted">总工具数</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{mcp.reduce((s, x) => s + x.tools.length, 0)}</div>
        </Card>
        <Card>
          <div className="text-xs text-ink-muted">待连接 / 失败</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{mcp.length - connectedCount}</div>
        </Card>
      </div>

      <Card className="mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            className="input pl-8 h-8 w-64"
            placeholder="搜索 MCP(名称 / 描述 / 分类)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </Card>

      {error && <div className="mb-3 text-xs text-accent-red">{error}</div>}
      {mcp.length === 0 && <Empty title="没有 MCP 服务器" hint="添加后会写入 DSH 配置，需重新连接本地核心" />}
      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <div className="text-xs uppercase tracking-wider text-ink-subtle mb-2">{cat}</div>
            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
              {list.map((m) => {
                const meta = STATUS_META[m.status]
                return (
                  <div key={m.id} className="card p-4 hover:shadow-pop transition-shadow flex flex-col">
                    <div className="flex items-start gap-2.5">
                      <div className="w-9 h-9 rounded bg-surface-2 flex items-center justify-center shrink-0">
                        <Plug size={16} className="text-ink-muted" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium break-words">{m.name}</div>
                        <div className="text-xs text-ink-muted mt-0.5 break-words leading-relaxed">{m.desc}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.tools.slice(0, 8).map((t) => (
                        <Tag key={t}>
                          <Wrench size={10} /> {t}
                        </Tag>
                      ))}
                      {m.tools.length > 8 && <Tag>+{m.tools.length - 8}</Tag>}
                    </div>
                    <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                      <span className={clsx('inline-flex items-center gap-1 text-xs', meta.tone === 'green' && 'text-brand', meta.tone === 'amber' && 'text-accent-amber', meta.tone === 'red' && 'text-accent-red')}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
                        {meta.label}
                      </span>
                      <button
                        type="button"
                        className={clsx('btn h-7 px-2 text-xs', m.status === 'connected' && 'bg-brand-soft border-brand/30 text-brand')}
                        disabled
                        title="启停需重连本地核心"
                      >
                        {m.status === 'connected' ? <CheckCircle2 size={12} /> : m.status === 'pending' ? <CircleDot size={12} /> : <AlertCircle size={12} />}
                        {m.status === 'connected' ? '断开' : '连接'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={() => setShowAdd(false)}>
          <div className="bg-surface w-[480px] h-full border-l border-line p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">添加 MCP 服务器</h3>
              <button className="btn-ghost p-1" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-muted">名称</label>
                <input className="input mt-1" value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="如:My MCP" />
              </div>
              <div>
                <label className="text-xs text-ink-muted">分类</label>
                <select className="input mt-1" value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {['工具','开发','协作','法务','财务','数据','其它'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-muted">启动命令</label>
                <input className="input mt-1 font-mono" value={draft.command}
                  onChange={(e) => setDraft({ ...draft, command: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-ink-muted">描述</label>
                <textarea className="input mt-1" rows={3} value={draft.desc}
                  onChange={(e) => setDraft({ ...draft, desc: e.target.value })} placeholder="做什么、能提供哪些工具" />
              </div>
              <div className="text-xs text-ink-muted p-3 rounded bg-surface-2 border border-line">
                配置写入 DSH patch。若核心已连接，保存后会自动重新拉起。
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn" onClick={() => setShowAdd(false)}>取消</button>
                <button
                  className="btn-primary"
                  disabled={saving || !draft.command.trim()}
                  onClick={() => {
                    const serverName = (draft.name || 'mcp').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'mcp'
                    setSaving(true)
                    setError('')
                    void runtimeApi.addMcpServer({ serverName, command: draft.command.trim() })
                      .then((result) => {
                        setMcp((current) => [...current, {
                          id: serverName,
                          name: draft.name || serverName,
                          desc: draft.desc,
                          category: draft.category,
                          status: result.needsRestart ? 'pending' : 'connected',
                          tools: [],
                        }])
                        setShowAdd(false)
                        if (result.needsRestart) setError('已写入配置。到设置 → AI 核心 → 重载核心后才会进当前会话。')
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
