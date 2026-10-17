import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { inspectAdapters } from '../adapters.mjs'
import { DshCoreConnector } from '../dsh-core.mjs'
import { describeIui, iuiBuiltin, iuiProfileDir, iuiStatusPhrase } from '../iui-status.mjs'

const pin = iuiBuiltin().source.version
const installing = {
  state: 'installing',
  phase: 'stage',
  progress: { completed: 0, total: 4 },
}

test('an in-progress install is not reported as missing', () => {
  const phrase = iuiStatusPhrase({
    present: false,
    pinVersion: pin,
    verification: installing,
  })
  assert.equal(phrase, '正在首次安装… 校验归档 0/4')
  assert.equal(phrase.includes('未安装'), false)
  assert.equal(phrase.includes('pnpm dev'), false)
})

test('only a real install failure asks for a retry', () => {
  const phrase = iuiStatusPhrase({
    present: false,
    pinVersion: pin,
    verification: { state: 'failed', reason: '归档不存在' },
  })
  assert.equal(phrase, 'IUI 安装失败：归档不存在。请重试。')
  assert.equal(phrase.includes('pnpm dev'), false)
})

test('health exposes the installing record while the core is starting', async () => {
  const runtime = {
    iui: installing,
    dshHome: '/tmp/does-not-exist-iui-install',
    status() {
      return { connected: false, state: 'starting', version: '0.2.0-rc.2', pid: null }
    },
  }
  const phrase = await describeIui(runtime, runtime.dshHome, 'fde-x')
  assert.equal(phrase, '正在首次安装… 校验归档 0/4')
  const rows = await inspectAdapters({ aiRuntime: runtime })
  const ai = rows.find((row) => row.capability === 'ai-runtime')
  assert.equal(ai.iui.state, 'installing')
  assert.equal(ai.iui.phase, 'stage')
  assert.deepEqual(ai.iui.progress, { completed: 0, total: 4 })
  assert.equal(String(ai.detail).includes('正在首次安装'), true)
  assert.equal(String(ai.detail).includes('IUI 未安装'), false)
  assert.equal(String(ai.detail).includes('pnpm dev'), false)
})

test('three overlapping starts publish installing once', async () => {
  const connector = Object.create(DshCoreConnector.prototype)
  connector.state = 'idle'
  connector.startPromise = null
  connector.iui = { state: 'absent' }
  connector.dshHome = '/tmp/does-not-exist-iui-install'
  connector.profileName = 'fde-x'
  let calls = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  connector.startInternal = async function startInternal() {
    calls += 1
    await gate
    this.state = 'connected'
    return { connected: true }
  }
  const pending = Promise.all([connector.start(), connector.start(), connector.start()])
  try {
    assert.equal(calls, 1)
    assert.equal(connector.iui.state, 'installing')
    assert.equal(connector.iui.phase, 'stage')
    assert.deepEqual(connector.iui.progress, { completed: 0, total: 4 })
  } finally {
    release()
  }
  await pending
  assert.equal(calls, 1)
})

test('a finished install becomes enabled once the plugin list says so', async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-iui-enable-'))
  const dir = iuiProfileDir(home, 'fde-x')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '@losebird/iui', version: pin }))
  const runtime = {
    iui: { state: 'installing', phase: 'enable', progress: { completed: 3, total: 4 } },
    dshHome: home,
    status: () => ({ connected: true, state: 'connected', version: '0.2.0-rc.2', pid: 9 }),
    async call(endpoint) {
      assert.equal(endpoint, 'pluginManager/listPlugins')
      return [{ moduleName: '@losebird/iui', enabled: true }]
    },
  }
  try {
    const phrase = await describeIui(runtime, home, 'fde-x')
    assert.equal(phrase, `IUI ${pin} · 已启用（标准对话）`)
    assert.equal(runtime.iui.state, 'enabled')
    assert.equal(runtime.iui.version, pin)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
