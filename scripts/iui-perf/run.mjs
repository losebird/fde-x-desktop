import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import {
  ensureDshBin,
  exchangeCookie,
  readJsonDir,
  repoRoot,
  spawnDsh,
  stopChild,
  waitForLine,
  webSession,
  writeEmptyCredentials,
  childEnv,
} from './lib/drive.mjs'
import { startOpenAiServer } from './lib/openai-server.mjs'
import { writeProviderSettings, GROK_MODEL, GROK_ROUTE } from './lib/provider-home.mjs'
import { redactText } from './lib/redact.mjs'
import { PROMPT, systemText, toolsOf } from './lib/request-facts.mjs'
import {
  assistantTextFromSse,
  compareCaptures,
  inventoryFile,
  iuiFences,
  parseSseUsage,
  pickPromptTurn,
  requestIndex,
  toolUses,
} from './lib/summarize.mjs'
import { TOKENIZER_NAME } from './lib/tokens.mjs'

const execFileAsync = promisify(execFile)
const IUI_COMMIT = 'c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37'
const IUI_VERSION = '0.13.0-iui.26'
const IUI_SHA = 'f3dc3ef1d099aace99d626f38c1c9eac1cf0ce1f631a67ba64919155ca0225a5'
const ARTIFACT_NAME = `iui-${IUI_COMMIT}.tar.gz`

const staticMode = process.argv.includes('--static')
const matchedEffort = process.env.GROK2API_EFFORT || 'low'
const runs = staticMode ? 1 : Number(process.env.IUI_PERF_RUNS || 3)
const grokBase = process.env.GROK2API_BASE_URL || 'http://127.0.0.1:8000/v1'

const ARMS = [
  { id: 'A', api: 'openai-completions', effort: matchedEffort, kind: 'dsh' },
  { id: 'B', api: 'openai-responses', effort: matchedEffort, kind: 'fde' },
  { id: 'B-default', api: 'openai-responses', effort: null, kind: 'fde' },
]

function fail(message) {
  console.error(message)
  process.exitCode = 2
}

function assertNode() {
  const major = Number(process.versions.node.split('.')[0])
  if (major !== 26) {
    fail(`需要 Node 26，当前是 ${process.version}`)
    return false
  }
  return true
}

async function assertPnpm() {
  try {
    const { stdout } = await execFileAsync('pnpm', ['-v'], { timeout: 15000 })
    const version = stdout.trim()
    if (version !== '11.20.0') {
      fail(`需要 pnpm 11.20.0，当前是 ${version}`)
      return false
    }
    return true
  } catch (error) {
    fail(`需要 pnpm 11.20.0 在 PATH 上：${error instanceof Error ? error.message : error}`)
    return false
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function onceExit(child, timeoutMs) {
  return new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('child timed out'))
    }, timeoutMs)
    child.once('exit', (code) => {
      clearTimeout(timer)
      resolveExit(code ?? 1)
    })
  })
}

async function waitQuiet(dir, timeoutMs, quietMs) {
  const start = Date.now()
  let last = -1
  let changed = Date.now()
  let rows = []
  while (Date.now() - start < timeoutMs) {
    rows = await readJsonDir(dir)
    if (rows.length !== last) {
      last = rows.length
      changed = Date.now()
    }
    const ready = rows.some((row) => pickPromptTurn([row]))
    if (ready && Date.now() - changed >= quietMs) return rows
    await sleep(400)
  }
  return readJsonDir(dir)
}

async function sha256(file) {
  const { stdout } = await execFileAsync('sha256sum', [file], { timeout: 30000 })
  return stdout.split(/\s+/)[0]
}

