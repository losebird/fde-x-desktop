import { useEffect, useMemo, useState } from 'react'
import { Bot, Check, ChevronDown, Pencil, Plus, Power, Search, Sparkles, Trash2, Wrench, X } from 'lucide-react'
import clsx from 'clsx'
import { useApp, useCurrentAgents } from '@/store/app'
import type { Agent } from '@/lib/types'
import { Tag } from './ui'

type Props = {
  open: boolean
  onClose: () => void
  initialAgentId?: string | null
  startCreating?: boolean
}

type AgentDraft = {
  name: string
  emoji: string
  role: string
  desc: string
  model: string
  systemPrompt: string
  tools: string[]
  skillIds: string[]
  memoryMode: 'workspace' | 'session' | 'off'
  temperature: number
  maxSteps: number
  status: 'active' | 'paused'
}

const emptyDraft = (): AgentDraft => ({
  name: '', emoji: '🤖', role: '', desc: '', model: 'FDE-X General',
  systemPrompt: '', tools: [], skillIds: [], memoryMode: 'workspace', temperature: 0.4,
  maxSteps: 8, status: 'active',
})

const fromAgent = (a: Agent): AgentDraft => ({
  name: a.name,
  emoji: a.emoji,
  role: a.role ?? '',
  desc: a.desc,
  model: a.model ?? 'FDE-X General',
  systemPrompt: a.systemPrompt ?? '',
  tools: a.tools,
  skillIds: a.skillIds ?? [],
  memoryMode: a.memoryMode ?? 'workspace',
  temperature: a.temperature ?? 0.4,
  maxSteps: a.maxSteps ?? 8,
  status: a.status,
})

