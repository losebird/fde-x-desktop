// ⌘+K 命令面板：只渲染 GET /api/v1/search 的检索表
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, FileText, MessageSquare, Bot, CheckSquare, LayoutGrid, Repeat, Brain,
  Users, Wand2, Plug, MessagesSquare,
} from 'lucide-react'
import { runtimeApi, type SearchHit } from '@/lib/runtime-api'
import { useApp } from '@/store/app'
import { openRef } from '@/lib/open-ref'

type Result = {
  group: string
  id: string
  title: string
  hint?: string
  icon: typeof FileText
  href: SearchHit['href']
}

const GROUP_LABEL: Record<string, string> = {
  session: '会话',
  file: '文件',
  contact: '联系人',
  letter: '聊天记录',
  group: '群',
  agent: 'Agent',
  task: '任务',
  workflow: '工作流',
  memory: '记忆',
  skill: 'Skills',
  mcp: 'MCP',
  page: '功能',
}

const GROUP_ICON: Record<string, typeof FileText> = {
  session: MessagesSquare,
  file: FileText,
  contact: MessageSquare,
  letter: MessageSquare,
  group: Users,
  agent: Bot,
  task: CheckSquare,
  workflow: Repeat,
  memory: Brain,
  skill: Wand2,
  mcp: Plug,
  page: LayoutGrid,
}

function toResult(hit: SearchHit): Result {
  return {
    group: GROUP_LABEL[hit.kind] || hit.kind,
    id: `${hit.kind}:${hit.id}`,
    title: hit.title,
    hint: hit.hint,
    icon: GROUP_ICON[hit.kind] || Search,
    href: hit.href || {},
  }
}

export function CommandPalette() {
  const open = useApp((s) => s.paletteOpen)
  const setOpen = useApp((s) => s.setPaletteOpen)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [hits, setHits] = useState<SearchHit[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const close = () => setOpen(false)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
    if (!open) {
      setQ('')
      setHits([])
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    const delay = q.trim() ? 280 : 0
    const handle = window.setTimeout(() => {
      void runtimeApi.search(q.trim(), ac.signal).then((data) => {
        if (ac.signal.aborted) return
        setHits(Array.isArray(data.hits) ? data.hits : [])
      }).catch(() => {
        if (ac.signal.aborted) return
        setHits([])
      })
    }, delay)
    return () => {
      window.clearTimeout(handle)
      ac.abort()
    }
  }, [q, open])

  const results = useMemo(() => hits.map(toResult), [hits])

  useEffect(() => { setIdx(0) }, [q, hits])

  const grouped = useMemo(() => {
    const m = new Map<string, Result[]>()
    results.forEach((r) => {
      if (!m.has(r.group)) m.set(r.group, [])
      m.get(r.group)!.push(r)
    })
    return Array.from(m.entries())
  }, [results])

  const runByIdx = (i: number) => {
    const row = results[i]
    if (!row) return
    close()
    openRef(row.href)
  }

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
            placeholder="搜文件、联系人、会话、聊天记录、记忆、Agent、任务、Workflow、页面..."
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
                      onClick={() => runByIdx(flatIdx)}
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
          <span>命令面板</span>
        </div>
      </div>
    </div>
  )
}
