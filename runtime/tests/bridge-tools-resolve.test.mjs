import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { generationDshBin } from '../generation.mjs'

test('Host generation entry can require dsh-tools', () => {
  const entry = generationDshBin()
  assert.equal(Boolean(entry), true)
  const loaded = createRequire(entry)('@deepseek-ai/dsh-tools')
  assert.equal(typeof loaded.defineTool, 'function')
})

test('fde_* schemas register through Host defineTool', () => {
  const entry = generationDshBin()
  const { defineTool } = createRequire(entry)('@deepseek-ai/dsh-tools')
  const toolsFile = fileURLToPath(new URL('../fde-x-dsh-bridge/lib/tools.js', import.meta.url))
  const { registerTools, FDE_TOOL_NAMES } = createRequire(toolsFile)(toolsFile)
  const names = []
  registerTools({
    tools: {
      register(tool) {
        names.push(tool.name)
      },
    },
  }, { defineTool })
  assert.deepEqual(names, FDE_TOOL_NAMES)
})
