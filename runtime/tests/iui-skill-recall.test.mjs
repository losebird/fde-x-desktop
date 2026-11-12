import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skill = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../resources/plugins/iui/SKILL.md'),
  'utf8',
)

test('IUI skill searches other sessions before drawing a recall page', () => {
  assert.match(skill, /跨会话回忆/)
  assert.match(skill, /search_text/)
  assert.match(skill, /tool:dsh-semantic-os-first-turn/)
  assert.match(skill, /整个工作区会话摘录/)
  assert.match(skill, /不要解压 `session\.v4\.jsonl\.zstd`/)
  assert.doesNotMatch(skill, /凡「要看\/要玩的东西」，在回答正文直接输出\*\*一个闭合\*\*围栏（不要写文件、不要先调 bash 做页面）：\n/)
  assert.match(skill, /跨会话回忆除外/)
})
