import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex')
}

async function artifact(root, name, spec) {
  const commit = typeof spec === 'string' ? spec : spec.commit
  const version = typeof spec === 'string' || !spec.version ? '9.9.9-test' : spec.version
  const source = typeof spec === 'string' || !spec.source
    ? 'export const name = "@losebird/iui"\nexport function apply() {}\n'
    : spec.source
  const dir = join(root, name)
  await mkdir(join(dir, 'lib'), { recursive: true })
  await writeFile(join(dir, 'package.json'), `${JSON.stringify({ name: '@losebird/iui', version })}\n`)
  await writeFile(join(dir, 'lib', 'index.js'), source)
  if (commit) await writeFile(join(dir, 'fde-plugin-pin.json'), `${JSON.stringify({ commit })}\n`)
  const dest = join(root, `${name}.tar.gz`)
  await tar(dir, dest)
  return dest
}

async function pinFile(dir, pin) {
  const file = join(dir, `pin-${pin.sha256.slice(0, 8)}.mjs`)
  const body = {
    repo: 'https://example.invalid/iui.git',
    commit: pin.commit,
    version: pin.version,
    artifact: { url: '', sha256: pin.sha256 },
  }
  await writeFile(file, `export const IUI_PIN = ${JSON.stringify(body, null, 2)}\n`)
  return file
}

function runStatic(args, envPatch) {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const env = { ...process.env, ...envPatch }
  const child = spawn(process.execPath, ['scripts/iui-perf/run.mjs', '--static', ...args], { cwd: root, env })
  let out = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { out += chunk })
  child.stderr.on('data', (chunk) => { out += chunk })
  const timer = setTimeout(() => child.kill('SIGKILL'), 4000)
  return new Promise((resolve) => {
    child.once('exit', (code) => {
      clearTimeout(timer)
      resolve({ code, out })
    })
  })
}

test('run.mjs does not carry a second copy of the IUI pin', async () => {
  const text = await readFile(new URL('./run.mjs', import.meta.url), 'utf8')
  for (const pin of BANNED) assert.equal(text.includes(pin), false, pin)
})

test('a tarball without the pin file says how to pack one', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'iui-pin-'))
  try {
    const { readIuiPin } = await import('./lib/iui-pin.mjs')
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

const COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

test('a swapped tarball with the same commit is rejected', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'iui-pin-swap-'))
  try {
    const { readIuiPin } = await import('./lib/iui-pin.mjs')
    const good = await artifact(scratch, 'good', { commit: COMMIT, version: '9.9.9-test' })
    const swapped = await artifact(scratch, 'swapped', {
      commit: COMMIT,
      version: '9.9.9-test',
      source: 'export const name = "@losebird/iui"\nexport function apply() {}\n// swapped\n',
    })
    const expected = await pinFile(scratch, {
      commit: COMMIT,
      version: '9.9.9-test',
      sha256: await sha256(good),
    })
    await assert.rejects(() => readIuiPin(swapped, expected), (error) => {
      assert.match(String(error && error.message), /sha256/)
      return true
    })
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
})

test('a version that is not the pin is rejected', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'iui-pin-ver-'))
  try {
    const { readIuiPin } = await import('./lib/iui-pin.mjs')
    const packed = await artifact(scratch, 'packed', { commit: COMMIT, version: '0.0.1-swapped' })
    const expected = await pinFile(scratch, {
      commit: COMMIT,
      version: '9.9.9-test',
      sha256: await sha256(packed),
    })
    await assert.rejects(() => readIuiPin(packed, expected), (error) => {
      assert.match(String(error && error.message), /version/)
      return true
    })
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
})

test('a sha256 that is not the pin is rejected', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'iui-pin-sha-'))
  try {
    const { readIuiPin } = await import('./lib/iui-pin.mjs')
    const packed = await artifact(scratch, 'packed', { commit: COMMIT, version: '9.9.9-test' })
    const expected = await pinFile(scratch, {
      commit: COMMIT,
      version: '9.9.9-test',
      sha256: '0'.repeat(64),
    })
    await assert.rejects(() => readIuiPin(packed, expected), (error) => {
      assert.match(String(error && error.message), /sha256/)
      return true
    })
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
})

test('a missing expected pin says to merge PR-9', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'iui-pin-miss-'))
  try {
    const { readIuiPin } = await import('./lib/iui-pin.mjs')
    const packed = await artifact(scratch, 'packed', { commit: COMMIT, version: '9.9.9-test' })
    await assert.rejects(() => readIuiPin(packed, join(scratch, 'missing-iui-pin.mjs')), (error) => {
      const text = String(error && error.message)
      assert.match(text, /需要先合 PR-9/)
      assert.equal(/[0-9a-f]{64}/.test(text), false, text)
      return true
    })
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
})

test('run.mjs --static rejects a tarball whose bytes are not the expected pin', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'iui-pin-cli-'))
  try {
    const good = await artifact(scratch, 'good', { commit: COMMIT, version: '9.9.9-test' })
    const swapped = await artifact(scratch, 'swapped', {
      commit: COMMIT,
      version: '0.0.1-swapped',
      source: 'export const name = "@losebird/iui"\nexport function apply() {}\n// swapped\n',
    })
    const expected = await pinFile(scratch, {
      commit: COMMIT,
      version: '9.9.9-test',
      sha256: await sha256(good),
    })
    const result = await runStatic(['--iui-pin', expected], { FDE_IUI_ARTIFACT: swapped })
    assert.notEqual(result.code, 0, result.out)
    assert.match(result.out, /sha256/, result.out)
    assert.equal(/\n\s+at /.test(result.out), false, result.out)
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
})
