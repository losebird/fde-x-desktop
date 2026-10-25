/**
 * One Host generation. Occupancy and catalog rebind after this pin starts.
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'
import { applyCancelProvenance } from './host-pin/cancel-provenance.mjs'

const execFile = promisify(execFileCb)
const runtimeDir = dirname(fileURLToPath(import.meta.url))

export const HOST_GENERATION = {
  pin: '0.2.0-rc.2',
  previous: '0.1.5-rc.1',
}

export function generationInstallRoot() {
  return join(runtimeDir, '.host-generation')
}

export function generationDshBin() {
  const root = generationInstallRoot()
  const official = join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (existsSync(official)) return official
  const npmBin = join(root, 'node_modules', '.bin', 'dsh')
  if (existsSync(npmBin)) return npmBin
  return ''
}

function defaultHostHome() {
  return process.env.FDE_DSH_HOME || join(homedir(), '.dsh-fde-x')
}

export function generationSnapshotPath(home = defaultHostHome()) {
  return `${String(home).replace(/\/$/, '')}.generation-${HOST_GENERATION.previous}`
}

export async function snapshotHostHome(home = defaultHostHome()) {
  const dest = generationSnapshotPath(home)
  if (existsSync(dest)) return dest
  if (!existsSync(home)) {
    await mkdir(dest, { recursive: true })
    return dest
  }
  await cp(home, dest, { recursive: true, errorOnExist: false })
  return dest
}

async function ensureDshShim(root) {
  const nested = join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const flat = join(root, 'lib', 'bin.js')
  const entry = existsSync(nested) ? nested : (existsSync(flat) ? flat : '')
  if (!entry) return false
  const binDir = join(root, 'bin')
  await mkdir(binDir, { recursive: true })
  const rel = existsSync(nested)
    ? '../node_modules/@deepseek-ai/dsh/lib/bin.js'
    : '../lib/bin.js'
  await writeFile(
    join(binDir, 'dsh'),
    "#!/usr/bin/env node\n"
      + "const { spawn } = require('node:child_process')\n"
      + "const { join } = require('node:path')\n"
      + "const target = join(__dirname, '../node_modules/@deepseek-ai/dsh/lib/bin.js')\n"
      + "const child = spawn(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' })\n"
      + "child.on('exit', (code, signal) => { if (signal) process.kill(process.pid, signal); process.exit(code == null ? 1 : code) })\n",
    { mode: 0o755 },
  )
  return true
}

export async function ensureGenerationHost() {
  const root = generationInstallRoot()
  const existing = join(root, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
  const yamlPkg = join(root, 'node_modules', 'yaml', 'package.json')
  if (existsSync(existing) && existsSync(yamlPkg)) {
    try {
      const pkg = JSON.parse(await readFile(existing, 'utf8'))
      if (pkg.version === HOST_GENERATION.pin && generationDshBin()) {
        applyCancelProvenance(root)
        return generationDshBin()
      }
    } catch (error) {
      if (error && error.code === 'CANCEL_PROVENANCE') throw error
      /* reinstall */
    }
  }
  const pinDir = join(runtimeDir, 'host-pin')
  const lockPath = join(pinDir, 'package-lock.json')
  if (!existsSync(lockPath)) throw new Error(`世代 Host 缺少锁文件：${lockPath}`)
  await mkdir(root, { recursive: true })
  await cp(join(pinDir, 'package.json'), join(root, 'package.json'))
  await cp(lockPath, join(root, 'package-lock.json'))
  await execFile('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts'], {
    cwd: root,
    maxBuffer: 128 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_cache: join(root, '.npm-cache'),
      npm_config_prefix: root,
      npm_config_update_notifier: 'false',
    },
  })
  if (!(await ensureDshShim(root))) {
    throw new Error(`世代 Host 缺少 dsh 入口：${root}`)
  }
  applyCancelProvenance(root)
  return generationDshBin()
}
