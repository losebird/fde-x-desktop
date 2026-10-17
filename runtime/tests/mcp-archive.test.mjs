import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMcpPatchBlock,
  decorateDiscoveredMcpRows,
  discoverLocalMcpServersFromFiles,
  ensureLocalMcpInProfile,
  normalizeCordisPatchText,
  parseMcpPatchEntries,
  removeMcpPatchEntry,
  rewriteMcpArchiveInserts,
  unwrapStdioBridgeEntry,
  sanitizeMcpServerName,
  upsertMcpDisabled,
  upsertMcpPatchEntry,
  upsertPatchDisabled,
  mcpArchivePaths,
  mcpArchiveSnapshot,
  mcpEntryFingerprint,
  mcpFingerprintMatches,
  applyMcpBootHold,
  buildMcpBootHoldPatch,
  homeCordisPatchPath,
  releaseMcpBootHold,
  resolveStdioCwd,
  ensureSkillProvidersInProfile,
} from '../mcp-archive.mjs'

test('decorateDiscoveredMcpRows marks rows already in the archive', () => {
  const rows = decorateDiscoveredMcpRows(
    [{ serverName: 'alpha', transport: 'stdio', command: 'npx', args: ['-y', 'pkg'] }],
    ['alpha'],
  )
  assert.equal(rows[0].present, true)
  const fresh = decorateDiscoveredMcpRows(
    [{ serverName: 'beta', transport: 'streamable-http', url: 'http://127.0.0.1/mcp' }],
    ['alpha'],
  )
  assert.equal(fresh[0].present, false)
})

test('ensureLocalMcpInProfile rewrites YAML and does not insert discovered servers', async () => {
  const { mkdtemp, mkdir, readFile, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const home = await mkdtemp(join(tmpdir(), 'fde-mcp-ensure-'))
  const file = join(home, 'profiles', 'fde-x', 'cordis.patch.yml')
  await mkdir(join(home, 'profiles', 'fde-x'), { recursive: true })
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
  await writeFile(file, bare)
  await ensureLocalMcpInProfile({ dshHome: home, profileName: 'fde-x' })
  const text = await readFile(file, 'utf8')
  const rows = parseMcpPatchEntries(text)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].serverName, 'alpha')
  assert.match(text, /^- insert:/m)
})

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
    cwd: '/tmp/ws',
  })
  assert.match(block, /^- insert:/m)
  const rows = parseMcpPatchEntries(block)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].serverName, 'alpha')
  assert.equal(rows[0].command, 'npx')
  assert.deepEqual(rows[0].args, ['-y', 'pkg'])
  assert.equal(rows[0].cwd, '/tmp/ws')
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

test('unwrapStdioBridgeEntry drops the Content-Length translator', () => {
  const wrapped = {
    serverName: 'playwright',
    transport: 'stdio',
    command: '/usr/bin/node',
    args: ['/app/runtime/mcp-stdio-bridge.mjs', '--', 'npx', '-y', '@playwright/mcp', '--headless'],
    cwd: '/tmp/ws',
  }
  const unwrapped = unwrapStdioBridgeEntry(wrapped)
  assert.equal(unwrapped.command, 'npx')
  assert.deepEqual(unwrapped.args, ['-y', '@playwright/mcp', '--headless'])
  assert.equal(unwrapped.cwd, '/tmp/ws')
  assert.equal(unwrapStdioBridgeEntry({ command: 'npx', args: ['-y', 'pkg'] }), null)
})

test('parseMcpPatchEntries reads Host-folded stdio command and args', () => {
  const folded = [
    '- id: llm-pi-ai',
    '  name: x',
    '- id: mcp-playwright',
    '  disabled: false',
    '- insert:',
    '    - id: mcp-playwright',
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '      config:',
    '        transport: stdio',
    '        serverName: playwright',
    '        command: "/opt/FDE-X.app/Contents/Resources/resources/node/b\\',
    '          in/node"',
    '        args:',
    '          [',
    '            "/opt/FDE-X.app/Contents/Resources/resources/a\\',
    '              pp/runtime/mcp-stdio-bridge.mjs",',
    '            "--",',
    '            "npx",',
    '            "-y",',
    '            "@playwright/mcp",',
    '            "--headless"',
    '          ]',
    '        cwd: "/tmp/ws"',
    '',
  ].join('\n')
  const rows = parseMcpPatchEntries(folded)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].command, '/opt/FDE-X.app/Contents/Resources/resources/node/bin/node')
  assert.deepEqual(rows[0].args, [
    '/opt/FDE-X.app/Contents/Resources/resources/app/runtime/mcp-stdio-bridge.mjs',
    '--',
    'npx',
    '-y',
    '@playwright/mcp',
    '--headless',
  ])
  const unwrapped = unwrapStdioBridgeEntry(rows[0])
  assert.equal(unwrapped.command, 'npx')
  assert.deepEqual(unwrapped.args, ['-y', '@playwright/mcp', '--headless'])
})

