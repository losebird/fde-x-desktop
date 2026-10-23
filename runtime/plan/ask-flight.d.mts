export type AskFlightTicket = {
  generation: number
  signal: AbortSignal
  cancel(): void
}

export type AskFlight = {
  begin(): AskFlightTicket
  accept<T>(id: number, result: T): T | { ok: false; error: 'stale'; discarded: true }
  cancelActive(): void
}

export function createAskFlight(): AskFlight

export function settleAskWait<T>(
  signal: AbortSignal | null | undefined,
  work: () => Promise<T> | T,
): Promise<{ ok: true; value: T } | { ok: false; error: string }>
