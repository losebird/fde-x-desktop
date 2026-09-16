// Agents 管理:列表、详情及统一完整编辑器。
import { useEffect, useState } from 'react'
import { Play, Pause, Wrench, Bot as BotIcon, Sparkles, Pencil } from 'lucide-react'
import clsx from 'clsx'
import { useApp, useCurrentAgents } from '@/store/app'
import { PageTitle, Card, Tag, Empty } from '@/components/ui'
import { AgentManagerDialog } from '@/components/AgentManagerDialog'
import type { Agent } from '@/lib/types'

export default function Agents() {
  const agents = useCurrentAgents()
  const toggle = useApp((s) => s.toggleAgent)
  const [active, setActive] = useState<Agent | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)

  useEffect(() => {
    if (active) setActive(agents.find((a) => a.id === active.id) ?? null)
  }, [agents])

  const openManager = (agent?: Agent) => {
    setCreateMode(!agent)
    if (agent) setActive(agent)
    setManagerOpen(true)
  }

  const activeList = agents.filter((a) => a.status === 'active')
  const pausedList = agents.filter((a) => a.status === 'paused')

  return (
    <div>
      <PageTitle
        title="Agent 管理"
        subtitle="每个工作区独立配置 Agent 的角色、模型、提示词、工具与记忆策略。"
        actions={<button className="btn-primary" onClick={() => openManager()}><Sparkles size={14} /> 新建 Agent</button>}
      />

      <div className="grid grid-cols-1 @3xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <AgentGroup title="已启用" icon={<Play size={14} className="text-brand" />} list={activeList} active={active} onOpen={setActive} onToggle={toggle} />
          {pausedList.length > 0 && <AgentGroup title="已暂停" icon={<Pause size={14} />} list={pausedList} active={active} onOpen={setActive} onToggle={toggle} muted />}
        </div>

        <div className="space-y-4">
          {active ? (
            <Card>
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">{active.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-medium truncate">{active.name}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{active.role || active.desc}</div>
                </div>
                <Tag kind={active.status === 'active' ? 'green' : 'default'}>{active.status === 'active' ? '运行中' : '暂停'}</Tag>
              </div>
              <p className="text-sm text-ink-muted mb-4">{active.desc}</p>

              <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                <Info label="模型" value={active.model ?? 'FDE-X General'} />
                <Info label="记忆" value={active.memoryMode === 'session' ? '仅会话' : active.memoryMode === 'off' ? '关闭' : '工作区'} />
              </div>

              <div className="text-xs text-ink-muted mb-1.5">可用工具</div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {active.tools.map((t) => <span key={t} className="tag bg-surface-2 border border-line text-ink-muted"><Wrench size={10} /> {t}</span>)}
              </div>

              <div className="flex gap-2">
                <button className="btn flex-1" onClick={() => toggle(active.id)}>{active.status === 'active' ? <><Pause size={14} /> 暂停</> : <><Play size={14} /> 启用</>}</button>
                <button className="btn flex-1" onClick={() => openManager(active)}><Pencil size={14} /> 编辑配置</button>
              </div>
            </Card>
          ) : (
            <Card><div className="text-sm text-ink-muted flex items-start gap-2"><BotIcon size={14} className="mt-0.5" /><span>选一个 Agent 看详情，或新建一个 Agent。</span></div></Card>
          )}

          <Card>
            <div className="text-sm font-medium mb-2">Agent 配置建议</div>
            <ol className="text-xs text-ink-muted space-y-1.5 list-decimal list-inside">
              <li>角色只解决一类核心问题</li><li>系统提示词写清职责、边界和输出格式</li><li>工具采用白名单，减少误调用</li><li>按隐私需求选择工作区或会话记忆</li>
            </ol>
          </Card>
        </div>
      </div>

      <AgentManagerDialog open={managerOpen} onClose={() => { setManagerOpen(false); setCreateMode(false) }} initialAgentId={active?.id} startCreating={createMode} />
    </div>
  )
}

function AgentGroup({ title, icon, list, active, onOpen, onToggle, muted }: { title: string; icon: React.ReactNode; list: Agent[]; active: Agent | null; onOpen: (a: Agent) => void; onToggle: (id: string) => void; muted?: boolean }) {
  return <div><div className={clsx('text-sm font-medium mb-3 flex items-center gap-2', muted && 'text-ink-muted')}>{icon} {title} <Tag kind={muted ? 'default' : 'green'}>{list.length}</Tag></div>{list.length === 0 ? <Empty title={`目前没有${title}的 Agent`} /> : <div className={clsx('grid grid-cols-1 @lg:grid-cols-2 gap-3', muted && 'opacity-75')}>{list.map((a) => <AgentCard key={a.id} a={a} selected={active?.id === a.id} onOpen={onOpen} onToggle={onToggle} />)}</div>}</div>
}

function AgentCard({ a, selected, onOpen, onToggle }: { a: Agent; selected: boolean; onOpen: (a: Agent) => void; onToggle: (id: string) => void }) {
  return <div className={clsx('card p-4 transition-shadow', selected ? 'ring-1 ring-brand/40 shadow-card' : 'hover:shadow-pop')}><div className="flex items-start justify-between gap-2"><button className="flex items-start gap-2 text-left min-w-0" onClick={() => onOpen(a)}><div className="text-2xl">{a.emoji}</div><div className="min-w-0"><div className="text-sm font-medium truncate">{a.name}</div><div className="text-xs text-ink-muted line-clamp-2 mt-0.5">{a.role || a.desc}</div></div></button><button className={clsx('btn h-7 px-2', a.status === 'active' && 'bg-brand-soft border-brand/30 text-brand')} onClick={() => onToggle(a.id)} title={a.status === 'active' ? '暂停' : '启用'}>{a.status === 'active' ? <Pause size={12} /> : <Play size={12} />}</button></div><div className="mt-3 flex flex-wrap gap-1">{a.tools.slice(0, 4).map((t) => <Tag key={t}>{t}</Tag>)}{a.tools.length > 4 && <Tag>+{a.tools.length - 4}</Tag>}</div></div>
}
function Info({ label, value }: { label: string; value: string }) { return <div className="card-2 p-2.5"><div className="text-ink-muted">{label}</div><div className="text-sm font-semibold mt-0.5 truncate">{value}</div></div> }
