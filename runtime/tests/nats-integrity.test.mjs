import './support/no-stray-processes.mjs'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { natsContentDigest, natsIntegrityProblem, syncRepoCache } from '../plugin-repo-source.mjs'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const pluginSource = join(repoRoot, 'runtime', 'plugins', 'dsh-lan-assist')
const moduleUrl = fileURLToPath(new URL('../plugin-repo-source.mjs', import.meta.url))
const publishedContent = 'd5e431d28c29ff3d0bfbb51d2b699e13d76ee1d0ffe9322277fcdb0d40dd1b16'

function installPlugin(root) {
  cpSync(pluginSource, root, {
    recursive: true,
    filter: (src) => !src.split(/[/\\]/u).includes('node_modules'),
  })
  const installed = spawnSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
  })
  assert.equal(installed.status, 0, installed.stderr)
  return root
}

function writeHook(dir) {
  const hookPath = join(dir, 'zlib-hook.mjs')
  const childPath = join(dir, 'check.mjs')
  writeFileSync(hookPath, `
export async function load(url, context, nextLoad) {
  if (url !== 'node:zlib') return nextLoad(url, context)
  return {
    format: 'module',
    source: \`
      import { createRequire } from 'node:module'
      import { pathToFileURL } from 'node:url'
      const require = createRequire(pathToFileURL(process.env.NATS_REQUIRE_FROM))
      const zlib = require('node:zlib')
      const real = zlib.gzipSync
      export function gzipSync(buf, opts) {
        const gz = Buffer.from(real(buf, opts))
        if (gz.length > 12) gz[12] ^= 0x01
        return gz
      }
    \`,
    shortCircuit: true,
  }
}
`)
  writeFileSync(childPath, `
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
register(process.env.NATS_ZLIB_HOOK, { parentURL: pathToFileURL(process.argv[1]) })
const { natsIntegrityProblem, syncRepoCache } = await import(process.env.NATS_MODULE)
const problem = natsIntegrityProblem(process.env.NATS_PLUGIN)
const synced = await syncRepoCache({
  dshHome: process.env.NATS_HOME,
  pluginDir: 'dsh-lan-assist',
  source: process.env.NATS_PLUGIN,
  refresh: true,
})
process.stdout.write(JSON.stringify({ problem, ok: synced.ok, error: synced.error || null }))
`)
  return { hookPath, childPath }
}

test('a published nats tree passes when gzip bits differ', () => {
  const root = join(tmpdir(), `fde-nats-gate-${process.pid}`)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  const plugin = installPlugin(join(root, 'plugin'))
  const home = join(root, 'home')
  mkdirSync(home, { recursive: true })
  const { hookPath, childPath } = writeHook(root)
  try {
    assert.equal(natsContentDigest(join(plugin, 'node_modules', 'nats')), publishedContent)
    const ran = spawnSync(process.execPath, [childPath], {
      encoding: 'utf8',
      timeout: 60000,
      env: {
        ...process.env,
        NATS_ZLIB_HOOK: hookPath,
        NATS_REQUIRE_FROM: join(repoRoot, 'package.json'),
        NATS_MODULE: moduleUrl,
        NATS_PLUGIN: plugin,
        NATS_HOME: home,
      },
    })
    assert.equal(ran.status, 0, ran.stderr)
    assert.deepEqual(JSON.parse(ran.stdout), { problem: null, ok: true, error: null })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a changed nats file or version still fails the gate', () => {
  const root = join(tmpdir(), `fde-nats-bad-${process.pid}`)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
  const plugin = installPlugin(join(root, 'plugin'))
  const readme = join(plugin, 'node_modules', 'nats', 'README.md')
  const pkgPath = join(plugin, 'node_modules', 'nats', 'package.json')
  try {
    const original = readFileSync(readme)
    writeFileSync(readme, Buffer.concat([original, Buffer.from('\nbroken\n')]))
    assert.equal(natsIntegrityProblem(plugin), 'nats integrity mismatch')
    writeFileSync(readme, original)
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    pkg.version = '9.9.9'
    writeFileSync(pkgPath, `${JSON.stringify(pkg)}\n`)
    assert.equal(natsIntegrityProblem(plugin), 'nats integrity mismatch')
    rmSync(join(plugin, 'node_modules', 'nats'), { recursive: true, force: true })
    assert.equal(natsIntegrityProblem(plugin), 'NATS_DEPENDENCY_MISSING')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('syncRepoCache rejects a changed nats file', async () => {
  const root = join(tmpdir(), `fde-nats-sync-${process.pid}`)
  rmSync(root, { recursive: true, force: true })
  const plugin = installPlugin(join(root, 'plugin'))
  const readme = join(plugin, 'node_modules', 'nats', 'README.md')
  writeFileSync(readme, Buffer.concat([readFileSync(readme), Buffer.from('\nbroken\n')]))
  try {
    const synced = await syncRepoCache({
      dshHome: join(root, 'home'),
      pluginDir: 'dsh-lan-assist',
      source: plugin,
      refresh: true,
    })
    assert.equal(synced.ok, false)
    assert.equal(synced.error, 'nats integrity mismatch')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
