import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, chmod, copyFile, cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { constants, existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

const ANNOUNCEMENT_PATTERN = /^dsh web:\s+(\S+)/u
const execFileAsync = promisify(execFile)

async function pidsMatching(args) {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-f', args], { timeout: 3000 })
    return String(stdout || '').trim().split(/\s+/u).map(Number).filter((pid) => Number.isInteger(pid) && pid > 1)
  } catch {
    return []
  }
}

async function pidsListening(port) {
  const n = Number(port)
  if (!Number.isInteger(n) || n < 1) return []
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${n}`, '-sTCP:LISTEN', '-t'], { timeout: 3000 })
    return String(stdout || '').trim().split(/\s+/u).map(Number).filter((pid) => Number.isInteger(pid) && pid > 1)
  } catch {
    return []
  }
}

async function terminatePids(pids) {
  const unique = [...new Set(pids)]
  for (const pid of unique) {
    try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ }
  }
  if (unique.length === 0) return
  await new Promise((resolveWait) => setTimeout(resolveWait, 400))
  for (const pid of unique) {
    try {
      process.kill(pid, 0)
      process.kill(pid, 'SIGKILL')
    } catch { /* gone */ }
  }
}

function resolveDshBin(explicit) {
  const fromPath = String(process.env.PATH || '').split(':').map((dir) => join(dir, 'dsh'))
  const candidates = [
    explicit,
    process.env.FDE_DSH_BIN,
    '/opt/homebrew/bin/dsh',
    '/usr/local/bin/dsh',
    ...fromPath,
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return ''
}
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const DEFAULT_START_TIMEOUT_MS = 90_000
const MAX_LOG_LINES = 40

function firstCookie(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : [])
  return values
    .map((value) => String(value).split(';', 1)[0])
    .filter(Boolean)
    .join('; ')
}

function publicOrigin(launchUrl) {
  if (!(launchUrl instanceof URL)) throw new Error('AI 服务公告不是有效 URL')
  if (!['http:', 'https:'].includes(launchUrl.protocol)) {
    throw new Error(`拒绝连接非 HTTP 协议：${launchUrl.protocol}`)
  }
  if (!LOOPBACK_HOSTS.has(launchUrl.hostname.toLowerCase())) {
    throw new Error(`拒绝连接非本机地址：${launchUrl.hostname}`)
  }
  const port = launchUrl.port === '' ? (launchUrl.protocol === 'https:' ? 443 : 80) : Number(launchUrl.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('AI 服务端口无效')
  const host = launchUrl.hostname.includes(':') ? `[${launchUrl.hostname}]` : launchUrl.hostname
  return `${launchUrl.protocol}//${host}:${port}`
}

function parseAnnouncement(text) {
  for (const line of text.split(/\r?\n/u)) {
    const match = line.trim().match(ANNOUNCEMENT_PATTERN)
    if (!match) continue
    try {
      return new URL(match[1])
    } catch {
      return null
    }
  }
  return null
}

function redactSensitiveText(value) {
  return String(value)
    .replace(/([?&]token=)[^&\s]+/giu, '$1[redacted]')
    .replace(/(authorization:\s*(?:bearer|token)\s+)[^\s]+/giu, '$1[redacted]')
    .replace(/(cookie:\s*)[^\r\n]+/giu, '$1[redacted]')
}

function errorMessage(error) {
  return redactSensitiveText(error instanceof Error ? error.message : String(error))
}

function semanticCwd(options, fallback) {
  const cwd = typeof options?.cwd === 'string' && options.cwd.startsWith('/') ? options.cwd : fallback
  const ascii = typeof cwd === 'string' && cwd.startsWith('/') && !/[^\u0000-\u007F]/u.test(cwd) ? cwd : ''
  return { cwd: cwd || '', ascii }
}

function normalizeLogChunk(chunk) {
  return redactSensitiveText(chunk)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
}

export class AiRemoteError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'AiRemoteError'
    this.code = code
    this.details = details
  }
}

