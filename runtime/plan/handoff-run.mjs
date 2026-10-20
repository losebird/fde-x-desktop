export async function handoffTask(api, input) {
  const taskId = String(input.taskId || '').trim()
  const requestId = String(input.requestId || '').trim()
  if (!taskId || !requestId) {
    const error = new Error('缺少会话或请求')
    error.status = 422
    throw error
  }
  if (input.markDoing !== false) await api.updateStatus(taskId, 'doing')
  try {
    const created = await api.createSession({
      cwd: input.cwd,
      agentPreset: input.preset || 'standard',
    })
    const sessionId = created && created.sessionId
    if (!sessionId) {
      const error = new Error('会话没有编号')
      error.status = 502
      throw error
    }
    if (typeof api.rename === 'function' && input.sessionTitle) {
      await api.rename(sessionId, input.sessionTitle)
    }
    await api.startRun(taskId, { sessionId, requestId })
    try {
      await api.prompt(sessionId, { text: input.prompt, requestId })
    } catch (error) {
      return {
        ok: false,
        sessionStatus: 201,
        promptError: error,
        requestId,
        sessionId,
        status: 'doing',
      }
    }
    return { ok: true, sessionStatus: 201, requestId, sessionId, status: 'doing' }
  } catch (error) {
    if (error && error.status === 503) {
      await api.startRun(taskId, { sessionId: requestId, requestId })
      return {
        ok: false,
        sessionStatus: 503,
        requestId,
        sessionId: requestId,
        status: 'doing',
        error,
        errorCode: error.code || '',
      }
    }
    throw error
  }
}
