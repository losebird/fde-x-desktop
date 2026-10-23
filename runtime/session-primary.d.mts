export type PrimarySessionRow = {
  sessionId?: string
  cwd?: string
  origin?: string
  parentSessionId?: string
  updatedAt?: number
  id?: string
  running?: boolean
  status?: string
}

export function isPrimarySession(session: { origin?: string; parentSessionId?: string } | null | undefined): boolean

export function resolvePrimarySessionId(
  sessionId: string,
  sessions: ReadonlyArray<{ sessionId?: string; parentSessionId?: string; origin?: string } | null | undefined> | null | undefined,
): string

export function listedSessions(
  listed: { items?: unknown[]; sessions?: unknown[] } | readonly unknown[] | null | undefined,
): unknown[]

export function asPrimarySessionRow(row: unknown): {
  sessionId: string
  cwd: string
  origin: unknown
  parentSessionId: unknown
  updatedAt: number
} | null

export function pickPrimarySessionId(
  sessions: unknown,
  input?: { sessionId?: string; id?: string; cwd?: string; workspace?: string },
): string

export function sessionIsRunning(row: { running?: boolean; status?: string } | null | undefined): boolean

export function waitUntilSessionIdle(
  aiRuntime: { call?: (method: string, body: unknown) => Promise<unknown> } | null | undefined,
  sessionId: string,
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<boolean>

export function resolvePrimarySessionForRuntime(
  aiRuntime: {
    status?: () => { connected?: boolean }
    call?: (method: string, body: unknown) => Promise<unknown>
  } | null | undefined,
  input?: { sessionId?: string; id?: string; cwd?: string; workspace?: string },
): Promise<string>
