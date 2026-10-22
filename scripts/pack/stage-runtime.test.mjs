import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { includeRuntimePath, stagePackagedRuntime } from './stage.mjs'

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

test('staged runtime keeps migrations, presets, and imports that leave runtime', async () => {
  const appRoot = await mkdtemp(join(tmpdir(), 'fde-runtime-stage-'))
  try {
    await stagePackagedRuntime({ repoRoot, appRoot })
    const runtimeDest = join(appRoot, 'runtime')
    const server = readFileSync(join(runtimeDest, 'server.mjs'), 'utf8')
    const core = readFileSync(join(runtimeDest, 'dsh-core.mjs'), 'utf8')
    assert.match(server, /from '\.\/dsh-core\.mjs'/)
    assert.match(server, /from '\.\.\/scripts\/runtime-respawn\.mjs'/)
    assert.match(core, /from '\.\/builtin-plugins\.mjs'/)
    await import(pathToFileURL(join(runtimeDest, 'dsh-core.mjs')).href)
    const { BUILTIN_PLUGINS } = await import(pathToFileURL(join(runtimeDest, 'builtin-plugins.mjs')).href)
    const iui = BUILTIN_PLUGINS.find((plugin) => plugin.dir === 'iui')
    assert.equal(typeof iui.source.commit, 'string')
    assert.equal(iui.source.commit.length > 0, true)
    assert.deepEqual(
      readdirSync(join(runtimeDest, 'migrations')).filter((name) => name.endsWith('.sql')).sort(),
      readdirSync(join(runtimeSrc, 'migrations')).filter((name) => name.endsWith('.sql')).sort(),
    )
    assert.deepEqual(
      readdirSync(join(runtimeDest, 'presets')).sort(),
      readdirSync(join(runtimeSrc, 'presets')).sort(),
    )
    assert.equal(existsSync(join(runtimeDest, 'migrations', '016_workspace_file_revisions.sql')), true)
    assert.equal(existsSync(join(runtimeDest, 'presets', 'fde-briefing', 'preset.yml')), true)
    assert.deepEqual(
      readdirSync(join(appRoot, 'scripts')).sort(),
      ['runtime-port.mjs', 'runtime-respawn.mjs'],
    )
    const respawn = readFileSync(join(appRoot, 'scripts', 'runtime-respawn.mjs'), 'utf8')
    assert.match(respawn, /from '\.\/runtime-port\.mjs'/)
  } finally {
    await rm(appRoot, { recursive: true, force: true })
  }
})

test('pack fails when a static import leaves runtime and the file is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-stage-missing-'))
  const appRoot = join(root, 'app')
  await mkdir(join(root, 'runtime'), { recursive: true })
  await writeFile(join(root, 'runtime', 'server.mjs'), "import '../scripts/not-in-repo.mjs'\n")
  try {
    await assert.rejects(
      () => stagePackagedRuntime({ repoRoot: root, appRoot }),
      (error) => {
        assert.equal(error.code, 'ERR_STAGE_UNRESOLVED_IMPORT')
        assert.match(error.message, /not-in-repo\.mjs/)
        return true
      },
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a missing plugin sibling inside vendor-overlays does not fail the pack', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-stage-overlay-'))
  const overlay = join(root, 'runtime', 'vendor-overlays', 'dsh-lan-assist')
  await mkdir(overlay, { recursive: true })
  await writeFile(
    join(root, 'runtime', 'server.mjs'),
    "import './vendor-overlays/dsh-lan-assist/letter-home.js'\n",
  )
  await writeFile(join(overlay, 'letter-home.js'), "import { createTraceLog } from './traces.js'\nexport {}\n")
  const appRoot = join(root, 'app')
  try {
    await stagePackagedRuntime({ repoRoot: root, appRoot })
    assert.equal(existsSync(join(appRoot, 'runtime', 'vendor-overlays', 'dsh-lan-assist', 'letter-home.js')), true)
    assert.equal(existsSync(join(appRoot, 'runtime', 'vendor-overlays', 'dsh-lan-assist', 'traces.js')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
