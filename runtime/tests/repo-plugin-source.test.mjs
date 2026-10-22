import './support/no-stray-processes.mjs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUILTIN_PLUGINS } from '../builtin-plugins.mjs'
import { IUI_PIN } from '../iui-pin.mjs'
import { DshCoreConnector } from '../dsh-core.mjs'

const self = fileURLToPath(import.meta.url)
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

async function writeIui(home) {
  const dir = join(home, 'fixtures', 'iui')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), `${JSON.stringify({ name: '@losebird/iui', version: IUI_PIN.version })}\n`)
  await writeFile(join(dir, 'fde-plugin-pin.json'), `${JSON.stringify({ commit: IUI_PIN.commit })}\n`)
  return dir
}

async function tiny(home, name) {
  const dir = join(home, 'fixtures', name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), `${JSON.stringify({ name })}\n`)
  return dir
}

function shaFile(file) {
  return createHash('sha256').update(existsSync(file) ? readFileSync(file) : '').digest('hex')
}

async function runCase(name) {
  const home = await mkdtemp(join(tmpdir(), 'fde-pr4-'))
  const emptyVendor = await mkdtemp(join(tmpdir(), 'fde-empty-vendor-'))
  const saved = {
    FDE_PLUGIN_IUI: process.env.FDE_PLUGIN_IUI,
    FDE_PLUGIN_DSH_LAN_ASSIST: process.env.FDE_PLUGIN_DSH_LAN_ASSIST,
    FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
    FDE_IUI_ARTIFACT: process.env.FDE_IUI_ARTIFACT,
    FDE_REFRESH_PLUGINS: process.env.FDE_REFRESH_PLUGINS,
    FDE_VENDOR_DIR: process.env.FDE_VENDOR_DIR,
  }
  delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
  delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
  delete process.env.FDE_IUI_ARTIFACT
  delete process.env.FDE_REFRESH_PLUGINS
  process.env.FDE_VENDOR_DIR = emptyVendor
  process.env.FDE_PLUGIN_IUI = await writeIui(home)
  try {
    if (name === 'clean') return await cleanCase(home)
    if (name === 'upgrade') return await upgradeCase(home)
    if (name === 'symlink') return await symlinkCase(home)
    if (name === 'missing-index') return await missingIndexCase(home)
    if (name === 'missing-nats') return await missingNatsCase(home)
    if (name === 'deleted-nats') return await deletedNatsCase(home)
    throw new Error(`unknown case ${name}`)
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(home, { recursive: true, force: true })
    await rm(emptyVendor, { recursive: true, force: true })
  }
}

async function cleanCase(home) {
  const connector = new DshCoreConnector({ dshHome: home, cwd: home })
  await connector.ensureIsolatedProfile()
  const manifest = JSON.parse(await readFile(join(home, 'profiles', 'fde-x', 'package.json'), 'utf8'))
  const installed = join(home, 'vendor', 'dsh-lan-assist', 'index.js')
  const repoFile = join(repoRoot, 'runtime', 'plugins', 'dsh-lan-assist', 'index.js')
  return {
    state: connector.state,
    lastError: connector.lastError,
    bundles: manifest.dsh.profile.bundles,
    lanMatch: shaFile(installed) === shaFile(repoFile),
    semExists: existsSync(join(home, 'vendor', 'dsh-semantic-os', 'index.js')),
  }
}

async function upgradeCase(home) {
  const dest = join(home, 'vendor', 'dsh-semantic-os')
  await mkdir(join(dest, 'runtime-dist'), { recursive: true })
  await writeFile(join(dest, 'runtime-dist', 'keep.txt'), 'keep-runtime-dist\n')
  await writeFile(join(dest, 'runtime-install.js'), 'stale\n')
  const connector = new DshCoreConnector({ dshHome: home, cwd: home })
  await connector.ensureIsolatedProfile()
  const installed = await readFile(join(dest, 'runtime-install.js'), 'utf8')
  const repoFile = await readFile(join(repoRoot, 'runtime', 'plugins', 'dsh-semantic-os', 'runtime-install.js'), 'utf8')
  return {
    state: connector.state,
    lastError: connector.lastError,
    keep: await readFile(join(dest, 'runtime-dist', 'keep.txt'), 'utf8'),
    replaced: installed === repoFile,
  }
}

