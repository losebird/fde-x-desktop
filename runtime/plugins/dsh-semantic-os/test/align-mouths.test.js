import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { handleProduct } from '../product.js'
import { addAnnotation, deleteAnnotation, listAnnotations } from '../annotations.js'

const root = new URL('..', import.meta.url).pathname

function pythonBin() {
  if (process.env.DSH_RUNTIME_PYTHON) return process.env.DSH_RUNTIME_PYTHON
  const bundled = new URL('../runtime-dist/darwin-arm64/python/bin/python3', import.meta.url).pathname
  if (existsSync(bundled)) return bundled
  return process.env.HOME
    ? join(process.env.HOME, '.dsh-fde-x/semantic-os/venv/bin/python')
    : 'python3'
}

function py(code, extraEnv = {}) {
  const r = spawnSync(pythonBin(), ['-c', code], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python', DSH_RUNTIME_PYTHON: pythonBin(), ...extraEnv },
    timeout: 180000,
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

function pythonSidecar() {
  return {
    snapshot: () => ({ ready: true, port: 1 }),
    getApiKey: () => '',
    request(options) {
      const payload = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
      const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import run_tool
got = run_tool(${JSON.stringify(payload.op)}, ${JSON.stringify(payload.cwd)}, json.loads(${JSON.stringify(JSON.stringify(payload.args || {}))}))
print(json.dumps(got, ensure_ascii=False, default=str))
`)
      return Promise.resolve(JSON.parse(out))
    },
  }
}

function mockReq(method, body, headers = {}) {
  const req = new EventEmitter()
  req.method = method
  req.headers = { ...headers }
  req.destroy = () => {}
  if (body !== undefined) {
    const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
    req.headers['content-type'] = 'application/json'
    setImmediate(() => {
      req.emit('data', buf)
      req.emit('end')
    })
  }
  return req
}

function mockRes() {
  const out = {}
  return {
    out,
    writeHead(status, headers) {
      out.status = status
      out.headers = headers
    },
    end(buf) {
      out.body = buf && buf.length ? JSON.parse(Buffer.from(buf).toString()) : null
    },
  }
}

async function product(method, path, { body, cwd, allow = true } = {}) {
  const res = mockRes()
  const url = new URL(path, 'http://127.0.0.1')
  if (cwd) url.searchParams.set('cwd', cwd)
  await handleProduct(mockReq(method, body, cwd ? { 'x-dsh-cwd': cwd } : {}), res, url, {
    sidecar: pythonSidecar(),
    ingest: { snapshot() { return {} } },
    workspaceAuthority: { allows: async () => allow },
  })
  return res.out
}

test('update_node merges properties and delete_node archives then get', { timeout: 180000 }, () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-upd-'))
  try {
    const out = py(`
import json, sys
sys.path.insert(0, "python")
import graph_store
from align_ops import run_update_node, run_delete_node
cwd = ${JSON.stringify(cwd)}
graph_store.put_node(cwd, {"id": "n1", "type": "Person", "content": "甲", "properties": {"note": "old"}})
missing = run_update_node(cwd, {"node_id": "n1"})
empty = run_update_node(cwd, {"node_id": "n1", "properties": {}})
gone = run_update_node(cwd, {"node_id": "missing", "properties": {"note": "x"}})
upd = run_update_node(cwd, {"node_id": "n1", "properties": {"note": "done", "status": "done"}})
got = graph_store.read_one(cwd, "n1")
arch = run_delete_node(cwd, {"node_id": "n1"})
again = graph_store.read_one(cwd, "n1")
print(json.dumps({
  "missing": missing.get("error"),
  "empty": empty.get("error"),
  "gone": gone.get("error"),
  "upd": upd.get("ok"),
  "note": (got.get("properties") or {}).get("note"),
  "status": (got.get("properties") or {}).get("status"),
  "arch": arch.get("status"),
  "kept": again is not None,
  "archived": (again.get("properties") or {}).get("status") if again else None,
}, ensure_ascii=False))
`)
    const got = JSON.parse(out)
    assert.equal(got.missing, 'NO_PROPERTIES')
    assert.equal(got.empty, 'NO_PROPERTIES')
    assert.equal(got.gone, 'NO_NODE')
    assert.equal(got.upd, true)
    assert.equal(got.note, 'done')
    assert.equal(got.status, 'done')
    assert.equal(got.arch, 'archived')
    assert.equal(got.kept, true)
    assert.equal(got.archived, 'archived')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('Explorer REST mouths never return NO_EXPLORER', { timeout: 180000 }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-rest-'))
  try {
    py(`
import sys
sys.path.insert(0, "python")
import graph_store
cwd = ${JSON.stringify(cwd)}
graph_store.put_node(cwd, {"id": "a", "type": "decision", "content": "A", "properties": {}})
graph_store.put_node(cwd, {"id": "b", "type": "decision", "content": "B", "properties": {}})
graph_store.put_edge(cwd, "a", "b", "CAUSED")
`)
    const denied = await product('GET', '/semantic-os/api/annotations', { cwd: '/private/foreign', allow: false })
    assert.equal(denied.status, 403)
    assert.equal(denied.body.error, 'CWD_NOT_AUTHORIZED')

    const listed = await product('GET', '/semantic-os/api/annotations', { cwd })
    assert.equal(listed.status, 200)
    assert.equal(listed.body.error, undefined)
    assert.ok(Array.isArray(listed.body))

    const created = await product('POST', '/semantic-os/api/annotations', {
      cwd,
      body: { cwd, node_id: 'a', content: 'looks right' },
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.content, 'looks right')
    assert.equal(created.body.node_id, 'a')
    assert.notEqual(created.body.error, 'NO_EXPLORER')
    const annId = created.body.annotation_id || created.body.id

    const again = await product('GET', '/semantic-os/api/annotations', { cwd })
    assert.equal(again.body.length, 1)

    const removed = await product('DELETE', `/semantic-os/api/annotations/${annId}`, { cwd })
    assert.equal(removed.status, 204)

    const matrix = await product('POST', '/semantic-os/api/graph/distance-matrix', {
      cwd,
      body: { cwd, node_ids: ['a', 'b'], metric: 'hops' },
    })
    assert.equal(matrix.status, 200)
    assert.notEqual(matrix.body.error, 'NO_EXPLORER')
    assert.equal(matrix.body.matrix[0][1], 1)

    const causal = await product('GET', `/semantic-os/api/decisions/causal-distance?source=a&target=b&cwd=${encodeURIComponent(cwd)}`, { cwd })
    assert.equal(causal.status, 200)
    assert.notEqual(causal.body.error, 'NO_EXPLORER')
    assert.equal(causal.body.causal_hop_count, 1)

    const valid = await product('GET', '/semantic-os/api/analytics/validation', { cwd })
    assert.equal(valid.status, 200)
    assert.notEqual(valid.body.error, 'NO_EXPLORER')
    assert.equal(typeof valid.body.valid, 'boolean')

    const extract = await product('POST', '/semantic-os/api/enrich/extract', {
      cwd,
      body: { cwd, text: '张三在杭州' },
    })
    assert.notEqual(extract.body.error, 'NO_EXPLORER')
    assert.ok(extract.status === 200 || extract.status === 503)

    const memories = await product('GET', '/semantic-os/api/memories', { cwd })
    assert.notEqual(memories.body.error, 'NO_EXPLORER')
    assert.ok(memories.status === 200 || memories.status === 503)
    if (memories.status === 200) {
      assert.ok(Array.isArray(memories.body.items))
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('AgentMemory store lists as 已入档 档案 and GET memories', { timeout: 180000 }, () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-mem-'))
  try {
    const out = py(`
import json, sys
sys.path.insert(0, "python")
from agent_mem import store_agent_memory, list_agent_memory_snapshot
from bootstrap import run_list_memory_cards
cwd = ${JSON.stringify(cwd)}
stored = store_agent_memory(cwd, "只发 darwin-arm64", memory_id="memory:align1", metadata={"type": "note"})
snap = list_agent_memory_snapshot(cwd, skip=0, limit=20)
cards = run_list_memory_cards(cwd, {"include_filed": True, "limit": 80})
ids = [row.get("id") for row in (snap.get("items") or [])]
card_ids = [row.get("id") for row in (cards.get("cards") or [])]
print(json.dumps({
  "stored": stored.get("id"),
  "ok": stored.get("ok"),
  "snap_ids": ids,
  "card_ids": card_ids,
  "status": next((row.get("status") for row in (cards.get("cards") or []) if row.get("id") == stored.get("id")), None),
}, ensure_ascii=False))
`)
    const got = JSON.parse(out)
    assert.equal(got.ok, true)
    assert.ok(String(got.stored).includes('memory:'))
    assert.ok(got.snap_ids.includes(got.stored) || got.card_ids.includes(got.stored))
    assert.ok(got.card_ids.includes(got.stored))
    assert.equal(got.status, '已入档')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('handleProduct enrich/merge: unconfirmed 400, confirmed writes, rewritten official body merges', { timeout: 180000 }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-merge-'))
  try {
    py(`
import sys
sys.path.insert(0, "python")
import graph_store
cwd = ${JSON.stringify(cwd)}
graph_store.put_node(cwd, {"id": "p1", "type": "Org", "content": "主", "properties": {"country": "US"}})
graph_store.put_node(cwd, {"id": "d1", "type": "Org", "content": "副", "properties": {"founded": "2004"}})
graph_store.put_edge(cwd, "d1", "x1", "owns")
graph_store.put_node(cwd, {"id": "x1", "type": "Person", "content": "人", "properties": {}})
`)
    const official = { primary_id: 'p1', duplicate_ids: ['d1'], cwd }
    const refused = await product('POST', '/semantic-os/api/enrich/merge', { cwd, body: official })
    assert.equal(refused.status, 400)
    assert.equal(refused.body.error, 'CONFIRM_REQUIRED')
    assert.notEqual(refused.body.error, 'NO_EXPLORER')

    const { stampOfficialMergeBody } = await import(pathToFileURL(resolve(root, '../../../src/lib/semantic-http.ts')).href)
    const rewritten = JSON.parse(stampOfficialMergeBody(JSON.stringify({ primary_id: 'p1', duplicate_ids: ['d1'] })))
    assert.equal(rewritten.confirm, true)
    const done = await product('POST', '/semantic-os/api/enrich/merge', { cwd, body: { ...rewritten, cwd } })
    assert.equal(done.status, 200)
    assert.equal(done.body.merged_into, 'p1')
    assert.notEqual(done.body.error, 'NO_EXPLORER')

    const check = py(`
import json, sys
sys.path.insert(0, "python")
import graph_store
nodes, edges = graph_store.read_all(${JSON.stringify(cwd)})
print(json.dumps({
  "gone": "d1" not in nodes,
  "founded": (nodes.get("p1") or {}).get("properties", {}).get("founded"),
  "redirect": any(e.get("source") == "p1" and e.get("target") == "x1" for e in edges),
}, ensure_ascii=False))
`)
    const got = JSON.parse(check)
    assert.equal(got.gone, true)
    assert.equal(got.founded, '2004')
    assert.equal(got.redirect, true)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('connectors stay false without config and ingest a local file when configured', { timeout: 180000 }, () => {
  const home = mkdtempSync(join(tmpdir(), 'dsos-conn-home-'))
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-conn-'))
  const payload = join(cwd, 'rows.json')
  writeFileSync(payload, JSON.stringify({ rows: [{ id: 1 }] }))
  try {
    const out = py(`
import json, sys
sys.path.insert(0, "python")
from align_ops import run_connector_status, run_connector_query
idle = run_connector_status("", {})
sap = next(row for row in idle["connectors"] if row["name"] == "sap")
snow = next(row for row in idle["connectors"] if row["name"] == "snowflake")
q = run_connector_query("", {"name": "sap", "url": ${JSON.stringify('file://' + payload)}})
print(json.dumps({
  "n": len(idle["connectors"]),
  "sap": sap["connected"],
  "snow": snow["connected"],
  "ok": q.get("ok"),
  "connected": q.get("connected"),
  "rows": (q.get("payload") or {}).get("rows"),
}, ensure_ascii=False))
`, { DSH_HOME: home })
    const got = JSON.parse(out)
    assert.equal(got.n, 14)
    assert.equal(got.sap, false)
    assert.equal(got.snow, false)
    assert.equal(got.ok, true)
    assert.equal(got.connected, true)
    assert.deepEqual(got.rows, [{ id: 1 }])
  } finally {
    rmSync(home, { recursive: true, force: true })
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('durable annotations survive list after add', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-ann-'))
  try {
    const added = await addAnnotation(cwd, 'schema note', 'n1', { node_id: 'n1' })
    assert.equal(added.ok, true)
    const listed = await listAnnotations(cwd, 'n1')
    assert.equal(listed.items[0].content, 'schema note')
    const gone = await deleteAnnotation(cwd, listed.items[0].annotation_id)
    assert.equal(gone.ok, true)
    assert.equal((await listAnnotations(cwd)).items.length, 0)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
