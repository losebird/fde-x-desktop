import './support/no-stray-processes.mjs'
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

test('standard drops the IUI fence and keeps the tools and skill catalog', () => {
  const assembly = policy.gatePromptAssembly({
    sections: [{ name: 'iui:fence', text: 'fence' }, { name: 'persona', text: 'hi' }],
    tools: [{ name: 'get_trip_stop_images' }, { name: 'read' }],
  }, 'standard')
  assert.deepEqual(assembly.sections.map((section) => section.name), ['persona'])
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

function catalogAgent(entries, seq = 1) {
  const event = {
    type: 'user/message',
    seq,
    data: { source: { kind: 'skill-catalog', form: 'catalog', entries } },
  }
  return {
    session: {
      seq: seq + 1,
      surface: { nodes: [seq] },
      eventAt(index) {
        return index === seq ? event : undefined
      },
    },
  }
}

test('standard skill catalog clips the model line and leaves durable entries', () => {
  const long = `${'token '.repeat(40)}end`
  const decision = policy.gatePreStepDecision({
    kind: 'continue',
    messages: [{
      source: { kind: 'skill-catalog', form: 'catalog', entries: [{ name: 'sales-call-prep', description: long }] },
      content: [{ type: 'text', text: `- \`sales-call-prep\`: ${long}` }],
    }],
  }, 'standard')
  const entry = decision.messages[0].source.entries[0]
  assert.equal(entry.name, 'sales-call-prep')
  assert.equal(entry.description, long)
  const line = decision.messages[0].content[0].text
  assert.equal(line.includes('sales-call-prep'), true)
  assert.equal(line.includes('end'), false)
  const clipped = line.match(/^- `sales-call-prep`: (.+)$/m)[1]
  assert.equal(clipped.length, 80)
})

test('identical skill catalog already on the surface is not injected again', () => {
  const entries = [{ name: 'search-digest', description: `${'token '.repeat(40)}end` }]
  const decision = policy.gatePreStepDecision({
    kind: 'continue',
    messages: [{
      source: { kind: 'skill-catalog', form: 'catalog', update: true, entries },
      content: [{ type: 'text', text: `- \`search-digest\`: ${entries[0].description}` }],
    }, {
      source: { kind: 'user' },
      content: [{ type: 'text', text: '昨天聊了哪些事情?' }],
    }],
  }, 'standard', catalogAgent(entries))
  assert.equal(decision.messages.length, 1)
  assert.equal(decision.messages[0].content[0].text, '昨天聊了哪些事情?')
})

test('a changed skill catalog still replaces the previous table', () => {
  const prior = [{ name: 'search-digest', description: 'old digest' }]
  const next = [{ name: 'search-digest', description: 'old digest' }, { name: 'project-memory', description: 'graph' }]
  const decision = policy.gatePreStepDecision({
    kind: 'continue',
    messages: [{
      source: { kind: 'skill-catalog', form: 'catalog', update: true, entries: next },
      content: [{ type: 'text', text: '- `search-digest`: old digest\n- `project-memory`: graph' }],
    }],
  }, 'standard', catalogAgent(prior))
  assert.equal(decision.messages.length, 1)
  assert.deepEqual(decision.messages[0].source.entries.map((entry) => entry.name), ['search-digest', 'project-memory'])
})

test('a skill catalog returns after the visible copy is pruned', () => {
  const entries = [{ name: 'search-digest', description: 'digest' }]
  const hidden = {
    type: 'user/message',
    seq: 1,
    data: { source: { kind: 'skill-catalog', form: 'catalog', entries } },
  }
  const agent = {
    session: {
      seq: 2,
      surface: { nodes: [] },
      eventAt(index) {
        return index === 1 ? hidden : undefined
      },
    },
  }
  const decision = policy.gatePreStepDecision({
    kind: 'continue',
    messages: [{
      source: { kind: 'skill-catalog', form: 'catalog', entries },
      content: [{ type: 'text', text: '- `search-digest`: digest' }],
    }],
  }, 'standard', agent)
  assert.equal(decision.messages.length, 1)
  assert.equal(decision.messages[0].source.kind, 'skill-catalog')
})

test('duplicate skill catalogs in one step collapse to one table', () => {
  const entries = [{ name: 'search-digest', description: 'digest' }]
  const catalog = (update) => ({
    source: { kind: 'skill-catalog', form: 'catalog', update, entries },
    content: [{ type: 'text', text: '- `search-digest`: digest' }],
  })
  const decision = policy.gatePreStepDecision({
    kind: 'continue',
    messages: [
      catalog(false),
      { source: { kind: 'user' }, content: [{ type: 'text', text: 'keep me' }] },
      catalog(true),
    ],
  }, 'standard')
  assert.equal(decision.messages.length, 2)
  assert.equal(decision.messages[0].source.kind, 'user')
  assert.equal(decision.messages[1].source.kind, 'skill-catalog')
  assert.equal(decision.messages[1].source.update, true)
})

test('a later time-context is dropped when one is already on the surface', () => {
  const event = {
    type: 'user/message',
    seq: 1,
    data: { source: { kind: 'time-context' } },
  }
  const agent = {
    session: {
      seq: 2,
      surface: { nodes: [1] },
      eventAt(index) {
        return index === 1 ? event : undefined
      },
    },
  }
  const decision = policy.gatePreStepDecision({
    kind: 'continue',
    messages: [
      { source: { kind: 'time-context' }, content: [{ type: 'text', text: 'Time sampled turn 2' }] },
      { source: { kind: 'user' }, content: [{ type: 'text', text: 'hello' }] },
    ],
  }, 'standard', agent)
  assert.equal(decision.messages.length, 1)
  assert.equal(decision.messages[0].content[0].text, 'hello')
})

test('assembly tools stay in name order', () => {
  const assembly = policy.gatePromptAssembly({
    sections: [],
    tools: [{ name: 'write' }, { name: 'bash' }, { name: 'read' }],
  }, 'standard')
  assert.deepEqual(assembly.tools.map((tool) => tool.name), ['bash', 'read', 'write'])
})

test('app-build and briefing drop the IUI section, tools, and skill line', () => {
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
    assert.equal(policy.resumePastIuiHtmlDeny({ kind: 'deny', reason: 'IUI: do NOT write HTML' }, preset), true)
    assert.equal(policy.resumePastIuiHtmlDeny({ kind: 'deny', reason: 'permission' }, preset), false)
    assert.equal(policy.resumePastIuiHtmlDeny({ kind: 'deny', reason: 'IUI: do NOT write HTML' }, 'standard'), false)
  }
  assert.equal(policy.presetFromAgent(agent('standard')), 'standard')
  assert.equal(policy.presetFromAgent({}), '')
})