async function hashDir(dir) {
  const { readdir, readFile, lstat } = await import('node:fs/promises')
  const files = []
  const walk = async (current) => {
    for (const name of await readdir(current)) {
      const path = join(current, name)
      const st = await lstat(path)
      if (st.isSymbolicLink()) continue
      if (st.isDirectory()) await walk(path)
      else files.push(path)
    }
  }
  await walk(dir)
  files.sort()
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file.slice(dir.length))
    hash.update(await readFile(file))
  }
  return hash.digest('hex')
}

async function symlinkCase(home) {
  const userVendor = await mkdtemp(join(tmpdir(), 'fde-user-vendor-'))
  const userPlugin = join(userVendor, 'dsh-semantic-os')
  await mkdir(join(userPlugin, 'runtime-dist'), { recursive: true })
  await writeFile(join(userPlugin, 'runtime-dist', 'keep.txt'), 'user-dist\n')
  await writeFile(join(userPlugin, 'canary.txt'), 'user-secret\n')
  await mkdir(join(home, 'vendor'), { recursive: true })
  await rm(join(home, 'vendor'), { recursive: true, force: true })
  await symlink(userVendor, join(home, 'vendor'))
  const before = await hashDir(userVendor)
  const connector = new DshCoreConnector({ dshHome: home, cwd: home })
  await connector.ensureIsolatedProfile()
  const after = await hashDir(userVendor)
  const homeKeep = join(home, 'vendor', 'dsh-semantic-os', 'runtime-dist', 'keep.txt')
  const st = await lstat(join(home, 'vendor'))
  const result = {
    state: connector.state,
    lastError: connector.lastError,
    userUntouched: before === after,
    homeKeep: existsSync(homeKeep) ? await readFile(homeKeep, 'utf8') : '',
    vendorIsLink: st.isSymbolicLink(),
  }
  await rm(userVendor, { recursive: true, force: true })
  return result
}

async function missingIndexCase(home) {
  const fixture = await mkdtemp(join(tmpdir(), 'fde-lan-fixture-'))
  await cp(join(repoRoot, 'runtime', 'plugins', 'dsh-lan-assist'), fixture, {
    recursive: true,
    filter: (src) => !src.split('/').includes('node_modules'),
  })
  await rm(join(fixture, 'index.js'), { force: true })
  process.env.FDE_PLUGIN_DSH_LAN_ASSIST = fixture
  process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tiny(home, 'sem')
  const connector = new DshCoreConnector({ dshHome: home, cwd: home })
  await connector.ensureIsolatedProfile()
  await rm(fixture, { recursive: true, force: true })
  return { state: connector.state, lastError: connector.lastError }
}

async function deletedNatsCase(home) {
  const fixture = await mkdtemp(join(tmpdir(), 'fde-lan-delnats-'))
  await cp(join(repoRoot, 'runtime', 'plugins', 'dsh-lan-assist'), fixture, {
    recursive: true,
    filter: (src) => !src.split('/').includes('.git'),
  })
  await rm(join(fixture, 'node_modules', 'nats'), { recursive: true, force: true })
  process.env.FDE_PLUGIN_DSH_LAN_ASSIST = fixture
  process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tiny(home, 'sem')
  const connector = new DshCoreConnector({ dshHome: home, cwd: home })
  await connector.ensureIsolatedProfile()
  await rm(fixture, { recursive: true, force: true })
  return { state: connector.state, lastError: connector.lastError }
}