test('ensureLocalMcpInProfile unwraps Host-folded bridge spawn and keeps sibling plugins', async () => {
  const { mkdtemp, mkdir, readFile, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const home = await mkdtemp(join(tmpdir(), 'fde-mcp-fold-'))
  const file = join(home, 'profiles', 'fde-x', 'cordis.patch.yml')
  await mkdir(join(home, 'profiles', 'fde-x'), { recursive: true })
  const folded = [
    '- id: llm-pi-ai',
    '  name: x',
    '  config:',
    '    providers:',
    '      grok2api:',
    '        api: openai-completions',
    '- insert:',
    '    - id: mcp-playwright',
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '      config:',
    '        transport: stdio',
    '        serverName: playwright',
    '        command: "/opt/FDE-X.app/Contents/Resources/resources/node/b\\',
    '          in/node"',
    '        args:',
    '          [',
    '            "/opt/FDE-X.app/Contents/Resources/resources/a\\',
    '              pp/runtime/mcp-stdio-bridge.mjs",',
    '            "--",',
    '            "npx",',
    '            "-y",',
    '            "@playwright/mcp"',
    '          ]',
    '',
  ].join('\n')
  await writeFile(file, folded)
  await ensureLocalMcpInProfile({ dshHome: home, profileName: 'fde-x' })
  const text = await readFile(file, 'utf8')
  const rows = parseMcpPatchEntries(text)
  assert.equal(rows[0].command, 'npx')
  assert.deepEqual(rows[0].args, ['-y', '@playwright/mcp'])
  assert.match(text, /id: llm-pi-ai/)
  assert.match(text, /openai-completions/)
  assert.equal(text.includes('mcp-stdio-bridge'), false)
})

test('upsertMcpPatchEntry unwraps a leftover stdio bridge spawn', () => {
  const archived = upsertMcpPatchEntry('', {
    serverName: 'playwright',
    transport: 'stdio',
    command: '/usr/bin/node',
    args: ['/tmp/mcp-stdio-bridge.mjs', '--', 'npx', '-y', '@playwright/mcp', '--headless'],
  })
  const row = parseMcpPatchEntries(archived)[0]
  assert.equal(row.command, 'npx')
  assert.deepEqual(row.args, ['-y', '@playwright/mcp', '--headless'])
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
  assert.equal(mcpFingerprintMatches({ ...alpha, cwd: '/tmp/ws' }, snapshot), false)
  assert.equal(mcpFingerprintMatches({ serverName: 'beta', transport: 'stdio', command: 'npx' }, snapshot), false)
  assert.equal(mcpFingerprintMatches(alpha, null), false)
  assert.equal(mcpFingerprintMatches(alpha, undefined), false)
  assert.equal(mcpEntryFingerprint(alpha), mcpEntryFingerprint({ ...alpha, disabled: true }))
})

test('resolveStdioCwd prefers an absolute occupancy cwd', () => {
  assert.equal(resolveStdioCwd('/tmp/from-entry', { cwd: '/tmp/ws', dshHome: '/tmp/home' }), '/tmp/from-entry')
  assert.equal(resolveStdioCwd('', { cwd: '/tmp/ws', dshHome: '/tmp/home' }), '/tmp/ws')
  assert.equal(resolveStdioCwd('relative', { cwd: '/tmp/ws', dshHome: '/tmp/home' }), '/tmp/ws')
  assert.equal(resolveStdioCwd('', { dshHome: '/tmp/home' }), '/tmp/home')
})

test('upsertMcpPatchEntry keeps cwd unless the entry sets it', () => {
  const archived = upsertMcpPatchEntry('', {
    serverName: 'alpha',
    transport: 'stdio',
    command: 'npx',
    args: ['-y'],
    cwd: '/tmp/ws',
  })
  const edited = upsertMcpPatchEntry(archived, {
    serverName: 'alpha',
    transport: 'stdio',
    command: '/usr/bin/true',
    args: [],
  })
  assert.equal(parseMcpPatchEntries(edited)[0].cwd, '/tmp/ws')
  const moved = upsertMcpPatchEntry(edited, {
    serverName: 'alpha',
    transport: 'stdio',
    command: '/usr/bin/true',
    cwd: '/tmp/other',
  })
  assert.equal(parseMcpPatchEntries(moved)[0].cwd, '/tmp/other')
})

test('MCP boot hold uses the home layer and restores it', async () => {
  const { mkdir, readFile, writeFile, access } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { mkdtemp } = await import('node:fs/promises')
  const home = await mkdtemp(join(tmpdir(), 'fde-mcp-hold-'))
  const profile = join(home, 'profiles', 'fde-x')
  await mkdir(profile, { recursive: true })
  await writeFile(join(profile, 'cordis.patch.yml'), buildMcpPatchBlock({
    serverName: 'alpha',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'pkg'],
    cwd: '/tmp/ws',
  }))
  const homePatch = join(home, 'cordis.patch.yml')
  await writeFile(homePatch, '- id: keep-me\n  name: x\n')
  const runtime = { dshHome: home, profileName: 'fde-x', runDirectory: join(home, 'run') }
  assert.equal(homeCordisPatchPath(runtime), homePatch)
  const hold = buildMcpBootHoldPatch(parseMcpPatchEntries(await readFile(join(profile, 'cordis.patch.yml'), 'utf8')))
  assert.match(hold, /id: mcp-alpha/)
  assert.match(hold, /disabled: true/)
  const applied = await applyMcpBootHold(runtime)
  assert.equal(applied.applied, true)
  const held = await readFile(homePatch, 'utf8')
  assert.match(held, /id: keep-me/)
  assert.match(held, /id: mcp-alpha/)
  assert.match(held, /disabled: true/)
  const profileText = await readFile(join(profile, 'cordis.patch.yml'), 'utf8')
  assert.equal(parseMcpPatchEntries(profileText)[0].disabled, false)
  const again = await applyMcpBootHold(runtime)
  assert.equal(again.applied, true)
  const released = await releaseMcpBootHold(runtime)
  assert.equal(released.released, true)
  const restored = await readFile(homePatch, 'utf8')
  assert.match(restored, /id: keep-me/)
  assert.equal(restored.includes('mcp-alpha'), false)
  const noop = await releaseMcpBootHold(runtime)
  assert.equal(noop.released, false)
  await access(join(profile, 'cordis.patch.yml'))
})

