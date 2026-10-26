import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { PageTitle } from '@/components/ui'
import { InstallDialog } from '@/components/skills/InstallDialog'
import { SkillDetail } from '@/components/skills/SkillDetail'
import { SkillList } from '@/components/skills/SkillList'
import {
  SurfaceBanner,
  SurfaceButton,
  SurfaceEmpty,
  SurfaceGuide,
  SurfaceSearch,
  SurfaceSegmented,
  classifySurfaceFailure,
  humanizeSurfaceMessage,
  SURFACE_CORE_DOWN,
} from '@/components/surface'
import type { SurfacePhase } from '@/components/surface'
import { openFilesAtPath } from '@/lib/app-platform'
import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { lastModuleBag, rememberModuleBag } from '@/lib/module-catalog-cache'
import { runtimeApi, type SkillBagItem } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

type BundleFile = { rel: string; type: string }
type SkillRoot = { path: string; source: string }
type FilterId = 'all' | 'enabled' | 'disabled'

function workspaceCwd() {
  const folder = loadCurrentWorkspaceCwd()
  return folder.ok ? folder.cwd : ''
}

function canManage(row: SkillBagItem | null) {
  return Boolean(row && row.origin === 'catalog' && row.path)
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type SkillIntent = { generation: number; enabled: boolean }
type SkillWrite = { ticket: number; enabled: boolean }

function overlayIntents(rows: SkillBagItem[], intents: Map<string, SkillIntent>, settle: boolean) {
  return rows.map((row) => {
    if (!row.path) return row
    const intent = intents.get(row.path)
    if (!intent) return row
    if (settle && row.modelInvocable === intent.enabled) {
      intents.delete(row.path)
      return row
    }
    return { ...row, modelInvocable: intent.enabled }
  })
}

export default function Skills() {
  const frame = useRef<HTMLDivElement>(null)
  const workspaceId = useApp((s) => s.activeWorkspaceId)
  const [shellWidth, setShellWidth] = useState(0)
  const [phase, setPhase] = useState<SurfacePhase>('loading')
  const [failure, setFailure] = useState('')
  const [note, setNote] = useState('')
  const [skills, setSkills] = useState<SkillBagItem[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<BundleFile[]>([])
  const [editor, setEditor] = useState<{ rel: string; text: string } | null>(null)
  const [newRel, setNewRel] = useState('')
  const [installOpen, setInstallOpen] = useState(false)
  const [roots, setRoots] = useState<SkillRoot[]>([])
  const [source, setSource] = useState('')
  const [root, setRoot] = useState('')
  const [installError, setInstallError] = useState('')
  const [sessionId, setSessionId] = useState('')
  const intents = useRef(new Map<string, SkillIntent>())
  const writes = useRef(new Map<string, SkillWrite>())
  const draining = useRef(new Set<string>())
  const ticketRef = useRef(0)
  const listEpoch = useRef(0)

  const applyListed = useCallback((rows: SkillBagItem[]) => {
    rememberModuleBag('skills', rows)
    const next = overlayIntents(rows, intents.current, true)
    setSkills(next)
    return next
  }, [])

  const load = useCallback(() => {
    const epoch = listEpoch.current
    const cached = lastModuleBag<SkillBagItem[]>('skills')
    if (cached?.length) {
      setSkills(overlayIntents(cached, intents.current, false))
      setPhase('ready')
    }
    void (async () => {
      try {
        const status = await runtimeApi.aiStatus()
        if (epoch !== listEpoch.current) return
        if (!status.connected) {
          if (!cached?.length) {
            setPhase('coreDown')
            setFailure(SURFACE_CORE_DOWN)
            return
          }
          setNote(SURFACE_CORE_DOWN)
          setPhase('ready')
          return
        }
        const target = await currentAiTarget()
        if (epoch !== listEpoch.current) return
        const sid = target.ok ? target.sessionId : ''
        setSessionId(sid)
        const mapped = (await runtimeApi.listAiSkills(sid || undefined)).items
        if (epoch !== listEpoch.current) return
        rememberModuleBag('skills', mapped)
        const next = overlayIntents(mapped, intents.current, true)
        setSkills(next)
        setPicked((current) => (current && next.some((row) => row.id === current) ? current : null))
        setNote('')
        setFailure('')
        setPhase(next.length ? 'ready' : 'empty')
      } catch (cause) {
        if (epoch !== listEpoch.current) return
        const failed = classifySurfaceFailure(cause, '技能列表没有读出来。')
        if (lastModuleBag<SkillBagItem[]>('skills')?.length) {
          setNote(failed.message)
          setPhase('ready')
          return
        }
        setPhase(failed.phase)
        setFailure(failed.message)
      }
    })()
  }, [])

  useEffect(() => { load() }, [load, workspaceId])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  useEffect(() => {
    const node = frame.current?.closest('.stage-content') ?? frame.current
    if (!node) return
    const measure = () => setShellWidth(node.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [phase])

  const wide = shellWidth >= 860
  const canFilter = skills.some((row) => typeof row.modelInvocable === 'boolean')
  const enabledCount = skills.filter((row) => row.modelInvocable === true).length
  const disabledCount = skills.filter((row) => row.modelInvocable === false).length
  const filtered = skills.filter((row) => {
    if (canFilter && filter === 'enabled' && row.modelInvocable !== true) return false
    if (canFilter && filter === 'disabled' && row.modelInvocable !== false) return false
    if (query && !row.name.includes(query) && !(row.description || '').includes(query)) return false
    return true
  })
  const shown = wide
    ? (filtered.find((row) => row.id === picked) || filtered[0] || null)
    : (filtered.find((row) => row.id === picked) || null)

  useEffect(() => {
    if (!canManage(shown) || !shown?.path) {
      setFiles([])
      setEditor(null)
      return
    }
    const path = shown.path
    void runtimeApi.listSkillBundleFiles(path, workspaceCwd(), sessionId).then((data) => {
      setFiles(Array.isArray(data.files) ? data.files : [])
    }).catch(() => setFiles([]))
  }, [shown, sessionId, workspaceId])

  const readSkills = useCallback(async () => {
    const target = await currentAiTarget()
    const sid = target.ok ? target.sessionId : ''
    setSessionId(sid)
    return (await runtimeApi.listAiSkills(sid || undefined)).items
  }, [])

  const readUntil = useCallback(async (ready: (rows: SkillBagItem[]) => boolean) => {
    const deadline = Date.now() + 2500
    let rows = await readSkills()
    while (!ready(rows) && Date.now() < deadline) {
      await pause(200)
      rows = await readSkills()
    }
    return rows
  }, [readSkills])

  const publish = (rows: SkillBagItem[], message: string) => {
    const next = applyListed(rows)
    setPicked((current) => (current && next.some((row) => row.id === current) ? current : null))
    setNote(message)
    setFailure('')
    setPhase(next.length ? 'ready' : 'empty')
  }

  const flushToggle = (path: string) => {
    if (draining.current.has(path)) return
    draining.current.add(path)
    void (async () => {
      try {
        while (writes.current.has(path)) {
          const job = writes.current.get(path)
          if (!job) break
          writes.current.delete(path)
          try {
            const target = await currentAiTarget()
            const sid = target.ok ? target.sessionId : ''
            if (sid) setSessionId(sid)
            const saved = await runtimeApi.setSkillModelInvocable({
              path,
              modelInvocable: job.enabled,
              cwd: workspaceCwd(),
              sessionId: sid,
            })
            if (intents.current.get(path)?.generation !== job.ticket) continue
            intents.current.set(path, { generation: job.ticket, enabled: saved.modelInvocable })
            const epoch = listEpoch.current
            const listed = await runtimeApi.listAiSkills(sid || undefined).then((data) => data.items, () => null)
            if (intents.current.get(path)?.generation !== job.ticket || epoch !== listEpoch.current) continue
            if (listed) applyListed(listed)
            else {
              setSkills((current) => current.map((item) => (
                item.path === path ? { ...item, modelInvocable: saved.modelInvocable } : item
              )))
            }
            const after = intents.current.get(path)
            if (after && after.generation !== job.ticket) continue
            setNote(saved.modelInvocable ? '已启用。' : '已停用。')
            setFailure('')
          } catch (cause) {
            if (intents.current.get(path)?.generation !== job.ticket || writes.current.has(path)) continue
            intents.current.delete(path)
            setNote(classifySurfaceFailure(cause, '没能改启用状态。').message)
            const target = await currentAiTarget().catch(() => null)
            const sid = target && target.ok ? target.sessionId : ''
            const listed = await runtimeApi.listAiSkills(sid || undefined).then((data) => data.items, () => null)
            if (!listed || intents.current.has(path) || writes.current.has(path)) continue
            applyListed(listed)
          }
        }
      } finally {
        draining.current.delete(path)
        if (writes.current.has(path)) flushToggle(path)
        else if (writes.current.size === 0) setBusy(false)
      }
    })()
  }

  const runToggle = (row: SkillBagItem, enabled: boolean) => {
    if (!row.path) return
    const path = row.path
    const ticket = ++ticketRef.current
    listEpoch.current = ticket
    intents.current.set(path, { generation: ticket, enabled })
    writes.current.set(path, { ticket, enabled })
    setSkills((current) => current.map((item) => (
      item.path === path ? { ...item, modelInvocable: enabled } : item
    )))
    setBusy(true)
    flushToggle(path)
  }

  const openInstall = () => {
    setInstallError('')
    setInstallOpen(true)
    void runtimeApi.listSkillRoots(workspaceCwd()).then((data) => {
      const next = Array.isArray(data.roots) ? data.roots : []
      setRoots(next)
      setRoot((current) => current || (next[0] ? next[0].path : ''))
    }).catch((cause) => {
      setRoots([])
      setInstallError(classifySurfaceFailure(cause, '没有读到安装位置。').message)
    })
  }

  const saveInstall = () => {
    if (!source.trim()) {
      setInstallError('要填写来源目录。')
      return
    }
    if (!root) {
      setInstallError('要选择安装位置。')
      return
    }
    setBusy(true)
    setInstallError('')
    void runtimeApi.installSkillBundle({ source: source.trim(), root, cwd: workspaceCwd() }).then(async (installed) => {
      setInstallOpen(false)
      setSource('')
      const rows = await readUntil((items) => items.some((item) => item.path === installed.path || item.id === installed.name))
      publish(rows, '已安装。')
      setPicked(installed.name)
    }).catch((cause) => {
      setInstallError(classifySurfaceFailure(cause, '没有安装成功。').message)
    }).finally(() => setBusy(false))
  }

  const runUninstall = (row: SkillBagItem) => {
    if (!row.path) return
    setBusy(true)
    const path = row.path
    void runtimeApi.uninstallSkillBundle(path, workspaceCwd(), sessionId).then(async () => {
      const rows = await readUntil((items) => !items.some((item) => item.path === path))
      setPicked(null)
      publish(rows, '已卸载。')
    }).catch((cause) => {
      setNote(classifySurfaceFailure(cause, '没能卸载。').message)
    }).finally(() => setBusy(false))
  }

  const openBundleFile = (rel: string, type: string) => {
    if (type === 'dir' || !shown?.path) return
    const abs = shown.bundleRoot ? `${shown.bundleRoot.replace(/\/$/, '')}/${rel}` : ''
    if (abs && openFilesAtPath(abs)) return
    void runtimeApi.readSkillBundleFile(shown.path, rel, workspaceCwd(), sessionId).then((data) => {
      setEditor({ rel: data.rel, text: data.text })
    }).catch((cause) => {
      setNote(classifySurfaceFailure(cause, '没有读到文件。').message)
    })
  }

  const saveEditor = () => {
    if (!editor || !shown?.path) return
    setBusy(true)
    void runtimeApi.writeSkillBundleFile({ path: shown.path, rel: editor.rel, text: editor.text, cwd: workspaceCwd(), sessionId }).then(() => {
      setNote('文件已保存。')
      load()
    }).catch((cause) => {
      setNote(classifySurfaceFailure(cause, '没有写进文件。').message)
    }).finally(() => setBusy(false))
  }

  const addBundleFile = () => {
    const rel = newRel.trim()
    if (!rel || !shown?.path) return
    const path = shown.path
    setBusy(true)
    void runtimeApi.writeSkillBundleFile({ path, rel, text: '', cwd: workspaceCwd(), sessionId }).then(() => {
      setNewRel('')
      return runtimeApi.listSkillBundleFiles(path, workspaceCwd(), sessionId)
    }).then((data) => {
      if (data) setFiles(Array.isArray(data.files) ? data.files : [])
    }).catch((cause) => {
      setNote(classifySurfaceFailure(cause, '没有建成新文件。').message)
    }).finally(() => setBusy(false))
  }

  const removeBundleFile = (rel: string) => {
    if (!shown?.path) return
    const path = shown.path
    setBusy(true)
    void runtimeApi.removeSkillBundleFile(path, rel, workspaceCwd(), sessionId).then(() => {
      if (editor?.rel === rel) setEditor(null)
      return runtimeApi.listSkillBundleFiles(path, workspaceCwd(), sessionId)
    }).then((data) => {
      if (data) setFiles(Array.isArray(data.files) ? data.files : [])
    }).catch((cause) => {
      setNote(classifySurfaceFailure(cause, '没能删除文件。').message)
    }).finally(() => setBusy(false))
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

  const guide = phase === 'coreDown'
    ? <SurfaceButton variant="primary" onClick={connect}>连接核心</SurfaceButton>
    : <SurfaceButton onClick={load}>再试一次</SurfaceButton>

  return (
    <div ref={frame}>
      <PageTitle title="技能" />
      {phase === 'loading' ? (
        <div aria-busy="true" className="space-y-2">
          <div className="h-8 rounded-kit bg-kit-muted" />
          <div className="h-16 rounded-kit-lg bg-kit-muted" />
          <div className="h-16 rounded-kit-lg bg-kit-muted" />
        </div>
      ) : null}
      {phase === 'unreachable' || phase === 'error' || phase === 'coreDown' ? (
        <SurfaceGuide
          title={phase === 'unreachable' ? '连不上本机核心' : phase === 'coreDown' ? '核心还没接通' : '这一步没有完成'}
          body={failure}
          action={guide}
        />
      ) : null}
      {phase === 'empty' ? (
        <SurfaceEmpty
          icon={Sparkles}
          title="还没有技能"
          body="从一个本机目录安装之后，这里会列出它。"
          action={<SurfaceButton variant="primary" onClick={openInstall}>安装技能</SurfaceButton>}
        />
      ) : null}
      {phase === 'ready' ? (
        <div className="space-y-3">
          {note ? <SurfaceBanner tone="quiet">{humanizeSurfaceMessage(note, note)}</SurfaceBanner> : null}
          <div className="flex flex-wrap items-center gap-2">
            {canFilter ? (
              <SurfaceSegmented
                label="筛选"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: 'all', label: `全部 ${skills.length}` },
                  { id: 'enabled', label: `启用 ${enabledCount}` },
                  { id: 'disabled', label: `停用 ${disabledCount}` },
                ]}
              />
            ) : (
              <div className="text-kit-sm text-kit-secondary">全部 {skills.length}</div>
            )}
            <div className="ml-auto">
              <SurfaceButton variant="primary" disabled={busy} onClick={openInstall}>安装技能</SurfaceButton>
            </div>
          </div>
          <div className={wide ? 'grid grid-cols-[minmax(0,1fr)_minmax(260px,340px)] gap-3' : 'space-y-3'}>
            {(!picked || wide) ? (
              <div className="min-w-0 space-y-2">
                <SurfaceSearch aria-label="搜索技能" placeholder="搜索技能" value={query} onChange={(event) => setQuery(event.target.value)} />
                {filtered.length ? (
                  <SkillList rows={filtered} selected={shown?.id || ''} onOpen={setPicked} onToggle={runToggle} />
                ) : (
                  <SurfaceEmpty icon={Sparkles} title="没有匹配的技能" body="换个词，或改一下筛选。" />
                )}
              </div>
            ) : null}
            {(picked || wide) ? (
              <SkillDetail
                row={shown}
                showBack={!wide}
                busy={busy}
                files={files}
                editor={editor}
                newRel={newRel}
                onBack={() => setPicked(null)}
                onToggle={runToggle}
                onUninstall={runUninstall}
                onOpenFile={openBundleFile}
                onRemoveFile={removeBundleFile}
                onNewRel={setNewRel}
                onAddFile={addBundleFile}
                onEdit={(text) => setEditor((current) => (current ? { ...current, text } : current))}
                onSaveFile={saveEditor}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      <InstallDialog
        open={installOpen}
        source={source}
        root={root}
        roots={roots}
        error={installError}
        busy={busy}
        onOpenChange={setInstallOpen}
        onSource={setSource}
        onRoot={setRoot}
        onPick={() => {
          void runtimeApi.pickAiWorkspaceDirectory().then((path) => {
            if (path) setSource(path)
          })
        }}
        onSave={saveInstall}
      />
    </div>
  )
}
