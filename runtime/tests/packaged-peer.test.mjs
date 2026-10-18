import { mkdtemp, mkdir, cp, readlink, rm, writeFile } from 'node:fs/promises'
import { existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { DshCoreConnector } from '../dsh-core.mjs'
import { generationInstallRoot } from '../generation.mjs'
import { linkPackagedPeers } from '../packaged-peer.mjs'

const SNAPSHOT = process.env.FDE_PLUGIN_DSH_SEMANTIC_OS || ''

test('importPeer resolves schemastery staged under resources/dsh', async (t) => {
  const peers = SNAPSHOT && existsSync(join(SNAPSHOT, 'peers.js'))
  const staged = join(generationInstallRoot(), 'node_modules', '@deepseek-ai', 'schemastery', 'package.json')
  if (!peers || !existsSync(staged)) {
    t.skip('snapshot peers.js or the staged schemastery package is missing')
    return
  }
  const root = await mkdtemp(join(tmpdir(), 'fde-peer-'))
  const home = join(root, 'dsh-home')
  const resources = join(root, 'resources')
  const pluginSrc = join(root, 'plugin')
  const packageDir = join(resources, 'dsh', 'node_modules', '@deepseek-ai', 'schemastery')
  await mkdir(join(packageDir, '..'), { recursive: true })
  symlinkSync(join(generationInstallRoot(), 'node_modules', '@deepseek-ai', 'schemastery'), packageDir)
  await mkdir(pluginSrc, { recursive: true })
  await cp(join(SNAPSHOT, 'peers.js'), join(pluginSrc, 'peers.js'))
  const previous = {
    FDE_RESOURCES: process.env.FDE_RESOURCES,
    FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
    DSH_HOME: process.env.DSH_HOME,
    FDE_DSH_HOME: process.env.FDE_DSH_HOME,
  }
  process.env.FDE_RESOURCES = resources
  process.env.FDE_PLUGIN_DSH_SEMANTIC_OS = pluginSrc
  process.env.DSH_HOME = home
  process.env.FDE_DSH_HOME = home
  try {
    const core = new DshCoreConnector({ dshHome: home, profileName: 'fde-x' })
    await core.ensureIsolatedProfile()
    const peersUrl = pathToFileURL(join(home, 'profiles', 'fde-x', 'node_modules', 'dsh-semantic-os', 'peers.js'))
    const { importPeer } = await import(peersUrl.href)
    const loaded = await importPeer('@deepseek-ai/schemastery')
    assert.equal(typeof loaded.default, 'function')
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key]
      else process.env[key] = value
    }
    await rm(root, { recursive: true, force: true })
  }
})

test('linkPackagedPeers replaces a dangling profile symlink', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-peer-dangling-'))
  const source = join(root, 'resources', 'dsh', 'node_modules', '@deepseek-ai', 'schemastery')
  const home = join(root, 'dsh-home')
  const dest = join(home, 'profiles', 'node_modules', '@deepseek-ai', 'schemastery')
  await mkdir(source, { recursive: true })
  await writeFile(join(source, 'package.json'), '{"name":"@deepseek-ai/schemastery"}\n')
  await mkdir(dirname(dest), { recursive: true })
  symlinkSync(join(root, 'missing-old-install'), dest)
  try {
    await assert.doesNotReject(() => linkPackagedPeers({
      dshHome: home,
      env: { FDE_RESOURCES: join(root, 'resources') },
      specs: ['@deepseek-ai/schemastery'],
    }))
    assert.equal(resolve(await readlink(dest)), resolve(source))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
