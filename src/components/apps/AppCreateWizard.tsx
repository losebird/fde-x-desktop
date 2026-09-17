import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AppRuntime } from '@/components/apps/AppRuntime'
import { askAiForResult } from '@/lib/ask-ai'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { type FdeAppDetail } from '@/lib/app-spec'
import type { JsonValue } from '@/lib/contracts'
import { runtimeApi } from '@/lib/runtime-api'

const FIXTURE_SPEC = {
  spec: 'fde-app/v1',
  slug: 'supplier-visits',
  name: '供应商拜访台账',
  description: '记录供应商拜访计划与跟进',
  entities: [{
    name: 'visit',
    label: '拜访记录',
    titleField: 'summary',
    fields: [
      { name: 'supplier', label: '供应商', type: 'text', required: true },
      { name: 'visit_date', label: '日期', type: 'date', required: true },
      { name: 'summary', label: '摘要', type: 'longtext' },
      { name: 'status', label: '状态', type: 'enum', required: true, options: ['计划', '已拜访', '需跟进'] },
    ],
  }],
  views: [
    { id: 'table-main', type: 'table', entity: 'visit', label: '列表', columns: ['supplier', 'visit_date', 'summary', 'status'], filters: ['status'] },
    { id: 'form-main', type: 'form', entity: 'visit', label: '新建' },
    { id: 'kanban-main', type: 'kanban', entity: 'visit', label: '看板', groupBy: 'status' },
  ],
  actions: [{ name: 'mark-follow', label: '标记跟进', entity: 'visit', kind: 'set', set: { status: '需跟进' } }],
}

type Props = {
  workspaceId: string
  onCreated: () => void
  onClose: () => void
}

export function AppCreateWizard({ workspaceId, onCreated, onClose }: Props) {
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

  const submitSpec = async (spec: JsonValue) => {
    setError('')
    const cwd = await loadCurrentWorkspaceCwd()
    if (!cwd.ok) {
      setError(cwd.error)
      return
    }
    setWorkspaceCwd(cwd.cwd)
    const created = await runtimeApi.createDeclarativeApp({
      workspaceCwd: cwd.cwd,
      workspaceId,
      spec,
    })
    if (!created.ok || !created.data) {
      setError(created.errors?.map((e) => `${e.path}: ${e.message}`).join('；') || '校验失败')
      return
    }
    await loadApp(created.data.appId)
    onCreated()
  }

  const generate = async () => {
    if (!description.trim()) return
    setStep('generating')
    setError('')
    const cwd = await loadCurrentWorkspaceCwd()
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
      prompt: `需求：${description}\n请生成 fde-app/v1 spec 并调用 fde_app_spec_submit(requestId, spec)。若返回 errors，修正后重新提交。`,
      schema: { type: 'object', required: ['appId', 'revision'] },
      timeoutMs: 120_000,
    })
    if (!result.ok) {
      setError(`${result.error}。可改用验收样例继续。`)
      setStep('describe')
      return
    }
    await loadApp(result.data.appId)
    onCreated()
  }

  const useFixture = async () => {
    setStep('generating')
    await submitSpec(FIXTURE_SPEC as unknown as JsonValue)
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
            <textarea className="input mt-1 w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="供应商拜访台账：供应商、日期、摘要、状态（计划/已拜访/需跟进）" />
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
            <button type="button" className="btn h-8" onClick={() => void useFixture()}>使用验收样例</button>
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
          <AppRuntime app={appDetail} workspaceCwd={workspaceCwd} previewMode onChanged={() => void loadApp(appDetail.id)} />
        </>
      )}
    </div>
  )
}
