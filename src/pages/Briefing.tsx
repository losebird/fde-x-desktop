// 早报 / 主仪表盘:全工作台默认入口,聚合今日关键信息
import {
  Circle, Clock, Sparkles, ArrowUpRight, MessageSquare, Bell, Calendar, ListTodo, FileText,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '@/store/app'
import { runtimeApi } from '@/lib/runtime-api'
import { loadCurrentAiTarget } from '@/lib/ai-target'
import { PageTitle, SectionTitle, Card, Stat, Tag } from '@/components/ui'
import clsx from 'clsx'

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const priorityDot: Record<string, string> = {
  urgent: 'bg-accent-red',
  high:   'bg-accent-amber',
  med:    'bg-accent-blue',
  low:    'bg-ink-subtle',
}

export default function Briefing() {
  const nav = useNavigate()
  const tasks = useApp((s) => s.tasks)
  const events = useApp((s) => s.events)
  const metrics = useApp((s) => s.metrics)
  const news = useApp((s) => s.news)
  const notifs = useApp((s) => s.notifications)
  const ws = useApp((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId))
  const markAllNotifRead = useApp((s) => s.markAllNotifRead)
  const [aiNote, setAiNote] = useState('')
  const [unreadIM, setUnreadIM] = useState<Array<{ id: string; from: string; text: string }>>([])
  const [imPeerId, setImPeerId] = useState('')

  useEffect(() => {
    let alive = true
    const pull = () => {
      void runtimeApi.imState().then((data) => {
        if (!alive) return
        const requests = Array.isArray(data.requests) ? data.requests as Array<Record<string, unknown>> : []
        setUnreadIM(requests.filter((row) => row.unread && row.kind !== 'outgoing').map((row) => ({
          id: String(row.id || ''),
          from: String(row.fromName || row.from || ''),
          text: String(row.body || row.excerpt || row.last || ''),
        })))
        const peers = Array.isArray(data.peers) ? data.peers as Array<Record<string, unknown>> : []
        const first = peers.find((peer) => !peer.unpaired)
        setImPeerId(first ? String(first.id || '') : '')
      }).catch(() => {
        if (alive) {
          setUnreadIM([])
          setImPeerId('')
        }
      })
    }
    pull()
    const timer = window.setInterval(pull, 8000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const now = new Date()
  const todayKey = (iso: string) => new Date(iso).toDateString() === now.toDateString()
  const todayTasks = tasks.filter((t) => t.status !== 'archived' && t.due && todayKey(t.due))
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.due && new Date(t.due) < now)
  const openTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'doing')
  const todayEvents = events.filter((e) => todayKey(e.start)).sort((a, b) => a.start.localeCompare(b.start))
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const clockLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const nowEvent = todayEvents.find((e) => {
    const s = new Date(e.start).getHours() * 60 + new Date(e.start).getMinutes()
    const en = new Date(e.end).getHours() * 60 + new Date(e.end).getMinutes()
    return currentMinutes >= s && currentMinutes < en
  })

  return (
    <div>
      <PageTitle
        title={`早上好 · ${ws?.emoji ?? '🧭'}  ${ws?.name ?? '工作台'}`}
        subtitle="由主助手自动整理的今日视图。IM 已按「早间计划」静音,可在顶栏恢复。"
        actions={
          <>
            <button className="btn"><Calendar size={14} /> 今日 {clockLabel}</button>
            {aiNote && <div className="text-xs text-accent-red mr-2">{aiNote}</div>}
            <button
              className="btn-primary"
              onClick={() => {
                const summary = `请根据当前工作区整理今日早报。待办 ${openTasks.length}，逾期 ${overdueTasks.length}，今日事件 ${todayEvents.length}。`
                setAiNote('')
                void loadCurrentAiTarget().then((target) => {
                  if (!target.ok) {
                    setAiNote(target.error)
                    return
                  }
                  return runtimeApi.promptAi(target.sessionId, { text: `【早报】\n${summary}` })
                }).catch((cause) => setAiNote(cause instanceof Error ? cause.message : '早报生成失败'))
              }}
            >
              <Sparkles size={14} /> 生成新早报
            </button>
          </>
        }
      />

      {/* 关键指标:使用容器查询,避免在窄 Stage 面板里被挤爆 */}
      <div className="grid grid-cols-2 @md:grid-cols-3 @3xl:grid-cols-6 gap-3 mb-8">
        {metrics.map((m) => (
          <Stat
            key={m.id}
            label={m.label}
            value="—"
            hint="无业务连接器，不显示假数字"
            unit={m.unit}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-6">
        {/* 今日三件事 — 主线 */}
        <div className="@3xl:col-span-2 space-y-6">
          {nowEvent && (
            <Card className="border-brand/30 bg-brand-soft/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-brand font-medium">进行中</div>
                  <div className="mt-1 text-lg font-medium">{nowEvent.title}</div>
                  <div className="text-sm text-ink-muted mt-0.5">
                    {fmtTime(nowEvent.start)} – {fmtTime(nowEvent.end)} · {nowEvent.location ?? '无地点'}
                  </div>
                </div>
                <button
                  className="btn-brand"
                  onClick={() => {
                    if (!nowEvent) return
                    useApp.getState().addEvent({
                      title: `专注: ${nowEvent.title}`,
                      start: new Date(Date.now()).toISOString(),
                      end: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
                      kind: 'focus',
                    })
                  }}
                >
                  加入专注
                </button>
              </div>
            </Card>
          )}

          <div>
            <SectionTitle
              title="今日三件事"
              right={<Link to="/tasks" className="btn-ghost">查看全部 <ArrowUpRight size={12} /></Link>}
            />
            <Card>
              <ul className="divide-y divide-line">
                {(todayTasks.length ? todayTasks : openTasks.slice(0, 3)).slice(0, 3).map((t) => (
                  <li key={t.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
                    <span className={clsx('w-2 h-2 rounded-full shrink-0', priorityDot[t.priority])} />
                    <span className="flex-1 truncate text-sm">{t.title}</span>
                    {t.due && <Tag kind="default">{t.due}</Tag>}
                    <Tag kind={t.priority === 'urgent' ? 'red' : t.priority === 'high' ? 'amber' : 'blue'}>
                      {t.priority}
                    </Tag>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {overdueTasks.length > 0 && (
            <div>
              <SectionTitle title="逾期未完" count={overdueTasks.length} />
              <Card>
                <ul className="space-y-2">
                  {overdueTasks.slice(0, 3).map((t) => (
                    <li key={t.id} className="text-sm flex items-center gap-2">
                      <Circle size={14} className="text-accent-red" />
                      <span className="flex-1">{t.title}</span>
                      <Tag kind="red">应于 {t.due}</Tag>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          <div>
            <SectionTitle title="今日时间线" right={<Link to="/schedule" className="btn-ghost">完整日程 <ArrowUpRight size={12} /></Link>} />
            <Card>
              <ol className="relative pl-6">
                <span className="absolute left-2 top-1 bottom-1 w-px bg-line" />
                {todayEvents.map((e) => {
                  const s = new Date(e.start).getHours() * 60 + new Date(e.start).getMinutes()
                  const isPast = currentMinutes > s
                  const isNow = nowEvent?.id === e.id
                  return (
                    <li key={e.id} className={clsx('relative py-2.5 pl-3', isPast && 'opacity-60')}>
                      <span className={clsx(
                        'absolute -left-[19px] top-3 w-3 h-3 rounded-full border-2 border-surface',
                        e.kind === 'meeting' && 'bg-accent-blue',
                        e.kind === 'focus' && 'bg-brand',
                        e.kind === 'reminder' && 'bg-accent-amber',
                        e.kind === 'external' && 'bg-accent-purple',
                        isNow && 'ring-2 ring-brand ring-offset-2 ring-offset-surface',
                      )} />
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm font-medium">
                          {fmtTime(e.start)}–{fmtTime(e.end)} · {e.title}
                        </div>
                        <Tag kind={e.kind === 'meeting' ? 'blue' : e.kind === 'focus' ? 'green' : e.kind === 'reminder' ? 'amber' : 'purple'}>
                          {e.kind}
                        </Tag>
                      </div>
                      {e.location && (
                        <div className="text-xs text-ink-muted mt-0.5">{e.location}</div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </Card>
          </div>
        </div>

        {/* 右栏: 早报、通知、IM */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-brand" />
              <div className="text-sm font-medium">AI 早报 · 主助手</div>
            </div>
            <div className="text-sm leading-6 text-ink space-y-2">
              <p>点右上角「生成新早报」，由当前 AI 会话整理今日事项。没有连接器时指标为 —。</p>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="btn"
                onClick={() => {
                  const summary = `🤖 AI 早报自动推送:\n\n主线:把 scene#39 收口成可演示版本\n今日 3 件事:${(todayTasks.length ? todayTasks : openTasks.slice(0, 3)).slice(0, 3).map((t) => t.title).join(' / ')}\n逾期:${overdueTasks.length} 件\n时间线:${todayEvents.length} 个事件`
                  if (!imPeerId) {
                    setAiNote('还没有配对的联系人，无法发到 IM')
                    return
                  }
                  void runtimeApi.imCompose({ text: summary, peerId: imPeerId }).then(async (composed) => {
                    const requestId = String(composed.requestId || composed.id || '')
                    if (requestId) await runtimeApi.imSend({ requestId })
                    useApp.getState().setActiveThread(imPeerId)
                    useApp.getState().togglePanel('im', 'full')
                  }).catch((cause) => setAiNote(cause instanceof Error ? cause.message : '发到 IM 失败'))
                }}
              >
                发往 IM
              </button>
              <button
                className="btn"
                onClick={() => {
                  const title = `早报 · ${new Date().toLocaleDateString('zh-CN')}`
                  const body = `主线:把 scene#39 收口成可演示版本\n3 件事:${(todayTasks.length ? todayTasks : openTasks.slice(0, 3)).slice(0, 3).map((t) => t.title).join(' / ')}`
                  void runtimeApi.draftMemoryCard(`${title}\n${body}`, 'correction')
                    .catch(() => undefined)
                  nav('/memory')
                }}
              >
                保存到记忆
              </button>
            </div>
          </Card>

          <div>
            <SectionTitle title="通知" count={notifs.length} right={
              <>
                <button onClick={markAllNotifRead} className="btn-ghost mr-2">全部已读</button>
                <Link to="/settings" className="btn-ghost">偏好</Link>
              </>
            } />
            <Card>
              <ul className="space-y-3">
                {notifs.slice(0, 5).map((n) => (
                  <li key={n.id} className="flex items-start gap-2">
                    <Bell size={14} className={clsx(
                      'mt-0.5',
                      n.kind === 'warning' && 'text-accent-amber',
                      n.kind === 'error' && 'text-accent-red',
                      n.kind === 'success' && 'text-brand',
                      n.kind === 'info' && 'text-accent-blue',
                    )} />
                    <div className="text-sm flex-1">
                      <div className="font-medium">{n.title}</div>
                      {n.body && <div className="text-xs text-ink-muted mt-0.5">{n.body}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div>
            <SectionTitle title="未读 IM" count={unreadIM.length} right={<button type="button" onClick={() => useApp.getState().togglePanel('im', 'full')} className="btn-ghost">进入 <ArrowUpRight size={12} /></button>} />
            <Card>
              <ul className="space-y-3">
                {unreadIM.length === 0 && (
                  <li className="text-sm text-ink-muted">🎉 暂时没有未读。</li>
                )}
                {unreadIM.slice(0, 4).map((m) => (
                    <li key={m.id} className="flex items-start gap-2">
                      <MessageSquare size={14} className="text-accent-blue mt-0.5" />
                      <div className="text-sm flex-1">
                        <span className="font-medium">{m.from || '同事'}</span>
                        <span className="text-ink-muted ml-1">{m.text.slice(0, 60)}</span>
                      </div>
                      <Clock size={12} className="text-ink-subtle mt-1" />
                    </li>
                ))}
              </ul>
            </Card>
          </div>

          <div>
            <SectionTitle title="今日新闻/资讯" count={news.length} />
            <Card>
              <ul className="space-y-3">
                {news.map((n) => (
                  <li key={n.id} className="flex items-start gap-2">
                    <FileText size={14} className="text-ink-muted mt-0.5" />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {n.source} · {fmtTime(n.ts)}
                        {typeof n.delta === 'number' && (
                          <Tag kind={n.delta > 0 ? 'red' : 'teal'}> {n.delta > 0 ? '+' : ''}{(n.delta * 100).toFixed(1)}%</Tag>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

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
    </div>
  )
}
