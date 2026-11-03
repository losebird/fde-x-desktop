import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('AI 核心 hangs IUI settings.section outside Host 配置', () => {
  const panel = readFileSync(join(root, 'src/components/settings/HostNsPanel.tsx'), 'utf8')
  assert.match(panel, /IuiHostSection/)
  assert.match(panel, /row\.ns !== 'iui'/)
  assert.ok(panel.indexOf('<IuiHostSection') < panel.indexOf('<SettingsDescribeForm'))
})

test('Vite compiles IUI settings.section from the pin src and a primitives shim', () => {
  const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8')
  assert.match(vite, /resolveIuiSrc/)
  assert.match(vite, /iui-src/)
  assert.match(vite, /@deepseek-ai\/dsh-client-ui-primitives/)
  assert.match(vite, /iui-primitives-shim/)
  assert.match(vite, /iui-tailwind-stub/)
  assert.match(vite, /iuiSettingsZh/)
})
