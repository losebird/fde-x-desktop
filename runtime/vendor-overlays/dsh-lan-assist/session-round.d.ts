export function shouldCancelDshAfterWritePreview(action: string, previewId: string): boolean
export function isConfirmableWritePreview(sheet: Record<string, unknown> | null | undefined): boolean
export function isRoundWriteResult(sheet: Record<string, unknown> | null | undefined): boolean
export function isWorkstationHeldWrite(sheet: Record<string, unknown> | null | undefined): boolean
export function holdsWorkstationAsk(sheet: Record<string, unknown> | null | undefined): boolean
export function roundBlocksChatAsk(round: { open?: boolean; candidate?: unknown; userSpeech?: string } | null | undefined, writeSpeech: boolean): boolean
export function isEligibleRoundSheet(sheet: Record<string, unknown> | null | undefined): boolean
export function isUnfilteredListSheet(sheet: Record<string, unknown> | null | undefined): boolean
export function isLeftoverAfterCandidate(candidate: unknown, incoming: unknown): boolean
export function wroteLookupLocksSpec(spec: Record<string, unknown> | null | undefined, identity: unknown): boolean
export function stampWroteLookup(
  spec: Record<string, unknown> | null | undefined,
  identity: unknown,
  opts?: { lock?: boolean },
): Record<string, unknown>
export function createSessionRoundStore(): {
  peek(sessionId: string): Record<string, unknown> | null
  startRound(sessionId: string, opts?: Record<string, unknown>): string
  closeRound(sessionId: string, reason?: string, extra?: Record<string, unknown>): Record<string, unknown>
  noteToolSheet(sessionId: string, sheet: Record<string, unknown>): Record<string, unknown>
  officialSheet(sessionId: string): Record<string, unknown> | null
  servedSheet(sessionId: string): Record<string, unknown> | null
  isOpen(sessionId: string): boolean
  roundSpeech(sessionId: string): string
}
