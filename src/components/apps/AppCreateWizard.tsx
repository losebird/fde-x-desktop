import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AppRuntime } from '@/components/apps/AppRuntime'
import { askAiForResult } from '@/lib/ask-ai'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { isFdeAppSpec, type FdeAppDetail, type FdeAppSkillBind } from '@/lib/app-spec'
import { appBuilderPrompt } from '@/lib/app-builder-prompt'
import { currentAiTarget } from '@/lib/ai-target'
import type { JsonSchemaLite } from '@/lib/json-schema-lite'
import { runtimeApi, type BusinessConnectionRecord, type SkillBagItem } from '@/lib/runtime-api'
import { SkillBagPicker } from '@/components/biz/SkillBagPicker'
import { ContextChips } from '@/components/ai/ContextChips'
import { buildContextPack, type ContextPack } from '@/lib/context-pack'

type DraftDefinitionPreview = {
  screens: string[]
  dataSources: string[]
  permissions: string[]
}

type Props = {
  workspaceId: string
  connections?: BusinessConnectionRecord[]
  onDraftReady?: (appId: string, hint?: string) => void
  onDefinitionPreview?: (appId: string, definition: DraftDefinitionPreview) => void
  onActivated: (appId: string) => void
  onClose: () => void
}

const DRAFT_DEFINITION_SCHEMA: JsonSchemaLite = {
  type: 'object',
  required: ['screens'],
  properties: {
    screens: { type: 'array', items: { type: 'string' } },
    dataSources: { type: 'array', items: { type: 'string' } },
    permissions: { type: 'array', items: { type: 'string' } },
  },
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => String(row || '').trim()).filter(Boolean)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function AppCreateWizard({ workspaceId, connections = [], onDraftReady, onDefinitionPreview, onActivated, onClose }: Props) {
  const [step, setStep] = useState<'describe' | 'generating' | 'preview'>('describe')
  const [aiReady, setAiReady] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dataConnect, setDataConnect] = useState<'local' | 'modules'>('local')
  const [connectBriefing, setConnectBriefing] = useState(false)
  const [connectBiz, setConnectBiz] = useState(false)
  const [connectFiles, setConnectFiles] = useState(false)
  const [preset, setPreset] = useState('fde-app-builder')
  const [error, setError] = useState('')
  const [appDetail, setAppDetail] = useState<FdeAppDetail | null>(null)
  const [workspaceCwd, setWorkspaceCwd] = useState('')
  const [skillBag, setSkillBag] = useState<SkillBagItem[]>([])
  const [pickedSkills, setPickedSkills] = useState<FdeAppSkillBind[]>([])
  const [bizSystems, setBizSystems] = useState<Array<Record<string, unknown>>>([])
  const [bizTarget, setBizTarget] = useState('lookup')
  const [ctxPack, setCtxPack] = useState<ContextPack | null>(null)
  const [ctxWarnings, setCtxWarnings] = useState<string[]>([])
  const [ctxOmit, setCtxOmit] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    void runtimeApi.health().then((h) => setAiReady(h.state === 'healthy')).catch(() => setAiReady(false))
    void (async () => {
      const target = await currentAiTarget().catch(() => ({ ok: false as const, error: '' }))
      const [listed, systems] = await Promise.all([
        runtimeApi.listAiSkills(target.ok ? target.sessionId : undefined).catch(() => ({ items: [] as SkillBagItem[] })),
        runtimeApi.getBizSystems().catch(() => ({ systems: [] as Array<Record<string, unknown>> })),
      ])
      setSkillBag(listed.items.filter((row) => row.path && row.path.startsWith('/')))
      setBizSystems(systems.systems)
    })()
  }, [])

  const toggleOmit = (key: string) => {
    setCtxOmit((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    if (step !== 'describe' && step !== 'generating') return
    let cancelled = false
    void buildContextPack({
      scopes: ['workspace', 'apps'],
      query: '创建业务应用',
      intentKind: 'lookup',
    }).then((packed) => {
      if (cancelled) return
      setCtxPack(packed.pack)
      setCtxWarnings(packed.warnings || [])
    }).catch(() => {
      if (cancelled) return
      setCtxPack(null)
      setCtxWarnings([])
    })
    return () => { cancelled = true }
  }, [step])

  const loadApp = async (appId: string) => {
    const data = await runtimeApi.getDeclarativeApp(appId)
    setAppDetail(data)
    setStep('preview')
    return data
  }

  const waitForNewDraft = async (knownIds: Set<string>, until: number) => {
    while (Date.now() < until) {
      await sleep(1500)
      const apps = await runtimeApi.listBusinessApps(workspaceId).catch(() => [])
      const fresh = apps.find((app) => !knownIds.has(app.id) && app.status === 'draft' && (isFdeAppSpec(app.definition) || app.appKind === 'generated'))
      if (fresh) return fresh.id
    }
    return ''
  }

  const buildDataPlacementHint = () => {
    if (dataConnect === 'local') {
      return '数据放哪：本地 SQLite 台账。source.type=local。不要默认铺满 uses，没点名的能力不要写进 uses。'
    }
    const parts: string[] = ['数据放哪：接平台模块（非纯本地）。']
    if (connectBriefing) parts.push('接邮箱 → uses 须含 briefing，禁止假 Gmail/假收件箱。')
    if (connectBiz) parts.push(`接业务系统 → uses 须含 biz，source=${bizTarget === 'lookup' ? '{type:lookup}' : `{type:system,systemId:${bizTarget}}`}，禁止假外部接口。`)
    if (connectFiles) parts.push('接文件 → uses 须含 files，走文件模块。')
    if (pickedSkills.length) {
      parts.push(`skills 只允许这些包：${pickedSkills.map((row) => `${row.name}@${row.path}`).join('、')}`)
    }
    parts.push('仅当需求点名时才写 ai/float/memory/im/plan；摘成待办必须 uses 含 plan。')
    return parts.join(' ')
  }

  const createEmptyDraft = async () => {
    const title = name.trim()
    const goal = description.trim()
    if (!title) return
    setError('')
    try {
      const created = await runtimeApi.createBusinessApp({
        workspaceId,
        name: title,
        definition: {
          kind: 'ai-generated-draft',
          goal,
          screens: [],
          dataSources: [],
          permissions: [],
        },
        changeNote: '创建草稿',
      })
      const target = await currentAiTarget()
      if (!target.ok) {
        onDraftReady?.(created.id, `${target.error}。已建空草稿，去 AI 确认后再填屏幕。`)
        return
      }
      const connectorLines = connections.length
        ? connections.map((row) => `${row.id} ${row.name}`.trim()).join('\n')
        : '无'
      const result = await askAiForResult<DraftDefinitionPreview>({
        intent: '填写应用草稿 definition',
        prompt: [
          `工作区：${target.cwd}`,
          `目标：${goal || title}`,
          '已有连接器：',
          connectorLines,
          '请给出 screens（屏幕名列表）、dataSources（连接器 id）、permissions（权限说明）。禁止过账。',
        ].join('\n'),
        schema: DRAFT_DEFINITION_SCHEMA,
        context: ['workspace', 'apps'],
      })
      if (result.ok) {
        onDefinitionPreview?.(created.id, {
          screens: stringList(result.data.screens),
          dataSources: stringList(result.data.dataSources),
          permissions: stringList(result.data.permissions),
        })
      }
      onDraftReady?.(
        created.id,
        result.ok
          ? ''
          : (result.error === 'timeout'
            ? '当前会话还没确认 definition。空草稿已在列表，可点开预览。'
            : result.error),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '没建成草稿')
    }
  }

  const generate = async () => {
    if (!description.trim()) return
    if (dataConnect === 'modules' && !connectBriefing && !connectBiz && !connectFiles) {
      setError('接邮箱/业务系统/文件时，请至少勾选一项。')
      return
    }
    setStep('generating')
    setError('')
    const cwd = loadCurrentWorkspaceCwd()
    if (!cwd.ok) {
      setError(cwd.error)
      setStep('describe')
      return
    }
    setWorkspaceCwd(cwd.cwd)
    const knownIds = new Set((await runtimeApi.listBusinessApps(workspaceId).catch(() => [])).map((app) => app.id))
    const deadline = Date.now() + 240_000
    let settled = false
    const appId = await new Promise<string>((resolve) => {
      const finish = (id: string) => {
        if (settled) return
        settled = true
        resolve(id)
      }
      const timer = window.setTimeout(() => {
        void waitForNewDraft(knownIds, Date.now() + 4000).then((id) => finish(id))
      }, Math.max(0, deadline - Date.now()))
      void askAiForResult<{ appId: string; revision: number }>({
        intent: '创建业务应用',
        preset,
        title: `应用构建 · ${description.slice(0, 20)}`,
        context: ['workspace', 'apps'],
        omit: ctxOmit,
        pack: ctxPack || undefined,
        warnings: ctxWarnings,
        prompt: appBuilderPrompt({
          mode: 'create',
          description,
          dataHint: buildDataPlacementHint(),
        }),
        schema: { type: 'object', required: ['appId', 'revision'] },
        timeoutMs: 240_000,
      }).then((result) => {
        if (result.ok) {
          clearTimeout(timer)
          finish(result.data.appId)
        }
      })
      void waitForNewDraft(knownIds, deadline).then((id) => {
        if (id) {
          clearTimeout(timer)
          finish(id)
        }
      })
    })
    if (!appId) {
      setError('生成超时。改描述再试；左栏会话只是生成过程，创建要在这一页完成。')
      setStep('describe')
      return
    }
    const data = await loadApp(appId)
    if (data && isFdeAppSpec(data.spec)) {
      const source = dataConnect === 'local' || !connectBiz
        ? { type: 'local' as const }
        : bizTarget === 'lookup'
          ? { type: 'lookup' as const }
          : { type: 'system' as const, systemId: bizTarget }
      const next = {
        ...data.spec,
        source,
        ...(pickedSkills.length ? { skills: pickedSkills } : {}),
      }
      await runtimeApi.putDeclarativeAppSpec(data.id, { spec: next, changeNote: '绑定业务源与 skills' }).catch(() => undefined)
      const fresh = await loadApp(appId)
      onDraftReady?.(fresh.id)
      return
    }
    onDraftReady?.(data.id)
  }

  const afterPreviewChange = async () => {
    if (!appDetail) return
    const data = await loadApp(appDetail.id)
    if (data.status === 'active') onActivated(data.id)
    else onDraftReady?.(data.id)
  }

  return (
    <div className="px-4 py-3 border-b border-line bg-surface-2 space-y-3" data-app-create-wizard={step}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">创建应用</div>
          <div className="text-xs text-ink-muted mt-0.5">这里没有官方台账。写下对象、字段和要看的栏目（概览、记一笔、卡片栅格、流水），生成你自己的应用。</div>
        </div>
        <button type="button" className="btn h-7" onClick={onClose}>关闭</button>
      </div>
      {step === 'describe' && (
        <>
          <label className="block text-xs text-ink-muted">
            名称
            <input
              className="input mt-1 w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="应用名称"
            />
          </label>
          <label className="block text-xs text-ink-muted">
            目标
            <textarea
              className="input mt-1 w-full"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="有哪些对象和字段，要哪些栏目，概览、记一笔、卡片栅格或流水"
            />
          </label>
          <fieldset className="space-y-2 text-xs text-ink-muted" data-app-create-connect={dataConnect}>
            <div className="font-medium text-ink">数据放哪</div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="data-connect"
                checked={dataConnect === 'local'}
                onChange={() => setDataConnect('local')}
              />
              本地台账
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="data-connect"
                checked={dataConnect === 'modules'}
                onChange={() => setDataConnect('modules')}
              />
              接邮箱/业务系统/文件
            </label>
            {dataConnect === 'modules' && (
              <div className="ml-5 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={connectBriefing} onChange={(e) => setConnectBriefing(e.target.checked)} />
                  邮箱（走早报，不编收件箱）
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={connectBiz} onChange={(e) => setConnectBiz(e.target.checked)} />
                  业务系统（走过账闸，不编假接口）
                </label>
                {connectBiz && (
                  <select className="input h-7 text-xs" value={bizTarget} onChange={(event) => setBizTarget(event.target.value)}>
                    <option value="lookup">lookup 现账</option>
                    {bizSystems.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={connectFiles} onChange={(e) => setConnectFiles(e.target.checked)} />
                  文件（走文件模块）
                </label>
              </div>
            )}
          </fieldset>
          {skillBag.length > 0 && (
            <SkillBagPicker skills={skillBag} value={pickedSkills} onChange={setPickedSkills} label="本应用 Skills" />
          )}
          <label className="block text-xs text-ink-muted">
            Preset
            <input className="input mt-1 w-full" value={preset} onChange={(e) => setPreset(e.target.value)} />
          </label>
          {error && <div className="text-xs text-accent-red">{error}</div>}
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className="btn h-8" disabled={!name.trim()} onClick={() => void createEmptyDraft()}>
              创建草稿
            </button>
            <button type="button" className="btn-brand h-8" disabled={!aiReady || !description.trim()} onClick={() => void generate()}>
              {!aiReady ? '请先连接 AI 核心' : '生成'}
            </button>
            <ContextChips
              pack={ctxPack}
              warnings={ctxWarnings}
              omit={ctxOmit}
              onToggleOmit={toggleOmit}
            />
          </div>
        </>
      )}
      {step === 'generating' && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={14} className="animate-spin" /> 正在生成 spec。预览会留在这一页，不必去左栏聊天里完成。
          <ContextChips
            pack={ctxPack}
            warnings={ctxWarnings}
            omit={ctxOmit}
            onToggleOmit={toggleOmit}
          />
        </div>
      )}
      {step === 'preview' && appDetail && (
        <>
          <div>
            <div className="text-sm font-medium">预览 · {appDetail.spec.name || appDetail.name}</div>
            <div className="text-xs text-ink-muted mt-0.5">确认 spec 后采纳并激活，进入这个应用的工作面。</div>
          </div>
          {error && <div className="text-xs text-accent-red">{error}</div>}
          {appDetail.status !== 'active' && (
            <div className="text-xs text-ink-muted" data-app-preview-sample="true">
              预览里的行是示例，不是已经有的业务数据。
            </div>
          )}
          <AppRuntime
            app={appDetail}
            workspaceCwd={workspaceCwd}
            previewMode={appDetail.status !== 'active'}
            onChanged={() => { void afterPreviewChange() }}
          />
        </>
      )}
    </div>
  )
}
