// 设置:账户 / 外观 / 通知 / 快捷键 / 数据管理
import { useCallback, useEffect, useState } from 'react'
import { User, Palette, Bell, Keyboard, Database, Trash2, RefreshCw, Activity, Brain, Bot, MessageCircleMore, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { PageTitle, Card, Tag } from '@/components/ui'
import { RuntimeApiError, runtimeApi, type RuntimeHealth } from '@/lib/runtime-api'
import { CoreSettings } from '@/components/settings/CoreSettings'
import { SemanticSettings } from '@/components/settings/SemanticSettings'

const SECTIONS = [
  { id: 'account',   label: '账户',       icon: User },
  { id: 'appearance',label: '外观',       icon: Palette },
  { id: 'notifs',    label: '通知',       icon: Bell },
  { id: 'shortcuts', label: '快捷键',     icon: Keyboard },
  { id: 'core',      label: 'AI 核心',    icon: Bot },
  { id: 'semantic',  label: '语义记忆',   icon: Brain },
  { id: 'runtime',   label: '运行环境',   icon: Activity },
  { id: 'data',      label: '存储与数据', icon: Database },
] as const

export default function Settings() {
  const [section, setSection] = useState<typeof SECTIONS[number]['id']>('appearance')
  const imMuted = useApp((s) => s.imMuted)
  const setMuted = useApp((s) => s.setIMMuted)
  const resetDemo = useApp((s) => s.resetDemo)
  const ws = useApp((s) => s.workspaces)
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealth | null>(null)
  const [runtimeError, setRuntimeError] = useState('')
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [lookupNote, setLookupNote] = useState('')
  const [lookup, setLookup] = useState({ system: '', env: '测试', baseUrl: '', token: '', account: '', password: '' })
  const [pairNote, setPairNote] = useState('')
  const [pairCode, setPairCode] = useState('')
  const [door, setDoor] = useState('')
  const [peerCode, setPeerCode] = useState('')
  const [doorPort, setDoorPort] = useState('')
  const [pairAsk, setPairAsk] = useState('')
  const [peers, setPeers] = useState<Array<{ id: string; name: string; door: string; online: boolean }>>([])

  const diagnoseRuntime = useCallback(async () => {
    setRuntimeLoading(true)
    setRuntimeError('')
    try {
      setRuntimeHealth(await runtimeApi.health())
    } catch (cause) {
      setRuntimeHealth(null)
      setRuntimeError(cause instanceof RuntimeApiError ? cause.message : cause instanceof Error ? cause.message : String(cause))
    } finally {
      setRuntimeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (section === 'runtime' || section === 'data') void diagnoseRuntime()
    if (section === 'data') {
      void runtimeApi.imState().then((state) => {
        const current = state.lookup && typeof state.lookup === 'object' ? state.lookup as Record<string, unknown> : null
        if (!current) return
        setLookup((prev) => ({
          ...prev,
          system: String(current.system || prev.system),
          env: String(current.env || prev.env),
          baseUrl: String(current.baseUrl || prev.baseUrl),
        }))
      }).catch(() => undefined)
    }
    if (section === 'runtime') {
      void runtimeApi.imState().then((state) => {
        if (state.doorPort != null) setDoorPort(String(state.doorPort))
        const ask = state.pairAsk
        setPairAsk(ask && typeof ask === 'object' ? JSON.stringify(ask) : '')
        const rows = Array.isArray(state.peers) ? state.peers as Array<Record<string, unknown>> : []
        setPeers(rows.filter((peer) => !peer.unpaired).map((peer) => ({
          id: String(peer.id || ''),
          name: String(peer.displayName || peer.id || ''),
          door: String(peer.door || ''),
          online: Boolean(peer.online),
        })))
      }).catch(() => undefined)
    }
  }, [diagnoseRuntime, section])

  return (
    <div>
      <PageTitle title="设置" subtitle="账户 / 外观 / AI 核心 / 语义记忆 / 运行环境" />

      <div className="grid grid-cols-1 @3xl:grid-cols-[220px_1fr] gap-6">
        <Card className="!p-2">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  className={clsx(
                    'w-full flex items-center gap-2 px-2 py-2 rounded text-sm',
                    section === s.id ? 'bg-brand-soft text-brand font-medium' : 'hover:bg-surface-2 text-ink-muted',
                  )}
                  onClick={() => setSection(s.id)}
                >
                  <s.icon size={14} />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          {section === 'account' && (
            <Card>
              <div className="text-base font-medium mb-3">账户</div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-brand text-white flex items-center justify-center">我</div>
                <div>
                  <div className="text-sm font-medium">我</div>
                  <div className="text-xs text-ink-muted">@zxz · zxz@example.com</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="card-2 p-3">
                  <div className="text-xs text-ink-muted">工作区</div>
                  <div className="mt-1">{ws.length} 个</div>
                </div>
                <div className="card-2 p-3">
                  <div className="text-xs text-ink-muted">计划</div>
                  <div className="mt-1">Pro <Tag kind="amber">个人版</Tag></div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const raw = window.localStorage.getItem('scene-39-workstation') || '{}'
                    const blob = new Blob([raw], { type: 'application/json' })
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = 'fde-x-shell.json'
                    link.click()
                    URL.revokeObjectURL(link.href)
                  }}
                >导出账户数据</button>
                <button
                  type="button"
                  className="btn text-accent-red"
                  onClick={() => {
                    void runtimeApi.disconnectAi().catch(() => undefined)
                    resetDemo()
                  }}
                >注销账户</button>
              </div>
            </Card>
          )}

          {section === 'appearance' && (
            <>
              <Card>
                <div className="text-base font-medium mb-3">主题模式</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="card-2 p-4 cursor-pointer ring-2 ring-brand">
                    <div className="w-full h-12 rounded bg-white border border-line mb-2" />
                    <div className="text-sm font-medium flex items-center gap-1.5">浅色 <Tag kind="green">当前</Tag></div>
                    <div className="text-xs text-ink-muted mt-0.5">Notion 风格 — 适合白天</div>
                  </div>
                  <div className="card-2 p-4 cursor-pointer opacity-60">
                    <div className="w-full h-12 rounded bg-ink mb-2" />
                    <div className="text-sm font-medium">深色</div>
                    <div className="text-xs text-ink-muted mt-0.5">Linear 风格 — 适合晚间</div>
                  </div>
                  <div className="card-2 p-4 cursor-pointer opacity-60">
                    <div className="w-full h-12 rounded bg-gradient-to-br from-canvas to-surface-2 mb-2" />
                    <div className="text-sm font-medium">跟随系统</div>
                    <div className="text-xs text-ink-muted mt-0.5">随 macOS 自动切换</div>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="text-base font-medium mb-3">字体与密度</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-ink-muted">字体</label>
                    <select className="input mt-1">
                      <option>系统默认</option>
                      <option>Inter</option>
                      <option>SF Pro</option>
                      <option>阿里巴巴普惠体</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-muted">行高</label>
                    <select className="input mt-1">
                      <option>紧</option>
                      <option>默认</option>
                      <option>松</option>
                    </select>
                  </div>
                </div>
              </Card>
            </>
          )}

          {section === 'notifs' && (
            <>
              <Card>
                <div className="text-base font-medium mb-3">通知偏好</div>
                <Toggle label="早间 IM 静音模式" hint="工作日 07:00 - 10:00 自动静音" value={imMuted} onChange={setMuted} />
                <Toggle label="任务截止前 24h 提醒" hint="通过 IM + 顶栏红点" value={true} onChange={() => {}} />
                <Toggle label="MCP 连接异常时推送" hint="MCP 状态变更时通知" value={false} onChange={() => {}} />
                <Toggle label="静音时不接收任何 IM" hint="连任务提醒也会停" value={false} onChange={() => {}} />
              </Card>
              <Card>
                <div className="text-base font-medium mb-3">通知白名单</div>
                <ul className="text-sm space-y-2">
                  <li className="flex items-center justify-between"><span>合同 / 法务提醒</span><Tag kind="red">高优</Tag></li>
                  <li className="flex items-center justify-between"><span>客户经理(阿宁 / 小航)</span><Tag kind="blue">所有人</Tag></li>
                  <li className="flex items-center justify-between"><span>业务数据异常</span><Tag kind="amber">关键</Tag></li>
                </ul>
              </Card>
            </>
          )}

          {section === 'shortcuts' && (
            <Card>
              <div className="text-base font-medium mb-3">快捷键</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {[
                    ['全局搜索',     '⌘ K'],
                    ['新会话',       '⌘ N'],
                    ['新建任务',     '⌘ T'],
                    ['新建事件',     '⌘ E'],
                    ['打开早报',     '⌘ 0'],
                    ['切换 IM 静音', '⌘ ;'],
                    ['上一会话',     '⌘ ↑'],
                    ['下一会话',     '⌘ ↓'],
                  ].map(([label, keys]) => (
                    <tr key={label}>
                      <td className="py-2">{label}</td>
                      <td className="py-2 text-right">
                        {keys.split(' ').map((k, i) => <span key={i} className="kbd ml-1">{k}</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {section === 'core' && <CoreSettings />}

          {section === 'semantic' && <SemanticSettings />}

          {section === 'runtime' && (
            <>
              <Card>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-base font-medium">运行环境诊断</div>
                    <div className="text-xs text-ink-muted mt-1">检查事务存储和三类能力适配入口，不把“发现源码”误报成“已经接通”。</div>
                  </div>
                  <button className="btn" disabled={runtimeLoading} onClick={() => void diagnoseRuntime()}>
                    <RefreshCw size={14} className={runtimeLoading ? 'animate-spin' : ''} /> 重新检查
                  </button>
                </div>
                {runtimeError ? (
                  <div className="border border-red-200 bg-red-50 px-3 py-3 text-sm text-accent-red">
                    本地运行时不可访问：{runtimeError}
                  </div>
                ) : runtimeHealth ? (
                  <div className="space-y-2">
                    <RuntimeRow icon={ShieldCheck} name="事务存储" state={runtimeHealth.persistence.state} detail={`SQLite · ${runtimeHealth.persistence.database.tableCount} 张表 · ${runtimeHealth.persistence.migrations.length} 个迁移`} />
                    {runtimeHealth.adapters.map((adapter) => (
                      <RuntimeRow
                        key={adapter.capability}
                        icon={adapter.capability === 'ai-runtime' ? Bot : adapter.capability === 'im-business-adapter' ? MessageCircleMore : Brain}
                        name={adapter.capability === 'ai-runtime' ? 'AI、文件、工具与自动化' : adapter.capability === 'im-business-adapter' ? 'IM 与业务系统操作' : '语义记忆'}
                        state={adapter.state}
                        detail={`${adapter.version ? `${adapter.version} · ` : ''}${adapter.detail ?? ''}`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-ink-muted">正在读取运行环境状态…</div>
                )}
              </Card>
              <Card>
                <div className="text-base font-medium mb-1">局域网配对</div>
                <div className="text-xs text-ink-muted mb-3">开码 → 对端填码和门牌 → 本机确认。门牌用「本机门牌」这一行，不要填 5174/5175。本机自测：pnpm run dev:peer。</div>
                <div className="text-xs text-ink-muted mb-2">本机门牌：{doorPort ? `127.0.0.1:${doorPort}` : '连接核心后显示'}</div>
                {peers.length > 0 && (
                  <div className="mb-3 text-xs text-ink-muted space-y-1">
                    {peers.map((peer) => (
                      <div key={peer.id}>{peer.online ? '在线' : '离线'} · {peer.name} · {peer.door || peer.id}</div>
                    ))}
                  </div>
                )}
                {pairNote && <div className="mb-2 text-xs text-ink-muted">{pairNote}</div>}
                {pairAsk && (
                  <div className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                    有待确认的配对请求
                    <div className="mt-2 flex gap-2">
                      <button className="btn h-7 px-2 text-xs" onClick={() => void runtimeApi.imPairReject().then(() => { setPairAsk(''); setPairNote('已拒绝') })}>拒绝</button>
                      <button className="btn-primary h-7 px-2 text-xs" onClick={() => void runtimeApi.imPairAccept().then(() => { setPairAsk(''); setPairNote('已配对') })}>确定配对</button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    className="btn"
                    onClick={() => {
                      void runtimeApi.imPairMint().then((data) => {
                        const nested = data.pairCode && typeof data.pairCode === 'object' ? data.pairCode as Record<string, unknown> : null
                        const code = String(data.code ?? nested?.code ?? '')
                        setPairCode(code)
                        setPairNote(code ? `配对码 ${code}` : String(data.hint ?? '已开码'))
                      }).catch((cause) => setPairNote(cause instanceof Error ? cause.message : '开码失败'))
                    }}
                  >
                    开码
                  </button>
                  {pairCode && <span className="input h-8 px-2 font-mono text-sm">{pairCode}</span>}
                </div>
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-2">
                  <label className="text-xs text-ink-muted">对方配对码<input className="input mt-1" value={peerCode} onChange={(event) => setPeerCode(event.target.value)} /></label>
                  <label className="text-xs text-ink-muted">对方门牌<input className="input mt-1 font-mono" value={door} onChange={(event) => setDoor(event.target.value)} /></label>
                </div>
                <button
                  className="btn mt-3"
                  disabled={!peerCode.trim() || !door.trim()}
                  onClick={() => {
                    void runtimeApi.imPairHandshake({ peerCode: peerCode.trim(), door: door.trim() })
                      .then((data) => setPairNote(data.ok === false ? String(data.hint ?? data.error ?? '握手失败') : '已发出握手，等待对端确认'))
                      .catch((cause) => setPairNote(cause instanceof Error ? cause.message : '握手失败'))
                  }}
                >
                  填码配对
                </button>
              </Card>
              <Card>
                <div className="text-base font-medium mb-3">权威边界</div>
                <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-3 text-sm">
                  <AuthorityCard title="工作台事务" authority="SQLite" detail="AI 运行记录、IM、计划、工作流、文件元数据、配置、业务操作与审计。" />
                  <AuthorityCard title="语义知识" authority="语义服务" detail="知识图谱、记忆卡、本体、决策知识与语义索引，不迁入 SQLite。" />
                  <AuthorityCard title="业务现账" authority="源系统" detail="订单、客户等记录的当前状态，必须以业务系统查询结果和回执为准。" />
                </div>
              </Card>
            </>
          )}

          {section === 'data' && (
            <>
              <Card>
                <div className="text-base font-medium mb-1">业务连接器</div>
                <div className="text-xs text-ink-muted mb-3">lan-assist 只存 API Key（Bearer）。账号密码只用来向业务系统换 token，不落库、不回读。</div>
                {lookupNote && <div className="mb-2 text-xs text-ink-muted">{lookupNote}</div>}
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-2">
                  <label className="text-xs text-ink-muted">系统<input className="input mt-1" value={lookup.system} onChange={(event) => setLookup((current) => ({ ...current, system: event.target.value }))} /></label>
                  <label className="text-xs text-ink-muted">环境<input className="input mt-1" value={lookup.env} onChange={(event) => setLookup((current) => ({ ...current, env: event.target.value }))} /></label>
                  <label className="text-xs text-ink-muted @md:col-span-2">地址<input className="input mt-1 font-mono" value={lookup.baseUrl} onChange={(event) => setLookup((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="127.0.0.1:13000" /></label>
                  <label className="text-xs text-ink-muted @md:col-span-2">API Key<input className="input mt-1" type="password" value={lookup.token} onChange={(event) => setLookup((current) => ({ ...current, token: event.target.value }))} /></label>
                  <label className="text-xs text-ink-muted">账号<input className="input mt-1" value={lookup.account} onChange={(event) => setLookup((current) => ({ ...current, account: event.target.value }))} /></label>
                  <label className="text-xs text-ink-muted">密码<input className="input mt-1" type="password" value={lookup.password} onChange={(event) => setLookup((current) => ({ ...current, password: event.target.value }))} /></label>
                </div>
                <button
                  className="btn mt-3"
                  onClick={() => {
                    void runtimeApi.bizLookup({
                      system: lookup.system,
                      env: lookup.env,
                      dialect: 'nocobase',
                      baseUrl: lookup.baseUrl,
                      token: lookup.token,
                      account: lookup.account,
                      password: lookup.password,
                    }).then((data) => {
                      setLookup((current) => ({ ...current, token: '', password: '' }))
                      setLookupNote(data.ok === false ? String(data.hint ?? data.error ?? '保存失败') : '已提交到本机运行时')
                    }).catch((cause) => setLookupNote(cause instanceof Error ? cause.message : '保存失败'))
                  }}
                >
                  保存连接
                </button>
              </Card>
              <Card>
                <div className="text-base font-medium mb-3">存储状态</div>
                <div className="space-y-3 text-sm">
                  <div className="border border-brand/25 bg-brand-soft px-3 py-3 flex items-start gap-3">
                    <Database size={15} className="text-brand mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium">事务型数据正在切换到统一 SQLite</div>
                      <div className="text-xs text-ink-muted mt-1 leading-relaxed">
                        当前运行时已管理 Schema、审计、出站事件与业务操作记录。现有页面中的任务、对话和原型表格仍有一部分保留在浏览器缓存，将按模块逐步迁移，不能把缓存当成最终权威。
                      </div>
                    </div>
                  </div>
                  <div className="border border-line bg-surface-2 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">前端兼容缓存</div>
                        <div className="text-xs text-ink-muted mt-1">键名 <code className="px-1 bg-white border border-line text-[11px]">scene-39-workstation</code>，仅用于尚未迁移页面和离线原型状态。</div>
                      </div>
                      <Tag kind="amber">过渡中</Tag>
                    </div>
                  </div>
                  <div className="border border-line bg-surface-2 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">语义记忆存储</div>
                        <div className="text-xs text-ink-muted mt-1">继续由语义服务管理知识图谱和检索索引，不迁入事务 SQLite。</div>
                      </div>
                      <Tag kind="blue">独立权威</Tag>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button className="btn" disabled><RefreshCw size={14} /> 导出功能待接运行时</button>
                  <button
                    className="btn text-accent-red"
                    onClick={() => {
                      if (confirm('只重置浏览器中的 demo 缓存，不会删除 SQLite 或语义存储。确认?')) resetDemo()
                    }}
                  >
                    <Trash2 size={14} /> 重置前端 demo
                  </button>
                </div>
              </Card>
              <Card>
                <div className="text-base font-medium mb-3">统计</div>
                <div className="grid grid-cols-3 gap-2 text-sm text-center">
                  {[
                    ['任务', '—'],
                    ['日程', '—'],
                    ['文件', '—'],
                    ['会话', '—'],
                    ['IM', '—'],
                    ['记忆', '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="card-2 p-3">
                      <div className="text-xs text-ink-muted">{k}</div>
                      <div className="text-lg font-semibold mt-1 tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RuntimeRow({ icon: Icon, name, state, detail }: { icon: typeof Activity; name: string; state: string; detail: string }) {
  const healthy = state === 'healthy'
  const unavailable = state === 'unavailable'
  return (
    <div className="border border-line px-3 py-3 flex items-start gap-3">
      <div className={clsx('w-8 h-8 border flex items-center justify-center shrink-0', healthy ? 'bg-brand-soft border-brand/25 text-brand' : unavailable ? 'bg-red-50 border-red-200 text-accent-red' : 'bg-amber-50 border-amber-200 text-accent-amber')}>
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-ink-muted mt-0.5 leading-relaxed">{detail}</div>
      </div>
      <Tag kind={healthy ? 'green' : unavailable ? 'red' : 'amber'}>{healthy ? '正常' : unavailable ? '不可用' : '待接通'}</Tag>
    </div>
  )
}

function AuthorityCard({ title, authority, detail }: { title: string; authority: string; detail: string }) {
  return (
    <div className="border border-line bg-surface-2 p-3">
      <div className="text-xs text-ink-muted">{title}</div>
      <div className="text-sm font-medium mt-1">{authority}</div>
      <div className="text-xs text-ink-muted mt-2 leading-relaxed">{detail}</div>
    </div>
  )
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3 py-2.5 border-t border-line first:border-t-0 cursor-pointer">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-ink-muted mt-0.5">{hint}</div>}
      </div>
      <button
        className={clsx('relative w-9 h-5 rounded-full transition-colors shrink-0', value ? 'bg-brand' : 'bg-line')}
        onClick={() => onChange(!value)}
      >
        <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', value ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </label>
  )
}
