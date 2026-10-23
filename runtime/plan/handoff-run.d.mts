export type HandoffTaskApi = {
  updateStatus: (taskId: string, status: 'doing') => unknown
  createSession: (input: { cwd: string; agentPreset?: string }) => Promise<{ sessionId?: string } | null | undefined>
  rename?: (sessionId: string, title: string) => unknown
  startRun: (taskId: string, input: { sessionId: string; requestId: string }) => unknown
  prompt: (sessionId: string, input: { text: string; requestId?: string }) => unknown
}

export type HandoffTaskInput = {
  taskId?: string
  requestId?: string
  markDoing?: boolean
  cwd: string
  preset?: string
  sessionTitle?: string
  prompt: string
}

export type HandoffTaskResult = {
  ok: boolean
  sessionStatus: 201 | 503
  requestId: string
  sessionId: string
  status: 'doing'
  promptError?: unknown
  error?: unknown
  errorCode?: string
}

export function handoffTask(api: HandoffTaskApi, input: HandoffTaskInput): Promise<HandoffTaskResult>
