import assert from 'node:assert/strict'
import test from 'node:test'
import { isInstallingRecord, judgeIuiFirstBoot, parseIuiStateLines } from './iui-first-boot-assert.mjs'

const installing = { state: 'installing', phase: 'link', progress: { completed: 2, total: 4 } }
const enabled = { state: 'enabled', version: '0.13.0-iui.26' }

test('a status poll that sees installing and then enabled passes when the page stays clean', () => {
  const verdict = judgeIuiFirstBoot({
    samples: [installing, enabled],
    transitions: [],
    pageTexts: ['正在首次安装… 写入配置 2/4', 'IUI 0.13.0-iui.26 · 已启用（标准对话）'],
  })
  assert.equal(verdict.ok, true)
  assert.equal(verdict.evidence, 'poll')
})

test('a missed poll uses the transition log and still requires enabled on the status api', () => {
  const verdict = judgeIuiFirstBoot({
    samples: [enabled],
    transitions: [
      { state: 'installing', phase: 'stage', progress: { completed: 0, total: 4 } },
      enabled,
    ],
    pageTexts: ['正在首次启动…'],
  })
  assert.equal(verdict.ok, true)
  assert.equal(verdict.evidence, 'transition log')
})

test('a reversed transition log does not count as installing then enabled', () => {
  const verdict = judgeIuiFirstBoot({
    samples: [enabled],
    transitions: [
      enabled,
      { state: 'installing', phase: 'boot', progress: { completed: 3, total: 4 } },
    ],
    pageTexts: ['已启用'],
  })
  assert.equal(verdict.ok, false)
  assert.equal(verdict.failures.includes('transition log recorded enabled before installing'), true)
})

test('installing without a recorded transition fails', () => {
  const verdict = judgeIuiFirstBoot({
    samples: [enabled],
    transitions: [],
    pageTexts: ['已启用'],
  })
  assert.equal(verdict.ok, false)
  assert.equal(verdict.failures.includes('installing was missing from status polls and from the transition log'), true)
})

test('the page must not show a missing install or a pnpm dev retry', () => {
  const missing = judgeIuiFirstBoot({
    samples: [installing, enabled],
    transitions: [],
    pageTexts: ['面板 IUI 未安装'],
  })
  assert.equal(missing.ok, false)
  const retry = judgeIuiFirstBoot({
    samples: [installing, enabled],
    transitions: [],
    pageTexts: ['本地核心还没接通。请重新执行 `pnpm dev`'],
  })
  assert.equal(retry.ok, false)
})

test('an installing record needs a known phase and progress', () => {
  assert.equal(isInstallingRecord({ state: 'installing', phase: 'link', progress: { completed: 2, total: 4 } }), true)
  assert.equal(isInstallingRecord({ state: 'installing', phase: 'link' }), false)
  assert.equal(isInstallingRecord({ state: 'installing', phase: 'other', progress: { completed: 1, total: 4 } }), false)
})

test('transition log lines keep their order', () => {
  const rows = parseIuiStateLines([
    'noise',
    'iui-state {"state":"installing","phase":"stage","progress":{"completed":0,"total":4}}',
    'iui-boot profile:100',
    'iui-state {"state":"enabled","version":"0.13.0-iui.26"}',
  ].join('\n'))
  assert.equal(rows[0].phase, 'stage')
  assert.equal(rows[1].state, 'enabled')
})
