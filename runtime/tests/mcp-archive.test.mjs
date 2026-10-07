import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMcpPatchBlock,
  discoverLocalMcpServersFromFiles,
  normalizeCordisPatchText,
  parseMcpPatchEntries,
  removeMcpPatchEntry,
  rewriteMcpArchiveInserts,
  sanitizeMcpServerName,
  upsertMcpDisabled,
  upsertMcpPatchEntry,
  upsertPatchDisabled,
  mcpArchivePaths,
  mcpArchiveSnapshot,
  mcpEntryFingerprint,
  mcpFingerprintMatches,
} from '../mcp-archive.mjs'

test('discoverLocalMcpServersFromFiles reads mcpServers without hardcoding names', () => {
  const rows = discoverLocalMcpServersFromFiles([JSON.stringify({
    mcpServers: {
      'context7-1': { type: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
      web: { type: 'http', url: 'http://127.0.0.1:3000/mcp' },
    },
  })])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].serverName, 'context7-1')
  assert.equal(rows[0].transport, 'stdio')
  assert.equal(rows[1].transport, 'streamable-http')
})

test('buildMcpPatchBlock is parsed back as a Host mcp-client row', () => {
  const block = buildMcpPatchBlock({
    serverName: 'alpha',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'pkg'],
  })
  assert.match(block, /^- insert:/m)
  const rows = parseMcpPatchEntries(block)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].serverName, 'alpha')
  assert.equal(rows[0].command, 'npx')
  assert.deepEqual(rows[0].args, ['-y', 'pkg'])
})

test('rewriteMcpArchiveInserts wraps bare mcp-client rows for Host loader', () => {
  const bare = [
    '- id: llm-pi-ai',
    '  name: x',
    '- id: mcp-alpha',
    "  name: '@deepseek-ai/dsh-mcp-client'",
    '  config:',
    '    transport: stdio',
    '    serverName: alpha',
    '    command: "npx"',
    '    args: ["-y","pkg"]',
    '',
  ].join('\n')
  const rewritten = rewriteMcpArchiveInserts(bare)
  assert.equal(rewritten.changed, true)
  assert.match(rewritten.text, /^- insert:/m)
  assert.match(rewritten.text, /id: llm-pi-ai/)
  const rows = parseMcpPatchEntries(rewritten.text)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].serverName, 'alpha')
  const again = rewriteMcpArchiveInserts(rewritten.text)
  assert.equal(again.changed, false)
})

test('remove and disable mcp archive rows keep sibling plugins', () => {
  const block = buildMcpPatchBlock({
    serverName: 'alpha',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'pkg'],
  })
  const text = `- id: llm-pi-ai\n  name: x\n${block}`
  const disabled = upsertMcpDisabled(text, 'alpha', true)
  assert.match(disabled, /disabled: true/)
  assert.match(disabled, /id: llm-pi-ai/)
  const removed = removeMcpPatchEntry(disabled, 'alpha')
  assert.equal(parseMcpPatchEntries(removed).length, 0)
  assert.match(removed, /id: llm-pi-ai/)
})

test('upsertPatchDisabled enables skill filesystem without wiping other rows', () => {
  const next = upsertPatchDisabled('- id: llm-pi-ai\n  name: x\n', 'skill-filesystem', false, '@deepseek-ai/dsh-skill-filesystem')
  assert.match(next, /id: llm-pi-ai/)
  assert.match(next, /id: skill-filesystem/)
  assert.match(next, /name: "@deepseek-ai\/dsh-skill-filesystem"/)
  assert.match(next, /disabled: false/)
  const again = upsertPatchDisabled(upsertPatchDisabled(next, 'skill-filesystem', false, '@deepseek-ai/dsh-skill-filesystem'), 'skill-filesystem', false)
  assert.equal([...again.matchAll(/^- id: skill-filesystem/mg)].length, 1)
  assert.equal([...again.matchAll(/^\s+disabled:/mg)].length, 1)
})

test('sanitizeMcpServerName stays within Host serverName shape', () => {
  assert.equal(sanitizeMcpServerName('context7-1'), 'context7-1')
  assert.equal(sanitizeMcpServerName('bad name!'), 'bad-name')
})

test('normalizeCordisPatchText is one sequence and drops empty-array documents', () => {
  assert.equal(normalizeCordisPatchText(''), '')
  assert.equal(normalizeCordisPatchText('[]\n'), '')
  const mixed = '[]\n\n- id: skill-filesystem\n  name: "@deepseek-ai/dsh-skill-filesystem"\n'
  const next = normalizeCordisPatchText(mixed)
  assert.equal(next.startsWith('- id:'), true)
  assert.equal(next.includes('[]'), false)
  assert.match(next, /id: skill-filesystem/)
})

test('upsertPatchDisabled on empty-array occupancy writes one sequence', () => {
  const next = upsertPatchDisabled('[]\n', 'skill-filesystem', false, '@deepseek-ai/dsh-skill-filesystem')
  assert.equal(next.includes('[]'), false)
  assert.match(next, /^- id: skill-filesystem/m)
  const again = normalizeCordisPatchText(next)
  assert.equal(again, next)
})

