import { useEffect, useMemo, useState } from 'react'
import { SurfaceButton } from '@/components/surface/Button'
import { SurfaceGroup, SurfaceGroupRow } from '@/components/surface/Group'
import { openRef, revealAi, type OpenRefHref } from '@/lib/open-ref'

const STORAGE_KEY = 'fde-x-workstation-tour'

type TourStep = {
  id: string
  title: string
  body: string
  action?: { label: string; href?: OpenRefHref; reveal?: 'ai' | 'terminal' }
}

export const WORKSTATION_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: '欢迎使用 FDE-X',
    body: '这是本机工作台。中间是 AI 会话；顶栏打开早报、计划、IM、文件、业务应用、连接器、技能、记忆和设置。跟着下面几步点开每一面。',
  },
  {
    id: 'workspace',
    title: '工作区',
    body: '顶栏左侧切换工作区。每个工作区有自己的目录、会话和记忆。拍板、文件、终端都落在当前工作区。',
  },
  {
    id: 'ai',
    title: 'AI 会话',
    body: '中间是对话。确认后的拍板记成已生效先例，下一场能搜回来。缺词表字段跳过业务引用，不挡落板。',
    action: { label: '回到会话', reveal: 'ai' },
  },
  {
    id: 'briefing',
    title: '早报',
    body: '今日三件事、日程、邮件和 AI 摘要。点生成会先采集，再写出摘要。',
    action: { label: '打开早报', href: { panel: 'briefing' } },
  },
  {
    id: 'plan',
    title: '计划',
    body: '待办、日程、工作流。日、周、月可以翻页。任务完成会走系统通知。',
    action: { label: '打开计划', href: { panel: 'plan', tab: 'todo' } },
  },
  {
    id: 'im',
    title: 'IM',
    body: '联系人和话题群。未读进铃铛；工作日早上可以静音。',
    action: { label: '打开 IM', href: { panel: 'im' } },
  },
  {
    id: 'files',
    title: '文件',
    body: '当前工作区的目录。上传、新建文件夹、搜索，再发给这一场 AI。',
    action: { label: '打开文件', href: { panel: 'files' } },
  },
  {
    id: 'terminal',
    title: '终端',
    body: '终端是 AI 页上的附件，不是新的顶栏。点打开会在当前会话拉起命令行。',
    action: { label: '打开终端', reveal: 'terminal' },
  },
  {
    id: 'data',
    title: '业务应用',
    body: '共享应用和过账。创建应用、待审批、系统连接都在这里。',
    action: { label: '打开业务应用', href: { panel: 'data' } },
  },
  {
    id: 'mcp',
    title: '连接器',
    body: 'MCP 工具和业务连接器。连上的工具给会话里调用。',
    action: { label: '打开连接器', href: { panel: 'mcp' } },
  },
  {
    id: 'skills',
    title: '技能',
    body: '安装和使用技能。会话按技能说明做事。',
    action: { label: '打开技能', href: { panel: 'skills' } },
  },
  {
    id: 'memory',
    title: '记忆',
    body: '蒸馏卡、档案、已入档规则。续场会把规则和先例带回来。',
    action: { label: '打开记忆', href: { panel: 'memory' } },
  },
  {
    id: 'settings',
    title: '其余设置',
    body: '外观、通知、快捷键、AI 核心、语义记忆、运行环境、存储。表单由本机核心生成。',
    action: { label: '打开外观', href: { panel: 'settings', section: 'appearance' } },
  },
  {
    id: 'done',
    title: '可以开工了',
    body: '顶栏随时回到任何一面。拍板记先例，早报看今天，记忆里查已入档。',
  },
]

type TourState = { index: number; done: string[] }

function loadTour(): TourState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Partial<TourState>
    const index = Number(raw.index)
    const done = Array.isArray(raw.done) ? raw.done.map(String) : []
    return {
      index: Number.isInteger(index) && index >= 0 && index < WORKSTATION_TOUR_STEPS.length ? index : 0,
      done,
    }
  } catch {
    return { index: 0, done: [] }
  }
}

