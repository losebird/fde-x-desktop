// 设置:账户 / 外观 / 通知 / 快捷键 / 数据管理
import { useCallback, useEffect, useState } from 'react'
import { User, Palette, Bell, Keyboard, Database, Trash2, RefreshCw, Activity, Brain, Bot, MessageCircleMore, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { PageTitle, Card, Tag } from '@/components/ui'
import { RuntimeApiError, runtimeApi, type McpServerV2, type RuntimeHealth, type SkillBagItem } from '@/lib/runtime-api'
import { CoreSettings } from '@/components/settings/CoreSettings'
import { SemanticSettings } from '@/components/settings/SemanticSettings'
import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { BizHandleSlots } from '@/components/biz/BizHandleSlots'
import { SkillBagPicker } from '@/components/biz/SkillBagPicker'
import type { FdeAppSkillBind } from '@/lib/app-spec'

function skillsFromOperate(raw: unknown): FdeAppSkillBind[] {
  const operate = raw && typeof raw === 'object' ? (raw as { operate?: { skills?: FdeAppSkillBind[] } }).operate : null
  return Array.isArray(operate?.skills) ? operate.skills : []
}

function toolsFromRow(row: Record<string, unknown>) {
  const tools = row.tools && typeof row.tools === 'object' ? row.tools as { describe?: string; list?: string; write?: string } : {}
  return {
    describe: String(tools.describe || ''),
    list: String(tools.list || ''),
    write: String(tools.write || ''),
  }
}

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
  const [mcpBag, setMcpBag] = useState<McpServerV2[]>([])
  const [skillBag, setSkillBag] = useState<SkillBagItem[]>([])
  const [bizSystems, setBizSystems] = useState<Array<Record<string, unknown>>>([])
  const [draftSystem, setDraftSystem] = useState({ name: '', serverName: '', describe: '', list: '', write: '' })
  const [draftSkills, setDraftSkills] = useState<FdeAppSkillBind[]>([])
  const [lookupSkills, setLookupSkills] = useState<FdeAppSkillBind[]>([])
  const [editingId, setEditingId] = useState('')
  const [editRow, setEditRow] = useState({ name: '', serverName: '', describe: '', list: '', write: '' })
  const [editSkills, setEditSkills] = useState<FdeAppSkillBind[]>([])
  const [sourceSaving, setSourceSaving] = useState(false)

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
    const onOpen = (event: Event) => {
      const sectionId = String((event as CustomEvent<{ section?: string }>).detail?.section || '')
      if (SECTIONS.some((item) => item.id === sectionId)) setSection(sectionId as typeof SECTIONS[number]['id'])
    }
    window.addEventListener('fde-x-settings-open', onOpen)
    return () => window.removeEventListener('fde-x-settings-open', onOpen)
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
      void runtimeApi.getBizSystems().then((data) => {
        setBizSystems(data.systems)
        const lookupFields = data.lookup && typeof data.lookup === 'object' ? data.lookup : null
        if (lookupFields) {
          setLookup((prev) => ({
            ...prev,
            system: String(lookupFields.system || prev.system),
            env: String(lookupFields.env || prev.env),
            baseUrl: String(lookupFields.baseUrl || prev.baseUrl),
          }))
          setLookupSkills(skillsFromOperate(lookupFields))
        }
      }).catch(() => undefined)
      void (async () => {
        const cwd = loadCurrentWorkspaceCwd()
        const target = await currentAiTarget().catch(() => ({ ok: false as const, error: '' }))
        const [servers, projected, skills] = await Promise.all([
          runtimeApi.listMcpServers().catch(() => ({ mcp: [] as McpServerV2[] })),
          cwd.ok
            ? runtimeApi.listMcpProjection({ cwd: cwd.cwd, sessionId: target.ok ? target.sessionId : undefined }).catch(() => ({ mcp: [] as McpServerV2[] }))
            : Promise.resolve({ mcp: [] as McpServerV2[] }),
          runtimeApi.listAiSkills(target.ok ? target.sessionId : undefined).catch(() => ({ items: [] as SkillBagItem[] })),
        ])
        const byName = new Map<string, McpServerV2>()
        for (const row of [...servers.mcp, ...projected.mcp]) {
          const prev = byName.get(row.serverName)
          if (!prev) {
            byName.set(row.serverName, row)
            continue
          }
          const tools = [...new Set([...(prev.tools || []), ...(row.tools || [])])]
          byName.set(row.serverName, { ...prev, ...row, tools })
        }
        setMcpBag([...byName.values()])
        setSkillBag(skills.items)
      })()
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
                <div className="text-xs text-ink-muted mb-3">lookup 与 MCP 业务系统登记在本机 profile。现查/过账还要本工作区记忆词表里有型。</div>
                {lookupNote && <div className="mb-2 text-xs text-ink-muted">{lookupNote}</div>}
                <div className="text-xs text-ink-muted mb-2">lan-assist 只存 API Key（Bearer）。账号密码只用来向业务系统换 token，不落库、不回读。</div>
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
                  disabled={sourceSaving}
                  onClick={() => {
                    setSourceSaving(true)
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
                      .finally(() => setSourceSaving(false))
                  }}
                >
                  保存连接
                </button>
                <div className="mt-3">
                  <SkillBagPicker skills={skillBag} value={lookupSkills} onChange={setLookupSkills} />
                  <button
                    type="button"
                    className="btn h-7 px-2 mt-2 text-xs"
                    disabled={sourceSaving}
                    onClick={() => {
                      setSourceSaving(true)
                      void runtimeApi.putBizSystems({ lookup: { operate: { skills: lookupSkills } } })
                        .then(() => setLookupNote('已保存 lookup Skills'))
                        .catch((cause) => setLookupNote(cause instanceof Error ? cause.message : '保存失败'))
                        .finally(() => setSourceSaving(false))
                    }}
                  >
                    保存 lookup Skills
                  </button>
                </div>
                <div className="mt-6 text-sm font-medium">MCP 业务系统</div>
                <div className="text-xs text-ink-muted mb-2">从已装 MCP 选一个 server，再点该 server 的三个工具。</div>
                {bizSystems.map((row) => {
                  const id = String(row.id)
                  const tools = toolsFromRow(row)
                  const expanded = editingId === id
                  return (
                    <div key={id} className="border border-line rounded-lg px-3 py-2 mb-2 text-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-ink">{String(row.name)}</div>
                          <div className="text-ink-muted mt-0.5">{String(row.serverName)} · {tools.describe} / {tools.list}</div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn h-7 px-2"
                            onClick={() => {
                              if (expanded) {
                                setEditingId('')
                                return
                              }
                              setEditingId(id)
                              setEditRow({ name: String(row.name), serverName: String(row.serverName), ...tools })
                              setEditSkills(skillsFromOperate(row))
                            }}
                          >
                            {expanded ? '收起' : '改'}
                          </button>
                          <button
                            type="button"
                            className="btn h-7 px-2"
                            disabled={sourceSaving}
                            onClick={() => {
                              const cwd = loadCurrentWorkspaceCwd()
                              if (!cwd.ok) {
                                setLookupNote('没有当前工作区')
                                return
                              }
                              setSourceSaving(true)
                              void runtimeApi.generateBizVocab({ systemId: id, cwd: cwd.cwd })
                                .then(() => setLookupNote('已写入本工作区词表'))
                                .catch((cause) => setLookupNote(cause instanceof Error ? cause.message : '写入词表失败'))
                                .finally(() => setSourceSaving(false))
                            }}
                          >
                            写入本工作区词表
                          </button>
                          <button
                            type="button"
                            className="btn h-7 px-2"
                            onClick={() => {
                              void runtimeApi.deleteBizSystem(id).then((data) => setBizSystems(data.systems))
                                .catch((cause) => setLookupNote(cause instanceof Error ? cause.message : '删除失败'))
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <>
                          <div className="grid grid-cols-1 @md:grid-cols-2 gap-2">
                            <label className="text-xs text-ink-muted">名称<input className="input mt-1" value={editRow.name} onChange={(event) => setEditRow((current) => ({ ...current, name: event.target.value }))} /></label>
                            <label className="text-xs text-ink-muted">
                              MCP
                              <select className="input mt-1" value={editRow.serverName} onChange={(event) => setEditRow((current) => ({ ...current, serverName: event.target.value, describe: '', list: '', write: '' }))}>
                                <option value="">选择 server</option>
                                {mcpBag.map((server) => (
                                  <option key={server.serverName} value={server.serverName}>{server.serverName}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          {editRow.serverName && (
                            <BizHandleSlots
                              serverName={editRow.serverName}
                              tools={mcpBag.find((item) => item.serverName === editRow.serverName)?.tools || []}
                              describe={editRow.describe}
                              list={editRow.list}
                              write={editRow.write}
                              onChange={(slot, tool) => setEditRow((current) => ({ ...current, [slot]: tool }))}
                            />
                          )}
                          <SkillBagPicker skills={skillBag} value={editSkills} onChange={setEditSkills} />
                          <button
                            type="button"
                            className="btn h-7 px-2"
                            disabled={sourceSaving}
                            onClick={() => {
                              if (!editRow.name || !editRow.serverName || !editRow.describe || !editRow.list) {
                                setLookupNote('名称、server、describe、list 必填')
                                return
                              }
                              setSourceSaving(true)
                              void runtimeApi.putBizSystems({
                                id,
                                name: editRow.name,
                                serverName: editRow.serverName,
                                tools: {
                                  describe: editRow.describe,
                                  list: editRow.list,
                                  ...(editRow.write ? { write: editRow.write } : {}),
                                },
                                operate: { skills: editSkills },
                              }).then((data) => {
                                setBizSystems(data.systems)
                                setLookupNote('已保存')
                              }).catch((cause) => setLookupNote(cause instanceof Error ? cause.message : '保存失败'))
                                .finally(() => setSourceSaving(false))
                            }}
                          >
                            保存
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-2 mt-2">
                  <label className="text-xs text-ink-muted">名称<input className="input mt-1" value={draftSystem.name} onChange={(event) => setDraftSystem((current) => ({ ...current, name: event.target.value }))} /></label>
                  <label className="text-xs text-ink-muted">
                    MCP
                    <select className="input mt-1" value={draftSystem.serverName} onChange={(event) => setDraftSystem((current) => ({ ...current, serverName: event.target.value, describe: '', list: '', write: '' }))}>
                      <option value="">选择 server</option>
                      {mcpBag.map((server) => (
                        <option key={server.serverName} value={server.serverName}>{server.serverName}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {draftSystem.serverName && (
                  <div className="mt-2">
                    <BizHandleSlots
                      serverName={draftSystem.serverName}
                      tools={mcpBag.find((row) => row.serverName === draftSystem.serverName)?.tools || []}
                      describe={draftSystem.describe}
                      list={draftSystem.list}
                      write={draftSystem.write}
                      onChange={(slot, tool) => setDraftSystem((current) => ({ ...current, [slot]: tool }))}
                    />
                  </div>
                )}
                <div className="mt-2">
                  <SkillBagPicker skills={skillBag} value={draftSkills} onChange={setDraftSkills} />
                </div>
                <button
                  className="btn mt-3"
                  disabled={sourceSaving}
                  onClick={() => {
                    if (!draftSystem.name || !draftSystem.serverName || !draftSystem.describe || !draftSystem.list) {
                      setLookupNote('名称、server、describe、list 必填')
                      return
                    }
                    setSourceSaving(true)
                    void runtimeApi.putBizSystems({
                      name: draftSystem.name,
                      serverName: draftSystem.serverName,
                      tools: {
                        describe: draftSystem.describe,
                        list: draftSystem.list,
                        ...(draftSystem.write ? { write: draftSystem.write } : {}),
                      },
                      ...(draftSkills.length ? { operate: { skills: draftSkills } } : {}),
                    }).then((data) => {
                      setBizSystems(data.systems)
                      setDraftSystem({ name: '', serverName: '', describe: '', list: '', write: '' })
                      setDraftSkills([])
                      setLookupNote('已保存 MCP 业务系统')
                    }).catch((cause) => setLookupNote(cause instanceof Error ? cause.message : '保存失败'))
                      .finally(() => setSourceSaving(false))
                  }}
                >
                  添加 MCP 系统
                </button>
              </Card>
              <Card>
                <div className="text-base font-medium mb-3">存储状态</div>
                <div className="space-y-3 text-sm">
                  <div className="border border-brand/25 bg-brand-soft px-3 py-3 flex items-start gap-3">
                    <Database size={15} className="text-brand mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium">事务数据在本机 SQLite</div>
                      <div className="text-xs text-ink-muted mt-1 leading-relaxed">
                        任务、计划、工作流、AI/IM 会话正文、业务操作与审计由运行时写入本机数据库。浏览器里只保留界面习惯（见下），不能当成业务数据的权威来源。
                      </div>
                    </div>
                  </div>
                  <div className="border border-line bg-surface-2 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">浏览器壳层状态</div>
                        <div className="text-xs text-ink-muted mt-1 leading-relaxed">
                          本机界面习惯存在这台浏览器里（布局、工作区选择、输入草稿等）。任务、会话正文与业务审计不在这里，以本机 SQLite / 运行时为准。
                        </div>
                      </div>
                      <Tag kind="blue">本机浏览器</Tag>
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