async function missingNatsCase(home) {
  const fixture = await mkdtemp(join(tmpdir(), 'fde-lan-nonats-'))
  await cp(join(repoRoot, 'runtime', 'plugins', 'dsh-lan-assist'), fixture, {
    recursive: true,
    filter: (src) => !src.split('/').includes('node_modules'),
  })
  process.env.FDE_PLUGIN_DSH_LAN_ASSIST = fixture
  process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = await tiny(home, 'sem')
  const connector = new DshCoreConnector({ dshHome: home, cwd: home })
  await connector.ensureIsolatedProfile()
  await rm(fixture, { recursive: true, force: true })
  return { state: connector.state, lastError: connector.lastError }
}

if (process.env.PR4_CASE) {
  runCase(process.env.PR4_CASE).then((result) => {
    process.stdout.write(JSON.stringify(result))
  }).catch((error) => {
    process.stderr.write(String(error && error.stack || error))
    process.exit(1)
  })
} else {
  let gate = Promise.resolve()
  function exclusive(fn) {
    const run = gate.then(fn, fn)
    gate = run.then(() => {}, () => {})
    return run
  }

  function child(name) {
    return exclusive(() => {
      const emptyVendor = mkdtempSync(join(tmpdir(), 'fde-empty-vendor-'))
      const env = { ...process.env, PR4_CASE: name, FDE_VENDOR_DIR: emptyVendor }
      delete env.FDE_PLUGIN_DSH_LAN_ASSIST
      delete env.FDE_PLUGIN_DSH_SEMANTIC_OS
      delete env.FDE_PLUGIN_IUI
      delete env.FDE_IUI_ARTIFACT
      delete env.FDE_REFRESH_PLUGINS
      delete env.FDE_REPO_PLUGINS
      const ran = spawnSync(process.execPath, [self], { env, encoding: 'utf8', timeout: 180000 })
      rm(emptyVendor, { recursive: true, force: true }).catch(() => {})
      assert.equal(ran.status, 0, ran.stderr || ran.stdout)
      return JSON.parse(ran.stdout)
    })
  }

  test('a git checkout passed in FDE_PLUGIN_* is not the install body', () => {
    const checkout = mkdtempSync(join(tmpdir(), 'fde-pin-checkout-'))
    writeFileSync(join(checkout, '.git'), 'gitdir: fake\n')
    const saved = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = checkout
    try {
      const connector = new DshCoreConnector({ dshHome: checkout, cwd: checkout })
      const sem = BUILTIN_PLUGINS.find((plugin) => plugin.dir === 'dsh-semantic-os')
      assert.equal(
        connector.repoPluginSource(sem),
        join(repoRoot, 'runtime', 'plugins', 'dsh-semantic-os'),
      )
    } finally {
      if (saved === undefined) delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
      else process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = saved
      rmSync(checkout, { recursive: true, force: true })
    }
  })

  test('FDE_REPO_PLUGINS=0 keeps an explicit install body and skips a git checkout', async () => exclusive(async () => {
    const home = mkdtempSync(join(tmpdir(), 'fde-repo-switch-'))
    const emptyVendor = mkdtempSync(join(tmpdir(), 'fde-empty-vendor-'))
    const body = mkdtempSync(join(tmpdir(), 'fde-lan-body-'))
    const checkout = mkdtempSync(join(tmpdir(), 'fde-sem-checkout-'))
    writeFileSync(join(body, 'package.json'), `${JSON.stringify({ name: 'dsh-lan-assist' })}\n`)
    writeFileSync(join(body, 'index.js'), 'export {}\n')
    writeFileSync(join(checkout, '.git'), 'gitdir: fake\n')
    writeFileSync(join(checkout, 'package.json'), `${JSON.stringify({ name: 'dsh-semantic-os' })}\n`)
    writeFileSync(join(checkout, 'index.js'), 'export {}\n')
    const saved = {
      FDE_VENDOR_DIR: process.env.FDE_VENDOR_DIR,
      FDE_PLUGIN_IUI: process.env.FDE_PLUGIN_IUI,
      FDE_PLUGIN_DSH_LAN_ASSIST: process.env.FDE_PLUGIN_DSH_LAN_ASSIST,
      FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
      FDE_IUI_ARTIFACT: process.env.FDE_IUI_ARTIFACT,
      FDE_REFRESH_PLUGINS: process.env.FDE_REFRESH_PLUGINS,
      FDE_REPO_PLUGINS: process.env.FDE_REPO_PLUGINS,
    }
    process.env.FDE_VENDOR_DIR = emptyVendor
    process.env.FDE_PLUGIN_IUI = await writeIui(home)
    process.env.FDE_PLUGIN_DSH_LAN_ASSIST = body
    process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = checkout
    process.env.FDE_REPO_PLUGINS = '0'
    delete process.env.FDE_IUI_ARTIFACT
    delete process.env.FDE_REFRESH_PLUGINS
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      const manifest = JSON.parse(readFileSync(join(home, 'profiles', 'fde-x', 'package.json'), 'utf8'))
      assert.equal(connector.state, 'idle', connector.lastError || '')
      assert.equal(manifest.dsh.profile.bundles.includes('dsh-lan-assist'), true)
      assert.equal(manifest.dsh.profile.bundles.includes('dsh-semantic-os'), false)
      assert.equal(readFileSync(join(home, 'vendor', 'dsh-lan-assist', 'index.js'), 'utf8'), 'export {}\n')
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      rmSync(home, { recursive: true, force: true })
      rmSync(emptyVendor, { recursive: true, force: true })
      rmSync(body, { recursive: true, force: true })
      rmSync(checkout, { recursive: true, force: true })
    }
  }))

  test('repo kind points at runtime/plugins', () => {
    const lan = BUILTIN_PLUGINS.find((plugin) => plugin.dir === 'dsh-lan-assist')
    const sem = BUILTIN_PLUGINS.find((plugin) => plugin.dir === 'dsh-semantic-os')
    assert.equal(lan.source.kind, 'repo')
    assert.equal(lan.source.path, 'runtime/plugins/dsh-lan-assist')
    assert.equal(sem.source.kind, 'repo')
    assert.equal(sem.source.path, 'runtime/plugins/dsh-semantic-os')
    const dev = readFileSync(join(repoRoot, 'scripts', 'dev.mjs'), 'utf8')
    const peer = readFileSync(join(repoRoot, 'scripts', 'dev-peer.mjs'), 'utf8')
    assert.equal(dev.includes('linkVendorTarget'), false)
    assert.equal(peer.includes('linkVendorTarget'), false)
  })

  test('clean home links both plugins from runtime/plugins with no vendor directory', async () => {
    const got = await child('clean')
    assert.equal(got.state, 'idle')
    assert.equal(got.lastError, null)
    assert.equal(got.lanMatch, true)
    assert.equal(got.semExists, true)
    assert.equal(got.bundles.includes('dsh-lan-assist'), true)
    assert.equal(got.bundles.includes('dsh-semantic-os'), true)
  })

  test('upgrade keeps runtime-dist and replaces plugin bytes', async () => {
    const got = await child('upgrade')
    assert.equal(got.state, 'idle')
    assert.equal(got.lastError, null)
    assert.equal(got.keep, 'keep-runtime-dist\n')
    assert.equal(got.replaced, true)
  })

  test('old vendor symlink is not written through and runtime-dist is kept', async () => {
    const got = await child('symlink')
    assert.equal(got.userUntouched, true)
    assert.equal(got.vendorIsLink, false)
    assert.equal(got.homeKeep, 'user-dist\n')
    assert.equal(got.state, 'idle')
    assert.equal(got.lastError, null)
  })

  test('missing repo plugin sets state error', async () => {
    const got = await child('missing-index')
    assert.equal(got.state, 'error')
    assert.match(got.lastError, /index\.js/)
  })

  test('missing nats sets connector error', async () => {
    const got = await child('missing-nats')
    assert.equal(got.state, 'error')
    assert.match(got.lastError, /NATS_DEPENDENCY_MISSING/)
    assert.equal(/NO_NATS/.test(got.lastError || ''), false)
  })

  test('deleting nats from a temp copy sets connector error', async () => {
    const got = await child('deleted-nats')
    assert.equal(got.state, 'error')
    assert.match(got.lastError, /NATS_DEPENDENCY_MISSING/)
    assert.equal(/NO_NATS/.test(got.lastError || ''), false)
  })

  test('a changed lock after a ready profile is an error', async () => exclusive(async () => {
    const lockPath = join(repoRoot, 'runtime', 'plugins', 'plugins.lock.json')
    const raw = readFileSync(lockPath)
    const home = await mkdtemp(join(tmpdir(), 'fde-pr4-lock-'))
    const emptyVendor = await mkdtemp(join(tmpdir(), 'fde-empty-vendor-'))
    const savedVendor = process.env.FDE_VENDOR_DIR
    const savedIui = process.env.FDE_PLUGIN_IUI
    const savedLan = process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    const savedSem = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    const savedArtifact = process.env.FDE_IUI_ARTIFACT
    const savedRefresh = process.env.FDE_REFRESH_PLUGINS
    delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    delete process.env.FDE_IUI_ARTIFACT
    delete process.env.FDE_REFRESH_PLUGINS
    process.env.FDE_VENDOR_DIR = emptyVendor
    process.env.FDE_PLUGIN_IUI = await writeIui(home)
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      assert.equal(connector.state, 'idle')
      assert.equal(connector.lastError, null)
      const next = raw.toString('utf8').replace(
        /("runtime\/plugins\/dsh-lan-assist\/index\.js": ")([0-9a-f]{64})(")/,
        (_, prefix, hex, suffix) => `${prefix}${hex.slice(0, -1)}${hex.endsWith('0') ? '1' : '0'}${suffix}`,
      )
      assert.notEqual(next, raw.toString('utf8'))
      writeFileSync(lockPath, next)
      await connector.ensureIsolatedProfile()
      assert.equal(connector.state, 'error')
      assert.match(connector.lastError, /mismatch index\.js/)
    } finally {
      writeFileSync(lockPath, raw)
      if (savedVendor === undefined) delete process.env.FDE_VENDOR_DIR
      else process.env.FDE_VENDOR_DIR = savedVendor
      if (savedIui === undefined) delete process.env.FDE_PLUGIN_IUI
      else process.env.FDE_PLUGIN_IUI = savedIui
      if (savedLan === undefined) delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
      else process.env.FDE_PLUGIN_DSH_LAN_ASSIST = savedLan
      if (savedSem === undefined) delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
      else process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = savedSem
      if (savedArtifact === undefined) delete process.env.FDE_IUI_ARTIFACT
      else process.env.FDE_IUI_ARTIFACT = savedArtifact
      if (savedRefresh === undefined) delete process.env.FDE_REFRESH_PLUGINS
      else process.env.FDE_REFRESH_PLUGINS = savedRefresh
      await rm(home, { recursive: true, force: true })
      await rm(emptyVendor, { recursive: true, force: true })
    }
  }))

  test('deleting installed nats after a ready profile is an error', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-pr4-nats-'))
    const emptyVendor = await mkdtemp(join(tmpdir(), 'fde-empty-vendor-'))
    const savedVendor = process.env.FDE_VENDOR_DIR
    const savedIui = process.env.FDE_PLUGIN_IUI
    const savedLan = process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    const savedSem = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    const savedArtifact = process.env.FDE_IUI_ARTIFACT
    const savedRefresh = process.env.FDE_REFRESH_PLUGINS
    delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    delete process.env.FDE_IUI_ARTIFACT
    delete process.env.FDE_REFRESH_PLUGINS
    process.env.FDE_VENDOR_DIR = emptyVendor
    process.env.FDE_PLUGIN_IUI = await writeIui(home)
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      assert.equal(connector.state, 'idle')
      const natsDir = join(home, 'vendor', 'dsh-lan-assist', 'node_modules', 'nats')
      rmSync(natsDir, { recursive: true, force: true })
      await connector.ensureIsolatedProfile()
      assert.equal(connector.state, 'error')
      assert.match(connector.lastError, /NATS_DEPENDENCY_MISSING/)
      assert.equal(existsSync(natsDir), false)
    } finally {
      if (savedVendor === undefined) delete process.env.FDE_VENDOR_DIR
      else process.env.FDE_VENDOR_DIR = savedVendor
      if (savedIui === undefined) delete process.env.FDE_PLUGIN_IUI
      else process.env.FDE_PLUGIN_IUI = savedIui
      if (savedLan === undefined) delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
      else process.env.FDE_PLUGIN_DSH_LAN_ASSIST = savedLan
      if (savedSem === undefined) delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
      else process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = savedSem
      if (savedArtifact === undefined) delete process.env.FDE_IUI_ARTIFACT
      else process.env.FDE_IUI_ARTIFACT = savedArtifact
      if (savedRefresh === undefined) delete process.env.FDE_REFRESH_PLUGINS
      else process.env.FDE_REFRESH_PLUGINS = savedRefresh
      await rm(home, { recursive: true, force: true })
      await rm(emptyVendor, { recursive: true, force: true })
    }
  })

  test('a changed plugin file after a ready profile is an error', async () => exclusive(async () => {
    const indexPath = join(repoRoot, 'runtime', 'plugins', 'dsh-lan-assist', 'index.js')
    const raw = readFileSync(indexPath)
    const home = await mkdtemp(join(tmpdir(), 'fde-pr4-tree-'))
    const emptyVendor = await mkdtemp(join(tmpdir(), 'fde-empty-vendor-'))
    const savedVendor = process.env.FDE_VENDOR_DIR
    const savedIui = process.env.FDE_PLUGIN_IUI
    const savedLan = process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    const savedSem = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    const savedArtifact = process.env.FDE_IUI_ARTIFACT
    const savedRefresh = process.env.FDE_REFRESH_PLUGINS
    delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    delete process.env.FDE_IUI_ARTIFACT
    delete process.env.FDE_REFRESH_PLUGINS
    process.env.FDE_VENDOR_DIR = emptyVendor
    process.env.FDE_PLUGIN_IUI = await writeIui(home)
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      assert.equal(connector.state, 'idle')
      writeFileSync(indexPath, Buffer.concat([raw, Buffer.from('\n')]))
      await connector.ensureIsolatedProfile()
      assert.equal(connector.state, 'error')
      assert.match(connector.lastError, /mismatch index\.js/)
    } finally {
      writeFileSync(indexPath, raw)
      if (savedVendor === undefined) delete process.env.FDE_VENDOR_DIR
      else process.env.FDE_VENDOR_DIR = savedVendor
      if (savedIui === undefined) delete process.env.FDE_PLUGIN_IUI
      else process.env.FDE_PLUGIN_IUI = savedIui
      if (savedLan === undefined) delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
      else process.env.FDE_PLUGIN_DSH_LAN_ASSIST = savedLan
      if (savedSem === undefined) delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
      else process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = savedSem
      if (savedArtifact === undefined) delete process.env.FDE_IUI_ARTIFACT
      else process.env.FDE_IUI_ARTIFACT = savedArtifact
      if (savedRefresh === undefined) delete process.env.FDE_REFRESH_PLUGINS
      else process.env.FDE_REFRESH_PLUGINS = savedRefresh
      await rm(home, { recursive: true, force: true })
      await rm(emptyVendor, { recursive: true, force: true })
    }
  }))

  async function withReadyProfile(check) {
    const home = await mkdtemp(join(tmpdir(), 'fde-pr4-nats-swap-'))
    const emptyVendor = await mkdtemp(join(tmpdir(), 'fde-empty-vendor-'))
    const savedVendor = process.env.FDE_VENDOR_DIR
    const savedIui = process.env.FDE_PLUGIN_IUI
    const savedLan = process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    const savedSem = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    const savedArtifact = process.env.FDE_IUI_ARTIFACT
    const savedRefresh = process.env.FDE_REFRESH_PLUGINS
    delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
    delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
    delete process.env.FDE_IUI_ARTIFACT
    delete process.env.FDE_REFRESH_PLUGINS
    process.env.FDE_VENDOR_DIR = emptyVendor
    process.env.FDE_PLUGIN_IUI = await writeIui(home)
    try {
      const connector = new DshCoreConnector({ dshHome: home, cwd: home })
      await connector.ensureIsolatedProfile()
      assert.equal(connector.state, 'idle', connector.lastError)
      assert.equal(connector.lastError, null)
      await check(connector, home)
    } finally {
      if (savedVendor === undefined) delete process.env.FDE_VENDOR_DIR
      else process.env.FDE_VENDOR_DIR = savedVendor
      if (savedIui === undefined) delete process.env.FDE_PLUGIN_IUI
      else process.env.FDE_PLUGIN_IUI = savedIui
      if (savedLan === undefined) delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
      else process.env.FDE_PLUGIN_DSH_LAN_ASSIST = savedLan
      if (savedSem === undefined) delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
      else process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = savedSem
      if (savedArtifact === undefined) delete process.env.FDE_IUI_ARTIFACT
      else process.env.FDE_IUI_ARTIFACT = savedArtifact
      if (savedRefresh === undefined) delete process.env.FDE_REFRESH_PLUGINS
      else process.env.FDE_REFRESH_PLUGINS = savedRefresh
      await rm(home, { recursive: true, force: true })
      await rm(emptyVendor, { recursive: true, force: true })
    }
  }

  test('a swapped installed nats version is not left idle', async () => {
    await withReadyProfile(async (connector, home) => {
      const pkgPath = join(home, 'vendor', 'dsh-lan-assist', 'node_modules', 'nats', 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      pkg.version = '9.9.9'
      writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
      await connector.ensureIsolatedProfile()
      const after = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const silent = connector.state === 'idle' && after.version === '9.9.9'
      assert.equal(silent, false, `swapped nats stayed idle ${connector.state} ${after.version} ${connector.lastError}`)
      if (connector.state === 'idle') {
        assert.equal(after.version, '2.29.3')
        assert.equal(connector.lastError, null)
      } else {
        assert.equal(connector.state, 'error')
        assert.match(String(connector.lastError), /nats/i)
        assert.equal(/NO_NATS/.test(connector.lastError || ''), false)
      }
    })
  })

  test('an edited installed nats index is not left idle', async () => {
    await withReadyProfile(async (connector, home) => {
      const indexPath = join(home, 'vendor', 'dsh-lan-assist', 'node_modules', 'nats', 'index.js')
      const raw = readFileSync(indexPath)
      const marker = '\n/* fde-nats-tamper */\n'
      writeFileSync(indexPath, Buffer.concat([raw, Buffer.from(marker)]))
      await connector.ensureIsolatedProfile()
      const body = readFileSync(indexPath, 'utf8')
      const silent = connector.state === 'idle' && body.includes('fde-nats-tamper')
      assert.equal(silent, false, `edited nats index stayed idle ${connector.state} ${connector.lastError}`)
      if (connector.state === 'idle') {
        assert.equal(body.includes('fde-nats-tamper'), false)
        assert.equal(connector.lastError, null)
      } else {
        assert.equal(connector.state, 'error')
        assert.match(String(connector.lastError), /nats/i)
        assert.equal(/NO_NATS/.test(connector.lastError || ''), false)
      }
    })
  })
}
