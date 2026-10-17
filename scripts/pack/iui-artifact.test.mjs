import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { BUILTIN_PLUGINS } from '../../runtime/builtin-plugins.mjs'
import { IUI_PIN } from './pins.mjs'
import {
  assertIuiTree,
  bundledPluginVersions,
  retargetPrimitivePaths,
  packDeterministicTarGz,
  sha256Hex,
  stageIuiArtifact,
  stageIuiArtifactIfAbsent,
} from './iui-artifact.mjs'

const sampleTsconfig = `{
  "compilerOptions": {
    "paths": {
      "@deepseek-ai/dsh-client-ui-primitives": [
        "/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/types/index.d.ts",
        "/home/box/.local/node/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/types/index.d.ts"
      ],
      "@deepseek-ai/dsh-client-ui-primitives/*": [
        "/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/types/*",
        "/home/box/.local/node/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/types/*"
      ]
    }
  }
}
`

test('IUI pin matches the builtin table and leaves the release URL empty', () => {
  const iui = BUILTIN_PLUGINS.find((plugin) => plugin.dir === 'iui')
  assert.equal(IUI_PIN.version, iui.source.version)
  assert.equal(IUI_PIN.commit, iui.source.commit)
  assert.equal(IUI_PIN.artifact.url, '')
  assert.equal(IUI_PIN.artifact.sha256, 'f3dc3ef1d099aace99d626f38c1c9eac1cf0ce1f631a67ba64919155ca0225a5')
  assert.equal(IUI_PIN.artifact.sha256, iui.source.sha256)
  assert.equal(readFileSync(new URL('./stage.mjs', import.meta.url), 'utf8').includes('build-iui'), false)
})

test('retargetPrimitivePaths drops machine paths', () => {
  const next = retargetPrimitivePaths(sampleTsconfig, '/opt/prim/lib/types')
  assert.match(next, /\/opt\/prim\/lib\/types\/index\.d\.ts/)
  assert.match(next, /\/opt\/prim\/lib\/types\/\*/)
  assert.equal(next.includes('/opt/homebrew/'), false)
  assert.equal(next.includes('/home/box/'), false)
})

