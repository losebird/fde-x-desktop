import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

function hostEl(cwd, visible = true) {
  return {
    isConnected: true,
    offsetParent: visible ? {} : null,
    getClientRects: () => (visible ? [{ width: 10, height: 10 }] : []),
    getAttribute: (name) => (name === 'data-cwd' ? cwd : ''),
  }
}

function capturedUrl(entry) {
  const raw = entry.input
  if (typeof raw === 'string') return raw
  if (raw instanceof URL) return raw.pathname + raw.search
  return String(raw)
}

test('latin1 and semantic seams keep session create one-handed', async () => {
  const captured = []
  const nativeFetch = async (input, init) => {
    captured.push({ input, init })
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  }
  globalThis.window = globalThis
  globalThis.location = { origin: 'http://127.0.0.1:5174' }
  window.location = globalThis.location
  window.Headers = Headers
  window.fetch = nativeFetch
  window.__fdeLatin1Http = false

  const srcRoot = resolve(process.cwd(), 'src/lib')
  const { installLatin1Http } = await import(pathToFileURL(resolve(srcRoot, 'latin1-http.ts')).href)
  const { installSemanticOsHttp } = await import(pathToFileURL(resolve(srcRoot, 'semantic-http.ts')).href)
  const { sessionCreateBody, sessionRestoreBody, SESSION_BIND_BOTH, SESSION_RESTORE_BOTH } = await import(pathToFileURL(resolve(srcRoot, 'session-bind.ts')).href)

  installLatin1Http()
  const stop = installSemanticOsHttp(hostEl('/tmp/ws-a'), '/tmp/ws-a')

  captured.length = 0
  await window.fetch('/api/v1/ai/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sessionCreateBody({ workspaceId: 'ws-1' })),
  })
  assert.equal(captured.length, 1)
  assert.equal(capturedUrl(captured[0]), '/api/v1/ai/sessions')
  assert.deepEqual(JSON.parse(String(captured[0].init.body)), { workspaceId: 'ws-1' })

  captured.length = 0
  await window.fetch('/api/v1/memory/ready')
  assert.equal(capturedUrl(captured[0]), '/api/v1/memory/ready')

  captured.length = 0
  await window.fetch('/api/v1/memory/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ foo: 1 }),
  })
  assert.deepEqual(JSON.parse(String(captured[0].init.body)), { foo: 1 })
  assert.equal(capturedUrl(captured[0]).includes('cwd='), false)

  captured.length = 0
  await window.fetch('/api/v1/ai/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sessionCreateBody({ cwd: '/tmp/ws-b' })),
  })
  assert.deepEqual(JSON.parse(String(captured[0].init.body)), { cwd: '/tmp/ws-b' })
  assert.equal(capturedUrl(captured[0]).includes('cwd='), false)

  captured.length = 0
  await window.fetch('/semantic-os/api/graph')
  assert.equal(capturedUrl(captured[0]), '/semantic-os/api/graph?cwd=%2Ftmp%2Fws-a')

  captured.length = 0
  await window.fetch('/semantic-os/ingest/start?cwd=%2Ftmp%2Fws-a', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cwd: '/tmp/ws-a' }),
  })
  assert.equal(capturedUrl(captured[0]), '/semantic-os/ingest/start?cwd=%2Ftmp%2Fws-a')
  assert.deepEqual(JSON.parse(String(captured[0].init.body)), { cwd: '/tmp/ws-a' })

  assert.throws(
    () => sessionCreateBody({ workspaceId: 'ws-1', cwd: '/tmp/ws-a' }),
    (error) => error instanceof Error && error.message === SESSION_BIND_BOTH,
  )
  assert.deepEqual(
    sessionRestoreBody({ workspaceId: 'ws-1', writeCwd: '/tmp/write', sessions: [] }),
    { workspaceId: 'ws-1', writeCwd: '/tmp/write', sessions: [] },
  )
  assert.throws(
    () => sessionRestoreBody({ workspaceId: 'ws-1', cwd: '/tmp/ws-a', sessions: [] }),
    (error) => error instanceof Error && error.message === SESSION_RESTORE_BOTH,
  )

  stop()
  captured.length = 0
  await window.fetch('/semantic-os/api/graph')
  assert.equal(capturedUrl(captured[0]), '/semantic-os/api/graph')

  const stopA = installSemanticOsHttp(hostEl('/tmp/ws-a'), '/tmp/ws-a')
  const stopB = installSemanticOsHttp(hostEl('/tmp/ws-b'), '/tmp/ws-b')
  captured.length = 0
  await window.fetch('/semantic-os/nodes')
  assert.equal(capturedUrl(captured[0]), '/semantic-os/nodes?cwd=%2Ftmp%2Fws-b')
  stopB()
  captured.length = 0
  await window.fetch('/semantic-os/nodes')
  assert.equal(capturedUrl(captured[0]), '/semantic-os/nodes?cwd=%2Ftmp%2Fws-a')
  stopA()
})
