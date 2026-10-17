import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, utimesSync } from 'node:fs'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { finishIuiArtifact } from './build-iui.mjs'

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

test('the next pack removes a SIGKILL partial and keeps a live write and a good tar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-iui-partial-'))
  const tree = join(dir, 'tree')
  mkdirSync(join(tree, 'lib'), { recursive: true })
  writeFileSync(join(tree, 'lib', 'index.js'), 'export {}\n')
  const good = join(dir, 'iui-c5b5a4b7.tar.gz')
  writeFileSync(good, 'good-archive')
  const goodSha = sha(good)
  const dead = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  const deadPartial = `iui-c5b5a4b7.tar.gz.${dead.pid}.ab12cd34.partial`
  writeFileSync(join(dir, deadPartial), 'half-written')
  process.kill(dead.pid, 'SIGKILL')
  await new Promise((resolveWait, reject) => {
    dead.once('exit', resolveWait)
    dead.once('error', reject)
  })
  const live = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  const livePartial = `iui-c5b5a4b7.tar.gz.${live.pid}.ffffeeee.partial`
  writeFileSync(join(dir, livePartial), 'still-writing')
  const ancient = 'iui-c5b5a4b7.tar.gz.note.partial'
  writeFileSync(join(dir, ancient), 'old')
  const old = new Date(Date.now() - 60 * 60 * 1000)
  utimesSync(join(dir, ancient), old, old)
  try {
    await assert.rejects(
      () => finishIuiArtifact(tree, good, { artifact: { sha256: 'f'.repeat(64) } }, { 'lib/index.js': 'deadbeef' }),
      /IUI artifact sha256 mismatch/,
    )
    const names = await readdir(dir)
    console.log(`names ${names.join(' ')}`)
    assert.equal(names.includes(deadPartial), false)
    assert.equal(names.includes(ancient), false)
    assert.equal(names.includes(livePartial), true)
    assert.equal(sha(good), goodSha)
  } finally {
    process.kill(live.pid, 'SIGKILL')
  }
})
