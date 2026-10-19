import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const bridgeRequire = createRequire(import.meta.url)
const { limitWorkflowAgent, WORKFLOW_TOOLS } = bridgeRequire('../fde-x-dsh-bridge/lib/workflow-limit.js')

const ALLOWED = new Set(WORKFLOW_TOOLS)
const OUTSIDE = ['bash', 'biz_write', 'fde_app_spec_submit']
const PIN = join(tmpdir(), 'fde-x-dsh-pin-0.2.0-rc.2')
const PIN_STAMP = join(PIN, 'node_modules', '@deepseek-ai', 'dsh-agent-preset-registry', 'package.json')

function ensurePin() {
  if (!existsSync(PIN_STAMP)) {
    mkdirSync(PIN, { recursive: true })
    writeFileSync(join(PIN, 'package.json'), `${JSON.stringify({
      private: true,
      dependencies: {
        '@deepseek-ai/cordis': '4.0.5',
        '@deepseek-ai/dsh-tools': '0.2.0-rc.2',
        '@deepseek-ai/dsh-scope': '0.2.0-rc.2',
        '@deepseek-ai/dsh-agent-preset-registry': '0.2.0-rc.2',
      },
    })}\n`)
    execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
      cwd: PIN,
      stdio: 'inherit',
    })
  }
  return createRequire(join(PIN, 'package.json'))
}

const pinRequire = ensurePin()
const { Context, Service } = pinRequire('@deepseek-ai/cordis')
const { ToolRuntime, defineTool } = pinRequire('@deepseek-ai/dsh-tools')
const { createScope } = pinRequire('@deepseek-ai/dsh-scope')
const { AgentPresetRegistry } = pinRequire('@deepseek-ai/dsh-agent-preset-registry')

class Prompt extends Service {
  constructor(ctx) {
    super(ctx, 'systemPrompt')
    this.layers = {
      effect(_ctx, action) {
        action({ sections: { insert() { return () => {} } } })
      },
    }
  }

  tools() {}

  section() {}

  getSectionOrder() {
    return 0
  }
}

class Projections extends Service {
  constructor(ctx) {
    super(ctx, 'sessionProjections')
  }

  register() {}

  stateOf() {
    return null
  }
}

class Loader extends Service {
  constructor(ctx) {
    super(ctx, 'loader')
  }

  await() {
    return Promise.resolve()
  }
}

class Approval extends Service {
  constructor(ctx) {
    super(ctx, 'approval')
    this.calls = []
  }

  request(req) {
    this.calls.push(req.toolName)
    return 'unavailable'
  }
}

function stubTool(name) {
  return defineTool({
    name,
    description: name,
    parameters: {},
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute() {
      return `ran:${name}`
    },
  })
}

async function boot() {
  const root = new Context()
  root.plugin(Prompt)
  root.plugin(Projections)
  root.plugin(Loader)
  root.plugin(Approval)
  await root.plugin(ToolRuntime, { mode: 'native' })
  await root.plugin(AgentPresetRegistry, { default: 'chat' })
  for (const name of [...WORKFLOW_TOOLS, ...OUTSIDE]) root.tools.register(stubTool(name))
  await root.agentPresets.register({ id: 'fde-workflow', name: 'workflow', plugins: [] })
  await root.agentPresets.register({ id: 'chat', name: 'chat', plugins: [] })
  let approval
  const agent = {
    id: 'wf-agent',
    session: { id: 'wf-agent', header: { cwd: '/tmp/wf', agentPreset: 'fde-workflow' } },
  }
  const chat = {
    id: 'chat-agent',
    session: { id: 'chat-agent', header: { cwd: '/tmp/chat', agentPreset: 'chat' } },
  }
  await new Promise((resolve, reject) => {
    root.inject(['tools', 'agentPresets', 'approval'], async (host) => {
      try {
        approval = host.get('approval')
        const workflowScope = createScope(host, agent)
        agent.ctx = workflowScope.ctx
        await host.agentPresets.mount(agent.ctx, 'fde-workflow')
        const chatScope = createScope(host, chat)
        chat.ctx = chatScope.ctx
        await host.agentPresets.mount(chat.ctx, 'chat')
        limitWorkflowAgent(host, agent)
        limitWorkflowAgent(host, chat)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })
  return { root, agent, chat, approval }
}

async function execute(root, agent, name) {
  return root.tools.execute({
    callId: `call-${name}`,
    name,
    arguments: {},
    agent,
    signal: new AbortController().signal,
  })
}

test('普通会话在工作流限制之后仍能调用 bash', async () => {
  const { root, chat } = await boot()
  const names = root.tools.schemas(chat).map((row) => row.name)
  assert.equal(names.includes('bash'), true)
  assert.equal(names.includes('biz_write'), true)
  assert.equal(names.includes('fde_app_spec_submit'), true)
  const bash = await execute(root, chat, 'bash')
  assert.equal(bash.isError, false)
  assert.equal(bash.value, 'ran:bash')
})

test('fde-workflow 会话不能看到或调用三个工具以外的工具', async () => {
  const { root, agent } = await boot()
  const names = root.tools.schemas(agent).map((row) => row.name).sort()
  const extraVisible = names.filter((name) => !ALLOWED.has(name))
  const callable = []
  const denied = []
  for (const name of OUTSIDE) {
    const result = await execute(root, agent, name)
    if (!result.isError) callable.push(name)
    else denied.push(result.content?.[0]?.text || '')
  }
  assert.deepEqual(names, [...WORKFLOW_TOOLS].sort())
  assert.deepEqual({ extraVisible, callable }, { extraVisible: [], callable: [] })
  assert.equal(denied.length, OUTSIDE.length)
  for (const text of denied) assert.match(text, /工作流步骤不能调用这个工具/)
})

test('认不出 fde-workflow 时拒绝这个会话', () => {
  const agent = {
    session: { header: { agentPreset: 'fde-workflow' } },
    ctx: {
      tools: {
        restrict() {
          throw new Error('should not restrict')
        },
        guard() {
          throw new Error('should not guard')
        },
      },
    },
  }
  assert.throws(
    () => limitWorkflowAgent({ get() { return undefined } }, agent),
    /工作流预设未能限制工具/,
  )
  const presets = { composedPreset() { return 'chat' } }
  assert.throws(
    () => limitWorkflowAgent({
      get(name) {
        return name === 'agentPresets' ? presets : undefined
      },
    }, agent),
    /工作流预设未能限制工具/,
  )
})

test('读不到预设时普通会话保持原样', () => {
  const chat = { session: { header: { agentPreset: 'chat' } } }
  limitWorkflowAgent({ get() { return undefined } }, chat)
})

test('三个允许的工具在无人值守时不会进入审批', async () => {
  const { root, agent, approval } = await boot()
  for (const name of WORKFLOW_TOOLS) {
    const result = await execute(root, agent, name)
    assert.equal(result.isError, false, name)
    assert.equal(result.value, `ran:${name}`)
  }
  assert.deepEqual(approval.calls, [])
})
