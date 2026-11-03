import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { settingsFieldTitle, settingsNsTitle, settingsOptionLabel } from '../settings-copy.mjs'

test('ns titles use Chinese display names', () => {
  assert.equal(settingsNsTitle('ui-settings-account', 'ui-settings-account'), '账户向导')
  assert.equal(settingsNsTitle('ui-theme', 'ui-theme'), '界面主题')
  assert.equal(settingsNsTitle('locale', 'locale'), '语言')
  assert.equal(settingsNsTitle('iui', 'iui'), 'IUI 交互')
  assert.equal(settingsNsTitle('subagent', 'subagent'), '子代理')
  assert.equal(settingsNsTitle('agent-default-model', 'agent-default-model'), '默认模型')
  assert.equal(settingsNsTitle('fde-x-dsh-bridge', 'fde-x-dsh-bridge'), 'FDE 桥')
})

test('field titles prefer Host Chinese then dictionary', () => {
  assert.equal(settingsFieldTitle('ui-theme', 'preference', ''), '主题')
  assert.equal(settingsFieldTitle('locale', 'preference', ''), '语言')
  assert.equal(settingsFieldTitle('iui', 'fenceFeedback', 'fenceFeedback'), '围栏反馈')
  assert.equal(settingsFieldTitle('iui', 'jevApiKey', ''), 'JEV API 密钥')
  assert.equal(settingsFieldTitle('iui', 'unknownField', '自定义标题'), '自定义标题')
  assert.equal(settingsFieldTitle('agent-default-model', 'reasoningEffort', ''), '推理力度')
  assert.equal(settingsFieldTitle('fde-x-dsh-bridge', 'standardDenyServers', ''), '默认拒绝的连接器')
})

test('option labels stay as values when unknown', () => {
  assert.equal(settingsOptionLabel('welcome'), '欢迎')
  assert.equal(settingsOptionLabel('system'), '跟随系统')
  assert.equal(settingsOptionLabel('auto'), '自动')
  assert.equal(settingsOptionLabel(null), '未选')
  assert.equal(settingsOptionLabel('grok-4.6'), 'grok-4.6')
})
