import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { BUILTIN_PLUGINS } from '../../runtime/builtin-plugins.mjs'
import { natsIntegrityProblem } from '../../runtime/plugin-repo-source.mjs'
import { bundledPluginVersions } from './iui-artifact.mjs'

const repo = fileURLToPath(new URL('../..', import.meta.url))
const verify = fileURLToPath(new URL('./verify.mjs', import.meta.url))
const NATS_INTEGRITY = 'sha512-tOQCRCwC74DgBTk4pWZ9V45sk4d7peoE2njVprMRCBXrhJ5q5cYM7i6W+Uvw2qUrcfOSnuisrX7bEx3b3Wx4QA=='
const DIST_PAGES = ['admin', 'analyze', 'decisions', 'explore', 'io', 'ontology']

function treeHash(files) {
  const hash = createHash('sha256')
  for (const rel of Object.keys(files).sort()) hash.update(`${rel}\0${files[rel]}\n`)
  return hash.digest('hex')
}

function copyCleanLan(dest) {
  const from = join(repo, 'runtime', 'plugins', 'dsh-lan-assist')
  cpSync(from, dest, {
    recursive: true,
    filter: (src) => !src.split(/[/\\]/u).includes('node_modules'),
  })
}

test('a clean lan-assist tree stages nats 2.29.3 with the lock integrity', { timeout: 180000 }, async () => {
  const root = join(tmpdir(), `fde-nats-stage-${process.pid}`)
  const source = join(root, 'src')
  const dest = join(root, 'resources', 'plugins', 'dsh-lan-assist')
  rmSync(root, { recursive: true, force: true })
  copyCleanLan(source)
  assert.equal(existsSync(join(source, 'node_modules')), false)
  const { stageLanAssist } = await import('./stage.mjs')
  await stageLanAssist(source, dest)
  const pkg = JSON.parse(readFileSync(join(dest, 'node_modules', 'nats', 'package.json'), 'utf8'))
  assert.equal(pkg.version, '2.29.3')
  assert.equal(natsIntegrityProblem(dest), null)
  const lock = JSON.parse(readFileSync(join(repo, 'runtime', 'plugins', 'plugins.lock.json'), 'utf8'))
  assert.equal(lock.plugins['dsh-lan-assist'].dependencies.nats.version, '2.29.3')
  assert.equal(lock.plugins['dsh-lan-assist'].dependencies.nats.integrity, NATS_INTEGRITY)
  rmSync(root, { recursive: true, force: true })
})

test('repo plugin versions are staged plus the lock treeHash', () => {
  const lock = JSON.parse(readFileSync(join(repo, 'runtime', 'plugins', 'plugins.lock.json'), 'utf8'))
  const root = join(tmpdir(), `fde-nats-ver-${process.pid}`)
  mkdirSync(join(root, 'dsh-lan-assist'), { recursive: true })
  mkdirSync(join(root, 'dsh-semantic-os'), { recursive: true })
  writeFileSync(join(root, 'dsh-lan-assist', 'package.json'), '{}\n')
  writeFileSync(join(root, 'dsh-semantic-os', 'package.json'), '{}\n')
  try {
    const versions = bundledPluginVersions(BUILTIN_PLUGINS, root, lock.plugins)
    assert.deepEqual(versions['dsh-lan-assist'], {
      staged: true,
      treeHash: treeHash(lock.plugins['dsh-lan-assist'].files),
    })
    assert.deepEqual(versions['dsh-semantic-os'], {
      staged: true,
      treeHash: treeHash(lock.plugins['dsh-semantic-os'].files),
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('verify names missing nats instead of stopping at index.html', () => {
  const out = join(tmpdir(), `fde-verify-hide-${process.pid}`)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(join(out, 'plugins', 'dsh-lan-assist'), { recursive: true })
  writeFileSync(join(out, 'versions.json'), `${JSON.stringify({
    plugins: {
      'dsh-lan-assist': true,
      'dsh-semantic-os': true,
    },
  })}\n`)
  const result = spawnSync(process.execPath, [verify], {
    cwd: repo,
    encoding: 'utf8',
    timeout: 60000,
    env: {
      ...process.env,
      FDE_PACK_OUT: out,
      CI: '',
      FDE_DOWNLOAD_SEMANTIC_RUNTIME: '0',
    },
  })
  assert.equal(result.status, 1)
  assert.match(`${result.stderr}`, /node_modules\/nats/)
  rmSync(out, { recursive: true, force: true })
})

test('verify accepts the six semantic dist scripts when they match the lock', () => {
  const out = join(tmpdir(), `fde-verify-dist-${process.pid}`)
  rmSync(out, { recursive: true, force: true })
  const sem = join(out, 'plugins', 'dsh-semantic-os')
  const lock = JSON.parse(readFileSync(join(repo, 'runtime', 'plugins', 'plugins.lock.json'), 'utf8'))
  for (const page of DIST_PAGES) {
    const rel = `runtime/plugins/dsh-semantic-os/dist/${page}/${page}.js`
    const body = readFileSync(join(repo, rel))
    mkdirSync(join(sem, 'dist', page), { recursive: true })
    writeFileSync(join(sem, 'dist', page, `${page}.js`), body)
  }
  const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { writeFileSync } from 'node:fs'
    import { bundledPluginProblems } from './scripts/pack/verify.mjs'
    const problems = await bundledPluginProblems(process.env.OUT, null, process.env.REPO)
    const dist = problems.filter((line) => /dist /u.test(line))
    writeFileSync(process.env.OUT_FILE, JSON.stringify(dist))
  `], {
    cwd: repo,
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, OUT: out, OUT_FILE: join(out, 'dist-problems.json'), REPO: repo },
  })
  assert.equal(probe.status, 0, probe.stderr)
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'dist-problems.json'), 'utf8')), [])
  assert.equal(lock.plugins['dsh-semantic-os'].files['runtime/plugins/dsh-semantic-os/dist/admin/admin.js'].length, 64)
  rmSync(out, { recursive: true, force: true })
})
