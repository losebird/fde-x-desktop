import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AppRuntime } from '@/components/apps/AppRuntime'
import { askAiForResult } from '@/lib/ask-ai'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { type FdeAppDetail } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  workspaceId: string
  onCreated: (appId?: string) => void
  onClose: () => void
}

export function AppCreateWizard({ onCreated, onClose }: Props) {
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
    const result = await askAiForResult<{ appId: string; revision: number }>({
      intent: '创建业务应用',
      preset,
      title: `应用构建 · ${description.slice(0, 20)}`,
      context: ['workspace', 'apps', 'biz'],
      prompt: `需求：${description}\n请生成 fde-app/v1 spec 并调用 fde_app_spec_submit(requestId, spec)。若返回 errors，修正后重新提交。不要写外部业务系统。`,
      schema: { type: 'object', required: ['appId', 'revision'] },
      timeoutMs: 120_000,
    })
    if (!result.ok) {
      setError(result.error === 'timeout' ? '生成超时，可在左侧会话里看 AI 说了什么，或改描述再试。' : result.error)
      setStep('describe')
      return
    }
    await loadApp(result.data.appId)
    onCreated(result.data.appId)
  }

  return (
    <div className="px-4 py-3 border-b border-line bg-surface-2 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">AI 创建应用</div>
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
              placeholder="要一张什么表、有哪些字段、状态有哪几种"
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
          <Loader2 size={14} className="animate-spin" /> 生成中…
        </div>
      )}
      {step === 'preview' && appDetail && (
        <>
          {error && <div className="text-xs text-accent-red">{error}</div>}
          <AppRuntime
            app={appDetail}
            workspaceCwd={workspaceCwd}
            previewMode={appDetail.status !== 'active'}
            onChanged={() => {
              void loadApp(appDetail.id)
              onCreated(appDetail.id)
            }}
          />
        </>
      )}
    </div>
  )
}
