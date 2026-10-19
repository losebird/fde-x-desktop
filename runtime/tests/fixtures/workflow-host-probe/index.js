const { mkdirSync, renameSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

function summarize(result) {
  const content = result && Array.isArray(result.content)
    ? result.content.map((block) => block && block.text).filter(Boolean).join('\n')
    : ''
  return {
    isError: Boolean(result && result.isError),
    text: content.slice(0, 500),
  }
}

async function runTool(ctx, name, args, agent) {
  const exec = {
    name,
    arguments: args,
    signal: AbortSignal.timeout(8000),
  }
  if (agent) exec.agent = agent
  return summarize(await ctx.tools.execute(exec))
}

function leakOwnTool(agent) {
  if (process.env.FDE_WORKFLOW_PROBE_LEAK !== '1') return
  const tools = agent && agent.ctx && agent.ctx.tools
  if (!tools || !tools.layers || typeof tools.layers.effect !== 'function') return
  tools.layers.effect(agent.ctx, (layer) => layer.tools.insert('workflow_leak', {
    name: 'workflow_leak',
    description: 'visible after the workflow limit',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: {
      schema: { type: 'string' },
      render: () => [{ type: 'text', text: 'leak' }],
    },
    async execute() {
      return 'leak'
    },
  }), {
    label: 'workflow-probe.leak()',
    notify: false,
  })
}

function registerExtra(ctx) {
  if (process.env.FDE_WORKFLOW_PROBE_EXTRA !== '1') return
  const bare = {
    name: 'mcp__probe__bare',
    description: 'mcp tool without a read-only mark',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: { schema: { type: 'string' }, render: () => [{ type: 'text', text: 'bare' }] },
    async execute() { return 'bare' },
  }
  const marked = {
    ...bare,
    name: 'mcp__probe__ro',
    description: 'mcp tool marked read-only',
    readOnly: true,
    async execute() { return 'ro' },
  }
  ctx.tools.register(bare)
  ctx.tools.register(marked)
}

function apply(ctx) {
  const dir = process.env.FDE_PROBE_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  registerExtra(ctx)
  let approvalAsked = 0
  ctx.on('approval/request', (_request, next) => {
    approvalAsked += 1
    return next()
  })
  ctx.on('agent/created', ({ agent }) => {
    const header = agent && agent.session && agent.session.header
    const preset = (header && header.agentPreset) || ''
    if (preset === 'fde-workflow') leakOwnTool(agent)
    setImmediate(async () => {
      const header = agent && agent.session && agent.session.header
      const preset = (header && header.agentPreset) || 'unknown'
      const payload = {
        preset,
        names: [],
        bashNoAgent: null,
        bashWithAgent: null,
        specNoAgent: null,
        error: null,
      }
      try {
        payload.names = ctx.tools.schemas(agent).map((row) => row.name).sort()
        payload.bashNoAgent = await runTool(ctx, 'bash', { command: 'echo RAN', description: 'probe' })
        payload.bashWithAgent = await runTool(ctx, 'bash', { command: 'echo RAN', description: 'probe' }, agent)
        payload.specNoAgent = await runTool(ctx, 'fde_app_spec_submit', { requestId: 'r', spec: { name: 'x' } })
        payload.approvalAsked = approvalAsked
        payload.sessionId = (header && header.id) || ''
        const presets = ctx.get('permissionPresets')
        payload.preset = presets && typeof presets.current === 'function' ? presets.current(agent.session) : null
        const approval = ctx.get('approval')
        payload.approvalPolicy = approval && approval.config ? approval.config.policy : null
        const extra = process.env.FDE_WORKFLOW_PROBE_CALL
        if (extra) payload.extraCall = await runTool(ctx, extra, {}, agent)
      } catch (error) {
        payload.error = error instanceof Error ? error.message : String(error)
      }
      const dest = join(dir, `${preset}.json`)
      const tmp = join(dir, `.${preset}.${process.pid}.tmp`)
      writeFileSync(tmp, `${JSON.stringify(payload)}\n`)
      renameSync(tmp, dest)
    })
  })
}

module.exports = { apply, inject: ['tools'] }
