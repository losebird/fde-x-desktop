import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kindOfNamespace, verbRole, verbsFromTypertText, verbsForKind, listTypertVerbs, ensureTypertVerbs, resolveDshModulesRoot, toolNamesFromDefineToolText, listMcpResourceToolNames } from '../catalog-typert.mjs'
import { describeKindVerbs, collectBag, mutateBag, streamBag, argsFromFace, faceArgsComplete } from '../catalog-collect.mjs'

const SAMPLE = `
      namespace: 'workspaceFiles',
      method: 'list',
      parameters: [
        { name: 'workspaceFileScope', wire: 'workspaceFileScopeId', source: 'lookup', lookup: 'workspaceFileScope' },
        { name: 'path', wire: 'path', source: 'json' },
      ],
      namespace: 'workspaceFiles',
      method: 'changes',
      mode: 'stream',
      namespace: 'workspaceFiles',
      method: 'readBytes',
      result: { create: () => ({ data: z.instanceof(Uint8Array) }) },
      namespace: 'session',
      method: 'openWorkspacePath',
      parameters: [
        { name: 'request', wire: 'request', source: 'json', typeSymbol: 'x#SessionOpenWorkspacePathRequest' },
      ],
      namespace: 'goals',
      method: 'get',
      namespace: 'goals',
      method: 'complete',
"declaration": "export interface SessionOpenWorkspacePathRequest {\\n    readonly sessionId: SessionId;\\n    readonly path: string;\\n    readonly action?: x;\\n}"
`

test('flat @deepseek-ai modules root lists sibling typert hosts', async () => {
  const root = resolveDshModulesRoot()
  if (!root) return
  const verbs = await ensureTypertVerbs(root)
  assert.ok(verbs.length > 0)
  assert.ok(verbs.some((row) => row.ns === 'workspaceFiles' && row.method === 'list'))
  assert.equal(kindOfNamespace('terminal'), 'terminal')
  assert.ok(verbs.some((row) => row.ns === 'terminal'))
})

test('Face scan carries wires, lookup, stream, and bytes from this-install typert', async () => {
  const root = resolveDshModulesRoot()
  if (!root) return
  const verbs = await ensureTypertVerbs(root)
  const enable = verbs.find((row) => row.ns === 'pluginManager' && row.method === 'setPluginEnabled')
  assert.ok(enable)
  assert.ok(enable.parameters.some((row) => row.wire === 'id' && row.source === 'json'))
  assert.ok(enable.parameters.some((row) => row.wire === 'enabled' && row.source === 'json'))
  const render = verbs.find((row) => row.ns === 'officeToPdf' && row.method === 'render')
  assert.equal(render.result, 'bytes')
  assert.ok(render.parameters.some((row) => row.source === 'lookup'))
  const changes = verbs.find((row) => row.ns === 'workspaceFiles' && row.method === 'changes')
  assert.equal(changes.stream, true)
  assert.equal(changes.result, 'stream')
  const follow = verbs.find((row) => row.ns === 'terminal' && row.method === 'follow')
  assert.equal(follow.stream, true)
  const write = verbs.find((row) => row.ns === 'terminal' && row.method === 'write')
  assert.equal(write.stream, false)
  const pin = verbs.find((row) => row.ns === 'workspace' && row.method === 'pinSession')
  assert.deepEqual(pin.requestFields, ['sessionId'])
  assert.deepEqual(argsFromFace(pin, { id: 'session-1' }), { request: { sessionId: 'session-1' } })
  const skillList = verbs.find((row) => row.ns === 'skills' && row.method === 'list')
  assert.ok(skillList)
  assert.ok(skillList.resultFields.includes('skills'))
})

test('argsFromFace does not send path when Face has no parameters', () => {
  const verbs = verbsFromTypertText(`
      namespace: 'pluginInventory',
      method: 'list',
      parameters: [
      ],
  `)
  const list = verbs.find((row) => row.method === 'list')
  assert.deepEqual(argsFromFace(list, { path: '.', sessionId: 's1' }), {})
})

