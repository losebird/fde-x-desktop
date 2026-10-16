import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { inspectAdapters } from '../adapters.mjs'
import {
  describeIui,
  iuiBuiltin,
  iuiEnabledFromList,
  iuiStatusPhrase,
  readInstalledIui,
} from '../iui-status.mjs'

const pin = iuiBuiltin().source.version

test('iui status names the failed check', () => {
  assert.equal(iuiStatusPhrase({ present: false, pinVersion: pin }), 'IUI 未安装')
  assert.equal(
    iuiStatusPhrase({ present: true, parseError: true, pinVersion: pin }),
    'IUI 的 package.json 无法解析',
  )
  assert.equal(
    iuiStatusPhrase({ present: true, version: '0.0.0', pinVersion: pin, connected: true, enabled: true }),
    `IUI 版本不符（安装 0.0.0，钉 ${pin}）`,
  )
  assert.equal(
    iuiStatusPhrase({ present: true, version: pin, pinVersion: pin, connected: false }),
    `IUI ${pin} 尚未连接，未能读取启用状态`,
  )
  assert.equal(
    iuiStatusPhrase({ present: true, version: pin, pinVersion: pin, connected: true, readError: 'boom' }),
    `IUI ${pin} 未能读取启用状态：boom`,
  )
  assert.equal(
    iuiStatusPhrase({ present: true, version: pin, pinVersion: pin, connected: true, enabled: null }),
    `IUI ${pin} 的插件列表格式无法识别`,
  )
  assert.equal(
    iuiStatusPhrase({ present: true, version: pin, pinVersion: pin, connected: true, enabled: false }),
    `IUI ${pin} 未启用`,
  )
  assert.equal(
    iuiStatusPhrase({ present: true, version: pin, pinVersion: pin, connected: true, enabled: true }),
    `IUI ${pin} · 已启用（标准对话）`,
  )
})

test('listPlugins row enables IUI only when that module is enabled', () => {
  assert.equal(iuiEnabledFromList([
    { entryId: 'include:iui', moduleName: '@losebird/iui', enabled: true, patchId: 'iui' },
  ], '@losebird/iui'), true)
  assert.equal(iuiEnabledFromList([
    { moduleName: '@losebird/iui', enabled: false },
  ], '@losebird/iui'), false)
  assert.equal(iuiEnabledFromList([], '@losebird/iui'), false)
  assert.equal(iuiEnabledFromList({ plugins: 'nope' }, '@losebird/iui'), null)
})

test('a corrupt installed package.json is not treated as missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-iui-status-'))
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'package.json'), '{')
  const installed = await readInstalledIui(root)
  assert.equal(installed.present, true)
  assert.equal(installed.parseError, true)
})

test('the AI core row carries an enabled IUI phrase', async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-iui-adapt-'))
  const profile = process.env.FDE_DSH_PROFILE || 'fde-x'
  const dir = join(home, 'profiles', profile, 'node_modules', '@losebird', 'iui')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '@losebird/iui', version: pin }))
  const rows = await inspectAdapters({
    aiRuntime: {
      dshHome: home,
      status: () => ({ connected: true, state: 'connected', version: '0.2.0-rc.2', pid: 9 }),
      call: async (endpoint) => {
        assert.equal(endpoint, 'pluginManager/listPlugins')
        return [{ entryId: 'include:iui', moduleName: '@losebird/iui', enabled: true, patchId: 'iui' }]
      },
    },
  })
  const ai = rows.find((row) => row.capability === 'ai-runtime')
  assert.match(ai.detail, /核心 AI 运行时已接通/)
  assert.match(ai.detail, new RegExp(`IUI ${pin.replaceAll('.', '\\.')} · 已启用（标准对话）`))
  const others = rows.filter((row) => row.capability !== 'ai-runtime')
  assert.equal(others.some((row) => String(row.detail).includes('IUI')), false)
})

test('describeIui reports a missing profile link', async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-iui-missing-'))
  const phrase = await describeIui({
    status: () => ({ connected: true }),
    call: async () => {
      throw new Error('should not list')
    },
  }, home, 'fde-x')
  assert.equal(phrase, 'IUI 未安装')
})
