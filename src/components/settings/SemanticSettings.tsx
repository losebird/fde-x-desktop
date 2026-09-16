import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { Brain, RefreshCw } from 'lucide-react'
import { Card, Tag } from '@/components/ui'
import { runtimeApi } from '@/lib/runtime-api'
import { useCurrentWorkspace } from '@/store/app'

const GRAPH_BACKUP = '.dsh/semantic-os/graph.json'

function graphBackupPath(cwd?: string) {
  if (!cwd || !cwd.startsWith('/')) return ''
  return `${cwd.replace(/\/+$/u, '')}/${GRAPH_BACKUP}`
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink mb-1.5">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-ink-subtle mt-1 leading-5">{hint}</div> : null}
    </label>
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function vectorLabel(vector: Record<string, unknown> | null) {
  if (!vector) return '未探测'
  if (vector.ok) return `就绪${vector.via ? ` · ${String(vector.via)}` : ''}`
  return String(vector.detail || '未就绪')
}

const EMPTY_DRAFT = {
  pythonPath: '',
  startTimeoutMs: '180000',
  sessionEndRecord: false,
  sessionIngestIntervalMin: '30',
  peopleSyncUrl: '',
  peopleAccount: '',
  peoplePath: '',
  peopleIntervalSec: '0',
  peopleAllowPrivateNetwork: false,
  storeNeo4jUrl: '',
  storeNeo4jAccount: '',
  storeRdfUrl: '',
  storeRdfAccount: '',
  storeDatabricksUrl: '',
  storeDatabricksAccount: '',
  storeSnowflakeUrl: '',
  storeSnowflakeAccount: '',
}

