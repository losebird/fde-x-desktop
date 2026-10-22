export function planAiRunOpen(run) {
  if (!run || run.state !== 'running') return null
  const sessionId = run.sessionId == null ? '' : String(run.sessionId).trim()
  if (sessionId.length === 0) return null
  return { sessionId, label: 'AI 处理中 · 打开会话' }
}
