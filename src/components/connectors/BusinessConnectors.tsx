import { useCallback, useEffect, useState } from 'react'
import { useWhenCoreConnects } from '@/components/settings/core-connection'
import { surfaceNote } from '@/components/settings/surface-note'
import { SurfaceBanner, SurfaceButton, SurfaceField, SurfaceInput, SurfaceSelect } from '@/components/surface'
import { BizHandleSlots } from '@/components/biz/BizHandleSlots'
import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { runtimeApi, type McpServerV2 } from '@/lib/runtime-api'

function toolsFromRow(row: Record<string, unknown>) {
  const tools = row.tools && typeof row.tools === 'object' ? row.tools as { describe?: string; list?: string; write?: string } : {}
  return {
    describe: String(tools.describe || ''),
    list: String(tools.list || ''),
    write: String(tools.write || ''),
  }
}

export function BusinessConnectors({ onChanged }: { onChanged?: () => void }) {
  const [lookupNote, setLookupNote] = useState('')
  const [lookup, setLookup] = useState({ system: '', env: '测试', baseUrl: '', token: '', account: '', password: '' })
  const [mcpBag, setMcpBag] = useState<McpServerV2[]>([])
  const [bizSystems, setBizSystems] = useState<Array<Record<string, unknown>>>([])
  const [draftSystem, setDraftSystem] = useState({ name: '', serverName: '', describe: '', list: '', write: '' })
  const [editingId, setEditingId] = useState('')
  const [editRow, setEditRow] = useState({ name: '', serverName: '', describe: '', list: '', write: '' })
  const [sourceSaving, setSourceSaving] = useState(false)

  const load = useCallback(() => {
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
      }
    }).catch((cause) => setLookupNote(surfaceNote(cause, '读不到业务系统。')))
    void (async () => {
      const cwd = loadCurrentWorkspaceCwd()
      const target = await currentAiTarget().catch(() => ({ ok: false as const, error: '' }))
      const servers = await runtimeApi.listMcpServers({
        sessionId: target.ok ? target.sessionId : '',
        cwd: target.ok ? target.cwd : (cwd.ok ? cwd.cwd : ''),
      }).catch(() => ({ mcp: [] as McpServerV2[] }))
      setMcpBag(servers.mcp)
    })()
  }, [])

  useEffect(() => { load() }, [load])
  useWhenCoreConnects(load, true)

  const done = (message: string) => {
    setLookupNote(message)
    onChanged?.()
  }

  const saveLookup = () => {
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
      done(data.ok === false ? String(data.hint ?? data.error ?? '保存失败') : '已提交到本机运行时')
    }).catch((cause) => setLookupNote(surfaceNote(cause, '保存失败')))
      .finally(() => setSourceSaving(false))
  }

  const addMcpSystem = () => {
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
    }).then((data) => {
      setBizSystems(data.systems)
      setDraftSystem({ name: '', serverName: '', describe: '', list: '', write: '' })
      done('已保存 MCP 业务系统')
    }).catch((cause) => setLookupNote(surfaceNote(cause, '保存失败')))
      .finally(() => setSourceSaving(false))
  }

  return (
    <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
      <h3 className="text-kit-title font-medium text-kit-ink">业务连接器</h3>
      <p className="mt-1 text-kit-sm text-kit-secondary">连接登记在本机。现查和过账还要当前工作区里有对应的词表。</p>
      {lookupNote ? <div className="mt-3"><SurfaceBanner tone="quiet">{lookupNote}</SurfaceBanner></div> : null}
      <p className="mt-3 text-kit-meta text-kit-secondary">只保存 API Key。账号和密码只用来换 token，不落库、不回读。</p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (sourceSaving) return
          saveLookup()
        }}
      >
        <SurfaceField label="系统">
          <SurfaceInput
            value={lookup.system}
            onChange={(event) => setLookup((current) => ({ ...current, system: event.target.value }))}
            placeholder="NocoBase"
            autoComplete="off"
          />
        </SurfaceField>
        <SurfaceField label="环境">
          <SurfaceInput
            value={lookup.env}
            onChange={(event) => setLookup((current) => ({ ...current, env: event.target.value }))}
            placeholder="生产"
            autoComplete="off"
          />
        </SurfaceField>
        <SurfaceField label="地址">
          <SurfaceInput
            value={lookup.baseUrl}
            onChange={(event) => setLookup((current) => ({ ...current, baseUrl: event.target.value }))}
            placeholder="http://127.0.0.1:13000"
            autoComplete="off"
            spellCheck={false}
          />
        </SurfaceField>
        <SurfaceField label="API Key">
          <SurfaceInput
            type="password"
            value={lookup.token}
            onChange={(event) => setLookup((current) => ({ ...current, token: event.target.value }))}
            autoComplete="off"
          />
        </SurfaceField>
        <SurfaceField label="账号">
          <SurfaceInput
            value={lookup.account}
            onChange={(event) => setLookup((current) => ({ ...current, account: event.target.value }))}
            autoComplete="off"
          />
        </SurfaceField>
        <SurfaceField label="密码">
          <SurfaceInput
            type="password"
            value={lookup.password}
            onChange={(event) => setLookup((current) => ({ ...current, password: event.target.value }))}
            autoComplete="new-password"
          />
        </SurfaceField>
        <SurfaceButton type="submit" disabled={sourceSaving}>保存连接</SurfaceButton>
      </form>

      <h3 className="mt-6 text-kit-title font-medium text-kit-ink">MCP 业务系统</h3>
      <p className="mb-3 mt-1 text-kit-sm text-kit-secondary">从已装的服务器里选一台，再点它的三个工具。</p>
      {bizSystems.map((row) => {
        const id = String(row.id)
        const tools = toolsFromRow(row)
        const expanded = editingId === id
        return (
          <div key={id} className="mb-2 space-y-2 rounded-kit border border-kit-line px-3 py-3">
            <div className="min-w-0">
              <div className="text-kit font-medium text-kit-ink">{String(row.name)}</div>
              <div className="mt-0.5 text-kit-sm text-kit-secondary">{String(row.serverName)} · {tools.describe} / {tools.list}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <SurfaceButton
                size="sm"
                onClick={() => {
                  if (expanded) {
                    setEditingId('')
                    return
                  }
                  setEditingId(id)
                  setEditRow({ name: String(row.name), serverName: String(row.serverName), ...tools })
                }}
              >
                {expanded ? '收起' : '改'}
              </SurfaceButton>
              <SurfaceButton
                size="sm"
                disabled={sourceSaving}
                onClick={() => {
                  const cwd = loadCurrentWorkspaceCwd()
                  if (!cwd.ok) {
                    setLookupNote('没有当前工作区')
                    return
                  }
                  setSourceSaving(true)
                  void runtimeApi.generateBizVocab({ systemId: id, cwd: cwd.cwd })
                    .then(() => done('已写入本工作区词表'))
                    .catch((cause) => setLookupNote(surfaceNote(cause, '写入词表失败')))
                    .finally(() => setSourceSaving(false))
                }}
              >
                写入本工作区词表
              </SurfaceButton>
              <SurfaceButton
                size="sm"
                variant="danger"
                onClick={() => {
                  void runtimeApi.deleteBizSystem(id).then((data) => {
                    setBizSystems(data.systems)
                    onChanged?.()
                  }).catch((cause) => setLookupNote(surfaceNote(cause, '删除失败')))
                }}
              >
                删除
              </SurfaceButton>
            </div>
            {expanded ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
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
                  }).then((data) => {
                    setBizSystems(data.systems)
                    done('已保存')
                  }).catch((cause) => setLookupNote(surfaceNote(cause, '保存失败')))
                    .finally(() => setSourceSaving(false))
                }}
              >
                <SurfaceField label="名称">
                  <SurfaceInput value={editRow.name} onChange={(event) => setEditRow((current) => ({ ...current, name: event.target.value }))} />
                </SurfaceField>
                <SurfaceField label="MCP" hint={mcpBag.length ? undefined : '还没有服务器。先到「服务器」页添加。'}>
                  <SurfaceSelect value={editRow.serverName} onChange={(event) => setEditRow((current) => ({ ...current, serverName: event.target.value, describe: '', list: '', write: '' }))}>
                    <option value="">选择服务器</option>
                    {mcpBag.map((server) => (
                      <option key={server.serverName} value={server.serverName}>{server.serverName}</option>
                    ))}
                  </SurfaceSelect>
                </SurfaceField>
                {editRow.serverName ? (
                  <BizHandleSlots
                    serverName={editRow.serverName}
                    tools={mcpBag.find((item) => item.serverName === editRow.serverName)?.tools || []}
                    describe={editRow.describe}
                    list={editRow.list}
                    write={editRow.write}
                    onChange={(slot, tool) => setEditRow((current) => ({ ...current, [slot]: tool }))}
                  />
                ) : null}
                <SurfaceButton type="submit" disabled={sourceSaving}>保存</SurfaceButton>
              </form>
            ) : null}
          </div>
        )
      })}
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (sourceSaving) return
          addMcpSystem()
        }}
      >
        <SurfaceField label="名称">
          <SurfaceInput value={draftSystem.name} onChange={(event) => setDraftSystem((current) => ({ ...current, name: event.target.value }))} />
        </SurfaceField>
        <SurfaceField label="MCP" hint={mcpBag.length ? undefined : '还没有服务器。先到「服务器」页添加。'}>
          <SurfaceSelect value={draftSystem.serverName} onChange={(event) => setDraftSystem((current) => ({ ...current, serverName: event.target.value, describe: '', list: '', write: '' }))}>
            <option value="">选择服务器</option>
            {mcpBag.map((server) => (
              <option key={server.serverName} value={server.serverName}>{server.serverName}</option>
            ))}
          </SurfaceSelect>
        </SurfaceField>
        {draftSystem.serverName ? (
          <BizHandleSlots
            serverName={draftSystem.serverName}
            tools={mcpBag.find((row) => row.serverName === draftSystem.serverName)?.tools || []}
            describe={draftSystem.describe}
            list={draftSystem.list}
            write={draftSystem.write}
            onChange={(slot, tool) => setDraftSystem((current) => ({ ...current, [slot]: tool }))}
          />
        ) : null}
        <SurfaceButton type="submit" disabled={sourceSaving}>添加 MCP 系统</SurfaceButton>
      </form>
    </section>
  )
}
