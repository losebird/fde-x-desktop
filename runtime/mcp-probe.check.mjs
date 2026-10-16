import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const port = Number(process.env.FDE_PROBE_CHECK_PORT || 4471)
const origin = 'http://127.0.0.1:5174'
const home = '/tmp/fde-mcp-probe-dsh'
const dbPath = '/tmp/fde-mcp-probe.sqlite'
const workspace = '/tmp/fde-mcp-probe-files'
const base = `http://127.0.0.1:${port}`
const root = fileURLToPath(new URL('..', import.meta.url))
const patchFiles = [
  join(home, 'cordis.patch.yml'),
  join(home, 'profiles', 'fde-x', 'cordis.patch.yml'),
]

function fail(message) {
  throw new Error(message)
}

async function fileStamp(path) {
  try {
    const buf = await readFile(path)
    return `${(await stat(path)).size}:${createHash('sha256').update(buf).digest('hex')}`
  } catch {
    return 'absent'
  }
}

async function listen(handler) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const listened = typeof address === 'object' && address ? address.port : 0
  return { server, url: `http://127.0.0.1:${listened}/mcp` }
}

async function post(path, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const child = spawn(process.execPath, ['runtime/server.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    FDE_RUNTIME_PORT: String(port),
    FDE_DATABASE_PATH: dbPath,
    FDE_DSH_HOME: home,
    FDE_AI_WORKSPACE: workspace,
    FDE_ALLOWED_ORIGINS: origin,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.on('data', (chunk) => {
  stderr = `${stderr}${chunk.toString()}`.slice(-8000)
})

const closers = []

try {
  await rm(home, { recursive: true, force: true })
  await rm(dbPath, { force: true })
  await rm(`${dbPath}-shm`, { force: true })
  await rm(`${dbPath}-wal`, { force: true })
  await mkdir(workspace, { recursive: true })
  await mkdir(home, { recursive: true })

  let healthy = false
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`)
      if (response.ok) {
        healthy = true
        break
      }
    } catch {
      /* still starting */
    }
    await delay(200)
  }
  if (!healthy) fail(`runtime did not start: ${stderr}`)

  const beforePatches = {}
  for (const file of patchFiles) beforePatches[file] = await fileStamp(file)
  const beforeServers = await fetch(`${base}/api/v1/mcp/servers`)
  const beforeServersText = await beforeServers.text()
  const beforeServersData = JSON.stringify(JSON.parse(beforeServersText).data ?? null)

  const missingOrigin = await post('/api/v1/mcp/probe', { transport: 'stdio', command: 'npx' })
  if (missingOrigin.status !== 403) fail(`probe without Origin should be 403, got ${missingOrigin.status}`)
  const missingBody = await missingOrigin.json()
  if (missingBody.error?.code !== 'origin_not_allowed') fail(`probe without Origin code ${missingBody.error?.code}`)

  const evil = await post('/api/v1/mcp/probe', { transport: 'stdio', command: 'npx' }, { Origin: 'http://evil.example' })
  if (evil.status !== 403) fail(`probe with foreign Origin should be 403, got ${evil.status}`)

  const bad = await post('/api/v1/mcp/probe', { transport: 'stdio' }, { Origin: origin })
  if (bad.status !== 400) fail(`probe without command should be 400, got ${bad.status}`)
  const badBody = await bad.json()
  if (badBody.error?.code !== 'validation_error') fail(`probe validation code ${badBody.error?.code}`)

  const blocked = await post('/api/v1/mcp/probe', { transport: 'streamable-http', url: 'file:///etc/passwd' }, { Origin: origin })
  if (blocked.status !== 400) fail(`file url should be 400, got ${blocked.status}`)

  const metadataStarted = Date.now()
  const metadata = await post('/api/v1/mcp/probe', {
    transport: 'streamable-http',
    url: 'http://169.254.169.254/latest/meta-data',
  }, { Origin: origin })
  const metadataElapsed = Date.now() - metadataStarted
  if (metadata.status !== 400) fail(`metadata probe should be 400, got ${metadata.status} ${await metadata.text()}`)
  const metadataBody = await metadata.json()
  if (metadataBody.error?.code !== 'validation_error') fail(`metadata probe code ${metadataBody.error?.code}`)
  if (!/不在探测允许范围内/.test(String(metadataBody.error?.message || ''))) fail(`metadata probe message ${metadataBody.error?.message}`)
  if (metadataElapsed > 2000) fail(`metadata probe took ${metadataElapsed}ms`)

  const googleStarted = Date.now()
  const google = await post('/api/v1/mcp/probe', {
    transport: 'streamable-http',
    url: 'http://metadata.google.internal/computeMetadata/v1/',
  }, { Origin: origin })
  const googleElapsed = Date.now() - googleStarted
  if (google.status !== 400) fail(`google metadata probe should be 400, got ${google.status} ${await google.text()}`)
  const googleBody = await google.json()
  if (googleBody.error?.code !== 'validation_error') fail(`google metadata probe code ${googleBody.error?.code}`)
  if (!/不在探测允许范围内|无法解析/.test(String(googleBody.error?.message || ''))) fail(`google metadata probe message ${googleBody.error?.message}`)
  if (googleElapsed > 2000) fail(`google metadata probe took ${googleElapsed}ms`)

  const missingFile = await post('/api/v1/mcp/probe', {
    transport: 'stdio',
    command: '/tmp/fde-x-no-such-mcp-probe-bin',
  }, { Origin: origin })
  if (missingFile.status !== 200) fail(`missing file probe should be 200, got ${missingFile.status}`)
  const missingFileBody = await missingFile.json()
  if (missingFileBody.data?.ok !== false) fail(`missing file probe should be ok:false ${JSON.stringify(missingFileBody)}`)
  if (!/找不到文件/.test(String(missingFileBody.data?.message || ''))) fail(`missing file message ${missingFileBody.data?.message}`)
  if (missingFileBody.note) fail('probe must not report a config write')
  if (missingFile.headers.get('set-cookie')) fail('probe must not set a cookie')

  const seen = []
  const okMock = await listen((request, response) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      seen.push({
        cookie: request.headers.cookie || '',
        authorization: request.headers.authorization || '',
        body: Buffer.concat(chunks).toString('utf8'),
      })
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { protocolVersion: '2025-03-26', capabilities: {} },
      }))
    })
  })
  closers.push(okMock.server)
  const reached = await post('/api/v1/mcp/probe', {
    transport: 'streamable-http',
    url: okMock.url,
    headers: { Cookie: 'draft=no', Authorization: 'Bearer t' },
  }, { Origin: origin, Cookie: 'bff=should-not-forward' })
  if (reached.status !== 200) fail(`reachable probe should be 200, got ${reached.status} ${await reached.text()}`)
  const reachedBody = await reached.json()
  if (reachedBody.data?.ok !== true) fail(`reachable probe ${JSON.stringify(reachedBody)}`)
  if (seen.length !== 1) fail(`probe should call the draft url once, got ${seen.length}`)
  if (seen[0].cookie) fail(`probe forwarded a cookie: ${seen[0].cookie}`)
  if (seen[0].authorization !== 'Bearer t') fail(`probe dropped the draft authorization: ${seen[0].authorization}`)
  if (!seen[0].body.includes('"initialize"')) fail('probe did not send initialize')

  const hang = await listen(() => {})
  closers.push(hang.server)
  const started = Date.now()
  const timed = await post('/api/v1/mcp/probe', { transport: 'streamable-http', url: hang.url }, { Origin: origin })
  const elapsed = Date.now() - started
  if (timed.status !== 200) fail(`timeout probe should be 200, got ${timed.status}`)
  const timedBody = await timed.json()
  if (timedBody.data?.message !== 'timeout') fail(`timeout message ${timedBody.data?.message}`)
  if (elapsed >= 12_000) fail(`probe timeout took ${elapsed}ms`)

  for (const file of patchFiles) {
    const after = await fileStamp(file)
    if (after !== beforePatches[file]) fail(`probe wrote ${file}: ${beforePatches[file]} -> ${after}`)
  }
  const afterServers = await fetch(`${base}/api/v1/mcp/servers`)
  const afterServersText = await afterServers.text()
  const afterServersData = JSON.stringify(JSON.parse(afterServersText).data ?? null)
  if (afterServers.status !== beforeServers.status || afterServersData !== beforeServersData) {
    fail(`probe changed GET /api/v1/mcp/servers ${beforeServers.status} -> ${afterServers.status}\n${beforeServersData}\n${afterServersData}`)
  }

  console.log(JSON.stringify({
    ok: true,
    missingFile: missingFileBody.data,
    reached: reachedBody.data,
    timeoutMs: elapsed,
    metadata: { status: metadata.status, message: metadataBody.error?.message, elapsed: metadataElapsed },
    googleMetadata: { status: google.status, message: googleBody.error?.message, elapsed: googleElapsed },
    patches: beforePatches,
    serversStatus: beforeServers.status,
  }))
  console.log('mcp-probe ok')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  if (stderr) console.error(stderr)
  process.exitCode = 1
} finally {
  for (const server of closers) {
    await new Promise((resolve) => server.close(() => resolve()))
  }
  if (child.exitCode == null && !child.killed) child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(2000).then(() => { if (child.exitCode == null) child.kill('SIGKILL') }),
  ])
  await rm(home, { recursive: true, force: true })
  await rm(dbPath, { force: true })
  await rm(`${dbPath}-shm`, { force: true })
  await rm(`${dbPath}-wal`, { force: true })
}