test('argsFromFace fills json wires from Face, including plugin id', () => {
  const verbs = verbsFromTypertText(`
      namespace: 'pluginManager',
      method: 'setPluginEnabled',
      parameters: [
        { name: 'id', wire: 'id', source: 'json' },
        { name: 'enabled', wire: 'enabled', source: 'json' },
      ],
  `)
  const enable = verbs.find((row) => row.method === 'setPluginEnabled')
  const args = argsFromFace(enable, { id: 'plug-1', params: { enabled: false } })
  assert.deepEqual(args, { id: 'plug-1', enabled: false })
})

test('typert verbs map namespace to kind and role', () => {
  assert.equal(kindOfNamespace('workspaceFiles'), 'file')
  assert.equal(kindOfNamespace('officeToPdf'), 'skill')
  assert.equal(verbRole('list'), 'list')
  assert.equal(verbRole('changes'), 'projection')
  assert.equal(verbRole('openWorkspacePath'), 'action')
  const verbs = verbsFromTypertText(SAMPLE)
  assert.ok(verbs.some((row) => row.endpoint === 'workspaceFiles/list'))
  assert.ok(verbsForKind('file', verbs).some((row) => row.method === 'list'))
})

test('file bag advertises changes projection and openWorkspacePath action', () => {
  const verbs = verbsFromTypertText(SAMPLE)
  const described = describeKindVerbs('file', verbs)
  assert.deepEqual(described.projections, ['changes'])
  assert.ok(described.actions.includes('openWorkspacePath'))
})

test('collectBag empty Host stays empty', async () => {
  const empty = await collectBag(undefined, 'schedule', {})
  assert.equal(empty.kind, 'schedule')
  assert.deepEqual(empty.items, [])
  const verbs = verbsFromTypertText(SAMPLE)
  const aiRuntime = {
    async call(endpoint, args) {
      assert.equal(endpoint, 'workspaceFiles/list')
      assert.equal(args.workspaceFileScopeId, 's1')
      return { path: '.', entries: [{ name: 'a.txt', type: 'file' }] }
    },
  }
  const bag = await collectBag(aiRuntime, 'file', { sessionId: 's1', path: '.' }, verbs)
  assert.equal(bag.items.length, 1)
  assert.equal(bag.items[0].id, 'a.txt')
  assert.ok(bag.actions.includes('openWorkspacePath'))
})

test('file list still calls workspaceFiles/list when typert scan is empty', async () => {
  const aiRuntime = {
    async call(endpoint, args) {
      assert.equal(endpoint, 'workspaceFiles/list')
      return { path: '.', entries: [{ name: 'research', type: 'directory' }, { name: 'a.txt', type: 'file' }] }
    },
  }
  const bag = await collectBag(aiRuntime, 'file', { sessionId: 's1', path: '.' }, [])
  assert.equal(bag.items.length, 2)
  assert.equal(bag.raw.entries.length, 2)
})

