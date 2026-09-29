import {
  isConfirmableWritePreview,
  isRoundWriteResult,
  isWorkstationHeldWrite,
  shouldCancelDshAfterWritePreview,
} from '../../runtime/vendor-overlays/dsh-lan-assist/session-round.js'

export {
  isConfirmableWritePreview,
  isRoundWriteResult,
  isWorkstationHeldWrite,
  shouldCancelDshAfterWritePreview,
}

/** Workstation holds the pick or the write token: leftover chat Ask is not a confirm mouth. */
export function shouldAbortLeftoverAskForWritePreview(sheet: Record<string, unknown>): boolean {
  return isWorkstationHeldWrite(sheet)
}

export function resolveHitSetPickCancelSessionId(input: {
  bindSheet?: Record<string, unknown> | null
  pendingSheet?: Record<string, unknown> | null
  activeAiSessionId?: string | null
  historySessionId?: string | null
}): string {
  const bindSid = input.bindSheet?.sessionId
  const pendingSid = input.pendingSheet?.sessionId
  return String(
    bindSid ||
    pendingSid ||
    input.activeAiSessionId ||
    input.historySessionId ||
    '',
  ).trim()
}
