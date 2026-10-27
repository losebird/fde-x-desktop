/**
 * One semantica==0.7.0 sidecar process.
 * retryReady = dispose then spawn. Changing a live child's env is a no-op.
 * @module dsh-semantic-os/sidecar
 */

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDshLlm } from './dsh-llm.js'
import { DEFAULT_START_TIMEOUT_MS } from './persist.js'
import { ensureDeps, probeDeps } from './ensure-deps.js'
import { createInstaller } from './installer.js'
import { homedir } from 'node:os'
import { mkdirSync } from 'node:fs'

const BOOTSTRAP = join(dirname(fileURLToPath(import.meta.url)), 'python', 'bootstrap.py')
const READY_PREFIX = 'DSH_SEMANTIC_OS '
const EXPECTED_VERSION = '0.7.0'

/**
 * @typedef {{
 *   ready: boolean,
 *   reason?: string,
 *   detail?: string,
 *   version?: string | null,
 *   python?: string | null,
 *   port?: number | null,
 *   doctor?: string,
 *   pid?: number | null,
 * }} SidecarState
 */

/**
 * @param {() => { pythonPath?: string, startTimeoutMs?: number, apiKeyEnv?: string }} getConfig
 */
export function createSidecar(getConfig) {
  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null
  /** @type {SidecarState} */
  let state = blankState()
  /** @type {string} */
  let apiKey = ''
  let starting = Promise.resolve()
  const installer = createInstaller({ probe: probeDeps, install: ensureDeps, getConfig })
  /** @type {Array<(snap: SidecarState) => void>} */
  const readyHooks = []

  function snapshot() {
    return { ...state, hasKey: Boolean(apiKey), install: installer.snapshot() }
  }

  function getApiKey() {
    return apiKey
  }

  async function start() {
    starting = starting.then(() => spawnOnce()).catch((error) => {
      state = {
        ...blankState(),
        ready: false,
        reason: 'start_failed',
        detail: error instanceof Error ? error.message : String(error),
        python: state.python,
      }
    })
    await starting
    const snap = snapshot()
    if (snap.ready) {
      for (const fn of readyHooks) {
        try { fn(snap) } catch { /* ignore */ }
      }
    }
    return snap
  }

  function onReady(fn) {
    if (typeof fn === 'function') readyHooks.push(fn)
    return () => {
      const at = readyHooks.indexOf(fn)
      if (at >= 0) readyHooks.splice(at, 1)
    }
  }

  async function retryReady() {
    await dispose()
    return start()
  }

  async function dispose() {
    const current = child
    child = null
    if (!current || current.killed) {
      state = { ...state, ready: false, port: null, pid: null }
      return
    }
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try { current.kill('SIGKILL') } catch { /* ignore */ }
      }, 3000)
      current.once('exit', () => {
        clearTimeout(timer)
        resolve(undefined)
      })
      try { current.kill('SIGTERM') } catch {
        clearTimeout(timer)
        resolve(undefined)
      }
    })
    state = { ...state, ready: false, port: null, pid: null }
  }

  async function spawnOnce() {
    const prepared = await installer.ensure()
    if (!prepared.ok) {
      state = {
        ...blankState(),
        ready: false,
        reason: prepared.error || 'install_failed',
        detail: prepared.detail || 'dependency installation failed',
        doctor: prepared.detail || '',
      }
      return
    }
    const config = getConfig()
    const timeoutMs = positive(config.startTimeoutMs, DEFAULT_START_TIMEOUT_MS)
    const installedPython = prepared.status && prepared.status.python
    const resolved = installedPython && prepared.status.semantica && prepared.status.semantica.ok
      ? { ok: true, argv: [String(installedPython), BOOTSTRAP], command: String(installedPython), version: prepared.status.semantica.version }
      : await resolvePython(config.pythonPath)
    if (!resolved.ok) {
      state = {
        ...blankState(),
        ready: false,
        reason: resolved.reason,
        detail: resolved.detail,
        version: resolved.version,
        python: resolved.command,
        doctor: resolved.detail,
      }
      return
    }

    apiKey = resolveApiKey(config.apiKeyEnv)
    const llm = readDshLlm()
    const cacheRoot = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'semantic-os', 'cache')
    mkdirSync(cacheRoot, { recursive: true })
    const env = {
      ...process.env,
      OMP_NUM_THREADS: process.env.OMP_NUM_THREADS || '1',
      SEMANTICA_API_KEY: apiKey,
      DSH_SEMANTICA_PORT: '0',
      DSH_LLM_PROVIDER: llm.dshProvider || llm.semanticaProvider || '',
      DSH_LLM_MODEL: llm.model || '',
      DSH_LLM_API: llm.api || '',
      XDG_CACHE_HOME: cacheRoot,
      MPLCONFIGDIR: join(cacheRoot, 'matplotlib'),
      NUMBA_CACHE_DIR: join(cacheRoot, 'numba'),
      HF_HOME: join(cacheRoot, 'huggingface'),
      PYTHONPYCACHEPREFIX: join(cacheRoot, 'pycache'),
    }
    if (llm.apiKey) {
      env.DSH_LLM_API_KEY = llm.apiKey
      if (llm.apiKeyEnv) env[llm.apiKeyEnv] = llm.apiKey
    }
    if (llm.baseUrl) {
      env.OPENAI_BASE_URL = llm.baseUrl
      env.DSH_LLM_BASE_URL = llm.baseUrl
    }
    delete env.SEMANTICA_ALLOW_ANONYMOUS

    const result = await launch(resolved.argv, env, timeoutMs, resolved.command, cacheRoot)
    state = { ...result, llmProvider: llm.dshProvider, llmModel: llm.model, llmReady: llm.configured }
    if (!result.ready) {
      await killQuiet(child)
      child = null
    }
  }

  /**
   * @param {string[]} argv
   * @param {NodeJS.ProcessEnv} env
   * @param {number} timeoutMs
   * @param {string} pythonLabel
   * @returns {Promise<SidecarState>}
   */
  function launch(argv, env, timeoutMs, pythonLabel, cwd) {
    return new Promise((resolve) => {
      let settled = false
      let stdout = ''
      let stderr = ''
      const proc = spawn(argv[0], argv.slice(1), {
        env,
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      child = proc

      const timer = setTimeout(() => {
        finish({
          ready: false,
          reason: 'start_timeout',
          detail: `doctor+REST did not become ready in ${timeoutMs}ms`,
          version: null,
          python: pythonLabel,
          port: null,
          doctor: trimLog(stdout, stderr),
          pid: proc.pid ?? null,
        })
        try { proc.kill('SIGTERM') } catch { /* ignore */ }
      }, timeoutMs)

      const finish = (next) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(next)
      }

      const onChunk = (chunk, stream) => {
        const text = String(chunk)
        if (stream === 'stdout') stdout += text
        else stderr += text
        const line = findReadyLine(stream === 'stdout' ? stdout : `${stdout}\n${stderr}`)
        if (!line) return
        finish({
          ...line,
          python: pythonLabel,
          doctor: line.doctor || trimLog(stdout, stderr),
          pid: proc.pid ?? null,
        })
      }

      proc.stdout?.on('data', (chunk) => onChunk(chunk, 'stdout'))
      proc.stderr?.on('data', (chunk) => onChunk(chunk, 'stderr'))
      proc.on('error', (error) => {
        finish({
          ready: false,
          reason: 'spawn_failed',
          detail: error.message,
          version: null,
          python: pythonLabel,
          port: null,
          doctor: error.message,
          pid: null,
        })
      })
      proc.on('exit', (code, signal) => {
        if (child === proc) child = null
        if (settled && state.ready && state.pid === proc.pid) {
          state = { ...state, ready: false, port: null, reason: 'exited', detail: `exit ${code ?? signal}` }
          return
        }
        finish({
          ready: false,
          reason: 'exited',
          detail: `python exited ${code ?? signal}`,
          version: null,
          python: pythonLabel,
          port: null,
          doctor: trimLog(stdout, stderr),
          pid: null,
        })
      })
    })
  }

  return { start, retryReady, dispose, snapshot, getApiKey, onReady, retryInstall: () => installer.ensure(true) }
}