export function AgentManagerDialog({ open, onClose, initialAgentId, startCreating = false }: Props) {
  const agents = useCurrentAgents()
  const addAgent = useApp((s) => s.addAgent)
  const updateAgent = useApp((s) => s.updateAgent)
  const removeAgent = useApp((s) => s.removeAgent)
  const toggleAgent = useApp((s) => s.toggleAgent)
  const mcp = useApp((s) => s.mcp)
  const skills = useApp((s) => s.skills)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')
  const [draft, setDraft] = useState<AgentDraft>(emptyDraft())
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const selected = useMemo(() => {
    if (mode === 'new') return null
    return agents.find((a) => a.id === selectedId) ?? agents[0] ?? null
  }, [agents, selectedId, mode])

  useEffect(() => {
    if (!open) return
    if (startCreating) {
      setMode('new')
      setSelectedId(null)
      setDraft(emptyDraft())
    } else {
      const next = agents.find((a) => a.id === initialAgentId) ?? agents[0] ?? null
      setSelectedId(next?.id ?? null)
      setMode('view')
      if (next) setDraft(fromAgent(next))
    }
    setDeleteConfirm(false)
  }, [open, startCreating, initialAgentId])

  useEffect(() => {
    if (mode === 'view' && selected) setDraft(fromAgent(selected))
  }, [selected?.id, mode])

  const availableTools = useMemo(() => {
    const source = new Map<string, string>()
    mcp.forEach((server) => server.tools.forEach((tool) => source.set(tool, server.name)))
    agents.forEach((agent) => agent.tools.forEach((tool) => {
      if (!source.has(tool)) source.set(tool, '已有 Agent')
    }))
    return Array.from(source, ([id, provider]) => ({ id, provider })).sort((a, b) => a.id.localeCompare(b.id))
  }, [mcp, agents])

  if (!open) return null

  const save = () => {
    if (!draft.name.trim()) return
    const data = {
      name: draft.name.trim(), emoji: draft.emoji.trim() || '🤖',
      role: draft.role.trim(), desc: draft.desc.trim() || '自定义 Agent',
      model: draft.model, systemPrompt: draft.systemPrompt.trim(), tools: draft.tools, skillIds: draft.skillIds,
      memoryMode: draft.memoryMode, temperature: Number(draft.temperature),
      maxSteps: Number(draft.maxSteps), status: draft.status,
    }
    if (mode === 'new') {
      const id = addAgent(data)
      updateAgent(id, { status: draft.status })
      setSelectedId(id)
    } else if (selected) {
      updateAgent(selected.id, data)
    }
    setMode('view')
  }

  const startEdit = (agent: Agent) => {
    setSelectedId(agent.id)
    setDraft(fromAgent(agent))
    setMode('edit')
    setDeleteConfirm(false)
  }

  const startNew = () => {
    setSelectedId(null)
    setDraft(emptyDraft())
    setMode('new')
    setDeleteConfirm(false)
  }

  const deleteSelected = () => {
    if (!selected) return
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    removeAgent(selected.id)
    setSelectedId(agents.find((a) => a.id !== selected.id)?.id ?? null)
    setDeleteConfirm(false)
    setMode('view')
  }

  return (
    <div className="fixed inset-0 z-[10030] bg-ink/25 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-line rounded-xl shadow-pop w-full max-w-5xl h-[min(760px,90vh)] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-14 px-5 border-b border-line flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center"><Bot size={17} /></div>
          <div>
            <h3 className="text-base font-medium">Agent 管理</h3>
            <p className="text-xs text-ink-muted">配置角色、模型、提示词、MCP 工具、Skills 和记忆策略。</p>
          </div>
          <div className="flex-1" />
          <button className="btn-primary" onClick={startNew}><Plus size={14} /> 新建 Agent</button>
          <button className="btn-ghost p-1.5" onClick={onClose} aria-label="关闭 Agent 管理"><X size={17} /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          <aside className="w-64 shrink-0 border-r border-line bg-surface-2/50 flex flex-col">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-ink-subtle">当前工作区 · {agents.length} 个</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedId(a.id); setMode('view'); setDeleteConfirm(false) }}
                  className={clsx('w-full p-2.5 rounded-lg text-left flex items-start gap-2.5', selected?.id === a.id && mode !== 'new' ? 'bg-white border border-line shadow-card' : 'hover:bg-white/70')}
                >
                  <span className="text-xl">{a.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.name}</div>
                    <div className="text-[11px] text-ink-muted truncate mt-0.5">{a.role || a.desc}</div>
                  </div>
                  <span className={clsx('w-2 h-2 rounded-full mt-1.5', a.status === 'active' ? 'bg-brand' : 'bg-ink-subtle')} />
                </button>
              ))}
              {agents.length === 0 && <div className="text-xs text-ink-muted text-center py-8">还没有 Agent</div>}
            </div>
          </aside>

          <main className="flex-1 min-w-0 overflow-y-auto">
            {mode === 'view' && selected ? (
              <div className="p-6 max-w-3xl mx-auto">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-4xl">{selected.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xl font-semibold">{selected.name}</h4>
                      <Tag kind={selected.status === 'active' ? 'green' : 'default'}>{selected.status === 'active' ? '运行中' : '已暂停'}</Tag>
                    </div>
                    <p className="text-sm text-ink-muted mt-1">{selected.role || '未设置角色定位'}</p>
                    <p className="text-sm mt-2">{selected.desc}</p>
                  </div>
                  <button className="btn" onClick={() => startEdit(selected)}><Pencil size={13} /> 编辑配置</button>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6">
                  <Info label="模型" value={selected.model ?? 'FDE-X General'} />
                  <Info label="记忆" value={memoryLabel(selected.memoryMode)} />
                  <Info label="最大步骤" value={`${selected.maxSteps ?? 8} 步`} />
                </div>

                <section className="mt-6">
                  <div className="text-xs text-ink-muted mb-2">系统提示词</div>
                  <div className="card-2 p-4 text-sm whitespace-pre-wrap min-h-24">{selected.systemPrompt || '尚未配置系统提示词。'}</div>
                </section>
                <section className="mt-5">
                  <div className="text-xs text-ink-muted mb-2">工具白名单</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tools.map((t) => <Tag key={t}><Wrench size={10} /> {t}</Tag>)}
                    {selected.tools.length === 0 && <span className="text-sm text-ink-subtle">未配置工具</span>}
                  </div>
                </section>
                <section className="mt-5">
                  <div className="text-xs text-ink-muted mb-2">绑定 Skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.skillIds ?? []).map((sid) => {
                      const skill = skills.find((s) => s.id === sid)
                      return skill ? <Tag key={sid}><Sparkles size={10} /> {skill.emoji} {skill.name}</Tag> : null
                    })}
                    {!(selected.skillIds ?? []).length && <span className="text-sm text-ink-subtle">未绑定 Skill</span>}
                  </div>
                </section>

                <div className="mt-8 pt-5 border-t border-line flex items-center justify-between">
                  <button className="btn" onClick={() => toggleAgent(selected.id)}><Power size={13} /> {selected.status === 'active' ? '暂停 Agent' : '启用 Agent'}</button>
                  <button className={clsx('btn', deleteConfirm && '!border-red-200 !bg-red-50 !text-accent-red')} onClick={deleteSelected}><Trash2 size={13} /> {deleteConfirm ? '再次点击确认删除' : '删除 Agent'}</button>
                </div>
              </div>
            ) : (
              <AgentForm draft={draft} setDraft={setDraft} availableTools={availableTools} skills={skills} mode={mode === 'new' ? 'new' : 'edit'} onCancel={() => setMode('view')} onSave={save} />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function AgentForm({ draft, setDraft, availableTools, skills, mode, onCancel, onSave }: { draft: AgentDraft; setDraft: (d: AgentDraft) => void; availableTools: { id: string; provider: string }[]; skills: { id: string; name: string; emoji: string; desc: string; enabled: boolean; source: string }[]; mode: 'edit' | 'new'; onCancel: () => void; onSave: () => void }) {
  const [toolPickerOpen, setToolPickerOpen] = useState(false)
  const [skillPickerOpen, setSkillPickerOpen] = useState(false)
  const [toolQuery, setToolQuery] = useState('')
  const [skillQuery, setSkillQuery] = useState('')
  const filteredTools = availableTools.filter((tool) => `${tool.id} ${tool.provider}`.toLowerCase().includes(toolQuery.toLowerCase()))
  const filteredSkills = skills.filter((skill) => `${skill.name} ${skill.desc} ${skill.source}`.toLowerCase().includes(skillQuery.toLowerCase()))
  const toggleTool = (tool: string) => setDraft({
    ...draft,
    tools: draft.tools.includes(tool) ? draft.tools.filter((item) => item !== tool) : [...draft.tools, tool],
  })
  const toggleSkill = (skillId: string) => setDraft({
    ...draft,
    skillIds: draft.skillIds.includes(skillId) ? draft.skillIds.filter((item) => item !== skillId) : [...draft.skillIds, skillId],
  })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h4 className="text-lg font-medium">{mode === 'new' ? '创建 Agent' : '编辑 Agent'}</h4><p className="text-xs text-ink-muted mt-1">修改后将立即应用到当前工作区。</p></div>
        <Tag kind={draft.status === 'active' ? 'green' : 'default'}>{draft.status === 'active' ? '创建后启用' : '创建后暂停'}</Tag>
      </div>

      <div className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-4">
        <Field label="头像与名称">
          <div className="flex gap-2"><input className="input w-16 text-center text-xl" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} /><input className="input flex-1" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="例如:销售复盘助手" /></div>
        </Field>
        <Field label="角色定位"><input className="input w-full" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="例如:资深数据分析顾问" /></Field>
        <Field label="功能说明"><textarea className="input w-full min-h-20 resize-y" value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} placeholder="这个 Agent 擅长什么、适合解决什么问题?" /></Field>
        <Field label="模型">
          <select className="input w-full" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })}>
            <option>FDE-X General</option><option>FDE-X Reasoning</option><option>FDE-X Fast</option><option>FDE-X Code</option><option>自定义模型</option>
          </select>
        </Field>
        <Field label="系统提示词"><textarea className="input w-full min-h-36 resize-y font-mono text-xs leading-5" value={draft.systemPrompt} onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })} placeholder="定义职责、工作方式、约束和输出格式。" /></Field>
        <Field label="工具白名单">
          <div className="relative">
            <button className="input w-full min-h-10 h-auto text-left flex items-center gap-2 flex-wrap" onClick={() => { setToolPickerOpen((value) => !value); setSkillPickerOpen(false) }}>
              {draft.tools.length ? draft.tools.map((tool) => (
                <span key={tool} className="tag bg-brand-soft text-brand border border-brand/20" onClick={(e) => { e.stopPropagation(); toggleTool(tool) }}>
                  <Wrench size={10} /> {tool} <X size={10} />
                </span>
              )) : <span className="text-ink-subtle">点击选择 Agent 可调用的工具</span>}
              <ChevronDown size={13} className={clsx('ml-auto text-ink-subtle shrink-0 transition-transform', toolPickerOpen && 'rotate-180')} />
            </button>
            {toolPickerOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-line rounded-lg shadow-pop overflow-hidden">
                <div className="p-2 border-b border-line relative">
                  <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" />
                  <input className="input w-full pl-8" value={toolQuery} onChange={(e) => setToolQuery(e.target.value)} placeholder="搜索工具或 MCP 来源" autoFocus />
                </div>
                <div className="max-h-52 overflow-y-auto p-1.5">
                  {filteredTools.map((tool) => {
                    const checked = draft.tools.includes(tool.id)
                    return (
                      <button key={tool.id} className={clsx('w-full px-2.5 py-2 rounded-md flex items-center gap-2 text-left', checked ? 'bg-brand-soft' : 'hover:bg-surface-2')} onClick={() => toggleTool(tool.id)}>
                        <span className={clsx('w-4 h-4 rounded border flex items-center justify-center shrink-0', checked ? 'bg-brand border-brand text-white' : 'border-line')}><Check size={11} className={checked ? '' : 'opacity-0'} /></span>
                        <Wrench size={13} className="text-ink-muted shrink-0" />
                        <span className="text-sm flex-1 truncate">{tool.id}</span>
                        <span className="text-[10px] text-ink-subtle truncate max-w-28">{tool.provider}</span>
                      </button>
                    )
                  })}
                  {filteredTools.length === 0 && <div className="py-6 text-center text-xs text-ink-muted">没有匹配的可用工具</div>}
                </div>
              </div>
            )}
            <div className="text-[11px] text-ink-subtle mt-1.5">候选工具来自当前已配置的 MCP，以及已有 Agent 使用过的工具。</div>
          </div>
        </Field>
        <Field label="绑定 Skills">
          <div className="relative">
            <button className="input w-full min-h-10 h-auto text-left flex items-center gap-2 flex-wrap" onClick={() => { setSkillPickerOpen((value) => !value); setToolPickerOpen(false) }}>
              {draft.skillIds.length ? draft.skillIds.map((sid) => {
                const skill = skills.find((s) => s.id === sid)
                return skill ? (
                  <span key={sid} className="tag bg-brand-soft text-brand border border-brand/20" onClick={(e) => { e.stopPropagation(); toggleSkill(sid) }}>
                    <Sparkles size={10} /> {skill.emoji} {skill.name} <X size={10} />
                  </span>
                ) : null
              }) : <span className="text-ink-subtle">点击选择这个 Agent 可以使用的 Skills</span>}
              <ChevronDown size={13} className={clsx('ml-auto text-ink-subtle shrink-0 transition-transform', skillPickerOpen && 'rotate-180')} />
            </button>
            {skillPickerOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-line rounded-lg shadow-pop overflow-hidden">
                <div className="p-2 border-b border-line relative">
                  <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" />
                  <input className="input w-full pl-8" value={skillQuery} onChange={(e) => setSkillQuery(e.target.value)} placeholder="搜索 Skill 名称或来源" autoFocus />
                </div>
                <div className="max-h-52 overflow-y-auto p-1.5">
                  {filteredSkills.map((skill) => {
                    const checked = draft.skillIds.includes(skill.id)
                    return (
                      <button key={skill.id} className={clsx('w-full px-2.5 py-2 rounded-md flex items-center gap-2 text-left', checked ? 'bg-brand-soft' : 'hover:bg-surface-2', !skill.enabled && 'opacity-60')} onClick={() => toggleSkill(skill.id)}>
                        <span className={clsx('w-4 h-4 rounded border flex items-center justify-center shrink-0', checked ? 'bg-brand border-brand text-white' : 'border-line')}><Check size={11} className={checked ? '' : 'opacity-0'} /></span>
                        <span className="text-base shrink-0">{skill.emoji}</span>
                        <span className="text-sm flex-1 min-w-0">
                          <span className="block truncate">{skill.name}</span>
                          <span className="block text-[11px] text-ink-subtle truncate">{skill.desc}</span>
                        </span>
                        <span className="text-[10px] text-ink-subtle shrink-0">{skill.source}{skill.enabled ? '' : ' · 未启用'}</span>
                      </button>
                    )
                  })}
                  {filteredSkills.length === 0 && <div className="py-6 text-center text-xs text-ink-muted">没有匹配的 Skill</div>}
                </div>
              </div>
            )}
            <div className="text-[11px] text-ink-subtle mt-1.5">Skills 是提示词/流程包；MCP 工具是可调用能力。两者可以同时绑定。</div>
          </div>
        </Field>
        <Field label="记忆策略">
          <div className="grid grid-cols-3 gap-2">
            {[['workspace', '工作区记忆'], ['session', '仅当前会话'], ['off', '不使用记忆']].map(([value, label]) => <button key={value} onClick={() => setDraft({ ...draft, memoryMode: value as AgentDraft['memoryMode'] })} className={clsx('btn justify-center', draft.memoryMode === value && '!border-brand !bg-brand-soft !text-brand')}><Check size={12} className={draft.memoryMode === value ? '' : 'opacity-0'} /> {label}</button>)}
          </div>
        </Field>
        <Field label="执行参数">
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs text-ink-muted">创造性 {draft.temperature.toFixed(1)}<input type="range" min="0" max="1" step="0.1" className="w-full mt-2 accent-brand" value={draft.temperature} onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })} /></label>
            <label className="text-xs text-ink-muted">最大执行步骤<input type="number" min="1" max="50" className="input w-full mt-1" value={draft.maxSteps} onChange={(e) => setDraft({ ...draft, maxSteps: Number(e.target.value) })} /></label>
          </div>
        </Field>
        <Field label="运行状态">
          <div className="flex gap-2"><button onClick={() => setDraft({ ...draft, status: 'active' })} className={clsx('btn', draft.status === 'active' && '!border-brand !bg-brand-soft !text-brand')}>启用</button><button onClick={() => setDraft({ ...draft, status: 'paused' })} className={clsx('btn', draft.status === 'paused' && '!bg-surface-2')}>暂停</button></div>
        </Field>
      </div>

      <div className="mt-7 pt-4 border-t border-line flex justify-end gap-2"><button className="btn" onClick={onCancel}>取消</button><button className="btn-primary" disabled={!draft.name.trim()} onClick={onSave}>{mode === 'new' ? '创建 Agent' : '保存修改'}</button></div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <><label className="text-xs text-ink-muted pt-2">{label}</label><div>{children}</div></>
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="card-2 p-3"><div className="text-[11px] text-ink-muted">{label}</div><div className="text-sm font-medium mt-1 truncate">{value}</div></div>
}
function memoryLabel(mode?: Agent['memoryMode']) {
  if (mode === 'session') return '仅当前会话'
  if (mode === 'off') return '关闭'
  return '工作区记忆'
}