async function ensureArtifact(outDir) {
  const fromEnv = process.env.FDE_IUI_ARTIFACT
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const cached = '/tmp/iui-out/' + ARTIFACT_NAME
  if (existsSync(cached)) return cached
  const destDir = join(outDir, 'iui-artifact')
  await mkdir(destDir, { recursive: true })
  const dest = join(destDir, ARTIFACT_NAME)
  if (existsSync(dest)) return dest
  console.log('building pinned IUI artifact')
  await execFileAsync(process.execPath, ['scripts/pack/build-iui.mjs', '--out', destDir], {
    cwd: repoRoot,
    timeout: 15 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (!existsSync(dest)) throw new Error(`IUI artifact missing after build: ${dest}`)
  return dest
}

async function ensurePluginDir(artifact) {
  const fromEnv = process.env.IUI_PLUGIN_DIR
  if (fromEnv && existsSync(join(fromEnv, 'lib', 'index.js'))) return fromEnv
  const dir = join(tmpdir(), `iui-plugin-${IUI_COMMIT.slice(0, 12)}`)
  if (!existsSync(join(dir, 'lib', 'index.js'))) {
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    await execFileAsync('tar', ['-xzf', artifact, '-C', dir], { timeout: 120000 })
  }
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  if (pkg.version !== IUI_VERSION) throw new Error(`IUI version ${pkg.version} != ${IUI_VERSION}`)
  return dir
}

function openLog(file) {
  return createWriteStream(file, { flags: 'a' })
}

function apiKeyForChild() {
  if (staticMode) return 'static-intercept'
  return process.env.GROK2API_API_KEY
}

async function readMetas(dir) {
  const { readdir } = await import('node:fs/promises')
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const rows = []
  for (const name of names.filter((item) => item.startsWith('meta-') && item.endsWith('.json')).sort()) {
    rows.push(JSON.parse(await readFile(join(dir, name), 'utf8')))
  }
  return rows
}

async function captureA({ baseUrl, pluginDir, capDir, forward, effort }) {
  const home = await mkdtemp(join(tmpdir(), 'iui-perf-a-'))
  const workspace = await mkdtemp(join(tmpdir(), 'iui-perf-ws-'))
  await writeEmptyCredentials(home)
  await writeProviderSettings(home, { baseUrl, api: 'openai-completions', effort })
  const bin = await ensureDshBin()
  const log = openLog(join(capDir, 'boot.log'))
  const apiKey = apiKeyForChild()
  const add = spawnDsh(bin, ['plugin', '--profile', 'web', 'add', pluginDir], {
    home,
    cwd: workspace,
    log,
    apiKey,
  })
  const addCode = await onceExit(add.child, 300000)
  if (addCode !== 0) {
    log.end()
    throw new Error(`dsh plugin add exit ${addCode}`)
  }
  const web = spawnDsh(bin, ['web', '--host', '127.0.0.1', '--port', '0', '--no-open'], {
    home,
    cwd: workspace,
    log,
    apiKey,
  })
  try {
    const match = await waitForLine(web.logs, /dsh web:\s+(\S+)/, 180000, { raw: true })
    const launchUrl = match[1]
    await waitForLine(web.logs, /settings: imported/, 60000).catch(() => {})
    const origin = new URL(launchUrl).origin
    const cookie = await exchangeCookie(launchUrl)
    const api = await webSession(origin, cookie)
    const created = await api.rpc('session/create', {
      request: { cwd: workspace, agentPreset: 'standard' },
    })
    const sessionId = created.sessionId || created.id
    await api.rpc('session/selectModel', {
      request: {
        sessionId,
        provider: GROK_ROUTE,
        model: GROK_MODEL,
        ...(effort ? { reasoningEffort: effort } : {}),
      },
    })
    const started = Date.now()
    await api.rpc('session/prompt', {
      request: {
        requestId: randomUUID(),
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: PROMPT }],
      },
    })
    const records = await waitQuiet(capDir, forward ? 12 * 60 * 1000 : 180000, forward ? 8000 : 4000)
    return {
      group: 'A',
      api: 'openai-completions',
      effort: effort || '(default)',
      home,
      origin,
      sessionId,
      e2eMs: Date.now() - started,
      records,
      metas: await readMetas(capDir),
      note: staticMode ? '静态拦截往返，不是模型生成耗时。' : '从 prompt 被接受，到请求流静默。',
    }
  } finally {
    await stopChild(web.child)
    log.end()
  }
}

