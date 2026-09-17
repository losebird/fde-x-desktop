import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { PRESET_ID_RE, classifyPresetSource, validatePresetDirectory } from '../routes/presets.mjs'

test('PRESET_ID_RE accepts valid ids', () => {
  assert.equal(PRESET_ID_RE.test('minimal-zh'), true)
  assert.equal(PRESET_ID_RE.test('Standard'), false)
  assert.equal(PRESET_ID_RE.test(''), false)
})

test('classifyPresetSource marks fde ids', () => {
  assert.equal(classifyPresetSource('fde-app-builder', null, 'system'), 'fde')
  assert.equal(classifyPresetSource('standard', { kind: 'shipped', path: '/x' }, 'system'), 'shipped')
  assert.equal(classifyPresetSource('mine', { kind: 'user', path: '/u' }, 'user'), 'user')
})

test('validatePresetDirectory requires agent.cordis.yml', async () => {
  const dir = join('/tmp', `fde-preset-test-${Date.now()}`)
  await mkdir(dir, { recursive: true })
  try {
    const missing = await validatePresetDirectory(dir)
    assert.equal(missing.ok, false)
    assert.match(missing.errors.join(' '), /agent\.cordis\.yml/)
    await writeFile(join(dir, 'agent.cordis.yml'), 'name: demo\n')
    await writeFile(join(dir, 'preset.yml'), 'name: Demo\n')
    const ok = await validatePresetDirectory(dir, { shippedIds: new Set(['standard']) })
    assert.equal(ok.ok, true)
    assert.equal(ok.preview.id, dir.split('/').pop())
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('validatePresetDirectory rejects shipped id conflict', async () => {
  const dir = join('/tmp', 'standard')
  await mkdir(dir, { recursive: true })
  try {
    await writeFile(join(dir, 'agent.cordis.yml'), 'x: 1\n')
    const result = await validatePresetDirectory(dir, { shippedIds: new Set(['standard']) })
    assert.equal(result.ok, false)
    assert.match(result.errors.join(' '), /冲突/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('git import disabled returns 501 from route handler', async () => {
  const prev = process.env.FDE_ALLOW_GIT_IMPORT
  delete process.env.FDE_ALLOW_GIT_IMPORT
  const { handlePresetRoutes } = await import('../routes/presets.mjs')
  const response = {
    headersSent: false,
    writableEnded: false,
    writeHead() {},
    end() {},
  }
  let status = 0
  let payload = null
  const sendJson = (_res, code, body) => { status = code; payload = body }
  const sendError = (_res, code, errCode, message) => { status = code; payload = { error: { code: errCode, message } } }
  const handled = await handlePresetRoutes(
    { method: 'POST' },
    response,
    new URL('http://127.0.0.1/api/v1/ai/presets/import-git'),
    {
      aiRuntime: { dshHome: '/tmp', profileName: 'x', call: async () => ({}) },
      currentCorrelationId: 't',
      sendJson,
      sendError,
      readJson: async () => ({ url: 'https://example.com/repo.git' }),
    },
  )
  assert.equal(handled, true)
  assert.equal(status, 501)
  assert.equal(payload.error.code, 'git_import_disabled')
  if (prev) process.env.FDE_ALLOW_GIT_IMPORT = prev
})
