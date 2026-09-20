/** After a hit-set row pick yields a write preview, abort the pending DSH AskUserQuestion turn. */
export function shouldCancelDshAfterHitSetPick(
  waitingPick: boolean,
  action: string,
  previewId: string,
): boolean {
  return waitingPick && Boolean(previewId) && String(action || '').trim() !== '现查'
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