test('mcpArchivePaths uses the profile archive when present', () => {
  const profile = mcpArchivePaths({ dshHome: '/tmp/dsh-home', profileName: 'fde-x', patchFile: '/tmp/occupancy.patch.yml' })
  assert.deepEqual(profile, ['/tmp/dsh-home/profiles/fde-x/cordis.patch.yml'])
  assert.deepEqual(mcpArchivePaths({ patchFile: '/tmp/occupancy.patch.yml' }), ['/tmp/occupancy.patch.yml'])
})

function topLevelBlocks(text) {
  return String(text).split(/\n(?=- )/u).map((part) => part.trim()).filter(Boolean)
}

function blockForId(text, id) {
  return topLevelBlocks(text).find((part) => new RegExp(`^- id: ${id}\\b`, 'm').test(part)) || ''
}

function blockStarting(text, prefix) {
  return topLevelBlocks(text).find((part) => part.startsWith(prefix)) || ''
}

test('ensureSkillProvidersInProfile disables host tool-skill and keeps the filesystem provider', async () => {
  const { mkdtemp, mkdir, readFile, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const home = await mkdtemp(join(tmpdir(), 'fde-skill-providers-'))
  const file = join(home, 'profiles', 'fde-x', 'cordis.patch.yml')
  await mkdir(join(home, 'profiles', 'fde-x'), { recursive: true })
  const prior = [
    '- id: other-plugin',
    '  name: "@example/keep-me"',
    '  disabled: false',
    '- id: tool-skill',
    '  name: "@deepseek-ai/dsh-tool-skill"',
    '  disabled: false',
    '  config:',
    '    catalogDescriptionMaxLength: 500',
    '- insert:',
    '    - id: mcp-user-notes',
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '      config:',
    '        transport: stdio',
    '        serverName: user-notes',
    '        command: node',
    '        args: ["notes.mjs"]',
    '',
  ].join('\n')
  await writeFile(file, prior)
  const runtime = { dshHome: home, profileName: 'fde-x' }
  try {
    await ensureSkillProvidersInProfile(runtime)
    const text = await readFile(file, 'utf8')
    const toolSkill = blockForId(text, 'tool-skill')
    const filesystem = blockForId(text, 'skill-filesystem')
    const other = blockForId(text, 'other-plugin')
    assert.match(toolSkill, /disabled: true/)
    assert.match(toolSkill, /catalogDescriptionMaxLength: 500/)
    assert.match(filesystem, /disabled: false/)
    assert.match(other, /@example\/keep-me/)
    assert.equal(other, blockForId(prior, 'other-plugin'))
    assert.equal(blockStarting(text, '- insert:'), blockStarting(prior, '- insert:'))
    assert.equal(topLevelBlocks(text).filter((part) => /^- id: tool-skill\b/m.test(part)).length, 1)
    await ensureSkillProvidersInProfile(runtime)
    assert.equal(await readFile(file, 'utf8'), text)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

async function writtenSkillProfile(prior) {
  const { mkdtemp, mkdir, readFile, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const home = await mkdtemp(join(tmpdir(), 'fde-skill-id-shape-'))
  const file = join(home, 'profiles', 'fde-x', 'cordis.patch.yml')
  await mkdir(join(home, 'profiles', 'fde-x'), { recursive: true })
  await writeFile(file, prior)
  const runtime = { dshHome: home, profileName: 'fde-x' }
  try {
    await ensureSkillProvidersInProfile(runtime)
    const text = await readFile(file, 'utf8')
    await ensureSkillProvidersInProfile(runtime)
    const again = await readFile(file, 'utf8')
    return { text, again }
  } finally {
    await rm(home, { recursive: true, force: true })
  }
}

test('ensureSkillProvidersInProfile does not append a second row when the id line has a comment', async () => {
  const prior = [
    '- id: other-plugin',
    '  name: "@example/keep-me"',
    '  disabled: false',
    '- id: tool-skill # 用户原来的行',
    '  name: "@deepseek-ai/dsh-tool-skill"',
    '  disabled: false',
    '- id: skill-filesystem',
    '  name: "@deepseek-ai/dsh-skill-filesystem"',
    '  disabled: false',
    '',
  ].join('\n')
  const expected = prior.replace(
    '- id: tool-skill # 用户原来的行\n  name: "@deepseek-ai/dsh-tool-skill"\n  disabled: false\n',
    '- id: tool-skill # 用户原来的行\n  name: "@deepseek-ai/dsh-tool-skill"\n  disabled: true\n',
  )
  const { text, again } = await writtenSkillProfile(prior)
  assert.equal(text, expected)
  assert.equal(again, text)
})

test('ensureSkillProvidersInProfile does not append a second row when name is written before id', async () => {
  const prior = [
    '- id: other-plugin',
    '  name: "@example/keep-me"',
    '  disabled: false',
    '- name: "@deepseek-ai/dsh-tool-skill"',
    '  id: tool-skill',
    '  disabled: false',
    '- id: skill-filesystem',
    '  name: "@deepseek-ai/dsh-skill-filesystem"',
    '  disabled: false',
    '',
  ].join('\n')
  const expected = prior.replace(
    '- name: "@deepseek-ai/dsh-tool-skill"\n  id: tool-skill\n  disabled: false\n',
    '- name: "@deepseek-ai/dsh-tool-skill"\n  id: tool-skill\n  disabled: true\n',
  )
  const { text, again } = await writtenSkillProfile(prior)
  assert.equal(text, expected)
  assert.equal(again, text)
})

