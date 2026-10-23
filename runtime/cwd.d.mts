export function pickedDirectory(value: unknown): string
export function canonicalWorkspaceCwd(value: unknown): string
export function sameWorkspaceCwd(left: unknown, right: unknown): boolean
export function installCanonicalWorkspaceCwd(db: {
  function(name: string, options: { deterministic?: boolean }, fn: (value: unknown) => string): void
}): void
export function canonicalWorkspaceCwdSql(db: {
  function(name: string, options: { deterministic?: boolean }, fn: (value: unknown) => string): void
}): string
export function workspaceCwdEqual(
  db: {
    function(name: string, options: { deterministic?: boolean }, fn: (value: unknown) => string): void
  },
  columnSql: string,
  cwd: unknown,
): { sql: string; params: unknown[] }
export function workspaceCacheKey(value: unknown): string
export function sameWorkspaceCacheKey(stored: unknown, query: unknown): boolean
