import { createServer, request as httpRequest } from 'node:http'
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { appendFile, cp, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

function scheduleRuntimeRestart() {
  const delayMs = 200
  if (process.env.FDE_RUNTIME_SUPERVISED !== '1') {
    const restarter = spawn(process.execPath, ['scripts/runtime-respawn.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, FDE_RUNTIME_REPLACE_PID: String(process.pid) },
      detached: true,
      stdio: 'inherit',
    })
    restarter.unref()
  }
  setTimeout(() => { void close() }, delayMs)
}

async function pickLocalDirectory() {
  if (process.platform !== 'darwin') {
    return { unavailable: true, error: 'dir_picker_unavailable' }
  }
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', 'POSIX path of (choose folder with prompt "选择工作区目录")'], { timeout: 120000 })
    const path = String(stdout || '').trim().replace(/\/$/, '')
    if (path.startsWith('/')) return { path }
  } catch (error) {
    if (error && (error.code === '1' || error.code === 1)) return { path: null }
  }
  try {
    const picked = await aiRuntime.call('directoryPicker/pick', {})
    if (typeof picked === 'string' && picked.startsWith('/')) return { path: picked.replace(/\/$/, '') }
  } catch { /* 没有原生选择器就放弃 */ }
  return { path: null }
}
import {
  appendAudit,
  approveOperation,
  createBusinessApp,
  updateBusinessApp,
  createId,
  createWorkspace,
  databaseHealth,
  enqueueEvent,
  ensureWorkspace,
  executeDryRun,
  executeOperationLive,
  getOperation,
  insertOperationStep,
  getOperationTrace,
  listBusinessApps,
  listBusinessConnections,
  listOperations,
  listPendingEvents,
  listWorkspaces,
  memoryWriteOriginByCardIds,
  openDatabase,
} from './db.mjs'
import { inspectAdapters } from './adapters.mjs'
import { LIVE_PATH, liveProbeBody, withProbeTimeout } from './live-probe.mjs'
import { ENGINE_PROBE_MS, engineProbeKind } from './engine-probe.mjs'
import { enrichReadyWithLlm, readDshDefaultLlm } from './dsh-default-llm.mjs'
import { handlePlanRequest } from './routes/plan.mjs'
import { handleCatalogRequest } from './routes/catalog.mjs'
import { collectBag } from './catalog-collect.mjs'
import { ensureTypertVerbs } from './catalog-typert.mjs'
import { ensurePresets, handlePresetRoutes } from './routes/presets.mjs'
import { handleMcpRoutes } from './routes/mcp.mjs'
import { handleSkillRoutes } from './routes/skills.mjs'
import { AiRemoteError, createCoreConnector } from './dsh-core.mjs'
import { createFollowNormalizer } from './ai-stream.mjs'
import { configureEventBus, emit } from './events.mjs'
import { startLanAssistStateWatch, subscribeLanAssistMailbox } from './lan-assist-state-watch.mjs'
import { migrateBoundWorkspaceSources, readBizSystems } from './biz/systems-store.mjs'
import { startSemanticReadyWatch } from './semantic-ready-watch.mjs'
import { refreshLanAssistConnectionLamp } from './biz/connection-lamp.mjs'
import { handleEventsRoutes } from './routes/events.mjs'
import { handleAppsRoutes } from './routes/apps.mjs'
import { handleBizRoutes, recordSurfaceFromPreview } from './routes/biz.mjs'
import { ensureBridgeToken, handleAiResultGet, handleBridgeRoutes } from './routes/bridge.mjs'
import { handleContextPackRoute } from './routes/context.mjs'
import { handleSearchRoute } from './routes/search.mjs'
import { handleCorpusRoute, loadOrigin } from './routes/corpus.mjs'
import { handleBriefingRoutes } from './routes/briefing.mjs'
import { findSessionDir, readSessionTree, writeSessionTree } from './session-tree.mjs'
import { resolvePrimarySessionForRuntime } from './session-primary.mjs'
import { decodeWorkspaceFileText, readWorkspaceFileBytes } from './files-bytes.mjs'
import {
  SESSION_BIND_BOTH,
  SESSION_BIND_MISSING,
  SESSION_RESTORE_BOTH,
  SESSION_RESTORE_MISSING,
  parseSessionBind,
  restoreWriteRoot,
} from './session-bind.mjs'
import { mergePageCors } from './proxy-cors.mjs'
import { tryServeStatic } from './routes/static.mjs'
import { shouldProxyDshPath } from './dsh-proxy-gate.mjs'
import {
  listWorkspaceDocumentVersions,
  rollbackWorkspaceDocument,
  writeWorkspaceDocument,
} from './workspace-file-document.mjs'
import { reclaimStrayRuntime } from './reclaim-runtime.mjs'
import {
  alignModelRowsWithDiscover,
  modelCapacityFromDiscoverRow,
  discoverProviderModels,
  fetchModelsSettingsSnapshot,
  formatReasoningEffortsYaml,
  pathOps,
  pickModelRowFields,
  protocolChoicesFromNamespace,
  providerKeyRef as modelsProviderKeyRef,
  validateApiKeyInput,
} from './models-settings.mjs'
import { startBriefingScheduler } from './briefing/scheduler.mjs'
import { startMemoryWriter } from './memory/writer.mjs'
import { asDraftCard, attachCuesOnCards, attachCuesOnGroups, collapseCueCards, loadNamedCards, validateMemoryCardLabel } from './memory/cards.mjs'
import { attachCardOrigin, draftCard } from './memory/draft.mjs'
import { instanceOriginOf } from './memory/identity.mjs'
import { HEALTH_PAGE, buildHealthSheet, collectHealthCardIds, dupIssuesFromEnrich, healthWritePlan, liveDuplicateBag } from './memory/health.mjs'
import {
  FDE_AI_WORKSPACE,
  FDE_ALLOWED_ORIGINS,
  FDE_DATABASE_PATH,
  FDE_DSH_HOME,
  FDE_OFFICIAL_DSH_HOME,
  FDE_RUNTIME_DIR,
  FDE_RUNTIME_HOST,
  FDE_RUNTIME_PORT,
  FDE_STATIC_DIR,
  FDE_WEB_PORT,
} from './config.mjs'

const runtimeDirectory = FDE_RUNTIME_DIR
const databasePath = FDE_DATABASE_PATH
const migrationsDirectory = resolve(runtimeDirectory, 'migrations')
const port = FDE_RUNTIME_PORT
const host = FDE_RUNTIME_HOST
const db = openDatabase(databasePath, migrationsDirectory)
configureEventBus(db)
const aiRuntime = createCoreConnector({
  cwd: FDE_AI_WORKSPACE,
})
startMemoryWriter({ db, aiRuntime })
let bridgeToken = ''
void ensureBridgeToken(aiRuntime.dshHome || FDE_DSH_HOME).then((token) => {
  bridgeToken = token
})

function normalizeBaseUrl(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const withScheme = /^https?:\/\//iu.test(text) ? text : `http://${text}`
  return withScheme.replace(/\/+$/u, '')
}

function requestMemoryCwd(url, body) {
  const fromBody = body && typeof body.cwd === 'string' ? body.cwd.trim() : ''
  const fromQuery = String(url.searchParams.get('cwd') || '').trim()
  const cwd = fromBody || fromQuery
  return cwd.startsWith('/') ? cwd : ''
}

function workspaceCwdOf(operation) {
  let workspaceCwd = FDE_AI_WORKSPACE
  try {
    const wsRow = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(operation.workspaceId)
    const meta = JSON.parse(wsRow?.metadata_json || '{}')
    const raw = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
    if (raw.startsWith('/')) workspaceCwd = raw
  } catch { /* default cwd */ }
  return workspaceCwd
}

async function emitOperationExecuted(operation, receipt) {
  const workspaceCwd = workspaceCwdOf(operation)
  let sessionId = ''
  try {
    sessionId = await resolvePrimarySessionForRuntime(aiRuntime, { cwd: workspaceCwd })
  } catch { /* skip */ }
  emit('operation.executed', {
    operationId: operation.id,
    receipt,
  }, {
    workspaceCwd,
    ...(sessionId ? { sessionId } : {}),
    source: 'bff',
  })
}

async function exchangeNocoBaseToken(baseUrl, account, password) {
  const body = /@/u.test(account)
    ? { account, email: account, password }
    : { account, password }
  const response = await fetch(`${baseUrl}/api/auth:signIn?authenticator=basic`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'X-Authenticator': 'basic',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  const token = payload?.data?.token || payload?.data?.data?.token || payload?.token
  if (!response.ok || !token) {
    const hint = payload?.errors?.[0]?.message || payload?.error?.message || payload?.message || '业务系统登录失败'
    const error = new Error(hint)
    error.code = response.status === 401 ? 'EXPIRED' : 'LOOKUP'
    throw error
  }
  return String(token)
}

function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets)
  if (value && typeof value === 'object') {
    const next = {}
    for (const [key, child] of Object.entries(value)) {
      if (key === 'token' || key === 'password' || key === 'authorization' || key === 'cookie') continue
      next[key] = stripSecrets(child)
    }
    return next
  }
  return value
}

function safeWorkspaceRel(name) {
  const text = String(name || '').trim()
  if (!text || text.includes('\0')) return null
  const parts = text.split(/[\\/]/u).filter(Boolean)
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) return null
  return parts.join('/')
}

async function resolveFileRoot(sessionId) {
  if (sessionId) {
    try {
      const listed = await aiRuntime.call('session/list', { _request: { includeBlank: true } })
      const items = Array.isArray(listed?.items) ? listed.items : []
      const row = items.find((item) => item.sessionId === sessionId)
      if (row?.cwd) return resolve(row.cwd)
    } catch {
      // 回落到运行时工作区。
    }
  }
  return resolve(aiRuntime.cwd)
}

const allowedOrigins = new Set(FDE_ALLOWED_ORIGINS)

function corsHeaders(response) {
  const origin = response.req?.headers.origin
  if (typeof origin === 'string' && allowedOrigins.has(origin)) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
  }
  return {}
}

function maskSecret(value) {
  const text = String(value || '')
  if (text.length < 8) return text ? '已配置' : ''
  return `已配置 · 尾号 ${text.slice(-4)}`
}

function readCredentialRefs(filePath) {
  let text = ''
  try { text = readFileSync(filePath, 'utf8') } catch { return {} }
  const refs = {}
  let inRefs = false
  for (const line of text.split('\n')) {
    if (/^refs:\s*$/.test(line)) { inRefs = true; continue }
    if (inRefs && /^\S/.test(line)) inRefs = false
    if (!inRefs) continue
    const match = line.match(/^\s+([A-Z][A-Z0-9_]*):\s*(.*)$/)
    if (match) refs[match[1]] = match[2].trim()
  }
  return refs
}

function yamlScalar(value) {
  const text = String(value ?? '')
  if (text === '' || /[:#\n&*?|>!%@`]/.test(text) || /^(true|false|null|yes|no)$/i.test(text)) return JSON.stringify(text)
  return text
}

const PROVIDER_ROUTE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

function formatSettingsProviderBlock(route, profile) {
  const models = Array.isArray(profile.models) ? profile.models : []
  return [
    `    ${route}:`,
    profile.displayName ? `      displayName: ${yamlScalar(profile.displayName)}` : null,
    profile.apiKeyEnv ? `      apiKeyEnv: ${yamlScalar(profile.apiKeyEnv)}` : null,
    `      api: ${yamlScalar(profile.api)}`,
    `      baseURL: ${yamlScalar(profile.baseURL)}`,
    '      models:',
    ...models.map((row) => {
      const efforts = row.reasoningEfforts
      const hasCapacity = row.contextWindow !== undefined || row.maxTokens !== undefined
      const hasEfforts = efforts !== undefined && efforts !== null
        && (typeof efforts !== 'object' || efforts._flow || Object.keys(efforts).length > 0)
      if (hasEfforts || hasCapacity) {
        const lines = [
          `        - id: ${yamlScalar(row.id)}`,
          `          name: ${yamlScalar(row.name || row.id)}`,
        ]
        if (row.contextWindow !== undefined) lines.push(`          contextWindow: ${row.contextWindow}`)
        if (row.maxTokens !== undefined) lines.push(`          maxTokens: ${row.maxTokens}`)
        if (hasEfforts) lines.push(...formatReasoningEffortsYaml(efforts, '          '))
        return lines.join('\n')
      }
      return `        - { id: ${yamlScalar(row.id)}, name: ${yamlScalar(row.name || row.id)} }`
    }),
  ].filter(Boolean).join('\n') + '\n'
}

function findSettingsProviderBlockRange(lines, route) {
  const startRe = new RegExp(`^    ${route}:\\s*$`)
  let start = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (startRe.test(lines[i])) { start = i; break }
  }
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^    [a-z][a-z0-9-]*:/.test(lines[i])) { end = i; break }
    if (/^  \S/.test(lines[i]) && !/^    /.test(lines[i])) { end = i; break }
  }
  return { start, end }
}

