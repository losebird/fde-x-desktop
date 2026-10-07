// Skills 管理:当前会话 catalog 包 + Face 额外命名空间
import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Search } from 'lucide-react'
import clsx from 'clsx'
import { PageTitle, Card, Tag } from '@/components/ui'
import { runtimeApi, type SkillBagItem } from '@/lib/runtime-api'
import { currentAiTarget, loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { openFilesAtPath } from '@/lib/app-platform'
import { useApp } from '@/store/app'
import { lastModuleBag, rememberModuleBag } from '@/lib/module-catalog-cache'

type SkillRoot = { path: string; source: string }
type BundleFile = { rel: string; type: string }

function hasInvocableBit(row: SkillBagItem) {
  return typeof row.modelInvocable === 'boolean'
}

function canManageBundle(row: SkillBagItem | null) {
  return Boolean(row && row.origin === 'catalog' && row.path)
}

export default function Skills() {
  const [skills, setSkills] = useState<SkillBagItem[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [active, setActive] = useState<SkillBagItem | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<BundleFile[]>([])
  const [editor, setEditor] = useState<{ rel: string; text: string } | null>(null)
  const [newRel, setNewRel] = useState('')
  const [showInstall, setShowInstall] = useState(false)
  const [roots, setRoots] = useState<SkillRoot[]>([])
  const [draft, setDraft] = useState({ source: '', root: '' })
  const [sessionId, setSessionId] = useState('')
  const workspaceId = useApp((s) => s.activeWorkspaceId)

  const workspaceCwd = () => {
    const folder = loadCurrentWorkspaceCwd()
    return folder.ok ? folder.cwd : ''
  }

  const load = useCallback(() => {
    const cached = lastModuleBag<SkillBagItem[]>('skills')
    if (cached?.length) {
      setSkills(cached)
      setActive((current) => current || cached[0] || null)
    }
    void (async () => {
      try {
        const status = await runtimeApi.aiStatus()
        if (!status.connected) {
          setNote('核心未接通')
          return
        }
        const first = (await runtimeApi.listAiSkills()).items
        if (first.length) {
          setNote('')
          setSkills(first)
          setActive((current) => first.find((row) => row.id === current?.id) || first[0] || null)
          rememberModuleBag('skills', first)
        }
        const target = await currentAiTarget()
        if (!target.ok) {
          setSessionId('')
          if (!first.length) setNote(target.error)
          return
        }
        setSessionId(target.sessionId)
        const mapped = (await runtimeApi.listAiSkills(target.sessionId)).items
        setNote('')
        setSkills(mapped)
        setActive((current) => mapped.find((row) => row.id === current?.id) || mapped[0] || null)
        rememberModuleBag('skills', mapped)
      } catch (cause) {
        if (!lastModuleBag<SkillBagItem[]>('skills')?.length) {
          setSkills([])
          setNote(cause instanceof Error ? cause.message : '读不到 Skills')
        }
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
    if (!canManageBundle(active) || !active?.path) {
      setFiles([])
      setEditor(null)
      return
    }
    const cwd = workspaceCwd()
    void runtimeApi.listSkillBundleFiles(active.path, cwd, sessionId).then((data) => {
      setFiles(Array.isArray(data.files) ? data.files : [])
    }).catch(() => setFiles([]))
  }, [active?.path, active?.origin, workspaceId, sessionId])

  const canFilterEnabled = skills.some(hasInvocableBit)
  const filtered = skills.filter((s) => {
    if (canFilterEnabled && filter === 'enabled' && s.modelInvocable !== true) return false
    if (canFilterEnabled && filter === 'disabled' && s.modelInvocable !== false) return false
    if (q && !s.name.includes(q) && !(s.description || '').includes(q)) return false
    return true
  })
  const enabledCount = skills.filter((s) => s.modelInvocable === true).length
  const subtitle = note
    || (canFilterEnabled
      ? `已安装 ${skills.length} 个 · 启用 ${enabledCount} 个`
      : `已安装 ${skills.length} 个`)

  const runInvocable = (row: SkillBagItem, modelInvocable: boolean) => {
    if (!row.path) return
    setBusy(true)
    void runtimeApi.setSkillModelInvocable({ path: row.path, modelInvocable, cwd: workspaceCwd(), sessionId }).then(() => {
      load()
    }).catch((cause) => {
      setNote(cause instanceof Error ? cause.message : '改不了启停')
    }).finally(() => setBusy(false))
  }

  const openInstall = () => {
    setShowInstall(true)
    void runtimeApi.listSkillRoots(workspaceCwd()).then((data) => {
      const next = Array.isArray(data.roots) ? data.roots : []
      setRoots(next)
      setDraft((current) => ({ ...current, root: current.root || (next[0] ? next[0].path : '') }))
    }).catch(() => setRoots([]))
  }

  const saveInstall = () => {
    if (!draft.source || !draft.root) {
      setNote('需要 source 和 root')
      return
    }
    setBusy(true)
    void runtimeApi.installSkillBundle({ source: draft.source, root: draft.root, cwd: workspaceCwd() }).then(() => {
      setShowInstall(false)
      setDraft({ source: '', root: draft.root })
      load()
    }).catch((cause) => {
      setNote(cause instanceof Error ? cause.message : '安装失败')
    }).finally(() => setBusy(false))
  }

  const runUninstall = (row: SkillBagItem) => {
    if (!row.path) return
    setBusy(true)
    void runtimeApi.uninstallSkillBundle(row.path, workspaceCwd(), sessionId).then(() => {
      setActive(null)
      load()
    }).catch((cause) => {
      setNote(cause instanceof Error ? cause.message : '卸载失败')
    }).finally(() => setBusy(false))
  }

  const openBundleFile = (rel: string, type: string) => {
    if (type === 'dir' || !active?.path) return
    const abs = active.bundleRoot ? `${active.bundleRoot.replace(/\/$/, '')}/${rel}` : ''
    if (abs && openFilesAtPath(abs)) return
    const cwd = workspaceCwd()
    void runtimeApi.readSkillBundleFile(active.path, rel, cwd, sessionId).then((data) => {
      setEditor({ rel: data.rel, text: data.text })
    }).catch((cause) => {
      setNote(cause instanceof Error ? cause.message : '读不了文件')
    })
  }

  const saveEditor = () => {
    if (!editor || !active?.path) return
    setBusy(true)
    void runtimeApi.writeSkillBundleFile({ path: active.path, rel: editor.rel, text: editor.text, cwd: workspaceCwd(), sessionId }).then(() => {
      setNote('')
      load()
    }).catch((cause) => {
      setNote(cause instanceof Error ? cause.message : '写不了文件')
    }).finally(() => setBusy(false))
  }

  const addBundleFile = () => {
    const rel = newRel.trim()
    if (!rel || !active?.path) return
    setBusy(true)
    void runtimeApi.writeSkillBundleFile({ path: active.path, rel, text: '', cwd: workspaceCwd(), sessionId }).then(() => {
      setNewRel('')
      return runtimeApi.listSkillBundleFiles(active.path, workspaceCwd(), sessionId)
    }).then((data) => {
      if (data) setFiles(Array.isArray(data.files) ? data.files : [])
    }).catch((cause) => {
      setNote(cause instanceof Error ? cause.message : '新建失败')
    }).finally(() => setBusy(false))
  }

  const removeBundleFile = (rel: string) => {
    if (!active?.path) return
    setBusy(true)
    void runtimeApi.removeSkillBundleFile(active.path, rel, workspaceCwd(), sessionId).then(() => {
      if (editor?.rel === rel) setEditor(null)
      return runtimeApi.listSkillBundleFiles(active.path, workspaceCwd(), sessionId)
    }).then((data) => {
      if (data) setFiles(Array.isArray(data.files) ? data.files : [])
    }).catch((cause) => {
      setNote(cause instanceof Error ? cause.message : '删除失败')
    }).finally(() => setBusy(false))
  }

  return (
    <div>
      <PageTitle
        title="Skills"
        subtitle={subtitle}
        actions={
          <button type="button" className="btn-primary" disabled={busy} onClick={openInstall}><Sparkles size={14} /> 安装新 Skill</button>
        }
      />

      <div className="grid grid-cols-1 @3xl:grid-cols-[1fr_360px] gap-6">
        <div>
          <Card className="mb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {canFilterEnabled ? (
                <div className="flex items-center gap-1">
                  {(['all', 'enabled', 'disabled'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setFilter(k)}
                      className={clsx('px-3 py-1.5 rounded text-sm', filter === k ? 'bg-ink text-white' : 'hover:bg-surface-2 text-ink-muted')}
                    >
                      {k === 'all' ? '全部' : k === 'enabled' ? '启用中' : '已停用'}
                    </button>
                  ))}
                </div>
              ) : <div />}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input
                  className="input pl-8 h-8 w-52"
                  placeholder="搜索 Skill"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card><div className="text-sm text-ink-muted py-12 text-center">没有匹配的 Skill</div></Card>
          ) : (
            <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className={clsx('card p-4 hover:shadow-pop transition-shadow cursor-pointer', active?.id === s.id && 'ring-1 ring-brand')}
                  onClick={() => setActive(s)}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl shrink-0"><Sparkles size={22} className="text-ink-muted" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        {typeof s.modelInvocable === 'boolean' && (
                          <Tag kind={s.modelInvocable ? 'green' : 'default'}>{s.modelInvocable ? '启用' : '停用'}</Tag>
                        )}
                      </div>
                      {s.description && <div className="text-xs text-ink-muted mt-1.5 line-clamp-2">{s.description}</div>}
                      {Array.isArray(s.methods) && s.methods.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {s.methods.map((method) => <Tag key={method}>{method}</Tag>)}
                        </div>
                      )}
                    </div>
                  </div>
                  {Array.isArray(s.triggers) && s.triggers.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {s.triggers.map((t) => <span key={t} className="tag bg-surface-2 border border-line text-ink-muted text-[11px]">{t}</span>)}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      className={clsx('btn h-7 px-2 text-xs', s.modelInvocable && 'bg-brand-soft border-brand/30 text-brand')}
                      disabled={busy || !canManageBundle(s)}
                      title={canManageBundle(s) ? undefined : '当前没有启停 Remote'}
                      onClick={(e) => {
                        e.stopPropagation()
                        runInvocable(s, s.modelInvocable === false)
                      }}
                    >
                      {s.modelInvocable === false ? '启用' : '停用'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {active && (
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl"><Sparkles size={36} className="text-ink-muted" /></div>
                <div>
                  <div className="text-base font-medium">{active.name}</div>
                  {typeof active.modelInvocable === 'boolean' && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Tag kind={active.modelInvocable ? 'green' : 'default'}>{active.modelInvocable ? '启用' : '停用'}</Tag>
                    </div>
                  )}
                </div>
              </div>
              {active.description && <p className="text-sm text-ink-muted mb-4">{active.description}</p>}
              {active.path && (
                <>
                  <div className="text-xs text-ink-muted mb-1.5">路径</div>
                  <div className="text-xs font-mono text-ink-muted break-all mb-4">{active.path}</div>
                </>
              )}
              {Array.isArray(active.methods) && active.methods.length > 0 && (
                <>
                  <div className="text-xs text-ink-muted mb-1.5">方法</div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {active.methods.map((method) => <Tag key={method}>{method}</Tag>)}
                  </div>
                </>
              )}
              {Array.isArray(active.triggers) && active.triggers.length > 0 && (
                <>
                  <div className="text-xs text-ink-muted mb-1.5">触发词</div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {active.triggers.map((t) => <Tag key={t}>{t}</Tag>)}
                  </div>
                </>
              )}

              {canManageBundle(active) && (
                <>
                  <div className="text-xs text-ink-muted mb-1.5">文件</div>
                  <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                    {files.map((file) => (
                      <div key={file.rel} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost text-xs font-mono flex-1 text-left truncate h-7"
                          disabled={file.type === 'dir'}
                          onClick={() => openBundleFile(file.rel, file.type)}
                        >
                          {file.rel}
                        </button>
                        {file.type === 'file' && (
                          <button type="button" className="btn h-7 px-2 text-xs" disabled={busy} onClick={() => removeBundleFile(file.rel)}>删除</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mb-3">
                    <input className="input flex-1 font-mono text-xs h-8" value={newRel} onChange={(e) => setNewRel(e.target.value)} placeholder="scripts/run.mjs" />
                    <button type="button" className="btn h-8 px-2 text-xs" disabled={busy || !newRel.trim()} onClick={addBundleFile}>新增</button>
                  </div>
                  {editor && (
                    <div className="mb-3">
                      <div className="text-xs font-mono text-ink-muted mb-1">{editor.rel}</div>
                      <textarea className="input font-mono text-xs" rows={10} value={editor.text} onChange={(e) => setEditor({ ...editor, text: e.target.value })} />
                      <button type="button" className="btn mt-2 h-8 px-2 text-xs" disabled={busy} onClick={saveEditor}>保存文件</button>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  className={clsx('btn flex-1', active.modelInvocable && 'bg-brand-soft border-brand/30 text-brand')}
                  disabled={busy || !canManageBundle(active)}
                  title={canManageBundle(active) ? undefined : '当前没有启停 Remote'}
                  onClick={() => runInvocable(active, active.modelInvocable === false)}
                >
                  {active.modelInvocable === false ? '启用此 Skill' : '停用此 Skill'}
                </button>
                {canManageBundle(active) && (
                  <button type="button" className="btn" disabled={busy} onClick={() => runUninstall(active)}>卸载</button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {showInstall && (
        <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={() => setShowInstall(false)}>
          <div className="bg-surface w-[480px] h-full border-l border-line p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">安装 Skill</h3>
              <button type="button" className="btn-ghost p-1" onClick={() => setShowInstall(false)}>×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-muted">源包</label>
                <div className="flex gap-1.5 mt-1">
                  <input className="input flex-1 font-mono text-xs" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="/path/to/skill" />
                  <button
                    type="button"
                    className="btn h-8 px-2 text-xs"
                    onClick={() => {
                      void runtimeApi.pickAiWorkspaceDirectory().then((path) => {
                        if (path) setDraft((current) => ({ ...current, source: path }))
                      })
                    }}
                  >
                    选择
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-muted">安装到</label>
                <select className="input mt-1" value={draft.root} onChange={(e) => setDraft({ ...draft, root: e.target.value })}>
                  {roots.map((row) => (
                    <option key={row.path} value={row.path}>{row.source} · {row.path}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn" onClick={() => setShowInstall(false)}>取消</button>
                <button type="button" className="btn-primary" disabled={busy || !draft.source.trim() || !draft.root} onClick={saveInstall}>
                  {busy ? '保存中' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
