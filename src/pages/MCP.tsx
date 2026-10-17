import { useCallback, useEffect, useRef, useState } from 'react'
import { Plug, Plus } from 'lucide-react'
import { PageTitle } from '@/components/ui'
import { BusinessList } from '@/components/connectors/BusinessList'
import {
  draftInput,
  emptyDraft,
  envText,
  headersText,
  probeCopy,
  validateDraft,
  type DraftErrors,
  type McpDraft,
} from '@/components/connectors/draft'
import { ServerDetail } from '@/components/connectors/ServerDetail'
import { ServerEditor } from '@/components/connectors/ServerEditor'
import { ServerList } from '@/components/connectors/ServerList'
import {
  SurfaceBanner,
  SurfaceButton,
  SurfaceEmpty,
  SurfaceGuide,
  SurfaceSearch,
  SurfaceSegmented,
  SurfaceStats,
  classifySurfaceFailure,
  humanizeSurfaceMessage,
} from '@/components/surface'
import type { SurfacePhase } from '@/components/surface'
import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { lastModuleBag, rememberModuleBag } from '@/lib/module-catalog-cache'
import {
  runtimeApi,
  mergeMcpProjection,
  type McpConnectorCard,
  type McpDiscoverRow,
  type McpRecipe,
  type McpServerV2,
} from '@/lib/runtime-api'

type McpBag = { mcp: McpServerV2[]; connectors: McpConnectorCard[]; resourceTools: string[] }
type Segment = 'servers' | 'business'

function applyBag(bag: McpBag, setMcp: (rows: McpServerV2[]) => void, setConnectors: (rows: McpConnectorCard[]) => void, setResourceTools: (rows: string[]) => void) {
  setMcp(bag.mcp || [])
  setConnectors(bag.connectors || [])
  setResourceTools(bag.resourceTools || [])
}

