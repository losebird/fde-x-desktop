import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { includeRuntimePath, packagedRuntimeImportHoles, stageRuntimeTree } from './stage.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const runtimeSrc = join(repoRoot, 'runtime')

const root = '/repo/runtime'

test('pack runtime excludes user sqlite and semantic-os cache', () => {
  assert.equal(includeRuntimePath(root, root), true)
  assert.equal(includeRuntimePath(join(root, 'server.mjs'), root), true)
  assert.equal(includeRuntimePath(join(root, 'migrations', '016_workspace_file_revisions.sql'), root), true)
  assert.equal(includeRuntimePath(join(root, 'data', 'fde-workstation.sqlite'), root), false)
  assert.equal(includeRuntimePath(join(root, 'data', 'fde-workstation.sqlite-wal'), root), false)
  assert.equal(includeRuntimePath(join(root, 'data', 'semantic-os', 'runtime', 'current.json'), root), false)
  assert.equal(includeRuntimePath(join(root, 'native-workspaces', 'ws_personal'), root), false)
  assert.equal(includeRuntimePath(join(root, 'vendor-overlays', 'dsh-semantic-os', 'python', '__pycache__', 'x.pyc'), root), false)
  assert.equal(
    includeRuntimePath(join(root, '.host-generation', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), root),
    false,
  )
})

test('copying runtime drops .host-generation from the staged tree', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-stage-runtime-'))
  const src = join(dir, 'runtime')
  const dest = join(dir, 'app', 'runtime')
  const planted = join(src, '.host-generation', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  await mkdir(join(planted, '..'), { recursive: true })
  await writeFile(planted, 'planted\n')
  await writeFile(join(src, 'server.mjs'), 'export {}\n')
  await cp(src, dest, {
    recursive: true,
    filter: (path) => includeRuntimePath(path, src),
  })
  assert.equal(existsSync(join(dest, 'server.mjs')), true)
  assert.equal(existsSync(join(dest, '.host-generation')), false)
})

test('a runtime-only stage can import the server chain through builtin plugins', async () => {
  const appRoot = await mkdtemp(join(tmpdir(), 'fde-runtime-stage-'))
  try {
    await stageRuntimeTree(repoRoot, appRoot)
    const runtimeDest = join(appRoot, 'runtime')
    assert.deepEqual(packagedRuntimeImportHoles(appRoot), [])
    assert.equal(existsSync(join(appRoot, 'scripts', 'runtime-respawn.mjs')), true)
    assert.equal(existsSync(join(appRoot, 'scripts', 'runtime-port.mjs')), true)
    await import(pathToFileURL(join(appRoot, 'scripts', 'runtime-respawn.mjs')).href)
    const server = readFileSync(join(runtimeDest, 'server.mjs'), 'utf8')
    const core = readFileSync(join(runtimeDest, 'dsh-core.mjs'), 'utf8')
    assert.match(server, /from '\.\/dsh-core\.mjs'/)
    assert.match(core, /from '\.\/builtin-plugins\.mjs'/)
    await import(pathToFileURL(join(runtimeDest, 'dsh-core.mjs')).href)
    const { BUILTIN_PLUGINS } = await import(pathToFileURL(join(runtimeDest, 'builtin-plugins.mjs')).href)
    const iui = BUILTIN_PLUGINS.find((plugin) => plugin.dir === 'iui')
    assert.equal(typeof iui.source.commit, 'string')
    assert.equal(iui.source.commit.length > 0, true)
  } finally {
    await rm(appRoot, { recursive: true, force: true })
  }
})

test('stageRuntimeTree rejects missing escaped import from runtime/server.mjs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-runtime-fixture-'))
  const fakeRepo = join(dir, 'repo')
  const appRoot = join(dir, 'app')
  await mkdir(join(fakeRepo, 'runtime'), { recursive: true })
  await writeFile(join(fakeRepo, 'runtime', 'server.mjs'), "import {} from '../scripts/missing.mjs'\n")
  try {
    await assert.rejects(
      () => stageRuntimeTree(fakeRepo, appRoot),
      (error) => error.message.includes('runtime/server.mjs → ../scripts/missing.mjs'),
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('stageRuntimeTree copies transitive scripts closure', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-runtime-fixture-'))
  const fakeRepo = join(dir, 'repo')
  const appRoot = join(dir, 'app')
  await mkdir(join(fakeRepo, 'runtime'), { recursive: true })
  await mkdir(join(fakeRepo, 'scripts'), { recursive: true })
  await writeFile(join(fakeRepo, 'runtime', 'server.mjs'), "import {} from '../scripts/a.mjs'\n")
  await writeFile(join(fakeRepo, 'scripts', 'a.mjs'), "import {} from './b.mjs'\n")
  await writeFile(join(fakeRepo, 'scripts', 'b.mjs'), 'export {}\n')
  try {
    await stageRuntimeTree(fakeRepo, appRoot)
    assert.equal(existsSync(join(appRoot, 'scripts', 'a.mjs')), true)
    assert.equal(existsSync(join(appRoot, 'scripts', 'b.mjs')), true)
    assert.deepEqual(packagedRuntimeImportHoles(appRoot), [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('stageRuntimeTree rejects missing transitive script', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-runtime-fixture-'))
  const fakeRepo = join(dir, 'repo')
  const appRoot = join(dir, 'app')
  await mkdir(join(fakeRepo, 'runtime'), { recursive: true })
  await mkdir(join(fakeRepo, 'scripts'), { recursive: true })
  await writeFile(join(fakeRepo, 'runtime', 'server.mjs'), "import {} from '../scripts/a.mjs'\n")
  await writeFile(join(fakeRepo, 'scripts', 'a.mjs'), "import {} from './b.mjs'\n")
  try {
    await assert.rejects(
      () => stageRuntimeTree(fakeRepo, appRoot),
      (error) => error.message.includes('scripts/a.mjs → ./b.mjs'),
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
