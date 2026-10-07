import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBuiltInPresetCopy, withPresetDisplay } from '../preset-display.mjs'

const FIXTURE = `
		/** English copy. */
		const en = {
			presetStandardName: "Standard mode",
			presetStandardDescription: "Work with code.",
		};
		/** Simplified Chinese copy. */
		const zh = {
			presetStandardName: "标准模式",
			presetStandardDescription: "处理代码、文件和资料，适合大多数任务。",
			presetPtcName: "PTC 模式",
			presetPtcDescription: "包含标准模式的所有能力。",
		};
`

test('zh built-in copy is parsed from the Host locale bundle', () => {
  const dict = parseBuiltInPresetCopy(FIXTURE, 'zh')
  assert.equal(dict.presetStandardName, '标准模式')
  assert.equal(dict.presetPtcName, 'PTC 模式')
  assert.notEqual(dict.presetStandardName, 'Standard mode')
})

test('shipped preset without name gets Host display copy', async () => {
  const labeled = await withPresetDisplay({ id: 'standard', isDefault: true })
  assert.equal(labeled.name, '标准模式')
  assert.ok(String(labeled.description || '').includes('任务'))
})

test('named declaration keeps its own copy', async () => {
  const labeled = await withPresetDisplay({ id: 'fde-app-builder', name: 'FDE 应用构建', description: '声明式应用构建' })
  assert.equal(labeled.name, 'FDE 应用构建')
  assert.equal(labeled.description, '声明式应用构建')
})
