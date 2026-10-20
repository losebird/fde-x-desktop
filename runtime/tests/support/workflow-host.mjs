import { execFile } from 'node:child_process'
import * as zlib from 'node:zlib'
import { chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { FDE_VENDOR_DIR } from '../../config.mjs'
import { createCoreConnector } from '../../dsh-core.mjs'
import { PRODUCT_BUNDLE_IDS } from '../../product-bundles.mjs'

const execFileAsync = promisify(execFile)
const PIN = '0.2.0-rc.2'

export function hostPinDir() {
  return join(import.meta.dirname, '..', '..', 'host-pin')
}

export async function ensureHostPin() {
  const pinDir = hostPinDir()
  const bin = join(pinDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const stamp = join(pinDir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
  if (existsSync(stamp)) {
    const pkg = JSON.parse(readFileSync(stamp, 'utf8'))
    if (pkg.version === PIN && existsSync(bin)) return bin
  }
  const cache = join(tmpdir(), 'fde-x-host-pin-npm-cache')
  await mkdir(cache, { recursive: true })
  await execFileAsync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts'], {
    cwd: pinDir,
    env: {
      ...process.env,
      npm_config_cache: cache,
      npm_config_prefix: pinDir,
      npm_config_update_notifier: 'false',
    },
    maxBuffer: 128 * 1024 * 1024,
  })
  return bin
}

export async function bootWorkflowHost(options = {}) {
  if (typeof zlib.zstdDecompress !== 'function') {
    throw new Error(`真 Host 测试需要 node:zlib 的 zstdDecompress，当前是 ${process.version}`)
  }
  const bin = await ensureHostPin()
  const home = await mkdtemp(join(tmpdir(), 'fde-workflow-host-'))
  const cwd = join(home, 'workspace')
  const probeDir = join(home, 'probe')
  const profileName = 'fde-workflow-host'
  await mkdir(cwd, { recursive: true })
  await mkdir(probeDir, { recursive: true })
  if (options.staleAllow) {
    const allowDir = join(home, 'run', 'workflow-allow')
    await mkdir(allowDir, { recursive: true, mode: 0o755 })
    await chmod(allowDir, 0o755)
    const stale = join(allowDir, 'session-stale-allow.json')
    await writeFile(stale, '{}\n', { mode: 0o644 })
    await chmod(stale, 0o644)
  }
  const credentials = join(home, '.credentials.yaml')
  await writeFile(credentials, '', { mode: 0o600 })
  await chmod(credentials, 0o600)

  const profileModules = join(home, 'profiles', profileName, 'node_modules')
  await mkdir(profileModules, { recursive: true })
  await writeFile(join(home, 'profiles', profileName, 'package.json'), `${JSON.stringify({
    name: `dsh-profile-${profileName}`,
    private: true,
    dsh: {
      profile: {
        bundles: [
          '@deepseek-ai/dsh-base',
          '@deepseek-ai/dsh-web-app',
          ...PRODUCT_BUNDLE_IDS,
        ],
      },
    },
  }, null, 2)}\n`)

  const probeSource = join(import.meta.dirname, '..', 'fixtures', 'workflow-host-probe')
  await rm(join(profileModules, 'fde-workflow-host-probe'), { recursive: true, force: true })
  await mkdir(profileModules, { recursive: true })
  const { symlink } = await import('node:fs/promises')
  await symlink(probeSource, join(profileModules, 'fde-workflow-host-probe'))

  const productPatch = await readFile(join(import.meta.dirname, '..', '..', 'dsh-core.patch.yml'), 'utf8')
  const patchFile = join(home, 'probe.patch.yml')
  await writeFile(patchFile, `${productPatch}\n- insert:\n    - id: fde-workflow-host-probe\n      name: fde-workflow-host-probe\n`)

  const previous = {
    FDE_DSH_HOME: process.env.FDE_DSH_HOME,
    DSH_HOME: process.env.DSH_HOME,
    FDE_DSH_BIN: process.env.FDE_DSH_BIN,
    FDE_DSH_SESSION_ROOT: process.env.FDE_DSH_SESSION_ROOT,
    FDE_DSH_STORAGE_ROOT: process.env.FDE_DSH_STORAGE_ROOT,
    FDE_SEMANTIC_RUNTIME_MODE: process.env.FDE_SEMANTIC_RUNTIME_MODE,
    FDE_PROBE_DIR: process.env.FDE_PROBE_DIR,
    FDE_AI_WORKSPACE: process.env.FDE_AI_WORKSPACE,
    FDE_WORKFLOW_PROBE_LEAK: process.env.FDE_WORKFLOW_PROBE_LEAK,
    FDE_WORKFLOW_PROBE_EXTRA: process.env.FDE_WORKFLOW_PROBE_EXTRA,
    FDE_WORKFLOW_PROBE_CALL: process.env.FDE_WORKFLOW_PROBE_CALL,
    FDE_WORKFLOW_PROBE_PRESET_ONLY: process.env.FDE_WORKFLOW_PROBE_PRESET_ONLY,
    FDE_VENDOR_DIR: process.env.FDE_VENDOR_DIR,
    FDE_IUI_ARTIFACT: process.env.FDE_IUI_ARTIFACT,
  }
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('FDE_PLUGIN_')) previous[key] = process.env[key]
  }
  process.env.FDE_DSH_HOME = home
  process.env.DSH_HOME = home
  process.env.FDE_DSH_BIN = bin
  process.env.FDE_DSH_SESSION_ROOT = join(home, 'sessions')
  process.env.FDE_DSH_STORAGE_ROOT = join(home, 'storages')
  process.env.FDE_SEMANTIC_RUNTIME_MODE = 'readonly'
  process.env.FDE_PROBE_DIR = probeDir
  process.env.FDE_AI_WORKSPACE = cwd
  if (options.leak) process.env.FDE_WORKFLOW_PROBE_LEAK = '1'
  else delete process.env.FDE_WORKFLOW_PROBE_LEAK
  if (options.extra) process.env.FDE_WORKFLOW_PROBE_EXTRA = '1'
  else delete process.env.FDE_WORKFLOW_PROBE_EXTRA
  if (options.callTool) process.env.FDE_WORKFLOW_PROBE_CALL = options.callTool
  else delete process.env.FDE_WORKFLOW_PROBE_CALL
  if (options.presetOnly) process.env.FDE_WORKFLOW_PROBE_PRESET_ONLY = '1'
  else delete process.env.FDE_WORKFLOW_PROBE_PRESET_ONLY

  let hiddenVendor = null
  if (!options.withPlugins) {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('FDE_PLUGIN_')) delete process.env[key]
    }
    delete process.env.FDE_IUI_ARTIFACT
    const emptyVendor = join(home, 'empty-vendor')
    await mkdir(emptyVendor, { recursive: true })
    process.env.FDE_VENDOR_DIR = emptyVendor
    hiddenVendor = await hideFrozenVendor()
  }

  let core
  let status
  try {
    core = createCoreConnector({
      bin,
      dshHome: home,
      cwd,
      patchFile,
      profileName,
      startTimeoutMs: 90_000,
    })
    status = await core.start()
  } catch (error) {
    await showFrozenVendor(hiddenVendor)
    restoreEnv(previous)
    throw error
  }
  if (!status.connected || status.version !== PIN) {
    const detail = status.lastError || (status.recentLogs || []).slice(-12).join('\n')
    await core.stop().catch(() => {})
    await showFrozenVendor(hiddenVendor)
    restoreEnv(previous)
    throw new Error(`真 Host 没有连上 ${PIN}：${detail}`)
  }

  async function stop() {
    await core.stop().catch(() => {})
    await showFrozenVendor(hiddenVendor)
    restoreEnv(previous)
    await rm(home, { recursive: true, force: true })
  }

  return { core, cwd, probeDir, home, version: status.version, stop }
}

async function hideFrozenVendor() {
  if (!existsSync(FDE_VENDOR_DIR)) return null
  const hidden = `${FDE_VENDOR_DIR}.fde-workflow-hidden-${process.pid}`
  await rename(FDE_VENDOR_DIR, hidden)
  return hidden
}

async function showFrozenVendor(hidden) {
  if (!hidden) return
  if (existsSync(FDE_VENDOR_DIR)) {
    throw new Error(`隔离结束时 ${FDE_VENDOR_DIR} 已经存在，不能把 ${hidden} 移回去`)
  }
  await rename(hidden, FDE_VENDOR_DIR)
}

function restoreEnv(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

export async function waitForProbe(probeDir, preset) {
  const file = join(probeDir, `${preset}.json`)
  const started = Date.now()
  while (Date.now() - started < 5000) {
    if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'))
    await new Promise((resolve) => setImmediate(resolve))
  }
  throw new Error(`真 Host 没有写出 ${preset} 会话的工具列表`)
}