async function captureFde({ baseUrl, artifact, capDir, port, forward, effort, group, api }) {
  const home = await mkdtemp(join(tmpdir(), 'iui-perf-b-'))
  const workspace = await mkdtemp(join(tmpdir(), 'iui-perf-ws-'))
  const db = join(home, 'fde.sqlite')
  await writeEmptyCredentials(home)
  await writeProviderSettings(home, { baseUrl, api, effort })
  const log = openLog(join(capDir, 'boot.log'))
  const env = {
    ...childEnv(home, apiKeyForChild()),
    FDE_DATABASE_PATH: db,
    FDE_AI_WORKSPACE: workspace,
    FDE_IUI_ARTIFACT: artifact,
    FDE_RUNTIME_PORT: String(port),
    FDE_LISTEN_HOST: '127.0.0.1',
    FDE_VENDOR_DIR: join(home, 'missing-vendor'),
  }
  const child = spawn(process.execPath, ['runtime/boot.mjs'], {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const logs = { stdout: '', stderr: '' }
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    const safe = redactText(chunk)
    logs.stdout += safe
    log.write(safe)
  })
  child.stderr.on('data', (chunk) => {
    const safe = redactText(chunk)
    logs.stderr += safe
    log.write(safe)
  })
  try {
    const announced = await new Promise((resolveWait, reject) => {
      const timer = setTimeout(() => reject(new Error(`fde boot timed out\n${logs.stderr.slice(-1500)}`)), 240000)
      const timerPoll = setInterval(() => {
        const match = `${logs.stdout}\n${logs.stderr}`.match(/FDE_LISTENING\s+(\d+)/)
        if (match) {
          clearTimeout(timer)
          clearInterval(timerPoll)
          resolveWait(match[1])
        }
        if (child.exitCode != null) {
          clearTimeout(timer)
          clearInterval(timerPoll)
          reject(new Error(`fde exited ${child.exitCode}\n${logs.stderr.slice(-1500)}`))
        }
      }, 300)
    })
    const origin = `http://127.0.0.1:${announced}`
    const connected = await fetch(new URL('/api/v1/ai/connect', origin), {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(240000),
    })
    const connectText = await connected.text()
    if (!connected.ok) throw new Error(`ai connect HTTP ${connected.status} ${redactText(connectText).slice(0, 500)}`)
    const importDeadline = Date.now() + 60000
    while (Date.now() < importDeadline) {
      if (`${logs.stdout}\n${logs.stderr}`.includes('settings: imported')) break
      await sleep(200)
    }
    let created = null
    const deadline = Date.now() + 180000
    let lastError = ''
    while (Date.now() < deadline) {
      const response = await fetch(new URL('/api/v1/ai/sessions', origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ cwd: workspace, agentPreset: 'standard' }),
      })
      const text = await response.text()
      if (response.status === 201) {
        created = JSON.parse(text)
        break
      }
      lastError = `HTTP ${response.status} ${redactText(text).slice(0, 300)}`
      await sleep(1000)
    }
    if (!created) throw new Error(`session create failed: ${lastError}`)
    const sessionId = created.data && (created.data.sessionId || created.data.id)
    const started = Date.now()
    const prompted = await fetch(new URL(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ text: PROMPT }),
    })
    if (!prompted.ok) {
      const detail = await prompted.text()
      throw new Error(`prompt HTTP ${prompted.status} ${redactText(detail).slice(0, 400)}`)
    }
    const records = await waitQuiet(capDir, forward ? 12 * 60 * 1000 : 180000, forward ? 8000 : 4000)
    const pluginFailures = `${logs.stdout}\n${logs.stderr}`
      .split('\n')
      .filter((line) => line.includes('builtin_plugin_link_failed'))
    return {
      group,
      api,
      effort: effort || '(default)',
      home,
      origin,
      port: Number(announced),
      sessionId,
      e2eMs: Date.now() - started,
      records,
      metas: await readMetas(capDir),
      pluginFailures,
      note: staticMode ? '静态拦截往返，不是模型生成耗时。' : '从 prompt 被接受，到请求流静默。',
    }
  } finally {
    await stopChild(child)
    log.end()
  }
}