function blankState() {
  return {
    ready: false,
    reason: 'not_started',
    detail: '',
    version: null,
    python: null,
    port: null,
    doctor: '',
    pid: null,
  }
}

function positive(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function resolveApiKey(apiKeyEnv) {
  const name = String(apiKeyEnv || '').trim()
  if (name && process.env[name]) return String(process.env[name])
  if (process.env.SEMANTICA_API_KEY) return String(process.env.SEMANTICA_API_KEY)
  return randomBytes(24).toString('hex')
}

/**
 * Honor DSH_SEMANTICA_PYTHON, then config, then platform defaults.
 * @param {string | undefined} configured
 */
export async function resolvePython(configured) {
  const seen = new Set()
  for (const candidate of pythonCandidates(configured)) {
    const key = candidate.argv.join('\0')
    if (seen.has(key)) continue
    seen.add(key)
    const probed = await probePython(candidate.argv)
    if (probed.ok) {
      return { ok: true, argv: [...candidate.argv, BOOTSTRAP], command: candidate.label, version: probed.version }
    }
    if (candidate.strict) {
      return {
        ok: false,
        reason: probed.reason,
        detail: probed.detail,
        version: probed.version,
        command: candidate.label,
        argv: candidate.argv,
      }
    }
  }
  return {
    ok: false,
    reason: 'wheel_missing',
    detail: 'no python with semantica==0.7.0 (set DSH_SEMANTICA_PYTHON)',
    version: null,
    command: null,
    argv: [],
  }
}

function pythonCandidates(configured) {
  /** @type {{ argv: string[], label: string, strict?: boolean }[]} */
  const out = []
  const envPath = process.env.DSH_SEMANTICA_PYTHON
  if (envPath) out.push({ argv: splitCmd(envPath), label: envPath, strict: true })
  if (configured && String(configured).trim()) {
    const value = String(configured).trim()
    out.push({ argv: splitCmd(value), label: value, strict: true })
  }
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const venv = process.platform === 'win32'
    ? join(home, 'semantic-os', 'venv', 'Scripts', 'python.exe')
    : join(home, 'semantic-os', 'venv', 'bin', 'python')
  out.push({ argv: [venv], label: venv })
  if (process.platform === 'win32') {
    out.push({ argv: ['py', '-3'], label: 'py -3' })
    out.push({ argv: ['python'], label: 'python' })
    out.push({ argv: ['python3'], label: 'python3' })
  } else {
    out.push({ argv: ['python3'], label: 'python3' })
    out.push({ argv: ['python'], label: 'python' })
  }
  return out
}

function splitCmd(value) {
  const text = String(value).trim()
  if (!text.includes(' ')) return [text]
  return text.split(/\s+/).filter(Boolean)
}

function probePython(argv) {
  const script = [
    'import importlib.metadata as m, sys',
    'try:',
    '  print(m.version("semantica"))',
    'except Exception as e:',
    '  print("ERR", type(e).__name__, e, file=sys.stderr)',
    '  sys.exit(2)',
  ].join('\n')
  return new Promise((resolve) => {
    const proc = spawn(argv[0], [...argv.slice(1), '-c', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL') } catch { /* ignore */ }
      resolve({ ok: false, reason: 'python_timeout', detail: 'python probe timed out', version: null })
    }, 8000)
    proc.stdout?.on('data', (chunk) => { stdout += String(chunk) })
    proc.stderr?.on('data', (chunk) => { stderr += String(chunk) })
    proc.on('error', (error) => {
      clearTimeout(timer)
      resolve({ ok: false, reason: 'python_missing', detail: error.message, version: null })
    })
    proc.on('exit', (code) => {
      clearTimeout(timer)
      const version = stdout.trim().split(/\s+/)[0] || ''
      if (code !== 0 || !version) {
        resolve({
          ok: false,
          reason: 'wheel_missing',
          detail: stderr.trim() || `exit ${code}`,
          version: version || null,
        })
        return
      }
      if (version !== EXPECTED_VERSION) {
        resolve({
          ok: false,
          reason: 'version_mismatch',
          detail: `semantica==${version}`,
          version,
        })
        return
      }
      resolve({ ok: true, version })
    })
  })
}

function findReadyLine(buffer) {
  const lines = String(buffer).split(/\r?\n/)
  for (const line of lines) {
    const idx = line.indexOf(READY_PREFIX)
    if (idx === -1) continue
    try {
      const parsed = JSON.parse(line.slice(idx + READY_PREFIX.length))
      if (!parsed || typeof parsed !== 'object') continue
      return {
        ready: Boolean(parsed.ready),
        reason: parsed.reason ? String(parsed.reason) : (parsed.ready ? undefined : 'not_ready'),
        detail: parsed.detail ? String(parsed.detail) : '',
        version: parsed.version == null ? null : String(parsed.version),
        port: Number.isFinite(Number(parsed.port)) ? Number(parsed.port) : null,
        doctor: parsed.doctor ? String(parsed.doctor) : '',
      }
    } catch {
      // keep scanning
    }
  }
  return null
}

function trimLog(stdout, stderr) {
  return [stdout, stderr].filter(Boolean).join('\n').slice(-8000)
}

async function killQuiet(proc) {
  if (!proc || proc.killed) return
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL') } catch { /* ignore */ }
      resolve(undefined)
    }, 2000)
    proc.once('exit', () => {
      clearTimeout(timer)
      resolve(undefined)
    })
    try { proc.kill('SIGTERM') } catch {
      clearTimeout(timer)
      resolve(undefined)
    }
  })
}
