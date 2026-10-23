export type OrganizeSessionRow = {
  archived?: boolean
  agentPreset?: string
  title?: string
  cwd?: string
  updatedAt?: number
  sessionId?: string
}

export function organizeSessionTitle(now?: Date): string

export function pickOrganizeSession(
  sessions: readonly OrganizeSessionRow[] | null | undefined,
  cwd: string,
  prefix?: string,
): OrganizeSessionRow | null
