import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import test from 'node:test'
import { createHandler, webSocketAccept } from '../http.js'

async function request(handler, path) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`)
    return { status: response.status, body: await response.json() }
  } finally {
    server.close()
  }
}

function handler(allowed) {
  const noopIngest = { snapshot: () => ({}), ensure: () => ({}), start: () => ({}), cancel: () => ({}), retry: () => ({}) }
  return createHandler({
    sidecar: { snapshot: () => ({ ready: false }), getApiKey: () => '', retryReady: async () => ({ ready: false }) },
    getConfig: () => ({}),
    ingest: noopIngest,
    writes: { snapshot: () => ({}) },
    sessionIngest: { snapshot: () => ({}) },
    workspaceAuthority: { allows: async () => allowed },
  })
}

test('websocket accept key matches RFC 6455 sample', () => {
  assert.equal(webSocketAccept('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=')
})

test('proxy graph routes reject unowned cwd before reaching sidecar', async () => {
  const result = await request(handler(false), '/semantic-os/api/graph/nodes?cwd=/private/foreign')
  assert.equal(result.status, 403)
  assert.equal(result.body.error, 'CWD_NOT_AUTHORIZED')
})

test('authorized proxy graph routes continue to sidecar readiness check', async () => {
  const result = await request(handler(true), '/semantic-os/api/graph/nodes?cwd=/workspace')
  assert.equal(result.status, 503)
  assert.equal(result.body.error, 'NOT_READY')
})

test('explorer shell rejects missing or unowned cwd', async () => {
  const missing = await request(handler(true), '/semantic-os/explorer')
  assert.equal(missing.status, 403)
  const foreign = await request(handler(false), '/semantic-os/explorer?cwd=/private/foreign')
  assert.equal(foreign.status, 403)
})

test('authorized explorer HTML is gone', async () => {
  const result = await request(handler(true), '/semantic-os/explorer?cwd=/workspace')
  assert.equal(result.status, 410)
  assert.equal(result.body.error, 'GONE')
})

async function post(handler, path, body) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const origin = `http://127.0.0.1:${server.address().port}`
    const response = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
  } finally {
    server.close()
  }
}

test('canvas graph search does not proxy official ContextGraph search', () => {
  const src = readFileSync(new URL('../product.js', import.meta.url), 'utf8')
  const start = src.indexOf('async function serveGraphSearch')
  const end = src.indexOf('async function serveNodes')
  const fn = src.slice(start, end)
  assert.match(fn, /op: 'graph_label_search'/)
  assert.equal(fn.includes("path: '/api/graph/search'"), false)
  assert.equal(fn.includes('ContextGraph'), false)
})

test('ontology health and shacl use the slim workbench report, not Explorer', () => {
  const src = readFileSync(new URL('../product.js', import.meta.url), 'utf8')
  assert.match(src, /api\/ontology\/health/)
  assert.match(src, /op: 'shacl_report'/)
  assert.equal(src.includes('GRAPH_TOO_LARGE'), false)
})

test('browser python path refuses vocab upsert', async () => {
  const result = await post(handler(true), '/semantic-os/python', {
    op: 'upsert_workspace_vocab',
    cwd: '/workspace',
    args: { concepts: [{ id: 'x', label: '测型', fields: ['单号'], can: ['现查'] }] },
  })
  assert.equal(result.status, 403)
  assert.equal(result.body.error, 'USE_HOST_TOOL')
  const leaked = await post(handler(true), '/semantic-os/_dsh/python', {
    op: 'upsert_workspace_vocab',
    cwd: '/workspace',
    args: { concepts: [{ id: 'x', label: '测型', fields: ['单号'], can: ['现查'] }] },
  })
  assert.equal(leaked.status, 403)
  assert.equal(leaked.body.error, 'USE_HOST_TOOL')
})

test('vocab concept patch is a product write, not python', () => {
  const src = readFileSync(new URL('../product.js', import.meta.url), 'utf8')
  assert.match(src, /api\/vocabulary\/concepts/)
  assert.match(src, /replace_empty: true/)
  assert.match(src, /op: 'upsert_workspace_vocab'/)
  const start = src.indexOf('if (String(body.op || \'\') === \'upsert_workspace_vocab\')')
  assert.notEqual(start, -1)
})

test('vocab concept patch refuses unowned cwd, empty pack, and rows', async () => {
  const denied = await post(handler(false), '/semantic-os/api/vocabulary/concepts', {
    cwd: '/private/foreign',
    concepts: [{ id: 'x', label: '测型', fields: ['单号'], can: ['现查'] }],
  })
  assert.equal(denied.status, 403)
  assert.equal(denied.body.error, 'CWD_NOT_AUTHORIZED')

  const empty = await post(handler(true), '/semantic-os/api/vocabulary/concepts', {
    cwd: '/workspace',
    concepts: [],
  })
  assert.equal(empty.status, 400)
  assert.equal(empty.body.error, 'NO_CONCEPTS')

  const row = await post(handler(true), '/semantic-os/api/vocabulary/concepts', {
    cwd: '/workspace',
    concepts: [{ id: 'x', label: '测型', ticket: 'PO-12' }],
  })
  assert.equal(row.status, 400)
  assert.equal(row.body.error, 'NOT_A_KIND')

  const notReady = await post(handler(true), '/semantic-os/api/vocabulary/concepts', {
    cwd: '/workspace',
    concepts: [{ id: 'x', label: '测型', fields: ['单号'], can: ['现查'] }],
  })
  assert.equal(notReady.status, 503)
  assert.equal(notReady.body.error, 'NOT_READY')
})

test('GET vocabulary/concepts lists SKOS, not NO_EXPLORER', async () => {
  const denied = await request(handler(false), '/semantic-os/api/vocabulary/concepts?cwd=/private/foreign')
  assert.equal(denied.status, 403)
  const listed = await request(handler(true), '/semantic-os/api/vocabulary/concepts?cwd=/workspace')
  assert.equal(listed.status, 200)
  assert.equal(Array.isArray(listed.body), true)
})

test('find wraps search_text and stays unauthorized without cwd grant', async () => {
  const denied = await post(handler(false), '/semantic-os/find', { query: '客户', cwd: '/private/foreign' })
  assert.equal(denied.status, 403)
  assert.equal(denied.body.error, 'CWD_NOT_AUTHORIZED')
  const idle = await post(handler(true), '/semantic-os/find', { query: '', cwd: '/workspace' })
  assert.equal(idle.status, 200)
  assert.equal(idle.body.semanticStatus, 'idle')
  const notReady = await post(handler(true), '/semantic-os/find', { query: '客户', cwd: '/workspace' })
  assert.equal(notReady.status, 200)
  assert.equal(notReady.body.semanticStatus, 'unavailable')
  assert.equal(notReady.body.error, 'NOT_READY')
})
