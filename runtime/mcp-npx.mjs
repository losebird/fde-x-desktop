import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, readdirSync, readFileSync, chmodSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const NPX_FETCH_MS = 8_000
const PASSTHROUGH = new Set(['skills', 'clawhub', 'clawdhub', 'npm-check-updates'])

export function mcpNpxBinDir(runtimeDir = dirname(fileURLToPath(import.meta.url))) {
  return join(runtimeDir, 'mcp-npx-bin')
}

export function defaultNpxCacheRoot(env = process.env) {
  const npm = String(env.npm_config_cache || env.NPM_CONFIG_CACHE || '').trim()
  if (npm) return join(npm, '_npx')
  const home = String(env.HOME || env.USERPROFILE || homedir() || '').trim()
  return home ? join(home, '.npm', '_npx') : ''
}

function stripTag(pkg) {
  const text = String(pkg || '').trim()
  if (!text || text.startsWith('.')) return ''
  if (text.startsWith('@')) {
    const cut = text.indexOf('@', 1)
    return cut === -1 ? text : text.slice(0, cut)
  }
  const cut = text.indexOf('@')
  return cut === -1 ? text : text.slice(0, cut)
}

export function parseNpxInvocation(argv) {
  const args = Array.isArray(argv) ? argv.map(String) : []
  let index = 0
  while (index < args.length) {
    const token = args[index]
    if (token === 'exec') {
      index += 1
      continue
    }
    if (token === '--') {
      index += 1
      break
    }
    if (token === '-p' || token === '--package') {
      index += 2
      continue
    }
    if (token.startsWith('-')) {
      index += 1
      continue
    }
    break
  }
  const pkg = stripTag(args[index] || '')
  const rest = args.slice(index + 1)
  if (!pkg) return { kind: 'passthrough', pkg: '', rest: args }
  const name = pkg.startsWith('@') ? pkg.split('/')[1] || '' : pkg
  if (PASSTHROUGH.has(pkg) || PASSTHROUGH.has(name) || pkg === 'skills' || name === 'skills') {
    return { kind: 'passthrough', pkg, rest: args }
  }
  return { kind: 'mcp', pkg, rest }
}

function binNamesFromPackage(pkgDir, pkg) {
  try {
    const raw = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
    const bin = raw && raw.bin
    if (typeof bin === 'string' && bin.trim()) {
      const base = pkg.includes('/') ? pkg.slice(pkg.lastIndexOf('/') + 1) : pkg
      return [base]
    }
    if (bin && typeof bin === 'object' && !Array.isArray(bin)) {
      const keys = Object.keys(bin)
      const last = pkg.includes('/') ? pkg.slice(pkg.lastIndexOf('/') + 1) : pkg
      if (keys.includes(last)) return [last, ...keys.filter((key) => key !== last)]
      return keys
    }
  } catch { /* missing package.json */ }
  const last = pkg.includes('/') ? pkg.slice(pkg.lastIndexOf('/') + 1) : pkg
  return last ? [last] : []
}

function binFile(binDir, name, platform) {
  if (platform === 'win32') {
    const cmd = join(binDir, `${name}.cmd`)
    if (existsSync(cmd)) return cmd
    const ps1 = join(binDir, `${name}.ps1`)
    if (existsSync(ps1)) return ps1
  }
  const file = join(binDir, name)
  return existsSync(file) ? file : ''
}

export function findCachedNpxBin(pkg, {
  cacheRoot = defaultNpxCacheRoot(),
  platform = process.platform,
} = {}) {
  const name = stripTag(pkg)
  if (!name || !cacheRoot || !existsSync(cacheRoot)) return ''
  let hashes = []
  try { hashes = readdirSync(cacheRoot) } catch { return '' }
  for (const hash of hashes) {
    const nodeModules = join(cacheRoot, hash, 'node_modules')
    const pkgDir = join(nodeModules, ...name.split('/'))
    if (!existsSync(join(pkgDir, 'package.json'))) continue
    const binDir = join(nodeModules, '.bin')
    for (const binName of binNamesFromPackage(pkgDir, name)) {
      const file = binFile(binDir, binName, platform)
      if (file) return file
    }
  }
  return ''
}

