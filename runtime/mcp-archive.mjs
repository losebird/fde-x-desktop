/**
 * FDE Host profile archive for MCP client rows and skill filesystem providers.
 * User MCP/skills live in $DSH_HOME/profiles/<profile>/cordis.patch.yml.
 * Boot hold lives in $DSH_HOME/cordis.patch.yml (home layer, HMR re-reads it).
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { access, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { FDE_RESOURCES } from './config.mjs'
import { generationInstallRoot } from './generation.mjs'

const require = createRequire(import.meta.url)
const yaml = loadYamlLib()
const { parseDocument, isMap, isSeq, YAMLMap, YAMLSeq, Document } = yaml

const YAML_PARSE = {
  customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value) => value }],
}

function loadYamlLib() {
  const dirs = [
    join(generationInstallRoot(), 'node_modules', 'yaml'),
    join(FDE_RESOURCES, 'dsh', 'node_modules', 'yaml'),
  ]
  for (const dir of dirs) {
    if (existsSync(join(dir, 'package.json'))) return require(dir)
  }
  throw new Error('Host yaml library is missing')
}

const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/u
const SKILL_PROVIDER_ROWS = [
  { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem', disabled: false },
  { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill', disabled: true },
]

export function profileCordisPatchPath(aiRuntime) {
  const home = aiRuntime?.dshHome || process.env.FDE_DSH_HOME
  const profile = aiRuntime?.profileName || process.env.FDE_DSH_PROFILE || 'fde-x'
  if (!home) return ''
  return join(home, 'profiles', profile, 'cordis.patch.yml')
}

export function homeCordisPatchPath(aiRuntime) {
  const home = aiRuntime?.dshHome || process.env.FDE_DSH_HOME
  return home ? join(home, 'cordis.patch.yml') : ''
}

export function mcpBootHoldSidecarPath(aiRuntime) {
  if (aiRuntime?.runDirectory) return join(aiRuntime.runDirectory, 'mcp-boot-hold.json')
  const home = aiRuntime?.dshHome || process.env.FDE_DSH_HOME
  return home ? join(home, 'run', 'mcp-boot-hold.json') : ''
}

function isAbsolutePath(value) {
  const text = String(value || '').trim()
  return text.startsWith('/') || /^[A-Za-z]:[\\/]/.test(text)
}

export function resolveStdioCwd(cwd, aiRuntime) {
  if (isAbsolutePath(cwd)) return String(cwd).trim()
  if (isAbsolutePath(aiRuntime?.cwd)) return String(aiRuntime.cwd).trim()
  if (isAbsolutePath(process.env.FDE_AI_WORKSPACE)) return String(process.env.FDE_AI_WORKSPACE).trim()
  if (isAbsolutePath(aiRuntime?.dshHome)) return String(aiRuntime.dshHome).trim()
  if (isAbsolutePath(process.env.FDE_DSH_HOME)) return String(process.env.FDE_DSH_HOME).trim()
  return ''
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
      const cwd = typeof cfg.cwd === 'string' ? cfg.cwd.trim() : ''
      rows.push({ serverName, transport: 'stdio', command, args, env, ...(cwd ? { cwd } : {}) })
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

export function decorateDiscoveredMcpRows(discovered, archiveNames) {
  const existing = archiveNames instanceof Set ? archiveNames : new Set(archiveNames || [])
  return (Array.isArray(discovered) ? discovered : []).map((row) => ({
    serverName: row.serverName,
    transport: row.transport,
    command: row.command,
    args: Array.isArray(row.args) ? row.args : [],
    env: row.env,
    url: row.url,
    headers: row.headers,
    cwd: row.cwd,
    present: existing.has(row.serverName),
  }))
}

function isPatchBoundary(line) {
  return line.startsWith('- ')
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

function emptySeqDocument() {
  const document = new Document()
  document.contents = new YAMLSeq()
  return document
}

function loadPatchDocument(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed || trimmed === '[]') return emptySeqDocument()
  const document = parseDocument(String(text), YAML_PARSE)
  if (!isSeq(document.contents)) {
    if (document.errors[0]) throw document.errors[0]
    document.contents = new YAMLSeq()
  }
  return document
}

function serializePatch(document) {
  if (!isSeq(document.contents) || document.contents.items.length === 0) return ''
  const text = String(document)
  return text.endsWith('\n') ? text : `${text}\n`
}

function stringMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (item == null) continue
    out[String(key)] = String(item)
  }
  return Object.keys(out).length ? out : undefined
}

function mcpRowFromMap(map) {
  if (!isMap(map)) return null
  const json = map.toJSON()
  if (!json || typeof json !== 'object') return null
  const config = json.config
  if (!config || typeof config !== 'object') return null
  const serverName = sanitizeMcpServerName(config.serverName)
  if (!SERVER_NAME_RE.test(serverName)) return null
  const pluginId = String(json.id || `mcp-${serverName}`)
  const name = String(json.name || '')
  if (name && name !== '@deepseek-ai/dsh-mcp-client' && !pluginId.startsWith('mcp-')) return null
  if (!name && !pluginId.startsWith('mcp-')) return null
  const transport = String(config.transport || '') === 'streamable-http' ? 'streamable-http' : 'stdio'
  const args = Array.isArray(config.args) ? config.args.map(String) : []
  const env = stringMap(config.env)
  const headers = stringMap(config.headers)
  const cwd = typeof config.cwd === 'string' ? config.cwd : ''
  return {
    pluginId,
    serverName,
    transport,
    command: config.command == null ? '' : String(config.command),
    args,
    url: config.url == null ? '' : String(config.url),
    headers,
    env,
    cwd,
    disabled: json.disabled === true,
  }
}

function eachTopMaps(document) {
  if (!isSeq(document.contents)) return []
  return document.contents.items.filter((item) => isMap(item))
}

export function parseMcpPatchEntries(text) {
  let document
  try {
    document = loadPatchDocument(text)
  } catch {
    return []
  }
  const byName = new Map()
  const order = []
  const remember = (row) => {
    if (!row || byName.has(row.serverName)) return
    byName.set(row.serverName, row)
    order.push(row.serverName)
  }
  for (const item of eachTopMaps(document)) {
    if (item.has('insert')) {
      const insert = item.get('insert', true)
      if (!isSeq(insert)) continue
      for (const child of insert.items) remember(mcpRowFromMap(child))
      continue
    }
    if (item.has('config')) {
      remember(mcpRowFromMap(item))
      continue
    }
    const id = String(item.get('id') || '')
    if (!id.startsWith('mcp-') || !item.has('disabled')) continue
    const serverName = sanitizeMcpServerName(id.slice(4))
    const row = byName.get(serverName)
    if (row) row.disabled = item.get('disabled') === true
  }
  return order.map((name) => byName.get(name))
}

function preparedMcpEntry(entry) {
  const serverName = sanitizeMcpServerName(entry && entry.serverName)
  const transport = entry && entry.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
  const cwd = transport === 'stdio' ? resolveStdioCwd(entry && entry.cwd) : ''
  const unwrapped = unwrapStdioBridgeEntry({ ...entry, serverName, transport, cwd }) || { ...entry, serverName, transport, cwd }
  return {
    pluginId: unwrapped.pluginId || `mcp-${serverName}`,
    serverName,
    transport,
    command: String(unwrapped.command || ''),
    args: Array.isArray(unwrapped.args) ? unwrapped.args.map(String) : [],
    url: String(unwrapped.url || ''),
    headers: stringMap(unwrapped.headers),
    env: stringMap(unwrapped.env),
    cwd,
    disabled: Boolean(unwrapped.disabled),
  }
}

function writeConfigMap(config, entry) {
  config.set('transport', entry.transport)
  config.set('serverName', entry.serverName)
  if (entry.transport === 'streamable-http') {
    config.set('url', entry.url)
    config.delete('command')
    config.delete('args')
    config.delete('cwd')
    config.delete('env')
    if (entry.headers) config.set('headers', entry.headers)
    else config.delete('headers')
    return
  }
  config.set('command', entry.command)
  config.set('args', entry.args)
  config.delete('url')
  config.delete('headers')
  if (entry.cwd) config.set('cwd', entry.cwd)
  else config.delete('cwd')
  if (entry.env) config.set('env', entry.env)
  else config.delete('env')
}

function findMcpClientMap(document, serverName) {
  const pluginId = `mcp-${serverName}`
  for (const item of eachTopMaps(document)) {
    if (item.has('insert')) {
      const insert = item.get('insert', true)
      if (!isSeq(insert)) continue
      for (const child of insert.items) {
        if (!isMap(child)) continue
        const row = mcpRowFromMap(child)
        if (row && row.serverName === serverName) return child
        if (String(child.get('id') || '') === pluginId && isMap(child.get('config', true))) return child
      }
      continue
    }
    const row = mcpRowFromMap(item)
    if (row && row.serverName === serverName) return item
  }
  return null
}

function applyMcpEntry(document, entry) {
  if (!isSeq(document.contents)) document.contents = new YAMLSeq()
  let map = findMcpClientMap(document, entry.serverName)
  if (!map) {
    map = new YAMLMap()
    map.set('id', entry.pluginId)
    map.set('name', '@deepseek-ai/dsh-mcp-client')
    map.set('config', new YAMLMap())
    const wrapper = new YAMLMap()
    const insertSeq = new YAMLSeq()
    insertSeq.add(map)
    wrapper.set('insert', insertSeq)
    document.contents.add(wrapper)
  }
  map.set('id', entry.pluginId)
  map.set('name', '@deepseek-ai/dsh-mcp-client')
  if (entry.disabled) map.set('disabled', true)
  else map.delete('disabled')
  let config = map.get('config', true)
  if (!isMap(config)) {
    config = new YAMLMap()
    map.set('config', config)
  }
  writeConfigMap(config, entry)
}

export function buildMcpPatchBlock(entry) {
  const document = loadPatchDocument('')
  applyMcpEntry(document, preparedMcpEntry(entry))
  return serializePatch(document)
}

export function unwrapStdioBridgeEntry(entry) {
  if (!entry || entry.transport === 'streamable-http') return null
  const args = Array.isArray(entry.args) ? entry.args.map(String) : []
  const hasBridge = args.some((item) => /(^|[\\/])mcp-stdio-bridge\.mjs$/u.test(item))
  if (!hasBridge) return null
  const dash = args.indexOf('--')
  const inner = dash >= 0 ? args.slice(dash + 1) : []
  if (!inner[0]) return null
  return { ...entry, command: inner[0], args: inner.slice(1) }
}

function wrapBareMcpInserts(document) {
  if (!isSeq(document.contents)) return false
  let changed = false
  const items = document.contents.items
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (!isMap(item) || item.has('insert')) continue
    if (!mcpRowFromMap(item)) continue
    const wrapper = new YAMLMap()
    const insertSeq = new YAMLSeq()
    insertSeq.add(item)
    wrapper.set('insert', insertSeq)
    items[i] = wrapper
    changed = true
  }
  return changed
}

function unwrapBridgeInDocument(document) {
  let changed = false
  const visit = (map) => {
    if (!isMap(map)) return
    const row = mcpRowFromMap(map)
    const unwrapped = unwrapStdioBridgeEntry(row)
    if (!unwrapped) return
    let config = map.get('config', true)
    if (!isMap(config)) return
    config.set('command', unwrapped.command)
    config.set('args', unwrapped.args)
    changed = true
  }
  for (const item of eachTopMaps(document)) {
    if (item.has('insert')) {
      const insert = item.get('insert', true)
      if (!isSeq(insert)) continue
      for (const child of insert.items) visit(child)
      continue
    }
    visit(item)
  }
  return changed
}

export function rewriteMcpArchiveInserts(text) {
  const document = loadPatchDocument(text)
  const changed = wrapBareMcpInserts(document)
  if (!changed) return { text: normalizeCordisPatchText(text), changed: false }
  return { text: serializePatch(document), changed: true }
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
    cwd: String((entry && entry.cwd) || ''),
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
  if (!snapshot || typeof snapshot !== 'object') return false
  const name = String((entry && entry.serverName) || '')
  if (!name) return false
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
  const cwd = entry && Object.prototype.hasOwnProperty.call(entry, 'cwd')
    ? entry.cwd
    : current && current.cwd
  const document = loadPatchDocument(text)
  applyMcpEntry(document, preparedMcpEntry({ ...entry, serverName, disabled, cwd }))
  return serializePatch(document)
}

export function removeMcpPatchEntry(text, serverName) {
  const pluginId = `mcp-${sanitizeMcpServerName(serverName)}`
  const document = loadPatchDocument(text)
  if (!isSeq(document.contents)) return ''
  const items = document.contents.items
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]
    if (!isMap(item)) continue
    if (item.has('insert')) {
      const insert = item.get('insert', true)
      if (!isSeq(insert)) continue
      for (let j = insert.items.length - 1; j >= 0; j -= 1) {
        const child = insert.items[j]
        const row = mcpRowFromMap(child)
        const id = String(isMap(child) ? child.get('id') : '')
        if ((row && row.serverName === sanitizeMcpServerName(serverName)) || id === pluginId) {
          insert.items.splice(j, 1)
        }
      }
      if (!insert.items.length) items.splice(i, 1)
      continue
    }
    const row = mcpRowFromMap(item)
    if (row && row.serverName === sanitizeMcpServerName(serverName)) {
      items.splice(i, 1)
      continue
    }
    if (String(item.get('id') || '') === pluginId && !item.has('config')) items.splice(i, 1)
  }
  return serializePatch(document)
}

export function upsertMcpDisabled(text, serverName, disabled) {
  const pluginId = `mcp-${sanitizeMcpServerName(serverName)}`
  const document = loadPatchDocument(text)
  const map = findMcpClientMap(document, sanitizeMcpServerName(serverName))
  if (!map) return normalizeCordisPatchText(text)
  if (disabled) map.set('disabled', true)
  else map.delete('disabled')
  let overlay = null
  for (const item of eachTopMaps(document)) {
    if (item.has('insert') || item.has('config')) continue
    if (String(item.get('id') || '') === pluginId) overlay = item
  }
  if (overlay) {
    overlay.set('disabled', Boolean(disabled))
  }
  return serializePatch(document)
}

function yamlScalar(raw) {
  let value = String(raw || '').trim()
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0]
    const end = value.indexOf(quote, 1)
    if (end > 0) return value.slice(1, end)
  }
  const commentAt = value.search(/\s#/)
  if (commentAt >= 0) value = value.slice(0, commentAt).trim()
  return value
}

function readTopLevelId(block) {
  for (const line of String(block || '').split('\n')) {
    if (line.startsWith('   ') || line.startsWith('\t')) continue
    let raw = ''
    if (line.startsWith('- id:')) raw = line.slice('- id:'.length)
    else if (line.startsWith('  id:')) raw = line.slice('  id:'.length)
    else continue
    return yamlScalar(raw)
  }
  return ''
}

function topLevelSpans(raw) {
  const starts = []
  let index = 0
  while (index <= raw.length) {
    const end = raw.indexOf('\n', index)
    const lineEnd = end === -1 ? raw.length : end
    const line = raw.slice(index, lineEnd)
    if (isPatchBoundary(line)) starts.push(index)
    if (end === -1) break
    index = end + 1
  }
  return starts.map((start, position) => {
    const end = position + 1 < starts.length ? starts[position + 1] : raw.length
    return { start, end, text: raw.slice(start, end) }
  })
}

function newPatchRow(id, disabled, name) {
  const lines = [`- id: ${id}`]
  if (name) lines.push(`  name: ${JSON.stringify(name)}`)
  lines.push(`  disabled: ${disabled ? 'true' : 'false'}`)
  return `${lines.join('\n')}\n`
}

function editDisabledBlock(block, disabled, name) {
  const value = disabled ? 'true' : 'false'
  const lines = block.split('\n')
  const idIndex = lines.findIndex((line) => line.startsWith('- id:') || line.startsWith('  id:'))
  const hasName = lines.some((line) => line.startsWith('- name:') || line.startsWith('  name:'))
  if (name && !hasName) lines.splice(Math.max(idIndex, 0) + 1, 0, `  name: ${JSON.stringify(name)}`)
  const disabledIndex = lines.findIndex((line) => /^  disabled:/.test(line))
  if (disabledIndex >= 0) {
    lines[disabledIndex] = lines[disabledIndex].replace(/^(\s*disabled:\s*)(?:true|false)\b/, `$1${value}`)
  } else {
    lines.splice(Math.max(idIndex, 0) + 1, 0, `  disabled: ${value}`)
  }
  return lines.join('\n')
}

export function upsertPatchDisabled(text, id, disabled, name) {
  const raw = String(text ?? '')
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '[]') return newPatchRow(id, Boolean(disabled), name)
  const spans = topLevelSpans(raw)
  let target = null
  for (const span of spans) {
    if (readTopLevelId(span.text) !== id) continue
    target = span
  }
  if (!target) {
    const row = newPatchRow(id, Boolean(disabled), name).replace(/\n$/, '')
    const base = raw.endsWith('\n') || raw.length === 0 ? raw : `${raw}\n`
    return `${base}${row}\n`
  }
  const edited = editDisabledBlock(target.text, Boolean(disabled), name)
  if (edited === target.text) return raw
  return `${raw.slice(0, target.start)}${edited}${raw.slice(target.end)}`
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
  for (const row of SKILL_PROVIDER_ROWS) next = upsertPatchDisabled(next, row.id, row.disabled, row.name)
  if (next !== text) await writeFile(file, next)
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
  if (!file) return
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch {
    text = ''
  }
  const document = loadPatchDocument(text)
  const wrapped = wrapBareMcpInserts(document)
  const unwrapped = unwrapBridgeInDocument(document)
  if (wrapped || unwrapped) await writeFile(file, serializePatch(document))
}

export function mcpPluginId(entry) {
  if (entry && entry.pluginId) return String(entry.pluginId)
  const serverName = sanitizeMcpServerName(entry && entry.serverName)
  return serverName ? `mcp-${serverName}` : ''
}

export function buildMcpBootHoldPatch(entries) {
  const ids = []
  const seen = new Set()
  for (const row of Array.isArray(entries) ? entries : []) {
    const id = mcpPluginId(row)
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  if (!ids.length) return ''
  return `${ids.map((id) => `- id: ${id}\n  disabled: true`).join('\n')}\n`
}

async function readHoldSidecar(file) {
  const raw = await readFile(file, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid mcp boot hold sidecar')
  return parsed
}

export async function applyMcpBootHold(aiRuntime) {
  const homeFile = homeCordisPatchPath(aiRuntime)
  const sidecar = mcpBootHoldSidecarPath(aiRuntime)
  if (!homeFile || !sidecar) return { applied: false }
  const archive = parseMcpPatchEntries(await readMcpArchiveText(aiRuntime))
  const hold = buildMcpBootHoldPatch(archive)
  if (!hold) return { applied: false }
  let snapshot
  try {
    snapshot = await readHoldSidecar(sidecar)
  } catch {
    let text = null
    try {
      text = await readFile(homeFile, 'utf8')
    } catch {
      text = null
    }
    snapshot = text == null ? { missing: true } : { text }
    await mkdir(dirname(sidecar), { recursive: true })
    await writeFile(sidecar, `${JSON.stringify(snapshot)}\n`)
  }
  const original = snapshot.missing ? '' : String(snapshot.text || '')
  const merged = original ? normalizeCordisPatchText(`${original}\n${hold}`) : hold
  await mkdir(dirname(homeFile), { recursive: true })
  await writeNormalizedPatch(homeFile, merged)
  return { applied: true }
}

export async function releaseMcpBootHold(aiRuntime) {
  const homeFile = homeCordisPatchPath(aiRuntime)
  const sidecar = mcpBootHoldSidecarPath(aiRuntime)
  if (!homeFile || !sidecar) return { released: false }
  let snapshot
  try {
    snapshot = await readHoldSidecar(sidecar)
  } catch {
    return { released: false }
  }
  if (snapshot.missing) await rm(homeFile, { force: true })
  else await writeNormalizedPatch(homeFile, String(snapshot.text || ''))
  await rm(sidecar, { force: true })
  return { released: true }
}
