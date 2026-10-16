import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { BUILTIN_PLUGINS } from '../../runtime/builtin-plugins.mjs'
import { IUI_PIN } from './pins.mjs'
import {
  assertIuiTree,
  bundledPluginVersions,
  retargetPrimitivePaths,
  sha256Hex,
  stageIuiArtifact,
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
  assert.match(IUI_PIN.artifact.sha256, /^[a-f0-9]{64}$/u)
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
      /sha256 mismatch/,
    )
    assert.equal(existsSync(join(dest, 'lib', 'index.js')), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
