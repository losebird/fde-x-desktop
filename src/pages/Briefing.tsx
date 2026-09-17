// 早报 / 主仪表盘:全工作台默认入口,聚合今日关键信息
import {
  Circle, Clock, Sparkles, ArrowUpRight, MessageSquare, Calendar, ListTodo, FileText, Settings2, Loader2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '@/store/app'
import {
  runtimeApi,
  type BriefingDefinition,
  type BriefingSectionResult,
  type BriefingSnapshot,
} from '@/lib/runtime-api'
import { useEvents } from '@/lib/events'
import { openRef, type OpenRefHref } from '@/lib/open-ref'
import { BriefingSettingsDrawer } from '@/components/briefing/BriefingSettingsDrawer'
import { PageTitle, SectionTitle, Card, Stat, Tag } from '@/components/ui'
import clsx from 'clsx'

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtFetchedAt(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins} 分钟前`
  const hrs = Math.round(mins / 60)
  return `${hrs} 小时前`
}

const priorityDot: Record<string, string> = {
  urgent: 'bg-accent-red',
  high: 'bg-accent-amber',
  med: 'bg-accent-blue',
  low: 'bg-ink-subtle',
}

function sectionById(sections: BriefingSectionResult[], id: string) {
  return sections.find((s) => s.id === id)
}

function buildImComposeBody(briefing: BriefingSnapshot | null, sections: BriefingSectionResult[]) {
  const lines: string[] = []
  const ai = sections.find((s) => s.type === 'ai')
  const aiText = ai?.items?.[0]?.text || ai?.body || briefing?.summary
  if (aiText) lines.push(String(aiText))
  for (const section of sections) {
    if (section.type === 'ai') continue
    const items = section.items || []
    if (!items.length && !section.error) continue
    lines.push(`\n【${section.title}】`)
    if (section.error) {
      lines.push(`（${section.error}）`)
      continue
    }
    for (const item of items.slice(0, 5)) {
      lines.push(`· ${item.text}${item.href && typeof item.href === 'object' && 'url' in item.href ? ` ${String((item.href as { url?: string }).url || '')}` : ''}`)
    }
  }
  return lines.join('\n').trim()
}

export default function Briefing() {
  const nav = useNavigate()
  const ws = useApp((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId))
  const [aiNote, setAiNote] = useState('')
  const [definition, setDefinition] = useState<BriefingDefinition | null>(null)
  const [briefing, setBriefing] = useState<BriefingSnapshot | null>(null)
  const [running, setRunning] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [imPeerId, setImPeerId] = useState('')

  const refresh = useCallback((onOpen = true) => {
    void runtimeApi.getLatestBriefing(onOpen).then((data) => {
      setDefinition(data.definition)
      setBriefing(data.briefing)
    }).catch((cause) => {
      setAiNote(cause instanceof Error ? cause.message : '加载早报失败')
    })
  }, [])

  useEffect(() => {
    refresh(true)
    void runtimeApi.imState().then((data) => {
      const peers = Array.isArray(data.peers) ? data.peers as Array<Record<string, unknown>> : []
      const first = peers.find((peer) => !peer.unpaired)
      setImPeerId(first ? String(first.id || '') : '')
    }).catch(() => setImPeerId(''))
  }, [refresh])

  useEvents(['briefing.ready'], () => {
    refresh(false)
  })

  const enabledDefs = useMemo(
    () => (definition?.sections || []).filter((s) => s.enabled),
    [definition],
  )

  const resultSections = useMemo(() => {
    const results = briefing?.sections || []
    const order = enabledDefs.map((d) => d.id)
    return [...results].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  }, [briefing, enabledDefs])

  const statSections = resultSections.filter((s) => s.render === 'stat' && s.stat)
  const mainSections = resultSections.filter((s) => s.render !== 'stat' && s.type !== 'ai')
  const aiSection = resultSections.find((s) => s.type === 'ai')

  const statusLine = useMemo(() => {
    const at = definition?.schedule?.at || '08:30'
    const last = briefing?.generatedAt ? fmtTime(briefing.generatedAt) : '—'
    const failed = resultSections.filter((s) => s.error)
    const failHint = failed.length ? ` · ${failed.map((s) => `${s.title}失败`).join('、')}` : ''
    return `${at} 自动 · 上次 ${last}${failHint}`
  }, [definition, briefing, resultSections])

  const runFull = () => {
    setRunning(true)
    setAiNote('')
    void runtimeApi.runBriefing('full').then((data) => {
      setBriefing(data.briefing)
      refresh(false)
    }).catch((cause) => {
      setAiNote(cause instanceof Error ? cause.message : '生成失败')
    }).finally(() => setRunning(false))
  }

  const openItem = (href?: OpenRefHref | Record<string, unknown>) => {
    if (!href || typeof href !== 'object') return
    openRef(href as OpenRefHref)
  }

  const now = new Date()
  const dateLabel = now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })

  const tasksSection = sectionById(resultSections, 'tasks-today') || resultSections.find((s) => s.type === 'tasks')
  const eventsSection = resultSections.find((s) => s.type === 'events')

  return (
    <div>
      <PageTitle
        title={`早上好 · ${ws?.emoji ?? '🧭'}  ${ws?.name ?? '工作台'}`}
        subtitle={dateLabel}
        actions={
          <>
            <span className="text-xs text-ink-muted mr-2">{statusLine}</span>
            {aiNote && <div className="text-xs text-accent-red mr-2">{aiNote}</div>}
            <button type="button" className="btn" onClick={() => setSettingsOpen(true)}>
              <Settings2 size={14} /> 自定义
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={running}
              onClick={runFull}
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              生成新早报
            </button>
          </>
        }
      />

      {statSections.length > 0 && (
        <div className="grid grid-cols-2 @md:grid-cols-3 @3xl:grid-cols-6 gap-3 mb-8">
          {statSections.map((m) => (
            <Stat
              key={m.id}
              label={m.stat?.label || m.title}
              value={String(m.stat?.value ?? '—')}
              unit={m.stat?.unit}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-6">
        <div className="@3xl:col-span-2 space-y-6">
          {mainSections.map((section) => {
            if (section.render === 'timeline' || section.type === 'events') {
              return (
                <div key={section.id}>
                  <SectionTitle title={section.title} right={<Link to="/schedule" className="btn-ghost">完整日程 <ArrowUpRight size={12} /></Link>} />
                  <Card>
                    {section.error && (
                      <div className="text-sm text-accent-red mb-2 flex items-center justify-between">
                        <span>{section.title} {fmtFetchedAt(section.fetchedAt)}失败：{section.error}</span>
                        <button type="button" className="btn-ghost text-xs" onClick={runFull}>重试</button>
                      </div>
                    )}
                    <ol className="relative pl-6">
                      <span className="absolute left-2 top-1 bottom-1 w-px bg-line" />
                      {(section.items || []).map((e) => (
                        <li key={e.ref || e.text} className="relative py-2.5 pl-3">
                          <span className="absolute -left-[19px] top-3 w-3 h-3 rounded-full border-2 border-surface bg-brand" />
                          <button type="button" className="text-sm font-medium text-left w-full" onClick={() => openItem(e.href)}>
                            {e.text}
                          </button>
                          {e.sub && <div className="text-xs text-ink-muted mt-0.5">{e.sub}</div>}
                        </li>
                      ))}
                    </ol>
                  </Card>
                </div>
              )
            }

            if (section.type === 'tasks') {
              return (
                <div key={section.id}>
                  <SectionTitle
                    title={section.title}
                    right={<Link to="/tasks" className="btn-ghost">查看全部 <ArrowUpRight size={12} /></Link>}
                  />
                  <Card>
                    {section.error && (
                      <div className="text-sm text-accent-red mb-2">{section.error}</div>
                    )}
                    <ul className="divide-y divide-line">
                      {(section.items || []).map((t) => (
                        <li key={t.ref || t.text} className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
                          <span className={clsx('w-2 h-2 rounded-full shrink-0', priorityDot.med)} />
                          <button type="button" className="flex-1 truncate text-sm text-left" onClick={() => openItem(t.href)}>{t.text}</button>
                        </li>
                      ))}
                    </ul>
                    {section.overdue && section.overdue.length > 0 && (
                      <ul className="mt-3 space-y-2 border-t border-line pt-3">
                        {section.overdue.map((t) => (
                          <li key={t.ref || t.text} className="text-sm flex items-center gap-2">
                            <Circle size={14} className="text-accent-red" />
                            <span className="flex-1">{t.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
              )
            }

            return (
              <div key={section.id}>
                <SectionTitle title={section.title} count={(section.items || []).length} />
                <Card>
                  {section.error && (
                    <div className="text-sm text-accent-red mb-2 flex items-center justify-between gap-2">
                      <span>{section.title} {fmtFetchedAt(section.fetchedAt)}失败：{section.error}</span>
                      <button type="button" className="btn-ghost text-xs" onClick={runFull}>重试</button>
                    </div>
                  )}
                  <ul className="space-y-3">
                    {(section.items || []).length === 0 && !section.error && (
                      <li className="text-sm text-ink-muted">暂无内容</li>
                    )}
                    {(section.items || []).map((item) => (
                      <li key={item.ref || item.text} className="flex items-start gap-2">
                        {section.type === 'im' ? <MessageSquare size={14} className="text-accent-blue mt-0.5" /> : <FileText size={14} className="text-ink-muted mt-0.5" />}
                        <button type="button" className="text-sm flex-1 text-left" onClick={() => openItem(item.href)}>
                          {item.sub && <span className="font-medium">{item.sub} </span>}
                          {item.text}
                        </button>
                        <Clock size={12} className="text-ink-subtle mt-1" />
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )
          })}

          {!mainSections.length && !tasksSection && !eventsSection && (
            <Card className="text-sm text-ink-muted">打开自定义或生成新早报以加载区块。</Card>
          )}
        </div>

        <div className="space-y-6">
          {(aiSection || enabledDefs.some((d) => d.type === 'ai')) && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-brand" />
                <div className="text-sm font-medium">AI 早报 · 主助手</div>
              </div>
              <div className="text-sm leading-6 text-ink space-y-2">
                {aiSection?.error && (
                  <p className="text-accent-red">{aiSection.error}</p>
                )}
                <p>{aiSection?.items?.[0]?.text || aiSection?.body || briefing?.summary || '点右上角「生成新早报」获取 AI 摘要。'}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const text = buildImComposeBody(briefing, resultSections)
                    if (!text) {
                      setAiNote('还没有可发送的早报内容')
                      return
                    }
                    if (!imPeerId) {
                      setAiNote('还没有配对的联系人，可先打开 IM 配对')
                      return
                    }
                    setAiNote('')
                    void runtimeApi.imCompose({ text, peerId: imPeerId }).then(() => {
                      useApp.getState().setActiveThread(imPeerId)
                      useApp.getState().togglePanel('im', 'full')
                    }).catch((cause) => setAiNote(cause instanceof Error ? cause.message : '写入输入框失败'))
                  }}
                >
                  发往 IM
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const title = `早报 · ${new Date().toLocaleDateString('zh-CN')}`
                    const body = buildImComposeBody(briefing, resultSections)
                    if (!body) {
                      setAiNote('还没有可保存的早报内容')
                      return
                    }
                    void runtimeApi.draftMemoryCard(`${title}\n${body}`, 'correction')
                      .catch((cause) => setAiNote(cause instanceof Error ? cause.message : '保存到记忆失败'))
                    nav('/memory')
                  }}
                >
                  保存到记忆
                </button>
              </div>
            </Card>
          )}

          <div>
            <SectionTitle title="快捷" />
            <div className="grid grid-cols-2 gap-2">
              <Link to="/tasks" className="card p-3 hover:bg-surface-2 transition-colors">
                <ListTodo size={14} className="mb-1 text-accent-blue" />
                <div className="text-sm font-medium">添加任务</div>
                <div className="text-xs text-ink-muted mt-0.5">⌘ + T</div>
              </Link>
              <Link to="/schedule" className="card p-3 hover:bg-surface-2 transition-colors">
                <Calendar size={14} className="mb-1 text-accent-amber" />
                <div className="text-sm font-medium">排个会议</div>
                <div className="text-xs text-ink-muted mt-0.5">⌘ + E</div>
              </Link>
              <Link to="/ai" className="card p-3 hover:bg-surface-2 transition-colors">
                <Sparkles size={14} className="mb-1 text-brand" />
                <div className="text-sm font-medium">问 AI</div>
                <div className="text-xs text-ink-muted mt-0.5">⌘ + K</div>
              </Link>
              <Link to="/memory" className="card p-3 hover:bg-surface-2 transition-colors">
                <FileText size={14} className="mb-1 text-accent-purple" />
                <div className="text-sm font-medium">记一笔</div>
                <div className="text-xs text-ink-muted mt-0.5">⌘ + ;</div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BriefingSettingsDrawer
        open={settingsOpen}
        definition={definition}
        onClose={() => setSettingsOpen(false)}
        onSaved={(def) => {
          setDefinition(def)
          refresh(false)
        }}
      />
    </div>
  )
}