function readSettingsProviderProfile(filePath, route) {
  let text = ''
  try { text = readFileSync(filePath, 'utf8') } catch { return null }
  const lines = text.split('\n')
  const range = findSettingsProviderBlockRange(lines, route)
  if (!range) return null
  const block = lines.slice(range.start, range.end).join('\n')
  const displayName = block.match(/^\s+displayName:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') || ''
  const api = block.match(/^\s+api:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') || 'openai-completions'
  const baseURL = block.match(/^\s+baseURL:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') || ''
  const apiKeyEnv = block.match(/^\s+apiKeyEnv:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') || ''
  const models = []
  for (const inline of block.matchAll(/\{\s*id:\s*([^,}]+),\s*name:\s*([^}]+)\s*\}/g)) {
    models.push({
      id: inline[1].trim().replace(/^['"]|['"]$/g, ''),
      name: inline[2].trim().replace(/^['"]|['"]$/g, ''),
    })
  }
  for (const multi of block.matchAll(/-\s*id:\s*(.+)\n([\s\S]*?)(?=\n\s*-\s*id:|\n\s*\S|$)/g)) {
    const id = multi[1].trim().replace(/^['"]|['"]$/g, '')
    const body = multi[2] || ''
    const name = body.match(/^\s*name:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') || id
    const contextWindow = body.match(/^\s*contextWindow:\s*(\d+)\s*$/m)?.[1]
    const maxTokens = body.match(/^\s*maxTokens:\s*(\d+)\s*$/m)?.[1]
    const inlineEfforts = body.match(/reasoningEfforts:\s*\{([^}]+)\}/)?.[1]
    const blockEfforts = body.match(/^\s*reasoningEfforts:\s*$/m)
    let reasoningEfforts
    if (inlineEfforts) {
      reasoningEfforts = { _flow: inlineEfforts.trim() }
    } else if (blockEfforts) {
      reasoningEfforts = {}
      for (const line of body.split('\n')) {
        const m = line.match(/^\s{10,}([a-zA-Z0-9_]+):\s*(.+)$/)
        if (!m) continue
        const val = m[2].trim()
        reasoningEfforts[m[1]] = val === 'null' ? null : val.replace(/^['"]|['"]$/g, '')
      }
      if (!Object.keys(reasoningEfforts).length) reasoningEfforts = undefined
    }
    if (!models.some((row) => row.id === id)) {
      models.push({
        id,
        name,
        ...(contextWindow ? { contextWindow: Number(contextWindow) } : {}),
        ...(maxTokens ? { maxTokens: Number(maxTokens) } : {}),
        ...(reasoningEfforts ? { reasoningEfforts } : {}),
      })
    }
  }
  return { displayName, api, baseURL, apiKeyEnv, models }
}

async function loadProtocolChoicesFromDescribe(aiRuntime) {
  if (!aiRuntime.status().connected) return []
  try {
    const describe = await aiRuntime.rpc('settings/describe', {})
    const piAi = (describe?.namespaces || []).find((row) => row.ns === 'llm-pi-ai')
    return protocolChoicesFromNamespace(piAi)
  } catch {
    return []
  }
}

function upsertSettingsProvider(filePath, route, profile) {
  const block = formatSettingsProviderBlock(route, profile)
  let text = ''
  try { text = readFileSync(filePath, 'utf8') } catch { text = '' }
  if (!text.trim()) {
    writeFileSync(filePath, `llm-pi-ai:\n  providers:\n${block}`)
    return
  }
  const lines = text.split('\n')
  const range = findSettingsProviderBlockRange(lines, route)
  if (range) {
    const blockLines = block.replace(/\n$/, '').split('\n')
    const next = [...lines.slice(0, range.start), ...blockLines, ...lines.slice(range.end)]
    const merged = next.join('\n')
    writeFileSync(filePath, merged.endsWith('\n') ? merged : `${merged}\n`)
    return
  }
  if (/llm-pi-ai:\s*\n(?:[ \t].*\n)*?[ \t]*providers:\s*\n/.test(text)) {
    text = text.replace(/(providers:\s*\n)/, `$1${block}`)
  } else if (/^llm-pi-ai:\s*$/m.test(text)) {
    text = text.replace(/^(llm-pi-ai:\s*\n)/m, `$1  providers:\n${block}`)
  } else {
    text = `${text.replace(/\s+$/, '')}\nllm-pi-ai:\n  providers:\n${block}`
  }
  writeFileSync(filePath, text.endsWith('\n') ? text : `${text}\n`)
}

function removeSettingsProvider(filePath, route) {
  let text = ''
  try { text = readFileSync(filePath, 'utf8') } catch { return false }
  const lines = text.split('\n')
  const range = findSettingsProviderBlockRange(lines, route)
  if (!range) return false
  const next = [...lines.slice(0, range.start), ...lines.slice(range.end)]
  const merged = next.join('\n').replace(/\n{3,}/g, '\n\n')
  writeFileSync(filePath, merged.endsWith('\n') ? merged : `${merged}\n`)
  return true
}

function removeCredentialRef(filePath, name) {
  let text = ''
  try { text = readFileSync(filePath, 'utf8') } catch { return false }
  const lineRe = new RegExp(`^\\s+${name}:\\s*.*\\n?`, 'm')
  if (!lineRe.test(text)) return false
  text = text.replace(lineRe, '')
  writeFileSync(filePath, text.endsWith('\n') ? text : `${text}\n`)
  return true
}

function providerKeyRef(providerOrRoute) {
  return modelsProviderKeyRef(providerOrRoute)
}

function buildCustomProviderProfile(body, route, existingProfile) {
  const displayName = String(body.displayName ?? existingProfile?.displayName ?? '').trim()
  const baseURL = String(body.baseURL ?? existingProfile?.baseURL ?? '').trim()
  const api = String(body.api ?? existingProfile?.api ?? 'openai-completions').trim()
  const apiKey = String(body.apiKey ?? '').trim()
  const picked = Array.isArray(body.models) ? body.models : null
  let models
  if (picked) {
    models = picked.map((row) => pickModelRowFields(row)).filter(Boolean)
  } else {
    models = (existingProfile?.models || [])
      .map((row) => pickModelRowFields(row))
      .filter(Boolean)
  }
  const modelId = String(body.modelId || '').trim()
  const modelName = String(body.modelName || modelId).trim()
  if (models.length === 0 && modelId) models.push({ id: modelId, ...(modelName ? { name: modelName } : {}) })
  const keyRef = providerKeyRef(route)
  const keepKeyEnv = existingProfile?.apiKeyEnv || keyRef
  const preserved = existingProfile && typeof existingProfile === 'object' ? { ...existingProfile } : {}
  delete preserved.models
  return {
    profile: {
      ...preserved,
      ...(displayName ? { displayName } : {}),
      ...((apiKey || existingProfile?.apiKeyEnv) ? { apiKeyEnv: keepKeyEnv } : {}),
      api,
      baseURL,
      models,
    },
    apiKey,
    keyRef,
  }
}

async function applyCustomProviderWrite(aiRuntime, route, profile, apiKey, expectedRevision) {
  let live = false
  let liveError = ''
  const credPath = join(aiRuntime.dshHome, '.credentials.yaml')
  const settingsPath = join(aiRuntime.dshHome, 'settings.yaml')
  const discovered = await discoverProviderModels(aiRuntime, profile, route)
  const alignedProfile = {
    ...profile,
    models: alignModelRowsWithDiscover(profile.models, discovered),
  }
  if (aiRuntime.status().connected) {
    try {
      await aiRuntime.rpc('settings/mutate', {
        ns: 'llm-pi-ai',
        ops: [{ op: 'set', path: ['providers', route], value: alignedProfile }],
        ...(expectedRevision !== undefined ? { expectedRevision } : {}),
      })
      if (apiKey) await aiRuntime.rpc('credentials/set', { ref: providerKeyRef(route), value: apiKey })
      live = true
    } catch (error) {
      liveError = error instanceof Error ? error.message : String(error)
    }
  }
  if (apiKey) upsertCredentialRef(credPath, providerKeyRef(route), apiKey)
  upsertSettingsProvider(settingsPath, route, alignedProfile)
  return { live, liveError }
}

function upsertCredentialRef(filePath, name, value) {
  let text = ''
  try { text = readFileSync(filePath, 'utf8') } catch { text = 'version: 1\nrefs:\n' }
  if (!/^refs:\s*$/m.test(text) && !/^refs:\n/m.test(text)) {
    text = `${text.replace(/\s+$/, '')}\nrefs:\n`
  }
  const lineRe = new RegExp(`^(\\s+)${name}:\\s*.*$`, 'm')
  if (lineRe.test(text)) text = text.replace(lineRe, `$1${name}: ${value}`)
  else text = text.replace(/^refs:\s*$/m, `refs:\n  ${name}: ${value}`)
  writeFileSync(filePath, text.endsWith('\n') ? text : `${text}\n`)
}

function sendJson(response, status, payload) {
  if (response.headersSent || response.writableEnded) return
  const body = JSON.stringify(stripSecrets(payload))
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Headers': 'Content-Type, X-Correlation-Id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    ...corsHeaders(response),
  })
  response.end(body)
}

function sendError(response, status, code, message, correlationId, details) {
  sendJson(response, status, {
    error: { code, message, details },
    correlationId,
  })
}

function openEventStream(response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...corsHeaders(response),
  })
  response.write(': connected\n\n')
}

function writeEvent(response, event, data) {
  response.write(`event: ${event}\n`)
  response.write(`data: ${JSON.stringify(data)}\n\n`)
}

async function readJson(request) {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > 32 * 1024 * 1024) throw new Error('request_too_large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function correlationId(request) {
  const incoming = request.headers['x-correlation-id']
  return typeof incoming === 'string' && incoming.length > 0 ? incoming : createId('corr')
}

function isSubagentSession(item) {
  return item?.origin === 'subagent'
}

async function readWorkspaceBaseline() {
  const abort = new AbortController()
  try {
    for await (const frame of aiRuntime.stream('workspace/follow', {}, abort.signal)) {
      if (frame?.type === 'baseline') {
        abort.abort()
        return {
          items: Array.isArray(frame.value?.items) ? frame.value.items : [],
          archivedSessionIds: Array.isArray(frame.value?.archivedSessionIds) ? frame.value.archivedSessionIds : [],
        }
      }
    }
  } catch {
    /* aborted after baseline */
  }
  return { items: [], archivedSessionIds: [] }
}

function toAiSessionSummary(item) {
  const values = item?.projections?.values && typeof item.projections.values === 'object'
    ? item.projections.values
    : {}
  const selection = values.modelSelection && typeof values.modelSelection === 'object'
    ? values.modelSelection
    : {}
  return {
    sessionId: item.sessionId,
    title: typeof values.title === 'string' && values.title.trim() ? values.title : '未命名会话',
    updatedAt: item.updatedAt,
    running: Boolean(item.running),
    blank: Boolean(item.blank),
    ...(typeof item.parentSessionId === 'string' ? { parentSessionId: item.parentSessionId } : {}),
    ...(item.origin === 'subagent' ? { origin: 'subagent' } : {}),
    ...(typeof item.cwd === 'string' ? { cwd: item.cwd } : {}),
    ...(typeof values.agentPreset === 'string' ? { agentPreset: values.agentPreset } : {}),
    ...(selection.lastUsed && typeof selection.lastUsed === 'object' ? { lastUsedModel: selection.lastUsed } : {}),
    ...(selection.next && typeof selection.next === 'object' ? { nextModel: selection.next } : {}),
  }
}

const FDE_DSH_OCCUPANCY_PATCH = (() => {
  const file = join(FDE_RUNTIME_DIR, 'canvas-occupancy.mjs')
  if (!existsSync(file)) return ''
  const source = readFileSync(file, 'utf8')
    .replace(/export function /g, 'function ')
    .replace(/export const /g, 'const ')
    .replace(/export \{[^}]*\}/g, '')
    .replace(/<\/script/gi, '<\\/script')
  return `<script data-fde-occupancy>\n${source}\ndocument.documentElement.setAttribute("data-fde-session-canvas","")\nwindow.__fdeOccupancyAction = occupancyAction\nwindow.__fdeLandKindFromTab = landKindFromTab\n</script>`
})()

const FDE_DSH_CLIPBOARD_PATCH = (() => {
  const file = join(FDE_RUNTIME_DIR, 'fde-x-dsh-bridge/lib/clipboard-patch.js')
  if (!existsSync(file)) return ''
  const source = readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script')
  return `<script data-fde-clipboard-patch>\n${source}\n</script>`
})()

const FDE_DSH_HEAD_HOOK = `<script data-fde-dsh-hook>
(function () {
  function hookCtx(ctx) {
    try {
      var sessions = (ctx.get && ctx.get("sessions")) || ctx.sessions
      if (sessions && typeof sessions.open === "function") window.__fdeXSessions = sessions
      var ui = (ctx.get && ctx.get("uiWorkspace")) || ctx.uiWorkspace
      if (ui && typeof ui.openSession === "function") window.__fdeXUiWorkspace = ui
    } catch (e) {}
  }
  function wrapSlotsOnCtx(ctx) {
    try {
      var slots = ctx && ((ctx.get && ctx.get("slots")) || ctx.slots)
      if (!slots) return
      var proto = Object.getPrototypeOf(slots)
      var holder = proto && (typeof proto.register === "function" || typeof proto._register === "function") ? proto : slots
      function gate(options, component, orig) {
        var action = typeof window.__fdeOccupancyAction === "function" ? window.__fdeOccupancyAction(options || {}) : "allow"
        if (action === "deny") return function () {}
        if (action === "empty") return orig.call(this, options, function FdeEmptyOccupant() { return null })
        return orig.call(this, options, component)
      }
      if (typeof holder.register === "function" && !holder.register.__fdeOcc) {
        var origReg = holder.register
        holder.register = function (options, component) { return gate.call(this, options, component, origReg) }
        holder.register.__fdeOcc = true
      }
      if (typeof holder._register === "function" && !holder._register.__fdeOcc) {
        var origCore = holder._register
        holder._register = function (options, component) { return gate.call(this, options, component, origCore) }
        holder._register.__fdeOcc = true
      }
    } catch (e) {}
  }
  function wrapFactory(reg) {
    if (!reg || typeof reg.factory !== "function") return
    var id = String(reg.id || "")
    var patchClipboard =
      id.indexOf("dsh-client-ui-primitives") !== -1 || id.indexOf("dsh-web-frontend") !== -1
    var patchSession = id.indexOf("session-controller") !== -1 || id.indexOf("ui-workspace") !== -1
    var patchSlots = id.indexOf("ui-renderer") !== -1
    if (!patchClipboard && !patchSession && !patchSlots) return
    var inner = reg.factory
    if (typeof inner !== "function") return
    reg.factory = function (require) {
      var exp = inner(require)
      if (patchClipboard && typeof window.__fdePatchClipboardExport === "function") {
        try { window.__fdePatchClipboardExport(exp) } catch (e) {}
      }
      if (exp && typeof exp.apply === "function" && !exp.apply.__fdeWrappedApply) {
        var prev = exp.apply
        exp.apply = function (ctx) {
          var out = prev.apply(this, arguments)
          if (patchSlots) wrapSlotsOnCtx(ctx)
          if (patchSession) {
            hookCtx(ctx)
            setTimeout(function () { hookCtx(ctx) }, 0)
            setTimeout(function () { hookCtx(ctx) }, 400)
          }
          return out
        }
        exp.apply.__fdeWrappedApply = true
      }
      return exp
    }
  }
  function wrapLoader(target) {
    if (!target || typeof target.load !== "function" || target.__fdeWrapped) return
    target.__fdeWrapped = true
    var orig = target.load.bind(target)
    target.load = function (reg) {
      wrapFactory(reg)
      return orig(reg)
    }
  }
  var loader
  Object.defineProperty(window, "__ModuleLoader__", {
    configurable: true,
    get: function () { return loader },
    set: function (value) {
      loader = value
      wrapLoader(value)
    }
  })
  setInterval(function () { wrapLoader(window.__ModuleLoader__) }, 50)
})()
</script>`

const FDE_DSH_STRIP_STYLE = `<style data-fde-dsh-strip>
.dla-ask-wrap,.dla-ask-btn,.dla-overlay,.dla-badge,.dla-chat-pop,.dla-chat-scrim,.dla-chat-pair-ask,.dla-sec-backdrop,.dla-sec-panel{display:none!important}
.dsos-root,.dsos-bar{display:none!important}
html[data-fde-session-canvas] [data-sidebar-collapsed],
html[data-fde-session-canvas] [data-rightbar-collapsed]{grid-template-columns:0 minmax(0,1fr) 0!important}
html[data-fde-session-canvas] [data-sidebar-right-session]{display:none!important}
html[data-fde-session-canvas] [data-phase="hero"] [data-composer-seat] :has(> [data-slot="conversation.composer.bar"]) > :not([data-slot="conversation.composer.bar"]):not([data-slot="conversation.input.dock"]):not(:has([data-slot="conversation.hero.agentPreset"])){display:none!important}
html[data-fde-session-canvas] [data-phase="hero"] [data-composer-seat] :has(> [data-slot="conversation.hero.agentPreset"]) > :not([data-slot="conversation.hero.agentPreset"]){display:none!important}
</style>`

function dshProxyPath(url) {
  if (url.pathname === '/ws/graph-updates') return `/semantic-os/ws/graph-updates${url.search}`
  if (url.pathname === '/dsh-app' || url.pathname === '/dsh-app/') return `/${url.search}`
  if (url.pathname.startsWith('/dsh-app/')) return `${url.pathname.slice('/dsh-app'.length)}${url.search}`
  return `${url.pathname}${url.search}`
}

function isSemanticOsPath(pathname) {
  return pathname === '/semantic-os' || pathname.startsWith('/semantic-os/')
}

function requestSemanticOsRawPath(request) {
  const raw = String(request.url || '/')
  const cut = raw.indexOf('?')
  return cut === -1 ? raw : raw.slice(0, cut)
}

function requestTouchesSemanticOs(request) {
  const raw = requestSemanticOsRawPath(request)
  if (raw.includes('/semantic-os')) return true
  try {
    return decodeURIComponent(raw).includes('/semantic-os')
  } catch {
    return false
  }
}

function safeSemanticOsUpstreamPath(request) {
  const raw = String(request.url || '/')
  const cut = raw.indexOf('?')
  const pathOnly = cut === -1 ? raw : raw.slice(0, cut)
  const search = cut === -1 ? '' : raw.slice(cut)
  if (/%2e/i.test(pathOnly) || pathOnly.includes('..')) return ''
  let pathname
  try {
    pathname = decodeURIComponent(pathOnly)
  } catch {
    return ''
  }
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.includes('..')) return ''
  const normalized = resolve('/', pathname)
  if (!isSemanticOsPath(normalized)) return ''
  return `${normalized}${search}`
}

function shouldProxyDsh(url) {
  return shouldProxyDshPath(url.pathname, {
    hostOrigin: aiRuntime.origin,
    staticDir: FDE_STATIC_DIR,
    livePath: LIVE_PATH,
  })
}

function outboundProxyHeaders(incoming) {
  const headers = { ...incoming.headers }
  for (const key of ['connection', 'keep-alive', 'transfer-encoding', 'set-cookie', 'set-cookie2']) {
    delete headers[key]
  }
  return headers
}

function outboundSemanticHeaders(incoming, response) {
  return mergePageCors(outboundProxyHeaders(incoming), corsHeaders(response))
}

function destroySocketPair(a, b) {
  if (a && !a.destroyed) a.destroy()
  if (b && !b.destroyed) b.destroy()
}

function pipeProxyStreams(src, dest) {
  src.on('error', () => destroySocketPair(src, dest))
  dest.on('error', () => destroySocketPair(src, dest))
  return src.pipe(dest)
}

function duplexProxySockets(client, upstream) {
  client.on('error', () => destroySocketPair(client, upstream))
  upstream.on('error', () => destroySocketPair(client, upstream))
  client.pipe(upstream)
  upstream.pipe(client)
}

function isLatin1HeaderValue(value) {
  const text = Array.isArray(value) ? value.join(',') : String(value ?? '')
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) > 255) return false
  }
  return true
}

function latin1RequestHeaders(incoming, extra = {}) {
  const merged = { ...incoming, ...extra }
  delete merged.connection
  const out = {}
  for (const [key, value] of Object.entries(merged)) {
    if (value == null || value === '') continue
    if (!isLatin1HeaderValue(key) || !isLatin1HeaderValue(value)) continue
    out[key] = value
  }
  const cwd = String(out['x-dsh-cwd'] || '')
  if (cwd && /[^\u0000-\u007F]/u.test(cwd)) delete out['x-dsh-cwd']
  return out
}

function originForbidden(request) {
  const origin = request.headers.origin
  const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '')
  if (typeof origin === 'string' && !allowedOrigins.has(origin)) return true
  if (write && (typeof origin !== 'string' || !allowedOrigins.has(origin))) return true
  return false
}

