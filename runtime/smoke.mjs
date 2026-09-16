import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { mkdir } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

const node = process.execPath
const port = Number(process.env.FDE_SMOKE_PORT || 4398)
const base = `http://127.0.0.1:${port}`
const origin = 'http://127.0.0.1:5173'
const child = spawn(node, ['runtime/server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    FDE_RUNTIME_PORT: String(port),
    FDE_DATABASE_PATH: '/tmp/fde-x-runtime-smoke.sqlite',
    FDE_AI_WORKSPACE: '/tmp/fde-x-files-smoke',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`)
      if (response.ok) return response.json()
    } catch {
      // 服务仍在启动。
    }
    await delay(50)
  }
  throw new Error(`runtime did not start: ${stderr}`)
}

function post(path, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

try {
  await mkdir('/tmp/fde-x-files-smoke', { recursive: true })
  const health = await waitForHealth()
  if (health.state !== 'healthy') throw new Error('database health is not healthy')

  const semanticUnconnected = await fetch(`${base}/semantic-os/ws/explore/explore.js`, { headers: { Origin: origin } })
  if (semanticUnconnected.status !== 503) {
    const peek = await semanticUnconnected.clone().text()
    throw new Error(`semantic-os without core should be 503, got ${semanticUnconnected.status} ${peek.slice(0, 180)}`)
  }
  if (semanticUnconnected.headers.get('set-cookie')) throw new Error('semantic-os must not leak Set-Cookie')
  const semanticEscape = await new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/semantic-os/%2e%2e/health',
      headers: { Origin: origin },
    }, (res) => resolve(res.statusCode || 0))
    req.on('error', reject)
    req.end()
  })
  if (semanticEscape !== 400) throw new Error(`semantic-os path escape should be 400, got ${semanticEscape}`)
  const semanticWrite = await fetch(`${base}/semantic-os/api/coverage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  if (semanticWrite.status !== 403) throw new Error(`semantic-os write without Origin should be 403, got ${semanticWrite.status}`)
  const semanticEvil = await fetch(`${base}/semantic-os/ws/explore/explore.js`, { headers: { Origin: 'http://evil.example' } })
  if (semanticEvil.status !== 403) throw new Error(`semantic-os foreign origin should be 403, got ${semanticEvil.status}`)

  const missingOrigin = await fetch(`${base}/api/v1/ai/connect`, { method: 'POST' })
  if (missingOrigin.status !== 403) throw new Error(`write without Origin should be 403, got ${missingOrigin.status}`)
  const missingOriginReload = await fetch(`${base}/api/v1/ai/reload`, { method: 'POST' })
  if (missingOriginReload.status !== 403) throw new Error(`reload without Origin should be 403, got ${missingOriginReload.status}`)
  const missingOriginBiz = await fetch(`${base}/api/v1/biz/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  if (missingOriginBiz.status !== 403) throw new Error(`biz write without Origin should be 403, got ${missingOriginBiz.status}`)
  const missingOriginFiles = await fetch(`${base}/api/v1/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  if (missingOriginFiles.status !== 403) throw new Error(`file write without Origin should be 403, got ${missingOriginFiles.status}`)
  const lookupMissingOrigin = await fetch(`${base}/api/v1/biz/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  if (lookupMissingOrigin.status !== 403) throw new Error(`lookup without Origin should be 403, got ${lookupMissingOrigin.status}`)
  const lookupExists = await post('/api/v1/biz/lookup', { baseUrl: '127.0.0.1:9' })
  if (lookupExists.status === 404) throw new Error('lookup route must exist')

  const nativeRpc = await fetch(`${base}/api/session.list`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (nativeRpc.status !== 404) throw new Error(`DSH catch-all must be gone, got ${nativeRpc.status}`)

  const nativePlugin = await fetch(`${base}/plugins/ui-conversation/index.js`, { headers: { Origin: origin } })
  if (nativePlugin.status !== 404) throw new Error(`/plugins must 404, got ${nativePlugin.status}`)

  const forbiddenOrigin = await post('/api/v1/ai/connect', undefined, { Origin: 'http://evil.example' })
  if (forbiddenOrigin.status !== 403) throw new Error(`foreign origin should be 403, got ${forbiddenOrigin.status}`)

  const islandBoot = await fetch(`${base}/api/v1/ai/session-island/boot`)
  if (islandBoot.status !== 404) throw new Error(`session island boot must 404, got ${islandBoot.status}`)

  const nativeFrontend = await fetch(`${base}/native-session/assets/index.js`, { headers: { Origin: origin } })
  if (nativeFrontend.status !== 404) throw new Error(`/native-session must 404, got ${nativeFrontend.status}`)

  const nativeWorkspace = await post('/api/v1/ai/native-workspaces', { id: 'ws_personal', name: '个人项目' })
  if (nativeWorkspace.status !== 404) throw new Error(`native-workspaces must 404, got ${nativeWorkspace.status}`)

  const escapeUpload = await post('/api/v1/files', { name: '../escape.txt', data: 'Zg==' })
  if (escapeUpload.status !== 400) throw new Error(`path escape upload should be 400, got ${escapeUpload.status}`)
  const okUpload = await post('/api/v1/files', { name: 'smoke.txt', data: 'Zg==' })
  if (okUpload.status !== 201) throw new Error(`workspace upload should be 201, got ${okUpload.status}`)
  const badDir = await post('/api/v1/files/mkdir', { name: '../escape' })
  if (badDir.status !== 400) throw new Error(`mkdir escape should be 400, got ${badDir.status}`)
  const okDir = await post('/api/v1/files/mkdir', { name: 'smoke-dir' })
  if (okDir.status !== 201) throw new Error(`mkdir should be 201, got ${okDir.status}`)
  const deleted = await fetch(`${base}/api/v1/files?name=smoke.txt`, { method: 'DELETE', headers: { Origin: origin } })
  if (deleted.status !== 200) throw new Error(`file delete should be 200, got ${deleted.status}`)
  const badDelete = await fetch(`${base}/api/v1/files?name=../escape.txt`, { method: 'DELETE', headers: { Origin: origin } })
  if (badDelete.status !== 400) throw new Error(`file delete escape should be 400, got ${badDelete.status}`)

  const workbenchStatus = await fetch(`${base}/api/v1/ai/status`)
  if (workbenchStatus.status !== 200) throw new Error('workbench /api/v1/ai/status must remain')

  const workspaceResponse = await post('/api/v1/workspaces', { name: '冒烟测试工作区', description: '验证事务、审计和 outbox' }, { 'X-Correlation-Id': 'corr_smoke_workspace' })
  if (workspaceResponse.status !== 201) throw new Error(`workspace create failed: ${workspaceResponse.status}`)
  const workspaceBody = await workspaceResponse.json()

  const appResponse = await post('/api/v1/business/apps', {
    workspaceId: workspaceBody.data.id,
    name: '冒烟测试业务应用',
    definition: { kind: 'ai-generated-draft', screens: [] },
  }, { 'X-Correlation-Id': 'corr_smoke_app' })
  if (appResponse.status !== 201) throw new Error(`business app create failed: ${appResponse.status}`)
  const appBody = await appResponse.json()
  if (appBody.data.status !== 'draft') throw new Error('generated business app was not created as draft')
  const appPut = await fetch(`${base}/api/v1/business/apps/${appBody.data.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition: { kind: 'ai-generated-draft', goal: 'x', screens: [] } }),
  })
  if (appPut.status !== 403) throw new Error(`app update without Origin should be 403, got ${appPut.status}`)
  const appUpdate = await fetch(`${base}/api/v1/business/apps/${appBody.data.id}`, {
    method: 'PUT',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition: { kind: 'ai-generated-draft', goal: '续费跟进', screens: ['清单'], dataSources: [], permissions: [] } }),
  })
  if (appUpdate.status !== 200) throw new Error(`business app update failed: ${appUpdate.status}`)
  const updatedApp = await appUpdate.json()
  if (updatedApp.data.currentRevision < 2) throw new Error('business app update did not bump revision')

  const operationResponse = await post('/api/v1/operations', {
    workspaceId: workspaceBody.data.id,
    targetRef: 'fde://external/demo-system/order/42',
    action: 'order.update',
    operationKind: 'write',
    riskLevel: 'high',
    executionMode: 'live',
    input: { status: 'approved' },
  }, { 'X-Correlation-Id': 'corr_smoke_operation' })
  if (operationResponse.status !== 201) throw new Error(`operation plan failed: ${operationResponse.status}`)
  const operationBody = await operationResponse.json()
  if (operationBody.data.state !== 'awaiting_approval') throw new Error('high-risk write bypassed approval gate')

  const approveResponse = await post(`/api/v1/operations/${operationBody.data.id}/approve`, { note: 'smoke approval' }, { 'X-Correlation-Id': 'corr_smoke_approve' })
  if (approveResponse.status !== 200) throw new Error(`operation approval failed: ${approveResponse.status}`)

  const liveExecuteResponse = await post(`/api/v1/operations/${operationBody.data.id}/execute`)
  if (liveExecuteResponse.status !== 501) throw new Error('live operation was not blocked while adapter is unavailable')

  const dryRunResponse = await post('/api/v1/operations', {
    workspaceId: workspaceBody.data.id,
    targetRef: 'fde://external/demo-system/order/42',
    action: 'order.read',
    operationKind: 'read',
    riskLevel: 'low',
    executionMode: 'dry_run',
    input: { fields: ['id', 'status'] },
  }, { 'X-Correlation-Id': 'corr_smoke_dry_run' })
  const dryRunBody = await dryRunResponse.json()
  const executeDryRunResponse = await post(`/api/v1/operations/${dryRunBody.data.id}/execute`)
  if (executeDryRunResponse.status !== 200) throw new Error(`dry-run execution failed: ${executeDryRunResponse.status}`)

  const traceResponse = await fetch(`${base}/api/v1/operations/${dryRunBody.data.id}/trace`)
  if (traceResponse.status !== 200) throw new Error(`operation trace failed: ${traceResponse.status}`)
  const traceBody = await traceResponse.json()
  if (traceBody.data.receipts.length !== 1) throw new Error('dry-run receipt was not included in operation trace')

  const listResponse = await fetch(`${base}/api/v1/operations?workspaceId=${workspaceBody.data.id}`)
  const listBody = await listResponse.json()
  if (listBody.items.length !== 2) throw new Error('operation list did not return planned operations')

  const eventsResponse = await fetch(`${base}/api/v1/events/pending`)
  const eventsBody = await eventsResponse.json()
  if (!eventsBody.items.some((event) => event.type === 'workspace.created')) throw new Error('workspace outbox event missing')
  if (!eventsBody.items.some((event) => event.type === 'operation.planned')) throw new Error('operation outbox event missing')

  console.log(JSON.stringify({
    status: 'ok',
    database: health.persistence.database,
    migrations: health.persistence.migrations.map((migration) => migration.version),
    generatedAppState: appBody.data.status,
    operationState: operationBody.data.state,
    liveExecutionBlocked: liveExecuteResponse.status === 501,
    dryRunSucceeded: executeDryRunResponse.status === 200,
    originRequiredOnWrite: missingOrigin.status === 403,
    catchAllGone: nativeRpc.status === 404,
    islandGone: islandBoot.status === 404,
    workbenchApiUntouched: workbenchStatus.status === 200,
  }, null, 2))
} finally {
  child.kill('SIGTERM')
}
