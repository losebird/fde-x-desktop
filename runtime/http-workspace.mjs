import { FDE_AI_WORKSPACE } from './config.mjs'
import { canonicalWorkspaceCwd } from './cwd.mjs'

const DEFAULT_SLOTS = [
  ['body', 'cwd'],
  ['query', 'cwd'],
  ['body', 'workspaceCwd'],
  ['query', 'workspace'],
  ['body', 'workspace'],
]

function readSlot(url, body, from, key) {
  if (from === 'body') {
    if (!body || typeof body !== 'object' || !Object.prototype.hasOwnProperty.call(body, key)) return null
    const value = body[key]
    if (typeof value !== 'string') return null
    return value
  }
  if (!url?.searchParams?.has(key)) return null
  return url.searchParams.get(key) ?? ''
}

export function resolveHttpWorkspace({
  url,
  body,
  runtimeCwd,
  fallbackCwd = FDE_AI_WORKSPACE,
  whenAbsent = 'runtime',
  role = 'path',
  slots = DEFAULT_SLOTS,
} = {}) {
  for (const [from, key] of slots) {
    const raw = readSlot(url, body, from, key)
    if (raw == null) continue
    const cwd = canonicalWorkspaceCwd(raw)
    if (cwd) return { cwd, source: 'request' }
    if (role === 'id-or-path') {
      const id = String(raw ?? '').trim()
      if (!id) continue
      return { id, source: 'request' }
    }
    return { error: 'workspace_invalid' }
  }
  if (whenAbsent === 'omit') return { omitted: true }
  const fromRuntime = canonicalWorkspaceCwd(runtimeCwd)
  if (fromRuntime) return { cwd: fromRuntime, source: 'runtime' }
  const fallback = canonicalWorkspaceCwd(fallbackCwd)
  if (fallback) return { cwd: fallback, source: 'fallback' }
  return { error: 'workspace_invalid' }
}

export function httpStatusForWorkspaceError(error) {
  if (error === 'missing_workspace') return { status: 404, code: 'not_found', message: '工作区未登记' }
  if (error === 'workspace_mismatch') return { status: 400, code: 'workspace_mismatch', message: '工作区 id 与路径不一致' }
  if (error === 'workspace_invalid') return { status: 400, code: 'workspace_invalid', message: '工作区必须是绝对路径' }
  return null
}

