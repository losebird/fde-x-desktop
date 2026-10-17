import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { packDeterministicTarGz, sha256Hex } from './iui-artifact.mjs'
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
  try {
    await packDeterministicTarGz(canon, canonTar)
    await packDeterministicTarGz(mirror, mirrorTar)
    assert.equal(sha(mirrorTar), sha(canonTar))
  } finally {
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
