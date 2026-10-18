import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bootWorkflowHost, hostPinDir, waitForProbe } from './support/workflow-host.mjs'

const WORKFLOW_TOOLS = ['fde_app_records_propose', 'fde_app_records_query', 'fde_plan_task_propose']

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