export const httpWorkspaceRoutes = [
  { id: 'biz-surfaces', file: 'runtime/routes/biz.mjs', method: 'GET', path: '/api/v1/biz/surfaces', place: 'query', param: 'workspace', proof: 'surfaces', absent: 'runtime' },
  { id: 'biz-kinds', file: 'runtime/routes/biz.mjs', method: 'GET', path: '/api/v1/biz/kinds', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'biz-traces', file: 'runtime/routes/biz.mjs', method: 'GET', path: '/api/v1/biz/traces', place: 'query', param: 'workspace', proof: 'status', absent: 'runtime' },
  { id: 'biz-pending-sheet', file: 'runtime/routes/biz.mjs', method: 'GET', path: '/api/v1/biz/pending-sheet', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'biz-rollback-preview', file: 'runtime/routes/biz.mjs', method: 'POST', path: '/api/v1/biz/rollback/preview', place: 'body', param: 'workspace', proof: 'status', absent: 'runtime', extra: { trace_id: 'matrix-trace' } },
  { id: 'biz-focus-kind', file: 'runtime/routes/biz.mjs', method: 'POST', path: '/api/v1/biz/focus-kind', place: 'body', param: 'workspace', proof: 'status', absent: 'runtime', extra: { sessionId: 'matrix-session', kind: 'visit' } },
  { id: 'biz-preview', file: 'runtime/routes/biz.mjs', method: 'POST', path: '/api/v1/biz/preview', place: 'body', param: 'workspace', proof: 'status', absent: 'runtime' },
  { id: 'biz-catalog', file: 'runtime/routes/biz.mjs', method: 'POST', path: '/api/v1/biz/catalog', place: 'body', param: 'workspace', proof: 'status', absent: 'runtime' },
  { id: 'biz-lookup', file: 'runtime/routes/biz.mjs', method: 'POST', path: '/api/v1/biz/lookup', place: 'body', param: 'workspace', proof: 'status', absent: 'runtime' },
  { id: 'biz-preview-dismiss', file: 'runtime/routes/biz.mjs', method: 'POST', path: '/api/v1/biz/preview/dismiss', place: 'body', param: 'workspace', proof: 'status', absent: 'runtime' },
  { id: 'biz-write', file: 'runtime/routes/biz.mjs', method: 'POST', path: '/api/v1/biz/write', place: 'body', param: 'workspace', proof: 'status', absent: 'runtime', extra: { preview_id: 'matrix-preview' } },
  { id: 'files', file: 'runtime/server.mjs', method: 'GET', path: '/api/v1/files', place: 'query', param: 'cwd', proof: 'files', absent: 'runtime' },
  { id: 'briefing-latest', file: 'runtime/routes/briefing.mjs', method: 'GET', path: '/api/v1/briefing/latest', place: 'query', param: 'workspace', proof: 'briefing', absent: 'runtime' },
  { id: 'briefing-definition', file: 'runtime/routes/briefing.mjs', method: 'GET', path: '/api/v1/briefing/definition', place: 'query', param: 'workspace', proof: 'briefing', absent: 'runtime' },
  { id: 'briefing-definition-put', file: 'runtime/routes/briefing.mjs', method: 'PUT', path: '/api/v1/briefing/definition', place: 'body', param: 'workspaceCwd', proof: 'status', absent: 'runtime' },
  { id: 'briefing-run', file: 'runtime/routes/briefing.mjs', method: 'POST', path: '/api/v1/briefing/run', place: 'body', param: 'workspaceCwd', proof: 'status', absent: 'runtime', extra: { mode: 'internal-only' } },
  { id: 'events-recent', file: 'runtime/routes/events.mjs', method: 'GET', path: '/api/v1/events/recent', place: 'query', param: 'workspace', proof: 'events', absent: 'unfiltered' },
  { id: 'events-sse', file: 'runtime/routes/events.mjs', method: 'GET', path: '/api/v1/events', place: 'query', param: 'workspace', proof: 'events-sse', absent: 'unfiltered' },
  { id: 'events-pending', file: 'runtime/server.mjs', method: 'GET', path: '/api/v1/events/pending', place: 'query', param: 'workspace', proof: 'events', absent: 'unfiltered' },
  { id: 'search', file: 'runtime/routes/search.mjs', method: 'GET', path: '/api/v1/search', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'memory-search', file: 'runtime/server.mjs', method: 'GET', path: '/api/v1/memory/search', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime', extra: { q: 'x' } },
  { id: 'memory-deps', file: 'runtime/server.mjs', method: 'GET', path: '/api/v1/memory/deps', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'memory-cards', file: 'runtime/server.mjs', method: 'GET', path: '/api/v1/memory/cards', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'memory-health', file: 'runtime/server.mjs', method: 'GET', path: '/api/v1/memory/health', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'memory-health-act', file: 'runtime/server.mjs', method: 'POST', path: '/api/v1/memory/health/act', place: 'body', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'memory-cards-post', file: 'runtime/server.mjs', method: 'POST', path: '/api/v1/memory/cards', place: 'body', param: 'cwd', proof: 'status', absent: 'runtime', extra: { label: 'matrix marker label', origin: 'note:matrix' } },
  { id: 'memory-nod', file: 'runtime/server.mjs', method: 'POST', path: '/api/v1/memory/cards/matrix/nod', place: 'body', param: 'cwd', proof: 'status', absent: 'runtime', extra: { nodded: true } },
  { id: 'catalog', file: 'runtime/routes/catalog.mjs', method: 'GET', path: '/api/v1/catalog', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime', extra: { kind: 'file' } },
  { id: 'catalog-post', file: 'runtime/routes/catalog.mjs', method: 'POST', path: '/api/v1/catalog', place: 'body', param: 'cwd', proof: 'status', absent: 'runtime', extra: { kind: 'file', action: 'matrix' } },
  { id: 'business-connections', file: 'runtime/server.mjs', method: 'GET', path: '/api/v1/business/connections', place: 'query', param: 'workspaceCwd', proof: 'status', absent: 'runtime' },
  { id: 'biz-connections', file: 'runtime/routes/biz.mjs', method: 'GET', path: '/api/v1/biz/connections', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'corpus', file: 'runtime/routes/corpus.mjs', method: 'GET', path: '/api/v1/corpus/file:note.md', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'mcp-projection', file: 'runtime/routes/mcp.mjs', method: 'GET', path: '/api/v1/mcp/projection', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'mcp-servers', file: 'runtime/routes/mcp.mjs', method: 'POST', path: '/api/v1/mcp/servers', place: 'body', param: 'cwd', proof: 'status', absent: 'runtime', extra: { serverName: 'matrix-mcp' } },
  { id: 'skills-roots', file: 'runtime/routes/skills.mjs', method: 'GET', path: '/api/v1/skills/roots', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'skills-bundle-files', file: 'runtime/routes/skills.mjs', method: 'GET', path: '/api/v1/skills/bundle/files', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'skills-bundle-file', file: 'runtime/routes/skills.mjs', method: 'GET', path: '/api/v1/skills/bundle/file', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'skills-bundle-file-put', file: 'runtime/routes/skills.mjs', method: 'PUT', path: '/api/v1/skills/bundle/file', place: 'body', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'skills-bundle-file-delete', file: 'runtime/routes/skills.mjs', method: 'DELETE', path: '/api/v1/skills/bundle/file', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'skills-model-invocable', file: 'runtime/routes/skills.mjs', method: 'POST', path: '/api/v1/skills/model-invocable', place: 'body', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'skills-install', file: 'runtime/routes/skills.mjs', method: 'POST', path: '/api/v1/skills/install', place: 'body', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'skills-bundle-delete', file: 'runtime/routes/skills.mjs', method: 'DELETE', path: '/api/v1/skills/bundle', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'business-apps', file: 'runtime/server.mjs', method: 'GET', path: '/api/v1/business/apps', place: 'query', param: 'workspaceCwd', proof: 'status', absent: 'runtime' },
  { id: 'apps', file: 'runtime/routes/apps.mjs', method: 'GET', path: '/api/v1/apps', place: 'query', param: 'workspace', proof: 'apps', absent: 'apps-default', illegal: 'unmatched' },
  { id: 'apps-create', file: 'runtime/routes/apps.mjs', method: 'POST', path: '/api/v1/apps', place: 'body', param: 'workspaceCwd', proof: 'status', absent: 'runtime' },
  { id: 'apps-entity', file: 'runtime/routes/apps.mjs', method: 'GET', path: '/api/v1/apps/matrix-slug/visit', place: 'query', param: 'workspace', proof: 'status', absent: 'runtime', illegal: 'unmatched' },
  { id: 'context-pack', file: 'runtime/routes/context.mjs', method: 'POST', path: '/api/v1/context/pack', place: 'body', param: 'workspaceCwd', proof: 'status', absent: 'runtime', extra: { scopes: ['apps', 'tasks'] } },
  { id: 'bridge-context', file: 'runtime/routes/bridge.mjs', method: 'POST', path: '/api/v1/bridge/context', place: 'body', param: 'workspaceCwd', proof: 'status', absent: 'runtime', extra: { scope: ['apps', 'tasks'] } },
  { id: 'semantic-coverage', file: 'runtime/server.mjs', method: 'GET', path: '/semantic-os/api/coverage', place: 'query', param: 'cwd', proof: 'status', absent: 'runtime' },
  { id: 'ai-workspaces', file: 'runtime/server.mjs', method: 'POST', path: '/api/v1/ai/workspaces', place: 'body', param: 'path', proof: 'status', absent: 'required' },
  { id: 'presets-import-dir', file: 'runtime/routes/presets.mjs', method: 'POST', path: '/api/v1/ai/presets/import-dir', place: 'body', param: 'path', proof: 'status', absent: 'required' },
  { id: 'presets-import-dir-confirm', file: 'runtime/routes/presets.mjs', method: 'POST', path: '/api/v1/ai/presets/import-dir/confirm', place: 'body', param: 'path', proof: 'status', absent: 'required' },
  { id: 'presets-import-git-confirm', file: 'runtime/routes/presets.mjs', method: 'POST', path: '/api/v1/ai/presets/import-git/confirm', place: 'body', param: 'tempPath', proof: 'status', absent: 'required' },
  { id: 'bridge-submit', file: 'runtime/routes/bridge.mjs', method: 'POST', path: '/api/v1/bridge/submit-result', place: 'body', param: 'workspaceCwd', proof: 'bridge', absent: 'required' },
]

export const httpWorkspaceExemptions = [
  { file: 'runtime/session-bind.mjs', reason: '创建会话的 cwd 与 workspaceId 二选一。路径手用 canonicalWorkspaceCwd。缺省不是运行时 cwd' },
  { file: 'runtime/routes/plan.mjs', reason: 'workspaceId 是工作区 id' },
  { file: 'runtime/routes/biz.mjs', path: '/api/v1/biz/connections', reason: 'GET /api/v1/biz/connections 的 workspace 查询是连接 id。同文件的路径参数走 resolveHttpWorkspace' },
  { file: 'runtime/http-workspace.mjs', reason: '解析函数自己读取这些参数' },
  { file: 'runtime/vendor-overlays', reason: '本轮不改 overlay' },
  { file: 'runtime/biz/corpus-origin.mjs', reason: 'corpus 路由已登记。这里在审计回退时复用同一个解析，错误不再改用另一条审计 cwd' },
]
