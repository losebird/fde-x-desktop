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
import { startMessagesServer } from './lib/messages-server.mjs'
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
const runs = staticMode ? 1 : 3

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

async function captureA({ baseUrl, pluginDir, capDir, forward }) {
  const home = await mkdtemp(join(tmpdir(), 'iui-perf-a-'))
  const workspace = await mkdtemp(join(tmpdir(), 'iui-perf-ws-'))
  await writeEmptyCredentials(home)
  const bin = await ensureDshBin()
  const log = openLog(join(capDir, 'boot.log'))
  const apiKey = staticMode ? 'static-intercept' : undefined
  const add = spawnDsh(bin, ['plugin', '--profile', 'web', 'add', pluginDir], {
    home,
    baseUrl,
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
    baseUrl,
    cwd: workspace,
    log,
    apiKey,
  })
  try {
    const match = await waitForLine(web.logs, /dsh web:\s+(\S+)/, 180000, { raw: true })
    const launchUrl = match[1]
    const origin = new URL(launchUrl).origin
    const cookie = await exchangeCookie(launchUrl)
    const api = await webSession(origin, cookie)
    const created = await api.rpc('session/create', {
      request: { cwd: workspace, agentPreset: 'standard' },
    })
    const sessionId = created.sessionId || created.id
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
      home,
      origin,
      sessionId,
      e2eMs: Date.now() - started,
      records,
      note: staticMode
        ? '静态拦截往返，不是模型生成耗时。'
        : '从 prompt 被接受，到请求流静默。',
    }
  } finally {
    await stopChild(web.child)
    log.end()
  }
}

async function captureB({ baseUrl, artifact, capDir, port, forward }) {
  const home = await mkdtemp(join(tmpdir(), 'iui-perf-b-'))
  const workspace = await mkdtemp(join(tmpdir(), 'iui-perf-ws-'))
  const db = join(home, 'fde.sqlite')
  await writeEmptyCredentials(home)
  const log = openLog(join(capDir, 'boot.log'))
  const env = {
    ...childEnv(home, baseUrl, staticMode ? 'static-intercept' : undefined),
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
    const connectAbort = AbortSignal.timeout(240000)
    const connected = await fetch(new URL('/api/v1/ai/connect', origin), {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: '{}',
      signal: connectAbort,
    })
    const connectText = await connected.text()
    if (!connected.ok) throw new Error(`ai connect HTTP ${connected.status} ${connectText.slice(0, 500)}`)
    let created = null
    const deadline = Date.now() + 180000
    let lastError = ''
    while (Date.now() < deadline) {
      const response = await fetch(new URL('/api/v1/ai/sessions', origin), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin,
        },
        body: JSON.stringify({ cwd: workspace, agentPreset: 'standard' }),
      })
      const text = await response.text()
      if (response.status === 201) {
        created = JSON.parse(text)
        break
      }
      lastError = `HTTP ${response.status} ${text.slice(0, 300)}`
      await sleep(1000)
    }
    if (!created) throw new Error(`session create failed: ${lastError}`)
    const sessionId = created.data && (created.data.sessionId || created.data.id)
    const started = Date.now()
    const prompted = await fetch(new URL(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/prompt`, origin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
      },
      body: JSON.stringify({ text: PROMPT }),
    })
    if (!prompted.ok) {
      const detail = await prompted.text()
      throw new Error(`prompt HTTP ${prompted.status} ${detail.slice(0, 400)}`)
    }
    const records = await waitQuiet(capDir, forward ? 12 * 60 * 1000 : 180000, forward ? 8000 : 4000)
    const pluginFailures = `${logs.stdout}\n${logs.stderr}`
      .split('\n')
      .filter((line) => line.includes('builtin_plugin_link_failed'))
    return {
      group: 'B',
      home,
      origin,
      port: Number(announced),
      sessionId,
      e2eMs: Date.now() - started,
      records,
      pluginFailures,
      note: staticMode
        ? '静态拦截往返，不是模型生成耗时。'
        : '从 prompt 被接受，到请求流静默。',
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
    return {
      rendered: true,
      bytes: raw.length,
      strip,
      pageErrors,
      ok: !strip && pageErrors.length === 0,
    }
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

function markdownTable(comparison, runsOut) {
  const a = comparison.A
  const b = comparison.B
  const lines = [
    `# IUI 静态对比`,
    ``,
    `分词器：${TOKENIZER_NAME}。这不是 DeepSeek 账单。`,
    ``,
    `| 项 | A 裸 DSH + IUI | B fde-x 标准对话 |`,
    `| --- | ---: | ---: |`,
    `| system tokens | ${a ? a.systemTokens : '—'} | ${b ? b.systemTokens : '—'} |`,
    `| system chars | ${a ? a.systemChars : '—'} | ${b ? b.systemChars : '—'} |`,
    `| 工具个数 | ${a ? a.toolCount : '—'} | ${b ? b.toolCount : '—'} |`,
    `| 工具 tokens | ${a ? a.toolTokens : '—'} | ${b ? b.toolTokens : '—'} |`,
    `| effort | ${a ? a.effort : '—'} | ${b ? b.effort : '—'} |`,
    `| thinking | ${a ? a.thinking : '—'} | ${b ? b.thinking : '—'} |`,
    `| model | ${a ? a.model : '—'} | ${b ? b.model : '—'} |`,
    `| 正文字节 system | ${a && a.fields ? a.fields.system : '—'} | ${b && b.fields ? b.fields.system : '—'} |`,
    `| 正文字节 tools | ${a && a.fields ? a.fields.tools : '—'} | ${b && b.fields ? b.fields.tools : '—'} |`,
    `| 正文字节 dsh_session_log | ${a && a.fields ? a.fields.dsh_session_log : '—'} | ${b && b.fields ? b.fields.dsh_session_log : '—'} |`,
    `| 正文字节 dsh_plugin_packages | ${a && a.fields ? a.fields.dsh_plugin_packages : '—'} | ${b && b.fields ? b.fields.dsh_plugin_packages : '—'} |`,
    ``,
    `B 减 A system tokens：${comparison.delta.systemTokens}`,
    `B 减 A 工具 tokens：${comparison.delta.toolTokens}`,
    `只在 B 的工具：${comparison.delta.toolsOnlyInB.join(', ') || '（无）'}`,
    `只在 A 的工具：${comparison.delta.toolsOnlyInA.join(', ') || '（无）'}`,
    ``,
    `## 只在 B 的 system 段落`,
    ``,
  ]
  for (const [name, bucket] of Object.entries(comparison.delta.bOnlyByClass)) {
    lines.push(`- ${name}：${bucket.paragraphs} 段，${bucket.tokens} tokens，${bucket.chars} 字符`)
  }
  lines.push('', '## 每次拦截', '')
  for (const row of runsOut) {
    lines.push(`- ${row.group} #${row.index} 请求 ${row.requests} 条，其中带工具的 ${row.toolRounds} 条，静默等待 ${row.e2eMs} ms。${row.note}`)
    if (row.pluginFailures && row.pluginFailures.length) {
      lines.push(`  插件挂载失败 ${row.pluginFailures.length} 条（这台机器没有 lan-assist / semantic-os 完整包）。`)
    }
  }
  return `${lines.join('\n')}\n`
}

