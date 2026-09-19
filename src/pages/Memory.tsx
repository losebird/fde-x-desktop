import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadCurrentAiTarget } from '@/lib/ai-target'
import { openRef } from '@/lib/open-ref'
import { PageTitle, Empty } from '@/components/ui'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp, useCurrentWorkspace, useWorkspaces } from '@/store/app'

const CANVASES = [
  { id: 'explore', no: '01', kicker: '图谱工作室', title: '探索', desc: '浏览图谱并切换视图。' },
  { id: 'analyze', no: '02', kicker: '推理引擎', title: '分析', desc: '查询当前图并测试推理规则。' },
  { id: 'decisions', no: '03', kicker: '决策智能', title: '决策', desc: '会话里协助拍板，记下后看依据→决策→后果。' },
  { id: 'io', no: '04', kicker: '知识审计', title: '导入导出', desc: '导入、导出、对齐并审计图实体。' },
  { id: 'ontology', no: '05', kicker: '模式治理', title: '知识分类', desc: '加载、浏览、改和检查词表。' },
  { id: 'admin', no: '06', kicker: '图谱治理', title: '管理', desc: '摄取进度在这一页最上。下面是血缘、本体与治理。' },
] as const

const COVER_LABEL: Record<string, string> = {
  ontology: '制度',
  other: '其他',
  people: '人员',
  decision: '决策',
}
const CAPS = [
  { pane: 'explore', label: '上下文图' },
  { pane: 'decisions', label: '决策智能' },
  { pane: 'ontology', label: '词表与 SHACL' },
  { pane: 'admin', label: 'PROV-O 血缘' },
  { pane: 'analyze', label: '往前推' },
  { pane: 'admin', label: '知识管道' },
  { pane: 'analyze', label: '图分析' },
  { pane: 'admin', label: '存图后端' },
  { pane: 'admin', label: '数仓入口' },
] as const
const OWN_CHROME = new Set(['io', 'admin'])
const DRAWERS = ['entity', 'decision', 'health', 'lineage', 'find', 'import', 'export', 'registry', 'bridge'] as const

type CanvasId = (typeof CANVASES)[number]['id']
type DrawerId = (typeof DRAWERS)[number]

function isCanvasId(value: string): value is CanvasId {
  return CANVASES.some((row) => row.id === value)
}

function isDrawerId(value: string): value is DrawerId {
  return (DRAWERS as readonly string[]).includes(value)
}

function folderName(cwd: string) {
  return cwd.split('/').filter(Boolean).at(-1) || cwd
}

function ensureCanvasCss(id: CanvasId) {
  const marker = `fde-semantic-css-${id}`
  if (document.getElementById(marker)) return
  const link = document.createElement('link')
  link.id = marker
  link.rel = 'stylesheet'
  link.href = `/semantic-os/ws/${id}/${id}.css`
  document.head.appendChild(link)
}

function ensureHostCss() {
  const id = 'fde-semantic-host-css'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `
    [data-fde-semantic-canvas]{height:100%;min-height:0;display:flex;flex-direction:column}
    [data-fde-semantic-canvas] .dsh-explore-host,
    [data-fde-semantic-canvas] .explore-host,
    [data-fde-semantic-canvas] .explore-host-wrap{flex:1;min-height:0;height:100%;width:100%}
  `
  document.head.appendChild(style)
}

function loadCanvasModule(id: CanvasId) {
  return import(/* @vite-ignore */ `/semantic-os/ws/${id}/${id}.js`)
}

function selectedNodeId(root: HTMLElement | null) {
  if (!root) return ''
  const strong = root.querySelector('.explore-inspector-scroll strong, .explore-inspector-card h2, .explore-inspector-card h3')
  return strong?.textContent?.trim() || ''
}

async function semanticJson(path: string, init?: RequestInit) {
  const response = await fetch(path, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok || (body && body.error && body.ok === false)) {
    throw new Error(String(body?.error || body?.hint || body?.detail || `HTTP ${response.status}`))
  }
  return body as Record<string, unknown>
}

