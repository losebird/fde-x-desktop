import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { redactText } from './redact.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(here, '..', '..', '..')

export function dshBin() {
  return join(repoRoot, 'runtime', '.host-generation', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

export async function ensureDshBin() {
  const bin = dshBin()
  if (existsSync(bin)) return bin
  await new Promise((resolveBoot, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', "import { ensureGenerationHost } from './runtime/generation.mjs'; await ensureGenerationHost()"], {
      cwd: repoRoot,
      stdio: 'inherit',
    })
    child.on('exit', (code) => (code === 0 ? resolveBoot() : reject(new Error(`ensureGenerationHost exit ${code}`))))
  })
  if (!existsSync(bin)) throw new Error(`dsh bin missing at ${bin}`)
  return bin
}

export function childEnv(home, baseUrl, keyOverride) {
  const key = keyOverride || process.env.DEEPSEEK_API_KEY || 'static-intercept'
  return {
    ...process.env,
    DSH_HOME: home,
    FDE_DSH_HOME: home,
    DEEPSEEK_BASE_URL: baseUrl,
    DEEPSEEK_API_KEY: key,
    DSH_PERMISSION_MODE: process.env.DSH_PERMISSION_MODE || 'danger-full-access',
  }
}

export async function writeEmptyCredentials(home) {
  await mkdir(home, { recursive: true })
  const dest = join(home, '.credentials.yaml')
  if (!existsSync(dest)) {
    await writeFile(dest, 'version: 1\nrefs:\n', { mode: 0o600 })
  }
}

function collect(child) {
  let stdout = ''
  let stderr = ''
  child.stdout?.setEncoding('utf8')
  child.stderr?.setEncoding('utf8')
  child.stdout?.on('data', (chunk) => { stdout += chunk })
  child.stderr?.on('data', (chunk) => { stderr += chunk })
  return {
    text: () => ({ stdout: redactText(stdout), stderr: redactText(stderr) }),
    raw: () => ({ stdout, stderr }),
  }
}

export function spawnDsh(bin, args, { home, baseUrl, cwd, log, apiKey }) {
  const child = spawn(process.execPath, [bin, ...args], {
    cwd,
    env: childEnv(home, baseUrl, apiKey),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const logs = collect(child)
  if (log) {
    child.stdout?.on('data', (chunk) => log.write(redactText(chunk)))
    child.stderr?.on('data', (chunk) => log.write(redactText(chunk)))
  }
  return { child, logs }
}

export function waitForLine(logs, pattern, timeoutMs, options = {}) {
  const read = () => (options.raw && logs.raw ? logs.raw() : logs.text())
  return new Promise((resolveWait, reject) => {
    const timer = setTimeout(() => {
      const text = logs.text()
      reject(new Error(`timed out waiting for ${pattern}\n${text.stderr.slice(-2000)}\n${text.stdout.slice(-2000)}`))
    }, timeoutMs)
    const timerPoll = setInterval(() => {
      const text = `${read().stdout}\n${read().stderr}`
      const match = text.match(pattern)
      if (match) {
        clearTimeout(timer)
        clearInterval(timerPoll)
        resolveWait(match)
      }
    }, 200)
  })
}

export async function stopChild(child) {
  if (!child || child.exitCode != null || child.signalCode != null) return
  child.kill('SIGTERM')
  await new Promise((resolveWait) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolveWait()
    }, 4000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolveWait()
    })
  })
}

export async function webSession(origin, cookie) {
  async function rpc(method, args) {
    const rpcId = randomUUID()
    const response = await fetch(new URL(`/api/${method}`, origin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie,
        origin,
      },
      body: JSON.stringify({
        type: 'client-request',
        rpcId,
        method,
        payload: { args },
      }),
    })
    const text = await response.text()
    let envelope
    try {
      envelope = JSON.parse(text)
    } catch {
      throw new Error(`rpc ${method} HTTP ${response.status} not json: ${redactText(text).slice(0, 400)}`)
    }
    if (!response.ok || !envelope.result || envelope.result.ok !== true) {
      throw new Error(`rpc ${method} failed HTTP ${response.status}: ${redactText(text).slice(0, 800)}`)
    }
    return envelope.result.value
  }
  return { rpc }
}

export async function exchangeCookie(launchUrl) {
  const first = await fetch(launchUrl, { redirect: 'manual' })
  const cookie = (typeof first.headers.getSetCookie === 'function'
    ? first.headers.getSetCookie()
    : [first.headers.get('set-cookie') || ''])
    .map((value) => String(value).split(';', 1)[0])
    .filter(Boolean)
    .join('; ')
  if (!cookie) throw new Error(`web auth HTTP ${first.status} returned no cookie`)
  const location = first.headers.get('location')
  if (location) {
    await fetch(new URL(location, launchUrl), { headers: { cookie }, redirect: 'manual' })
  }
  return cookie
}

export async function readJsonDir(dir) {
  const { readdir } = await import('node:fs/promises')
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const rows = []
  for (const name of names.filter((item) => item.startsWith('request-') && item.endsWith('.json')).sort()) {
    rows.push(JSON.parse(await readFile(join(dir, name), 'utf8')))
  }
  return rows
}
