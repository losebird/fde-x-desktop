import { createServer, request as httpRequest } from 'node:http'
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { appendFile, cp, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { constants as zlibConstants, zstdCompress, zstdDecompress } from 'node:zlib'

const execFileAsync = promisify(execFile)
const zstdCompressAsync = promisify(zstdCompress)
const zstdDecompressAsync = promisify(zstdDecompress)
const ZSTD_MAGIC = 4247762216

function scheduleRuntimeRestart() {
  const delayMs = 200
  if (process.env.FDE_RUNTIME_SUPERVISED !== '1') {
    const child = spawn(process.execPath, process.argv.slice(1), {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: 'inherit',
    })
    child.unref()
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
  openDatabase,
} from './db.mjs'
import { inspectAdapters } from './adapters.mjs'
import { handlePlanRequest } from './routes/plan.mjs'
import { ensurePresets, handlePresetRoutes } from './routes/presets.mjs'
import { handleMcpRoutes } from './routes/mcp.mjs'
import { AiRemoteError, createCoreConnector } from './dsh-core.mjs'
import { createFollowNormalizer } from './ai-stream.mjs'
import { configureEventBus, emit } from './events.mjs'
import { startLanAssistStateWatch } from './lan-assist-state-watch.mjs'
import { handleEventsRoutes } from './routes/events.mjs'
import { handleAppsRoutes } from './routes/apps.mjs'
import { handleBizRoutes, recordSurfaceFromPreview } from './routes/biz.mjs'
import { ensureBridgeToken, handleAiResultGet, handleBridgeRoutes } from './routes/bridge.mjs'
import { handleContextPackRoute } from './routes/context.mjs'
import { handleCorpusRoute } from './routes/corpus.mjs'
import { handleBriefingRoutes } from './routes/briefing.mjs'
import { tryServeStatic } from './routes/static.mjs'
import { startBriefingScheduler } from './briefing/scheduler.mjs'
import { startMemoryWriter } from './memory/writer.mjs'
import { asDraftCard, draftMemoryCardInsert, validateMemoryCardLabel } from './memory/cards.mjs'
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

function upsertSettingsProvider(filePath, route, profile) {
  const models = Array.isArray(profile.models) ? profile.models : []
  const block = [
    `    ${route}:`,
    profile.displayName ? `      displayName: ${yamlScalar(profile.displayName)}` : null,
    profile.apiKeyEnv ? `      apiKeyEnv: ${yamlScalar(profile.apiKeyEnv)}` : null,
    `      api: ${yamlScalar(profile.api)}`,
    `      baseURL: ${yamlScalar(profile.baseURL)}`,
    '      models:',
    ...models.map((row) => {
      const efforts = row.reasoningEfforts
      if (efforts && typeof efforts === 'object') {
        return [
          `        - id: ${yamlScalar(row.id)}`,
          `          name: ${yamlScalar(row.name || row.id)}`,
          '          reasoningEfforts: { off: null, low: low, medium: medium, high: high, xhigh: xhigh }',
        ].join('\n')
      }
      return `        - { id: ${yamlScalar(row.id)}, name: ${yamlScalar(row.name || row.id)} }`
    }),
  ].filter(Boolean).join('\n') + '\n'
  let text = ''
  try { text = readFileSync(filePath, 'utf8') } catch { text = '' }
  if (!text.trim()) {
    writeFileSync(filePath, `llm-pi-ai:\n  providers:\n${block}`)
    return
  }
  if (new RegExp(`(?:^|\\n)\\s{2,4}${route}:\\s*$`, 'm').test(text)) return
  if (/llm-pi-ai:\s*\n(?:[ \t].*\n)*?[ \t]*providers:\s*\n/.test(text)) {
    text = text.replace(/(providers:\s*\n)/, `$1${block}`)
  } else if (/^llm-pi-ai:\s*$/m.test(text)) {
    text = text.replace(/^(llm-pi-ai:\s*\n)/m, `$1  providers:\n${block}`)
  } else {
    text = `${text.replace(/\s+$/, '')}\nllm-pi-ai:\n  providers:\n${block}`
  }
  writeFileSync(filePath, text.endsWith('\n') ? text : `${text}\n`)
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
  function wrapFactory(reg) {
    if (!reg || typeof reg.factory !== "function") return
    var id = String(reg.id || "")
    var patchClipboard =
      id.indexOf("dsh-client-ui-primitives") !== -1 || id.indexOf("dsh-web-frontend") !== -1
    var patchSession = id.indexOf("session-controller") !== -1 || id.indexOf("ui-workspace") !== -1
    if (!patchClipboard && !patchSession) return
    var inner = reg.factory
    reg.factory = function (require) {
      var exp = inner(require)
      if (patchClipboard && typeof window.__fdePatchClipboardExport === "function") {
        try { window.__fdePatchClipboardExport(exp) } catch (e) {}
      }
      if (patchSession && exp && typeof exp.apply === "function") {
        var prev = exp.apply
        exp.apply = function (ctx) {
          var out = prev.apply(this, arguments)
          hookCtx(ctx)
          setTimeout(function () { hookCtx(ctx) }, 0)
          setTimeout(function () { hookCtx(ctx) }, 400)
          return out
        }
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
.pI_x6G_frame{grid-template-columns:minmax(0,1fr)!important}
.pI_x6G_sidebarCol,.pI_x6G_rightbarCol,.pI_x6G_handle{display:none!important}
.eGxaPq_frame{right:8px!important}
[data-sidebar-right-expand],[data-sidebar-right-toggle]{display:none!important}
.pXSMma_workspaceRow,.pXSMma_workspace,.pXSMma_headline,.pXSMma_previewBadge,.pXSMma_fishHitbox,.pXSMma_titleGroup{display:none!important}
.uV2eYG_card,.uV2eYG_overlayAnchor,.uV2eYG_root{overflow:visible!important}
.uV2eYG_overlayAnchor{z-index:80!important}
.dla-ask-wrap,.dla-ask-btn,.dla-overlay,.dla-badge,.dla-chat-pop,.dla-chat-scrim,.dla-chat-pair-ask,.dla-sec-backdrop,.dla-sec-panel{display:none!important}
.wSkVaW_tabs [role=tab]:nth-child(n+3){display:none!important}
.dsos-root,.dsos-bar{display:none!important}
</style>`
const FDE_DSH_STRIP_SCRIPT = `<script data-fde-dsh-strip>
(function () {
  function preferChatTab() {
    var tabs = document.querySelectorAll('.wSkVaW_tabs [role=tab]')
    if (tabs.length < 3) return
    if (tabs[2].getAttribute('aria-selected') === 'true' && tabs[0]) tabs[0].click()
  }
  setTimeout(preferChatTab, 400)
  setTimeout(preferChatTab, 1600)
})()
</script>`

function dshProxyPath(url) {
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
  if (url.pathname === '/dsh-app' || url.pathname.startsWith('/dsh-app/')) return true
  if (!aiRuntime.origin) return false
  if (url.pathname.startsWith('/api/v1')) return false
  if (isSemanticOsPath(url.pathname)) return false
  if (url.pathname === '/health') return false
  if (url.pathname === '/' || url.pathname === '/favicon.ico') return false
  return true
}

function outboundProxyHeaders(incoming) {
  const headers = { ...incoming.headers }
  for (const key of ['connection', 'keep-alive', 'transfer-encoding', 'set-cookie', 'set-cookie2']) {
    delete headers[key]
  }
  return headers
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
        response.writeHead(incoming.statusCode || 200, outboundProxyHeaders(incoming))
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
          html = html.replace('<head>', `<head>${FDE_DSH_CLIPBOARD_PATCH}${FDE_DSH_HEAD_HOOK}`)
        }
        if (!html.includes('data-fde-dsh-strip')) {
          html = html.replace('</head>', `${FDE_DSH_STRIP_STYLE}${FDE_DSH_STRIP_SCRIPT}</head>`)
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

const SKIP_SESSION_FILES = new Set(['session.lock'])

function sessionRootOf() {
  return process.env.FDE_DSH_SESSION_ROOT || join(aiRuntime.dshHome, 'sessions')
}

function safeSessionFileName(name) {
  const s = String(name || '').trim()
  if (!s || s.includes('..') || s.includes('/') || s.includes('\\') || s.includes('\0')) return ''
  if (SKIP_SESSION_FILES.has(s) || s.startsWith('.')) return ''
  return s
}

async function findSessionDir(sessionId) {
  const id = String(sessionId || '').trim()
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\') || id.includes('\0')) return ''
  const walk = async (dir, depth) => {
    if (depth > 3) return ''
    let entries = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return ''
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === id) return join(dir, entry.name)
      const nested = await walk(join(dir, entry.name), depth + 1)
      if (nested) return nested
    }
    return ''
  }
  return walk(sessionRootOf(), 0)
}

async function readSessionBundle(sessionId) {
  const dir = await findSessionDir(sessionId)
  if (!dir) {
    const error = new Error('找不到这个会话文件')
    error.code = 'not_found'
    throw error
  }
  const names = await readdir(dir)
  const files = []
  for (const name of names) {
    const safe = safeSessionFileName(name)
    if (!safe) continue
    const buf = await readFile(join(dir, safe))
    files.push({ name: safe, size: buf.length, data: buf.toString('base64') })
  }
  if (!files.length) {
    const error = new Error('这个会话还没有可交接的文件')
    error.code = 'empty'
    throw error
  }
  return { sessionId, files }
}

function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`会话日志不是 zstd：offset ${offset}`)
    offset += 4
    if (offset >= buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    offset += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    for (;;) {
      if (buffer.length - offset < 3) break
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = blockHeader >>> 1 & 3
      const blockSize = blockHeader >>> 3
      const payloadBytes = blockType === 1 ? 1 : blockSize
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) offset += 4
    frames.push({ start, end: offset })
  }
  return frames
}

function patchSessionHeaderLine(text, patch) {
  const cut = text.indexOf('\n')
  const first = cut === -1 ? text : text.slice(0, cut)
  const rest = cut === -1 ? '' : text.slice(cut)
  const header = JSON.parse(first)
  if (patch.id) header.id = patch.id
  if (patch.cwd) header.cwd = patch.cwd
  return `${JSON.stringify(header)}${rest}`
}

async function rewriteSessionLog(name, buf, patch) {
  if (!patch?.id && !patch?.cwd) return buf
  if (name.endsWith('.jsonl') && !name.endsWith('.jsonl.zstd')) {
    return Buffer.from(patchSessionHeaderLine(buf.toString('utf8'), patch), 'utf8')
  }
  if (!name.endsWith('.jsonl.zstd') && !name.endsWith('.zstd')) return buf
  const frames = scanZstdFrames(buf)
  if (!frames.length) throw new Error('会话日志里没有完整的 zstd 帧')
  const headerPlain = await zstdDecompressAsync(buf.subarray(frames[0].start, frames[0].end))
  const headerText = headerPlain.toString('utf8')
  const nl = headerText.indexOf('\n')
  if (nl === -1 || nl !== headerText.length - 1) {
    throw new Error('会话日志第一帧不是单独的 header 行')
  }
  const patched = Buffer.from(patchSessionHeaderLine(headerText, patch), 'utf8')
  if (patched.indexOf(10) !== patched.length - 1) {
    throw new Error('改写后的 header 不是单独一行')
  }
  const headerFrame = await zstdCompressAsync(patched, { params: { [zlibConstants.ZSTD_c_checksumFlag]: 1 } })
  const rest = frames.length > 1 ? buf.subarray(frames[0].end) : Buffer.alloc(0)
  return Buffer.concat([headerFrame, rest])
}

async function collectIncreasingEvents(buf) {
  const frames = scanZstdFrames(buf)
  const lines = []
  let lastSeq = -1
  for (let i = 1; i < frames.length; i += 1) {
    const text = (await zstdDecompressAsync(buf.subarray(frames[i].start, frames[i].end))).toString('utf8')
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      let event
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      if (typeof event.seq === 'number') {
        if (event.seq <= lastSeq) continue
        lastSeq = event.seq
      }
      lines.push(line)
    }
  }
  return lines
}

async function graftZstdSessionLog(createdPath, incomingBuf) {
  const createdBuf = await readFile(createdPath)
  const createdFrames = scanZstdFrames(createdBuf)
  if (!createdFrames.length) throw new Error('新建会话还没有 header 帧')
  const header = createdBuf.subarray(createdFrames[0].start, createdFrames[0].end)
  const lines = await collectIncreasingEvents(incomingBuf)
  if (!lines.length) throw new Error('交接会话里没有可接上的事件')
  const eventFrame = await zstdCompressAsync(Buffer.from(`${lines.join('\n')}\n`), {
    params: { [zlibConstants.ZSTD_c_checksumFlag]: 1 },
  })
  await writeFile(createdPath, Buffer.concat([header, eventFrame]))
}

async function writeSessionBundle(dir, files, patch = {}) {
  await mkdir(dir, { recursive: true })
  for (const file of Array.isArray(files) ? files : []) {
    const name = safeSessionFileName(file && file.name)
    if (!name) continue
    const buf = Buffer.from(String((file && file.data) || ''), 'base64')
    if (!buf.length) continue
    const dest = join(dir, name)
    if (name.endsWith('.jsonl.zstd') && existsSync(dest)) {
      await graftZstdSessionLog(dest, buf)
      continue
    }
    const next = await rewriteSessionLog(name, buf, patch)
    await writeFile(dest, next)
  }
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

    if (await handleCorpusRoute(request, response, url, {
      db,
      aiRuntime,
      correlationId: currentCorrelationId,
      sendJson,
    })) return

    if (await handleAppsRoutes(request, response, url, {
      db,
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
      const result = await aiRuntime.semanticOs('/ready', { method: 'GET' })
      if (typeof aiRuntime.kickSemanticIfExited === 'function') aiRuntime.kickSemanticIfExited(result)
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

    if (request.method === 'GET' && url.pathname === '/api/v1/ai/providers') {
      const [registered, directory] = await Promise.all([
        aiRuntime.rpc('llm/listProviders', {}),
        aiRuntime.rpc('llm/listConfigurableProviders', {}),
      ])
      const active = new Set((Array.isArray(registered) ? registered : []).map((row) => row.id))
      const rows = (Array.isArray(directory) ? directory : []).map((entry) => ({
        provider: String(entry.provider || ''),
        displayName: String(entry.displayName || entry.provider || ''),
        settingsNs: String(entry.settingsNs || ''),
        settingsPath: Array.isArray(entry.settingsPath) ? entry.settingsPath : [],
        active: active.has(entry.provider),
        keyRef: `${String(entry.provider || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`,
      }))
      for (const item of (Array.isArray(registered) ? registered : [])) {
        if (rows.some((row) => row.provider === item.id)) continue
        rows.push({
          provider: String(item.id || ''),
          displayName: String(item.name || item.id || ''),
          settingsNs: 'llm-pi-ai',
          settingsPath: ['providers', String(item.id || '')],
          active: true,
          keyRef: `${String(item.id || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`,
        })
      }
      const refs = [...new Set(rows.map((row) => row.keyRef).filter(Boolean))]
      let described = {}
      if (refs.length) {
        try { described = await aiRuntime.rpc('credentials/describe', { refs }) || {} } catch { described = {} }
      }
      sendJson(response, 200, {
        data: {
          providers: rows.map((row) => ({
            ...row,
            configured: Boolean(described[row.keyRef]?.configured),
          })),
          registered: Array.isArray(registered) ? registered : [],
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
        })).filter((row) => row.id)
        if (!probe || !probe.ok) {
          sendError(response, probe?.status || 502, 'discover_failed', '没能从该地址拉到模型列表，请检查地址、协议和密钥', currentCorrelationId)
          return
        }
      }
      sendJson(response, 200, {
        data: { models: models.map((row) => ({ id: String(row.id || ''), name: String(row.name || row.id || '') })).filter((row) => row.id) },
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
      const keyRef = `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
      await aiRuntime.rpc('credentials/set', { ref: keyRef, value: apiKey })
      upsertCredentialRef(join(aiRuntime.dshHome, '.credentials.yaml'), keyRef, apiKey)
      sendJson(response, 200, { data: { ok: true, provider, keyRef, hint: maskSecret(apiKey) }, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/providers/custom') {
      const body = await readJson(request)
      const route = String(body.route || '').trim()
      const displayName = String(body.displayName || '').trim()
      const baseURL = String(body.baseURL || '').trim()
      const api = String(body.api || 'openai-completions').trim()
      const apiKey = String(body.apiKey || '').trim()
      const picked = Array.isArray(body.models) ? body.models : []
      const reasoning = body.reasoning === false ? false : {
        off: null,
        low: 'low',
        medium: 'medium',
        high: 'high',
      }
      let models = picked.map((row) => ({
        id: String(row?.id || '').trim(),
        name: String(row?.name || row?.id || '').trim(),
        ...(reasoning ? { reasoningEfforts: reasoning } : { reasoningEfforts: false }),
      })).filter((row) => row.id)
      const modelId = String(body.modelId || '').trim()
      const modelName = String(body.modelName || modelId).trim()
      if (models.length === 0 && modelId) models.push({ id: modelId, ...(modelName ? { name: modelName } : {}) })
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(route)) {
        sendError(response, 400, 'validation_error', '提供方 ID 用小写字母开头，只能含小写字母、数字和连字符', currentCorrelationId)
        return
      }
      if (!/^https?:\/\//.test(baseURL) || models.length === 0) {
        sendError(response, 400, 'validation_error', '自定义提供方需要有效的 API 地址和至少一个模型', currentCorrelationId)
        return
      }
      const keyRef = `${route.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
      const profile = {
        ...(displayName ? { displayName } : {}),
        ...(apiKey ? { apiKeyEnv: keyRef } : {}),
        api,
        baseURL,
        models,
      }
      let live = false
      let liveError = ''
      if (aiRuntime.status().connected) {
        try {
          await aiRuntime.rpc('settings/mutate', {
            ns: 'llm-pi-ai',
            ops: [{ op: 'set', path: ['providers', route], value: profile }],
          })
          if (apiKey) await aiRuntime.rpc('credentials/set', { ref: keyRef, value: apiKey })
          live = true
        } catch (error) {
          liveError = error instanceof Error ? error.message : String(error)
        }
      }
      if (apiKey) upsertCredentialRef(join(aiRuntime.dshHome, '.credentials.yaml'), keyRef, apiKey)
      upsertSettingsProvider(join(aiRuntime.dshHome, 'settings.yaml'), route, profile)
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
      const [sessions, baseline] = await Promise.all([
        aiRuntime.call('session/list', { _request: cursor ? { cursor } : {} }),
        readWorkspaceBaseline(),
      ])
      const archived = new Set(baseline.archivedSessionIds)
      const items = Array.isArray(sessions?.items)
        ? sessions.items
          .map(toAiSessionSummary)
          .filter((item) => !archived.has(item.sessionId) && (includeBlank || !item.blank) && (includeSubagents || !isSubagentSession(item)))
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
      const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : ''
      const cwd = typeof body.cwd === 'string' && body.cwd.startsWith('/') ? body.cwd : ''
      if (workspaceId && cwd) {
        sendError(response, 400, 'validation_error', '创建会话只能带 workspaceId 或 cwd，不能两个都带', currentCorrelationId)
        return
      }
      const requestBody = {
        ...(workspaceId ? { workspaceId } : {}),
        ...(!workspaceId && cwd ? { cwd } : {}),
        ...(typeof body.sessionId === 'string' && body.sessionId ? { sessionId: body.sessionId } : {}),
        ...(typeof body.agentPreset === 'string' && body.agentPreset ? { agentPreset: body.agentPreset } : {}),
      }
      if (!requestBody.workspaceId && !requestBody.cwd) {
        sendError(response, 400, 'validation_error', '创建会话需要 workspaceId 或绝对路径 cwd', currentCorrelationId)
        return
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
      sendJson(response, 201, { data: session, correlationId: currentCorrelationId })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/ai/sessions/restore') {
      const body = await readJson(request)
      const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : ''
      const cwd = typeof body.cwd === 'string' && body.cwd.startsWith('/') ? body.cwd : ''
      const rows = Array.isArray(body.sessions) ? body.sessions : []
      if (!workspaceId && !cwd) {
        sendError(response, 400, 'validation_error', '复原会话需要 workspaceId 或绝对路径 cwd', currentCorrelationId)
        return
      }
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
            ...(!workspaceId && cwd ? { cwd } : {}),
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
        let dir = await findSessionDir(sid)
        if (!dir) {
          await new Promise((wait) => setTimeout(wait, 200))
          dir = await findSessionDir(sid)
        }
        if (!dir) throw new Error('会话目录还没出现，文件写不进去')
        const liveCwd = cwd || String(created.cwd || created.header?.cwd || '').trim()
        await writeSessionBundle(dir, files, { id: sid, cwd: liveCwd })
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
        if (!row.title || row.title === row.sessionId) continue
        try {
          await aiRuntime.call('session/rename', { request: { sessionId: row.sessionId, title: row.title } })
        } catch (error) {
          warnings.push(`会话 ${row.sessionId} 标题没改成功：${error instanceof Error ? error.message : String(error)}`)
        }
      }
      sendJson(response, 200, { data: { sessions: restored, ...(warnings.length ? { warnings } : {}) }, correlationId: currentCorrelationId })
      return
    }

    const aiExportMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/export$/)
    if (request.method === 'GET' && aiExportMatch) {
      const sessionId = decodeURIComponent(aiExportMatch[1])
      try {
        const bundle = await readSessionBundle(sessionId)
        sendJson(response, 200, { data: bundle, correlationId: currentCorrelationId })
      } catch (error) {
        const message = error instanceof Error ? error.message : '导不出这个会话'
        sendError(response, 404, 'not_found', message, currentCorrelationId)
      }
      return
    }

    const aiArchiveMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/archive$/)
    if (request.method === 'POST' && aiArchiveMatch) {
      const archived = await aiRuntime.call('workspace/archiveSession', {
        request: { sessionId: decodeURIComponent(aiArchiveMatch[1]) },
      })
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
      const renamed = await aiRuntime.call('session/rename', {
        request: { sessionId: aiRenameMatch[1], title: body.title.trim() },
      })
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

    const aiSkillsMatch = url.pathname.match(/^\/api\/v1\/ai\/sessions\/([^/]+)\/skills$/)
    if (request.method === 'GET' && aiSkillsMatch) {
      const skills = await aiRuntime.call('skills/list', {
        request: { sessionId: decodeURIComponent(aiSkillsMatch[1]) },
      })
      sendJson(response, 200, { data: skills, correlationId: currentCorrelationId })
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

    if (request.method === 'GET' && url.pathname === '/api/v1/memory/cards') {
      const cwd = requestMemoryCwd(url)
      const result = await aiRuntime.semanticOs('/python', { op: 'list_memory_cards', args: { include_filed: true }, ...(cwd ? { cwd } : {}) })
      sendJson(response, 200, { data: result, correlationId: currentCorrelationId })
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
      if (!label) {
        sendError(response, 400, 'validation_error', '记忆正文不能为空', currentCorrelationId)
        return
      }
      if (!validateMemoryCardLabel(label)) {
        sendError(response, 400, 'validation_error', '记忆正文至少 8 个有效字符', currentCorrelationId)
        return
      }
      const cwd = requestMemoryCwd(url, body)
      const insert = draftMemoryCardInsert(label, body.cause === 'choice' ? 'choice' : 'correction')
      const result = await aiRuntime.semanticOs('/python', {
        op: insert.op,
        args: insert.args,
        ...(cwd ? { cwd } : {}),
      })
      if (result && typeof result === 'object' && result.error) {
        sendError(response, 502, 'memory_error', String(result.hint || result.error || '起草失败'), currentCorrelationId)
        return
      }
      const card = asDraftCard({ ...(result && typeof result === 'object' ? result : {}), id: insert.args.id }, label)
      sendJson(response, 200, { data: card, correlationId: currentCorrelationId })
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
      const imCwd = typeof body.workspace === 'string' && body.workspace.startsWith('/')
        ? body.workspace
        : FDE_AI_WORKSPACE
      const requestId = String(body.requestId || result?.requestId || result?.id || '')
      if (result?.ok !== false && requestId) {
        emit('im.message.sent', {
          requestId,
          text: String(body.excerpt || body.text || ''),
          peer: String(body.peerName || body.peer || ''),
        }, { workspaceCwd: imCwd, source: 'bff' })
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
      const target = resolve(join(root, name))
      if (target !== root && !target.startsWith(root + sep)) {
        sendError(response, 400, 'validation_error', '路径越出工作区', currentCorrelationId)
        return
      }
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, Buffer.from(data, 'base64'))
      sendJson(response, 201, { data: { path: name }, correlationId: currentCorrelationId })
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
          const listing = await aiRuntime.call('workspaceFiles/list', { workspaceFileScopeId: sessionId, path: rel })
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
          const file = await aiRuntime.call('workspaceFiles/readAll', { workspaceFileScopeId: sessionId, path })
          sendJson(response, 200, { data: { path, name: String(file?.name || path.split('/').pop() || 'file'), size: Number(file?.bytes || file?.size || 0), data: String(file?.data || ''), mime: String(file?.mime || '') }, correlationId: currentCorrelationId })
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
          const file = await aiRuntime.call('workspaceFiles/read', { workspaceFileScopeId: sessionId, path, range: {} })
          sendJson(response, 200, { data: file, correlationId: currentCorrelationId })
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

    if (request.method === 'PUT' && url.pathname === '/api/v1/files/content') {
      const body = await readJson(request)
      const rel = typeof body.path === 'string' ? body.path.trim() : ''
      const text = typeof body.text === 'string' ? body.text : null
      if (!rel || text === null || rel.includes('\0') || rel.split(/[\\/]/u).includes('..')) {
        sendError(response, 400, 'validation_error', '路径或内容不合法', currentCorrelationId)
        return
      }
      const root = await resolveFileRoot(typeof body.sessionId === 'string' ? body.sessionId : null)
      const target = resolve(join(root, rel))
      if (target !== root && !target.startsWith(root + sep)) {
        sendError(response, 400, 'validation_error', '路径越出工作区', currentCorrelationId)
        return
      }
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, text, 'utf8')
      sendJson(response, 200, { data: { path: rel }, correlationId: currentCorrelationId })
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
      sendJson(response, 200, { items: listBusinessConnections(db, { workspaceId }), correlationId: currentCorrelationId })
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
        const wsRow = db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get(operationBefore.workspaceId)
        let workspaceCwd = FDE_AI_WORKSPACE
        try {
          const meta = JSON.parse(wsRow?.metadata_json || '{}')
          const raw = typeof meta.cwd === 'string' ? meta.cwd : typeof meta.path === 'string' ? meta.path : ''
          if (raw.startsWith('/')) workspaceCwd = raw
        } catch { /* default cwd */ }
        emit('operation.executed', {
          operationId: operationBefore.id,
          receipt: result.receipt,
        }, { workspaceCwd, source: 'bff' })
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

    if (await handlePlanRequest(request, response, url, { db, enqueueEvent, readJson }, currentCorrelationId)) {
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

server.listen(port, host, () => {
  const bound = server.address()
  const actualPort = typeof bound === 'object' && bound ? bound.port : port
  allowedOrigins.add(`http://127.0.0.1:${actualPort}`)
  allowedOrigins.add(`http://localhost:${actualPort}`)
  console.log(`FDE_LISTENING ${actualPort}`)
  console.log(`FDE-X runtime listening on http://${host}:${actualPort}`)
  console.log(`SQLite authority: ${databasePath}`)
  void ensurePresets(aiRuntime.dshHome || FDE_DSH_HOME).catch((error) => {
    console.warn('ensurePresets_failed', error)
  })
  startLanAssistStateWatch({
    lanAssist: (path, options) => aiRuntime.lanAssist(path, options),
    cwd: FDE_AI_WORKSPACE,
    prepareSurface: (sheet, sessionId) => {
      const workspaceCwd = typeof sheet.workspace === 'string' && sheet.workspace.startsWith('/')
        ? sheet.workspace
        : FDE_AI_WORKSPACE
      return recordSurfaceFromPreview(db, workspaceCwd, {
        kind: sheet.kind,
        action: sheet.action,
        sessionId,
      }, { sheet }, 'ai', { emitEvent: false })
    },
  })
  startBriefingScheduler({ db, aiRuntime, defaultCwd: FDE_AI_WORKSPACE })
})

let closing = false
async function close() {
  if (closing) return
  closing = true
  await aiRuntime.stop().catch(() => undefined)
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGINT', close)
process.on('SIGTERM', close)
