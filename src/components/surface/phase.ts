export type SurfacePhase = 'loading' | 'unreachable' | 'coreDown' | 'error' | 'empty' | 'ready'

export type SurfaceFailure = {
  phase: 'unreachable' | 'coreDown' | 'error'
  message: string
}

export const SURFACE_UNREACHABLE = '连不上本机核心。确认工作台已启动后再试。'
export const SURFACE_CORE_DOWN = '核心还没接通。先连接核心，再回到这里。'

const CODE_PHASE: Record<string, SurfaceFailure['phase']> = {
  runtime_unreachable: 'unreachable',
  'ai/not-connected': 'coreDown',
  core_disconnected: 'coreDown',
}

const CODE_MESSAGE: Record<string, string> = {
  origin_not_allowed: '当前页面来源不被允许。',
  not_found: '没有找到这一项。',
  id_conflict: '这个名字已经有了。换一个再保存。',
  forbidden: '现在没有权限做这一步。',
  host_action_missing: '当前核心没有这一步。先重载核心再试。',
}

const FALLBACK_RULES: Array<{ test: RegExp; say: string }> = [
  { test: /list_mcp_resources/i, say: '这一场会话还没有资源。先添加服务器，再重载核心。' },
  { test: /host yaml library is missing/i, say: '本机核心缺配置库，暂时读不到这项。' },
]

const TECHNICAL = /failed to fetch|list_mcp_|\/api\/|econn|typeerror|syntaxerror|\berror\b|yaml library|undefined is not|[a-z]+_[a-z]+|\bHTTP\s*\d{3}\b/i

type RuntimeShape = { status: number; code: string; message: string }

function runtimeShape(cause: unknown): RuntimeShape | null {
  if (!cause || typeof cause !== 'object') return null
  const row = cause as { name?: unknown; status?: unknown; code?: unknown; message?: unknown }
  if (row.name !== 'RuntimeApiError') return null
  if (typeof row.status !== 'number' || typeof row.code !== 'string') return null
  return {
    status: row.status,
    code: row.code,
    message: typeof row.message === 'string' ? row.message : '',
  }
}

function plainText(cause: unknown) {
  if (typeof cause === 'string') return cause
  if (cause instanceof Error) return cause.message
  return ''
}

function fallbackText(raw: string, fallback: string) {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  for (const rule of FALLBACK_RULES) {
    if (rule.test.test(text)) return rule.say
  }
  if (TECHNICAL.test(text)) return fallback
  return text
}

export function classifySurfaceFailure(cause: unknown, fallback: string): SurfaceFailure {
  const runtime = runtimeShape(cause)
  const raw = runtime?.message || plainText(cause)
  if (runtime?.code === 'aborted') {
    return { phase: 'error', message: '这一步已取消。' }
  }
  if (
    runtime?.status === 0
    || runtime?.code === 'runtime_unreachable'
    || /failed to fetch|networkerror|econnrefused|load failed|network request failed/i.test(raw)
  ) {
    return { phase: 'unreachable', message: SURFACE_UNREACHABLE }
  }
  if (runtime && CODE_PHASE[runtime.code] === 'coreDown') {
    return { phase: 'coreDown', message: SURFACE_CORE_DOWN }
  }
  if (runtime && CODE_MESSAGE[runtime.code]) {
    return { phase: 'error', message: CODE_MESSAGE[runtime.code] }
  }
  if (runtime?.status === 409) {
    return { phase: 'error', message: '这一项刚被别处改过。重新读取后再改。' }
  }
  if (runtime?.status === 404) {
    return { phase: 'error', message: '没有找到这一项。' }
  }
  if (runtime?.status === 403) {
    return { phase: 'error', message: '现在没有权限做这一步。' }
  }
  if (runtime && runtime.status >= 500) {
    return { phase: 'error', message: fallbackText(raw, fallback) }
  }
  return { phase: 'error', message: fallbackText(raw, fallback) }
}

export function humanizeSurfaceMessage(raw: string, fallback: string) {
  return classifySurfaceFailure(raw, fallback).message
}
