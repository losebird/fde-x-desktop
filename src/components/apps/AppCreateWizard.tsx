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

  const generate = async () => {
    if (!description.trim()) return
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
        prompt: `需求：${description}\n请生成 fde-app/v1 spec 并调用 fde_app_spec_submit(requestId, spec)。titleField 必须是人能读的业务名（名称/标题），禁止用单号或自动编号填标题。按字段形状铺产品页：台账（有数字或日期、没有链接/文件字段）同一栏同时有 stats 概览、compose 记一笔、chart 图、feed 流水；资源条目（标题+说明，或链接/文件字段）必须用 cards，有 enum 就 groupBy，工作面按组铺卡片，卡片行动打开 URL（新窗口）或文件引用（文件模块），不要内嵌播放器。不要永远吐 table+form+kanban+stat 脚手架。uses 只声明真正要用的平台能力（ai/files/float/memory/im/briefing/biz），没接上的不要写。若返回 errors，修正后重新提交。不要写外部业务系统。禁止套固定品类模板。`,
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
