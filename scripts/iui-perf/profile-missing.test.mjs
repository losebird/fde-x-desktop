import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyProfilePatch } from './lib/profile-patch.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))

function profileHint(text) {
  assert.match(text, /cordis\.patch\.yml/)
  assert.match(text, /fde-x/)
  assert.match(text, /node runtime\/server\.mjs/)
  assert.match(text, /ensureIsolatedProfile/)
  assert.equal(/\bENOENT\b/.test(text), false, text)
}

test('applyProfilePatch names a missing cordis.patch.yml instead of throwing ENOENT', async () => {
  const missing = join(tmpdir(), 'missing-fde-x-cordis.patch.yml')
  const home = await mkdtemp(join(tmpdir(), 'iui-missing-profile-'))
  const previous = process.env.IUI_PERF_PROFILE_PATCH
  process.env.IUI_PERF_PROFILE_PATCH = missing
  try {
    await assert.rejects(() => applyProfilePatch(home, ['fde-x']), (error) => {
      profileHint(String(error && error.message))
      return true
    })
  } finally {
    if (previous == null) delete process.env.IUI_PERF_PROFILE_PATCH
    else process.env.IUI_PERF_PROFILE_PATCH = previous
    await rm(home, { recursive: true, force: true })
  }
})

test('a live run checks the profile patch before it measures', async () => {
  const missing = join(tmpdir(), 'missing-live-cordis.patch.yml')
  const env = { ...process.env, IUI_PERF_PROFILE_PATCH: missing, GROK2API_API_KEY: 'static-intercept' }
  delete env.FDE_IUI_ARTIFACT
  const child = spawn(process.execPath, ['scripts/iui-perf/run.mjs'], { cwd: root, env })
  let out = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { out += chunk })
  child.stderr.on('data', (chunk) => { out += chunk })
  const code = await new Promise((resolve) => child.once('exit', resolve))
  assert.equal(code === 0, false, out)
  profileHint(out)
})
