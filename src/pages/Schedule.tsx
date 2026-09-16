// 日程模块:日/周视图,事件块、聚焦模式、添加
import { useState, useMemo } from 'react'
import { Plus, Clock, MapPin, X, Trash2, Users } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import type { ScheduleEvent } from '@/lib/types'
import { PageTitle, Card, Tag, Empty } from '@/components/ui'

const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i) // 7:00 – 20:00

const KIND_TONE: Record<ScheduleEvent['kind'], { bg: string; tag: 'blue'|'green'|'amber'|'purple' }> = {
  meeting:  { bg: 'bg-blue-50 border-blue-200 text-accent-blue',     tag: 'blue' },
  focus:    { bg: 'bg-brand-soft border-brand/30 text-brand',       tag: 'green' },
  reminder: { bg: 'bg-amber-50 border-amber-200 text-accent-amber', tag: 'amber' },
  external: { bg: 'bg-purple-50 border-purple-200 text-accent-purple', tag: 'purple' },
}

export default function Schedule() {
  const events = useApp((s) => s.events)
  const addEvent = useApp((s) => s.addEvent)
  const removeEvent = useApp((s) => s.removeEvent)

  const [view, setView] = useState<'day' | 'week'>('day')
  const [openNew, setOpenNew] = useState(false)
  const [draft, setDraft] = useState<{ title: string; startH: number; startM: number; endH: number; endM: number; kind: ScheduleEvent['kind']; location: string }>({
    title: '',
    startH: 14, startM: 0, endH: 14, endM: 30, kind: 'focus', location: '',
  })

  const todayKey = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
  const todays = useMemo(() => events.filter((e) => todayKey(e.start)), [events])

  function toPos(start: string) {
    const d = new Date(start)
    return d.getHours() * 60 + d.getMinutes()
  }

  function submit() {
    if (!draft.title.trim()) return
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    base.setHours(draft.startH, draft.startM, 0, 0)
    const end = new Date(base)
    end.setHours(draft.endH, draft.endM, 0, 0)
    addEvent({
      title: draft.title,
      start: base.toISOString(),
      end: end.toISOString(),
      kind: draft.kind,
      location: draft.location || undefined,
    })
    setDraft({ title: '', startH: 14, startM: 0, endH: 14, endM: 30, kind: 'focus', location: '' })
    setOpenNew(false)
  }

  return (
    <div>
      <PageTitle
        title="日程"
        subtitle={`今天 11:50 · ${todays.length} 件事已安排`}
        actions={
          <>
            <div className="flex border border-line rounded overflow-hidden">
              <button className={clsx('px-3 py-1.5 text-sm', view === 'day'  && 'bg-ink text-white')} onClick={() => setView('day')}>日</button>
              <button className={clsx('px-3 py-1.5 text-sm', view === 'week' && 'bg-ink text-white')} onClick={() => setView('week')}>周</button>
            </div>
            <button className="btn-primary" onClick={() => setOpenNew(true)}><Plus size={14} /> 新事件</button>
          </>
        }
      />

      {view === 'day' && (
        <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-6">
          <Card className="@3xl:col-span-2 p-0 overflow-hidden">
            <div className="grid grid-cols-[64px_1fr]">
              {/* 时间轴 */}
              <div className="border-r border-line">
                {HOURS.map((h) => (
                  <div key={h} className="h-14 border-b border-line text-[10px] text-ink-muted flex items-start justify-end pr-2 pt-1">
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              {/* 事件区 */}
              <div className="relative">
                {HOURS.map((h) => (
                  <div key={h} className="h-14 border-b border-line" />
                ))}
                {/* 11:50 now line */}
                <div className="absolute left-0 right-0" style={{ top: `${4.5 * 56 + 14}px` }}>
                  <span className="absolute -left-1 -top-1.5 w-2 h-2 rounded-full bg-accent-red" />
                  <span className="block h-px bg-accent-red" />
                </div>

                {todays.map((e) => {
                  const startMin = toPos(e.start) - 7 * 60
                  const endMin = toPos(e.end) - 7 * 60
                  const top = (startMin / 60) * 56
                  const height = ((endMin - startMin) / 60) * 56
                  return (
                    <div
                      key={e.id}
                      className={clsx('absolute left-2 right-2 rounded border px-2 py-1.5 text-xs overflow-hidden', KIND_TONE[e.kind].bg)}
                      style={{ top, height: Math.max(height, 24) }}
                    >
                      <div className="font-medium truncate">{e.title}</div>
                      <div className="opacity-70 text-[11px]">
                        {new Date(e.start).getHours().toString().padStart(2, '0')}:{new Date(e.start).getMinutes().toString().padStart(2, '0')}–
                        {new Date(e.end).getHours().toString().padStart(2, '0')}:{new Date(e.end).getMinutes().toString().padStart(2, '0')}
                        {e.location && <> · {e.location}</>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Card>
              <div className="text-sm font-medium mb-3">今日清单</div>
              <ul className="space-y-2">
                {todays.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-sm group">
                    <Clock size={14} className="text-ink-muted mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{e.title}</div>
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5">
                        <Tag kind={KIND_TONE[e.kind].tag}>{e.kind}</Tag>
                        {e.location && <><MapPin size={10} /> {e.location}</>}
                      </div>
                    </div>
                    <button
                      className="btn-ghost p-1 text-ink-subtle hover:text-accent-red opacity-0 group-hover:opacity-100"
                      onClick={() => removeEvent(e.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <div className="text-sm font-medium mb-3">本周节奏</div>
              <ul className="text-xs space-y-1.5 text-ink-muted">
                <li>周一 · 重点对齐本周节奏</li>
                <li>周二 · 团队评审 + 复盘</li>
                <li>周三 · 业务对账</li>
                <li>周四 · 客户拜访</li>
                <li>周五 · 收口 + 写周报</li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {view === 'week' && (
        <Card className="overflow-x-auto">
          <div className="min-w-[760px] grid grid-cols-7 gap-px bg-line border border-line rounded overflow-hidden">
            {['周一','周二','周三','周四','周五','周六','周日'].map((d, idx) => (
              <div key={d} className="bg-surface-2 p-3">
                <div className="text-xs font-medium">{d}</div>
                <div className="text-[11px] text-ink-subtle">9 月 {7 + idx} 日</div>
              </div>
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-surface min-h-[120px] p-2 space-y-1">
                {(events.slice(0, 2 + (i % 3))).map((e, j) => (
                  <div key={j} className={clsx('p-1.5 rounded border text-[11px]', KIND_TONE[e.kind].bg)}>
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="opacity-70">
                      {new Date(e.start).getHours().toString().padStart(2, '0')}:{new Date(e.start).getMinutes().toString().padStart(2, '0')}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      {openNew && (
        <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={() => setOpenNew(false)}>
          <div className="bg-surface w-[420px] h-full border-l border-line p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">新建事件</h3>
              <button className="btn-ghost p-1" onClick={() => setOpenNew(false)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-muted">标题</label>
                <input className="input mt-1" autoFocus value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="例如:产品评审" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-muted">开始</label>
                  <div className="flex gap-1 mt-1">
                    <select className="input"
                      value={draft.startH}
                      onChange={(e) => setDraft({ ...draft, startH: Number(e.target.value) })}>
                      {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                      <option value={21}>21</option><option value={22}>22</option>
                    </select>
                    <select className="input"
                      value={draft.startM}
                      onChange={(e) => setDraft({ ...draft, startM: Number(e.target.value) })}>
                      {[0,15,30,45].map((m) => <option key={m} value={m}>{m.toString().padStart(2,'0')}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-ink-muted">结束</label>
                  <div className="flex gap-1 mt-1">
                    <select className="input"
                      value={draft.endH}
                      onChange={(e) => setDraft({ ...draft, endH: Number(e.target.value) })}>
                      {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                      <option value={21}>21</option><option value={22}>22</option>
                    </select>
                    <select className="input"
                      value={draft.endM}
                      onChange={(e) => setDraft({ ...draft, endM: Number(e.target.value) })}>
                      {[0,15,30,45].map((m) => <option key={m} value={m}>{m.toString().padStart(2,'0')}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-muted">类型</label>
                <select className="input mt-1"
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as ScheduleEvent['kind'] })}>
                  <option value="focus">深聊 / 专注</option>
                  <option value="meeting">会议</option>
                  <option value="reminder">提醒</option>
                  <option value="external">外部</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-ink-muted">地点</label>
                <input className="input mt-1" value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="会议室 A / 线上" />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button className="btn" onClick={() => setOpenNew(false)}>取消</button>
                <button className="btn-primary" onClick={submit}>创建</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
