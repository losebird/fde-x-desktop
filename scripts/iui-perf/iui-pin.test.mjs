import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BANNED = [
  'c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37',
  'f3dc3ef1d099aace99d626f38c1c9eac1cf0ce1f631a67ba64919155ca0225a5',
]

function tar(dir, dest) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['-czf', dest, '-C', dir, '.'])
    let err = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => { err += chunk })
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(err || `tar exit ${code}`))))
  })
}

async function artifact(root, name, commit) {
  const dir = join(root, name)
  await mkdir(join(dir, 'lib'), { recursive: true })
  await writeFile(join(dir, 'package.json'), `${JSON.stringify({ name: '@losebird/iui', version: '9.9.9-test' })}\n`)
  await writeFile(join(dir, 'lib', 'index.js'), 'export const name = "@losebird/iui"\nexport function apply() {}\n')
  if (commit) await writeFile(join(dir, 'fde-plugin-pin.json'), `${JSON.stringify({ commit })}\n`)
  const dest = join(root, `${name}.tar.gz`)
  await tar(dir, dest)
  return dest
}

test('run.mjs does not carry a second copy of the IUI pin', async () => {
  const text = await readFile(new URL('./run.mjs', import.meta.url), 'utf8')
  for (const pin of BANNED) assert.equal(text.includes(pin), false, pin)
})

test('two artifacts supply two commits, and a tarball without the pin file says how to pack one', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'iui-pin-'))
  try {
    const { readIuiPin } = await import('./lib/iui-pin.mjs')
    const alpha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const beta = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const alphaPin = await readIuiPin(await artifact(scratch, 'alpha', alpha))
    const betaPin = await readIuiPin(await artifact(scratch, 'beta', beta))
    assert.equal(alphaPin.commit, alpha)
    assert.equal(betaPin.commit, beta)
    const noneTar = await artifact(scratch, 'none', '')
    await assert.rejects(() => readIuiPin(noneTar), (error) => {
      const text = String(error && error.message)
      assert.match(text, /fde-plugin-pin\.json/)
      assert.match(text, /cursor\/iui-pack-pin-6fc8/)
      assert.match(text, /node scripts\/pack\/build-iui\.mjs/)
      assert.match(text, /iui-<commit>\.tar\.gz/)
      for (const pin of BANNED) assert.equal(text.includes(pin), false, text)
      return true
    })
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
})
