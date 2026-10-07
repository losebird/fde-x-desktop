/**
 * FDE Host profile archive for MCP client rows and skill filesystem providers.
 * User MCP/skills live in ~/.dsh-fde-x/profiles/<profile>/cordis.patch.yml.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { access, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'

const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/u
const SKILL_PROVIDER_ROWS = [
  { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' },
  { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
]

export function profileCordisPatchPath(aiRuntime) {
  const home = aiRuntime?.dshHome || process.env.FDE_DSH_HOME
  const profile = aiRuntime?.profileName || process.env.FDE_DSH_PROFILE || 'fde-x'
  if (!home) return ''
  return join(home, 'profiles', profile, 'cordis.patch.yml')
}

export function mcpArchivePaths(aiRuntime) {
  const profile = profileCordisPatchPath(aiRuntime)
  if (profile) return [profile]
  const occupancy = aiRuntime?.patchFile
  return occupancy ? [occupancy] : []
}

export async function readMcpArchiveText(aiRuntime) {
  const chunks = []
  for (const file of mcpArchivePaths(aiRuntime)) {
    try {
      chunks.push(await readFile(file, 'utf8'))
    } catch {
      /* missing archive layer */
    }
  }
  return normalizeCordisPatchText(chunks.join('\n'))
}

export function sanitizeMcpServerName(name) {
  const raw = String(name || '').replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+|-+$/g, '')
  return raw.slice(0, 32)
}

export function mcpServersFromRecord(mcpServers) {
  if (!mcpServers || typeof mcpServers !== 'object' || Array.isArray(mcpServers)) return []
  const rows = []
  for (const [rawName, cfg] of Object.entries(mcpServers)) {
    if (!cfg || typeof cfg !== 'object') continue
    const serverName = sanitizeMcpServerName(rawName)
    if (!SERVER_NAME_RE.test(serverName)) continue
    const type = String(cfg.type || cfg.transport || '')
    const url = typeof cfg.url === 'string' ? cfg.url.trim() : ''
    const command = typeof cfg.command === 'string' ? cfg.command.trim() : ''
    const args = Array.isArray(cfg.args) ? cfg.args.map(String) : []
    const env = cfg.env && typeof cfg.env === 'object' && !Array.isArray(cfg.env) ? cfg.env : undefined
    const headers = cfg.headers && typeof cfg.headers === 'object' && !Array.isArray(cfg.headers) ? cfg.headers : undefined
    if (url && (type === 'http' || type === 'streamable-http' || type === 'sse' || !command)) {
      rows.push({ serverName, transport: 'streamable-http', url, headers })
      continue
    }
    if (command) {
      rows.push({ serverName, transport: 'stdio', command, args, env })
    }
  }
  return rows
}

export function discoverLocalMcpServersFromFiles(files) {
  const rows = []
  const seen = new Set()
  for (const text of files) {
    if (typeof text !== 'string' || !text.trim()) continue
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      continue
    }
    const map = parsed && typeof parsed === 'object' ? (parsed.mcpServers || parsed.mcp || parsed) : null
    for (const row of mcpServersFromRecord(map)) {
      if (seen.has(row.serverName)) continue
      seen.add(row.serverName)
      rows.push(row)
    }
  }
  return rows
}

export async function discoverLocalMcpServers() {
  const home = homedir()
  const texts = []
  for (const file of [join(home, '.claude.json'), join(home, '.cursor', 'mcp.json')]) {
    try {
      texts.push(await readFile(file, 'utf8'))
    } catch {
      /* optional source */
    }
  }
  return discoverLocalMcpServersFromFiles(texts)
}

function yamlScalar(value) {
  return JSON.stringify(String(value))
}

function isPatchBoundary(line) {
  return line.startsWith('- id:') || line === '- insert:' || line.startsWith('- insert:')
}

