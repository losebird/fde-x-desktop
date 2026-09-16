// Skills 管理:卡片列表 + 启用停用 + 详情 + 触发词
import { useEffect, useState } from 'react'
import { Sparkles, Search, Filter } from 'lucide-react'
import clsx from 'clsx'
import type { Skill } from '@/lib/types'
import { PageTitle, Card, Tag, Empty } from '@/components/ui'
import { runtimeApi } from '@/lib/runtime-api'
import { loadCurrentAiTarget } from '@/lib/ai-target'
import { useApp } from '@/store/app'

const SOURCE_TONE: Record<Skill['source'], 'green' | 'amber' | 'blue'> = {
  builtin:     'blue',
  user:        'green',
  marketplace: 'amber',
}

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [active, setActive] = useState<Skill | null>(null)
  const [note, setNote] = useState('')
  const workspaceId = useApp((s) => s.activeWorkspaceId)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const status = await runtimeApi.aiStatus()
        if (!status.connected) {
          if (alive) setNote('核心未接通')
          return
        }
        const target = await loadCurrentAiTarget()
        if (!target.ok) {
          if (alive) {
            setSkills([])
            setNote(target.error)
          }
          return
        }
        const catalog = await runtimeApi.listAiSkills(target.sessionId)
        if (!alive) return
        setNote('')
        const items = Array.isArray(catalog) ? catalog : (catalog && typeof catalog === 'object' && Array.isArray((catalog as { items?: unknown[] }).items) ? (catalog as { items: Array<Record<string, unknown>> }).items : [])
        const mapped: Skill[] = items.map((item, index) => ({
          id: String(item.id ?? item.name ?? index),
          name: String(item.name ?? item.id ?? 'Skill'),
          desc: String(item.description ?? item.desc ?? ''),
          emoji: '🪄',
          enabled: item.enabled !== false,
          triggers: Array.isArray(item.triggers) ? item.triggers.map(String) : [],
          source: 'builtin',
        }))
        setSkills(mapped)
        setActive(mapped[0] ?? null)
      } catch (cause) {
        if (alive) {
          setSkills([])
          setNote(cause instanceof Error ? cause.message : '读不到 Skills')
        }
      }
    })()
    return () => { alive = false }
  }, [workspaceId])

  const filtered = skills.filter((s) => {
    if (filter === 'enabled'  && !s.enabled) return false
    if (filter === 'disabled' &&  s.enabled) return false
    if (q && !s.name.includes(q) && !s.desc.includes(q)) return false
    return true
  })
  const enabledCount = skills.filter((s) => s.enabled).length

  return (
    <div>
      <PageTitle
        title="Skills"
        subtitle={note || `已安装 ${skills.length} 个 · 启用 ${enabledCount} 个 · 三个来源(builtin / user / marketplace)`}
        actions={
          <>
            <button className="btn"><Filter size={14} /> 来源筛选</button>
            <button type="button" className="btn-primary" disabled title="没有安装 Remote"><Sparkles size={14} /> 安装新 Skill</button>
          </>
        }
      />

      <div className="grid grid-cols-1 @3xl:grid-cols-[1fr_360px] gap-6">
        <div>
          <Card className="mb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                {(['all', 'enabled', 'disabled'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={clsx('px-3 py-1.5 rounded text-sm', filter === k ? 'bg-ink text-white' : 'hover:bg-surface-2 text-ink-muted')}
                  >
                    {k === 'all' ? '全部' : k === 'enabled' ? '启用中' : '已停用'}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input
                  className="input pl-8 h-8 w-52"
                  placeholder="搜索 Skill"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card><div className="text-sm text-ink-muted py-12 text-center">没有匹配的 Skill</div></Card>
          ) : (
            <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className={clsx('card p-4 hover:shadow-pop transition-shadow cursor-pointer', active?.id === s.id && 'ring-1 ring-brand')}
                  onClick={() => setActive(s)}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl shrink-0">{s.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        <Tag kind={SOURCE_TONE[s.source]}>{s.source}</Tag>
                        <Tag kind={s.enabled ? 'green' : 'default'}>{s.enabled ? '启用' : '停用'}</Tag>
                      </div>
                      <div className="text-xs text-ink-muted mt-1.5 line-clamp-2">{s.desc}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {s.triggers.map((t) => <span key={t} className="tag bg-surface-2 border border-line text-ink-muted text-[11px]">{t}</span>)}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      className={clsx('btn h-7 px-2 text-xs', s.enabled && 'bg-brand-soft border-brand/30 text-brand')}
                      disabled
                      title="当前没有启停 Remote"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {s.enabled ? '停用' : '启用'}
                    </button>
                    <button className="btn-ghost text-xs" onClick={(e) => e.stopPropagation()}>查看详情</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {active && (
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl">{active.emoji}</div>
                <div>
                  <div className="text-base font-medium">{active.name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Tag kind={SOURCE_TONE[active.source]}>{active.source}</Tag>
                    <Tag kind={active.enabled ? 'green' : 'default'}>{active.enabled ? '启用' : '停用'}</Tag>
                  </div>
                </div>
              </div>
              <p className="text-sm text-ink-muted mb-4">{active.desc}</p>

              <div className="text-xs text-ink-muted mb-1.5">触发词</div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {active.triggers.map((t) => <Tag key={t}>{t}</Tag>)}
              </div>

              <div className="text-xs text-ink-muted mb-1.5">运行统计(本周)</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="card-2 p-2.5">
                  <div className="text-ink-muted text-xs">调用次数</div>
                  <div className="font-semibold text-base tabular-nums mt-0.5">—</div>
                </div>
                <div className="card-2 p-2.5">
                  <div className="text-ink-muted text-xs">成功率</div>
                  <div className="font-semibold text-base tabular-nums mt-0.5">—</div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  className={clsx('btn flex-1', active.enabled && 'bg-brand-soft border-brand/30 text-brand')}
                  disabled
                  title="当前没有启停 Remote"
                >
                  {active.enabled ? '停用此 Skill' : '启用此 Skill'}
                </button>
                <button className="btn">编辑</button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
