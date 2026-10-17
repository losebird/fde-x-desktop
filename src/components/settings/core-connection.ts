import { useEffect, useRef } from 'react'
import { runtimeApi } from '@/lib/runtime-api'

const WATCH_MS = 400

/** Poll the existing status API while a core-backed section is waiting. One callback when it connects. */
export function useWhenCoreConnects(onConnect: () => void, enabled: boolean) {
  const callback = useRef(onConnect)
  callback.current = onConnect

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let timer = 0
    const arm = (delay: number) => {
      timer = window.setTimeout(tick, delay)
    }
    const tick = () => {
      void runtimeApi.aiStatus().then((status) => {
        if (stopped) return
        if (status.connected) {
          stopped = true
          callback.current()
          return
        }
        arm(WATCH_MS)
      }).catch(() => {
        if (!stopped) arm(WATCH_MS)
      })
    }
    arm(0)
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [enabled])
}
