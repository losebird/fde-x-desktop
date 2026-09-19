import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AppRuntime } from '@/components/apps/AppRuntime'
import { askAiForResult } from '@/lib/ask-ai'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { isFdeAppSpec, type FdeAppDetail } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  workspaceId: string
  onDraftReady?: (appId: string) => void
  onActivated: (appId: string) => void
  onClose: () => void
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function AppCreateWizard({ workspaceId, onDraftReady, onActivated, onClose }: Props) {
  const [step, setStep] = useState<'describe' | 'generating' | 'preview'>('describe')
  const [aiReady, setAiReady] = useState(false)
  const [description, setDescription] = useState('')
  const [dataConnect, setDataConnect] = useState<'local' | 'modules'>('local')
  const [connectBriefing, setConnectBriefing] = useState(false)
  const [connectBiz, setConnectBiz] = useState(false)
  const [connectFiles, setConnectFiles] = useState(false)
  const [preset, setPreset] = useState('fde-app-builder')
  const [error, setError] = useState('')
  const [appDetail, setAppDetail] = useState<FdeAppDetail | null>(null)
  const [workspaceCwd, setWorkspaceCwd] = useState('')

  useEffect(() => {
    void runtimeApi.health().then((h) => setAiReady(h.state === 'healthy')).catch(() => setAiReady(false))
  }, [])

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
      const fresh = apps.find((app) => !knownIds.has(app.id) && app.status === 'draft' && isFdeAppSpec(app.definition))
      if (fresh) return fresh.id
    }
    return ''
  }

  const buildDataPlacementHint = () => {
    if (dataConnect === 'local') {
      return '数据放哪：本地 SQLite 台账。不要默认铺满 uses，没点名的能力不要写进 uses。'
    }
    const parts: string[] = ['数据放哪：接平台模块（非纯本地）。']
    if (connectBriefing) parts.push('接邮箱 → uses 须含 briefing，禁止假 Gmail/假收件箱。')
    if (connectBiz) parts.push('接业务系统 → uses 须含 biz，禁止假外部接口。')
    if (connectFiles) parts.push('接文件 → uses 须含 files，走文件模块。')
    parts.push('仅当需求点名时才写 ai/float/memory/im/plan；摘成待办必须 uses 含 plan。')
    return parts.join(' ')
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
      const timer = window.setTimeout(() => finish(''), Math.max(0, deadline - Date.now()))
      void askAiForResult<{ appId: string; revision: number }>({
        intent: '创建业务应用',
        preset,
        title: `应用构建 · ${description.slice(0, 20)}`,
        context: ['workspace', 'apps'],
        prompt: `需求：${description}\n${buildDataPlacementHint()}\n请生成 fde-app/v1 spec 并调用 fde_app_spec_submit(requestId, spec)。每个对象单独一栏 pages；有链接/视频字段 → 分组 cards + compose，行动打开或播放；有数字或日期台账 → 同一栏 stats+compose+chart+feed。不要永远同一套脚手架换列名。titleField 必须是人能读的业务名（名称/标题），禁止用单号或自动编号填标题。uses 只声明真正要用的平台能力：问数/起草写 ai，并排用写 float，稿和附件走文件模块写 files，动作只起草记忆卡片写 memory，拟回进 IM 输入框写 im，早报/MCP 源写 briefing，引用业务对象并预览确认写 biz，摘成待办写 plan（须能写入 plan 任务）。没接到的不要写，前端不会画假按钮。若返回 errors，修正后重新提交。不要写外部业务系统除非用户已接业务。禁止套固定品类模板。`,
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
            描述需求
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={connectFiles} onChange={(e) => setConnectFiles(e.target.checked)} />
                  文件（走文件模块）
                </label>
              </div>
            )}
          </fieldset>
          <label className="block text-xs text-ink-muted">
            Preset
            <input className="input mt-1 w-full" value={preset} onChange={(e) => setPreset(e.target.value)} />
          </label>
          {error && <div className="text-xs text-accent-red">{error}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-brand h-8" disabled={!aiReady || !description.trim()} onClick={() => void generate()}>
              {!aiReady ? '请先连接 AI 核心' : '生成'}
            </button>
          </div>
        </>
      )}
      {step === 'generating' && (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 size={14} className="animate-spin" /> 正在生成 spec。预览会留在这一页，不必去左栏聊天里完成。
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