async function main() {
  if (!assertNode()) return
  if (!await assertPnpm()) return
  if (!staticMode && !process.env.DEEPSEEK_API_KEY) {
    fail('实时测量需要环境变量 DEEPSEEK_API_KEY。没有 key 时运行：node scripts/iui-perf/run.mjs --static')
    return
  }
  const outDir = resolve(repoRoot, 'artifacts', 'iui-perf', staticMode ? 'static' : 'live')
  await mkdir(outDir, { recursive: true })
  const artifact = await ensureArtifact(outDir)
  const digest = await sha256(artifact)
  if (digest !== IUI_SHA) throw new Error(`IUI sha256 ${digest} != pin ${IUI_SHA}`)
  const pluginDir = await ensurePluginDir(artifact)
  const order = []
  for (let index = 1; index <= runs; index += 1) {
    order.push(['A', index], ['B', index])
  }
  const finished = []
  for (const [group, index] of order) {
    const capDir = join(outDir, 'captures', `${group}-${index}`)
    await mkdir(capDir, { recursive: true })
    console.log(`capture ${group} #${index}`)
    const server = await startMessagesServer({
      dir: capDir,
      forward: !staticMode,
    })
    try {
      const captured = group === 'A'
        ? await captureA({ baseUrl: server.origin, pluginDir, capDir, forward: !staticMode })
        : await captureB({
          baseUrl: server.origin,
          artifact,
          capDir,
          port: 4318,
          forward: !staticMode,
        })
      const turn = pickPromptTurn(captured.records)
      if (turn) {
        const folder = join(outDir, 'first-turn', `${group}-${index}`)
        await mkdir(folder, { recursive: true })
        await writeFile(join(folder, 'system.txt'), systemText(turn.body))
        await writeFile(join(folder, 'tools.json'), `${JSON.stringify(turn.body.tools, null, 2)}\n`)
      }
      let extras = null
      if (!staticMode) extras = await liveExtras(capDir, captured.records)
      const row = {
        group,
        index,
        requests: captured.records.length,
        toolRounds: captured.records.filter((record) => toolsOf(record.body).length > 0).length,
        e2eMs: captured.e2eMs,
        note: captured.note,
        port: captured.port,
        pluginFailures: captured.pluginFailures || [],
        indexRows: requestIndex(captured.records),
        extras,
      }
      await writeFile(join(capDir, 'summary.json'), `${JSON.stringify(row, null, 2)}\n`)
      finished.push({ ...captured, ...row })
      console.log(`${group} #${index} requests=${captured.records.length} prompt=${Boolean(turn)}`)
    } finally {
      await new Promise((resolveClose) => server.server.close(resolveClose))
    }
  }
  const left = finished.find((row) => row.group === 'A')
  const right = finished.find((row) => row.group === 'B')
  const comparison = await compareCaptures(
    { records: left ? left.records : [] },
    { records: right ? right.records : [] },
  )
  const overlays = {
    semanticOs: await inventoryFile(join(repoRoot, 'runtime/vendor-overlays/dsh-semantic-os/tools.js')),
    semanticSection: await inventoryFile(join(repoRoot, 'runtime/vendor-overlays/dsh-semantic-os/index.js')),
    lanAssist: await inventoryFile(join(repoRoot, 'runtime/vendor-overlays/dsh-lan-assist/tools.js')),
  }
  const report = {
    mode: staticMode ? 'static' : 'live',
    prompt: PROMPT,
    iui: { version: IUI_VERSION, commit: IUI_COMMIT, sha256: IUI_SHA },
    tokenizer: TOKENIZER_NAME,
    comparison,
    overlays,
    runs: finished.map((row) => ({
      group: row.group,
      index: row.index,
      requests: row.requests,
      toolRounds: row.toolRounds,
      e2eMs: row.e2eMs,
      note: row.note,
      port: row.port,
      pluginFailures: row.pluginFailures,
      indexRows: row.indexRows,
      extras: row.extras,
    })),
  }
  await writeFile(join(outDir, 'comparison.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(join(outDir, 'comparison.md'), markdownTable(comparison, report.runs))
  console.log(`wrote ${join(outDir, 'comparison.md')}`)
}

await main()
