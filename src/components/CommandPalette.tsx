// ⌘+K 全局命令面板:文件 / 联系人 / Agent / 任务 / 页面 / Workflow 五类统一搜索
import { useEffect, useMemo, useRef, useState } from 'react'
import { runtimeApi } from '@/lib/runtime-api'
import { loadCurrentAiTarget } from '@/lib/ai-target'
import { Search, FileText, MessageSquare, Bot, CheckSquare, LayoutGrid, Repeat, Brain } from 'lucide-react'
import { useApp, useCurrentFiles, useCurrentAgents, useCurrentWorkflows, useCurrentTasks } from '@/store/app'
import { useNavigate } from 'react-router-dom'

type Result = {
  group: string
  id: string
  title: string
  hint?: string
  icon: any
  action: () => void
}

export function CommandPalette() {
  const open = useApp((s) => s.paletteOpen)
  const setOpen = useApp((s) => s.setPaletteOpen)
  // 文件 / Agent / 工作流 按当前工作区过滤(全局搜索也应只搜当前工作区内容)
  const storeContacts = useApp((s) => s.imContacts)
  const [liveContacts, setLiveContacts] = useState(storeContacts)
  const [files, setFiles] = useState<Array<{ id: string; name: string; kind: string; size: number }>>([])
  const [agents, setAgents] = useState<Array<{ id: string; name: string; desc: string; emoji: string }>>([])
  const [memories, setMemories] = useState<Array<{ id: string; title: string; snippet: string }>>([])
  useEffect(() => {
    void runtimeApi.imState().then((data) => {
      const peers = Array.isArray(data.peers) ? data.peers as Array<Record<string, unknown>> : []
      if (!peers.length) {
        setLiveContacts([])
        return
      }
      setLiveContacts(peers.map((peer) => ({
        id: String(peer.id || ''),
        kind: 'contact' as const,
        name: String(peer.displayName || peer.id || ''),
        handle: String(peer.door || ''),
        avatarColor: 'bg-slate-700',
        online: Boolean(peer.online),
      })))
    }).catch(() => setLiveContacts([]))
    void (async () => {
      try {
        const status = await runtimeApi.aiStatus()
        if (!status.connected) {
          setFiles([])
          setAgents([])
          return
        }
        const roster = await runtimeApi.listAiPresets().catch(() => ({ presets: [] as Array<{ id: string; name?: string; description?: string }> }))
        setAgents((roster.presets ?? []).map((preset) => ({
          id: preset.id,
          name: preset.name ?? preset.id,
          desc: preset.description ?? '',
          emoji: '✦',
        })))
        const target = await loadCurrentAiTarget()
        if (!target.ok) {
          setFiles([])
          return
        }
        const listing = await runtimeApi.listWorkspaceFiles(target.sessionId, '.')
        setFiles((listing.entries ?? []).map((entry) => ({
          id: entry.name,
          name: entry.name,
          kind: entry.type,
          size: entry.size ?? 0,
        })))
      } catch {
        setFiles([])
        setAgents([])
      }
    })()
  }, [open])
  const contacts = liveContacts
  const tasks = useCurrentTasks()
  const workflows = useCurrentWorkflows()

  const setActiveFile = useApp((s) => s.setActiveFile)
  const setActiveAgent = useApp((s) => s.setActiveAgent)
  const setActiveChat = useApp((s) => s.setActiveChat)
  const openIMPanel = useApp((s) => s.openIMPanel)
  const togglePanel = useApp((s) => s.togglePanel)
  const setActivePlanTab = useApp((s) => s.setActivePlanTab)
  const selectTask = useApp((s) => s.selectTask)

  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = () => setOpen(false)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
    if (!open) {
      setQ('')
      setMemories([])
    }
  }, [open])

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setMemories([])
      return
    }
    const handle = window.setTimeout(() => {
      void runtimeApi.searchMemory(q.trim()).then((data) => {
        const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : []
        const excerpts = Array.isArray(data.excerpts) ? data.excerpts as Array<Record<string, unknown>> : []
        const rows = items.length ? items : excerpts
        setMemories(rows.slice(0, 5).map((row, index) => ({
          id: String(row.id || index),
          title: String(row.then || row.title || row.id || '摘录'),
          snippet: String(row.snippet || row.excerpt || row.text || row.content || ''),
        })))
      }).catch(() => setMemories([]))
    }, 280)
    return () => window.clearTimeout(handle)
  }, [q, open])

  const openPanel = (id: string) => { togglePanel(id, 'full'); navigate('/ai'); close() }
  const pages: Result[] = [
    { group: '功能', icon: LayoutGrid, id: 'p_ai',     title: 'AI 主工作区',       action: () => { navigate('/ai'); close() } },
    { group: '功能', icon: LayoutGrid, id: 'p_im',     title: 'IM 消息面板',       action: () => { openIMPanel(); navigate('/ai'); close() } },
    { group: '功能', icon: LayoutGrid, id: 'p_brief',  title: '早报',              action: () => openPanel('briefing') },
    { group: '功能', icon: LayoutGrid, id: 'p_plan',   title: '计划 / 任务 / 日程', action: () => openPanel('plan') },
    { group: '功能', icon: LayoutGrid, id: 'p_files',  title: '文件',              action: () => openPanel('files') },
    { group: '功能', icon: LayoutGrid, id: 'p_data',   title: '业务应用 / 数据操作', action: () => openPanel('data') },
    { group: '功能', icon: LayoutGrid, id: 'p_mcp',    title: 'MCP 管理',          action: () => openPanel('mcp') },
    { group: '功能', icon: LayoutGrid, id: 'p_skills', title: 'Skills 管理',       action: () => openPanel('skills') },
    { group: '功能', icon: LayoutGrid, id: 'p_mem',    title: '记忆系统',          action: () => openPanel('memory') },
    { group: '功能', icon: LayoutGrid, id: 'p_set',    title: '设置',              action: () => openPanel('settings') },
  ]

  const results = useMemo<Result[]>(() => {
    const list: Result[] = []
    const lower = q.toLowerCase()

    files.filter((f) => !q || f.name.toLowerCase().includes(lower)).slice(0, 8).forEach((f) => {
      list.push({
        group: '文件', icon: FileText, id: `f_${f.id}`, title: f.name,
        hint: f.kind === 'directory' ? '文件夹' : `${f.kind} · ${f.size}B`,
        action: () => { togglePanel('files', 'full'); close(); navigate('/ai') },
      })
    })
    contacts.filter((c) => !q || c.name.includes(q) || c.handle.includes(q)).slice(0, 5).forEach((c) => {
      list.push({
        group: '联系人', icon: MessageSquare, id: `c_${c.id}`, title: c.name,
        hint: c.handle,
        action: () => { openIMPanel(c.id); close(); navigate('/ai') },
      })
    })
    agents.filter((a) => !q || a.name.includes(q)).slice(0, 5).forEach((a) => {
      list.push({
        group: 'Agent', icon: Bot, id: `a_${a.id}`, title: `${a.emoji} ${a.name}`,
        hint: a.desc,
        action: () => { close(); navigate('/ai') },
      })
    })
    tasks.filter((t) => !q || t.title.includes(q)).slice(0, 5).forEach((t) => {
      list.push({
        group: '任务', icon: CheckSquare, id: `t_${t.id}`, title: t.title,
        hint: `${t.status} · ${t.priority}`,
        action: () => {
          setActivePlanTab('todo')
          selectTask(t.id)
          togglePanel('plan', 'full')
          close()
          navigate('/ai')
        },
      })
    })
    workflows.filter((w) => !q || w.name.includes(q)).slice(0, 5).forEach((w) => {
      list.push({
        group: '工作流', icon: Repeat, id: `wf_${w.id}`, title: `${w.emoji} ${w.name}`,
        hint: w.description.slice(0, 30),
        action: () => { togglePanel('plan', 'full'); close(); navigate('/ai') },
      })
    })
    memories.forEach((row) => {
      list.push({
        group: '记忆', icon: Brain, id: `m_${row.id}`, title: row.snippet.slice(0, 40) || row.title,
        hint: row.title,
        action: () => { togglePanel('memory', 'full'); close(); navigate('/ai') },
      })
    })
    pages.filter((p) => !q || p.title.includes(q)).forEach((p) => list.push(p))

    return list
  }, [q, files, contacts, agents, tasks, workflows, memories])

  useEffect(() => { setIdx(0) }, [q])

  const grouped = useMemo(() => {
    const m = new Map<string, Result[]>()
    results.forEach((r) => {
      if (!m.has(r.group)) m.set(r.group, [])
      m.get(r.group)!.push(r)
    })
    return Array.from(m.entries())
  }, [results])

  const runByIdx = (i: number) => results[i]?.action()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-ink/30 backdrop-blur-sm" onClick={close}>
      <div
        className="w-[640px] max-w-[92vw] bg-surface rounded-xl shadow-2xl border border-line overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line flex items-center gap-3">
          <Search size={16} className="text-ink-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) }
              else if (e.key === 'Enter') { e.preventDefault(); runByIdx(idx) }
              else if (e.key === 'Escape') close()
            }}
            placeholder="搜文件、联系人、Agent、任务、Workflow、页面..."
            className="flex-1 bg-transparent focus:outline-none text-base placeholder:text-ink-subtle"
          />
          <kbd className="kbd">⌘K</kbd>
        </div>
        <div className="max-h-[60vh] overflow-auto py-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-muted">无匹配结果 · 试试别的词</div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group}>
                <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide text-ink-subtle">{group}</div>
                {items.map((r) => {
                  const flatIdx = results.indexOf(r)
                  const Icon = r.icon
                  return (
                    <button
                      key={r.id}
                      onMouseEnter={() => setIdx(flatIdx)}
                      onClick={r.action}
                      className={`w-full px-4 py-2 flex items-center gap-2 text-left text-sm ${flatIdx === idx ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-surface-2'}`}
                    >
                      <Icon size={14} className="text-ink-subtle shrink-0" />
                      <span className="flex-1 truncate">{r.title}</span>
                      {r.hint && <span className="text-xs text-ink-subtle truncate max-w-[180px]">{r.hint}</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-line text-[10px] text-ink-subtle flex gap-3">
          <span><kbd className="kbd !py-0">↑↓</kbd> 选择</span>
          <span><kbd className="kbd !py-0">↵</kbd> 打开</span>
          <span><kbd className="kbd !py-0">Esc</kbd> 关闭</span>
          <div className="flex-1" />
          <span>scene#39 · 命令面板</span>
        </div>
      </div>
    </div>
  )
}