export function realNpxPath({
  resources = '',
  platform = process.platform,
  env = process.env,
  skipDirs = [],
} = {}) {
  const root = String(resources || env.FDE_RESOURCES || '')
  const name = platform === 'win32' ? 'npx.cmd' : 'npx'
  const realName = platform === 'win32' ? 'npx.real.cmd' : 'npx.real'
  const bundled = [
    join(root, 'node', 'bin', realName),
    join(root, 'node', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    join(root, 'node', 'bin', name),
    join(root, 'node', name),
  ]
  for (const file of bundled) {
    if (!file || !existsSync(file)) continue
    if (file.endsWith(name) && isOurNpxShim(file)) continue
    return file
  }
  const skip = new Set(skipDirs.map((dir) => String(dir || '').replace(/[/\\]+$/u, '')))
  skip.add(mcpNpxBinDir().replace(/[/\\]+$/u, ''))
  const sep = platform === 'win32' ? ';' : ':'
  for (const dir of String(env.PATH || '').split(sep)) {
    if (!dir || skip.has(dir.replace(/[/\\]+$/u, ''))) continue
    const file = join(dir, name)
    if (existsSync(file) && !isOurNpxShim(file)) return file
  }
  return name
}

function isOurNpxShim(file) {
  try {
    return readFileSync(file, 'utf8').includes('mcp-npx-launch')
  } catch {
    return false
  }
}

const UNIX_NPX_SHIM = `#!/usr/bin/env node
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const appRoot = process.env.FDE_APP_ROOT
const launch = appRoot
  ? join(appRoot, 'runtime', 'mcp-npx-launch.mjs')
  : join(__dirname, '..', '..', 'app', 'runtime', 'mcp-npx-launch.mjs')
import(pathToFileURL(launch).href)
`

export function ensureNpxShim(resources, platform = process.platform) {
  const root = String(resources || '')
  if (!root) return false
  const cli = join(root, 'node', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js')
  if (!existsSync(cli)) return false
  const binDir = join(root, 'node', 'bin')
  const npx = join(binDir, platform === 'win32' ? 'npx.cmd' : 'npx')
  if (!existsSync(npx)) return false
  if (isOurNpxShim(npx)) return true
  const real = join(binDir, platform === 'win32' ? 'npx.real.cmd' : 'npx.real')
  if (!existsSync(real)) copyFileSync(npx, real)
  if (platform === 'win32') {
    writeFileSync(npx, `@echo off\r\nsetlocal\r\nset "LAUNCH=%~dp0..\\..\\app\\runtime\\mcp-npx-launch.mjs"\r\nif defined FDE_HOST_NODE ("%FDE_HOST_NODE%" "%LAUNCH%" %*) else (node "%LAUNCH%" %*)\r\n`)
  } else {
    writeFileSync(npx, UNIX_NPX_SHIM)
    try { chmodSync(npx, 0o755) } catch { /* ignore */ }
  }
  return true
}

export function planNpxLaunch(argv, options = {}) {
  const parsed = parseNpxInvocation(argv)
  const realNpx = options.realNpx || realNpxPath(options)
  if (parsed.kind !== 'mcp') {
    return { kind: 'passthrough', command: realNpx, args: Array.isArray(argv) ? argv.map(String) : [] }
  }
  const cached = findCachedNpxBin(parsed.pkg, options)
  if (cached) {
    return { kind: 'cache', command: cached, args: parsed.rest, pkg: parsed.pkg }
  }
  return {
    kind: 'npx',
    command: realNpx,
    args: Array.isArray(argv) ? argv.map(String) : [],
    pkg: parsed.pkg,
    rest: parsed.rest,
  }
}

function spawnArgv(command, args, env) {
  if (/\.js$/i.test(command)) {
    const node = String(env.FDE_HOST_NODE || '').trim() || process.execPath
    return { command: node, args: [command, ...args], shell: false }
  }
  return {
    command,
    args,
    shell: process.platform === 'win32' && /\.cmd$/i.test(command),
  }
}

function runChild(command, args, env) {
  return new Promise((resolve) => {
    const launched = spawnArgv(command, args, env)
    const child = spawn(launched.command, launched.args, {
      env,
      stdio: 'inherit',
      windowsHide: true,
      shell: launched.shell,
    })
    child.on('error', (error) => resolve({ ok: false, error }))
    child.on('exit', (code, signal) => resolve({ ok: code === 0, code, signal }))
  })
}

export async function runNpxWithCache(argv, options = {}) {
  const args = Array.isArray(argv) ? argv.map(String) : []
  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
    process.stdout.write('fde-npx-cache\n')
    process.exit(0)
  }
  const env = options.env || process.env
  const plan = planNpxLaunch(args, { ...options, env })
  if (plan.kind === 'cache' || plan.kind === 'passthrough') {
    const result = await runChild(plan.command, plan.args, env)
    if (result.error) {
      process.stderr.write(`${result.error instanceof Error ? result.error.message : String(result.error)}\n`)
      process.exit(1)
    }
    if (result.signal) process.exit(1)
    process.exit(result.code ?? 1)
  }

  const timed = await new Promise((resolve) => {
    const launched = spawnArgv(plan.command, plan.args, env)
    const child = spawn(launched.command, launched.args, {
      env: {
        ...env,
        npm_config_fetch_retries: '0',
        npm_config_prefer_offline: env.npm_config_prefer_offline || 'true',
      },
      stdio: 'inherit',
      windowsHide: true,
      shell: launched.shell,
    })
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM') } catch { /* gone */ }
      resolve({ ok: false, timedOut: true })
    }, Number(options.fetchMs) > 0 ? Number(options.fetchMs) : NPX_FETCH_MS)
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ ok: false, error })
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, code, signal })
    })
  })
  if (timed.ok) process.exit(0)

  const cached = findCachedNpxBin(plan.pkg, { ...options, env })
  if (cached) {
    process.stderr.write('镜像不可用，改用本机已缓存的 MCP。\n')
    const result = await runChild(cached, plan.rest || [], env)
    if (result.error) {
      process.stderr.write(`${result.error instanceof Error ? result.error.message : String(result.error)}\n`)
      process.exit(1)
    }
    if (result.signal) process.exit(1)
    process.exit(result.code ?? 1)
  }
  process.stderr.write('npx 访问镜像失败，本机也没有这个 MCP 的缓存。\n')
  process.exit(timed.timedOut ? 1 : (timed.code ?? 1))
}