test('bundledPluginVersions records the IUI pin and vendor presence', () => {
  const root = join(tmpdir(), `fde-iui-ver-${process.pid}`)
  mkdirSync(join(root, 'dsh-lan-assist'), { recursive: true })
  writeFileSync(join(root, 'dsh-lan-assist', 'package.json'), '{}')
  try {
    const versions = bundledPluginVersions(BUILTIN_PLUGINS, root)
    assert.equal(versions['dsh-lan-assist'], true)
    assert.equal(versions['dsh-semantic-os'], false)
    assert.deepEqual(versions.iui, {
      staged: false,
      version: IUI_PIN.version,
      commit: IUI_PIN.commit,
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function writeFixtureTree(dir, pin) {
  mkdirSync(join(dir, 'lib'), { recursive: true })
  mkdirSync(join(dir, 'node_modules', 'left-pad'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: '@losebird/iui',
    version: pin.version,
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { inject: [] } },
  }))
  writeFileSync(join(dir, 'lib', 'index.js'), 'export {}\n')
  writeFileSync(join(dir, 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1\n')
  writeFileSync(join(dir, 'fde-plugin-pin.json'), JSON.stringify({ commit: pin.commit }))
}

test('stageIuiArtifact replaces the tree only after the hash and pin match', async () => {
  const root = join(tmpdir(), `fde-iui-art-${process.pid}`)
  const tree = join(root, 'tree')
  const archive = join(root, 'iui.tar.gz')
  const dest = join(root, 'plugins', 'iui')
  const pin = {
    version: '0.13.0-iui.26',
    commit: 'abc123',
    artifact: { url: '', sha256: '' },
  }
  mkdirSync(tree, { recursive: true })
  writeFixtureTree(tree, pin)
  execFileSync('tar', ['-czf', archive, '-C', tree, '.'])
  pin.artifact.sha256 = sha256Hex(readFileSync(archive))
  mkdirSync(dest, { recursive: true })
  writeFileSync(join(dest, 'marker.txt'), 'keep-me')
  try {
    await stageIuiArtifact({ dest, pin, artifactPath: archive })
    assert.equal(existsSync(join(dest, 'marker.txt')), false)
    assert.equal(existsSync(join(dest, 'node_modules', 'left-pad', 'index.js')), true)
    assert.equal(existsSync(join(`${dest}.staging-${process.pid}`)), false)
    assert.equal(existsSync(join(`${dest}.bak-${process.pid}`)), false)
    await assertIuiTree(dest, pin)
    const bad = { ...pin, artifact: { url: '', sha256: 'a'.repeat(64) } }
    await assert.rejects(
      () => stageIuiArtifact({ dest, pin: bad, artifactPath: archive }),
      (error) => {
        assert.equal(error.code, 'FDE_IUI_SHA_MISMATCH')
        assert.match(error.message, /sha256 mismatch/)
        assert.match(error.message, new RegExp(archive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        assert.match(error.message, new RegExp(`expected ${bad.artifact.sha256}`))
        assert.match(error.message, /got [a-f0-9]{64}/)
        return true
      },
    )
    assert.equal(existsSync(join(dest, 'lib', 'index.js')), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function touchTree(dir) {
  const future = new Date(Date.now() + 10_000)
  utimesSync(dir, future, future)
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) touchTree(path)
    else utimesSync(path, future, future)
  }
}

test('stageIuiArtifactIfAbsent installs once and leaves an existing profile tree', async () => {
  const root = join(tmpdir(), `fde-iui-absent-${process.pid}`)
  const tree = join(root, 'tree')
  const archive = join(root, 'iui.tar.gz')
  const dest = join(root, 'vendor', 'iui')
  const pin = {
    version: '0.13.0-iui.26',
    commit: 'abc123',
    artifact: { url: '', sha256: '' },
  }
  mkdirSync(tree, { recursive: true })
  writeFixtureTree(tree, pin)
  execFileSync('tar', ['-czf', archive, '-C', tree, '.'])
  pin.artifact.sha256 = sha256Hex(readFileSync(archive))
  const bad = join(root, 'bad.tar.gz')
  const bytes = Buffer.from(readFileSync(archive))
  bytes[bytes.length - 1] ^= 0xff
  writeFileSync(bad, bytes)
  try {
    const installed = await stageIuiArtifactIfAbsent({ dest, pin, artifactPath: archive })
    assert.equal(installed.action, 'installed')
    writeFileSync(join(dest, 'marker.txt'), 'user-bytes')
    const kept = await stageIuiArtifactIfAbsent({ dest, pin, artifactPath: bad })
    assert.equal(kept.action, 'profile-kept')
    assert.equal(readFileSync(join(dest, 'marker.txt'), 'utf8'), 'user-bytes')
    const failed = await stageIuiArtifactIfAbsent({ dest: join(root, 'empty'), pin, artifactPath: bad })
    assert.equal(failed.state, 'verify_failed')
    assert.equal(failed.artifactPath, bad)
    assert.equal(failed.expected, pin.artifact.sha256)
    assert.equal(failed.actual, sha256Hex(readFileSync(bad)))
    assert.equal(failed.command, 'node scripts/pack/build-iui.mjs --out ~/.dsh/vendor/iui')
    assert.equal(existsSync(join(root, 'empty', 'package.json')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('pack stays deterministic when tar rejects GNU --sort=name', () => {
  const root = join(tmpdir(), `fde-iui-bsdtar-${process.pid}`)
  const bin = join(root, 'bin')
  const tree = join(root, 'tree')
  const left = join(root, 'left.tar.gz')
  const right = join(root, 'right.tar.gz')
  const runner = join(root, 'run.mjs')
  mkdirSync(bin, { recursive: true })
  mkdirSync(join(tree, 'nested'), { recursive: true })
  writeFileSync(join(bin, 'tar'), '#!/bin/sh\necho "tar: Option --sort=name is not supported" >&2\nexit 1\n')
  writeFileSync(join(bin, 'gzip'), '#!/bin/sh\necho "gzip should not be called" >&2\nexit 1\n')
  chmodSync(join(bin, 'tar'), 0o755)
  chmodSync(join(bin, 'gzip'), 0o755)
  writeFileSync(join(tree, 'b.txt'), 'second\n')
  writeFileSync(join(tree, 'nested', 'a.txt'), 'first\n')
  writeFileSync(join(tree, `${'n'.repeat(120)}.txt`), 'long\n')
  chmodSync(join(tree, 'b.txt'), 0o755)
  const mod = new URL('./iui-artifact.mjs', import.meta.url).href
  writeFileSync(runner, `import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { packDeterministicTarGz, sha256Hex } from ${JSON.stringify(mod)}
const [tree, left, right] = process.argv.slice(2)
await packDeterministicTarGz(tree, left)
await packDeterministicTarGz(tree, right)
const actual = sha256Hex(readFileSync(left))
if (actual !== sha256Hex(readFileSync(right))) throw new Error('packs differ')
console.log(actual)
`)
  try {
    const sha = execFileSync(process.execPath, [runner, tree, left, right], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
    }).trim()
    assert.match(sha, /^[a-f0-9]{64}$/u)
    assert.equal(sha256Hex(readFileSync(left)), sha)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('stageIuiArtifact accepts a pako archive and rejects a tampered one', async () => {
  const root = join(tmpdir(), `fde-iui-pako-${process.pid}`)
  const tree = join(root, 'tree')
  const archive = join(root, 'iui.tar.gz')
  const bad = join(root, 'bad.tar.gz')
  const dest = join(root, 'plugins', 'iui')
  const pin = {
    version: '0.13.0-iui.26',
    commit: 'abc123',
    artifact: { url: '', sha256: '' },
  }
  mkdirSync(tree, { recursive: true })
  writeFixtureTree(tree, pin)
  try {
    await packDeterministicTarGz(tree, archive)
    pin.artifact.sha256 = sha256Hex(readFileSync(archive))
    await stageIuiArtifact({ dest, pin, artifactPath: archive })
    assert.equal(existsSync(join(dest, 'lib', 'index.js')), true)
    const bytes = Buffer.from(readFileSync(archive))
    bytes[bytes.length - 1] ^= 0xff
    writeFileSync(bad, bytes)
    await assert.rejects(
      () => stageIuiArtifact({ dest, pin, artifactPath: bad }),
      /sha256 mismatch/,
    )
    assert.equal(existsSync(join(dest, 'lib', 'index.js')), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('two deterministic packs of one tree share a sha256', async () => {
  const root = join(tmpdir(), `fde-iui-tar-${process.pid}`)
  const tree = join(root, 'tree')
  mkdirSync(join(tree, 'nested'), { recursive: true })
  writeFileSync(join(tree, 'b.txt'), 'second\n')
  writeFileSync(join(tree, 'nested', 'a.txt'), 'first\n')
  const left = join(root, 'left.tar.gz')
  const right = join(root, 'right.tar.gz')
  try {
    await packDeterministicTarGz(tree, left)
    touchTree(tree)
    await packDeterministicTarGz(tree, right)
    assert.equal(sha256Hex(readFileSync(left)), sha256Hex(readFileSync(right)))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
