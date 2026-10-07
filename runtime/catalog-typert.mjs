/**
 * Read Host verbs from this-install typert.host.js. Method names are not hardcoded.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_BIN } from './config.mjs'

const NS_KIND = {
  workspaceFiles: 'file',
  fileReferences: 'file',
  fileUploads: 'file',
  officeToPdf: 'skill',
  directoryPicker: 'file',
  goals: 'goal',
  skills: 'skill',
  session: 'session',
  subagents: 'session',
  sessionFeedback: 'session',
  sessionReferenceResolver: 'session',
  commands: 'session',
  messageFeedback: 'session',
  userQuestions: 'session',
  pluginInventory: 'plugin',
  pluginManager: 'plugin',
  pluginRegistryProbe: 'plugin',
  dynamicCordisRunner: 'plugin',
  workspace: 'workspace',
  agentPresets: 'agent',
  terminal: 'terminal',
  schedule: 'schedule',
  job: 'job',
  settings: 'settings',
  llm: 'model',
  speech: 'settings',
  account: 'settings',
  credentials: 'settings',
  permissionPresets: 'settings',
}

const KIND_NAMESPACES = {
  file: ['workspaceFiles'],
  goal: ['goals'],
  todo: ['goals'],
  skill: ['skills'],
  session: ['session'],
  plugin: ['pluginInventory'],
  workspace: ['workspace'],
  agent: ['agentPresets'],
  mcp: [],
  terminal: ['terminal'],
  schedule: ['schedule'],
  job: ['job'],
  model: ['llm'],
  settings: ['settings'],
}

const LIST_METHODS = new Set(['list', 'get'])
const READ_METHODS = new Set(['read', 'readBytes', 'readAll', 'readRelated', 'stat'])
const PROJECTION_METHODS = new Set(['changes'])

export function kindOfNamespace(ns) {
  return NS_KIND[String(ns || '')] || ''
}

export function verbRole(method) {
  const name = String(method || '')
  if (LIST_METHODS.has(name)) return 'list'
  if (READ_METHODS.has(name)) return 'read'
  if (PROJECTION_METHODS.has(name)) return 'projection'
  return 'action'
}

function parametersFromBlock(block) {
  const params = []
  const start = String(block || '').search(/parameters:\s*\[/)
  if (start < 0) return params
  const text = String(block)
  let i = text.indexOf('[', start)
  if (i < 0) return params
  let depth = 0
  let end = i
  for (; end < text.length; end += 1) {
    const ch = text[end]
    if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) {
        end += 1
        break
      }
    }
  }
  const body = text.slice(i, end)
  const re = /wire:\s*'([^']+)'/g
  let match
  while ((match = re.exec(body))) {
    const slice = body.slice(match.index, match.index + 280)
    const source = slice.match(/source:\s*'([^']+)'/)
    const lookup = slice.match(/lookup:\s*'([^']+)'/)
    params.push({
      wire: match[1],
      source: source ? source[1] : 'json',
      lookup: lookup ? lookup[1] : '',
    })
  }
  return params
}

function declarationsFromTypertText(source) {
  const map = {}
  const re = /"declaration":\s*"export interface (\w+) \{([^"]*)\}"/g
  let match
  while ((match = re.exec(String(source || '')))) {
    const fields = []
    const body = match[2].replace(/\\n/g, '\n')
    for (const field of body.matchAll(/readonly (\w+)\s*:/g)) fields.push(field[1])
    if (fields.length) map[match[1]] = fields
  }
  return map
}

function resultShapeFromBlock(block, stream) {
  if (stream) return 'stream'
  const text = String(block || '')
  if (/Uint8Array|RenderedDocumentBytes|WorkspaceFileBytes|writeBytes/.test(text)) return 'bytes'
  const result = text.slice(text.search(/result:\s*\{/))
  if (result && /z\.void\(\)/.test(result.slice(0, 400))) return 'void'
  return 'json'
}

export function verbsFromTypertText(text) {
  const verbs = []
  const seen = new Set()
  const source = String(text || '')
  const declarations = declarationsFromTypertText(source)
  const pair = /namespace:\s*'([^']+)'[\s\S]{0,200}?method:\s*'([^']+)'/g
  const hashed = /#([A-Za-z][A-Za-z0-9]*)\/([A-Za-z][A-Za-z0-9]*)'/g
  let match
  while ((match = pair.exec(source))) {
    const after = source.slice(match.index + match[0].length)
    const own = after.split(/namespace:\s*'|method:\s*'/)[0]
    const stream = /mode:\s*'stream'/.test(own)
    const symbols = [...own.matchAll(/typeSymbol:\s*'[^']*#([^']+)'/g)].map((row) => row[1])
    const requestSymbol = symbols[0]
    const resultSymbol = symbols.length > 1 ? symbols[symbols.length - 1] : ''
    addVerb(verbs, seen, match[1], match[2], {
      stream,
      parameters: parametersFromBlock(own),
      result: resultShapeFromBlock(own, stream),
      requestFields: requestSymbol && declarations[requestSymbol] ? declarations[requestSymbol] : [],
      resultFields: resultSymbol && declarations[resultSymbol] ? declarations[resultSymbol] : [],
    })
  }
  while ((match = hashed.exec(source))) {
    addVerb(verbs, seen, match[1], match[2])
  }
  return verbs
}

/** Tool names registered via defineTool({ name }) in this-install packages. */
export function toolNamesFromDefineToolText(text) {
  const names = []
  const seen = new Set()
  const source = String(text || '')
  const re = /defineTool\(\{\s*name:\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]/g
  let match
  while ((match = re.exec(source))) {
    if (seen.has(match[1])) continue
    seen.add(match[1])
    names.push(match[1])
  }
  return names
}

let mcpResourceCached = null

export function listMcpResourceToolNames(root = resolveDshModulesRoot()) {
  if (mcpResourceCached && mcpResourceCached.root === root) return mcpResourceCached.names
  const file = root ? join(root, 'dsh-mcp-resources', 'lib', 'index.js') : ''
  let names = []
  if (file && existsSync(file)) {
    try {
      names = toolNamesFromDefineToolText(readFileSync(file, 'utf8'))
    } catch {
      names = []
    }
  }
  mcpResourceCached = { root, names }
  return names
}

function addVerb(verbs, seen, ns, method, face = {}) {
  const endpoint = `${ns}/${method}`
  if (seen.has(endpoint)) return
  seen.add(endpoint)
  const stream = Boolean(face.stream)
  verbs.push({
    ns,
    method,
    endpoint,
    kind: kindOfNamespace(ns),
    role: verbRole(method),
    stream,
    parameters: Array.isArray(face.parameters) ? face.parameters : [],
    result: face.result || (stream ? 'stream' : 'json'),
    requestFields: Array.isArray(face.requestFields) ? face.requestFields : [],
    resultFields: Array.isArray(face.resultFields) ? face.resultFields : [],
  })
}

export function resolveDshPackageRoot(bin = FDE_DSH_BIN) {
  const start = bin && existsSync(bin) ? realpathSync(bin) : bin
  let dir = start ? dirname(start) : ''
  for (let i = 0; i < 8 && dir && dir !== dirname(dir); i++) {
    const nested = join(dir, 'node_modules', '@deepseek-ai', 'dsh')
    if (existsSync(join(nested, 'package.json'))) return nested
    const self = join(dir, 'package.json')
    if (existsSync(self)) {
      try {
        const name = JSON.parse(readFileSync(self, 'utf8')).name
        if (name === '@deepseek-ai/dsh') return dir
      } catch {
        /* keep walking */
      }
    }
    dir = dirname(dir)
  }
  return ''
}

export function resolveDshModulesRoot(bin = FDE_DSH_BIN) {
  const pkg = resolveDshPackageRoot(bin)
  if (!pkg) return ''
  const sibling = dirname(pkg)
  if (basename(sibling) === '@deepseek-ai') return sibling
  const nested = join(pkg, 'node_modules', '@deepseek-ai')
  if (existsSync(nested)) return nested
  return ''
}

function typertHostFiles(modulesRoot) {
  const files = []
  if (!modulesRoot || !existsSync(modulesRoot)) return files
  let names = []
  try {
    names = readdirSync(modulesRoot)
  } catch {
    return files
  }
  for (const name of names) {
    const file = join(modulesRoot, name, 'lib', 'typert.host.js')
    if (existsSync(file)) files.push(file)
  }
  return files
}

let cached = null

function fieldsFromCreate(create) {
  if (typeof create !== 'function') return []
  try {
    const schema = create()
    if (schema && schema.shape && typeof schema.shape === 'object') return Object.keys(schema.shape)
  } catch {
    return []
  }
  return []
}

function requestFieldsFromParameter(parameter) {
  return fieldsFromCreate(parameter?.codec?.create)
}

function resultFieldsFromResult(result) {
  return fieldsFromCreate(result?.create || result?.codec?.create)
}

export function verbFromInvocation(inv) {
  const ns = String(inv?.namespace || '')
  const method = String(inv?.method || '')
  const stream = inv?.mode === 'stream'
  const parameters = Array.isArray(inv?.parameters)
    ? inv.parameters.map((row) => ({
      wire: String(row.wire || ''),
      source: String(row.source || 'json'),
      lookup: String(row.lookup || ''),
    })).filter((row) => row.wire)
    : []
  const requestParam = Array.isArray(inv?.parameters) ? inv.parameters.find((row) => row.wire === 'request') : null
  const requestFields = requestFieldsFromParameter(requestParam)
  const resultFields = resultFieldsFromResult(inv?.result)
  const symbol = String(inv?.result?.typeSymbol || '')
  let result = 'json'
  if (stream) result = 'stream'
  else if (typeof inv?.result?.encode === 'function' || /Bytes|Uint8Array/.test(symbol)) result = 'bytes'
  return {
    ns,
    method,
    endpoint: `${ns}/${method}`,
    kind: kindOfNamespace(ns),
    role: verbRole(method),
    stream,
    parameters,
    result,
    requestFields,
    resultFields,
  }
}

export async function ensureTypertVerbs(root = resolveDshModulesRoot()) {
  if (cached && cached.root === root && Array.isArray(cached.verbs) && cached.verbs.length) return cached.verbs
  const files = typertHostFiles(root)
  const verbs = []
  const seen = new Set()
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(file).href)
      const invocations = Array.isArray(mod.TYPERT?.invocations) ? mod.TYPERT.invocations : []
      for (const inv of invocations) {
        const verb = verbFromInvocation(inv)
        if (!verb.ns || !verb.method || seen.has(verb.endpoint)) continue
        seen.add(verb.endpoint)
        verbs.push(verb)
      }
    } catch {
      continue
    }
  }
  cached = { root, verbs }
  return verbs
}

export function listTypertVerbs(root = resolveDshModulesRoot()) {
  if (cached && cached.root === root) return cached.verbs
  return []
}

export function verbsForKind(kind, verbs = listTypertVerbs()) {
  const key = String(kind || '').trim()
  const alias = key === 'todo' ? 'goal' : key
  const found = verbs.filter((verb) => verb.kind === alias)
  if (found.length) return found
  const namespaces = KIND_NAMESPACES[alias] || KIND_NAMESPACES[key] || []
  return namespaces.map((ns) => ({
    ns,
    method: 'list',
    endpoint: `${ns}/list`,
    kind: alias,
    role: 'list',
    stream: false,
    parameters: [],
    result: 'json',
  }))
}
