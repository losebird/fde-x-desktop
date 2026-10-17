import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('run.mjs --help prints usage and exits before any IUI build', async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const child = spawn(process.execPath, ['scripts/iui-perf/run.mjs', '--help'], { cwd: root })
  let out = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { out += chunk })
  child.stderr.on('data', (chunk) => { out += chunk })
  const code = await new Promise((resolve) => child.once('exit', resolve))
  assert.equal(code, 0, out)
  assert.match(out, /FDE_IUI_ARTIFACT/)
  assert.equal(out.includes('build-iui'), false, out)
})

function runStatic(envPatch) {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const env = { ...process.env }
  delete env.FDE_IUI_ARTIFACT
  Object.assign(env, envPatch)
  const child = spawn(process.execPath, ['scripts/iui-perf/run.mjs', '--static'], { cwd: root, env })
  let out = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { out += chunk })
  child.stderr.on('data', (chunk) => { out += chunk })
  return new Promise((resolve) => {
    child.once('exit', (code) => resolve({ code, out }))
  })
}

test('a missing IUI artifact names the branch and command that pack it', async () => {
  const hint = /cursor\/iui-pack-pin-6fc8[\s\S]*node scripts\/pack\/build-iui\.mjs[\s\S]*iui-<commit>\.tar\.gz/
  const missing = await runStatic({})
  const absent = await runStatic({ FDE_IUI_ARTIFACT: '/tmp/fde-iui-artifact-missing.tar.gz' })
  assert.equal(missing.code === 0, false, missing.out)
  assert.equal(absent.code === 0, false, absent.out)
  assert.match(missing.out, hint, missing.out)
  assert.match(absent.out, hint, absent.out)
  assert.equal(/[0-9a-f]{40}/.test(missing.out), false, missing.out)
  assert.equal(/[0-9a-f]{40}/.test(absent.out), false, absent.out)
})