export class DshCoreConnector {
  constructor(options = {}) {
    this.bin = resolveDshBin(options.bin)
    this.dshHome = options.dshHome ?? process.env.FDE_DSH_HOME ?? resolve(homedir(), '.dsh-fde-x')
    this.cwd = options.cwd ?? process.env.FDE_AI_WORKSPACE ?? process.cwd()
    this.version = null
    this.patchFile = options.patchFile ?? process.env.FDE_DSH_PATCH ?? resolve(process.cwd(), 'runtime', 'dsh-core.patch.yml')
    this.profileName = options.profileName ?? process.env.FDE_DSH_PROFILE ?? 'fde-x'
    this.runtimeDirectory = dirname(fileURLToPath(import.meta.url))
    this.startTimeoutMs = options.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS
    this.child = null
    this.origin = null
    this.cookie = null
    this.state = 'idle'
    this.startedAt = null
    this.lastError = null
    this.logs = []
    this.startPromise = null
    this.reloadPromise = null
    this.credentialsDirectory = null
    this.credentialsPath = null
    this.streamSockets = new Set()
    this.webSocketClassPromise = null
    this.eventClientId = null
    this.pendingApprovals = new Map()
    this.eventAbort = null
    this.semanticRestarting = false
  }

  kickSemanticIfExited(snapshot) {
    if (!snapshot || snapshot.ready) return
    const reason = String(snapshot.reason || '')
    const detail = String(snapshot.detail || '')
    if (reason !== 'exited' && !detail.includes('exited')) return
    if (this.semanticRestarting || this.state !== 'connected') return
    this.semanticRestarting = true
    void this.semanticOs('/retry-ready', { method: 'POST', body: {} }).finally(() => {
      this.semanticRestarting = false
    })
  }

  status() {
    return {
      state: this.state,
      connected: this.state === 'connected' && Boolean(this.origin && this.cookie && this.child),
      version: this.version,
      pid: this.child?.pid ?? null,
      origin: this.origin,
      workspace: this.cwd,
      dshHome: this.dshHome,
      profile: this.profileName,
      lanPort: process.env.DSH_LAN_ASSIST_PORT || '19527',
      sessionRoot: process.env.FDE_DSH_SESSION_ROOT || join(this.dshHome, 'sessions'),
      storageRoot: process.env.FDE_DSH_STORAGE_ROOT || join(this.dshHome, 'storages'),
      semanticMemoryMode: 'external-adapter',
      credentialsMode: 'ephemeral-copy',
      startedAt: this.startedAt,
      lastError: this.lastError,
      recentLogs: this.logs.slice(-MAX_LOG_LINES),
    }
  }

