import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyPresetSource, fdePresetIdsFromDisk, writeGeneratedAgentPresetPatch } from '../routes/presets.mjs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FDE_RUNTIME_DIR } from '../config.mjs'

test('Host-listed packs without a user directory are shipped, not user', () => {
  assert.equal(classifyPresetSource('standard'), 'shipped')
  assert.equal(classifyPresetSource('ptc'), 'shipped')
  assert.equal(classifyPresetSource('unknown-pack'), 'shipped')
})

test('user directory wins as user; FDE disk ids stay fde', () => {
  assert.equal(classifyPresetSource('my-writer', { kind: 'user', path: '/tmp/my-writer' }), 'user')
  const fdeIds = fdePresetIdsFromDisk()
  assert.ok(fdeIds.has('fde-app-builder'))
  assert.equal(classifyPresetSource('fde-app-builder', { kind: 'user', path: '/tmp/x' }), 'fde')
})

test('generated patch registers FDE folders as dsh-agent-preset inserts', async () => {
  const dest = await writeGeneratedAgentPresetPatch()
  const text = await readFile(dest, 'utf8')
  assert.equal(dest, join(FDE_RUNTIME_DIR, 'presets', '.generated-agent-presets.patch.yml'))
  assert.match(text, /name: '@deepseek-ai\/dsh-agent-preset'/)
  assert.match(text, /id: fde-app-builder/)
  assert.match(text, /id: fde-briefing/)
  assert.match(text, /name: FDE 应用构建/)
  assert.doesNotMatch(text, /^- include:/m)
})
