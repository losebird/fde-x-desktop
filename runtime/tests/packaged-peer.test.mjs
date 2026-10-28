import './support/no-stray-processes.mjs'
import { mkdtemp, mkdir, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { generationInstallRoot } from '../generation.mjs'
import { linkPackagedPeers } from '../packaged-peer.mjs'

const LIBRARY = fileURLToPath(new URL('../plugins/dsh-semantic-os/peers.js', import.meta.url))

test('importPeer resolves schemastery staged under resources/dsh', async (t) => {
  const staged = join(generationInstallRoot(), 'node_modules', '@deepseek-ai', 'schemastery', 'package.json')
  if (!existsSync(LIBRARY) || !existsSync(staged)) {
    t.skip('library peers.js or the staged schemastery package is missing')
    return
  }
  const root = await mkdtemp(join(tmpdir(), 'fde-peer-'))
  const home = join(root, 'dsh-home')
  const resources = join(root, 'resources')
  const packageDir = join(resources, 'dsh', 'node_modules', '@deepseek-ai', 'schemastery')
  await mkdir(join(packageDir, '..'), { recursive: true })
  symlinkSync(join(generationInstallRoot(), 'node_modules', '@deepseek-ai', 'schemastery'), packageDir)
  const previous = {
    FDE_RESOURCES: process.env.FDE_RESOURCES,
    DSH_HOME: process.env.DSH_HOME,
    FDE_DSH_HOME: process.env.FDE_DSH_HOME,
  }
  process.env.FDE_RESOURCES = resources
  process.env.DSH_HOME = home
  process.env.FDE_DSH_HOME = home
  try {
    await linkPackagedPeers({
      dshHome: home,
      env: { FDE_RESOURCES: resources },
    })
    const { importPeer } = await import(pathToFileURL(LIBRARY).href)
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

test('linkPackagedPeers leaves a real directory in place', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-peer-dir-'))
  const source = join(root, 'resources', 'dsh', 'node_modules', '@deepseek-ai', 'schemastery')
  const home = join(root, 'dsh-home')
  const dest = join(home, 'profiles', 'node_modules', '@deepseek-ai', 'schemastery')
  await mkdir(source, { recursive: true })
  await writeFile(join(source, 'package.json'), '{"name":"@deepseek-ai/schemastery"}\n')
  await mkdir(dest, { recursive: true })
  await writeFile(join(dest, 'keep.txt'), 'keep\n')
  try {
    const linked = await linkPackagedPeers({
      dshHome: home,
      env: { FDE_RESOURCES: join(root, 'resources') },
      specs: ['@deepseek-ai/schemastery'],
    })
    assert.deepEqual(linked, [])
    assert.equal(await readFile(join(dest, 'keep.txt'), 'utf8'), 'keep\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('linkPackagedPeers leaves a live symlink in place', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-peer-live-'))
  const source = join(root, 'resources', 'dsh', 'node_modules', '@deepseek-ai', 'schemastery')
  const home = join(root, 'dsh-home')
  const dest = join(home, 'profiles', 'node_modules', '@deepseek-ai', 'schemastery')
  const live = join(root, 'live-install')
  await mkdir(source, { recursive: true })
  await writeFile(join(source, 'package.json'), '{"name":"@deepseek-ai/schemastery"}\n')
  await mkdir(live, { recursive: true })
  await mkdir(dirname(dest), { recursive: true })
  symlinkSync(live, dest)
  try {
    const linked = await linkPackagedPeers({
      dshHome: home,
      env: { FDE_RESOURCES: join(root, 'resources') },
      specs: ['@deepseek-ai/schemastery'],
    })
    assert.deepEqual(linked, [])
    assert.equal(resolve(await readlink(dest)), resolve(live))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