test('agent bag lists presets from agentPresets/list', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'agentPresets',
      method: 'list',
      namespace: 'agentPresets',
      method: 'copy',
  `)
  const aiRuntime = {
    async call(endpoint) {
      assert.equal(endpoint, 'agentPresets/list')
      return { presets: [{ id: 'ptc', name: 'PTC' }] }
    },
  }
  const bag = await collectBag(aiRuntime, 'agent', {}, verbs)
  assert.equal(bag.items[0].id, 'ptc')
  assert.ok(describeKindVerbs('agent', verbs).actions.includes('copy'))
})

test('file list errors surface instead of looking empty', async () => {
  const aiRuntime = {
    async call() {
      throw new Error('permission denied')
    },
  }
  await assert.rejects(
    () => collectBag(aiRuntime, 'file', { sessionId: 's1', path: '.' }, verbsFromTypertText(SAMPLE)),
    /permission denied/,
  )
})

const SCHEDULE_JOB = `
      namespace: 'schedule',
      method: 'list',
      parameters: [
        { name: 'request', wire: 'request', source: 'json', typeSymbol: 'x#ScheduleListRequest' },
      ],
      namespace: 'schedule',
      method: 'delete',
      parameters: [
        { name: 'request', wire: 'request', source: 'json', typeSymbol: 'x#ScheduleDeleteRequest' },
      ],
      namespace: 'job',
      method: 'list',
      mode: 'stream',
      parameters: [
        { name: 'request', wire: 'request', source: 'json', typeSymbol: 'x#JobListRequest' },
      ],
      namespace: 'job',
      method: 'kill',
      parameters: [
        { name: 'request', wire: 'request', source: 'json', typeSymbol: 'x#JobKillRequest' },
      ],
"declaration": "export interface ScheduleListRequest {\\n    readonly sessionId: SessionId;\\n}"
"declaration": "export interface ScheduleDeleteRequest {\\n    readonly sessionId: SessionId;\\n    readonly id: Id;\\n}"
"declaration": "export interface JobListRequest {\\n    readonly sessionId: SessionId;\\n}"
"declaration": "export interface JobKillRequest {\\n    readonly sessionId: SessionId;\\n    readonly jobId: JobId;\\n}"
`

test('collectBag schedule lists per primary session with origin prefix', async () => {
  const verbs = verbsFromTypertText(SCHEDULE_JOB)
  const calls = []
  const aiRuntime = {
    async call(endpoint, args) {
      calls.push({ endpoint, args })
      if (endpoint === 'session/list') {
        return [
          { sessionId: 's1', cwd: '/ws/a' },
          { sessionId: 'child', cwd: '/ws/a', origin: 'subagent' },
          { sessionId: 's2', cwd: '/ws/b' },
        ]
      }
      if (endpoint === 'schedule/list') {
        assert.equal(args.request.sessionId, 's1')
        assert.equal(args.request.id, undefined)
        return [{ id: 'sch1', kind: 'at', title: '提醒', prompt: '写日报', scheduledAt: '2026-10-02T01:00:00.000Z' }]
      }
      throw new Error(endpoint)
    },
  }
  const bag = await collectBag(aiRuntime, 'schedule', { workspaceId: 'ws-a', cwd: '/ws/a' }, verbs)
  assert.equal(bag.items.length, 1)
  assert.equal(bag.items[0].id, 'dsh-schedule:sch1')
  assert.equal(bag.items[0].href.tab, 'schedule')
  assert.equal(bag.items[0].fields.startAt, '2026-10-02T01:00:00.000Z')
  assert.equal(bag.items[0].fields.sessionId, 's1')
  assert.equal(bag.items[0].fields.kind, 'reminder')
  assert.ok(bag.actions.includes('delete'))
  const empty = await collectBag(undefined, 'schedule', { cwd: '/ws/a' }, verbs)
  assert.deepEqual(empty.items, [])
})

test('collectBag job snapshots the first stream frame onto the workflow tab', async () => {
  const verbs = verbsFromTypertText(SCHEDULE_JOB)
  const aiRuntime = {
    async call(endpoint, args) {
      if (endpoint === 'job/list') {
        assert.equal(args.request.sessionId, 's1')
        assert.equal(args.request.jobId, undefined)
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'rows', jobs: [{ id: 'j1', kind: 'shell', label: 'build', status: 'running', startedAt: 1 }] }
            yield { type: 'rows', jobs: [] }
          },
        }
      }
      throw new Error(endpoint)
    },
  }
  const bag = await collectBag(aiRuntime, 'job', { workspaceId: 'ws-a', sessionId: 's1' }, verbs)
  assert.equal(bag.items.length, 1)
  assert.equal(bag.items[0].id, 'dsh-job:j1')
  assert.equal(bag.items[0].href.tab, 'workflow')
  assert.equal(bag.items[0].fields.status, 'active')
  assert.equal(bag.items[0].fields.name, 'build')
  assert.ok(bag.actions.includes('kill'))
})

test('mutateBag schedule delete strips origin and resolves session from the bag', async () => {
  const verbs = verbsFromTypertText(SCHEDULE_JOB)
  const calls = []
  const aiRuntime = {
    async call(endpoint, args) {
      calls.push({ endpoint, args })
      if (endpoint === 'session/list') {
        return [{ sessionId: 's1', cwd: '/ws/a' }]
      }
      if (endpoint === 'schedule/list') {
        return [{ id: 'sch1', kind: 'at', title: '提醒', scheduledAt: '2026-10-02T01:00:00.000Z' }]
      }
      if (endpoint === 'schedule/delete') return { id: 'sch1', deleted: true }
      throw new Error(endpoint)
    },
  }
  await mutateBag(aiRuntime, {
    kind: 'schedule',
    action: 'delete',
    id: 'dsh-schedule:sch1',
    cwd: '/ws/a',
    workspaceId: 'ws-a',
  }, verbs)
  const deleted = calls.find((row) => row.endpoint === 'schedule/delete')
  assert.equal(deleted.args.request.sessionId, 's1')
  assert.equal(deleted.args.request.id, 'sch1')
})

test('mutateBag job kill uses jobId from origin prefix', async () => {
  const verbs = verbsFromTypertText(SCHEDULE_JOB)
  const calls = []
  const aiRuntime = {
    async call(endpoint, args) {
      calls.push({ endpoint, args })
      if (endpoint === 'job/list') {
        return { type: 'rows', jobs: [{ id: 'j1', kind: 'shell', label: 'build', status: 'running', startedAt: 1 }] }
      }
      if (endpoint === 'job/kill') return { outcome: 'requested' }
      throw new Error(endpoint)
    },
  }
  await mutateBag(aiRuntime, {
    kind: 'job',
    action: 'kill',
    id: 'dsh-job:j1',
    sessionId: 's1',
  }, verbs)
  const killed = calls.find((row) => row.endpoint === 'job/kill')
  assert.equal(killed.args.request.sessionId, 's1')
  assert.equal(killed.args.request.jobId, 'j1')
})

test('MCP resource tool names come from this-install defineTool, not a hardcoded list', () => {
  const names = toolNamesFromDefineToolText(`
    yield ctx.tools.register(defineTool({
      name: "list_mcp_resources",
      description: "List resources",
    }))
    yield ctx.tools.register(defineTool({
      name: "read_mcp_resource",
    }))
  `)
  assert.deepEqual(names, ['list_mcp_resources', 'read_mcp_resource'])
  const installed = listMcpResourceToolNames()
  if (!installed.length) return
  assert.ok(installed.every((name) => typeof name === 'string' && name.length > 0))
  assert.ok(installed.includes('list_mcp_resources'))
})

test('collectBag mcp keeps servers and only live resource tools', async () => {
  const installed = listMcpResourceToolNames()
  const resourceName = installed[0] || 'list_mcp_resources'
  const aiRuntime = {
    patchFile: '/tmp/fde-x-mcp-bag-test.yml',
    status: () => ({ connected: true }),
    async call(endpoint) {
      if (endpoint === 'session/list') return { sessions: [{ id: 'sess-1', cwd: '/tmp/ws' }] }
      if (endpoint === 'pluginManager/listPlugins') return [{ entryId: 'mcp-alpha', fiberPhase: 'active', enabled: true }]
      throw new Error(endpoint)
    },
    async *stream(endpoint) {
      if (endpoint !== 'session/follow') return
      yield {
        type: 'snapshot',
        header: {},
        records: [{
          type: 'event',
          event: {
            type: 'request/header',
            data: {
              header: {
                tools: [
                  { name: 'mcp__alpha__ping' },
                  { name: resourceName },
                ],
              },
            },
          },
        }],
      }
    },
  }
  const { writeFile, unlink } = await import('node:fs/promises')
  await writeFile(aiRuntime.patchFile, `
- id: mcp-alpha
  package: @deepseek-ai/dsh-mcp-client
  config:
    transport: stdio
    serverName: alpha
    command: "npx"
`)
  try {
    const bag = await collectBag(aiRuntime, 'mcp', { project: true, sessionId: 'sess-1', cwd: '/tmp/ws' })
    assert.equal(bag.items.length, 1)
    assert.equal(bag.items[0].id, 'alpha')
    assert.equal(bag.raw.mcp[0].serverName, 'alpha')
    if (installed.length) {
      assert.ok(bag.actions.includes(resourceName))
      assert.deepEqual(bag.raw.resourceTools, [resourceName])
    } else {
      assert.deepEqual(bag.raw.resourceTools, [])
    }
  } finally {
    await unlink(aiRuntime.patchFile).catch(() => undefined)
  }
})

test('collectBag mcp resource list stays empty without projected resource tools', async () => {
  const aiRuntime = {
    status: () => ({ connected: true }),
    async call(endpoint) {
      if (endpoint === 'session/list') return { sessions: [{ id: 'sess-1' }] }
      throw new Error(endpoint)
    },
    async *stream(endpoint) {
      if (endpoint !== 'session/follow') return
      yield {
        type: 'snapshot',
        header: { tools: [{ name: 'mcp__alpha__ping' }] },
        records: [],
      }
    },
  }
  const bag = await collectBag(aiRuntime, 'mcp')
  assert.deepEqual(bag.raw.resourceTools, [])
  assert.ok(!bag.actions.includes('list_mcp_resources'))
})

test('collectBag mcp first paint does not follow a session', async () => {
  let followed = false
  const aiRuntime = {
    patchFile: '/tmp/fde-x-mcp-bag-fast.yml',
    status: () => ({ connected: true }),
    async call(endpoint) {
      if (endpoint === 'pluginManager/listPlugins') return []
      throw new Error(`unexpected ${endpoint}`)
    },
    async *stream() {
      followed = true
      yield { type: 'snapshot', records: [] }
    },
  }
  const { writeFile, unlink } = await import('node:fs/promises')
  await writeFile(aiRuntime.patchFile, `
- id: mcp-alpha
  package: @deepseek-ai/dsh-mcp-client
  config:
    transport: stdio
    serverName: alpha
    command: "npx"
`)
  try {
    const bag = await collectBag(aiRuntime, 'mcp')
    assert.equal(followed, false)
    assert.equal(bag.items[0].id, 'alpha')
    assert.deepEqual(bag.raw.resourceTools, [])
  } finally {
    await unlink(aiRuntime.patchFile).catch(() => undefined)
  }
})

test('officeToPdf verbs land on the skill bag, not the file bag', async () => {
  const root = resolveDshModulesRoot()
  if (!root) return
  const verbs = await ensureTypertVerbs(root)
  assert.ok(verbs.some((row) => row.ns === 'officeToPdf' && row.method === 'render'))
  assert.ok(verbsForKind('skill', verbs).some((row) => row.ns === 'officeToPdf' && row.method === 'render'))
  assert.ok(!verbsForKind('file', verbs).some((row) => row.ns === 'officeToPdf'))
  const described = describeKindVerbs('skill', verbs)
  assert.ok(described.actions.includes('render'))
})

test('collectBag skill keeps Host skills and appends extra skill namespaces', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'skills',
      method: 'list',
      parameters: [
        { name: 'request', wire: 'request', source: 'json', typeSymbol: 'x#SkillListRequest' },
      ],
      result: {
        typeSymbol: 'x#SkillListValue',
      },
      namespace: 'officeToPdf',
      method: 'render',
      namespace: 'officeToPdf',
      method: 'generation',
"declaration": "export interface SkillListRequest {\\n    readonly sessionId: SessionId;\\n}"
"declaration": "export interface SkillListValue {\\n    readonly skills: readonly SkillEntry[];\\n}"
  `)
  const skillList = verbs.find((row) => row.ns === 'skills' && row.method === 'list')
  assert.deepEqual(skillList.resultFields, ['skills'])
  const aiRuntime = {
    async call(endpoint, args) {
      assert.equal(endpoint, 'skills/list')
      assert.equal(args.request.sessionId, 's1')
      return { skills: [{ name: 'note', description: '记笔记', path: '/tmp/note/SKILL.md' }] }
    },
  }
  const bag = await collectBag(aiRuntime, 'skill', { sessionId: 's1' }, verbs)
  assert.equal(bag.items[0].id, 'note')
  assert.equal(bag.items[0].fields.description, '记笔记')
  assert.equal(bag.items[0].fields.origin, 'catalog')
  assert.equal(bag.items[0].fields.bundleRoot, '/tmp/note')
  const office = bag.items.find((row) => row.id === 'officeToPdf')
  assert.ok(office)
  assert.equal(office.href.panel, 'skills')
  assert.equal(office.fields.origin, 'face')
  assert.deepEqual(office.fields.methods, ['render', 'generation'])
  assert.ok(bag.raw.items.some((row) => row.name === 'note' && row.origin === 'catalog'))
  assert.ok(bag.raw.items.some((row) => row.name === 'officeToPdf' && row.origin === 'face'))
  let listed = 0
  const firstPaintRuntime = {
    async call() {
      listed += 1
      return { skills: [{ name: 'note' }] }
    },
  }
  const first = await collectBag(firstPaintRuntime, 'skill', {}, verbs)
  assert.equal(listed, 0)
  assert.equal(first.items.length, 1)
  assert.equal(first.items[0].fields.origin, 'face')
  const empty = await collectBag(undefined, 'skill', {}, verbsFromTypertText(SAMPLE))
  assert.equal(empty.items.length, 0)
})