function downloadText(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export default function Memory() {
  const workspace = useCurrentWorkspace()
  const cwd = workspace?.cwd && workspace.cwd.startsWith('/') ? workspace.cwd : ''
  const nav = useNavigate()
  const openSettings = () => {
    useApp.getState().togglePanel('settings', 'full')
    nav('/settings')
  }
  const storedPane = useApp((s) => s.memoryBrowse.pane)
  const storedDrawer = useApp((s) => s.memoryBrowse.drawer)
  const setMemoryBrowse = useApp((s) => s.setMemoryBrowse)
  const pane: 'home' | CanvasId = (storedPane === 'home' || isCanvasId(storedPane)) ? storedPane : 'home'
  const drawer: DrawerId | '' = isDrawerId(storedDrawer) ? storedDrawer : ''
  const setPane = (next: 'home' | CanvasId) => setMemoryBrowse({ pane: next })
  const setDrawer = (next: DrawerId | '') => setMemoryBrowse({ drawer: next })
  const [ready, setReady] = useState<Record<string, unknown> | null>(null)
  const [cover, setCover] = useState<Array<{ id?: string; n?: number }>>([])
  const [note, setNote] = useState('')
  const [canvasError, setCanvasError] = useState('')
  const [reload, setReload] = useState(0)
  const [ingest, setIngest] = useState<Record<string, unknown> | null>(null)
  const [toast, setToast] = useState('')
  const hostRef = useRef<HTMLDivElement>(null)
  const cwdRef = useRef(cwd)

  useEffect(() => {
    if (cwdRef.current === cwd) return
    cwdRef.current = cwd
    setMemoryBrowse({ pane: 'home', drawer: '' })
  }, [cwd, setMemoryBrowse])

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.source !== 'dsos') return
      if (typeof data.open === 'string' && isDrawerId(data.open)) setDrawer(data.open)
      if (data.open === 'settings') openSettings()
      if (data.reload) setReload((n) => n + 1)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    let alive = true
    void runtimeApi.memoryReady().then((row) => { if (alive) setReady(row) }).catch(() => {
      if (alive) setReady({ ready: false, detail: '无法读取引擎状态' })
    })
    if (!cwd) {
      setCover([])
      return () => { alive = false }
    }
    void runtimeApi.semanticCoverage(cwd).then((row) => {
      if (!alive) return
      const buckets = Array.isArray((row as { buckets?: unknown[] }).buckets)
        ? (row as { buckets: Array<{ id?: string; n?: number }> }).buckets
        : []
      setCover(buckets)
      setNote(row && row.ok === false ? String(row.detail || row.error || '') : '')
    }).catch((cause) => {
      if (alive) setNote(cause instanceof Error ? cause.message : '封面读取失败')
    })
    return () => { alive = false }
  }, [cwd, reload])

  useEffect(() => {
    if (!cwd) return
    let alive = true
    const tick = () => {
      void fetch(`/semantic-os/ingest/progress?cwd=${encodeURIComponent(cwd)}`)
        .then((r) => r.json())
        .then((row) => { if (alive) setIngest(row) })
        .catch(() => undefined)
    }
    tick()
    const timer = window.setInterval(tick, 4000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [cwd])

  const goHome = () => { setPane('home'); setDrawer('') }

  const hostActions = useMemo(() => {
    if (!pane || pane === 'home' || OWN_CHROME.has(pane)) return []
    const actions: Array<{ id: string; label: string; onClick: () => void }> = [
      { id: 'home', label: '返回', onClick: goHome },
    ]
    if (pane === 'explore') {
      actions.push(
        { id: 'add-entity', label: '加实体', onClick: () => setDrawer('entity') },
        { id: 'copy-path', label: '复制出处', onClick: () => {
          const selected = selectedNodeId(hostRef.current)
          if (!selected) {
            setDrawer('lineage')
            return
          }
          void fetch(`/semantic-os/lineage?cwd=${encodeURIComponent(cwd)}&id=${encodeURIComponent(selected)}`)
            .then((r) => r.json())
            .then((data) => {
              if (data?.ok && data.path) return navigator.clipboard.writeText(String(data.path)).then(() => setToast('已复制出处'))
              setDrawer('lineage')
            })
            .catch(() => setDrawer('lineage'))
        } },
      )
    }
    if (pane === 'decisions') {
      actions.push(
        { id: 'record', label: '记一条', onClick: () => setDrawer('decision') },
        { id: 'health', label: '记忆梳理', onClick: () => setDrawer('health') },
      )
    }
    return actions
  }, [pane, cwd])

  useEffect(() => {
    if (pane === 'home' || !cwd) return
    const el = hostRef.current
    if (!el) return
    let cancelled = false
    let unmount: (() => void) | undefined
    setCanvasError('')
    ensureHostCss()
    ensureCanvasCss(pane)
    el.replaceChildren()
    el.classList.add('dsos-root')
    el.setAttribute('data-dsos-semantic', '')
    el.setAttribute('data-cwd', cwd)
    el.dataset.cwd = cwd
    void loadCanvasModule(pane).then((mod) => {
      if (typeof mod.mount !== 'function') {
        if (!cancelled) setCanvasError('语义画布未就绪。请重启本地核心后再打开。')
        return
      }
      const stop = mod.mount(el, { cwd, hostActions })
      if (cancelled) {
        if (typeof stop === 'function') stop()
        return
      }
      if (typeof stop === 'function') unmount = stop
    }).catch((error) => {
      if (!cancelled) setCanvasError(error instanceof Error ? error.message : '画布加载失败')
    })
    return () => {
      cancelled = true
      if (unmount) {
        try { unmount() } catch { /* 官方画布卸载失败不能挡住切页 */ }
      }
    }
  }, [pane, cwd, reload, hostActions])

  const online = ready?.ready === true
  const title = cwd ? folderName(cwd) : (workspace?.name || '未选择工作区')
  const ingestState = String(ingest?.state || '')

  function runIngest(kind: 'start' | 'cancel' | 'retry') {
    setToast(kind === 'start' ? '正在摄取…' : '正在处理…')
    void Promise.all([
      fetch(`/semantic-os/ingest/${kind}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cwd }),
      }).then((r) => r.json()),
      kind === 'start'
        ? fetch('/semantic-os/session-ingest/now', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cwd }),
        }).then((r) => r.json()).catch(() => ({}))
        : Promise.resolve({}),
    ]).then(([job]) => {
      setIngest(job)
      const state = String(job?.state || job?.error || '')
      setToast(state === 'failed' || job?.error ? String(job.detail || job.error || '摄取失败') : '已开始摄取，会话也会再扫一轮')
    }).catch((cause) => setToast(cause instanceof Error ? cause.message : '摄取失败'))
  }

  function pickImport(ext: 'json' | 'csv') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ext === 'json' ? '.json,application/json' : '.csv,text/csv'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      void file.text().then(async (text) => {
        const preview = await semanticJson('/semantic-os/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cwd, filename: file.name, data: text, confirm: false }),
        })
        const n = Number(preview.node_count || 0)
        const m = Number(preview.edge_count || 0)
        if (!n && !m) throw new Error('预览是空的')
        if (!window.confirm(`将写入 ${n} 个点、${m} 条边，确认导入？`)) return
        await semanticJson('/semantic-os/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cwd, filename: file.name, data: text, confirm: true }),
        })
        setReload((v) => v + 1)
        setToast('已导入')
      }).catch((error) => setToast(error instanceof Error ? error.message : '导入失败'))
    }
    input.click()
  }

  function exportRdf() {
    void runtimeApi.semanticPython('export_graph', { format: 'rdf' }, cwd).then((data) => {
      const text = typeof data.data === 'string' ? data.data : JSON.stringify(data.data ?? data, null, 2)
      downloadText('graph.ttl', text, 'text/turtle;charset=utf-8')
    }).catch((error) => setToast(error instanceof Error ? error.message : '导出失败'))
  }

  const home = (
    <div className="h-full min-h-0 overflow-auto px-6 py-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted mb-2">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        <span>{online ? '系统在线' : '引擎未就绪'}</span>
        <span className="text-ink-subtle">·</span>
        <span className="truncate min-w-0" title={cwd || undefined}>{title}</span>
      </div>
      <PageTitle title="语义" subtitle="把当前目录里的知识画成一张图。点开就能看谁和谁有关，也能记下当时为什么这么定。" />
      {!cwd && <Empty title="没有工作区目录" hint="请在顶栏选择一个带本机路径的工作区。语义图按目录隔离。" />}
      {cwd && (
        <>
          {cover.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {cover.map((row) => (
                <span key={String(row.id || row.n)} className="tag">
                  {COVER_LABEL[String(row.id || '')] || row.id} {Number(row.n || 0)}
                </span>
              ))}
            </div>
          )}
          {note && <div className="text-xs text-ink-muted mb-3 break-all">{note}</div>}
          {ingestState && ingestState !== 'idle' && ingestState !== 'done' && (
            <div className="text-xs text-ink-muted mb-3">摄取 {ingestState}{ingest?.detail ? ` · ${String(ingest.detail)}` : ''}</div>
          )}
          <div className="flex flex-wrap gap-2 mb-5">
            <button type="button" className="btn-primary" onClick={() => setPane('explore')}>打开探索</button>
            <button type="button" className="btn" onClick={() => setPane('analyze')}>运行推理</button>
            <button type="button" className="btn" onClick={() => setDrawer('health')}>记忆梳理</button>
            <button type="button" className="btn" onClick={() => setDrawer('find')}>搜索</button>
            <button type="button" className="btn" onClick={openSettings}>引擎设置</button>
          </div>
          <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-3 mb-5">
            {CANVASES.map((row) => (
              <button
                key={row.id}
                type="button"
                className="card p-4 text-left hover:bg-surface-2 transition-colors min-w-0"
                onClick={() => setPane(row.id)}
              >
                <div className="text-[11px] text-ink-subtle mb-2">{row.no}</div>
                <div className="text-[11px] text-ink-muted">{row.kicker}</div>
                <div className="text-base font-medium mt-1">{row.title}</div>
                <div className="text-xs text-ink-muted mt-1 leading-5">{row.desc}</div>
                <div className="text-ink-subtle mt-3">→</div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {CAPS.map((row) => (
              <button
                key={row.label}
                type="button"
                className="tag hover:bg-surface-2"
                onClick={() => { if (isCanvasId(row.pane)) setPane(row.pane) }}
              >
                {row.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const canvas = pane !== 'home' && (
    <div className="h-full min-h-0 flex flex-col">
      {OWN_CHROME.has(pane) && (
        <div className="shrink-0 px-3 py-2 border-b border-line flex flex-wrap items-center gap-2 min-w-0">
          <button type="button" className="btn" onClick={goHome}>返回</button>
          <div className="text-sm font-medium truncate min-w-0">{CANVASES.find((row) => row.id === pane)?.title}</div>
          {pane === 'io' && (
            <>
              <button type="button" className="btn" onClick={() => pickImport('json')}>导入 JSON</button>
              <button type="button" className="btn" onClick={() => pickImport('csv')}>导入 CSV</button>
              <button type="button" className="btn" onClick={exportRdf}>导出 RDF</button>
            </>
          )}
          {pane === 'admin' && (
            <>
              <button type="button" className="btn" onClick={() => runIngest('start')}>再摄取</button>
              <button type="button" className="btn" onClick={() => setDrawer('bridge')}>建桥</button>
              <button type="button" className="btn" onClick={() => setDrawer('registry')}>词表</button>
              <button type="button" className="btn" onClick={() => setDrawer('health')}>记忆梳理</button>
              <button type="button" className="btn" onClick={openSettings}>设置</button>
            </>
          )}
        </div>
      )}
      {toast && <div className="shrink-0 px-3 py-1 text-xs text-ink-muted">{toast}</div>}
      {canvasError ? (
        <div className="p-6"><Empty title="画布打不开" hint={canvasError} /></div>
      ) : (
        <div ref={hostRef} data-fde-semantic-canvas="" className="flex-1 min-h-0 min-w-0 overflow-hidden" />
      )}
    </div>
  )

  return (
    <div className="relative h-full min-h-0 min-w-0 flex flex-col dsos-root" data-dsos-semantic="" data-cwd={cwd || undefined} data-memory-pane={pane}>
      {pane === 'home' ? home : canvas}
      {drawer && cwd && (
        <aside className="absolute inset-y-0 right-0 w-full max-w-md bg-surface border-l border-line shadow-lg z-10 flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-3 border-b border-line flex items-center justify-between gap-2">
            <div className="text-sm font-medium truncate">{drawerTitle(drawer)}</div>
            <button type="button" className="btn" onClick={() => setDrawer('')}>关闭</button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-4">
            {drawer === 'entity' && <EntityForm cwd={cwd} onDone={() => { setDrawer(''); setReload((n) => n + 1) }} />}
            {drawer === 'decision' && <DecisionForm cwd={cwd} onDone={() => { setDrawer(''); setReload((n) => n + 1) }} />}
            {drawer === 'health' && <HealthPanel cwd={cwd} ready={ready} onRetry={() => { void runtimeApi.memoryRetryReady().then(setReady).catch(() => undefined) }} />}
            {drawer === 'lineage' && <LineagePanel cwd={cwd} />}
            {drawer === 'find' && <FindPanel />}
            {drawer === 'import' && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn" onClick={() => pickImport('json')}>导入 JSON</button>
                <button type="button" className="btn" onClick={() => pickImport('csv')}>导入 CSV</button>
              </div>
            )}
            {drawer === 'export' && <button type="button" className="btn" onClick={exportRdf}>导出 RDF</button>}
            {drawer === 'registry' && <RegistryPanel cwd={cwd} />}
            {drawer === 'bridge' && <BridgePanel cwd={cwd} />}
          </div>
        </aside>
      )}
    </div>
  )
}

function drawerTitle(id: DrawerId) {
  const labels: Record<DrawerId, string> = {
    entity: '加实体',
    decision: '记一条决策',
    health: '记忆梳理',
    lineage: '出处',
    find: '搜索',
    import: '导入',
    export: '导出',
    registry: '词表登记',
    bridge: '工作区桥接',
  }
  return labels[id]
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="text-xs font-medium mb-1">{label}</div>
      {children}
    </label>
  )
}

function EntityForm({ cwd, onDone }: { cwd: string; onDone: () => void }) {
  const [id, setId] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState('Entity')
  const [err, setErr] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setErr('')
    void runtimeApi.semanticPython('add_node', { id, label, type }, cwd).then(onDone).catch((cause) => {
      setErr(cause instanceof Error ? cause.message : '没加上')
    })
  }
  return (
    <form onSubmit={submit}>
      <Field label="实体 id"><input className="input w-full" value={id} onChange={(e) => setId(e.target.value)} required /></Field>
      <Field label="名称"><input className="input w-full" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      <Field label="类型"><input className="input w-full" value={type} onChange={(e) => setType(e.target.value)} /></Field>
      {err && <div className="text-xs text-accent-red mb-2">{err}</div>}
      <button type="submit" className="btn-primary">加入</button>
    </form>
  )
}

function DecisionForm({ cwd, onDone }: { cwd: string; onDone: () => void }) {
  const [form, setForm] = useState({ category: '', scenario: '', reasoning: '', outcome: '', confidence: '0.8', title: '', because: '', leads_to: '' })
  const [err, setErr] = useState('')
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setErr('')
    const because = form.because.split(/[\s,]+/).map((row) => row.trim()).filter(Boolean)
    if (!because.length) {
      setErr('依据不能空')
      return
    }
    void runtimeApi.semanticPython('record_decision', {
      category: form.category,
      scenario: form.scenario,
      reasoning: form.reasoning,
      outcome: form.outcome,
      confidence: Number(form.confidence),
      title: form.title,
      because,
      leads_to: form.leads_to.split(/[\s,]+/).map((row) => row.trim()).filter(Boolean),
    }, cwd).then(onDone).catch((cause) => setErr(cause instanceof Error ? cause.message : '没记下'))
  }
  return (
    <form onSubmit={submit}>
      <Field label="类别"><input className="input w-full" value={form.category} onChange={set('category')} required /></Field>
      <Field label="情境"><textarea className="input w-full min-h-20" value={form.scenario} onChange={set('scenario')} required /></Field>
      <Field label="理由"><textarea className="input w-full min-h-20" value={form.reasoning} onChange={set('reasoning')} required /></Field>
      <Field label="结果"><input className="input w-full" value={form.outcome} onChange={set('outcome')} required /></Field>
      <Field label="把握"><input className="input w-full" value={form.confidence} onChange={set('confidence')} /></Field>
      <Field label="标题"><input className="input w-full" value={form.title} onChange={set('title')} /></Field>
      <Field label="依据 id"><input className="input w-full" value={form.because} onChange={set('because')} required /></Field>
      <Field label="后果 id"><input className="input w-full" value={form.leads_to} onChange={set('leads_to')} /></Field>
      {err && <div className="text-xs text-accent-red mb-2">{err}</div>}
      <button type="submit" className="btn-primary">记下</button>
    </form>
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') as Array<Record<string, unknown>> : []
}

function clockFromIso(value: unknown) {
  const iso = String(value || '').trim()
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function hitWhen(row: Record<string, unknown>) {
  const then = row.then
  const fromThen = then && typeof then === 'object' ? (then as Record<string, unknown>).valid_from : ''
  const node = asRecord(row.node)
  const props = node ? asRecord(node.properties) : null
  return clockFromIso(
    node?.valid_from
    || props?.valid_from
    || props?.timestamp
    || props?.event_time
    || row.valid_from
    || fromThen,
  )
}

function HealthPanel({ cwd, ready, onRetry }: { cwd: string; ready: Record<string, unknown> | null; onRetry: () => void }) {
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([])
  const [err, setErr] = useState('')
  useEffect(() => {
    setErr('')
    void runtimeApi.semanticPython('memory_health', { limit: 80, offset: 0 }, cwd).then((data) => {
      const rows = asRows(data.groups)
      const issues = asRows(data.issues)
      setGroups(rows.length ? rows : issues.length ? [{ kind: '待整理', items: issues, count: issues.length }] : [])
    }).catch((cause) => {
      setGroups([])
      setErr(cause instanceof Error ? cause.message : '梳理失败')
    })
  }, [cwd])
  return (
    <div className="space-y-3 text-sm min-w-0">
      <div>引擎 {ready?.ready ? '就绪' : '未就绪'}{cwd ? ` · ${cwd.split('/').filter(Boolean).at(-1)}` : ''}</div>
      <p className="text-xs text-ink-muted">按类看缺出处、重复、过期的记忆，不是装依赖的体检表。</p>
      {!ready?.ready && <button type="button" className="btn" onClick={onRetry}>再拉起引擎</button>}
      {err && <div className="text-xs text-accent-red">{err}</div>}
      {groups.length === 0 && !err && <div className="text-xs text-ink-muted">这一类没有待办。</div>}
      {groups.map((group) => {
        const items = asRows(group.items)
        return (
          <div key={String(group.kind || 'x')} className="border border-line rounded p-2 min-w-0">
            <div className="text-xs font-medium mb-1">{String(group.kind || '待整理')} · {Number(group.count || items.length)}</div>
            {items.slice(0, 8).map((row, index) => (
              <div key={String(row.id || index)} className="text-xs text-ink-muted break-words py-1 border-t border-line first:border-0">
                {String(row.label || row.id || '')}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function LineagePanel({ cwd }: { cwd: string }) {
  const [id, setId] = useState('')
  const [body, setBody] = useState('')
  const load = () => {
    void fetch(`/semantic-os/lineage?cwd=${encodeURIComponent(cwd)}&id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => setBody(JSON.stringify(data, null, 2)))
      .catch((error) => setBody(error instanceof Error ? error.message : '查不到'))
  }
  return (
    <div>
      <Field label="节点 id">
        <input className="input w-full" value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load() }} />
      </Field>
      <button type="button" className="btn mb-3" onClick={load}>查出处</button>
      {body && <pre className="text-[11px] whitespace-pre-wrap break-all bg-surface-2 p-2 rounded">{body}</pre>}
    </div>
  )
}

function sessionIdFromHit(row: Record<string, unknown>) {
  const node = asRecord(row.node)
  const raw = String(row.id || node?.id || '')
  const matched = raw.match(/^session:(session-[^:]+)/) || raw.match(/^session:([^:]+)/)
  return matched ? matched[1] : ''
}

function FindPanel() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Array<Record<string, unknown>>>([])
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!q.trim()) {
      setHits([])
      setNote('')
      return
    }
    const handle = window.setTimeout(() => {
      void runtimeApi.searchMemory(q.trim()).then((data) => {
        const items = asRows(data.items)
        const excerpts = asRows(data.excerpts)
        const rawHits = asRows(data.hits)
        const rows = items.length ? items : excerpts.length ? excerpts : rawHits
        setHits(rows)
        setNote(rows.length ? '' : String(data.excerptEmptyReason || data.semanticEmptyReason || '没有摘录'))
      }).catch((cause) => {
        setHits([])
        setNote(cause instanceof Error ? cause.message : '搜索失败')
      })
    }, 280)
    return () => window.clearTimeout(handle)
  }, [q])
  return (
    <div className="min-w-0">
      <input className="input w-full mb-3" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜当前工作区" />
      {note && !hits.length && <div className="text-xs text-ink-muted">{note}</div>}
      {hits.map((row, index) => {
        const hitId = String(row.id || '')
        const isSession = hitId.startsWith('session:')
        return (
        <div key={String(row.id || index)} className="text-xs border border-line rounded p-2 mb-2 break-words min-w-0">
          <div className="text-ink-subtle mb-1">{hitWhen(row) || String(row.title || row.id || '')}</div>
          {String(row.snippet || row.excerpt || row.text || row.content || '')}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn h-7 px-2" onClick={() => {
              const snippet = String(row.snippet || row.excerpt || row.text || row.content || '')
              void loadCurrentAiTarget().then((target) => {
                if (!target.ok) {
                  setNote(target.error)
                  return
                }
                return runtimeApi.promptAi(target.sessionId, { text: `【记忆摘录】\n${snippet}\n出处 ${hitId}` })
              }).then(() => {
                useApp.getState().togglePanel('memory', 'tab')
                nav('/ai')
              }).catch((cause) => setNote(cause instanceof Error ? cause.message : '没问出去'))
            }}>问 AI</button>
            {!isSession && hitId && (
              <button type="button" className="btn h-7 px-2" onClick={() => {
                void runtimeApi.fetchCorpus(hitId).then((doc) => {
                  if (doc.href) openRef(doc.href)
                  else setNote('找不到来源跳转')
                }).catch((cause) => setNote(cause instanceof Error ? cause.message : '读不出来源'))
              }}>打开来源</button>
            )}
            {sessionIdFromHit(row) && (
              <button type="button" className="btn h-7 px-2" onClick={() => {
                const sid = sessionIdFromHit(row)
                useApp.getState().setActiveAiSessionId(sid)
                useApp.getState().togglePanel('memory', 'tab')
                nav(`/ai/${encodeURIComponent(sid)}`)
              }}>打开会话</button>
            )}
          </div>
        </div>
        )
      })}
    </div>
  )
}