async function renderFence(raw) {
  const iuiSrc = process.env.IUI_SRC || '/tmp/iui-src'
  const playwrightRoot = process.env.PLAYWRIGHT_ROOT || '/tmp/pw'
  if (!existsSync(join(iuiSrc, 'src/shared/html-sandbox.ts'))) {
    return { rendered: false, reason: 'IUI_SRC missing' }
  }
  let spec
  try {
    spec = JSON.parse(raw)
  } catch (error) {
    return { rendered: false, reason: `fence json: ${error instanceof Error ? error.message : error}` }
  }
  const { buildHtmlSandboxSrcdoc } = await import(pathToFileURL(join(iuiSrc, 'src/shared/html-sandbox.ts')).href)
  const doc = buildHtmlSandboxSrcdoc({
    title: String(spec.title || 'iui'),
    css: String(spec.css || ''),
    html: String(spec.html || ''),
    js: String(spec.js || ''),
    height: Number(spec.height) || 360,
  })
  const { createRequire } = await import('node:module')
  const require = createRequire(join(playwrightRoot, 'package.json'))
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(String(error)))
    await page.setContent(doc, { waitUntil: 'load' })
    await page.waitForTimeout(500)
    const strip = await page.locator('[data-iui-author-fail]').first().innerText().catch(() => '')
    return { rendered: true, bytes: raw.length, strip, pageErrors, ok: !strip && pageErrors.length === 0 }
  } finally {
    await browser.close()
  }
}

async function liveExtras(capDir, records) {
  const names = (await import('node:fs/promises')).readdir
  let files = []
  try {
    files = (await names(capDir)).filter((name) => name.startsWith('response-') && name.endsWith('.sse'))
  } catch {
    files = []
  }
  const usages = []
  const fences = []
  for (const name of files.sort()) {
    const text = await readFile(join(capDir, name), 'utf8')
    usages.push({ file: name, ...parseSseUsage(text) })
    for (const fence of iuiFences(assistantTextFromSse(text))) fences.push(fence)
  }
  const calls = []
  for (const record of records) calls.push(...toolUses(record.body))
  let render = null
  if (fences[0]) render = await renderFence(fences[0])
  return {
    usages,
    toolCallNames: calls,
    toolCallCount: calls.length,
    rounds: records.filter((record) => toolsOf(record.body).length > 0).length,
    iuiHtmlBytes: fences.reduce((sum, fence) => sum + fence.length, 0),
    fenceCount: fences.length,
    render,
  }
}

function speedOf(meta) {
  if (!meta || meta.synthetic || !meta.usage || meta.usage.output == null) return null
  const genMs = meta.totalMs != null && meta.firstByteMs != null ? meta.totalMs - meta.firstByteMs : null
  if (!genMs || genMs <= 0) return null
  return Math.round((meta.usage.output / genMs) * 1000)
}

function stepLines(records, metas) {
  const byId = new Map((metas || []).map((meta) => [meta.id, meta]))
  const lines = []
  for (const row of requestIndex(records)) {
    const meta = byId.get(row.id) || {}
    const usage = meta.usage || {}
    const speed = speedOf(meta)
    lines.push(
      `- ${row.id} ${row.path || ''} model=${row.model || '(absent)'} effort=${row.effort} tools=${row.tools} prompt=${row.promptTurn}`,
    )
    lines.push(
      `  input=${usage.input ?? '(无供应商 usage)'} output=${usage.output ?? '(无)'} cacheRead=${usage.cacheRead ?? '(无)'} 首token=${meta.firstByteMs ?? '(无)'} ms 生成=${speed ?? '(无)'} tok/s 耗时=${meta.totalMs ?? '(无)'} ms 工具调用=${JSON.stringify(row.toolUses)}`,
    )
  }
  return lines
}