function proxySemanticOs(request, response, url) {
  if (originForbidden(request)) {
    sendError(response, 403, 'origin_not_allowed', '当前页面来源不被允许')
    return
  }
  const path = safeSemanticOsUpstreamPath(request)
  if (!path) {
    sendError(response, 400, 'validation_error', '语义路径不合法')
    return
  }
  if (!aiRuntime.origin || !aiRuntime.cookie) {
    sendError(response, 503, 'ai/not-connected', '核心未接通，无法打开语义系统')
    return
  }
  const target = new URL(aiRuntime.origin)
  const queryCwd = String(new URL(path, 'http://dsh.local').searchParams.get('cwd') || '')
  const asciiCwd = queryCwd.startsWith('/') && !/[^\u0000-\u007F]/u.test(queryCwd) ? queryCwd : ''
  const headers = latin1RequestHeaders(request.headers, {
    host: target.host,
    cookie: aiRuntime.cookie,
    origin: aiRuntime.origin,
    'accept-encoding': 'identity',
    ...(asciiCwd ? { 'x-dsh-cwd': asciiCwd } : {}),
  })
  const method = request.method || 'GET'
  const sendUp = (body) => {
    if (body) headers['content-length'] = String(Buffer.byteLength(body))
    let up
    try {
      up = httpRequest({
        hostname: target.hostname,
        port: target.port,
        path,
        method,
        headers,
      }, (incoming) => {
        response.writeHead(incoming.statusCode || 200, outboundSemanticHeaders(incoming, response))
        pipeProxyStreams(incoming, response)
      })
    } catch {
      if (!response.headersSent) sendError(response, 502, 'semantic_proxy', '无法打开语义系统')
      return
    }
    up.on('error', () => {
      if (!response.headersSent) sendError(response, 502, 'semantic_proxy', '无法打开语义系统')
    })
    if (body) up.end(body)
    else pipeProxyStreams(request, up)
  }
  if (['POST', 'PUT', 'PATCH'].includes(method) && /json/i.test(String(request.headers['content-type'] || ''))) {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      let buf = Buffer.concat(chunks)
      if (queryCwd.startsWith('/')) {
        try {
          const json = JSON.parse(buf.toString('utf8'))
          if (json && typeof json === 'object' && !Array.isArray(json) && json.cwd == null) {
            json.cwd = queryCwd
            buf = Buffer.from(JSON.stringify(json))
          }
        } catch { /* 原样转发 */ }
      }
      sendUp(buf)
    })
    return
  }
  sendUp()
}

function proxyDsh(request, response, url) {
  if (!aiRuntime.origin || !aiRuntime.cookie) {
    sendError(response, 503, 'ai/not-connected', '核心未接通，无法打开 DSH 页面')
    return
  }
  const target = new URL(aiRuntime.origin)
  const path = dshProxyPath(url) || '/'
  const headers = { ...request.headers, host: target.host, cookie: aiRuntime.cookie, origin: aiRuntime.origin }
  headers['accept-encoding'] = 'identity'
  delete headers['if-none-match']
  delete headers['if-modified-since']
  delete headers.connection
  const up = httpRequest({
    hostname: target.hostname,
    port: target.port,
    path,
    method: request.method,
    headers,
  }, (incoming) => {
    const type = String(incoming.headers['content-type'] || '')
    const headersOut = outboundProxyHeaders(incoming)
    if (type.includes('text/html')) {
      const chunks = []
      incoming.on('data', (chunk) => chunks.push(chunk))
      incoming.on('end', () => {
        let html = Buffer.concat(chunks).toString('utf8')
        html = html.replace(/<base href="\/"\s*>/u, '<base href="/dsh-app/">')
        if (!html.includes('<base href="/dsh-app/">')) {
          html = html.replace('<head>', '<head><base href="/dsh-app/">')
        }
        if (!html.includes('data-fde-dsh-hook')) {
          html = html.replace('<head>', `<head>${FDE_DSH_OCCUPANCY_PATCH}${FDE_DSH_CLIPBOARD_PATCH}${FDE_DSH_HEAD_HOOK}`)
        }
        if (!html.includes('data-fde-dsh-strip')) {
          html = html.replace('</head>', `${FDE_DSH_STRIP_STYLE}</head>`)
        }
        const out = Buffer.from(html)
        delete headersOut['content-encoding']
        headersOut['content-length'] = String(out.length)
        headersOut['content-type'] = 'text/html; charset=utf-8'
        response.writeHead(incoming.statusCode || 200, headersOut)
        response.end(out)
      })
      return
    }
    response.writeHead(incoming.statusCode || 200, headersOut)
    pipeProxyStreams(incoming, response)
  })
  up.on('error', () => {
    if (!response.headersSent) sendError(response, 502, 'dsh_proxy', '无法打开 DSH 页面')
  })
  pipeProxyStreams(request, up)
}

function sessionRootOf() {
  return process.env.FDE_DSH_SESSION_ROOT || join(aiRuntime.dshHome, 'sessions')
}