test('normalizeCordisPatchText is idempotent on a live sequence', () => {
  const live = '- id: llm-pi-ai\n  name: x\n- insert:\n    - id: mcp-alpha\n      name: y\n'
  assert.equal(normalizeCordisPatchText(normalizeCordisPatchText(live)), normalizeCordisPatchText(live))
  assert.match(normalizeCordisPatchText(live), /id: llm-pi-ai/)
  assert.match(normalizeCordisPatchText(live), /id: mcp-alpha/)
})

test('parse and build round-trip env, args, headers, and disabled', () => {
  const stdio = {
    serverName: 'alpha',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'pkg'],
    env: { TOKEN: 'abc', HOME: '/tmp' },
    disabled: true,
  }
  const parsed = parseMcpPatchEntries(buildMcpPatchBlock(stdio))
  const withDisabled = parseMcpPatchEntries(upsertMcpDisabled(buildMcpPatchBlock(stdio), 'alpha', true))
  assert.equal(withDisabled[0].serverName, 'alpha')
  assert.equal(withDisabled[0].command, 'npx')
  assert.deepEqual(withDisabled[0].args, ['-y', 'pkg'])
  assert.equal(withDisabled[0].env.TOKEN, 'abc')
  assert.equal(withDisabled[0].env.HOME, '/tmp')
  assert.equal(withDisabled[0].disabled, true)
  const http = parseMcpPatchEntries(buildMcpPatchBlock({
    serverName: 'beta',
    transport: 'streamable-http',
    url: 'https://example.test/mcp',
    headers: { Authorization: 'Bearer z' },
  }))
  assert.equal(http[0].transport, 'streamable-http')
  assert.equal(http[0].url, 'https://example.test/mcp')
  assert.equal(http[0].headers.Authorization, 'Bearer z')
  assert.equal(parsed.length, 1)
})

test('upsertMcpPatchEntry keeps disabled unless the entry sets it', () => {
  const archived = upsertMcpDisabled(buildMcpPatchBlock({
    serverName: 'alpha',
    transport: 'stdio',
    command: 'npx',
    args: ['-y'],
  }), 'alpha', true)
  const edited = upsertMcpPatchEntry(archived, {
    serverName: 'alpha',
    transport: 'stdio',
    command: '/usr/bin/true',
    args: [],
  })
  const kept = parseMcpPatchEntries(edited)[0]
  assert.equal(kept.disabled, true)
  assert.equal(kept.command, '/usr/bin/true')
  const cleared = upsertMcpPatchEntry(edited, {
    serverName: 'alpha',
    transport: 'stdio',
    command: '/usr/bin/true',
    disabled: false,
  })
  assert.equal(parseMcpPatchEntries(cleared)[0].disabled, false)
})

test('upsertMcpPatchEntry replaces the same serverName and keeps siblings', () => {
  const text = `- id: llm-pi-ai\n  name: x\n${buildMcpPatchBlock({
    serverName: 'alpha',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'old'],
    env: { A: '1' },
  })}`
  const next = upsertMcpPatchEntry(text, {
    serverName: 'alpha',
    transport: 'stdio',
    command: '/usr/bin/true',
    args: [],
    env: { B: '2' },
  })
  const rows = parseMcpPatchEntries(next)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].command, '/usr/bin/true')
  assert.equal(rows[0].env.B, '2')
  assert.equal(rows[0].env && rows[0].env.A, undefined)
  assert.match(next, /id: llm-pi-ai/)
})

test('archive fingerprint ignores disabled and catches command edits', () => {
  const alpha = { serverName: 'alpha', transport: 'stdio', command: 'npx', args: ['-y'], env: { K: 'v' } }
  const snapshot = mcpArchiveSnapshot([alpha])
  assert.equal(mcpFingerprintMatches({ ...alpha, disabled: true }, snapshot), true)
  assert.equal(mcpFingerprintMatches({ ...alpha, command: 'node' }, snapshot), false)
  assert.equal(mcpFingerprintMatches({ serverName: 'beta', transport: 'stdio', command: 'npx' }, snapshot), false)
  assert.equal(mcpFingerprintMatches(alpha, null), false)
  assert.equal(mcpFingerprintMatches(alpha, undefined), false)
  assert.equal(mcpEntryFingerprint(alpha), mcpEntryFingerprint({ ...alpha, disabled: true }))
})

test('mcpArchivePaths uses the profile archive when present', () => {
  const profile = mcpArchivePaths({ dshHome: '/tmp/dsh-home', profileName: 'fde-x', patchFile: '/tmp/occupancy.patch.yml' })
  assert.deepEqual(profile, ['/tmp/dsh-home/profiles/fde-x/cordis.patch.yml'])
  assert.deepEqual(mcpArchivePaths({ patchFile: '/tmp/occupancy.patch.yml' }), ['/tmp/occupancy.patch.yml'])
})

