import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { includeRuntimePath } from './stage.mjs'

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
  assert.equal(includeRuntimePath(join(root, 'plugins', 'dsh-semantic-os', 'python', '__pycache__', 'x.pyc'), root), false)
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

function outsideRuntimeImports(runtimeRoot) {
  const found = []
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (!includeRuntimePath(full, runtimeRoot)) continue
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      const relFile = relative(runtimeRoot, full)
      // Test files import src/ on purpose. server.mjs does not load them.
      if (relFile === 'tests' || relFile.startsWith('tests/') || relFile.startsWith('tests\\')) continue
      if (!/\.(mjs|cjs|js)$/u.test(name)) continue
      const text = readFileSync(full, 'utf8')
      const specs = [
        ...text.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/gu),
        ...text.matchAll(/\bimport\s*\(\s*['"](\.[^'"]+)['"]/gu),
      ]
      for (const match of specs) {
        const target = resolve(dirname(full), match[1])
        const rel = relative(runtimeRoot, target)
        if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')) {
          found.push(`${relative(runtimeRoot, full)} → ${match[1]}`)
        }
      }
    }
  }
  walk(runtimeRoot)
  return found
}

test('a runtime-only stage can import the server chain through builtin plugins', async () => {
  const appRoot = await mkdtemp(join(tmpdir(), 'fde-runtime-stage-'))
  const runtimeDest = join(appRoot, 'runtime')
  await cp(runtimeSrc, runtimeDest, {
    recursive: true,
    filter: (src) => includeRuntimePath(src, runtimeSrc),
  })
  try {
    const server = readFileSync(join(runtimeDest, 'server.mjs'), 'utf8')
    const core = readFileSync(join(runtimeDest, 'dsh-core.mjs'), 'utf8')
    assert.match(server, /from '\.\/dsh-core\.mjs'/)
    assert.match(core, /from '\.\/builtin-plugins\.mjs'/)
    await import(pathToFileURL(join(runtimeDest, 'dsh-core.mjs')).href)
    const { BUILTIN_PLUGINS } = await import(pathToFileURL(join(runtimeDest, 'builtin-plugins.mjs')).href)
    const iui = BUILTIN_PLUGINS.find((plugin) => plugin.dir === 'iui')
    assert.equal(typeof iui.source.commit, 'string')
    assert.equal(iui.source.commit.length > 0, true)
    assert.deepEqual(outsideRuntimeImports(runtimeDest), [])
  } finally {
    await rm(appRoot, { recursive: true, force: true })
  }
})