test('collectBag plugin maps inventory entries onto settings core', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'pluginInventory',
      method: 'list',
      namespace: 'pluginManager',
      method: 'listPlugins',
      namespace: 'pluginManager',
      method: 'setPluginEnabled',
  `)
  const aiRuntime = {
    async call(endpoint, args) {
      assert.equal(endpoint, 'pluginInventory/list')
      assert.deepEqual(args, {})
      return {
        entries: [
          { entryId: 'ui-chat', moduleName: '@deepseek-ai/dsh-client-ui-chat', enabled: true, fiberPhase: 'active', meta: { title: 'Chat' } },
          { entryId: 'broken', moduleName: 'x', enabled: false, fiberPhase: 'failed', meta: { title: { en: 'Broken' } } },
        ],
      }
    },
  }
  const bag = await collectBag(aiRuntime, 'plugin', {}, verbs)
  assert.equal(bag.items.length, 2)
  assert.equal(bag.items[0].id, 'ui-chat')
  assert.equal(bag.items[0].title, 'Chat')
  assert.equal(bag.items[0].href.panel, 'settings')
  assert.equal(bag.items[0].href.section, 'core')
  assert.equal(bag.items[1].title, 'Broken')
  assert.ok(bag.actions.includes('setPluginEnabled'))
  const empty = await collectBag(undefined, 'plugin', {}, verbs)
  assert.deepEqual(empty.items, [])
})

test('collectBag plugin appends optional Host bundles from listBundles', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'pluginInventory',
      method: 'list',
      namespace: 'pluginManager',
      method: 'listBundles',
      namespace: 'pluginManager',
      method: 'setBundleEnabled',
  `)
  const aiRuntime = {
    async call(endpoint) {
      if (endpoint === 'pluginInventory/list') return { entries: [] }
      if (endpoint === 'pluginManager/listBundles') {
        return [
          { name: '@deepseek-ai/dsh-base', optional: false, enabled: true },
          { name: '@deepseek-ai/dsh-experimental-schedule-bundle', optional: true, enabled: false, meta: { title: { zh: '自动化任务', en: 'Automation tasks' } } },
        ]
      }
      throw new Error(endpoint)
    },
  }
  const bag = await collectBag(aiRuntime, 'plugin', {}, verbs)
  assert.equal(bag.items.length, 1)
  assert.equal(bag.items[0].id, '@deepseek-ai/dsh-experimental-schedule-bundle')
  assert.equal(bag.items[0].title, 'Automation tasks')
  assert.equal(bag.items[0].fields.bundle, true)
  assert.equal(bag.items[0].fields.enabled, false)
  assert.ok(bag.actions.includes('setBundleEnabled'))
})

