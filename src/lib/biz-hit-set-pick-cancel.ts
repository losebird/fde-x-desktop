import {
  isConfirmableWritePreview,
  isRoundWriteResult,
  isWorkstationHeldWrite,
  shouldCancelDshAfterWritePreview,
} from '../../runtime/plugins/dsh-lan-assist/session-round.js'

export {
  isConfirmableWritePreview,
  isRoundWriteResult,
  isWorkstationHeldWrite,
  shouldCancelDshAfterWritePreview,
}

/** Pick-rows leftover Ask still cancels chat. A live write token waits on 业务记录 without killing the turn. */
export function shouldAbortLeftoverAskForWritePreview(sheet: Record<string, unknown>): boolean {
  if (isConfirmableWritePreview(sheet)) return false
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
