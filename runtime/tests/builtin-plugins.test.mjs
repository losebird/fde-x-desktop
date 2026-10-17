import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cp, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IUI_PIN } from '../../scripts/pack/pins.mjs'
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
    assert.equal(IUI.source.version, '0.13.0-iui.27')
    assert.equal(IUI.source.commit, '10db57b326a228e19e3093fcd694ae2ac5951408')
    assert.equal(IUI.source.sha256, 'c171f532ccd01e3b66272d9a364aefaaef7cd47dd37bcc4dd5444991998b634c')
  })

  test('the iui row is loaded from pins.mjs', async () => {
    const source = await readFile(new URL('../builtin-plugins.mjs', import.meta.url), 'utf8')
    assert.equal(source.includes(IUI_PIN.commit), false)
    assert.equal(source.includes(IUI_PIN.artifact.sha256), false)
    assert.match(source, /from '\.\.\/scripts\/pack\/pins\.mjs'/)
    assert.equal(IUI.source.version, IUI_PIN.version)
    assert.equal(IUI.source.commit, IUI_PIN.commit)
    assert.equal(IUI.source.sha256, IUI_PIN.artifact.sha256)
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

  test('a fresh profile stages the vendor tar and a bad sha is not swallowed', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-home-'))
    const { archive, sha } = await fixtureArchive(home, IUI.source.version, IUI.source.commit)
    const savedSha = IUI.source.sha256
    const saved = {
      FDE_PLUGIN_IUI: process.env.FDE_PLUGIN_IUI,
      FDE_PLUGIN_DSH_LAN_ASSIST: process.env.FDE_PLUGIN_DSH_LAN_ASSIST,
      FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
      FDE_IUI_ARTIFACT: process.env.FDE_IUI_ARTIFACT,
    }
    delete process.env.FDE_PLUGIN_IUI
    process.env.FDE_PLUGIN_DSH_LAN_ASSIST = await tinyPlugin(home, 'lan')
    process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tinyPlugin(home, 'sem')
    process.env.FDE_IUI_ARTIFACT = archive
    IUI.source.sha256 = sha
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      const linked = join(home, 'profiles', 'fde-x', 'node_modules', '@losebird', 'iui', 'package.json')
      assert.equal(JSON.parse(await readFile(linked, 'utf8')).version, IUI.source.version)
      assert.equal(connector.lastError, null)
      const bad = join(home, 'bad.tar.gz')
      const bytes = Buffer.from(await readFile(archive))
      bytes[bytes.length - 1] ^= 0xff
      await writeFile(bad, bytes)
      const empty = await mkdtemp(join(tmpdir(), 'fde-home-'))
      process.env.FDE_IUI_ARTIFACT = bad
      IUI.source.sha256 = savedSha
      const again = new DshCoreConnector({ dshHome: empty, cwd: empty })
      await again.ensureIsolatedProfile()
      assert.equal(again.state, 'idle')
      assert.equal(again.iui.state, 'verify_failed')
      assert.equal(again.iui.expected, savedSha)
      assert.match(again.iui.actual, /^[a-f0-9]{64}$/u)
      assert.notEqual(again.iui.actual, savedSha)
      assert.equal(again.iui.artifactPath, bad)
      assert.equal(again.iui.command, 'node scripts/pack/build-iui.mjs --out ~/.dsh/vendor/iui')
      assert.equal(existsSync(join(empty, 'vendor', 'iui', 'package.json')), false)
      const { stageIuiArtifactIfAbsent } = await import('../iui-stage.mjs')
      const kept = join(empty, 'kept-iui')
      await mkdir(kept, { recursive: true })
      await writeFile(join(kept, 'package.json'), 'KEPT\n')
      const keptResult = await stageIuiArtifactIfAbsent({
        dest: kept,
        pin: {
          version: IUI.source.version,
          commit: IUI.source.commit,
          artifact: { sha256: savedSha },
        },
        artifactPath: bad,
      })
      assert.equal(keptResult.state, 'kept')
      assert.equal(await readFile(join(kept, 'package.json'), 'utf8'), 'KEPT\n')
      await rm(empty, { recursive: true, force: true })
    } finally {
      IUI.source.sha256 = savedSha
      restoreEnv(saved)
      await rm(home, { recursive: true, force: true })
    }
  })

  test('a dev vendor symlink keeps the tar and stages IUI beside it', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-home-'))
    const shared = await mkdtemp(join(tmpdir(), 'fde-shared-'))
    const { archive, sha } = await fixtureArchive(home, IUI.source.version, IUI.source.commit)
    const artifactName = `iui-${IUI.source.commit}.tar.gz`
    const artifactDir = join(shared, 'iui')
    await mkdir(artifactDir, { recursive: true })
    await cp(archive, join(artifactDir, artifactName))
    await symlink(shared, join(home, 'vendor'))
    const savedSha = IUI.source.sha256
    const saved = {
      FDE_PLUGIN_IUI: process.env.FDE_PLUGIN_IUI,
      FDE_PLUGIN_DSH_LAN_ASSIST: process.env.FDE_PLUGIN_DSH_LAN_ASSIST,
      FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
      FDE_IUI_ARTIFACT: process.env.FDE_IUI_ARTIFACT,
      FDE_VENDOR_DIR: process.env.FDE_VENDOR_DIR,
    }
    delete process.env.FDE_PLUGIN_IUI
    delete process.env.FDE_IUI_ARTIFACT
    process.env.FDE_VENDOR_DIR = shared
    process.env.FDE_PLUGIN_DSH_LAN_ASSIST = await tinyPlugin(home, 'lan')
    process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tinyPlugin(home, 'sem')
    IUI.source.sha256 = sha
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      assert.equal(existsSync(join(artifactDir, artifactName)), true)
      assert.equal(existsSync(join(artifactDir, 'package.json')), false)
      const linked = join(home, 'profiles', 'fde-x', 'node_modules', '@losebird', 'iui', 'package.json')
      assert.equal(JSON.parse(await readFile(linked, 'utf8')).version, IUI.source.version)
      assert.equal(JSON.parse(await readFile(join(home, 'pinned', 'iui', 'package.json'), 'utf8')).version, IUI.source.version)
    } finally {
      IUI.source.sha256 = savedSha
      restoreEnv(saved)
      await rm(home, { recursive: true, force: true })
      await rm(shared, { recursive: true, force: true })
    }
  })

  test('an existing profile tree is not replaced by the vendor tar', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-home-'))
    const { archive } = await fixtureArchive(home, IUI.source.version, IUI.source.commit)
    const vendor = join(home, 'vendor', 'iui')
    await mkdir(vendor, { recursive: true })
    await writeFile(join(vendor, 'package.json'), `${JSON.stringify({ name: '@losebird/iui', version: 'user-copy' })}\n`)
    await writeFile(join(vendor, 'marker.txt'), 'user-bytes')
    const saved = {
      FDE_PLUGIN_IUI: process.env.FDE_PLUGIN_IUI,
      FDE_PLUGIN_DSH_LAN_ASSIST: process.env.FDE_PLUGIN_DSH_LAN_ASSIST,
      FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
      FDE_IUI_ARTIFACT: process.env.FDE_IUI_ARTIFACT,
    }
    delete process.env.FDE_PLUGIN_IUI
    process.env.FDE_PLUGIN_DSH_LAN_ASSIST = await tinyPlugin(home, 'lan')
    process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tinyPlugin(home, 'sem')
    const bytes = Buffer.from(await readFile(archive))
    bytes[bytes.length - 1] ^= 0xff
    const bad = join(home, 'bad.tar.gz')
    await writeFile(bad, bytes)
    process.env.FDE_IUI_ARTIFACT = bad
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      assert.equal(await readFile(join(vendor, 'marker.txt'), 'utf8'), 'user-bytes')
      assert.equal(JSON.parse(await readFile(join(vendor, 'package.json'), 'utf8')).version, 'user-copy')
      assert.match(connector.lastError, /missing-source/)
    } finally {
      restoreEnv(saved)
      await rm(home, { recursive: true, force: true })
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

async function fixtureArchive(home, version, commit) {
  const tree = join(home, 'fixture-tree')
  await mkdir(join(tree, 'lib'), { recursive: true })
  await mkdir(join(tree, 'node_modules', 'left-pad'), { recursive: true })
  await writeFile(join(tree, 'package.json'), JSON.stringify({
    name: '@losebird/iui',
    version,
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { inject: [] } },
  }))
  await writeFile(join(tree, 'lib', 'index.js'), 'export {}\n')
  await writeFile(join(tree, 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1\n')
  await writeFile(join(tree, PLUGIN_PIN_FILE), JSON.stringify({ commit }))
  const archive = join(home, 'iui.tar.gz')
  execFileSync('tar', ['-czf', archive, '-C', tree, '.'])
  const sha = createHash('sha256').update(await readFile(archive)).digest('hex')
  return { archive, sha }
}

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