test('settings collect keeps describe and swallows unmounted catalog mouths', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'settings',
      method: 'describe',
      parameters: [
      ],
      namespace: 'speech',
      method: 'catalog',
      parameters: [
      ],
  `)
  const aiRuntime = {
    async call(endpoint) {
      if (endpoint === 'settings/describe') return { namespaces: [{ ns: 'permission', revision: 1, value: { ask: true } }] }
      if (endpoint === 'speech/catalog') throw new Error('not mounted')
      throw new Error(endpoint)
    },
  }
  const bag = await collectBag(aiRuntime, 'settings', {}, verbs)
  assert.equal(bag.items[0].id, 'permission')
  assert.equal(bag.error, undefined)
})


test('collectBag plugin skips loader include rows', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'pluginInventory',
      method: 'list',
  `)
  const aiRuntime = {
    async call() {
      return {
        entries: [
          { entryId: 'include', moduleName: 'group', enabled: true, fiberPhase: 'active' },
          { entryId: 'include:timer', moduleName: 'timer', enabled: true, fiberPhase: 'active' },
          { entryId: 'ui-chat', moduleName: '@deepseek-ai/dsh-client-ui-chat', enabled: true, fiberPhase: 'active', meta: { title: 'Chat' } },
        ],
      }
    },
  }
  const bag = await collectBag(aiRuntime, 'plugin', {}, verbs)
  assert.equal(bag.items.length, 1)
  assert.equal(bag.items[0].id, 'ui-chat')
})

