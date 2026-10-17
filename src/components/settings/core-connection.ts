import { useEffect, useRef, useState } from 'react'
import { runtimeApi, type AiRuntimeStatus, type IuiStatus } from '@/lib/runtime-api'

const WATCH_MS = 400
const STARTING_STATES = new Set(['starting', 'connecting'])
const IUI_PHASE_LABEL: Record<string, string> = {
  stage: '校验归档',
  link: '写入配置',
  boot: '等待核心',
  enable: '确认启用',
}

type CoreListener = (status: AiRuntimeStatus) => void

const listeners = new Set<CoreListener>()
let watchTimer = 0
let watchGeneration = 0
let watching = false

export type CoreBootGuidance = {
  kind: 'starting' | 'installing' | 'failed' | 'iui-failed' | 'verify_failed' | 'down' | 'ready'
  text: string
}

function requiredIuiText(value: unknown, label: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(label)
  return value
}

/** Status line from data.iui. Missing contract fields throw; they are not filled in. */
export function iuiStatusLine(iui: IuiStatus) {
  if (iui.state === 'installing') {
    const label = IUI_PHASE_LABEL[iui.phase]
    if (!label) throw new Error(`IUI installing has unknown phase ${iui.phase}`)
    const completed = iui.progress.completed
    const total = iui.progress.total
    if (!Number.isInteger(completed) || !Number.isInteger(total) || total < 1) {
      throw new Error('IUI installing is missing progress')
    }
    return `正在首次安装… ${label} ${completed}/${total}`
  }
  if (iui.state === 'failed') {
    return `IUI 安装失败：${requiredIuiText(iui.reason, 'IUI failed is missing reason')}。请重试。`
  }
  if (iui.state === 'verify_failed') {
    const artifactPath = requiredIuiText(iui.artifactPath, 'IUI verify_failed is missing artifactPath')
    const expected = requiredIuiText(iui.expected, 'IUI verify_failed is missing expected')
    const actual = requiredIuiText(iui.actual, 'IUI verify_failed is missing actual')
    const command = requiredIuiText(iui.command, 'IUI verify_failed is missing command')
    return `IUI 校验失败。归档 ${artifactPath}。期望 ${expected}，实际 ${actual}。用 Node 26.7.0 与 pnpm 11.20.0 重新打包：${command}`
  }
  if (iui.state === 'enabled') {
    return `IUI ${requiredIuiText(iui.version, 'IUI enabled is missing version')} · 已启用（标准对话）`
  }
  if (iui.state === 'installed') {
    return `IUI ${requiredIuiText(iui.version, 'IUI installed is missing version')} 未启用`
  }
  if (iui.state === 'absent') return 'IUI 未安装'
  throw new Error('IUI has unknown state')
}

const FAILED_COPY = '本地核心还没接通。请重新执行 `pnpm dev`；本机第二套请用 `pnpm run dev:peer`。'

function processGone(status: AiRuntimeStatus | null | undefined) {
  return status?.pid == null
}

function timedOut(status: AiRuntimeStatus | null | undefined) {
  return /超时|未完成启动|timeout/i.test(String(status?.lastError || ''))
}

/** Starting is not a core failure. An installing IUI record replaces that sentence. */
export function coreBootGuidance(status: AiRuntimeStatus | null | undefined): CoreBootGuidance {
  const iui = status?.iui
  if (iui?.state === 'installing') return { kind: 'installing', text: iuiStatusLine(iui) }
  if (iui?.state === 'failed') return { kind: 'iui-failed', text: iuiStatusLine(iui) }
  if (iui?.state === 'verify_failed') return { kind: 'verify_failed', text: iuiStatusLine(iui) }
  if (status?.connected || status?.state === 'connected') return { kind: 'ready', text: '' }
  const state = String(status?.state || '')
  const failed = state === 'error' || state === 'failed'
    || (timedOut(status) && processGone(status))
    || (Boolean(status?.lastError) && processGone(status) && !STARTING_STATES.has(state) && state !== 'idle' && state !== '')
  if (failed) return { kind: 'failed', text: FAILED_COPY }
  if (STARTING_STATES.has(state)) {
    const bits: string[] = []
    if (status?.version) bits.push(status.version)
    if (status?.pid) bits.push(`进程 ${status.pid}`)
    const log = (status?.recentLogs || []).map((line) => line.trim()).filter(Boolean).at(-1)
    if (log && log.length <= 80) bits.push(log)
    const progress = bits.join(' · ')
    return { kind: 'starting', text: progress ? `正在首次启动… ${progress}` : '正在首次启动…' }
  }
  if (iui && iui.state !== 'absent') return { kind: 'down', text: iuiStatusLine(iui) }
  return { kind: 'down', text: '' }
}

function stopWatch() {
  watchGeneration += 1
  watching = false
  window.clearTimeout(watchTimer)
  watchTimer = 0
}

function watchTick() {
  const generation = watchGeneration
  void runtimeApi.aiStatus().then((status) => {
    if (generation !== watchGeneration) return
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener(status)
    }
    if (generation !== watchGeneration || listeners.size === 0) {
      watching = false
      return
    }
    watchTimer = window.setTimeout(watchTick, WATCH_MS)
  }).catch(() => {
    if (generation !== watchGeneration || listeners.size === 0) {
      watching = false
      return
    }
    watchTimer = window.setTimeout(watchTick, WATCH_MS)
  })
}

function ensureWatch() {
  if (watching || listeners.size === 0) return
  watching = true
  watchTick()
}

/** One status read shared by every waiting panel. Stops when nobody is waiting. */
export function subscribeCoreStatus(listener: CoreListener) {
  listeners.add(listener)
  ensureWatch()
  let active = true
  return () => {
    if (!active) return
    active = false
    listeners.delete(listener)
    if (listeners.size === 0) stopWatch()
  }
}

/** Poll the existing status API while a core-backed section is waiting. One callback when it connects. */
export function useWhenCoreConnects(onConnect: () => void, enabled: boolean) {
  const callback = useRef(onConnect)
  callback.current = onConnect

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    const unsubscribe = subscribeCoreStatus((status) => {
      if (stopped || !status.connected) return
      stopped = true
      unsubscribe()
      callback.current()
    })
    return () => {
      stopped = true
      unsubscribe()
    }
  }, [enabled])
}

/** Same status subscription, for the first-boot sentence every panel shares. */
export function useCoreBoot(enabled = true) {
  const [status, setStatus] = useState<AiRuntimeStatus | null>(null)

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    const unsubscribe = subscribeCoreStatus((next) => {
      if (stopped) return
      setStatus(next)
      if (next.connected && next.iui?.state !== 'installing') {
        stopped = true
        unsubscribe()
      }
    })
    return () => {
      stopped = true
      unsubscribe()
    }
  }, [enabled])

  if (!enabled) return { kind: 'ready' as const, text: '' }
  return coreBootGuidance(status)
}
