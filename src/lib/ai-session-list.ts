export const PERSONAL_WORKSPACE_ID = 'ws_personal'

export function sessionListWorkspaceId(
  activeWorkspaceId: string,
  workspaces: Array<{ id?: string }>,
): string {
  const active = String(activeWorkspaceId || '').trim()
  if (active) return active
  for (const row of workspaces || []) {
    const id = String(row?.id || '').trim()
    if (id) return id
  }
  return PERSONAL_WORKSPACE_ID
}

export async function takeSessionList<T>(
  workspaceId: string,
  list: (workspaceId: string) => Promise<T[]>,
): Promise<T[]> {
  const id = String(workspaceId || '').trim()
  if (!id) throw new Error('session list workspace is empty')
  return list(id)
}
