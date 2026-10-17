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
