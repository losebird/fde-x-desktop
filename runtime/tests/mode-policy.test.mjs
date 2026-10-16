import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const policy = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'mode-policy.cjs'))

function agent(preset) {
  return { session: { header: { agentPreset: preset } } }
}

test('standard keeps the IUI section, tools, and skill catalog', () => {
  const assembly = policy.gatePromptAssembly({
    sections: [{ name: 'iui:fence', text: 'fence' }, { name: 'persona', text: 'hi' }],
    tools: [{ name: 'get_trip_stop_images' }, { name: 'read' }],
  }, 'standard')
  assert.deepEqual(assembly.sections.map((section) => section.name), ['iui:fence', 'persona'])
  assert.deepEqual(assembly.tools.map((tool) => tool.name), ['get_trip_stop_images', 'read'])
  const decision = policy.gatePreStepDecision({
    kind: 'continue',
    messages: [{
      source: { kind: 'skill-catalog', entries: [{ name: 'iui' }, { name: 'other' }] },
      content: [{ type: 'text', text: '- `iui`: cards\n- `other`: else' }],
    }],
  }, 'standard')
  assert.equal(decision.messages[0].content[0].text.includes('`iui`'), true)
})

test('app-build and briefing drop the IUI section, tools, skill line, and html deny', () => {
  for (const preset of ['fde-app-builder', 'fde-briefing', '']) {
    const assembly = policy.gatePromptAssembly({
      sections: [{ name: 'iui:fence', text: 'fence' }, { name: 'persona', text: 'hi' }],
      tools: [{ name: 'get_place_images' }, { name: 'get_trip_stop_images' }, { name: 'read' }],
    }, preset)
    assert.deepEqual(assembly.sections.map((section) => section.name), ['persona'])
    assert.deepEqual(assembly.tools.map((tool) => tool.name), ['read'])
    const decision = policy.gatePreStepDecision({
      kind: 'continue',
      messages: [
        {
          source: { kind: 'skill-catalog', entries: [{ name: 'iui', description: 'cards' }, { name: 'other' }] },
          content: [{ type: 'text', text: '- `iui`: cards\n- `other`: else' }],
        },
        { source: { kind: 'skill-invocation', name: 'iui' }, content: [{ type: 'text', text: 'body' }] },
        { source: { kind: 'user' }, content: [{ type: 'text', text: 'keep `iui` in prose' }] },
      ],
    }, preset)
    assert.equal(decision.messages.length, 2)
    assert.equal(decision.messages[0].content[0].text, '- `other`: else')
    assert.deepEqual(decision.messages[0].source.entries.map((entry) => entry.name), ['other'])
    assert.equal(decision.messages[1].content[0].text, 'keep `iui` in prose')
    assert.deepEqual(policy.gateToolDecision({ kind: 'deny', reason: 'IUI: do NOT write HTML' }, preset), { kind: 'allow' })
    assert.deepEqual(policy.gateToolDecision({ kind: 'deny', reason: 'permission' }, preset), { kind: 'deny', reason: 'permission' })
  }
  assert.equal(policy.presetFromAgent(agent('standard')), 'standard')
  assert.equal(policy.presetFromAgent({}), '')
})
