export function planAiRunOpen(
  run: { state?: string; sessionId?: string | null } | null | undefined,
): { sessionId: string; label: string } | null
