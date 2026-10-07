import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { runtimeApi } from '@/lib/runtime-api'
import { TERMINAL_FONT_SIZE } from '@/lib/terminal-fit'
import { terminalFollowStopped } from '@/lib/terminal-occupancy'

export function AiTerminal({
  sessionId,
  terminalId,
  attachmentId,
  canWrite,
  canResize,
  onError,
  onStopped,
  onSuspectStopped,
}: {
  sessionId: string
  terminalId: string
  attachmentId: string
  canWrite: boolean
  canResize: boolean
  onError: (message: string) => void
  onStopped: (id: string) => void
  onSuspectStopped: (id: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const term = new Terminal({ convertEol: true, fontSize: TERMINAL_FONT_SIZE, cursorBlink: true })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    termRef.current = term
    let lastCols = 0
    let lastRows = 0
    let fitTimer = 0
    const applyFit = () => {
      if (!termRef.current) return
      fit.fit()
      const cols = term.cols
      const rows = term.rows
      if (!cols || !rows) return
      if (cols === lastCols && rows === lastRows) return
      lastCols = cols
      lastRows = rows
      if (!canResize) return
      void runtimeApi.catalogAction({
        kind: 'terminal',
        action: 'resize',
        sessionId,
        id: terminalId,
        params: { attachmentId, cols, rows },
      }).catch((error) => onError(error instanceof Error ? error.message : '终端改不了尺寸'))
    }
    applyFit()
    const abort = new AbortController()
    let announced = false
    let seenLive = false
    const announceStopped = () => {
      if (announced) return
      announced = true
      onStopped(terminalId)
    }
    void runtimeApi.catalogStream({
      kind: 'terminal',
      action: 'retain',
      sessionId,
      id: terminalId,
    }, () => undefined, abort.signal).catch(() => undefined)
    void runtimeApi.catalogStream({
      kind: 'terminal',
      action: 'follow',
      sessionId,
      id: terminalId,
      attachmentId,
    }, (frame) => {
      if (terminalFollowStopped(frame, seenLive)) {
        announceStopped()
        return
      }
      const row = frame && typeof frame === 'object' ? frame as { type?: string; screen?: string; data?: string; info?: { error?: string } } : {}
      if (row.type === 'snapshot' && typeof row.screen === 'string') {
        seenLive = true
        term.reset()
        term.write(row.screen)
      }
      if (row.type === 'output' && typeof row.data === 'string') {
        seenLive = true
        term.write(row.data)
      }
      if (row.info?.error) {
        onError(row.info.error)
        onSuspectStopped(terminalId)
      }
    }, abort.signal).then(() => {
      if (!abort.signal.aborted) announceStopped()
    }).catch((error) => {
      if (abort.signal.aborted) return
      onError(error instanceof Error ? error.message : '跟不了终端')
      onSuspectStopped(terminalId)
    })
    const disposable = canWrite
      ? term.onData((data) => {
        void runtimeApi.catalogAction({
          kind: 'terminal',
          action: 'write',
          sessionId,
          id: terminalId,
          params: { attachmentId, data },
        }).catch((error) => onError(error instanceof Error ? error.message : '写不进去'))
      })
      : null
    const observer = new ResizeObserver(() => {
      window.clearTimeout(fitTimer)
      fitTimer = window.setTimeout(applyFit, 80)
    })
    observer.observe(host)
    return () => {
      window.clearTimeout(fitTimer)
      observer.disconnect()
      abort.abort()
      disposable?.dispose()
      term.dispose()
      termRef.current = null
    }
  }, [sessionId, terminalId, attachmentId, canWrite, canResize, onError, onStopped, onSuspectStopped])

  return <div ref={hostRef} className="h-full w-full overflow-hidden" />
}