test('terminal follow is a stream verb; create/write go through mutateBag args', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'terminal',
      method: 'list',
      parameters: [
        { name: 'sessionId', wire: 'sessionId', source: 'json' },
      ],
      namespace: 'terminal',
      method: 'create',
      parameters: [
        { name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent' },
        { name: 'request', wire: 'request', source: 'json', typeSymbol: 'x#TerminalCreateRequest' },
      ],
      namespace: 'terminal',
      method: 'write',
      parameters: [
        { name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent' },
        { name: 'id', wire: 'id', source: 'json' },
        { name: 'attachmentId', wire: 'attachmentId', source: 'json' },
        { name: 'data', wire: 'data', source: 'json' },
      ],
      namespace: 'terminal',
      method: 'follow',
      mode: 'stream',
      parameters: [
        { name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent' },
        { name: 'id', wire: 'id', source: 'json' },
        { name: 'attachmentId', wire: 'attachmentId', source: 'json' },
      ],
"declaration": "export interface TerminalCreateRequest {\\n    readonly id: Id;\\n    readonly cols: number;\\n    readonly rows: number;\\n}"
  `)
  const follow = verbs.find((row) => row.method === 'follow')
  assert.equal(follow.stream, true)
  assert.equal(verbs.find((row) => row.method === 'list').stream, false)
  const calls = []
  const aiRuntime = {
    async call(endpoint, args) {
      calls.push({ endpoint, args })
      if (endpoint === 'terminal/list') return [{ id: 't1', title: 'sh' }]
      if (endpoint === 'terminal/create') return { id: args.request.id, title: 'sh' }
      if (endpoint === 'terminal/write') return undefined
      throw new Error(endpoint)
    },
    async *stream(endpoint, args) {
      calls.push({ endpoint, args })
      yield { type: 'snapshot', screen: 'ready', sequence: 1 }
    },
  }
  const created = await mutateBag(aiRuntime, {
    kind: 'terminal',
    action: 'create',
    sessionId: 's1',
    params: { id: 't-new', cols: 80, rows: 24 },
  }, verbs)
  const createCall = calls.find((row) => row.endpoint === 'terminal/create')
  assert.equal(createCall.args.agentId, 's1')
  assert.equal(createCall.args.request.id, 't-new')
  assert.equal(created.mutation.id, 't-new')
  const listed = calls.find((row) => row.endpoint === 'terminal/list')
  assert.equal(listed.args.sessionId, 's1')
  assert.equal(listed.args.id, undefined)
  await mutateBag(aiRuntime, {
    kind: 'terminal',
    action: 'write',
    sessionId: 's1',
    id: 't-new',
    params: { attachmentId: 'att', data: 'ls\n' },
  }, verbs)
  const written = calls.find((row) => row.endpoint === 'terminal/write')
  assert.equal(written.args.agentId, 's1')
  assert.equal(written.args.id, 't-new')
  assert.equal(written.args.attachmentId, 'att')
  assert.equal(written.args.data, 'ls\n')
  await assert.rejects(() => mutateBag(aiRuntime, { kind: 'terminal', action: 'follow', sessionId: 's1', id: 't-new' }, verbs), /流/)
  const frames = []
  for await (const frame of streamBag(aiRuntime, { kind: 'terminal', action: 'follow', sessionId: 's1', id: 't-new', params: { attachmentId: 'att' } }, verbs)) {
    frames.push(frame)
  }
  assert.equal(frames[0].type, 'snapshot')
  const followed = calls.find((row) => row.endpoint === 'terminal/follow')
  assert.equal(followed.args.agentId, 's1')
  assert.equal(followed.args.id, 't-new')
  assert.equal(followed.args.attachmentId, 'att')
})

test('collectBag plugin stays empty when the inventory call fails', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'pluginInventory',
      method: 'list',
  `)
  const aiRuntime = {
    async call() {
      throw new Error('inventory down')
    },
  }
  const bag = await collectBag(aiRuntime, 'plugin', {}, verbs)
  assert.deepEqual(bag.items, [])
  assert.equal(bag.error, 'inventory down')
})

test('settings collect uses the describe Face that bind can fill', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'credentials',
      method: 'describe',
      parameters: [
        { name: 'refs', wire: 'refs', source: 'json' },
      ],
      namespace: 'settings',
      method: 'describe',
      parameters: [
      ],
  `)
  const calls = []
  const aiRuntime = {
    async call(endpoint, args) {
      calls.push({ endpoint, args })
      if (endpoint === 'settings/describe') {
        return { namespaces: [{ ns: 'permission', revision: 1, value: { ask: true } }] }
      }
      throw new Error(endpoint)
    },
  }
  const cred = verbs.find((row) => row.endpoint === 'credentials/describe')
  const settings = verbs.find((row) => row.endpoint === 'settings/describe')
  assert.equal(faceArgsComplete(cred, {}), false)
  assert.equal(faceArgsComplete(settings, {}), true)
  const bag = await collectBag(aiRuntime, 'settings', {}, verbs)
  assert.equal(calls[0].endpoint, 'settings/describe')
  assert.deepEqual(calls[0].args, {})
  assert.equal(bag.items[0].id, 'permission')
  assert.equal(bag.error, undefined)
})

test('workspace follow bag maps pin and archive identities', async () => {
  const verbs = verbsFromTypertText(`
      namespace: 'workspace',
      method: 'follow',
      mode: 'stream',
  `)
  const aiRuntime = {
    async *stream() {
      yield { type: 'baseline', value: { pinnedSessionIds: ['p1'], archivedSessionIds: ['a1'] } }
    },
  }
  const bag = await collectBag(aiRuntime, 'workspace', {}, verbs)
  assert.equal(bag.items.length, 2)
  assert.equal(bag.items[0].id, 'p1')
  assert.equal(bag.items[0].fields.pinned, true)
  assert.equal(bag.items[1].id, 'a1')
  assert.equal(bag.items[1].fields.archived, true)
})

test('argsFromFace fills office render priority from params', () => {
  const verbs = verbsFromTypertText(`
      namespace: 'officeToPdf',
      method: 'render',
      parameters: [
        { name: 'workspaceFileScope', wire: 'workspaceFileScopeId', source: 'lookup', lookup: 'workspaceFileScope' },
        { name: 'path', wire: 'path', source: 'json' },
        { name: 'priority', wire: 'priority', source: 'json' },
      ],
  `)
  const render = verbs.find((row) => row.method === 'render')
  assert.deepEqual(argsFromFace(render, { sessionId: 's1', path: 'a.docx', params: { priority: 'foreground' } }), {
    workspaceFileScopeId: 's1',
    path: 'a.docx',
    priority: 'foreground',
  })
})

