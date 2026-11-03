export function latestSessionId(rows: Array<{ sessionId: string; updatedAt?: number }>) {
  let latestId = ''
  let latestTime = -Infinity
  for (const row of rows) {
    const time = Number(row.updatedAt) || 0
    if (time >= latestTime) {
      latestTime = time
      latestId = row.sessionId
    }
  }
  return latestId
}

export function sessionIdForWorkspace(input: {
  connected: boolean
  workspaceCwd?: string
  chatId?: string
  addressed?: { cwd?: string }
  storedActiveAiSessionId: string
  remoteSessions: Array<{ sessionId: string; cwd?: string }>
  workspaceSessions: Array<{ sessionId: string; updatedAt?: number }>
}) {
  const { connected, workspaceCwd, chatId, addressed, storedActiveAiSessionId, remoteSessions, workspaceSessions } = input
  if (!connected) return ''
  const stored = String(storedActiveAiSessionId || '').trim()
  const chat = String(chatId || '').trim()
  const inWorkspace = (id: string) => workspaceSessions.some((session) => session.sessionId === id)

  if (workspaceCwd && addressed?.cwd && addressed.cwd !== workspaceCwd) {
    return latestSessionId(workspaceSessions)
  }
  if (chat && inWorkspace(chat)) return chat
  if (chat && !workspaceCwd) return chat
  if (stored) {
    if (inWorkspace(stored)) return stored
    const row = remoteSessions.find((session) => session.sessionId === stored)
    if (!row) return stored
    if (!workspaceCwd || !row.cwd || row.cwd === workspaceCwd) return stored
  }
  if (!workspaceCwd) return ''
  return latestSessionId(workspaceSessions)
}