function armCell(turn, field) {
  if (!turn) return '—'
  const value = turn[field]
  return value === undefined || value === null || value === '' ? '—' : value
}

function markdownTable(comparison, runsOut, defaultTurn) {
  const a = comparison.A
  const b = comparison.B
  const lines = [
    `# IUI grok2api 对比`,
    ``,
    `模型 ${GROK_MODEL}。A 走 openai-completions，B 走 openai-responses。对齐 effort=${matchedEffort}。B-default 不写 reasoningEffort。`,
    `分词器：${TOKENIZER_NAME}。静态表不是供应商账单。`,
    ``,
    `| 项 | A | B 对齐 effort | B 默认 effort |`,
    `| --- | ---: | ---: | ---: |`,
    `| system tokens | ${armCell(a, 'systemTokens')} | ${armCell(b, 'systemTokens')} | ${armCell(defaultTurn, 'systemTokens')} |`,
    `| 工具个数 | ${armCell(a, 'toolCount')} | ${armCell(b, 'toolCount')} | ${armCell(defaultTurn, 'toolCount')} |`,
    `| 工具字符 | ${armCell(a, 'toolChars')} | ${armCell(b, 'toolChars')} | ${armCell(defaultTurn, 'toolChars')} |`,
    `| 工具 tokens | ${armCell(a, 'toolTokens')} | ${armCell(b, 'toolTokens')} | ${armCell(defaultTurn, 'toolTokens')} |`,
    `| effort | ${armCell(a, 'effort')} | ${armCell(b, 'effort')} | ${armCell(defaultTurn, 'effort')} |`,
    `| model | ${armCell(a, 'model')} | ${armCell(b, 'model')} | ${armCell(defaultTurn, 'model')} |`,
    `| path | ${armCell(a, 'path')} | ${armCell(b, 'path')} | ${armCell(defaultTurn, 'path')} |`,
    ``,
    `B 减 A system tokens：${comparison.delta.systemTokens}`,
    `B 减 A 工具 tokens：${comparison.delta.toolTokens}`,
    `只在 B 的工具：${comparison.delta.toolsOnlyInB.join(', ') || '（无）'}`,
    `只在 A 的工具：${comparison.delta.toolsOnlyInA.join(', ') || '（无）'}`,
    ``,
    `## 按步`,
    ``,
  ]
  for (const row of runsOut) {
    lines.push(`### ${row.group} #${row.index} api=${row.api} effort=${row.effort} 静默 ${row.e2eMs} ms`)
    lines.push(row.note)
    if (row.pluginFailures && row.pluginFailures.length) {
      lines.push(`插件挂载失败 ${row.pluginFailures.length} 条（这台机器没有 lan-assist / semantic-os 完整包）。`)
    }
    lines.push(...stepLines(row.records || [], row.metas || []))
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

async function main() {
  if (!assertNode()) return
  if (!await assertPnpm()) return
  if (!staticMode && !process.env.GROK2API_API_KEY) {
    fail('实时测量需要环境变量 GROK2API_API_KEY。没有 key 时运行：node scripts/iui-perf/run.mjs --static')
    return
  }
  const outDir = resolve(repoRoot, 'artifacts', 'iui-perf', staticMode ? 'grok-static' : 'grok-live')
  await mkdir(outDir, { recursive: true })
  const artifact = await ensureArtifact(outDir)
  const digest = await sha256(artifact)
  if (digest !== IUI_SHA) throw new Error(`IUI sha256 ${digest} != pin ${IUI_SHA}`)
  const pluginDir = await ensurePluginDir(artifact)
  const order = []
  for (let index = 1; index <= runs; index += 1) {
    for (const arm of ARMS) order.push({ ...arm, index })
  }
  const finished = []
  let port = 4318
  for (const arm of order) {
    const capDir = join(outDir, 'captures', `${arm.id}-${arm.index}`)
    await mkdir(capDir, { recursive: true })
    console.log(`capture ${arm.id} #${arm.index} ${arm.api} effort=${arm.effort || '(default)'}`)
    const server = await startOpenAiServer({
      dir: capDir,
      forward: !staticMode,
      upstream: grokBase,
    })
    const baseUrl = `${server.origin}/v1`
    try {
      const captured = arm.kind === 'dsh'
        ? await captureA({
          baseUrl,
          pluginDir,
          capDir,
          forward: !staticMode,
          effort: arm.effort,
        })
        : await captureFde({
          baseUrl,
          artifact,
          capDir,
          port,
          forward: !staticMode,
          effort: arm.effort,
          group: arm.id,
          api: arm.api,
        })
      port += 1
      const turn = pickPromptTurn(captured.records)
      if (!turn) throw new Error(`${arm.id} 没有拦到带工具的杭州提示请求`)
      if (turn.body.model !== GROK_MODEL) {
        throw new Error(`${arm.id} 模型是 ${turn.body.model}，不是 ${GROK_MODEL}`)
      }
      const extras = staticMode ? null : await liveExtras(capDir, captured.records)
      finished.push({ ...captured, index: arm.index, extras, records: captured.records, metas: captured.metas })
      console.log(`${arm.id} #${arm.index} tools=${toolsOf(turn.body).length} effort path=${turn.path} model=${turn.body.model}`)
    } finally {
      server.close()
    }
  }
  const sample = (id) => finished.find((row) => row.group === id && row.index === 1)
  const a = sample('A')
  const b = sample('B')
  const fallback = sample('B-default')
  const comparison = await compareCaptures(a, b)
  const defaultTurn = await (async () => {
    const { describeTurn } = await import('./lib/summarize.mjs')
    return describeTurn(pickPromptTurn(fallback.records))
  })()
  const publicRuns = finished.map((row) => ({
    group: row.group,
    index: row.index,
    api: row.api,
    effort: row.effort,
    requests: row.records.length,
    e2eMs: row.e2eMs,
    note: row.note,
    pluginFailures: row.pluginFailures || [],
    steps: requestIndex(row.records),
    metas: row.metas,
    extras: row.extras,
  }))
  await writeFile(join(outDir, 'comparison.json'), `${JSON.stringify({ comparison, defaultTurn, runs: publicRuns }, null, 2)}\n`)
  await writeFile(join(outDir, 'comparison.md'), markdownTable(comparison, finished, defaultTurn))
  const first = join(outDir, 'first-turn')
  await mkdir(first, { recursive: true })
  for (const row of [a, b, fallback]) {
    const turn = pickPromptTurn(row.records)
    await writeFile(join(first, `${row.group}-system.txt`), redactText(turn ? systemText(turn.body) : ''))
    await writeFile(join(first, `${row.group}-tools.json`), `${JSON.stringify(turn ? turn.body.tools : [], null, 2)}\n`)
  }
  const breakdown = {
    tokenizer: TOKENIZER_NAME,
    lanAssist: await inventoryFile(join(repoRoot, 'runtime/vendor-overlays/dsh-lan-assist/tools.js')),
    runs: publicRuns.map((row) => ({ group: row.group, index: row.index, steps: row.steps, metas: row.metas })),
  }
  await writeFile(join(outDir, 'breakdown.json'), `${JSON.stringify(breakdown, null, 2)}\n`)
  console.log(`wrote ${join(outDir, 'comparison.md')}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
