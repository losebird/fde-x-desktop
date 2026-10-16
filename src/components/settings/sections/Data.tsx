import { useEffect, useState } from 'react'
import { Database, RefreshCw, Trash2 } from 'lucide-react'
import { Tag } from '@/components/ui'
import { SurfaceButton } from '@/components/surface/Button'
import { SurfaceBanner } from '@/components/surface/Banner'
import { surfaceNote } from '@/components/settings/surface-note'
import { BizHandleSlots } from '@/components/biz/BizHandleSlots'
import { SkillBagPicker } from '@/components/biz/SkillBagPicker'
import { runtimeApi, mergeMcpProjection, type McpServerV2, type SkillBagItem } from '@/lib/runtime-api'
import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import type { FdeAppSkillBind } from '@/lib/app-spec'
import { useApp } from '@/store/app'

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

export function DataSection() {
  const resetDemo = useApp((s) => s.resetDemo)
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

  useEffect(() => {
    void runtimeApi.imState().then((state) => {
      const current = state.lookup && typeof state.lookup === 'object' ? state.lookup as Record<string, unknown> : null
      if (!current) return
      setLookup((prev) => ({
        ...prev,
        system: String(current.system || prev.system),
        env: String(current.env || prev.env),
        baseUrl: String(current.baseUrl || prev.baseUrl),
      }))
    }).catch((cause) => setLookupNote(surfaceNote(cause, '读不到现有连接。')))
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
    }).catch((cause) => setLookupNote(surfaceNote(cause, '读不到业务系统。')))
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
      setMcpBag(mergeMcpProjection(servers.mcp, projected.mcp))
      setSkillBag(skills.items)
    })()
  }, [])

  return (
    <div className="space-y-4">
      <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
        <h3 className="text-kit-title font-medium text-kit-ink">业务连接器</h3>
        <p className="mb-3 mt-1 text-kit-sm text-kit-secondary">连接登记在本机。现查和过账还要当前工作区里有对应的词表。</p>
        {lookupNote ? <div className="mb-3"><SurfaceBanner tone="quiet">{lookupNote}</SurfaceBanner></div> : null}
        <p className="mb-2 text-kit-meta text-kit-secondary">只保存 API Key。账号和密码只用来换 token，不落库、不回读。</p>
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
          <label className="text-kit-sm text-kit-secondary">系统<input className="input mt-1" value={lookup.system} onChange={(event) => setLookup((current) => ({ ...current, system: event.target.value }))} /></label>
          <label className="text-kit-sm text-kit-secondary">环境<input className="input mt-1" value={lookup.env} onChange={(event) => setLookup((current) => ({ ...current, env: event.target.value }))} /></label>
          <label className="text-kit-sm text-kit-secondary @md:col-span-2">地址<input className="input mt-1" value={lookup.baseUrl} onChange={(event) => setLookup((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="127.0.0.1:13000" /></label>
          <label className="text-kit-sm text-kit-secondary @md:col-span-2">API Key<input className="input mt-1" type="password" value={lookup.token} onChange={(event) => setLookup((current) => ({ ...current, token: event.target.value }))} /></label>
          <label className="text-kit-sm text-kit-secondary">账号<input className="input mt-1" value={lookup.account} onChange={(event) => setLookup((current) => ({ ...current, account: event.target.value }))} /></label>
          <label className="text-kit-sm text-kit-secondary">密码<input className="input mt-1" type="password" value={lookup.password} onChange={(event) => setLookup((current) => ({ ...current, password: event.target.value }))} /></label>
        </div>
        <SurfaceButton
          className="mt-3"
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
            }).catch((cause) => setLookupNote(surfaceNote(cause, '保存失败')))
              .finally(() => setSourceSaving(false))
          }}
        >
          保存连接
        </SurfaceButton>
        <div className="mt-3">
          <SkillBagPicker skills={skillBag} value={lookupSkills} onChange={setLookupSkills} />
          <button
            type="button"
            className="btn mt-2 h-7 px-2 text-xs"
            disabled={sourceSaving}
            onClick={() => {
              setSourceSaving(true)
              void runtimeApi.putBizSystems({ lookup: { operate: { skills: lookupSkills } } })
                .then(() => setLookupNote('已保存 lookup 技能'))
                .catch((cause) => setLookupNote(surfaceNote(cause, '保存失败')))
                .finally(() => setSourceSaving(false))
            }}
          >
            保存 lookup 技能
          </button>
        </div>
        <div className="mb-2 mt-6 text-kit font-medium text-kit-ink">MCP 业务系统</div>
        <p className="mb-2 text-kit-sm text-kit-secondary">从已装的服务器里选一台，再点它的三个工具。</p>
        {bizSystems.map((row) => {
          const id = String(row.id)
          const tools = toolsFromRow(row)
          const expanded = editingId === id
          return (
            <div key={id} className="mb-2 space-y-2 rounded-kit border border-kit-line px-3 py-2 text-kit-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-kit-ink">{String(row.name)}</div>
                  <div className="mt-0.5 text-kit-secondary">{String(row.serverName)} · {tools.describe} / {tools.list}</div>
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
                        .catch((cause) => setLookupNote(surfaceNote(cause, '写入词表失败')))
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
                        .catch((cause) => setLookupNote(surfaceNote(cause, '删除失败')))
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
              {expanded && (
                <>
                  <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
                    <label className="text-kit-sm text-kit-secondary">名称<input className="input mt-1" value={editRow.name} onChange={(event) => setEditRow((current) => ({ ...current, name: event.target.value }))} /></label>
                    <label className="text-kit-sm text-kit-secondary">
                      MCP
                      <select className="input mt-1" value={editRow.serverName} onChange={(event) => setEditRow((current) => ({ ...current, serverName: event.target.value, describe: '', list: '', write: '' }))}>
                        <option value="">选择服务器</option>
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
                        setLookupNote('名称、服务器、describe、list 必填')
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
                      }).catch((cause) => setLookupNote(surfaceNote(cause, '保存失败')))
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
        <div className="mt-2 grid grid-cols-1 gap-2 @md:grid-cols-2">
          <label className="text-kit-sm text-kit-secondary">名称<input className="input mt-1" value={draftSystem.name} onChange={(event) => setDraftSystem((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="text-kit-sm text-kit-secondary">
            MCP
            <select className="input mt-1" value={draftSystem.serverName} onChange={(event) => setDraftSystem((current) => ({ ...current, serverName: event.target.value, describe: '', list: '', write: '' }))}>
              <option value="">选择服务器</option>
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
              setLookupNote('名称、服务器、describe、list 必填')
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
            }).catch((cause) => setLookupNote(surfaceNote(cause, '保存失败')))
              .finally(() => setSourceSaving(false))
          }}
        >
          添加 MCP 系统
        </button>
      </section>
      <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
        <h3 className="mb-3 text-kit-title font-medium text-kit-ink">存储状态</h3>
        <div className="space-y-3 text-kit">
          <div className="flex items-start gap-3 rounded-kit border border-kit-brand/25 bg-kit-brand-soft px-3 py-3">
            <Database size={15} className="mt-0.5 shrink-0 text-kit-brand" />
            <div>
              <div className="font-medium text-kit-ink">事务数据在本机 SQLite</div>
              <p className="mt-1 text-kit-sm leading-5 text-kit-secondary">任务、计划、工作流、会话正文、业务操作与审计由运行时写入本机数据库。浏览器里只保留界面习惯，不能当成业务数据的来源。</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-kit bg-kit-muted px-3 py-3">
            <div>
              <div className="font-medium text-kit-ink">浏览器壳层状态</div>
              <p className="mt-1 text-kit-sm leading-5 text-kit-secondary">布局、工作区选择和输入草稿存在这台浏览器里。任务、会话正文和审计以本机数据库为准。</p>
            </div>
            <Tag kind="blue">本机浏览器</Tag>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-kit bg-kit-muted px-3 py-3">
            <div>
              <div className="font-medium text-kit-ink">语义记忆存储</div>
              <p className="mt-1 text-kit-sm text-kit-secondary">知识图谱和检索索引仍由语义服务管理，不迁入事务库。</p>
            </div>
            <Tag kind="blue">独立权威</Tag>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SurfaceButton disabled><RefreshCw size={14} /> 导出还没接到运行时</SurfaceButton>
          <SurfaceButton
            variant="danger"
            onClick={() => {
              if (confirm('只重置浏览器中的 demo 缓存，不会删除 SQLite 或语义存储。确认?')) resetDemo()
            }}
          >
            <Trash2 size={14} /> 重置前端 demo
          </SurfaceButton>
        </div>
      </section>
    </div>
  )
}