export function splitPatchBlocks(text) {
  const blocks = []
  let current = []
  for (const line of String(text || '').split('\n')) {
    if (isPatchBoundary(line) && current.length) {
      blocks.push(current.join('\n'))
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length) blocks.push(current.join('\n'))
  return blocks
}

/** One YAML sequence. Empty occupancy is an empty file. Drop JSON `[]` documents. */
export function normalizeCordisPatchText(text) {
  const blocks = splitPatchBlocks(text)
    .map((block) => String(block || '').replace(/\s+$/u, ''))
    .filter((block) => {
      const trimmed = block.trim()
      return trimmed && trimmed !== '[]'
    })
  if (!blocks.length) return ''
  return `${blocks.join('\n').replace(/\n+$/u, '')}\n`
}

export async function writeNormalizedPatch(file, text) {
  await writeFile(file, normalizeCordisPatchText(text))
}

function nestedPluginItems(block) {
  const lines = String(block || '').split('\n')
  const first = (lines[0] || '').trim()
  if (first !== '- insert:' && !first.startsWith('- insert:')) return [block]
  const items = []
  let current = []
  for (const line of lines.slice(1)) {
    if (/^    - id:/.test(line) && current.length) {
      items.push(current.join('\n'))
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length) items.push(current.join('\n'))
  return items
}

function parseYamlArgs(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw.trim().replace(/'/g, '"'))
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function unquoteYamlScalar(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  if (text.startsWith('"')) {
    try { return JSON.parse(text) } catch { /* fall through */ }
  }
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1)
  }
  return text
}

function parseIndentedMap(item, field) {
  const lines = String(item || '').split('\n')
  const start = lines.findIndex((line) => new RegExp(`^\\s+${field}:\\s*$`, 'u').test(line))
  if (start < 0) return undefined
  const base = (lines[start].match(/^(\s*)/) || ['', ''])[1].length
  const map = {}
  let key = ''
  let raw = ''
  const flush = () => {
    if (!key) return
    map[key] = unquoteYamlScalar(String(raw).replace(/\\\n\s*/g, ''))
    key = ''
    raw = ''
  }
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.trim()) continue
    const indent = (line.match(/^(\s*)/) || ['', ''])[1].length
    if (indent <= base) break
    const pair = line.match(/^(\s+)([A-Za-z0-9_.-]+):\s*(.*)$/u)
    if (pair && pair[1].length === base + 2) {
      flush()
      key = pair[2]
      raw = pair[3]
      continue
    }
    if (key) raw = `${raw}\n${line.trim()}`
  }
  flush()
  return Object.keys(map).length ? map : undefined
}

