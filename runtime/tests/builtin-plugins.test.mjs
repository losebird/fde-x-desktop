import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUILTIN_PLUGINS, builtinBundleNames, builtinStageDirs, pluginEnvKey } from '../builtin-plugins.mjs'
import { PLUGIN_PIN_FILE } from '../plugin-vendor.mjs'
import { DshCoreConnector } from '../dsh-core.mjs'

const IUI = BUILTIN_PLUGINS.find((plugin) => plugin.dir === 'iui')

describe('builtin plugin registry', { concurrency: 1 }, () => {
  test('the table is the bundle and stage list', () => {
    assert.deepEqual(builtinBundleNames(), ['dsh-lan-assist', 'dsh-semantic-os', '@losebird/iui'])
    assert.deepEqual(builtinStageDirs(), ['dsh-lan-assist', 'dsh-semantic-os', 'iui'])
    assert.equal(pluginEnvKey('iui'), 'FDE_PLUGIN_IUI')
    assert.equal(pluginEnvKey('@losebird/iui'), 'FDE_PLUGIN__LOSEBIRD_IUI')
    assert.deepEqual(IUI.modes, ['standard'])
    assert.equal(IUI.source.version, '0.13.0-iui.26')
    assert.equal(IUI.source.commit, 'c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37')
  })

  test('a clean profile links pinned IUI and keeps it across a second start', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-home-'))
    const source = await mkdtemp(join(tmpdir(), 'fde-iui-'))
    const saved = {
      FDE_PLUGIN_IUI: process.env.FDE_PLUGIN_IUI,
      FDE_PLUGIN_DSH_LAN_ASSIST: process.env.FDE_PLUGIN_DSH_LAN_ASSIST,
      FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
    }
    await writePlugin(source, IUI.source)
    await writeFile(join(source, 'marker.txt'), 'source-bytes')
    process.env.FDE_PLUGIN_IUI = source
    process.env.FDE_PLUGIN_DSH_LAN_ASSIST = await tinyPlugin(home, 'lan')
    process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tinyPlugin(home, 'sem')
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      const packagePath = join(home, 'profiles', 'fde-x', 'package.json')
      const manifest = JSON.parse(await readFile(packagePath, 'utf8'))
      assert.ok(manifest.dsh.profile.bundles.includes('@losebird/iui'))
      assert.ok(manifest.dsh.profile.bundles.includes('dsh-lan-assist'))
      const linked = join(home, 'profiles', 'fde-x', 'node_modules', '@losebird', 'iui')
      assert.equal((await lstat(linked)).isSymbolicLink(), true)
      assert.equal(JSON.parse(await readFile(join(linked, 'package.json'), 'utf8')).version, IUI.source.version)
      assert.equal(JSON.parse(await readFile(join(home, 'vendor', 'iui', PLUGIN_PIN_FILE), 'utf8')).commit, IUI.source.commit)
      await writeFile(join(home, 'vendor', 'iui', 'marker.txt'), 'stay')
      const before = await readFile(packagePath, 'utf8')
      await connector.ensureIsolatedProfile()
      assert.equal(await readFile(packagePath, 'utf8'), before)
      assert.equal(await readFile(join(home, 'vendor', 'iui', 'marker.txt'), 'utf8'), 'stay')
      assert.equal(await readFile(join(source, 'marker.txt'), 'utf8'), 'source-bytes')
      assert.equal(connector.state, 'idle')
    } finally {
      restoreEnv(saved)
      await rm(home, { recursive: true, force: true })
      await rm(source, { recursive: true, force: true })
    }
  })

  test('a corrupt profile package.json is not overwritten and the connector errors', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-home-'))
    const packagePath = join(home, 'profiles', 'fde-x', 'package.json')
    const credentials = await mkdtemp(join(tmpdir(), 'fde-cred-'))
    await mkdir(join(home, 'profiles', 'fde-x'), { recursive: true })
    const corrupt = '{"dsh":'
    await writeFile(packagePath, corrupt)
    await writeFile(join(credentials, 'secret'), 'x')
    const connector = new DshCoreConnector({ dshHome: home, cwd: home })
    connector.credentialsDirectory = credentials
    try {
      await assert.rejects(
        () => connector.ensureIsolatedProfile(),
        (error) => error.code === 'FDE_PROFILE_MANIFEST_INVALID',
      )
      assert.equal(await readFile(packagePath, 'utf8'), corrupt)
      assert.equal(connector.state, 'error')
      assert.match(connector.lastError, /无法解析/)
      assert.equal(existsSync(credentials), false)
      assert.equal(existsSync(join(home, 'vendor')), false)
    } finally {
      await rm(home, { recursive: true, force: true })
      await rm(credentials, { recursive: true, force: true })
    }
  })

  test('a missing optional plugin is logged and the profile still installs', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-home-'))
    const saved = {
      FDE_PLUGIN_IUI: process.env.FDE_PLUGIN_IUI,
      FDE_PLUGIN_DSH_LAN_ASSIST: process.env.FDE_PLUGIN_DSH_LAN_ASSIST,
      FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
    }
    const warnings = []
    const originalWarn = console.warn
    console.warn = (...args) => {
      warnings.push(args.map((part) => String(part)).join(' '))
    }
    process.env.FDE_PLUGIN_DSH_LAN_ASSIST = await tinyPlugin(home, 'lan')
    process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tinyPlugin(home, 'sem')
    delete process.env.FDE_PLUGIN_IUI
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      assert.equal(connector.state, 'idle')
      assert.match(connector.lastError, /可选插件 @losebird\/iui 挂载失败：missing-source/)
      assert.match(warnings.join('\n'), /builtin_plugin_link_failed/)
      const manifest = JSON.parse(await readFile(join(home, 'profiles', 'fde-x', 'package.json'), 'utf8'))
      assert.equal(manifest.dsh.profile.bundles.includes('@losebird/iui'), false)
      assert.equal(manifest.dsh.profile.bundles.includes('dsh-lan-assist'), true)
    } finally {
      console.warn = originalWarn
      restoreEnv(saved)
      await rm(home, { recursive: true, force: true })
    }
  })

  test('refresh replaces an unpinned home copy and leaves the source', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-home-'))
    const source = await mkdtemp(join(tmpdir(), 'fde-lan-'))
    const savedRefresh = process.env.FDE_REFRESH_PLUGINS
    const savedLan = process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    const savedSem = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    const savedIui = process.env.FDE_PLUGIN_IUI
    await writeFile(join(source, 'marker.txt'), 'first')
    process.env.FDE_PLUGIN_DSH_LAN_ASSIST = source
    process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tinyPlugin(home, 'sem')
    delete process.env.FDE_PLUGIN_IUI
    delete process.env.FDE_REFRESH_PLUGINS
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      assert.equal(await readFile(join(home, 'vendor', 'dsh-lan-assist', 'marker.txt'), 'utf8'), 'first')
      await writeFile(join(source, 'marker.txt'), 'second')
      process.env.FDE_REFRESH_PLUGINS = '1'
      await connector.ensureIsolatedProfile()
      assert.equal(await readFile(join(home, 'vendor', 'dsh-lan-assist', 'marker.txt'), 'utf8'), 'second')
      assert.equal(await readFile(join(source, 'marker.txt'), 'utf8'), 'second')
    } finally {
      if (savedRefresh === undefined) delete process.env.FDE_REFRESH_PLUGINS
      else process.env.FDE_REFRESH_PLUGINS = savedRefresh
      if (savedLan === undefined) delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
      else process.env.FDE_PLUGIN_DSH_LAN_ASSIST = savedLan
      if (savedSem === undefined) delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
      else process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = savedSem
      if (savedIui === undefined) delete process.env.FDE_PLUGIN_IUI
      else process.env.FDE_PLUGIN_IUI = savedIui
      await rm(home, { recursive: true, force: true })
      await rm(source, { recursive: true, force: true })
    }
  })
})

async function writePlugin(dir, { version, commit }) {
  await writeFile(join(dir, 'package.json'), `${JSON.stringify({ name: '@losebird/iui', version })}\n`)
  await writeFile(join(dir, PLUGIN_PIN_FILE), `${JSON.stringify({ commit })}\n`)
}

async function tinyPlugin(home, name) {
  const dir = join(home, 'fixtures', name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), `${JSON.stringify({ name })}\n`)
  return dir
}

function restoreEnv(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}