  async start() {
    if (this.state === 'connected') return this.status()
    if (this.startPromise) return this.startPromise
    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  async reload() {
    if (this.reloadPromise) return this.reloadPromise
    this.reloadPromise = this.reloadInternal().finally(() => {
      this.reloadPromise = null
    })
    return this.reloadPromise
  }

  async reloadInternal() {
    if (this.startPromise) await this.startPromise
    await this.stop()
    return this.start()
  }

  async startInternal() {
    this.state = 'starting'
    this.lastError = null
    this.logs = []
    if (!this.bin) throw new Error('找不到 dsh。请安装 DeepSeek Harness，或设置 FDE_DSH_BIN 指向 dsh 可执行文件。')
    await access(this.bin, constants.R_OK)
    try {
      const require = createRequire(realpathSync(this.bin))
      this.version = require('@deepseek-ai/dsh/package.json').version ?? null
    } catch {
      this.version = null
    }
    await access(this.cwd, constants.R_OK)
    await access(this.patchFile, constants.R_OK)
    await this.prepareCredentialsCopy()
    await this.ensureIsolatedProfile()
    await this.reclaimStrayProcesses()
    const semanticaPython = await this.ensureSharedSemanticRuntime()

    const child = spawn(process.execPath, [
      '--max-http-header-size=131072',
      this.bin,
      '--profile', this.profileName,
      '--patch', this.patchFile,
      '--host', '127.0.0.1',
      '--port', '0',
      '--no-open',
    ], {
      cwd: this.cwd,
      env: {
        ...process.env,
        DSH_HOME: this.dshHome,
        DSH_PERMISSION_MODE: process.env.DSH_PERMISSION_MODE || 'danger-full-access',
        DSH_LAN_ASSIST_PORT: process.env.DSH_LAN_ASSIST_PORT || '19527',
        FDE_AI_WORKSPACE: this.cwd,
        FDE_DSH_CREDENTIALS_PATH: this.credentialsPath,
        ...(process.env.DSH_SEMANTICA_PYTHON || semanticaPython ? { DSH_SEMANTICA_PYTHON: process.env.DSH_SEMANTICA_PYTHON || semanticaPython } : {}),
        ...(process.env.FDE_DSH_SESSION_ROOT ? { FDE_DSH_SESSION_ROOT: process.env.FDE_DSH_SESSION_ROOT } : {}),
        ...(process.env.FDE_DSH_STORAGE_ROOT ? { FDE_DSH_STORAGE_ROOT: process.env.FDE_DSH_STORAGE_ROOT } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.child = child

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk) => this.captureLogs(chunk))
    child.stderr?.on('data', (chunk) => this.captureLogs(chunk))
    child.once('exit', (code, signal) => {
      const expected = this.state === 'stopping' || this.state === 'stopped'
      this.closeStreams()
      this.child = null
      this.cookie = null
      this.origin = null
      if (expected) {
        this.state = 'stopped'
      } else {
        this.state = 'error'
        this.lastError = `AI 服务意外退出：${signal ? `signal ${signal}` : `code ${code}`}`
      }
      void this.cleanupCredentialsCopy()
    })

    try {
      const launchUrl = await this.waitForAnnouncement(child)
      const origin = publicOrigin(launchUrl)
      const first = await fetch(launchUrl, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
      if (first.status !== 303) throw new Error(`AI 服务认证交换失败：HTTP ${first.status}`)
      const cookie = firstCookie(first)
      if (!cookie) throw new Error('AI 服务没有返回会话凭据')
      const location = first.headers.get('location')
      if (!location) throw new Error('AI 服务认证响应缺少跳转地址')
      const readiness = await fetch(new URL(location, launchUrl), {
        headers: { cookie },
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
      })
      if (readiness.status !== 200) throw new Error(`AI 服务尚未就绪：HTTP ${readiness.status}`)

      this.origin = origin
      this.cookie = cookie
      this.state = 'connected'
      this.startedAt = new Date().toISOString()
      void this.pumpRemoteEvents()
      return this.status()
    } catch (error) {
      this.state = 'error'
      this.lastError = errorMessage(error)
      await this.stopChild()
      throw error
    }
  }

  pluginSourceCandidates(name) {
    const envKey = `FDE_PLUGIN_${name.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`
    const fromEnv = process.env[envKey]
    const webLink = join(this.dshHome, 'profiles', 'web', 'node_modules', name)
    const candidates = []
    if (fromEnv) candidates.push(fromEnv)
    try {
      if (existsSync(webLink)) candidates.push(realpathSync(webLink))
    } catch {
      /* ignore unreadable web profile link */
    }
    return candidates
  }

  async linkReadablePlugin(name, modulesDir) {
    const vendor = join(this.dshHome, 'vendor', name)
    const link = join(modulesDir, name)
    if (process.env.FDE_REFRESH_PLUGINS === '1') {
      await rm(vendor, { recursive: true, force: true })
    }
    if (!existsSync(vendor)) {
      for (const source of this.pluginSourceCandidates(name)) {
        try {
          await access(source, constants.R_OK)
          await mkdir(dirname(vendor), { recursive: true })
          await cp(source, vendor, { recursive: true, dereference: true })
          break
        } catch {
          /* try next candidate */
        }
      }
    }
    if (!existsSync(vendor)) return false
    await rm(link, { recursive: true, force: true })
    await symlink(vendor, link)
    return true
  }

  async ensureIsolatedProfile() {
    const dir = join(this.dshHome, 'profiles', this.profileName)
    const modules = join(dir, 'node_modules')
    await mkdir(modules, { recursive: true })
    const extras = []
    for (const name of ['dsh-lan-assist', 'dsh-semantic-os']) {
      if (await this.linkReadablePlugin(name, modules)) extras.push(name)
    }
    const manifest = {
      name: `dsh-profile-${this.profileName}`,
      private: true,
      dsh: {
        profile: {
          bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', ...extras],
        },
      },
    }
    await writeFile(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await writeFile(join(dir, 'cordis.yml'), '[]\n')
    try {
      await access(join(dir, 'cordis.patch.yml'))
    } catch {
      await writeFile(join(dir, 'cordis.patch.yml'), '[]\n')
    }
    const bridgeSource = resolve(this.runtimeDirectory, 'fde-x-dsh-bridge')
    const bridgeLink = join(modules, 'fde-x-dsh-bridge')
    await rm(bridgeLink, { recursive: true, force: true })
    await symlink(bridgeSource, bridgeLink)
  }

  async ensureSharedSemanticRuntime() {
    const destDir = join(this.dshHome, 'semantic-os')
    const destRuntime = join(destDir, 'runtime')
    const exe = process.platform === 'win32' ? 'python.exe' : 'python3'
    const pythonOf = (root, version, key) => join(root, String(version || ''), String(key || ''), 'python', 'bin', exe)

    const destOwned = await this.ownedSemanticRuntime(destRuntime)
    if (destOwned) return destOwned

    const source = await this.findSemanticRuntimeSource()
    if (!source) return ''

    await mkdir(destDir, { recursive: true })
    const staging = `${destRuntime}.staging-${process.pid}`
    await rm(staging, { recursive: true, force: true })
    await mkdir(join(staging, source.version), { recursive: true })
    await cp(source.tree, join(staging, source.version, source.key), { recursive: true, dereference: true })
    await writeFile(join(staging, 'current.json'), `${JSON.stringify({
      schemaVersion: 1,
      runtimeVersion: source.version,
      key: source.key,
      manifestDigest: source.digest || '',
      installedAt: new Date().toISOString(),
    }, null, 2)}\n`)
    await rm(destRuntime, { recursive: true, force: true })
    await cp(staging, destRuntime, { recursive: true })
    await rm(staging, { recursive: true, force: true })

    const python = pythonOf(destRuntime, source.version, source.key)
    const destState = join(destDir, 'install-state.json')
    try {
      await access(destState, constants.R_OK)
    } catch {
      const officialState = join(homedir(), '.dsh', 'semantic-os', 'install-state.json')
      try {
        const raw = JSON.parse(await readFile(officialState, 'utf8'))
        if (raw && raw.status) {
          raw.status.python = python
          if (raw.status.semantica) raw.status.semantica.python = python
        }
        await writeFile(destState, `${JSON.stringify(raw, null, 2)}\n`)
      } catch { /* sidecar 自己探 */ }
    }
    return python
  }

  async ownedSemanticRuntime(destRuntime) {
    try {
      const st = await lstat(destRuntime)
      if (st.isSymbolicLink()) return ''
      const current = JSON.parse(await readFile(join(destRuntime, 'current.json'), 'utf8'))
      const exe = process.platform === 'win32' ? 'python.exe' : 'python3'
      const python = join(destRuntime, String(current.runtimeVersion || ''), String(current.key || ''), 'python', 'bin', exe)
      await access(python, constants.X_OK)
      return python
    } catch {
      return ''
    }
  }

  async findSemanticRuntimeSource() {
    const officialRuntime = join(homedir(), '.dsh', 'semantic-os', 'runtime')
    const vendorDist = join(this.dshHome, 'vendor', 'dsh-semantic-os', 'runtime-dist')
    const officialCurrent = join(officialRuntime, 'current.json')
    try {
      const current = JSON.parse(await readFile(officialCurrent, 'utf8'))
      const version = String(current.runtimeVersion || '')
      const key = String(current.key || `${process.platform}-${process.arch}`)
      const tree = join(officialRuntime, version, key)
      await access(join(tree, 'runtime-manifest.json'), constants.R_OK)
      return { version, key, tree, digest: String(current.manifestDigest || '') }
    } catch { /* 没有官方已装 runtime 就用插件自带的 dist */ }
    try {
      const key = `${process.platform}-${process.arch}`
      const tree = join(vendorDist, key)
      await access(join(tree, 'runtime-manifest.json'), constants.R_OK)
      let digest = ''
      try {
        const manifest = JSON.parse(await readFile(join(tree, 'runtime-manifest.json'), 'utf8'))
        return { version: String(manifest.runtimeVersion || '0.1.1'), key, tree, digest }
      } catch {
        return { version: '0.1.1', key, tree, digest }
      }
    } catch {
      return null
    }
  }

  async prepareCredentialsCopy() {
    await this.cleanupCredentialsCopy()
    const source = resolve(this.dshHome, '.credentials.yaml')
    await access(source, constants.R_OK)
    const directory = await mkdtemp(join(tmpdir(), 'fde-x-dsh-credentials-'))
    await chmod(directory, 0o700)
    const target = join(directory, '.credentials.yaml')
    try {
      await copyFile(source, target, constants.COPYFILE_EXCL)
      await chmod(target, 0o600)
      this.credentialsDirectory = directory
      this.credentialsPath = target
    } catch (error) {
      await rm(directory, { recursive: true, force: true })
      throw error
    }
  }

  async cleanupCredentialsCopy() {
    const directory = this.credentialsDirectory
    this.credentialsDirectory = null
    this.credentialsPath = null
    if (!directory) return
    await rm(directory, { recursive: true, force: true })
  }

  captureLogs(chunk) {
    this.logs.push(...normalizeLogChunk(chunk))
    if (this.logs.length > MAX_LOG_LINES) this.logs.splice(0, this.logs.length - MAX_LOG_LINES)
  }

  waitForAnnouncement(child) {
    return new Promise((resolveAnnouncement, reject) => {
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`AI 服务在 ${this.startTimeoutMs}ms 内未完成启动`))
      }, this.startTimeoutMs)

      const onStdout = (chunk) => {
        stdout += String(chunk)
        const announcement = parseAnnouncement(stdout)
        if (announcement) {
          cleanup()
          resolveAnnouncement(announcement)
        }
      }
      const onStderr = (chunk) => {
        stderr += String(chunk)
      }
      const onExit = (code, signal) => {
        cleanup()
        const detail = redactSensitiveText(stderr.trim()).split(/\r?\n/u).filter(Boolean).slice(0, 6).join(' | ')
        const reason = signal ? `signal ${signal}` : `code ${code}`
        reject(new Error(detail ? `AI 服务启动前退出（${reason}）：${detail}` : `AI 服务启动前退出（${reason}）`))
      }
      const onError = (error) => {
        cleanup()
        reject(error)
      }
      const cleanup = () => {
        clearTimeout(timer)
        child.stdout?.off('data', onStdout)
        child.stderr?.off('data', onStderr)
        child.off('exit', onExit)
        child.off('error', onError)
      }

      child.stdout?.on('data', onStdout)
      child.stderr?.on('data', onStderr)
      child.once('exit', onExit)
      child.once('error', onError)
    })
  }

  assertConnected() {
    if (this.state !== 'connected' || !this.origin || !this.cookie || !this.child) {
      throw new AiRemoteError('ai/not-connected', '核心 AI 运行时尚未连接')
    }
  }

  validEndpoint(endpoint) {
    return endpoint === '$events' || endpoint === '$events/result' || /^[A-Za-z0-9_$.-]+\/[A-Za-z0-9_$.-]+$/u.test(endpoint)
  }

  async pumpRemoteEvents() {
    this.eventAbort?.abort()
    const abort = new AbortController()
    this.eventAbort = abort
    this.pendingApprovals.clear()
    this.eventClientId = null
    try {
      for await (const frame of this.stream('$events', {}, abort.signal)) {
        if (!frame || typeof frame !== 'object') continue
        if (frame.type === 'ready' && typeof frame.clientId === 'string') {
          this.eventClientId = frame.clientId
          continue
        }
        if (frame.type === 'waterfall' && frame.event === 'approval/request' && typeof frame.eventId === 'string') {
          this.pendingApprovals.set(frame.eventId, {
            eventId: frame.eventId,
            agentId: typeof frame.agentId === 'string' ? frame.agentId : '',
            event: frame.event,
            request: frame.request && typeof frame.request === 'object' ? frame.request : {},
          })
          continue
        }
        if (frame.type === 'cancel' && typeof frame.eventId === 'string') {
          this.pendingApprovals.delete(frame.eventId)
        }
      }
    } catch {
      if (!abort.signal.aborted) this.eventClientId = null
    }
  }

  pendingApprovalFor(sessionId) {
    for (const pending of this.pendingApprovals.values()) {
      if (pending.agentId === sessionId) return pending
    }
    return null
  }

  async semanticOs(path, options = {}) {
    this.assertConnected()
    if (path === '/python') {
      const op = options.op
      if (op !== 'list_memory_cards' && op !== 'draft_memory_card') {
        throw new AiRemoteError('ai/forbidden', '记忆操作不允许')
      }
      const { cwd, ascii } = semanticCwd(options, this.cwd)
      const url = new URL('/semantic-os/python', this.origin)
      if (cwd) url.searchParams.set('cwd', cwd)
      const headers = {
        'content-type': 'application/json',
        cookie: this.cookie,
        origin: this.origin,
      }
      if (ascii) headers['x-dsh-cwd'] = ascii
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ op, cwd, args: options.args ?? {} }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new AiRemoteError(payload.error || 'ai/memory-error', payload.hint || payload.error || `记忆调用失败：HTTP ${response.status}`)
      }
      return payload
    }
    const semanticPages = new Set(['/ready', '/retry-ready', '/settings', '/deps', '/usage', '/session-ingest', '/session-ingest/now', '/people', '/settings/probe'])
    if (semanticPages.has(path)) {
      const { cwd: requestCwd, ascii: asciiCwd } = semanticCwd(options, this.cwd)
      const url = new URL(`/semantic-os${path}`, this.origin)
      if (requestCwd) url.searchParams.set('cwd', requestCwd)
      const method = options.method ?? ((path === '/ready' || path === '/deps' || path === '/usage' || path === '/session-ingest' || path === '/people' || path === '/settings/probe' || (path === '/settings' && !options.body)) ? 'GET' : 'POST')
      const headers = {
        'content-type': 'application/json',
        cookie: this.cookie,
        origin: this.origin,
      }
      if (asciiCwd) headers['x-dsh-cwd'] = asciiCwd
      const response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new AiRemoteError(payload.error || 'ai/memory-error', payload.hint || payload.error || `语义设置失败：HTTP ${response.status}`)
      }
      return payload
    }
    if (path !== '/find') throw new AiRemoteError('ai/forbidden', '记忆路径不允许')
    const found = semanticCwd(options, this.cwd)
    const url = new URL(`/semantic-os${path}`, this.origin)
    if (found.cwd) url.searchParams.set('cwd', found.cwd)
    const findHeaders = {
      'content-type': 'application/json',
      cookie: this.cookie,
      origin: this.origin,
    }
    if (found.ascii) findHeaders['x-dsh-cwd'] = found.ascii
    const response = await fetch(url, {
      method: 'POST',
      headers: findHeaders,
      body: JSON.stringify({ query: options.query ?? '', cwd: found.cwd }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new AiRemoteError(payload.error || 'ai/memory-error', payload.hint || payload.error || `记忆搜索失败：HTTP ${response.status}`)
    }
    return payload
  }

  async lanAssist(path, options = {}) {
    this.assertConnected()
    const allowed = new Set(['/state', '/thread', '/attach', '/attach/copy', '/send', '/reply', '/reply/draft', '/compose', '/read', '/shout', '/sleep', '/withdraw', '/presend/cancel', '/pair/mint', '/pair/handshake', '/pair/accept', '/pair/reject', '/name', '/note', '/unpair', '/peer/flags', '/door', '/group/create', '/group/update', '/group/dissolve', '/preview', '/translate', '/write', '/lookup/config', '/catalog/publish'])
    if (!allowed.has(path)) throw new AiRemoteError('ai/forbidden', 'IM 路径不允许')
    const url = new URL(`/lan-assist${path}`, this.origin)
    if (options.search && typeof options.search === 'object') {
      for (const [key, value] of Object.entries(options.search)) {
        if (value != null && value !== '') url.searchParams.set(key, String(value))
      }
    }
    const response = await fetch(url, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: {
        'content-type': 'application/json',
        cookie: this.cookie,
        origin: this.origin,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new AiRemoteError(payload.error || 'ai/im-error', payload.hint || payload.error || `IM 调用失败：HTTP ${response.status}`)
    }
    return payload
  }

  async decideApproval(sessionId, outcome) {
    this.assertConnected()
    if (!this.eventClientId) throw new AiRemoteError('ai/approval-unavailable', '审批通道尚未就绪')
    if (!['allowed-once', 'rejected', 'cancelled'].includes(outcome)) {
      throw new AiRemoteError('ai/invalid-approval', '审批结果无效')
    }
    const pending = this.pendingApprovalFor(sessionId)
    if (!pending) throw new AiRemoteError('ai/approval-missing', '当前没有等待确认的操作')
    await this.call('$events/result', {
      clientId: this.eventClientId,
      eventId: pending.eventId,
      outcome: { kind: 'result', value: outcome },
    })
    this.pendingApprovals.delete(pending.eventId)
    return { eventId: pending.eventId, outcome }
  }

  async call(endpoint, args = {}, signal) {
    return this.rpc(endpoint, args, signal)
  }

  async rpc(endpoint, args = {}, signal) {
    this.assertConnected()
    if (!this.validEndpoint(endpoint)) {
      throw new AiRemoteError('ai/invalid-endpoint', 'AI 远程方法名称无效')
    }

    const rpcId = randomUUID()
    const response = await fetch(new URL(`/api/${endpoint}`, this.origin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: this.cookie,
        origin: this.origin,
      },
      body: JSON.stringify({
        type: 'client-request',
        rpcId,
        method: endpoint,
        payload: { args },
      }),
      signal,
    })
    if (!response.ok) throw new AiRemoteError('ai/transport', `AI 远程调用失败：HTTP ${response.status}`, { endpoint })

    const envelope = await response.json()
    if (!envelope || envelope.type !== 'server-response' || envelope.rpcId !== rpcId || !envelope.result) {
      throw new AiRemoteError('ai/invalid-response', 'AI 远程响应格式无效', { endpoint })
    }
    if (envelope.result.ok !== true) {
      const remote = envelope.result.error ?? {}
      throw new AiRemoteError(remote.code ?? 'ai/remote-error', remote.message ?? 'AI 远程调用失败', remote.details ?? {})
    }
    return envelope.result.value
  }

  async webSocketClass() {
    if (!this.webSocketClassPromise) {
      const realBin = realpathSync(this.bin)
      const require = createRequire(realBin)
      let modulePath
      try {
        modulePath = require.resolve('ws/wrapper.mjs')
      } catch {
        modulePath = require.resolve('ws')
      }
      this.webSocketClassPromise = import(pathToFileURL(modulePath).href).then((module) => module.default ?? module.WebSocket)
    }
    return this.webSocketClassPromise
  }

  async *stream(endpoint, args = {}, signal) {
    this.assertConnected()
    if (!this.validEndpoint(endpoint)) {
      throw new AiRemoteError('ai/invalid-endpoint', 'AI 远程流方法名称无效')
    }

    const WebSocket = await this.webSocketClass()
    const streamId = randomUUID()
    const wsUrl = new URL('/api/remote.mux', this.origin)
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(wsUrl, {
      headers: {
        cookie: this.cookie,
        origin: this.origin,
      },
      handshakeTimeout: 15_000,
      maxPayload: 16 * 1024 * 1024,
    })
    this.streamSockets.add(socket)

    const queue = []
    let wake = null
    let terminalError = null
    let ended = false

    const notify = () => {
      const current = wake
      wake = null
      current?.()
    }
    const closeSocket = () => {
      this.streamSockets.delete(socket)
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        try { socket.close(1000, 'stream closed') } catch { /* already closed */ }
      }
    }
    const cancel = () => {
      if (socket.readyState === WebSocket.OPEN) {
        try { socket.send(JSON.stringify({ type: 'cancel', streamId })) } catch { /* closing */ }
      }
      ended = true
      notify()
      closeSocket()
    }
    const onAbort = () => cancel()
    signal?.addEventListener('abort', onAbort, { once: true })

    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        terminalError = new AiRemoteError('ai/invalid-stream', '核心 AI 返回了不支持的二进制流帧')
        ended = true
        notify()
        return
      }
      let message
      try {
        message = JSON.parse(Buffer.from(data).toString('utf8'))
      } catch {
        terminalError = new AiRemoteError('ai/invalid-stream', '核心 AI 返回了无效流帧')
        ended = true
        notify()
        return
      }
      if (!message || message.streamId !== streamId) return
      if (message.type === 'item') queue.push(message.value)
      else if (message.type === 'end') ended = true
      else if (message.type === 'error') {
        const remote = message.error ?? {}
        terminalError = new AiRemoteError(remote.code ?? 'ai/remote-stream-error', remote.message ?? '核心 AI 流执行失败', remote.details ?? {})
        ended = true
      }
      notify()
    })
    socket.on('error', (error) => {
      terminalError = new AiRemoteError('ai/stream-transport', errorMessage(error), { endpoint })
      ended = true
      notify()
    })
    socket.on('close', (code) => {
      this.streamSockets.delete(socket)
      if (!ended && code !== 1000) terminalError = new AiRemoteError('ai/stream-closed', `核心 AI 流连接意外关闭：${code}`, { endpoint })
      ended = true
      notify()
    })

    await new Promise((resolveOpen, rejectOpen) => {
      const onOpen = () => {
        cleanup()
        resolveOpen()
      }
      const onError = (error) => {
        cleanup()
        rejectOpen(new AiRemoteError('ai/stream-connect', errorMessage(error), { endpoint }))
      }
      const onClose = (code) => {
        cleanup()
        rejectOpen(new AiRemoteError('ai/stream-connect', `核心 AI 流连接在打开前关闭：${code}`, { endpoint }))
      }
      const cleanup = () => {
        socket.off('open', onOpen)
        socket.off('error', onError)
        socket.off('close', onClose)
      }
      socket.once('open', onOpen)
      socket.once('error', onError)
      socket.once('close', onClose)
    })

    socket.send(JSON.stringify({
      type: 'open',
      streamId,
      endpoint,
      payload: { args },
    }))

    try {
      while (true) {
        while (queue.length > 0) yield queue.shift()
        if (terminalError) throw terminalError
        if (ended) return
        await new Promise((resolveWake) => { wake = resolveWake })
      }
    } finally {
      signal?.removeEventListener('abort', onAbort)
      cancel()
    }
  }

  closeStreams() {
    this.eventAbort?.abort()
    this.eventAbort = null
    this.eventClientId = null
    this.pendingApprovals.clear()
    for (const socket of this.streamSockets) {
      try { socket.close(1001, 'AI runtime stopping') } catch { /* already closed */ }
    }
    this.streamSockets.clear()
  }

  async reclaimStrayProcesses() {
    const keep = new Set([process.pid, this.child?.pid].filter(Boolean))
    const profilePids = await pidsMatching(`--profile ${this.profileName} --patch`)
    const lanPids = await pidsListening(process.env.DSH_LAN_ASSIST_PORT || '19527')
    const stray = [...profilePids, ...lanPids].filter((pid) => !keep.has(pid))
    if (stray.length === 0) return
    this.logs.push(`[fde-x] 清掉残留核心 ${stray.join(',')}`)
    await terminatePids(stray)
  }

  async stop() {
    this.closeStreams()
    if (!this.child) {
      this.state = 'stopped'
      this.cookie = null
      this.origin = null
      await this.reclaimStrayProcesses()
      return this.status()
    }
    this.state = 'stopping'
    await this.stopChild()
    this.child = null
    await this.reclaimStrayProcesses()
    this.state = 'stopped'
    this.cookie = null
    this.origin = null
    return this.status()
  }

  async stopChild() {
    const child = this.child
    if (!child) return
    await new Promise((resolveStop) => {
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL') } catch { /* already exited */ }
      }, 5_000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolveStop()
      })
      try {
        child.kill('SIGTERM')
      } catch {
        clearTimeout(timer)
        resolveStop()
      }
    })
    await this.cleanupCredentialsCopy()
  }
}

export function createCoreConnector(options) {
  return new DshCoreConnector(options)
}