const server = createServer(async (request, response) => {
  const currentCorrelationId = correlationId(request)
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`)

  if (request.method === 'OPTIONS') {
    const origin = request.headers.origin
    if (typeof origin === 'string' && !allowedOrigins.has(origin)) {
      response.writeHead(403, { 'Cache-Control': 'no-store' })
      response.end()
      return
    }
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type, X-Correlation-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      ...(typeof origin === 'string' ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    })
    response.end()
    return
  }

  if (url.pathname.startsWith('/subscriptions-auth/')) {
    sendJson(response, 200, { ok: true, correlationId: currentCorrelationId })
    return
  }

  if (requestTouchesSemanticOs(request)) {
    proxySemanticOs(request, response, url)
    return
  }

  if (shouldProxyDsh(url)) {
    proxyDsh(request, response, url)
    return
  }

  if (!bridgeToken) {
    bridgeToken = await ensureBridgeToken(aiRuntime.dshHome || FDE_DSH_HOME)
  }
  if (await handleBridgeRoutes(request, response, url, {
    db,
    bridgeToken,
    correlationId: currentCorrelationId,
    readJson,
    aiRuntime,
  })) return

  const writeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '')
  if (writeMethod) {
    const origin = request.headers.origin
    if (typeof origin !== 'string' || !allowedOrigins.has(origin)) {
      sendError(response, 403, 'origin_not_allowed', '当前页面来源不被允许', currentCorrelationId)
      return
    }
  }

  try {

    if (await handleEventsRoutes(request, response, url, {
      db,
      allowedOrigins,
      correlationId: currentCorrelationId,
      sendError,
      sendJson,
    })) return

    if (handleAiResultGet(request, response, url, {
      db,
      correlationId: currentCorrelationId,
      sendJson,
      sendError,
    })) return

    if (await handleContextPackRoute(request, response, url, {
      db,
      aiRuntime,
      readJson,
      correlationId: currentCorrelationId,
      sendError,
    })) return

    if (await handleSearchRoute(request, response, url, {
      db,
      aiRuntime,
      sendJson,
      sendError,
      correlationId: currentCorrelationId,
    })) return

    if (await handleCorpusRoute(request, response, url, {
      db,
      aiRuntime,
      correlationId: currentCorrelationId,
      sendJson,
    })) return

    if (await handleAppsRoutes(request, response, url, {
      db,
      aiRuntime,
      allowedOrigins,
      correlationId: currentCorrelationId,
      sendError,
      sendJson,
      readJson,
    })) return

    if (await handleBizRoutes(request, response, url, {
      db,
      aiRuntime,
      readJson,
      sendJson,
      sendError,
      correlationId: currentCorrelationId,
      stripSecrets,
      normalizeBaseUrl,
      exchangeNocoBaseToken,
      requestMemoryCwd,
    })) return

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/favicon.ico')) {
      if (url.pathname === '/favicon.ico' && !FDE_STATIC_DIR) {
        response.writeHead(204)
        response.end()
        return
      }
      if (FDE_STATIC_DIR && tryServeStatic(FDE_STATIC_DIR, request, response)) return
      if (url.pathname === '/favicon.ico') {
        response.writeHead(204)
        response.end()
        return
      }
      sendJson(response, 200, {
        service: 'fde-x-runtime',
        hint: `这是 API，不是页面。请打开 http://127.0.0.1:${FDE_WEB_PORT}`,
        health: '/health',
      })
      return
    }

    if (request.method === 'GET' && url.pathname === LIVE_PATH) {
      sendJson(response, 200, liveProbeBody())
      return
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      const [adapters, persistence] = await Promise.all([
        inspectAdapters({ aiRuntime }),
        Promise.resolve(databaseHealth(db, databasePath)),
      ])
      sendJson(response, 200, {
        service: 'fde-x-runtime',
        state: persistence.state,
        authority: {
          transactional: 'sqlite',
          semantic: 'semantic-service',
          externalRecords: 'source-system',
        },
        persistence,
        adapters,
        checkedAt: new Date().toISOString(),
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/runtime/config') {
      const home = aiRuntime.dshHome
      const official = FDE_OFFICIAL_DSH_HOME
      const sessionRoot = process.env.FDE_DSH_SESSION_ROOT || join(home, 'sessions')
      const officialSessions = join(official, 'sessions')
      const count = async (dir) => {
        try { return (await readdir(dir)).length } catch { return 0 }
      }
      let semantic = null
      try {
        if (aiRuntime.status().connected) semantic = await aiRuntime.semanticOs('/ready', { method: 'GET' })
      } catch (error) {
        semantic = { ready: false, detail: error instanceof Error ? error.message : String(error) }
      }
      sendJson(response, 200, {
        data: {
          ...aiRuntime.status(),
          officialHome: official,
          credentialsHome: join(home, '.credentials.yaml'),
          credentialsOfficial: join(official, '.credentials.yaml'),
          credentialsPresent: existsSync(join(home, '.credentials.yaml')) || existsSync(join(official, '.credentials.yaml')),
          sessionCount: await count(sessionRoot),
          officialSessionCount: await count(officialSessions),
          semantic,
        },
        correlationId: currentCorrelationId,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/runtime/attach-sessions') {
      const home = aiRuntime.dshHome
      const src = join(FDE_OFFICIAL_DSH_HOME, 'sessions')
      const dest = process.env.FDE_DSH_SESSION_ROOT || join(home, 'sessions')
      if (!existsSync(src)) {
        sendError(response, 404, 'not_found', '旧会话目录不存在（~/.dsh/sessions）', currentCorrelationId)
        return
      }
      await mkdir(dirname(dest), { recursive: true })
      await cp(src, dest, { recursive: true })
      sendJson(response, 200, { data: { ok: true, dest }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/ready') {
      let result = null
      let failed = false
      try {
        const got = await withProbeTimeout(aiRuntime.semanticOs('/ready', { method: 'GET' }), ENGINE_PROBE_MS)
        if (got && typeof got === 'object') result = got
        else failed = true
      } catch {
        failed = true
      }
      const kind = engineProbeKind(result, failed)
      if (kind === 'probe-failed') {
        sendJson(response, 200, { data: { probe: 'failed' }, correlationId: currentCorrelationId })
        return
      }
      if (kind === 'unready' && typeof aiRuntime.kickSemanticIfExited === 'function') {
        aiRuntime.kickSemanticIfExited(result)
      }
      try {
        const host = await readDshDefaultLlm(aiRuntime)
        result = enrichReadyWithLlm(result, host)
      } catch {
        /* sidecar snapshot stands */
      }
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/memory/retry-ready') {
      const result = await aiRuntime.semanticOs('/retry-ready', { method: 'POST', body: {} })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/settings') {
      const result = await aiRuntime.semanticOs('/settings', { method: 'GET' })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/memory/settings') {
      const body = await readJson(request)
      const result = await aiRuntime.semanticOs('/settings', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/ai/status') {
      sendJson(response, 200, {
        data: { ...aiRuntime.status(), bffOrigin: `http://${host}:${port}` },
        correlationId: currentCorrelationId,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/connect') {
      let status
      try {
        status = { ...await aiRuntime.start(), bffOrigin: `http://${host}:${port}` }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendError(response, 502, 'ai/boot-failed', message || '核心启动失败', currentCorrelationId)
        return
      }
      appendAudit(db, {
        workspaceId: 'ws_personal',
        actorId: 'actor_local_user',
        action: 'ai.runtime.connect',
        targetRef: 'fde://workstation/ai-runtime/core',
        outcome: 'succeeded',
        riskLevel: 'low',
        correlationId: currentCorrelationId,
        details: { pid: status.pid, version: status.version },
      })
      sendJson(response, 200, { data: status, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/shutdown') {
      try {
        appendAudit(db, {
          workspaceId: 'ws_personal',
          actorId: 'actor_local_user',
          action: 'ai.runtime.shutdown',
          targetRef: 'fde://workstation/ai-runtime/core',
          outcome: 'succeeded',
          riskLevel: 'low',
          correlationId: currentCorrelationId,
          details: {},
        })
      } catch { /* 审计失败仍要退出 */ }
      sendJson(response, 200, { data: { shuttingDown: true }, correlationId: currentCorrelationId })
      setTimeout(() => { void close() }, 100)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/reload') {
      const status = {
        ...aiRuntime.status(),
        restarting: true,
        bffOrigin: `http://${host}:${port}`,
      }
      try {
        appendAudit(db, {
          workspaceId: 'ws_personal',
          actorId: 'actor_local_user',
          action: 'ai.runtime.reload',
          targetRef: 'fde://workstation/ai-runtime/core',
          outcome: 'succeeded',
          riskLevel: 'low',
          correlationId: currentCorrelationId,
          details: { restarting: true },
        })
      } catch { /* 审计失败仍要重启 */ }
      sendJson(response, 200, { data: status, correlationId: currentCorrelationId })
      scheduleRuntimeRestart()
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/disconnect') {
      const status = await aiRuntime.stop()
      appendAudit(db, {
        workspaceId: 'ws_personal',
        actorId: 'actor_local_user',
        action: 'ai.runtime.disconnect',
        targetRef: 'fde://workstation/ai-runtime/core',
        outcome: 'succeeded',
        riskLevel: 'low',
        correlationId: currentCorrelationId,
        details: {},
      })
      sendJson(response, 200, { data: status, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/ai/models') {
      const catalog = await aiRuntime.call('session/modelCatalog')
      sendJson(response, 200, { data: catalog, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/ai/models-settings') {
      try {
        const snapshot = await fetchModelsSettingsSnapshot(aiRuntime, readSettingsProviderProfile)
        sendJson(response, 200, { data: snapshot, correlationId: currentCorrelationId })
      } catch (error) {
        sendError(response, 502, 'models_settings_failed', error instanceof Error ? error.message : String(error), currentCorrelationId)
      }
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/models-settings/mutate') {
      const body = await readJson(request)
      const ns = String(body.ns || '').trim()
      const ops = Array.isArray(body.ops) ? body.ops : []
      const expectedRevision = body.expectedRevision
      if (!ns || ops.length === 0) {
        sendError(response, 400, 'validation_error', '需要 ns 与非空 ops', currentCorrelationId)
        return
      }
      if (!aiRuntime.status().connected) {
        sendError(response, 503, 'core_disconnected', '核心未连接，无法 settings/mutate；请先连接或重载核心', currentCorrelationId)
        return
      }
      try {
        const view = await aiRuntime.rpc('settings/mutate', { ns, ops, expectedRevision })
        sendJson(response, 200, { data: { view }, correlationId: currentCorrelationId })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const code = /conflict/i.test(message) ? 'settings_conflict' : 'rpc_error'
        sendError(response, code === 'settings_conflict' ? 409 : 502, code, message, currentCorrelationId)
      }
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/models-settings/credential') {
      const body = await readJson(request)
      const ref = String(body.ref || '').trim()
      const value = String(body.value || '')
      const action = String(body.action || 'set')
      if (!ref) {
        sendError(response, 400, 'validation_error', '需要 ref', currentCorrelationId)
        return
      }
      const credPath = join(aiRuntime.dshHome, '.credentials.yaml')
      if (action === 'delete') {
        if (aiRuntime.status().connected) {
          try { await aiRuntime.rpc('credentials/delete', { ref }) } catch { /* file fallback */ }
        }
        removeCredentialRef(credPath, ref)
        sendJson(response, 200, { data: { ok: true, ref }, correlationId: currentCorrelationId })
        return
      }
      const keyIssue = validateApiKeyInput(value)
      if (keyIssue) {
        sendError(response, 400, 'validation_error', keyIssue === 'non_ascii' ? 'API 密钥须为可打印 ASCII' : 'API 密钥不能为空', currentCorrelationId)
        return
      }
      if (aiRuntime.status().connected) {
        try {
          await aiRuntime.rpc('credentials/set', { ref, value: value.trim() })
        } catch (error) {
          sendError(response, 502, 'rpc_error', error instanceof Error ? error.message : String(error), currentCorrelationId)
          return
        }
      }
      upsertCredentialRef(credPath, ref, value.trim())
      sendJson(response, 200, { data: { ok: true, ref, hint: maskSecret(value.trim()) }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/models-settings/apply') {
      const body = await readJson(request)
      const ns = String(body.ns || '').trim()
      const settingsPath = Array.isArray(body.settingsPath) ? body.settingsPath.map(String) : []
      const provider = String(body.provider || '').trim()
      let draft = body.draft && typeof body.draft === 'object' ? body.draft : {}
      const committedOriginal = body.committedOriginal
      const expectedRevision = body.expectedRevision
      const apiKey = String(body.apiKey || '')
      const keyRef = String(body.keyRef || providerKeyRef(provider)).trim()
      if (!ns || !provider) {
        sendError(response, 400, 'validation_error', '需要 ns 与 provider', currentCorrelationId)
        return
      }
      if (Array.isArray(draft.models)) {
        const profileHint = {
          baseURL: String(draft.baseURL || committedOriginal?.baseURL || '').trim(),
          api: String(draft.api || committedOriginal?.api || 'openai-completions').trim(),
        }
        const discovered = await discoverProviderModels(aiRuntime, profileHint, provider)
        draft = {
          ...draft,
          models: alignModelRowsWithDiscover(draft.models, discovered),
        }
      }
      const keyTrimmed = apiKey.trim()
      if (keyTrimmed) {
        const keyIssue = validateApiKeyInput(keyTrimmed)
        if (keyIssue) {
          sendError(response, 400, 'validation_error', keyIssue === 'non_ascii' ? 'API 密钥须为可打印 ASCII' : 'API 密钥无效', currentCorrelationId)
          return
        }
      }
      let view
      const ops = pathOps(settingsPath, committedOriginal, draft)
      if (ops.length > 0) {
        if (!aiRuntime.status().connected) {
          sendError(response, 503, 'core_disconnected', '核心未连接，无法保存设置', currentCorrelationId)
          return
        }
        try {
          view = await aiRuntime.rpc('settings/mutate', { ns, ops, expectedRevision })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const code = /conflict/i.test(message) ? 'settings_conflict' : 'rpc_error'
          sendError(response, code === 'settings_conflict' ? 409 : 502, code, message, currentCorrelationId)
          return
        }
      }
      if (keyTrimmed) {
        const credPath = join(aiRuntime.dshHome, '.credentials.yaml')
        try {
          if (aiRuntime.status().connected) await aiRuntime.rpc('credentials/set', { ref: keyRef, value: keyTrimmed })
          upsertCredentialRef(credPath, keyRef, keyTrimmed)
        } catch (error) {
          sendError(response, 502, 'rpc_error', error instanceof Error ? error.message : String(error), currentCorrelationId)
          return
        }
      }
      sendJson(response, 200, {
        data: {
          ok: true,
          view,
          hint: '已保存。若模型列表有变，请重载核心。',
        },
        correlationId: currentCorrelationId,
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/ai/providers') {
      const [registered, directory] = await Promise.all([
        aiRuntime.rpc('llm/listProviders', {}),
        aiRuntime.rpc('llm/listConfigurableProviders', {}),
      ])
      const active = new Set((Array.isArray(registered) ? registered : []).map((row) => row.id))
      const settingsFile = join(aiRuntime.dshHome, 'settings.yaml')
      const rows = (Array.isArray(directory) ? directory : []).map((entry) => ({
        kind: 'catalog',
        provider: String(entry.provider || ''),
        displayName: String(entry.displayName || entry.provider || ''),
        settingsNs: String(entry.settingsNs || ''),
        settingsPath: Array.isArray(entry.settingsPath) ? entry.settingsPath : [],
        active: active.has(entry.provider),
        keyRef: providerKeyRef(entry.provider),
      }))
      for (const item of (Array.isArray(registered) ? registered : [])) {
        if (rows.some((row) => row.provider === item.id)) continue
        const route = String(item.id || '')
        const profile = readSettingsProviderProfile(settingsFile, route)
        rows.push({
          kind: 'custom',
          provider: route,
          displayName: String(item.name || profile?.displayName || route),
          settingsNs: 'llm-pi-ai',
          settingsPath: ['providers', route],
          active: true,
          keyRef: providerKeyRef(route),
          ...(profile ? {
            profile: {
              displayName: profile.displayName,
              baseURL: profile.baseURL,
              api: profile.api,
              models: profile.models,
            },
          } : {}),
        })
      }
      const refs = [...new Set(rows.map((row) => row.keyRef).filter(Boolean))]
      let described = {}
      if (refs.length) {
        try { described = await aiRuntime.rpc('credentials/describe', { refs }) || {} } catch { described = {} }
      }
      const protocolChoices = await loadProtocolChoicesFromDescribe(aiRuntime)
      sendJson(response, 200, {
        data: {
          providers: rows.map((row) => ({
            ...row,
            configured: Boolean(described[row.keyRef]?.configured),
          })),
          registered: Array.isArray(registered) ? registered : [],
          protocolChoices,
        },
        correlationId: currentCorrelationId,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/providers/discover') {
      const body = await readJson(request)
      const baseURL = String(body.baseURL || '').trim().replace(/\/$/, '')
      const api = String(body.api || 'openai-completions').trim()
      const apiKey = String(body.apiKey || '').trim()
      const provider = String(body.provider || '').trim()
      if (!/^https?:\/\//.test(baseURL)) {
        sendError(response, 400, 'validation_error', '先填有效的 API 地址', currentCorrelationId)
        return
      }
      let models = []
      if (aiRuntime.status().connected) {
        try {
          const found = await aiRuntime.rpc('llm/discoverModels', {
            settingsNs: 'llm-pi-ai',
            request: {
              ...(provider ? { provider } : {}),
              baseURL,
              api,
              ...(apiKey ? { apiKey } : {}),
            },
          })
          if (Array.isArray(found)) models = found
        } catch {
          models = []
        }
      }
      if (models.length === 0) {
        const headers = { accept: 'application/json' }
        if (apiKey) headers.authorization = `Bearer ${apiKey}`
        const probe = await fetch(`${baseURL}/models`, { headers }).catch(() => null)
        const payload = probe ? await probe.json().catch(() => ({})) : {}
        const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : []
        models = rows.map((row) => ({
          id: String(row.id || row.name || ''),
          name: String(row.id || row.name || ''),
          ...modelCapacityFromDiscoverRow(row),
        })).filter((row) => row.id)
        if (!probe || !probe.ok) {
          sendError(response, probe?.status || 502, 'discover_failed', '没能从该地址拉到模型列表，请检查地址、协议和密钥', currentCorrelationId)
          return
        }
      }
      sendJson(response, 200, {
        data: {
          models: models.map((row) => ({
            id: String(row.id || ''),
            name: String(row.name || row.id || ''),
            ...(typeof row.contextWindow === 'number' ? { contextWindow: row.contextWindow } : {}),
            ...(typeof row.maxTokens === 'number' ? { maxTokens: row.maxTokens } : {}),
            ...(row.reasoningEfforts !== undefined ? { reasoningEfforts: row.reasoningEfforts } : {}),
          })).filter((row) => row.id),
        },
        correlationId: currentCorrelationId,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/providers') {
      const body = await readJson(request)
      const provider = String(body.provider || '').trim()
      const apiKey = String(body.apiKey || '').trim()
      if (!provider || !apiKey) {
        sendError(response, 400, 'validation_error', '提供方和 API 密钥不能为空', currentCorrelationId)
        return
      }
      const keyIssue = validateApiKeyInput(apiKey)
      if (keyIssue) {
        sendError(response, 400, 'validation_error', keyIssue === 'non_ascii' ? 'API 密钥须为可打印 ASCII' : 'API 密钥不能为空', currentCorrelationId)
        return
      }
      const keyRef = `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
      await aiRuntime.rpc('credentials/set', { ref: keyRef, value: apiKey })
      upsertCredentialRef(join(aiRuntime.dshHome, '.credentials.yaml'), keyRef, apiKey)
      sendJson(response, 200, { data: { ok: true, provider, keyRef, hint: maskSecret(apiKey) }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/providers/custom') {
      const body = await readJson(request)
      const route = String(body.route || '').trim()
      if (!PROVIDER_ROUTE_RE.test(route)) {
        sendError(response, 400, 'validation_error', '提供方 ID 用小写字母开头，只能含小写字母、数字和连字符', currentCorrelationId)
        return
      }
      const { profile, apiKey, keyRef } = buildCustomProviderProfile(body, route, null)
      if (!/^https?:\/\//.test(profile.baseURL) || profile.models.length === 0) {
        sendError(response, 400, 'validation_error', '自定义提供方需要有效的 API 地址和至少一个模型', currentCorrelationId)
        return
      }
      if (apiKey) {
        const keyIssue = validateApiKeyInput(apiKey)
        if (keyIssue) {
          sendError(response, 400, 'validation_error', keyIssue === 'non_ascii' ? 'API 密钥须为可打印 ASCII' : 'API 密钥无效', currentCorrelationId)
          return
        }
      }
      const { live, liveError } = await applyCustomProviderWrite(aiRuntime, route, profile, apiKey)
      sendJson(response, 200, {
        data: {
          ok: true,
          route,
          keyRef,
          live,
          hint: live ? '已写入正在运行的核心' : `已写入配置文件${liveError ? `（实时写入失败：${liveError}）` : ''}，请重新连接核心`,
        },
        correlationId: currentCorrelationId,
      })
      return
    }

    const providerKeyMatch = url.pathname.match(/^\/api\/v1\/ai\/providers\/([^/]+)\/key$/)
    if (providerKeyMatch) {
      const provider = decodeURIComponent(providerKeyMatch[1])
      const credPath = join(aiRuntime.dshHome, '.credentials.yaml')
      const keyRef = providerKeyRef(provider)
      if (request.method === 'PATCH') {
        const body = await readJson(request)
        const apiKey = String(body.apiKey || '').trim()
        if (!apiKey) {
          sendError(response, 400, 'validation_error', 'API 密钥不能为空', currentCorrelationId)
          return
        }
        const keyIssue = validateApiKeyInput(apiKey)
        if (keyIssue) {
          sendError(response, 400, 'validation_error', keyIssue === 'non_ascii' ? 'API 密钥须为可打印 ASCII' : 'API 密钥无效', currentCorrelationId)
          return
        }
        if (aiRuntime.status().connected) {
          try {
            await aiRuntime.rpc('credentials/set', { ref: keyRef, value: apiKey })
          } catch (error) {
            sendError(response, 502, 'rpc_error', error instanceof Error ? error.message : String(error), currentCorrelationId)
            return
          }
        }
        upsertCredentialRef(credPath, keyRef, apiKey)
        sendJson(response, 200, {
          data: { ok: true, provider, keyRef, hint: maskSecret(apiKey) },
          correlationId: currentCorrelationId,
        })
        return
      }
      if (request.method === 'DELETE') {
        if (aiRuntime.status().connected) {
          try {
            await aiRuntime.rpc('credentials/delete', { ref: keyRef })
          } catch {
            /* 部分核心无 delete，落盘清 ref 即可 */
          }
        }
        removeCredentialRef(credPath, keyRef)
        sendJson(response, 200, {
          data: { ok: true, provider, keyRef, hint: '密钥已清除，请重载核心后生效' },
          correlationId: currentCorrelationId,
        })
        return
      }
    }

    const customProviderMatch = url.pathname.match(/^\/api\/v1\/ai\/providers\/custom\/([^/]+)$/)
    if (customProviderMatch) {
      const route = decodeURIComponent(customProviderMatch[1])
      if (!PROVIDER_ROUTE_RE.test(route)) {
        sendError(response, 400, 'validation_error', '提供方 ID 无效', currentCorrelationId)
        return
      }
      const settingsFile = join(aiRuntime.dshHome, 'settings.yaml')
      const credPath = join(aiRuntime.dshHome, '.credentials.yaml')
      if (request.method === 'PATCH') {
        const body = await readJson(request)
        const existing = readSettingsProviderProfile(settingsFile, route)
        if (!existing) {
          sendError(response, 404, 'not_found', '找不到该自定义提供方', currentCorrelationId)
          return
        }
        const { profile, apiKey, keyRef } = buildCustomProviderProfile(body, route, existing)
        if (!/^https?:\/\//.test(profile.baseURL) || profile.models.length === 0) {
          sendError(response, 400, 'validation_error', '需要有效的 API 地址和至少一个模型', currentCorrelationId)
          return
        }
        if (apiKey) {
          const keyIssue = validateApiKeyInput(apiKey)
          if (keyIssue) {
            sendError(response, 400, 'validation_error', keyIssue === 'non_ascii' ? 'API 密钥须为可打印 ASCII' : 'API 密钥无效', currentCorrelationId)
            return
          }
        }
        const { live, liveError } = await applyCustomProviderWrite(aiRuntime, route, profile, apiKey)
        sendJson(response, 200, {
          data: {
            ok: true,
            route,
            keyRef,
            live,
            hint: live ? '已更新正在运行的核心' : `已写入配置文件${liveError ? `（实时写入失败：${liveError}）` : ''}，请重载核心`,
          },
          correlationId: currentCorrelationId,
        })
        return
      }
      if (request.method === 'DELETE') {
        let live = false
        let liveError = ''
        if (aiRuntime.status().connected) {
          try {
            await aiRuntime.rpc('settings/mutate', {
              ns: 'llm-pi-ai',
              ops: [{ op: 'unset', path: ['providers', route] }],
            })
            live = true
          } catch (error) {
            liveError = error instanceof Error ? error.message : String(error)
          }
        }
        const removed = removeSettingsProvider(settingsFile, route)
        const keyRef = providerKeyRef(route)
        if (aiRuntime.status().connected) {
          try { await aiRuntime.rpc('credentials/delete', { ref: keyRef }) } catch { /* file fallback */ }
        }
        removeCredentialRef(credPath, keyRef)
        if (!removed && !live) {
          sendError(response, 404, 'not_found', '找不到该自定义提供方', currentCorrelationId)
          return
        }
        sendJson(response, 200, {
          data: {
            ok: true,
            route,
            live,
            hint: live ? '已从核心移除，请重载核心' : `已从配置文件移除${liveError ? `（实时删除失败：${liveError}）` : ''}，请重载核心`,
          },
          correlationId: currentCorrelationId,
        })
        return
      }
    }

    if (await handlePresetRoutes(request, response, url, {
      aiRuntime, db, currentCorrelationId, sendJson, sendError, readJson,
    })) return

    if (request.method === 'GET' && url.pathname === '/api/v1/ai/credentials') {
      const filePath = join(aiRuntime.dshHome, '.credentials.yaml')
      const refs = readCredentialRefs(filePath)
      sendJson(response, 200, {
        data: {
          path: filePath,
          keys: Object.keys(refs).sort().map((name) => ({
            name,
            present: Boolean(refs[name]),
            hint: maskSecret(refs[name]),
          })),
        },
        correlationId: currentCorrelationId,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/credentials') {
      const body = await readJson(request)
      const name = String(body.name || '').trim()
      const value = String(body.value || '').trim()
      if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(name) || !value) {
        sendError(response, 400, 'validation_error', '钥匙名用大写环境变量，值不能为空', currentCorrelationId)
        return
      }
      const filePath = join(aiRuntime.dshHome, '.credentials.yaml')
      upsertCredentialRef(filePath, name, value)
      sendJson(response, 200, { data: { ok: true, name, hint: maskSecret(value) }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/deps') {
      const cwd = url.searchParams.get('cwd') || ''
      const result = await aiRuntime.semanticOs('/deps', { method: 'GET', ...(cwd.startsWith('/') ? { cwd } : {}) })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/usage') {
      const result = await aiRuntime.semanticOs('/usage', { method: 'GET' })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/session-ingest') {
      const result = await aiRuntime.semanticOs('/session-ingest', { method: 'GET' })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/memory/session-ingest') {
      const result = await aiRuntime.semanticOs('/session-ingest/now', { method: 'POST', body: {} })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/memory/deps') {
      const result = await aiRuntime.semanticOs('/deps', { method: 'POST', body: {} })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/people') {
      const result = await aiRuntime.semanticOs('/people', { method: 'GET' })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/memory/people') {
      const body = await readJson(request)
      const result = await aiRuntime.semanticOs('/people', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/ai/workspaces') {
      const baseline = await readWorkspaceBaseline()
      sendJson(response, 200, { data: { items: baseline.items, archivedSessionIds: baseline.archivedSessionIds }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/workspaces/pick') {
      if (String(request.headers['x-fde-desktop'] || '') === '1') {
        sendError(response, 501, 'use_desktop_picker', '请使用桌面版目录选择器', currentCorrelationId)
        return
      }
      const picked = await pickLocalDirectory()
      if (picked?.unavailable) {
        sendError(response, 501, 'dir_picker_unavailable', '本机目录选择器不可用（非 macOS 或未集成原生对话框）', currentCorrelationId)
        return
      }
      const path = picked?.path ?? null
      if (!path) {
        sendJson(response, 200, { data: { path: null }, correlationId: currentCorrelationId })
        return
      }
      sendJson(response, 200, { data: { path }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/workspaces') {
      const body = await readJson(request)
      const path = String(body.path || '').trim()
      const title = String(body.title || '').trim()
      if (!path || !path.startsWith('/')) {
        sendError(response, 400, 'validation_error', '需要本机绝对路径，例如 /home/你/项目 或 C:\\Users\\你\\项目', currentCorrelationId)
        return
      }
      const created = await aiRuntime.call('workspace/create', { request: { path } })
      const workspace = created?.workspace || created
      const workspaceId = String(workspace?.workspaceId || '')
      if (title && workspaceId) {
        try {
          await aiRuntime.call('workspace/rename', { request: { workspaceId, title } })
        } catch { /* 名称失败不挡创建 */ }
      }
      sendJson(response, 200, {
        data: {
          workspaceId,
          path: String(workspace?.path || path),
          title: title || String(workspace?.title || ''),
          created: created?.created !== false,
        },
        correlationId: currentCorrelationId,
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/ai/sessions') {
      const cursor = url.searchParams.get('cursor') ?? undefined
      const includeBlank = url.searchParams.get('includeBlank') === 'true'
      const includeSubagents = url.searchParams.get('includeSubagents') === 'true'
      const includeArchived = url.searchParams.get('includeArchived') === 'true'
      const [sessions, baseline] = await Promise.all([
        aiRuntime.call('session/list', { _request: cursor ? { cursor } : {} }),
        readWorkspaceBaseline(),
      ])
      const archived = new Set(baseline.archivedSessionIds)
      const items = Array.isArray(sessions?.items)
        ? sessions.items
          .map((row) => ({
            ...toAiSessionSummary(row),
            ...(archived.has(row.sessionId) ? { archived: true } : {}),
          }))
          .filter((item) => (includeArchived ? item.archived : !archived.has(item.sessionId)) && (includeBlank || !item.blank) && (includeSubagents || !isSubagentSession(item)))
        : []
      sendJson(response, 200, { data: { items }, correlationId: currentCorrelationId })
      return
    }

    const aiSessionGetMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)$/)
    if (request.method === 'GET' && aiSessionGetMatch) {
      const sessionId = decodeURIComponent(aiSessionGetMatch[1])
      const sessions = await aiRuntime.call('session/list', { _request: {} })
      const items = Array.isArray(sessions?.items) ? sessions.items : []
      const item = items.find((row) => row.sessionId === sessionId)
      if (!item) {
        sendError(response, 404, 'not_found', '会话不存在', currentCorrelationId)
        return
      }
      sendJson(response, 200, { data: toAiSessionSummary(item), correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/sessions') {
      const body = await readJson(request)
      const bound = parseSessionBind(body)
      if (!bound.ok) {
        sendError(response, 400, 'validation_error', bound.code === 'both' ? SESSION_BIND_BOTH : SESSION_BIND_MISSING, currentCorrelationId)
        return
      }
      const workspaceId = bound.workspaceId
      const cwd = bound.cwd
      const requestBody = {
        ...(workspaceId ? { workspaceId } : {}),
        ...(cwd ? { cwd } : {}),
        ...(typeof body.sessionId === 'string' && body.sessionId ? { sessionId: body.sessionId } : {}),
        ...(typeof body.agentPreset === 'string' && body.agentPreset ? { agentPreset: body.agentPreset } : {}),
      }
      const session = await aiRuntime.call('session/create', { request: requestBody })
      if (workspaceId && session?.sessionId) {
        try {
          await aiRuntime.call('workspace/insertSessionBefore', { request: { workspaceId, sessionId: session.sessionId } })
        } catch { /* attach 失败时 session 仍可能已绑上 */ }
      }
      try {
        ensureWorkspace(db, { id: 'ws_personal', name: 'FDE-X', actorId: 'actor_local_user', correlationId: currentCorrelationId })
        appendAudit(db, {
          workspaceId: 'ws_personal',
          actorId: 'actor_local_user',
          action: 'ai.session.create',
          targetRef: `fde://ai/session/${session.sessionId}`,
          outcome: 'succeeded',
          riskLevel: 'low',
          correlationId: currentCorrelationId,
          details: { dshWorkspaceId: workspaceId, cwd },
        })
      } catch { /* 审计失败不能把已创建的会话打成失败 */ }
      if (session?.sessionId) {
        emit('ai.session.changed', { sessionId: session.sessionId, kind: 'created' }, {
          workspaceCwd: cwd || null,
          sessionId: session.sessionId,
        })
      }
      sendJson(response, 201, { data: session, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/sessions/restore') {
      const body = await readJson(request)
      const bound = parseSessionBind(body)
      if (!bound.ok) {
        sendError(response, 400, 'validation_error', bound.code === 'both' ? SESSION_RESTORE_BOTH : SESSION_RESTORE_MISSING, currentCorrelationId)
        return
      }
      const workspaceId = bound.workspaceId
      const cwd = bound.cwd
      const rows = Array.isArray(body.sessions) ? body.sessions : []
      if (!rows.length) {
        sendError(response, 400, 'validation_error', '交接包里没有可复原的会话文件', currentCorrelationId)
        return
      }
      const restored = []
      const warnings = []
      for (const row of rows) {
        const files = Array.isArray(row?.files) ? row.files : []
        if (!files.length) continue
        const created = await aiRuntime.call('session/create', {
          request: {
            ...(workspaceId ? { workspaceId } : {}),
            ...(cwd ? { cwd } : {}),
          },
        })
        const sid = String(created?.sessionId || '')
        if (!sid) throw new Error('没建成可复原的会话')
        if (workspaceId) {
          try {
            await aiRuntime.call('workspace/insertSessionBefore', { request: { workspaceId, sessionId: sid } })
          } catch (error) {
            warnings.push(`会话 ${sid} 未能挂到工作区：${error instanceof Error ? error.message : String(error)}`)
          }
        }
        let dir = await findSessionDir(sessionRootOf(), sid)
        if (!dir) {
          await new Promise((wait) => setTimeout(wait, 200))
          dir = await findSessionDir(sessionRootOf(), sid)
        }
        if (!dir) throw new Error('会话目录还没出现，文件写不进去')
        const liveCwd = restoreWriteRoot(body, created, cwd)
        const written = await writeSessionTree({
          parentDir: dir,
          files,
          members: Array.isArray(row?.members) ? row.members : [],
          cwd: liveCwd,
          createdId: sid,
          sourceId: String(row?.sessionId || '').trim(),
        })
        if (Array.isArray(written?.warnings)) warnings.push(...written.warnings)
        const title = String(row?.title || '').trim()
        restored.push({ sessionId: sid, title: title || sid })
      }
      if (!restored.length) {
        sendError(response, 400, 'validation_error', '交接包里的会话文件都不能写', currentCorrelationId)
        return
      }
      try {
        await aiRuntime.reload()
      } catch (error) {
        sendError(response, 502, 'ai/boot-failed', error instanceof Error ? error.message : '会话已写入，但核心没重新读起来', currentCorrelationId)
        return
      }
      for (const row of restored) {
        if (row.title && row.title !== row.sessionId) {
          try {
            await aiRuntime.call('session/rename', { request: { sessionId: row.sessionId, title: row.title } })
          } catch (error) {
            warnings.push(`会话 ${row.sessionId} 标题没改成功：${error instanceof Error ? error.message : String(error)}`)
          }
        }
        emit('ai.session.changed', { sessionId: row.sessionId, title: row.title, kind: 'restored' }, {
          workspaceCwd: cwd || null,
          sessionId: row.sessionId,
        })
      }
      sendJson(response, 200, { data: { sessions: restored, ...(warnings.length ? { warnings } : {}) }, correlationId: currentCorrelationId })
      return
    }

    const aiExportMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/export$/)
    if (request.method === 'GET' && aiExportMatch) {
      const sessionId = decodeURIComponent(aiExportMatch[1])
      try {
        const bundle = await readSessionTree(sessionRootOf(), sessionId)
        sendJson(response, 200, { data: bundle, correlationId: currentCorrelationId })
      } catch (error) {
        const message = error instanceof Error ? error.message : '导不出这个会话'
        sendError(response, 404, 'not_found', message, currentCorrelationId)
      }
      return
    }

    const aiArchiveMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/archive$/)
    if (request.method === 'POST' && aiArchiveMatch) {
      const archivedId = decodeURIComponent(aiArchiveMatch[1])
      const archived = await aiRuntime.call('workspace/archiveSession', {
        request: { sessionId: archivedId },
      })
      emit('ai.session.changed', { sessionId: archivedId, kind: 'deleted' }, { sessionId: archivedId })
      sendJson(response, 200, { data: archived, correlationId: currentCorrelationId })
      return
    }

    const aiForkMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/fork$/)
    if (request.method === 'POST' && aiForkMatch) {
      sendError(response, 409, 'session_owned_by_ui', '会话写锁由工作台 DSH 页占用，请在会话列表里分叉', currentCorrelationId)
      return
    }

    const aiFollowMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/follow$/)
    if (request.method === 'GET' && aiFollowMatch) {
      sendError(response, 409, 'session_owned_by_ui', '会话写锁由工作台 DSH 页占用，禁止 4318 再 follow', currentCorrelationId)
      return
    }

    const aiRenameMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/rename$/)
    if (request.method === 'POST' && aiRenameMatch) {
      const body = await readJson(request)
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        sendError(response, 400, 'validation_error', '会话名称不能为空', currentCorrelationId)
        return
      }
      const renamedId = decodeURIComponent(aiRenameMatch[1])
      const renamed = await aiRuntime.call('session/rename', {
        request: { sessionId: renamedId, title: body.title.trim() },
      })
      emit('ai.session.changed', { sessionId: renamedId, title: body.title.trim(), kind: 'renamed' }, { sessionId: renamedId })
      sendJson(response, 200, { data: renamed, correlationId: currentCorrelationId })
      return
    }

    const aiModelMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/model$/)
    if (request.method === 'POST' && aiModelMatch) {
      sendError(response, 409, 'session_owned_by_ui', '会话写锁由工作台 DSH 页占用，请在 DSH 里改模型', currentCorrelationId)
      return
    }

    const aiAttachMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/attachments$/)
    if (request.method === 'POST' && aiAttachMatch) {
      const body = await readJson(request)
      if (typeof body.data !== 'string' || !body.data) {
        sendError(response, 400, 'validation_error', '附件内容不能为空', currentCorrelationId)
        return
      }
      const uploaded = await aiRuntime.call('fileUploads/upload', {
        agentId: decodeURIComponent(aiAttachMatch[1]),
        request: {
          data: body.data,
          ...(typeof body.name === 'string' && body.name ? { name: body.name } : {}),
        },
      })
      sendJson(response, 201, { data: uploaded, correlationId: currentCorrelationId })
      return
    }

    const aiPromptMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/prompt$/)
    if (request.method === 'POST' && aiPromptMatch) {
      const body = await readJson(request)
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) {
        sendError(response, 400, 'validation_error', 'prompt 不能为空', currentCorrelationId)
        return
      }
      const mode = body.mode === 'steer' ? 'steer' : 'queue'
      const requestId = typeof body.requestId === 'string' && body.requestId.trim()
        ? body.requestId.trim()
        : crypto.randomUUID()
      const fileParts = Array.isArray(body.receiptIds)
        ? body.receiptIds.filter((id) => typeof id === 'string' && id).map((receiptId) => ({ type: 'file', receiptId }))
        : []
      await aiRuntime.call('session/prompt', {
        request: {
          requestId,
          sessionId: decodeURIComponent(aiPromptMatch[1]),
          mode,
          content: [{ type: 'text', text }, ...fileParts],
          ...(typeof body.clientTimeZone === 'string' && body.clientTimeZone
            ? { clientTimeZone: body.clientTimeZone }
            : {}),
        },
      })
      sendJson(response, 200, { data: { accepted: true, requestId }, correlationId: currentCorrelationId })
      return
    }
    const aiPresetMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/preset$/)
    if (request.method === 'POST' && aiPresetMatch) {
      const body = await readJson(request)
      if (typeof body.agentPreset !== 'string' || !body.agentPreset.trim()) {
        sendError(response, 400, 'validation_error', 'agentPreset 不能为空', currentCorrelationId)
        return
      }
      const selected = await aiRuntime.call('agentPresets/select', {
        agentId: decodeURIComponent(aiPresetMatch[1]),
        agentPreset: body.agentPreset.trim(),
      })
      sendJson(response, 200, { data: { agentPreset: selected }, correlationId: currentCorrelationId })
      return
    }

    const aiCommandsMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/commands$/)
    if (request.method === 'GET' && aiCommandsMatch) {
      const commands = await aiRuntime.call('commands/list', { agentId: decodeURIComponent(aiCommandsMatch[1]) })
      sendJson(response, 200, { data: commands, correlationId: currentCorrelationId })
      return
    }
    if (request.method === 'POST' && aiCommandsMatch) {
      const body = await readJson(request)
      const line = typeof body.line === 'string' ? body.line.trim() : ''
      if (!line) {
        sendError(response, 400, 'validation_error', '命令不能为空', currentCorrelationId)
        return
      }
      const result = await aiRuntime.call('commands/execute', {
        agentId: decodeURIComponent(aiCommandsMatch[1]),
        line,
        submittedAttachments: [],
      })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    const aiPermissionMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/permission$/)
    if (request.method === 'POST' && aiPermissionMatch) {
      const body = await readJson(request)
      if (typeof body.preset !== 'string' || !body.preset.trim()) {
        sendError(response, 400, 'validation_error', '权限档不能为空', currentCorrelationId)
        return
      }
      const result = await aiRuntime.call('commands/execute', {
        agentId: decodeURIComponent(aiPermissionMatch[1]),
        line: `/permission ${body.preset.trim()}`,
        submittedAttachments: [],
      })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/ai/skills') {
      const bag = await collectBag(aiRuntime, 'skill', {})
      sendJson(response, 200, { data: bag.raw || { items: bag.items }, correlationId: currentCorrelationId })
      return
    }

    const aiSkillsMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/skills$/)
    if (request.method === 'GET' && aiSkillsMatch) {
      const bag = await collectBag(aiRuntime, 'skill', { sessionId: decodeURIComponent(aiSkillsMatch[1]) })
      sendJson(response, 200, { data: bag.raw || { items: bag.items }, correlationId: currentCorrelationId })
      return
    }

    const aiApprovalMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/approval$/)
    if (request.method === 'POST' && aiApprovalMatch) {
      const body = await readJson(request)
      const decided = await aiRuntime.decideApproval(decodeURIComponent(aiApprovalMatch[1]), body.outcome)
      sendJson(response, 200, { data: decided, correlationId: currentCorrelationId })
      return
    }

    const aiCancelMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/cancel$/)
    if (request.method === 'POST' && aiCancelMatch) {
      const cancelBody = await readJson(request).catch(() => ({}))
      const cancelKind = String(cancelBody?.kind || cancelBody?.reason || '').trim()
      const receipt = await aiRuntime.call('session/cancel', {
        request: {
          sessionId: aiCancelMatch[1],
          ...(cancelKind ? { kind: cancelKind } : {}),
        },
      })
      sendJson(response, 200, { data: receipt, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/search') {
      const query = url.searchParams.get('q') || ''
      const cwd = requestMemoryCwd(url)
      const result = await aiRuntime.semanticOs('/find', { query, ...(cwd ? { cwd } : {}) })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/health') {
      const cwd = requestMemoryCwd(url)
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0)
      const dupOffset = Math.max(0, Number(url.searchParams.get('dup_offset') || 0) || 0)
      const health = await aiRuntime.semanticOs('/python', {
        op: 'memory_health',
        args: { limit: HEALTH_PAGE, offset },
        ...(cwd ? { cwd } : {}),
      })
      if (health && typeof health === 'object' && health.error) {
        sendError(response, 502, 'memory_error', String(health.hint || health.error || '梳理失败'), currentCorrelationId)
        return
      }
      const dups = await aiRuntime.semanticOs('/python', {
        op: 'enrich_dedup',
        args: { threshold: 0.95 },
        ...(cwd ? { cwd } : {}),
      }).catch(() => ({ duplicates: [] }))
      const namedIds = collectHealthCardIds(health, dupIssuesFromEnrich(dups))
      const loaded = await loadNamedCards(aiRuntime, cwd, namedIds)
      const originMap = memoryWriteOriginByCardIds(db, namedIds.concat([...loaded.keys()]))
      const cardById = new Map([...loaded].map(([id, row]) => [id, attachCardOrigin(row, originMap)]))
      const sheet = buildHealthSheet({
        health,
        dups: liveDuplicateBag(dups, cardById),
        originMap,
        offset,
        dupOffset,
        page: HEALTH_PAGE,
      })
      const groups = await attachCuesOnGroups(
        sheet.groups,
        (origin) => loadOrigin({ db, aiRuntime, cwd }, origin),
        originMap,
        cardById,
      )
      sendJson(response, 200, { data: { ...sheet, groups }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/memory/health/act') {
      const body = await readJson(request)
      const cwd = requestMemoryCwd(url, body)
      const plan = healthWritePlan(body)
      if (plan.error === 'nodded') {
        sendError(response, 400, 'validation_error', '梳理需要 nodded=true', currentCorrelationId)
        return
      }
      if (plan.error === 'unknown_op') {
        sendError(response, 400, 'validation_error', '不认识的梳理动作', currentCorrelationId)
        return
      }
      if (plan.error) {
        sendError(response, 400, 'validation_error', plan.error === 'NOT_A_SESSION' ? '出处只写会话或文件' : '梳理参数不完整', currentCorrelationId)
        return
      }
      const runPython = async (op, args) => aiRuntime.semanticOs('/python', {
        op,
        args,
        ...(cwd ? { cwd } : {}),
      })
      if (plan.pythonEach) {
        const rows = []
        for (const id of plan.ids) {
          const result = await runPython(plan.pythonEach, { id, nodded: true })
          if (result && typeof result === 'object' && result.error) {
            sendError(response, 502, 'memory_error', String(result.hint || result.error || '梳理写入失败'), currentCorrelationId)
            return
          }
          rows.push(result)
        }
        sendJson(response, 200, { data: { ok: true, rows }, correlationId: currentCorrelationId })
        return
      }
      if (plan.python) {
        const result = await runPython(plan.python, plan.args)
        if (result && typeof result === 'object' && result.error) {
          sendError(response, 502, 'memory_error', String(result.hint || result.error || '梳理写入失败'), currentCorrelationId)
          return
        }
        sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
        return
      }
      if (plan.path) {
        const result = await aiRuntime.semanticOs(plan.path, {
          method: 'POST',
          cwd,
          body: { ...plan.body, ...(cwd ? { cwd } : {}) },
        })
        if (result && typeof result === 'object' && (result.error || result.ok === false)) {
          sendError(response, 502, 'memory_error', String(result.hint || result.error || '梳理写入失败'), currentCorrelationId)
          return
        }
        sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
        return
      }
      sendError(response, 400, 'validation_error', '梳理动作空', currentCorrelationId)
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/cards') {
      const cwd = requestMemoryCwd(url)
      const includeFiled = url.searchParams.get('include_filed') === 'true'
      const result = await aiRuntime.semanticOs('/python', {
        op: 'list_memory_cards',
        args: { include_filed: includeFiled, limit: 80 },
        ...(cwd ? { cwd } : {}),
      })
      const listed = Array.isArray(result?.cards) ? result.cards : []
      const originMap = memoryWriteOriginByCardIds(db, listed.map((card) => card && card.id))
      const cards = await attachCuesOnCards(
        collapseCueCards(listed.map((card) => attachCardOrigin(card, originMap))),
        (origin) => loadOrigin({ db, aiRuntime, cwd }, origin),
      )
      sendJson(response, 200, { data: { ...result, cards }, correlationId: currentCorrelationId })
      return
    }

    const memoryCardNodMatch = /^\/api\/v1\/memory\/cards\/([^/]+)\/nod$/u.exec(url.pathname)
    if (request.method === 'POST' && memoryCardNodMatch) {
      const body = await readJson(request)
      if (body.nodded !== true) {
        sendError(response, 400, 'validation_error', '点头入档需要 nodded=true', currentCorrelationId)
        return
      }
      const cardId = decodeURIComponent(memoryCardNodMatch[1])
      const cwd = requestMemoryCwd(url, body)
      const result = await aiRuntime.semanticOs('/python', {
        op: 'nod_memory_card',
        args: { id: cardId, nodded: true },
        ...(cwd ? { cwd } : {}),
      })
      if (result && typeof result === 'object' && result.error) {
        sendError(response, 502, 'memory_error', String(result.hint || result.error || '点头入档失败'), currentCorrelationId)
        return
      }
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/memory/cards') {
      const body = await readJson(request)
      const label = typeof body.label === 'string' ? body.label.trim() : ''
      const origin = typeof body.origin === 'string' ? body.origin.trim() : ''
      if (!label && !instanceOriginOf(origin)) {
        sendError(response, 400, 'validation_error', '记忆正文不能为空', currentCorrelationId)
        return
      }
      if (label && !validateMemoryCardLabel(label) && !instanceOriginOf(origin)) {
        sendError(response, 400, 'validation_error', '记忆正文至少 8 个有效字符', currentCorrelationId)
        return
      }
      const cwd = requestMemoryCwd(url, body)
      const drafted = await draftCard({ db, aiRuntime }, {
        cwd,
        origin,
        cause: body.cause === 'choice' ? 'choice' : 'correction',
        label,
        auto: false,
        ...(typeof body.sessionId === 'string' && body.sessionId.trim() ? { sessionId: body.sessionId.trim() } : {}),
      })
      if (drafted.skipped) {
        sendError(response, 503, 'memory_error', drafted.reason === 'semantic_down' ? '记忆引擎未就绪' : '起草被跳过', currentCorrelationId)
        return
      }
      if (!drafted.ok) {
        const err = drafted.error && typeof drafted.error === 'object' ? drafted.error : {}
        sendError(response, 502, 'memory_error', String(err.hint || err.error || '起草失败'), currentCorrelationId)
        return
      }
      sendJson(response, 200, { data: drafted.card || asDraftCard({ id: drafted.cardId }, label), correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/im/state') {
      const state = await aiRuntime.lanAssist('/state', { search: { sessionId: url.searchParams.get('sessionId') || '' } })
      sendJson(response, 200, { data: state, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/attach/copy') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/attach/copy', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/im/attach') {
      const file = await aiRuntime.lanAssist('/attach', {
        search: {
          requestId: url.searchParams.get('requestId') || '',
          index: url.searchParams.get('index') || '0',
        },
      })
      sendJson(response, 200, { data: file, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/im/thread') {
      const thread = await aiRuntime.lanAssist('/thread', {
        search: {
          peerId: url.searchParams.get('peerId') || '',
          groupId: url.searchParams.get('groupId') || '',
          requestId: url.searchParams.get('requestId') || '',
        },
      })
      sendJson(response, 200, { data: thread, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/reply') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/reply', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/draft') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/reply/draft', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/presend/cancel') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/presend/cancel', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/send') {
      const body = await readJson(request)
      await aiRuntime.lanAssist('/sleep', { method: 'POST', body: { on: false } }).catch(() => undefined)
      const result = await aiRuntime.lanAssist('/send', { method: 'POST', body })
      const requestId = String(body.requestId || result?.requestId || result?.id || '')
      if (result?.ok !== false && requestId) {
        emit('im.message.sent', { requestId }, { source: 'bff' })
      }
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/sleep') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/sleep', { method: 'POST', body: { on: body.on !== false } })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/withdraw') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/withdraw', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/read') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/read', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/shout') {
      const result = await aiRuntime.lanAssist('/shout', { method: 'POST', body: {} })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/compose') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/compose', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/place') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/place', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/peer') {
      const body = await readJson(request)
      const peerId = String(body.peerId || '')
      if (body.note != null) await aiRuntime.lanAssist('/note', { method: 'POST', body: { peerId, note: body.note } })
      if (body.door != null) await aiRuntime.lanAssist('/door', { method: 'POST', body: { peerId, door: body.door } })
      if (body.pin != null || body.mute != null) {
        await aiRuntime.lanAssist('/peer/flags', { method: 'POST', body: { peerId, pin: body.pin, mute: body.mute } })
      }
      const state = await aiRuntime.lanAssist('/state', { search: { sessionId: '' } })
      sendJson(response, 200, { data: state, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/pair/mint') {
      const result = await aiRuntime.lanAssist('/pair/mint', { method: 'POST', body: {} })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/pair/handshake') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/pair/handshake', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/pair/accept') {
      const result = await aiRuntime.lanAssist('/pair/accept', { method: 'POST', body: {} })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/pair/reject') {
      const result = await aiRuntime.lanAssist('/pair/reject', { method: 'POST', body: {} })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/profile') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/name', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/group') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/group/create', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/group/update') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/group/update', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/group/dissolve') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/group/dissolve', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/im/unpair') {
      const body = await readJson(request)
      const result = await aiRuntime.lanAssist('/unpair', { method: 'POST', body })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'DELETE' && url.pathname === '/api/v1/files') {
      const name = String(url.searchParams.get('name') || '').trim()
      if (!name || name.includes('..') || name.includes('/') || name.includes('\\') || name.includes('\0')) {
        sendError(response, 400, 'validation_error', '文件名不合法', currentCorrelationId)
        return
      }
      const root = await resolveFileRoot(url.searchParams.get('sessionId'))
      const target = resolve(join(root, name))
      if (target !== root && !target.startsWith(root + sep)) {
        sendError(response, 400, 'validation_error', '路径越出工作区', currentCorrelationId)
        return
      }
      await unlink(target)
      sendJson(response, 200, { data: { path: name }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/files/mkdir') {
      const body = await readJson(request)
      const name = safeWorkspaceRel(body.name)
      if (!name) {
        sendError(response, 400, 'validation_error', '目录名不合法', currentCorrelationId)
        return
      }
      const root = await resolveFileRoot(body.sessionId)
      const target = resolve(join(root, name))
      if (target !== root && !target.startsWith(root + sep)) {
        sendError(response, 400, 'validation_error', '路径越出工作区', currentCorrelationId)
        return
      }
      await mkdir(target, { recursive: true })
      sendJson(response, 201, { data: { path: name }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/files') {
      const body = await readJson(request)
      const name = safeWorkspaceRel(body.name)
      const data = typeof body.data === 'string' ? body.data : ''
      if (!name || !data) {
        sendError(response, 400, 'validation_error', '文件名不合法', currentCorrelationId)
        return
      }
      const root = await resolveFileRoot(body.sessionId)
      try {
        const written = await writeWorkspaceDocument({
          db,
          dshHome: aiRuntime.dshHome,
          root,
          relPath: name,
          bytes: Buffer.from(data, 'base64'),
          note: '保存前',
        })
        sendJson(response, 201, { data: written, correlationId: currentCorrelationId })
      } catch (error) {
        sendError(response, 400, 'validation_error', error instanceof Error ? error.message : '写入失败', currentCorrelationId)
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/files') {
      const rel = url.searchParams.get('path') || '.'
      const sessionId = url.searchParams.get('sessionId')
      if (rel.includes('\0') || rel.split(/[\\/]/u).includes('..')) {
        sendError(response, 400, 'validation_error', '路径不合法', currentCorrelationId)
        return
      }
      if (sessionId) {
        try {
          const bag = await collectBag(aiRuntime, 'file', { sessionId, path: rel })
          const listing = bag.raw || { path: rel, entries: bag.items.map((row) => ({ name: row.title, type: row.fields?.type || 'file' })) }
          sendJson(response, 200, { data: listing, correlationId: currentCorrelationId })
          return
        } catch (error) {
          const raw = error instanceof Error ? error.message : '列出工作区文件失败'
          const message = /permission denied|EPERM/i.test(raw)
            ? '系统不允许读取该工作区目录（位于「文稿」）。请用「终端.app」启动 ./runtime/start.sh，而不是从 Cursor/IDE 内置终端启动。'
            : raw
          sendError(response, 502, 'files_list_failed', message, currentCorrelationId)
          return
        }
      }
      const cwdParam = url.searchParams.get('cwd')
      const root = cwdParam && cwdParam.startsWith('/')
        ? resolve(cwdParam)
        : resolve(aiRuntime.cwd)
      const runtimeRoot = resolve(aiRuntime.cwd)
      if (root !== runtimeRoot && !root.startsWith(runtimeRoot + sep)) {
        sendError(response, 403, 'path_forbidden', '该工作区目录 4318 读不了（系统权限）。请先在这个工作区开一条 AI 会话，再打开文件页。', currentCorrelationId)
        return
      }
      const target = resolve(join(root, rel))
      if (target !== root && !target.startsWith(root + sep)) {
        sendError(response, 400, 'validation_error', '路径越出工作区', currentCorrelationId)
        return
      }
      try {
        const dirents = await readdir(target, { withFileTypes: true })
        const entries = []
        for (const dirent of dirents) {
          if (dirent.name.startsWith('.')) continue
          entries.push({
            name: dirent.name,
            type: dirent.isDirectory() ? 'directory' : dirent.isFile() ? 'file' : 'other',
          })
        }
        sendJson(response, 200, { data: { path: rel, entries }, correlationId: currentCorrelationId })
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        const message = code === 'EPERM'
          ? '本机权限不允许 4318 读取该目录。请用已绑定该目录的 AI 会话打开文件。'
          : (error instanceof Error ? error.message : '列出目录失败')
        sendError(response, 403, 'files_unreadable', message, currentCorrelationId)
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/files/bytes') {
      const sessionId = url.searchParams.get('sessionId')
      const path = url.searchParams.get('path')
      if (!path || path.includes('\0') || path.split(/[\\/]/u).includes('..')) {
        sendError(response, 400, 'validation_error', '路径不合法', currentCorrelationId)
        return
      }
      try {
        if (sessionId) {
          const file = await readWorkspaceFileBytes(aiRuntime, { sessionId, path })
          sendJson(response, 200, { data: { path, name: String(file?.name || path.split('/').pop() || 'file'), size: Number(file?.size || 0), data: String(file?.data || ''), mime: String(file?.mime || '') }, correlationId: currentCorrelationId })
          return
        }
        const root = await resolveFileRoot(null)
        const target = resolve(join(root, path))
        if (target !== root && !target.startsWith(root + sep)) {
          sendError(response, 400, 'validation_error', '路径越出工作区', currentCorrelationId)
          return
        }
        const buf = await readFile(target)
        sendJson(response, 200, { data: { path, name: path.split('/').pop() || 'file', size: buf.length, data: buf.toString('base64') }, correlationId: currentCorrelationId })
      } catch (error) {
        sendError(response, 502, 'files_read_failed', error instanceof Error ? error.message : '读取失败', currentCorrelationId)
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/files/content') {
      const sessionId = url.searchParams.get('sessionId')
      const path = url.searchParams.get('path')
      if (!path || path.includes('\0') || path.split(/[\\/]/u).includes('..')) {
        sendError(response, 400, 'validation_error', '路径不合法', currentCorrelationId)
        return
      }
      if (sessionId) {
        try {
          const file = await readWorkspaceFileBytes(aiRuntime, { sessionId, path })
          sendJson(response, 200, { data: decodeWorkspaceFileText(file), correlationId: currentCorrelationId })
          return
        } catch (error) {
          sendError(response, 502, 'files_read_failed', error instanceof Error ? error.message : '读取失败', currentCorrelationId)
          return
        }
      }
      const root = await resolveFileRoot(null)
      const target = resolve(join(root, path))
      if (target !== root && !target.startsWith(root + sep)) {
        sendError(response, 400, 'validation_error', '路径越出工作区', currentCorrelationId)
        return
      }
      const text = await readFile(target, 'utf8')
      sendJson(response, 200, { data: { path, text }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/files/versions') {
      const rel = safeWorkspaceRel(url.searchParams.get('path'))
      if (!rel) {
        sendError(response, 400, 'validation_error', '路径不合法', currentCorrelationId)
        return
      }
      const root = await resolveFileRoot(url.searchParams.get('sessionId'))
      sendJson(response, 200, {
        data: { path: rel, items: listWorkspaceDocumentVersions(db, { cwd: root, relPath: rel }) },
        correlationId: currentCorrelationId,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/files/rollback') {
      const body = await readJson(request)
      const rel = safeWorkspaceRel(body.path)
      const versionId = typeof body.versionId === 'string' ? body.versionId.trim() : ''
      if (!rel || !versionId) {
        sendError(response, 400, 'validation_error', '路径或版本不合法', currentCorrelationId)
        return
      }
      const root = await resolveFileRoot(typeof body.sessionId === 'string' ? body.sessionId : null)
      try {
        const written = await rollbackWorkspaceDocument({
          db,
          dshHome: aiRuntime.dshHome,
          root,
          relPath: rel,
          versionId,
        })
        sendJson(response, 200, { data: written, correlationId: currentCorrelationId })
      } catch (error) {
        sendError(response, 400, 'validation_error', error instanceof Error ? error.message : '回滚失败', currentCorrelationId)
      }
      return
    }

    if (request.method === 'PUT' && url.pathname === '/api/v1/files/content') {
      const body = await readJson(request)
      const rel = safeWorkspaceRel(body.path)
      const hasText = typeof body.text === 'string'
      const hasData = typeof body.data === 'string'
      const hasHtml = typeof body.html === 'string'
      const kinds = [hasText, hasData, hasHtml].filter(Boolean).length
      if (!rel || kinds !== 1) {
        sendError(response, 400, 'validation_error', '路径或内容不合法', currentCorrelationId)
        return
      }
      let bytes
      if (hasHtml) {
        if (!rel.toLowerCase().endsWith('.docx')) {
          sendError(response, 400, 'validation_error', 'HTML 只能写回 docx', currentCorrelationId)
          return
        }
        const loaded = await import('html-to-docx')
        const HTMLtoDOCX = loaded.default || loaded
        const out = await HTMLtoDOCX(`<!doctype html><html><body>${body.html}</body></html>`)
        bytes = Buffer.isBuffer(out) ? out : Buffer.from(out)
      } else {
        bytes = hasText ? Buffer.from(body.text, 'utf8') : Buffer.from(body.data, 'base64')
      }
      const root = await resolveFileRoot(typeof body.sessionId === 'string' ? body.sessionId : null)
      try {
        const written = await writeWorkspaceDocument({
          db,
          dshHome: aiRuntime.dshHome,
          root,
          relPath: rel,
          bytes,
          note: typeof body.note === 'string' ? body.note : '保存前',
        })
        sendJson(response, 200, { data: written, correlationId: currentCorrelationId })
      } catch (error) {
        sendError(response, 400, 'validation_error', error instanceof Error ? error.message : '写入失败', currentCorrelationId)
      }
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/files/raw') {
      const rel = url.searchParams.get('path') || ''
      if (!rel || rel.includes('\0') || rel.split(/[\\/]/u).includes('..')) {
        sendError(response, 400, 'validation_error', '路径不合法', currentCorrelationId)
        return
      }
      const root = await resolveFileRoot(url.searchParams.get('sessionId'))
      const target = resolve(join(root, rel))
      if (target !== root && !target.startsWith(root + sep)) {
        sendError(response, 400, 'validation_error', '路径越出工作区', currentCorrelationId)
        return
      }
      const types = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
        '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
        '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
      }
      const type = types[extname(target).toLowerCase()] || 'application/octet-stream'
      response.writeHead(200, {
        'Content-Type': type,
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
        ...corsHeaders(response),
      })
      createReadStream(target).on('error', () => {
        if (!response.headersSent) sendError(response, 404, 'not_found', '文件不存在', currentCorrelationId)
        else response.end()
      }).pipe(response)
      return
    }

    if (await handleMcpRoutes(request, response, url, {
      aiRuntime, db, currentCorrelationId, sendJson, sendError, readJson,
    })) return

    if (await handleSkillRoutes(request, response, url, {
      aiRuntime, db, currentCorrelationId, sendJson, sendError, readJson,
    })) return

    if (request.method === 'GET' && url.pathname === '/api/v1/workspaces') {
      sendJson(response, 200, { items: listWorkspaces(db), correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/workspaces') {
      const body = await readJson(request)
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        sendError(response, 400, 'validation_error', 'name 不能为空', currentCorrelationId)
        return
      }
      const workspace = body.id
        ? ensureWorkspace(db, {
            id: body.id,
            name: body.name.trim(),
            description: typeof body.description === 'string' ? body.description : '',
            metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
            actorId: 'actor_local_user',
            correlationId: currentCorrelationId,
          })
        : createWorkspace(db, {
        name: body.name.trim(),
        description: typeof body.description === 'string' ? body.description : '',
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
        actorId: 'actor_local_user',
        correlationId: currentCorrelationId,
      })
      sendJson(response, 201, { data: workspace, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/events/pending') {
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 50)))
      sendJson(response, 200, { items: listPendingEvents(db, limit), correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/business/connections') {
      const workspaceId = url.searchParams.get('workspaceId') ?? 'ws_personal'
      await refreshLanAssistConnectionLamp(db, (path, options) => aiRuntime.lanAssist(path, options))
      await migrateBoundWorkspaceSources(db, aiRuntime).catch(() => ({ migrated: 0 }))
      const listed = await readBizSystems(aiRuntime)
      const mcpItems = (listed.systems || []).map((row) => ({
        id: row.id,
        workspaceId: '',
        name: row.name,
        provider: 'mcp',
        connectionKind: 'mcp',
        status: 'connected',
        capabilities: ['describe', 'list', ...(row.tools?.write ? ['write'] : [])],
        lastHealth: null,
        updatedAt: '',
      }))
      sendJson(response, 200, {
        items: [...listBusinessConnections(db, { workspaceId }), ...mcpItems],
        correlationId: currentCorrelationId,
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/business/apps') {
      const workspaceId = url.searchParams.get('workspaceId') ?? 'ws_personal'
      const workspaceCwd = url.searchParams.get('workspaceCwd') ?? ''
      sendJson(response, 200, { items: listBusinessApps(db, { workspaceId, workspaceCwd }), correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/business/apps') {
      const body = await readJson(request)
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        sendError(response, 400, 'validation_error', '应用名称不能为空', currentCorrelationId)
        return
      }
      const app = createBusinessApp(db, {
        workspaceId: body.workspaceId ?? 'ws_personal',
        name: body.name.trim(),
        definition: body.definition && typeof body.definition === 'object' ? body.definition : {},
        changeNote: typeof body.changeNote === 'string' ? body.changeNote : undefined,
        actorId: 'actor_local_user',
        correlationId: currentCorrelationId,
      })
      sendJson(response, 201, { data: app, correlationId: currentCorrelationId })
      return
    }

    const appMatch = url.pathname.match(/^\/api\/v1\/business\/apps\/([^/]+)$/)
    if (request.method === 'PUT' && appMatch) {
      const appId = decodeURIComponent(appMatch[1] || '')
      if (!appId || appId.includes('..') || appId.includes('/') || appId.includes('\\')) {
        sendError(response, 400, 'validation_error', '应用 id 不合法', currentCorrelationId)
        return
      }
      const body = await readJson(request)
      const app = updateBusinessApp(db, appId, {
        name: body.name,
        definition: body.definition && typeof body.definition === 'object' ? body.definition : undefined,
        changeNote: typeof body.changeNote === 'string' ? body.changeNote : undefined,
        actorId: 'actor_local_user',
        correlationId: currentCorrelationId,
      })
      if (!app) {
        sendError(response, 404, 'not_found', '应用不存在', currentCorrelationId)
        return
      }
      sendJson(response, 200, { data: app, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/operations') {
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 100)))
      const workspaceId = url.searchParams.get('workspaceId') ?? undefined
      sendJson(response, 200, { items: listOperations(db, { workspaceId, limit }), correlationId: currentCorrelationId })
      return
    }

    const operationMatch = url.pathname.match(/^\/api\/v1\/operations\/([^/]+)$/)
    if (request.method === 'GET' && operationMatch) {
      const operation = getOperation(db, operationMatch[1])
      if (!operation) {
        sendError(response, 404, 'not_found', '操作不存在', currentCorrelationId)
        return
      }
      sendJson(response, 200, { data: operation, correlationId: currentCorrelationId })
      return
    }

    const traceMatch = url.pathname.match(/^\/api\/v1\/operations\/([^/]+)\/trace$/)
    if (request.method === 'GET' && traceMatch) {
      const trace = getOperationTrace(db, traceMatch[1])
      if (!trace) {
        sendError(response, 404, 'not_found', '操作不存在', currentCorrelationId)
        return
      }
      sendJson(response, 200, { data: trace, correlationId: currentCorrelationId })
      return
    }

    const approveMatch = url.pathname.match(/^\/api\/v1\/operations\/([^/]+)\/approve$/)
    if (request.method === 'POST' && approveMatch) {
      const body = await readJson(request)
      const result = approveOperation(db, approveMatch[1], {
        actorId: 'actor_local_user',
        note: typeof body.note === 'string' ? body.note : '',
        correlationId: currentCorrelationId,
      })
      if (result.kind === 'not_found') {
        sendError(response, 404, 'not_found', '操作不存在', currentCorrelationId)
        return
      }
      if (result.kind === 'invalid_state') {
        sendError(response, 409, 'invalid_state', '当前状态不能审批', currentCorrelationId, { state: result.operation.state })
        return
      }
      sendJson(response, 200, { data: result.operation, correlationId: currentCorrelationId })
      return
    }

    const executeMatch = url.pathname.match(/^\/api\/v1\/operations\/([^/]+)\/execute$/)
    if (request.method === 'POST' && executeMatch) {
      const operationBefore = getOperation(db, executeMatch[1])
      if (!operationBefore) {
        sendError(response, 404, 'not_found', '操作不存在', currentCorrelationId)
        return
      }
      if (operationBefore.executionMode === 'live') {
        const result = await executeOperationLive(db, executeMatch[1], {
          actorId: 'actor_local_user',
          correlationId: currentCorrelationId,
          writePreview: async (previewId) => aiRuntime.lanAssist('/write', {
            method: 'POST',
            body: { preview_id: previewId, trace_id: currentCorrelationId, source: 'workstation' },
          }),
        })
        if (result.kind === 'not_found') {
          sendError(response, 404, 'not_found', '操作不存在', currentCorrelationId)
          return
        }
        if (result.kind === 'invalid_state') {
          sendError(response, 409, 'invalid_state', '当前状态不能执行', currentCorrelationId, { state: result.operation.state })
          return
        }
        if (result.kind === 'preview_expired') {
          sendError(response, 409, 'preview_expired', '预览已过期，请重新预览后再执行', currentCorrelationId, { operationId: result.operation.id })
          return
        }
        if (result.kind === 'write_failed') {
          sendError(response, 422, 'biz_write_failed', result.message || '过账失败', currentCorrelationId, { operationId: result.operation.id })
          return
        }
        if (result.kind === 'live_not_supported') {
          sendError(response, 501, 'live_adapter_not_ready', '真实写入适配器尚未启用', currentCorrelationId)
          return
        }
        if (operationBefore?.state === 'approved') {
          await emitOperationExecuted(operationBefore, result.receipt)
        }
        sendJson(response, 200, { data: result.operation, receipt: result.receipt, correlationId: currentCorrelationId })
        return
      }

      const result = executeDryRun(db, executeMatch[1], {
        actorId: 'actor_local_user',
        correlationId: currentCorrelationId,
      })
      if (result.kind === 'not_found') {
        sendError(response, 404, 'not_found', '操作不存在', currentCorrelationId)
        return
      }
      if (result.kind === 'live_not_supported') {
        sendError(response, 501, 'live_adapter_not_ready', '真实写入适配器尚未启用；拒绝伪造业务系统成功回执', currentCorrelationId, {
          operationId: result.operation.id,
          state: result.operation.state,
        })
        return
      }
      if (result.kind === 'invalid_state') {
        sendError(response, 409, 'invalid_state', '当前状态不能执行', currentCorrelationId, { state: result.operation.state })
        return
      }
      if (operationBefore?.state === 'approved' && result.kind === 'ok') {
        await emitOperationExecuted(operationBefore, result.receipt)
      }
      sendJson(response, 200, { data: result.operation, receipt: result.receipt, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/operations') {
      const body = await readJson(request)
      const required = ['targetRef', 'action', 'operationKind', 'riskLevel', 'input']
      const missing = required.filter((key) => body[key] === undefined || body[key] === '')
      if (missing.length > 0) {
        sendError(response, 400, 'validation_error', '操作意图缺少必要字段', currentCorrelationId, { missing })
        return
      }
      if (!['read', 'write'].includes(body.operationKind)) {
        sendError(response, 400, 'validation_error', 'operationKind 必须是 read 或 write', currentCorrelationId)
        return
      }
      if (!['low', 'medium', 'high', 'critical'].includes(body.riskLevel)) {
        sendError(response, 400, 'validation_error', 'riskLevel 无效', currentCorrelationId)
        return
      }

      const id = createId('op')
      const now = new Date().toISOString()
      const writeNeedsApproval = body.operationKind === 'write' && ['medium', 'high', 'critical'].includes(body.riskLevel)
      const state = writeNeedsApproval ? 'awaiting_approval' : 'draft'
      const executionMode = body.executionMode === 'live' ? 'live' : 'dry_run'
      const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 0
        ? body.idempotencyKey
        : createId('idem')
      const planJson = body.plan && typeof body.plan === 'object' ? JSON.stringify(body.plan) : '{}'

      db.exec('BEGIN IMMEDIATE;')
      try {
        db.prepare(`
          INSERT INTO operations
            (id, workspace_id, connection_id, app_id, requested_by, target_ref, action, operation_kind,
             risk_level, execution_mode, state, idempotency_key, expected_version, input_json, plan_json,
             correlation_id, causation_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          body.workspaceId ?? 'ws_personal',
          body.connectionId ?? null,
          body.appId ?? null,
          'actor_local_user',
          body.targetRef,
          body.action,
          body.operationKind,
          body.riskLevel,
          executionMode,
          state,
          idempotencyKey,
          body.expectedVersion ?? null,
          JSON.stringify(body.input),
          planJson,
          currentCorrelationId,
          body.causationId ?? null,
          now,
          now,
        )
        if (body.plan && typeof body.plan === 'object' && typeof body.plan.previewId === 'string' && body.plan.previewId) {
          insertOperationStep(db, id, 0, 'preview', 'succeeded', { previewId: body.plan.previewId }, body.plan)
        }
        if (writeNeedsApproval) {
          db.prepare(`
            INSERT INTO approvals
              (id, operation_id, requested_from, decision, policy_json, requested_at)
            VALUES (?, ?, 'actor_local_user', 'pending', ?, ?)
          `).run(createId('approval'), id, JSON.stringify({ reason: 'write_risk_gate', riskLevel: body.riskLevel }), now)
        }
        appendAudit(db, {
          workspaceId: body.workspaceId ?? 'ws_personal',
          actorId: 'actor_local_user',
          action: 'operation.plan',
          targetRef: `fde://workstation/operation/${id}`,
          outcome: 'accepted',
          riskLevel: body.riskLevel,
          correlationId: currentCorrelationId,
          details: { targetRef: body.targetRef, action: body.action, executionMode, state },
        })
        enqueueEvent(db, {
          type: 'operation.planned',
          sourceRef: `fde://workstation/operation/${id}`,
          subjectRef: body.targetRef,
          correlationId: currentCorrelationId,
          causationId: body.causationId,
          payload: { operationId: id, state, riskLevel: body.riskLevel, executionMode },
        })
        db.exec('COMMIT;')
      } catch (error) {
        db.exec('ROLLBACK;')
        throw error
      }

      sendJson(response, 201, {
        data: getOperation(db, id),
        note: '本端点只创建可审计的操作计划，不直接调用外部业务系统。',
        correlationId: currentCorrelationId,
      })
      return
    }

    if (await handleBriefingRoutes(request, response, url, {
      db,
      aiRuntime,
      allowedOrigins: FDE_ALLOWED_ORIGINS,
      correlationId: currentCorrelationId,
      sendError,
      readJson,
      defaultWorkspaceCwd: FDE_AI_WORKSPACE,
      runBriefingDeps: { db, aiRuntime },
    })) {
      return
    }

    if (await handleCatalogRequest(request, response, url, { aiRuntime, readJson, sendJson, sendError, openEventStream, writeEvent }, currentCorrelationId)) {
      return
    }
    if (await handlePlanRequest(request, response, url, { db, enqueueEvent, readJson, aiRuntime }, currentCorrelationId)) {
      return
    }

    if (FDE_STATIC_DIR && tryServeStatic(FDE_STATIC_DIR, request, response)) {
      return
    }

    sendError(response, 404, 'not_found', '接口不存在', currentCorrelationId)
  } catch (error) {
    const code = error?.code ?? error?.cause?.code
    const proxyAlreadyOpen = response.headersSent || response.writableEnded
    if (
      error?.name === 'AbortError'
      || proxyAlreadyOpen
      || code === 'UND_ERR_BODY_TIMEOUT'
      || code === 'UND_ERR_ABORTED'
      || code === 'UND_ERR_SOCKET'
    ) return
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof AiRemoteError) {
      const status = error.code === 'origin_not_allowed'
        ? 403
        : error.code === 'ai/not-connected' || error.code === 'ai/boot-unavailable' || error.code === 'ai/boot-missing'
          ? 503
          : 502
      sendError(response, status, error.code, error.message, currentCorrelationId)
      return
    }
    if (message === 'request_too_large') {
      sendError(response, 413, 'request_too_large', '请求体超过 1 MiB', currentCorrelationId)
      return
    }
    if (error instanceof SyntaxError) {
      sendError(response, 400, 'invalid_json', '请求体不是有效 JSON', currentCorrelationId)
      return
    }
    console.error(`[${currentCorrelationId}]`, error)
    sendError(response, 500, 'internal_error', '本地运行时发生错误', currentCorrelationId)
  }
})

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`)
  if (url.pathname === '/ws/graph-updates') {
    url.pathname = '/semantic-os/ws/graph-updates'
    request.url = `${url.pathname}${url.search}`
  }
  if (!aiRuntime.origin || url.pathname.startsWith('/api/v1')) {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  if (requestTouchesSemanticOs(request) && !safeSemanticOsUpstreamPath(request)) {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  const target = new URL(aiRuntime.origin)
  const path = dshProxyPath(url) || '/'
  const up = httpRequest({
    hostname: target.hostname,
    port: target.port,
    path,
    method: 'GET',
    headers: {
      ...request.headers,
      host: target.host,
      cookie: aiRuntime.cookie,
      origin: aiRuntime.origin,
    },
  })
  up.on('upgrade', (upResponse, upSocket, upHead) => {
    const lines = [`HTTP/1.1 101 Switching Protocols`]
    for (const [key, value] of Object.entries(upResponse.headers)) {
      if (value == null) continue
      lines.push(`${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    }
    socket.write(`${lines.join('\r\n')}\r\n\r\n`)
    if (head.length) upSocket.write(head)
    if (upHead.length) socket.write(upHead)
    duplexProxySockets(socket, upSocket)
  })
  socket.on('error', () => socket.destroy())
  up.on('error', () => socket.destroy())
  up.end()
})

void ensureTypertVerbs().catch(() => undefined)

server.listen(port, host, () => {
  const bound = server.address()
  const actualPort = typeof bound === 'object' && bound ? bound.port : port
  allowedOrigins.add(`http://127.0.0.1:${actualPort}`)
  allowedOrigins.add(`http://localhost:${actualPort}`)
  console.log(`FDE_LISTENING ${actualPort}`)
  console.log(`FDE-X runtime listening on http://${host}:${actualPort}`)
  console.log(`SQLite authority: ${databasePath}`)
  void reclaimStrayRuntime({
    keep: [process.pid, process.ppid],
    runtimePort: actualPort,
    lanPort: 0,
    profileName: '',
    dshHome: aiRuntime.dshHome || FDE_DSH_HOME,
  }).catch((error) => {
    console.warn('reclaim_stray_failed', error)
  })
  void ensurePresets(aiRuntime.dshHome || FDE_DSH_HOME).catch((error) => {
    console.warn('ensurePresets_failed', error)
  })
  startSemanticReadyWatch({
    semanticOs: (path, options) => aiRuntime.semanticOs(path, options),
    kick: (result) => {
      if (typeof aiRuntime.kickSemanticIfExited === 'function') aiRuntime.kickSemanticIfExited(result)
    },
    readHostLlm: () => readDshDefaultLlm(aiRuntime),
    dshHome: aiRuntime.dshHome || FDE_DSH_HOME,
  })
  startLanAssistStateWatch({
    db,
    lanAssist: (path, options) => aiRuntime.lanAssist(path, options),
    ...(aiRuntime.origin ? {
      subscribeLanMailbox: (onEvent, hooks) => subscribeLanAssistMailbox({
        origin: aiRuntime.origin,
        cookie: aiRuntime.cookie,
        onEvent,
        onLive: hooks && hooks.onLive,
        onDown: hooks && hooks.onDown,
      }),
    } : {}),
    cwd: FDE_AI_WORKSPACE,
    prepareSurface: (sheet, sessionId) => {
      const workspaceCwd = typeof sheet.workspace === 'string' && sheet.workspace.startsWith('/')
        ? sheet.workspace
        : FDE_AI_WORKSPACE
      return recordSurfaceFromPreview(db, workspaceCwd, {
        kind: sheet.kind,
        action: sheet.action,
        sessionId,
      }, { sheet })
    },
  })
  startBriefingScheduler({ db, aiRuntime, defaultCwd: FDE_AI_WORKSPACE })
})

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`[fde-x] 运行口已被占用，本进程退出以免双 BFF`)
    process.exit(1)
  }
  console.error(error)
})

let closing = false
async function close() {
  if (closing) return
  closing = true
  await aiRuntime.stop().catch(() => undefined)
  try {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
  } catch { /* Node 旧版本没有 closeAllConnections */ }
  const failsafe = setTimeout(() => process.exit(0), 1500)
  failsafe.unref?.()
  server.close(() => {
    clearTimeout(failsafe)
    try { db.close() } catch { /* already closed */ }
    process.exit(0)
  })
}

process.on('SIGINT', close)
process.on('SIGTERM', close)