function saveTour(state: TourState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function runStepAction(step: TourStep) {
  if (!step.action) return
  if (step.action.reveal === 'terminal') {
    revealAi('', 'terminal')
    return
  }
  if (step.action.reveal === 'ai') {
    revealAi()
    return
  }
  if (step.action.href) openRef(step.action.href)
}

export function isWorkstationTourFinished(state: TourState = typeof window === 'undefined' ? { index: 0, done: [] } : loadTour()) {
  return state.done.includes('done') || state.done.includes('skipped')
}

function TourBody({
  state,
  onCommit,
  onSkip,
}: {
  state: TourState
  onCommit: (next: TourState) => void
  onSkip?: () => void
}) {
  const step = WORKSTATION_TOUR_STEPS[state.index] || WORKSTATION_TOUR_STEPS[0]
  const finished = state.done.includes('done') && state.index === WORKSTATION_TOUR_STEPS.length - 1
  const progress = useMemo(() => Math.round(((state.index + 1) / WORKSTATION_TOUR_STEPS.length) * 100), [state.index])
  function mark(id: string, index: number) {
    const done = state.done.includes(id) ? state.done : [...state.done, id]
    onCommit({ index, done })
  }

  return (
    <div>
      <SurfaceGroupRow>
        <div className="h-1 overflow-hidden rounded-full bg-kit-sunken" aria-hidden="true">
          <div className="h-full rounded-full bg-kit-brand" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 text-[15px] font-semibold tracking-tight text-kit-ink">{step.title}</div>
        <p className="mt-2 text-kit-sm leading-6 text-kit-secondary">{step.body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {step.action ? (
            <SurfaceButton
              variant="primary"
              onClick={() => {
                runStepAction(step)
                mark(step.id, state.index)
              }}
            >
              {step.action.label}
            </SurfaceButton>
          ) : null}
          {state.index > 0 ? (
            <SurfaceButton onClick={() => onCommit({ ...state, index: state.index - 1 })}>上一步</SurfaceButton>
          ) : null}
          {state.index < WORKSTATION_TOUR_STEPS.length - 1 ? (
            <SurfaceButton
              variant={step.action ? 'quiet' : 'primary'}
              onClick={() => mark(step.id, state.index + 1)}
            >
              下一步
            </SurfaceButton>
          ) : (
            <SurfaceButton
              variant="primary"
              onClick={() => {
                if (finished) onCommit({ index: 0, done: [] })
                else mark('done', state.index)
              }}
            >
              {finished ? '再走一遍' : '完成'}
            </SurfaceButton>
          )}
          {onSkip ? (
            <SurfaceButton variant="ghost" onClick={onSkip}>跳过</SurfaceButton>
          ) : null}
        </div>
      </SurfaceGroupRow>
    </div>
  )
}

export function WorkstationTourGate() {
  const [state, setState] = useState<TourState>(() => (typeof window === 'undefined' ? { index: 0, done: [] } : loadTour()))
  const [forced, setForced] = useState(false)
  const visible = forced || !isWorkstationTourFinished(state)

  function commit(next: TourState) {
    saveTour(next)
    setState(next)
    if (next.done.includes('done') || next.done.includes('skipped')) setForced(false)
  }

  useEffect(() => {
    const replay = () => {
      const fresh = { index: 0, done: [] as string[] }
      saveTour(fresh)
      setState(fresh)
      setForced(true)
    }
    window.addEventListener('fde-x-tour-open', replay)
    return () => window.removeEventListener('fde-x-tour-open', replay)
  }, [])

  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3">
      <div className="pointer-events-auto w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-kit-lg border border-kit-line bg-kit-card shadow-kit-pop">
        <div className="border-b border-kit-line px-4 py-2 text-kit-sm font-medium text-kit-ink">
          工作台向导 · {state.index + 1} / {WORKSTATION_TOUR_STEPS.length}
        </div>
        <TourBody
          state={state}
          onCommit={commit}
          onSkip={() => commit({ ...state, done: [...state.done, 'skipped'] })}
        />
      </div>
    </div>
  )
}