function parseMcpClientItem(item) {
  if (!item.includes('serverName:')) return null
  if (!(/dsh-mcp-client/.test(item) || /id:\s*mcp-/.test(item))) return null
  const serverName = item.match(/serverName:\s*([A-Za-z0-9_-]+)/u)?.[1]
  if (!serverName) return null
  const pluginId = item.match(/- id:\s*(\S+)/u)?.[1] || `mcp-${serverName}`
  const transportRaw = item.match(/transport:\s*(\S+)/u)?.[1] || 'stdio'
  const transport = transportRaw === 'streamable-http' ? 'streamable-http' : 'stdio'
  const commandMatch = item.match(/command:\s*(.+)$/mu)?.[1]
  const urlMatch = item.match(/url:\s*(.+)$/mu)?.[1]
  let command = ''
  if (commandMatch) {
    try { command = JSON.parse(commandMatch.trim()) } catch { command = commandMatch.trim().replace(/^['"]|['"]$/g, '') }
  }
  const url = urlMatch ? unquoteYamlScalar(urlMatch) : ''
  const args = parseYamlArgs(item.match(/args:\s*(\[[^\]]*\])/u)?.[1])
  const disabled = /^\s+disabled:\s*true\b/mu.test(item)
  const headers = parseIndentedMap(item, 'headers')
  const env = parseIndentedMap(item, 'env')
  return { pluginId, serverName, transport, command, args, url, headers, env, disabled }
}

export function parseMcpPatchEntries(text) {
  const entries = []
  const seen = new Set()
  for (const block of splitPatchBlocks(text)) {
    for (const item of nestedPluginItems(block)) {
      const row = parseMcpClientItem(item)
      if (!row || seen.has(row.serverName)) continue
      seen.add(row.serverName)
      entries.push(row)
    }
  }
  return entries
}

export function buildMcpPatchBlock(entry) {
  const serverName = sanitizeMcpServerName(entry.serverName)
  const head = [
    '- insert:',
    `    - id: mcp-${serverName}`,
    `      name: '@deepseek-ai/dsh-mcp-client'`,
    '      config:',
  ]
  if (entry.transport === 'streamable-http') {
    const headerLines = entry.headers && Object.keys(entry.headers).length ? ['        headers:'] : []
    if (entry.headers) {
      for (const [key, value] of Object.entries(entry.headers)) {
        headerLines.push(`          ${key}: ${yamlScalar(value)}`)
      }
    }
    return [
      ...head,
      '        transport: streamable-http',
      `        serverName: ${serverName}`,
      `        url: ${yamlScalar(entry.url)}`,
      ...headerLines,
      '',
    ].join('\n')
  }
  const args = Array.isArray(entry.args) ? entry.args : []
  const envLines = entry.env && Object.keys(entry.env).length ? ['        env:'] : []
  if (entry.env) {
    for (const [key, value] of Object.entries(entry.env)) {
      envLines.push(`          ${key}: ${yamlScalar(value)}`)
    }
  }
  return [
    ...head,
    '        transport: stdio',
    `        serverName: ${serverName}`,
    `        command: ${yamlScalar(entry.command)}`,
    `        args: ${JSON.stringify(args)}`,
    ...envLines,
    '',
  ].join('\n')
}

export function rewriteMcpArchiveInserts(text) {
  let changed = false
  const next = splitPatchBlocks(normalizeCordisPatchText(text)).map((block) => {
    const first = (block.split('\n')[0] || '').trim()
    if (first === '- insert:' || first.startsWith('- insert:')) return block
    if (!first.startsWith('- id: mcp-') || !(/dsh-mcp-client/.test(block) || first.startsWith('- id: mcp-'))) return block
    if (!block.includes('serverName:')) return block
    changed = true
    const indented = block.split('\n').map((line) => (line.length ? `    ${line}` : line)).join('\n')
    return `- insert:\n${indented}`
  })
  const textOut = normalizeCordisPatchText(next.join('\n'))
  return { text: textOut, changed: changed || textOut !== normalizeCordisPatchText(text) }
}

function stableMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [String(key), String(item)])
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

export function mcpEntryFingerprint(entry) {
  const transport = entry && entry.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
  if (transport === 'streamable-http') {
    return JSON.stringify({
      transport,
      url: String((entry && entry.url) || ''),
      headers: stableMap(entry && entry.headers),
    })
  }
  return JSON.stringify({
    transport,
    command: String((entry && entry.command) || ''),
    args: (Array.isArray(entry && entry.args) ? entry.args : []).map(String),
    env: stableMap(entry && entry.env),
  })
}

export function mcpArchiveSnapshot(entries) {
  const out = {}
  for (const row of Array.isArray(entries) ? entries : []) {
    const name = String((row && row.serverName) || '')
    if (!name) continue
    out[name] = mcpEntryFingerprint(row)
  }
  return out
}

export function mcpFingerprintMatches(entry, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return true
  const name = String((entry && entry.serverName) || '')
  if (!name) return true
  if (!Object.prototype.hasOwnProperty.call(snapshot, name)) return false
  return snapshot[name] === mcpEntryFingerprint(entry)
}

export function upsertMcpPatchEntry(text, entry) {
  const serverName = sanitizeMcpServerName(entry && entry.serverName)
  if (!SERVER_NAME_RE.test(serverName)) return normalizeCordisPatchText(text)
  const current = parseMcpPatchEntries(text).find((row) => row.serverName === serverName)
  const disabled = entry && Object.prototype.hasOwnProperty.call(entry, 'disabled')
    ? Boolean(entry.disabled)
    : Boolean(current && current.disabled)
  const without = removeMcpPatchEntry(text, serverName)
  let block = buildMcpPatchBlock({ ...entry, serverName })
  if (disabled) block = upsertMcpDisabled(block, serverName, true)
  const prefix = without.replace(/\s+$/u, '')
  return normalizeCordisPatchText(prefix ? `${prefix}\n${block}` : block)
}

export function removeMcpPatchEntry(text, serverName) {
  const pluginId = `mcp-${sanitizeMcpServerName(serverName)}`
  const next = splitPatchBlocks(normalizeCordisPatchText(text)).filter((block) => {
    const ids = [...block.matchAll(/id:\s*(mcp-[A-Za-z0-9_-]+)/gu)].map((row) => row[1])
    return !ids.includes(pluginId) || !(/dsh-mcp-client/.test(block) || block.includes('serverName:'))
  })
  return normalizeCordisPatchText(next.join('\n'))
}

export function upsertMcpDisabled(text, serverName, disabled) {
  const pluginId = `mcp-${sanitizeMcpServerName(serverName)}`
  const line = `      disabled: ${disabled ? 'true' : 'false'}`
  let found = false
  const next = splitPatchBlocks(normalizeCordisPatchText(text)).map((block) => {
    if (!block.includes(`id: ${pluginId}`)) return block
    if (!(/dsh-mcp-client/.test(block) || block.includes('serverName:'))) return block
    found = true
    const kept = block.split('\n').filter((row) => !/^\s+disabled:\s*/.test(row))
    const idIndex = kept.findIndex((row) => row.includes(`id: ${pluginId}`))
    if (idIndex < 0) return `${kept.join('\n')}\n${line}`
    kept.splice(idIndex + 1, 0, line)
    return kept.join('\n')
  })
  return found ? normalizeCordisPatchText(next.join('\n')) : normalizeCordisPatchText(text)
}

export function upsertPatchDisabled(text, id, disabled, name) {
  const prefix = `- id: ${id}`
  const line = `  disabled: ${disabled ? 'true' : 'false'}`
  let found = false
  const next = splitPatchBlocks(normalizeCordisPatchText(text)).map((block) => {
    const first = block.split('\n')[0].trim()
    if (first !== prefix && !first.startsWith(`${prefix} `)) return block
    found = true
    const kept = block.split('\n').filter((row) => !/^\s+disabled:\s*/.test(row))
    return `${kept.join('\n').replace(/\s+$/, '')}\n${line}`
  })
  if (!found) {
    const named = name ? `\n  name: ${JSON.stringify(name)}` : ''
    next.push(`${prefix}${named}\n${line}`)
  }
  return normalizeCordisPatchText(next.join('\n'))
}

export async function ensureSkillProvidersInProfile(aiRuntime) {
  const file = profileCordisPatchPath(aiRuntime)
  if (!file) return
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch {
    text = ''
  }
  let next = text
  for (const row of SKILL_PROVIDER_ROWS) next = upsertPatchDisabled(next, row.id, false, row.name)
  if (next !== text) await writeNormalizedPatch(file, next)
  const home = aiRuntime?.dshHome || process.env.FDE_DSH_HOME
  if (!home) return
  const dest = join(home, 'skills')
  try {
    await access(dest)
  } catch {
    const agents = join(homedir(), '.agents', 'skills')
    try {
      await access(agents)
      await symlink(agents, dest)
    } catch {
      await mkdir(dest, { recursive: true })
    }
  }
}

export async function ensureLocalMcpInProfile(aiRuntime) {
  const file = profileCordisPatchPath(aiRuntime)
  if (!file) return []
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch {
    text = ''
  }
  const rewritten = rewriteMcpArchiveInserts(text)
  let next = rewritten.text.trimEnd()
  const existing = new Set(parseMcpPatchEntries(next).map((row) => row.serverName))
  const discovered = await discoverLocalMcpServers()
  const added = []
  for (const row of discovered) {
    if (existing.has(row.serverName)) continue
    next = `${next}${next ? '\n' : ''}${buildMcpPatchBlock(row)}`
    existing.add(row.serverName)
    added.push(row.serverName)
  }
  if (added.length || rewritten.changed) await writeNormalizedPatch(file, next)
  return added
}
