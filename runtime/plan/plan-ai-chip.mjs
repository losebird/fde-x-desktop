export function planAiRunOpen(run) {
  if (!run || run.state !== 'running') return null
  const sessionId = run.sessionId == null ? '' : String(run.sessionId)
  return { sessionId, label: 'AI 处理中 · 打开会话' }
}