function RegistryPanel({ cwd }: { cwd: string }) {
  const [body, setBody] = useState('读取中…')
  useEffect(() => {
    void fetch(`/semantic-os/api/ontology/registry?cwd=${encodeURIComponent(cwd)}`)
      .then((r) => r.json())
      .then((data) => setBody(JSON.stringify(data, null, 2).slice(0, 8000)))
      .catch((error) => setBody(error instanceof Error ? error.message : '读不到'))
  }, [cwd])
  return <pre className="text-[11px] whitespace-pre-wrap break-all bg-surface-2 p-2 rounded">{body}</pre>
}

function BridgePanel({ cwd }: { cwd: string }) {
  const peers = useWorkspaces()
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([])
  const [paste, setPaste] = useState('')
  const [err, setErr] = useState('')
  const load = () => {
    void fetch(`/semantic-os/bridge?cwd=${encodeURIComponent(cwd)}`)
      .then((r) => r.json())
      .then((data) => setLinks(asRows(data.links)))
      .catch(() => setLinks([]))
  }
  useEffect(() => { load() }, [cwd])
  const create = (target: string) => {
    const dest = target.trim()
    setErr('')
    if (!dest.startsWith('/') || dest === cwd) {
      setErr('请选另一个工作区目录')
      return
    }
    void fetch('/semantic-os/bridge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceCwd: cwd, targetCwd: dest, pluginVersion: '0.1.1' }),
    }).then((r) => r.json()).then((data) => {
      if (!data?.ok) throw new Error(String(data?.error || '没建成'))
      load()
    }).catch((cause) => setErr(cause instanceof Error ? cause.message : '没建成'))
  }
  const remove = (id: string) => {
    void fetch('/semantic-os/bridge', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, cwd }),
    }).then(() => load()).catch(() => undefined)
  }
  const others = peers.filter((row) => row.cwd && row.cwd.startsWith('/') && row.cwd !== cwd)
  return (
    <div className="space-y-3 text-sm min-w-0">
      <p className="text-xs text-ink-muted">把两个工作区的图连起来，搜索可以跟着桥走到对面。</p>
      {others.map((row) => (
        <button key={row.id} type="button" className="btn w-full text-left break-all" onClick={() => create(row.cwd || '')}>
          接到 {row.name} · {row.cwd}
        </button>
      ))}
      <Field label="或粘贴目录">
        <input className="input w-full" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="/绝对路径" />
      </Field>
      <button type="button" className="btn" onClick={() => create(paste)}>创建桥</button>
      {err && <div className="text-xs text-accent-red">{err}</div>}
      {links.map((row) => (
        <div key={String(row.id)} className="text-xs border border-line rounded p-2 flex items-start justify-between gap-2">
          <span className="break-all min-w-0">{String(row.sourceCwd)} ↔ {String(row.targetCwd)}</span>
          <button type="button" className="btn shrink-0" onClick={() => remove(String(row.id))}>断开</button>
        </div>
      ))}
    </div>
  )
}
