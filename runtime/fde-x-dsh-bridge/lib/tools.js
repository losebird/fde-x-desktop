const { readFile } = require('node:fs/promises')
const { homedir } = require('node:os')
const { join } = require('node:path')

function dshHome() {
  return process.env.FDE_DSH_HOME || process.env.DSH_HOME || join(homedir(), '.dsh-fde-x')
}

function bridgeTokenPath() {
  return join(dshHome(), 'run', 'bridge.token')
}

function runtimePort() {
  const raw = process.env.FDE_RUNTIME_PORT
  const n = raw != null ? Number(raw) : 4318
  return Number.isFinite(n) && n > 0 ? n : 4318
}

function toolSessionId(exec) {
  const agent = exec && exec.agent
  const session = agent && agent.session
  const header = session && session.header
  return String(
    (session && (session.sessionId || session.id))
    || (header && (header.sessionId || header.id))
    || (agent && agent.id)
    || '',
  ).trim()
}

function toolWorkspace(exec) {
  const header = exec && exec.agent && exec.agent.session && exec.agent.session.header
  return header ? String(header.cwd || '').trim() : ''
}

let cachedToken = ''
let tokenLoadedAt = 0

async function readBridgeToken() {
  if (cachedToken && Date.now() - tokenLoadedAt < 30_000) return cachedToken
  try {
    cachedToken = String(await readFile(bridgeTokenPath(), 'utf8')).trim()
    tokenLoadedAt = Date.now()
    return cachedToken
  } catch {
    cachedToken = ''
    tokenLoadedAt = Date.now()
    return ''
  }
}

async function callBridge(route, body, exec) {
  const token = await readBridgeToken()
  if (!token) {
    return { ok: false, error: 'bridge_unauthorized' }
  }
  const url = `http://127.0.0.1:${runtimePort()}/api/v1/bridge/${route}`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-fde-bridge-token': token,
      },
      body: JSON.stringify({
        ...(body && typeof body === 'object' ? body : {}),
        workspaceCwd: toolWorkspace(exec),
        sessionId: toolSessionId(exec),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (response.status === 401) {
      return { ok: false, error: payload.error || 'bridge_unauthorized' }
    }
    return payload
  } catch (error) {
    return {
      ok: false,
      error: 'bridge_unreachable',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function registerTools(ctx, { defineTool }) {
  ctx.tools.register(defineTool({
    name: 'fde_submit_result',
    description: 'Submit structured result back to FDE-X. Use requestId from the [fde-request:<id>] marker in the prompt.',
    parameters: {
      requestId: { type: 'string', required: true },
      kind: { type: 'string', required: true, description: 'json or text' },
      data: { type: 'object', required: true },
      summary: { type: 'string' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const result = await callBridge('submit-result', {
        requestId: args.requestId,
        kind: args.kind,
        data: args.data,
        summary: args.summary,
      }, exec)
      return JSON.stringify(result)
    },
    presentCall() {
      return { card: 'generic', title: 'fde_submit_result', kind: 'write' }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'fde_context_get',
    description: 'Pull FDE-X workspace context (workspace, tasks, etc.).',
    parameters: {
      scope: { type: 'array', required: true, description: 'workspace | tasks | im | biz | apps' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const result = await callBridge('context', { scope: args.scope }, exec)
      return JSON.stringify(result)
    },
    presentCall() {
      return { card: 'generic', title: 'fde_context_get', kind: 'read' }
    },
  }))

  // Spec 04 owns full behavior; BFF stub keeps handshake real.
  ctx.tools.register(defineTool({
    name: 'fde_app_spec_submit',
    description: 'Submit declarative app spec (FDE app builder).',
    parameters: {
      requestId: { type: 'string', required: true },
      spec: { type: 'object', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    async execute(args, exec) {
      const result = await callBridge('app-spec-submit', args, exec)
      return JSON.stringify(result)
    },
    presentCall() {
      return { card: 'generic', title: 'fde_app_spec_submit', kind: 'write' }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'fde_app_records_query',
    description: 'Read generated app records (read-only).',
    parameters: {
      slug: { type: 'string', required: true },
      entity: { type: 'string', required: true },
      filter: { type: 'object' },
      limit: { type: 'number' },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const result = await callBridge('app-records-query', args, exec)
      return JSON.stringify(result)
    },
    presentCall() {
      return { card: 'generic', title: 'fde_app_records_query', kind: 'read' }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'fde_app_records_propose',
    description: 'Propose app record changes for human confirmation.',
    parameters: {
      slug: { type: 'string', required: true },
      entity: { type: 'string', required: true },
      op: { type: 'string', required: true },
      rows: { type: 'array', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    async execute(args, exec) {
      const result = await callBridge('app-records-propose', args, exec)
      return JSON.stringify(result)
    },
    presentCall() {
      return { card: 'generic', title: 'fde_app_records_propose', kind: 'write' }
    },
  }))

  // Spec 06 owns briefing submit.
  ctx.tools.register(defineTool({
    name: 'fde_briefing_submit',
    description: 'Submit briefing sections to FDE-X.',
    parameters: {
      requestId: { type: 'string', required: true },
      sections: { type: 'array', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    async execute(args, exec) {
      const result = await callBridge('briefing-submit', args, exec)
      return JSON.stringify(result)
    },
    presentCall() {
      return { card: 'generic', title: 'fde_briefing_submit', kind: 'write' }
    },
  }))

  // Spec 07 owns memory draft.
  ctx.tools.register(defineTool({
    name: 'fde_memory_draft',
    description: 'Draft a memory card for human approval.',
    parameters: {
      title: { type: 'string', required: true },
      body: { type: 'string', required: true },
      refs: { type: 'array', required: true },
      layer: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
    async execute(args, exec) {
      const result = await callBridge('memory-draft', args, exec)
      return JSON.stringify(result)
    },
    presentCall() {
      return { card: 'generic', title: 'fde_memory_draft', kind: 'write' }
    },
  }))
}

module.exports = {
  registerTools,
  toolSessionId,
  toolWorkspace,
}
