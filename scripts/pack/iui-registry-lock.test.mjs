import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { canonicalNpmLockBytes, packDeterministicTarGz, sha256Hex } from './iui-artifact.mjs'
import { finishIuiArtifact } from './build-iui.mjs'

const CI_LOCK_SHA = '6cc802c37f50e4f6294653daded9d2bcf599da136b19b1592ca1bc26fabc3d2f'
const USER_LOCK_SHA = 'd1c7bebca47a4795a7b436e200b58928d3bbce45a401e33568b4f6abcdc464c2'
const fixture = new URL('./fixtures/iui-npmjs-package-lock.json', import.meta.url)

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function writeTree(root, lockBytes) {
  mkdirSync(join(root, 'node_modules'), { recursive: true })
  mkdirSync(join(root, 'lib'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"name":"@losebird/iui"}\n')
  writeFileSync(join(root, 'lib', 'index.js'), 'export {}\n')
  writeFileSync(join(root, 'node_modules', '.package-lock.json'), lockBytes)
}

test('a mirror registry lockfile packs to the same artifact as registry.npmjs.org', async () => {
  const ciLock = readFileSync(fixture)
  const mirrorLock = Buffer.from(ciLock.toString('utf8').replaceAll('registry.npmjs.org', 'registry.npmmirror.com'))
  assert.equal(sha256Hex(ciLock), CI_LOCK_SHA)
  assert.equal(sha256Hex(mirrorLock), USER_LOCK_SHA)
  const root = join(tmpdir(), `fde-iui-reg-${process.pid}`)
  const canon = join(root, 'canon')
  const mirror = join(root, 'mirror')
  const canonTar = join(root, 'canon.tar.gz')
  const mirrorTar = join(root, 'mirror.tar.gz')
  writeTree(canon, ciLock)
  writeTree(mirror, mirrorLock)
  const previous = process.env.npm_config_registry
  process.env.npm_config_registry = 'https://registry.npmmirror.com/'
  try {
    await packDeterministicTarGz(canon, canonTar)
    await packDeterministicTarGz(mirror, mirrorTar)
    assert.equal(sha(mirrorTar), sha(canonTar))
  } finally {
    if (previous === undefined) delete process.env.npm_config_registry
    else process.env.npm_config_registry = previous
    rmSync(root, { recursive: true, force: true })
  }
})

test('a sha miss deletes the artifact and names the drifted file', async () => {
  const root = join(tmpdir(), `fde-iui-miss-${process.pid}`)
  const tree = join(root, 'tree')
  const artifact = join(root, 'iui.tar.gz')
  mkdirSync(join(tree, 'lib'), { recursive: true })
  writeFileSync(join(tree, 'lib', 'index.js'), 'export {}\n')
  const manifestFiles = { 'lib/index.js': 'deadbeef' }
  try {
    await assert.rejects(
      () => finishIuiArtifact(tree, artifact, { artifact: { sha256: 'f'.repeat(64) } }, manifestFiles),
      (error) => {
        assert.match(error.message, /IUI artifact sha256 mismatch/)
        assert.match(error.message, new RegExp(`expected ${'f'.repeat(64)}`))
        assert.match(error.message, /actual [0-9a-f]{64}/)
        assert.match(error.message, /differs lib\/index\.js/)
        assert.match(error.message, /expected deadbeef/)
        return true
      },
    )
    assert.equal(existsSync(artifact), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function withRegistries(env, fn) {
  const keys = ['npm_config_registry', 'npm_config_@corp:registry']
  const saved = new Map(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]
  Object.assign(process.env, env)
  try {
    return fn()
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function rewrite(env, text) {
  return withRegistries(env, () => canonicalNpmLockBytes(Buffer.from(text)).toString('utf8'))
}

test('npmmirror registry prefix rewrites the resolved tarball', () => {
  const out = rewrite(
    { npm_config_registry: 'https://registry.npmmirror.com/' },
    '"resolved": "https://registry.npmmirror.com/katex/-/katex-0.16.47.tgz"',
  )
  assert.equal(out, '"resolved": "https://registry.npmjs.org/katex/-/katex-0.16.47.tgz"')
})

test('a Nexus registry prefix replaces the repository path, not only the host', () => {
  const out = rewrite(
    { npm_config_registry: 'https://nexus.example.com/repository/npm-group/' },
    '"resolved": "https://nexus.example.com/repository/npm-group/katex/-/katex-0.16.47.tgz"',
  )
  assert.equal(out, '"resolved": "https://registry.npmjs.org/katex/-/katex-0.16.47.tgz"')
})

test('an http registry prefix is rewritten when it is the configured registry', () => {
  const out = rewrite(
    { npm_config_registry: 'http://registry.npmmirror.com' },
    '"resolved": "http://registry.npmmirror.com/katex/-/katex-0.16.47.tgz"',
  )
  assert.equal(out, '"resolved": "https://registry.npmjs.org/katex/-/katex-0.16.47.tgz"')
})

test('trailing slash on the configured registry does not change the rewrite', () => {
  const text = '"resolved": "https://nexus.example.com/repository/npm-group/katex/-/katex-0.16.47.tgz"'
  const expected = '"resolved": "https://registry.npmjs.org/katex/-/katex-0.16.47.tgz"'
  assert.equal(rewrite({ npm_config_registry: 'https://nexus.example.com/repository/npm-group/' }, text), expected)
  assert.equal(rewrite({ npm_config_registry: 'https://nexus.example.com/repository/npm-group' }, text), expected)
})

test('a scope registry rewrites only resolved urls under that prefix', () => {
  const out = rewrite(
    {
      npm_config_registry: 'https://registry.npmjs.org/',
      'npm_config_@corp:registry': 'https://nexus.example.com/repository/npm-group',
    },
    [
      '"resolved": "https://registry.npmjs.org/katex/-/katex-0.16.47.tgz"',
      '"resolved": "https://nexus.example.com/repository/npm-group/lodash/-/lodash-4.17.21.tgz"',
      '"resolved": "https://nexus.example.com/repository/other/left.tgz"',
    ].join('\n'),
  )
  assert.equal(out, [
    '"resolved": "https://registry.npmjs.org/katex/-/katex-0.16.47.tgz"',
    '"resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"',
    '"resolved": "https://nexus.example.com/repository/other/left.tgz"',
  ].join('\n'))
})

test('an npmmirror install writes the mirror host before canonicalization', () => {
  const registry = execFileSync('npm', ['config', 'get', 'registry'], { encoding: 'utf8' }).trim()
  if (!registry.includes('registry.npmmirror.com')) {
    if (process.env.FDE_IUI_REQUIRE_MIRROR === '1') {
      assert.fail(`npm registry is ${registry}`)
    }
    console.log(`skip disk mirror proof registry ${registry}`)
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'fde-iui-mirror-lock-'))
  try {
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify({
      name: 'fde-iui-mirror-probe',
      version: '1.0.0',
      dependencies: { which: '2.0.2' },
    }, null, 2)}\n`)
    execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: dir,
      encoding: 'utf8',
      env: process.env,
    })
    const raw = readFileSync(join(dir, 'package-lock.json'))
    assert.match(raw.toString('utf8'), /registry\.npmmirror\.com/)
    const canonical = canonicalNpmLockBytes(raw).toString('utf8')
    assert.equal(canonical.includes('registry.npmmirror.com'), false)
    assert.match(canonical, /registry\.npmjs\.org/)
    console.log('ASSERT ok: lockfile on disk contains registry.npmmirror.com before canonicalization')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a bad pack keeps the previous good archive bytes', async () => {
  const dir = join(tmpdir(), `fde-iui-keep-${process.pid}`)
  const tree = join(dir, 'tree')
  const artifact = join(dir, 'iui.tar.gz')
  mkdirSync(join(tree, 'lib'), { recursive: true })
  writeFileSync(join(tree, 'package.json'), '{"name":"@losebird/iui"}\n')
  writeFileSync(join(tree, 'lib', 'index.js'), 'export {}\n')
  try {
    await packDeterministicTarGz(tree, artifact)
    const goodSha = sha(artifact)
    await finishIuiArtifact(tree, artifact, { artifact: { sha256: goodSha } })
    assert.equal(sha(artifact), goodSha)
    writeFileSync(join(tree, 'lib', 'index.js'), 'export const broken = true\n')
    await assert.rejects(
      () => finishIuiArtifact(tree, artifact, { artifact: { sha256: goodSha } }, { 'lib/index.js': 'deadbeef' }),
      /IUI artifact sha256 mismatch/,
    )
    assert.equal(existsSync(artifact), true)
    assert.equal(sha(artifact), goodSha)
    const partials = readdirSync(dir).filter((name) => name.includes('.partial'))
    assert.deepEqual(partials, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