export default function MCP() {
  const frame = useRef<HTMLDivElement>(null)
  const [shellWidth, setShellWidth] = useState(0)
  const [phase, setPhase] = useState<SurfacePhase>('loading')
  const [failure, setFailure] = useState('')
  const [note, setNote] = useState('')
  const [mcp, setMcp] = useState<McpServerV2[]>([])
  const [connectors, setConnectors] = useState<McpConnectorCard[]>([])
  const [resourceTools, setResourceTools] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const [segment, setSegment] = useState<Segment>('servers')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [healthNotes, setHealthNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState('')
  const [draft, setDraft] = useState<McpDraft>(emptyDraft)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [recipes, setRecipes] = useState<McpRecipe[]>([])
  const [discovered, setDiscovered] = useState<McpDiscoverRow[]>([])
  const [probeNote, setProbeNote] = useState('')
  const [probeOk, setProbeOk] = useState<boolean | null>(null)
  const [saveNote, setSaveNote] = useState('')

  const showBag = useCallback((bag: McpBag) => {
    applyBag(bag, setMcp, setConnectors, setResourceTools)
  }, [])

  const load = useCallback(() => {
    const cached = lastModuleBag<McpBag>('mcp')
    if (cached) {
      showBag(cached)
      setPhase('ready')
    }
    void (async () => {
      try {
        const status = await runtimeApi.aiStatus()
        const data = await runtimeApi.listMcpServers()
        const first: McpBag = {
          mcp: data.mcp || [],
          connectors: data.connectors || [],
          resourceTools: Array.isArray(data.resourceTools) ? data.resourceTools : [],
        }
        rememberModuleBag('mcp', first)
        showBag(first)
        setConnected(Boolean(status.connected))
        setPhase('ready')
        setFailure('')
        const folder = loadCurrentWorkspaceCwd()
        const target = await currentAiTarget()
        const proj = await runtimeApi.listMcpProjection({
          sessionId: target.ok ? target.sessionId : '',
          cwd: target.ok ? target.cwd : (folder.ok ? folder.cwd : ''),
        })
        const servers = lastModuleBag<McpBag>('mcp')
        const merged = mergeMcpProjection(servers?.mcp || first.mcp, proj.mcp || [])
        const next: McpBag = {
          mcp: merged,
          connectors: servers?.connectors || first.connectors,
          resourceTools: Array.isArray(proj.resourceTools) ? proj.resourceTools : [],
        }
        rememberModuleBag('mcp', next)
        showBag(next)
      } catch (cause) {
        const failed = classifySurfaceFailure(cause, '连接器列表没有读出来。')
        if (lastModuleBag<McpBag>('mcp')) {
          setNote(failed.message)
          setPhase('ready')
          return
        }
        setPhase(failed.phase)
        setFailure(failed.message)
      }
    })()
  }, [showBag])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const node = frame.current?.closest('.stage-content') ?? frame.current
    if (!node) return
    const measure = () => setShellWidth(node.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [phase])

  const unsettled = mcp.some((row) => row.status === 'loading' || row.status === 'unloading')
  useEffect(() => {
    if (!unsettled) return
    const timer = setInterval(() => { load() }, 500)
    return () => clearInterval(timer)
  }, [unsettled, load])

  const wide = shellWidth >= 860
  const filtered = mcp.filter((row) => (
    row.serverName.includes(query)
    || (row.command || '').includes(query)
    || (row.url || '').includes(query)
    || row.tools.some((tool) => tool.includes(query))
  ))
  const shownName = wide ? (picked && filtered.some((row) => row.serverName === picked) ? picked : filtered[0]?.serverName ?? null) : picked
  const shown = mcp.find((row) => row.serverName === shownName) || null
  const loadedCount = mcp.filter((row) => row.status === 'loaded').length
  const toolCount = mcp.reduce((sum, row) => sum + row.tools.length, 0)
  const busy = saving || reloading

  const changeDraft = (patch: Partial<McpDraft>) => {
    setErrors({})
    setProbeNote('')
    setProbeOk(null)
    setSaveNote('')
    setDraft((current) => ({ ...current, ...patch }))
  }

  const openEditor = (row?: McpServerV2) => {
    setErrors({})
    setProbeNote('')
    setProbeOk(null)
    setSaveNote('')
    void runtimeApi.listMcpRecipes().then(setRecipes).catch(() => setRecipes([]))
    if (!row) {
      void runtimeApi.listMcpDiscover().then(setDiscovered).catch(() => setDiscovered([]))
      setEditing('')
      setDraft(emptyDraft())
      setEditorOpen(true)
      return
    }
    setEditing(row.serverName)
    setDraft({
      ...emptyDraft(),
      name: row.serverName,
      transport: row.transport,
      command: row.command || '',
      args: Array.isArray(row.args) ? row.args.join('\n') : '',
      env: envText(row.env),
      url: row.url || '',
      headers: headersText(row.headers),
    })
    setEditorOpen(true)
  }

  const applyRecipe = (recipe: McpRecipe) => {
    if (!recipe.available) {
      setSaveNote(recipe.hint || '这个模板在这台机器上还不能用。')
      return
    }
    setErrors({})
    setSaveNote('')
    setDraft({
      ...emptyDraft(),
      name: recipe.serverName,
      transport: recipe.transport,
      command: recipe.command || '',
      args: Array.isArray(recipe.args) ? recipe.args.join('\n') : '',
      recipeId: recipe.id,
      fieldValues: Object.fromEntries((recipe.fields || []).map((field) => [field.key, ''])),
    })
  }

  const applyDiscover = (row: McpDiscoverRow) => {
    if (row.present) return
    setErrors({})
    setDraft({
      ...emptyDraft(),
      name: row.serverName,
      transport: row.transport,
      command: row.command || '',
      args: Array.isArray(row.args) ? row.args.join('\n') : '',
      env: envText(row.env),
      url: row.url || '',
      headers: headersText(row.headers),
    })
  }

  const runEnabled = (serverName: string, enabled: boolean) => {
    setSaving(true)
    void runtimeApi.setMcpServerEnabled(serverName, enabled).then((result) => {
      setNote(humanizeSurfaceMessage(result.note || '', enabled ? '已启用。' : '已停用。'))
      load()
    }).catch((cause) => {
      setNote(classifySurfaceFailure(cause, '没能改启用状态。').message)
    }).finally(() => setSaving(false))
  }

  const runDelete = (serverName: string) => {
    setSaving(true)
    void runtimeApi.removeMcpServer(serverName).then((result) => {
      setPicked((current) => (current === serverName ? null : current))
      setNote(humanizeSurfaceMessage(result.note || '', '已删除。'))
      load()
    }).catch((cause) => {
      setNote(classifySurfaceFailure(cause, '没能删除。').message)
    }).finally(() => setSaving(false))
  }

  const runHealth = (serverName: string) => {
    void runtimeApi.checkMcpHealth(serverName).then((result) => {
      setHealthNotes((current) => ({ ...current, [serverName]: probeCopy(result) }))
    }).catch((cause) => {
      setHealthNotes((current) => ({ ...current, [serverName]: classifySurfaceFailure(cause, '没有连上。').message }))
    })
  }

  const runReload = () => {
    setReloading(true)
    setNote('正在重载核心…')
    void runtimeApi.reloadAi().then(() => {
      setNote('核心已重新接上。')
      load()
    }).catch((cause) => {
      setNote(classifySurfaceFailure(cause, '重载没有完成。').message)
    }).finally(() => setReloading(false))
  }

  const connect = () => {
    setNote('正在连接核心…')
    void runtimeApi.connectAi().then(() => {
      setNote('')
      load()
    }).catch((cause) => {
      setNote(classifySurfaceFailure(cause, '没有连上核心。').message)
    })
  }

  const workspaceCwd = () => {
    const folder = loadCurrentWorkspaceCwd()
    return folder.ok ? folder.cwd : ''
  }

  const runProbe = () => {
    const nextErrors = validateDraft(draft, [], editing)
    const probeErrors = { ...nextErrors }
    delete probeErrors.name
    setErrors(probeErrors)
    if (Object.keys(probeErrors).length) return
    const body = draftInput(draft, editing || draft.name.trim() || 'draft', workspaceCwd())
    setProbeNote('正在测试…')
    setProbeOk(null)
    void runtimeApi.probeMcpDraft(body).then((result) => {
      setProbeOk(result.ok)
      setProbeNote(probeCopy(result))
    }).catch((cause) => {
      setProbeOk(false)
      setProbeNote(classifySurfaceFailure(cause, '没有连上。').message)
    })
  }

  const saveDraft = () => {
    const nextErrors = validateDraft(draft, mcp.map((row) => row.serverName), editing)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const body = draftInput(draft, editing, workspaceCwd())
    setSaving(true)
    setSaveNote('')
    const abort = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(15_000)
      : undefined
    void runtimeApi.addMcpServer(body, abort).then((result) => {
      setEditorOpen(false)
      setEditing('')
      setDraft(emptyDraft())
      setPicked(null)
      setNote(humanizeSurfaceMessage(result.note || '', '已保存。'))
      load()
    }).catch((cause) => {
      const aborted = cause instanceof DOMException && cause.name === 'TimeoutError'
        || (cause instanceof Error && /timed out|aborted/i.test(cause.message))
      setSaveNote(aborted ? '保存超时。' : classifySurfaceFailure(cause, '没有保存。').message)
    }).finally(() => setSaving(false))
  }

  const guideAction = phase === 'coreDown'
    ? <SurfaceButton variant="primary" onClick={connect}>连接核心</SurfaceButton>
    : <SurfaceButton onClick={load}>再试一次</SurfaceButton>

  return (
    <div ref={frame}>
      <PageTitle title="连接器" />
      {phase === 'loading' ? (
        <div aria-busy="true" className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-16 rounded-kit-lg bg-kit-muted" />
            <div className="h-16 rounded-kit-lg bg-kit-muted" />
            <div className="h-16 rounded-kit-lg bg-kit-muted" />
          </div>
          <div className="h-24 rounded-kit-lg bg-kit-muted" />
        </div>
      ) : null}
      {phase === 'unreachable' || phase === 'error' || phase === 'coreDown' ? (
        <SurfaceGuide
          title={phase === 'unreachable' ? '连不上本机核心' : phase === 'coreDown' ? '核心还没接通' : '这一步没有完成'}
          body={failure}
          action={guideAction}
        />
      ) : null}
      {phase === 'ready' ? (
        <div className="space-y-3">
          <SurfaceStats
            items={[
              { label: '在线', value: `${loadedCount} / ${mcp.length}` },
              { label: '可用工具', value: toolCount },
              { label: '业务连接器', value: connectors.length },
            ]}
          />
          {!connected ? (
            <SurfaceGuide
              title="核心还没接通"
              body="已保存的服务器还在。测试连接和热更新要等核心接上。"
              action={<SurfaceButton variant="primary" onClick={connect}>连接核心</SurfaceButton>}
            />
          ) : null}
          {note ? <SurfaceBanner tone="quiet">{note}</SurfaceBanner> : null}
          <div className="flex flex-wrap items-center gap-2">
            <SurfaceSegmented
              label="范围"
              value={segment}
              onChange={setSegment}
              options={[
                { id: 'servers', label: `服务器 ${mcp.length}` },
                { id: 'business', label: `业务连接器 ${connectors.length}` },
              ]}
            />
            <div className="ml-auto flex gap-2">
              <SurfaceButton onClick={runReload} disabled={busy}>{reloading ? '重载中' : '重载核心'}</SurfaceButton>
              {segment === 'servers' ? (
                <SurfaceButton variant="primary" onClick={() => openEditor()}>
                  <Plus size={14} /> 添加
                </SurfaceButton>
              ) : null}
            </div>
          </div>
          {segment === 'business' ? (
            connectors.length ? <BusinessList rows={connectors} /> : (
              <SurfaceEmpty icon={Plug} title="还没有业务连接器" body="到设置里登记之后，这里会列出它们。" />
            )
          ) : (
            <div className={wide ? 'grid grid-cols-[minmax(0,1fr)_minmax(260px,340px)] gap-3' : 'space-y-3'}>
              {(!picked || wide) ? (
                <div className="min-w-0 space-y-2">
                  <SurfaceSearch aria-label="搜索服务器" placeholder="搜索名称、命令或地址" value={query} onChange={(event) => setQuery(event.target.value)} />
                  {filtered.length ? (
                    <ServerList
                      rows={filtered}
                      selected={shownName || ''}
                      busy={busy}
                      onOpen={setPicked}
                      onEnabled={runEnabled}
                    />
                  ) : (
                    <SurfaceEmpty
                      icon={Plug}
                      title={mcp.length ? '没有匹配的服务器' : '还没有服务器'}
                      body={mcp.length ? '换个词再找。' : '添加一台之后，可以在这里测试连接。'}
                      action={mcp.length ? undefined : <SurfaceButton variant="primary" onClick={() => openEditor()}>添加</SurfaceButton>}
                    />
                  )}
                </div>
              ) : null}
              {(picked || wide) ? (
                <ServerDetail
                  row={shown}
                  resourceTools={resourceTools}
                  showBack={!wide}
                  busy={busy}
                  health={shown ? (healthNotes[shown.serverName] || '') : ''}
                  onBack={() => setPicked(null)}
                  onTest={runHealth}
                  onEdit={openEditor}
                  onDelete={runDelete}
                  onEnabled={runEnabled}
                />
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      <ServerEditor
        open={editorOpen}
        editing={editing}
        draft={draft}
        errors={errors}
        recipes={recipes}
        discovered={discovered}
        probeNote={probeNote}
        probeOk={probeOk}
        saveNote={saveNote}
        saving={saving}
        hostConnected={connected}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setEditing('')
        }}
        onChange={changeDraft}
        onRecipe={applyRecipe}
        onDiscover={applyDiscover}
        onTest={runProbe}
        onSave={saveDraft}
      />
    </div>
  )
}