export function SemanticSettings() {
  const workspace = useCurrentWorkspace()
  const workspaceCwd = workspace?.cwd || ''
  const kgPath = graphBackupPath(workspaceCwd)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [ready, setReady] = useState<Record<string, unknown> | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [probing, setProbing] = useState(false)
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null)
  const [deps, setDeps] = useState<Record<string, unknown> | null>(null)
  const [ingest, setIngest] = useState<Record<string, unknown> | null>(null)
  const [peopleText, setPeopleText] = useState('')
  const [peopleMsg, setPeopleMsg] = useState('')
  const [probeMsg, setProbeMsg] = useState('')

  const setField = (key: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const load = () => {
    void runtimeApi.memorySettings().then((data) => {
      const config = (data.config && typeof data.config === 'object' ? data.config : data) as Record<string, unknown>
      setDraft({
        pythonPath: String(config.pythonPath || ''),
        startTimeoutMs: String(config.startTimeoutMs || 180000),
        sessionEndRecord: Boolean(config.sessionEndRecord),
        sessionIngestIntervalMin: String(config.sessionIngestIntervalMin || 30),
        peopleSyncUrl: String(config.peopleSyncUrl || ''),
        peopleAccount: String(config.peopleAccount || ''),
        peoplePath: String(config.peoplePath || ''),
        peopleIntervalSec: String(config.peopleIntervalSec || 0),
        peopleAllowPrivateNetwork: Boolean(config.peopleAllowPrivateNetwork),
        storeNeo4jUrl: String(config.storeNeo4jUrl || ''),
        storeNeo4jAccount: String(config.storeNeo4jAccount || ''),
        storeRdfUrl: String(config.storeRdfUrl || ''),
        storeRdfAccount: String(config.storeRdfAccount || ''),
        storeDatabricksUrl: String(config.storeDatabricksUrl || ''),
        storeDatabricksAccount: String(config.storeDatabricksAccount || ''),
        storeSnowflakeUrl: String(config.storeSnowflakeUrl || ''),
        storeSnowflakeAccount: String(config.storeSnowflakeAccount || ''),
      })
      if (data.ready && typeof data.ready === 'object') setReady(data.ready as Record<string, unknown>)
    }).catch((cause) => setNote(cause instanceof Error ? cause.message : '读设置失败'))
    void runtimeApi.memoryReady().then(setReady).catch(() => undefined)
    void runtimeApi.memoryUsage().then(setUsage).catch(() => undefined)
    void runtimeApi.memoryDeps(workspaceCwd || undefined).then(setDeps).catch(() => setDeps(null))
  }

  useEffect(() => { load() }, [workspaceCwd])

  useEffect(() => {
    let alive = true
    const tick = () => {
      void runtimeApi.memoryIngestStatus().then((row) => { if (alive) setIngest(row) }).catch(() => undefined)
      void runtimeApi.memoryUsage().then((row) => { if (alive) setUsage(row) }).catch(() => undefined)
    }
    tick()
    const timer = window.setInterval(tick, 4000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const totals = asRecord(usage?.totals)
  const extract = asRecord(totals?.extract)
  const search = asRecord(totals?.search)
  const graph = asRecord(deps?.graph)
  const vector = asRecord(deps?.vector)
  const extractQueue = asRecord(ingest?.extract)

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0"><Brain size={16} /></div>
            <div>
              <div className="text-base font-medium">引擎状态</div>
              <div className="text-xs text-ink-muted mt-0.5">问答模型和钥匙跟 DSH 同一套，在「AI 核心」里配。这里不填密钥。</div>
            </div>
          </div>
          <Tag kind={ready?.ready ? 'green' : 'amber'}>{ready?.ready ? '就绪' : '未就绪'}</Tag>
        </div>
        {note && <div className="mb-3 text-xs text-ink-muted">{note}</div>}
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 text-xs text-ink-muted mb-4">
          <div>版本 <span className="text-ink">{String(ready?.version || '—')}</span></div>
          <div>Python <span className="text-ink break-all">{String(ready?.python || '—')}</span></div>
          <div>回环 <span className="text-ink">{ready?.port ? `127.0.0.1:${String(ready.port)}` : '—'}</span></div>
          <div>模型 <span className="text-ink">{[ready?.llmProvider, ready?.llmModel].filter(Boolean).join(' / ') || '未读到钥匙'}</span></div>
          <div>钥匙 <span className="text-ink">{ready?.llmReady ? '已配置（跟 DSH 模型）' : '未配置'}</span></div>
          <div>工作区 <span className="text-ink break-all">{workspace?.name || '—'}{workspaceCwd ? ` · ${workspaceCwd}` : ''}</span></div>
        </div>
        {totals ? (
          <div className="text-[11px] text-ink-subtle mb-4 space-y-0.5">
            <div>抽取 {Number(extract?.calls || 0)} 次 · {Number(extract?.total || 0)} tok（思考 {Number(extract?.reasoning || 0)}）</div>
            <div>检索 {Number(search?.calls || 0)} 次 · 回包 {Number(search?.bytes || 0)} 字节 · 进模型约 {Number(search?.context || 0)} tok</div>
          </div>
        ) : (
          <div className="text-[11px] text-ink-subtle mb-4">还没有用量记录。抽取和检索会记在这里。</div>
        )}
        {typeof ready?.doctor === 'string' && ready.doctor && (
          <pre className="text-[11px] bg-surface-2 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap mb-4">{ready.doctor}</pre>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={busy} onClick={load}>重新读取</button>
          <button type="button" className="btn" disabled={busy} onClick={() => {
            setBusy(true)
            void runtimeApi.memoryRetryReady().then((data) => {
              setReady(data)
              setNote(data.ready ? '已就绪' : String(data.detail || data.reason || '仍未就绪'))
            }).catch((cause) => setNote(cause instanceof Error ? cause.message : '再探失败')).finally(() => setBusy(false))
          }}><RefreshCw size={14} /> 再探就绪</button>
          <button type="button" className="btn" disabled={busy} onClick={() => {
            setBusy(true)
            setNote('正在重载核心…')
            void runtimeApi.reloadAi().then((status) => {
              setNote(status.connected ? '4318 与 DSH 已重载，正在读取引擎…' : '核心已停下')
              load()
            }).catch((cause) => setNote(cause instanceof Error ? cause.message : '重载失败')).finally(() => setBusy(false))
          }}>重载核心</button>
        </div>
      </Card>

      <Card>
        <div className="text-base font-medium mb-1">引擎与抽取</div>
        <div className="text-xs text-ink-muted mb-4">这些项会写入 semantic-os 配置，不含密钥。扫 DSH 会话文件里的聊天；文件没变就跳过。</div>
        <div className="space-y-3">
          <Field label="Python 路径" hint="空着就用 FDE-X 家目录里已经装好的语义引擎。">
            <input className="input w-full font-mono text-xs" value={draft.pythonPath} onChange={setField('pythonPath')} />
          </Field>
          <Field label="启动超时（毫秒）" hint="等引擎起来的最长时间。超时了点再探会换进程。">
            <input className="input w-full" value={draft.startTimeoutMs} onChange={setField('startTimeoutMs')} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={draft.sessionEndRecord} onChange={setField('sessionEndRecord')} />
            <span>会话归档时记一条决策草稿<div className="text-[11px] text-ink-subtle mt-0.5">默认关闭。关掉标签不算，不会自动过账。</div></span>
          </label>
          <Field label="会话抽取间隔（分钟）" hint="默认 30 分钟。不点这页也会跑。">
            <input className="input w-full" value={draft.sessionIngestIntervalMin} onChange={setField('sessionIngestIntervalMin')} />
          </Field>
          {extractQueue && (
            <div className="text-[11px] text-ink-subtle">
              后台抽取：待 {Number(extractQueue.pending || 0)} · 已处理 {Number(extractQueue.processed || 0)} · 抽取失败 {Number(extractQueue.failed || 0)} · 解析失败 {Number(extractQueue.parseFailed || 0)} · 进行中 {Number(extractQueue.active || 0)}
            </div>
          )}
          <button type="button" className="btn" onClick={() => {
            void runtimeApi.memoryIngestNow().then((data) => {
              setNote(data.started ? '已开始扫会话' : `抽取完成 ${String(data.ingested ?? '')}`)
              void runtimeApi.memoryIngestStatus().then(setIngest).catch(() => undefined)
            }).catch((cause) => setNote(cause instanceof Error ? cause.message : '抽取失败'))
          }}>立刻扫一轮会话</button>
        </div>
      </Card>

      <Card>
        <div className="text-base font-medium mb-1">图存储</div>
        <div className="text-xs text-ink-muted mb-3">图按当前顶栏工作区落盘。外部库可选，只填地址和账号名，不填密码。已装好的引擎不必再装。</div>
        <div className="text-xs text-ink-muted mb-2 space-y-1">
          <div>主账本 {graph ? (graph.ok ? '就绪' : '未就绪') : '未探测'}{graph?.via ? ` · ${String(graph.via)}` : ''}{graph?.detail ? ` · ${String(graph.detail)}` : ''}</div>
          <div>向量 {vectorLabel(vector)}</div>
          <div>文件备份 {kgPath ? `${workspace?.name || '当前工作区'} · ${kgPath}` : '当前工作区没有本机目录'}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button type="button" className="btn" disabled={probing || !workspaceCwd} onClick={() => {
            setProbing(true)
            setProbeMsg('正在探测…')
            void runtimeApi.memoryDeps(workspaceCwd).then((data) => {
              setDeps(data)
              const graphRow = asRecord(data.graph)
              setProbeMsg(graphRow?.ok ? '探测完成' : String(graphRow?.detail || data.detail || '未就绪'))
            }).catch((cause) => {
              setDeps(null)
              setProbeMsg(cause instanceof Error ? cause.message : '探测失败')
            }).finally(() => setProbing(false))
          }}>{probing ? '正在探测…' : '重新探测'}</button>
          {graph && !graph.ok && (
            <button type="button" className="btn" disabled={probing} onClick={() => {
              setProbing(true)
              setProbeMsg('正在补装缺失依赖…')
              void runtimeApi.memoryInstallDeps().then((data) => {
                setDeps(data)
                const graphRow = asRecord(data.graph)
                setProbeMsg(graphRow?.ok ? '依赖已补齐' : String(graphRow?.detail || data.detail || '补装未完成'))
              }).catch((cause) => setProbeMsg(cause instanceof Error ? cause.message : '补装失败')).finally(() => setProbing(false))
            }}>补装缺失依赖</button>
          )}
          {probeMsg && <span className="text-xs text-ink-muted">{probeMsg}</span>}
        </div>
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
          {([
            ['Neo4j', 'storeNeo4jUrl', 'storeNeo4jAccount'],
            ['RDF', 'storeRdfUrl', 'storeRdfAccount'],
            ['Databricks', 'storeDatabricksUrl', 'storeDatabricksAccount'],
            ['Snowflake', 'storeSnowflakeUrl', 'storeSnowflakeAccount'],
          ] as const).map(([label, urlKey, accountKey]) => (
            <div key={label} className="space-y-2 p-3 rounded-lg border border-line">
              <div className="text-xs font-medium">{label} · {(draft[urlKey] || draft[accountKey]) ? '已填' : '未配置'}</div>
              <input className="input w-full text-xs" placeholder="URL" value={String(draft[urlKey])} onChange={setField(urlKey)} />
              <input className="input w-full text-xs" placeholder="账号" value={String(draft[accountKey])} onChange={setField(accountKey)} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="text-base font-medium mb-1">人员同步</div>
        <div className="text-xs text-ink-muted mb-4">可选。用来把花名册写进图，不是 IM 配对。</div>
        <div className="space-y-3">
          <Field label="同步地址"><input className="input w-full font-mono text-xs" value={draft.peopleSyncUrl} onChange={setField('peopleSyncUrl')} /></Field>
          <Field label="账号"><input className="input w-full" value={draft.peopleAccount} onChange={setField('peopleAccount')} /></Field>
          <Field label="间隔（秒）" hint="0 表示不轮询。"><input className="input w-full" value={draft.peopleIntervalSec} onChange={setField('peopleIntervalSec')} /></Field>
          <Field label="花名册路径"><input className="input w-full font-mono text-xs" value={draft.peoplePath} onChange={setField('peoplePath')} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.peopleAllowPrivateNetwork} onChange={setField('peopleAllowPrivateNetwork')} />
            允许私网地址
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => {
              setPeopleMsg('')
              void runtimeApi.memoryPeople().then((data) => {
                const rows = Array.isArray(data.people) ? data.people as Array<Record<string, unknown>> : []
                setPeopleText(rows.map((row) => [row.id, row.displayName || row.name, row.status, row.businessAccount].filter(Boolean).join('\t')).join('\n'))
                setPeopleMsg(rows.length ? `${rows.length} 人` : '花名册是空的')
              }).catch((cause) => setPeopleMsg(cause instanceof Error ? cause.message : '读取失败'))
            }}>加载花名册</button>
            <button type="button" className="btn" onClick={() => {
              const people = peopleText.split(/\n/).map((line) => {
                const parts = line.split(/\t|\s*\|\s*/).map((item) => item.trim()).filter(Boolean)
                if (!parts.length) return null
                const status = (parts[2] === 'left' || parts[2] === 'active') ? parts[2] : 'active'
                const businessAccount = (parts[2] === 'left' || parts[2] === 'active') ? (parts[3] || '') : ''
                const displayName = parts[1] || parts[0]
                return { id: parts[0], displayName, name: displayName, status, businessAccount }
              }).filter(Boolean) as Array<Record<string, unknown>>
              setPeopleMsg('')
              void runtimeApi.saveMemoryPeople(people).then(() => setPeopleMsg('已保存花名册')).catch((cause) => setPeopleMsg(cause instanceof Error ? cause.message : '保存失败'))
            }}>保存花名册</button>
          </div>
          <textarea
            className="input w-full min-h-28 font-mono text-xs"
            placeholder="每行：id、显示名、active|left、业务账号，用 Tab 分隔"
            value={peopleText}
            onChange={(event) => setPeopleText(event.target.value)}
          />
          {peopleMsg && <div className="text-xs text-ink-muted">{peopleMsg}</div>}
        </div>
        <button
          type="button"
          className="btn-primary mt-4"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void runtimeApi.saveMemorySettings({
              pythonPath: draft.pythonPath,
              startTimeoutMs: Number(draft.startTimeoutMs),
              sessionEndRecord: draft.sessionEndRecord,
              sessionIngestIntervalMin: Number(draft.sessionIngestIntervalMin),
              peopleSyncUrl: draft.peopleSyncUrl,
              peopleAccount: draft.peopleAccount,
              peoplePath: draft.peoplePath,
              peopleIntervalSec: Number(draft.peopleIntervalSec),
              peopleAllowPrivateNetwork: draft.peopleAllowPrivateNetwork,
              storeNeo4jUrl: draft.storeNeo4jUrl,
              storeNeo4jAccount: draft.storeNeo4jAccount,
              storeRdfUrl: draft.storeRdfUrl,
              storeRdfAccount: draft.storeRdfAccount,
              storeDatabricksUrl: draft.storeDatabricksUrl,
              storeDatabricksAccount: draft.storeDatabricksAccount,
              storeSnowflakeUrl: draft.storeSnowflakeUrl,
              storeSnowflakeAccount: draft.storeSnowflakeAccount,
            }).then(() => setNote('已保存')).catch((cause) => setNote(cause instanceof Error ? cause.message : '保存失败')).finally(() => setBusy(false))
          }}
        >保存语义配置</button>
      </Card>
    </div>
  )
}
