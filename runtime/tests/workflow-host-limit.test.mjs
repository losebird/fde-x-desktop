import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootWorkflowHost, hostPinDir, waitForProbe } from './support/workflow-host.mjs'

const WORKFLOW_TOOLS = ['fde_app_records_propose', 'fde_app_records_query', 'fde_plan_task_propose']

test('真 Host 不把环境里的供应商插件链进普通会话', async () => {
  const plugin = await mkdtemp(join(tmpdir(), 'fde-ambient-plugin-'))
  const saved = process.env.FDE_PLUGIN_DSH_LAN_ASSIST
  process.env.FDE_PLUGIN_DSH_LAN_ASSIST = plugin
  await writeFile(join(plugin, 'package.json'), `${JSON.stringify({ name: 'dsh-lan-assist', version: '0.0.0' })}\n`)
  const host = await bootWorkflowHost()
  try {
    const manifest = JSON.parse(readFileSync(join(host.home, 'profiles', 'fde-workflow-host', 'package.json'), 'utf8'))
    assert.equal(manifest.dsh.profile.bundles.includes('dsh-lan-assist'), false)
  } finally {
    await host.stop()
    if (saved === undefined) delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    else process.env.FDE_PLUGIN_DSH_LAN_ASSIST = saved
    await rm(plugin, { recursive: true, force: true })
  }
})

test('锁文件把 Host pin 固定在 0.2.0-rc.2', () => {
  const lock = JSON.parse(readFileSync(join(hostPinDir(), 'package-lock.json'), 'utf8'))
  assert.equal(lock.packages['node_modules/@deepseek-ai/dsh'].version, '0.2.0-rc.2')
  assert.equal(lock.packages[''].dependencies['@deepseek-ai/dsh'], '0.2.0-rc.2')
})

test('真 Host 上 fde-workflow 会话只看见三个工具', async () => {
  const host = await bootWorkflowHost()
  try {
    await host.core.call('session/create', {
      request: { cwd: host.cwd, agentPreset: 'standard' },
    })
    await host.core.call('session/create', {
      request: { cwd: host.cwd, agentPreset: 'fde-workflow' },
    })
    const standard = await waitForProbe(host.probeDir, 'standard')
    const workflow = await waitForProbe(host.probeDir, 'fde-workflow')
    assert.equal(standard.error, null)
    assert.equal(workflow.error, null)
    assert.equal(standard.names.length, 44)
    assert.deepEqual(workflow.names, WORKFLOW_TOOLS)
  } finally {
    await host.stop()
  }
})

test('真 Host 上无法确认调用方时拒绝 bash', async () => {
  const host = await bootWorkflowHost()
  try {
    await host.core.call('session/create', {
      request: { cwd: host.cwd, agentPreset: 'standard' },
    })
    await host.core.call('session/create', {
      request: { cwd: host.cwd, agentPreset: 'fde-workflow' },
    })
    const standard = await waitForProbe(host.probeDir, 'standard')
    const workflow = await waitForProbe(host.probeDir, 'fde-workflow')
    assert.equal(standard.names.length, 44)
    assert.equal(standard.bashWithAgent.isError, false)
    assert.match(standard.bashWithAgent.text, /^RAN/)
    const denied = 'Error: 工作流步骤不能调用这个工具'
    assert.deepEqual({
      bash: workflow.bashNoAgent.text,
      spec: workflow.specNoAgent.text,
    }, {
      bash: denied,
      spec: denied,
    })
  } finally {
    await host.stop()
  }
})
