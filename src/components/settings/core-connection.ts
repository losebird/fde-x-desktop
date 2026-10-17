import { useEffect, useRef, useState } from 'react'
import { runtimeApi, type AiRuntimeStatus } from '@/lib/runtime-api'

const WATCH_MS = 400
const STARTING_STATES = new Set(['starting', 'connecting'])

type CoreListener = (status: AiRuntimeStatus) => void

const listeners = new Set<CoreListener>()
let watchTimer = 0
let watchGeneration = 0
let watching = false

export type CoreBootGuidance = {
  kind: 'starting' | 'failed' | 'down' | 'ready'
  text: string
}

const FAILED_COPY = '本地核心还没接通。请重新执行 `pnpm dev`；本机第二套请用 `pnpm run dev:peer`。'

function processGone(status: AiRuntimeStatus | null | undefined) {
  return status?.pid == null
}

function timedOut(status: AiRuntimeStatus | null | undefined) {
  return /超时|未完成启动|timeout/i.test(String(status?.lastError || ''))
}

/** Starting and a future connecting value are not failures. IUI install progress waits for a status field. */
export function coreBootGuidance(status: AiRuntimeStatus | null | undefined): CoreBootGuidance {
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
      if (next.connected) {
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
