import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))

function pythonBin() {
  if (process.env.DSH_RUNTIME_PYTHON) return process.env.DSH_RUNTIME_PYTHON
  const bundled = new URL('../runtime-dist/darwin-arm64/python/bin/python3', import.meta.url).pathname
  if (existsSync(bundled)) return bundled
  return 'python3'
}

function py(code, extraEnv = {}) {
  const r = spawnSync(pythonBin(), ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python', ...extraEnv },
    timeout: 180000,
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('product.js does not mount create_app; sidecar does', () => {
  const src = readFileSync(join(root, 'product.js'), 'utf8')
  assert.equal(src.includes('create_app'), false)
  const boot = readFileSync(join(root, 'python/bootstrap.py'), 'utf8')
  assert.match(boot, /create_app/)
  assert.match(boot, /explorer_enabled/)
})

test('Explorer REST without SEMANTICA_API_KEY returns 503', { timeout: 120000 }, () => {
  const out = py(`
import json, os, sys
sys.path.insert(0, "python")
os.environ.pop("SEMANTICA_API_KEY", None)
os.environ.pop("SEMANTICA_ALLOW_ANONYMOUS", None)
from bootstrap import build_sidecar_app
from starlette.testclient import TestClient
app = build_sidecar_app()
with TestClient(app) as client:
    got = client.get("/api/decisions")
    print(json.dumps({"status": got.status_code}))
`, { SEMANTICA_API_KEY: '', SEMANTICA_ALLOW_ANONYMOUS: '' })
  const got = JSON.parse(out)
  assert.equal(got.status, 503)
})

test('Explorer Chinese decisions list detail precedents and skos schemes return 200', { timeout: 180000 }, () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
os.environ["SEMANTICA_API_KEY"] = "localprobe"
import graph_store
from bootstrap import build_sidecar_app
from starlette.testclient import TestClient
cwd = tempfile.mkdtemp(prefix="dsos-exp-")
graph_store.put_node(cwd, {
  "id": "decision:zh-1",
  "type": "decision",
  "content": "张三转正",
  "properties": {
    "category": "人事",
    "scenario": "张三是否转正",
    "reasoning": "试用期合格",
    "outcome": "通过",
    "confidence": 0.9,
    "status": "已生效",
  },
  "metadata": {},
})
app = build_sidecar_app()
headers = {"X-API-Key": "localprobe", "X-DSH-CWD": cwd}
with TestClient(app) as client:
    listed = client.get("/api/decisions", headers=headers)
    detail = client.get("/api/decisions/decision:zh-1", headers=headers)
    prec = client.get("/api/decisions/decision:zh-1/precedents", headers=headers)
    skos = client.get("/api/ontology/skos/schemes", headers=headers)
body = listed.json() if listed.headers.get("content-type","").startswith("application/json") else []
ids = []
if isinstance(body, list):
    ids = [str(row.get("decision_id") or row.get("id") or "") for row in body if isinstance(row, dict)]
elif isinstance(body, dict):
    rows = body.get("items") or body.get("decisions") or body.get("results") or []
    ids = [str(row.get("decision_id") or row.get("id") or "") for row in rows if isinstance(row, dict)]
print(json.dumps({
  "list": listed.status_code,
  "detail": detail.status_code,
  "prec": prec.status_code,
  "skos": skos.status_code,
  "ids": ids,
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.list, 200)
  assert.equal(got.detail, 200)
  assert.equal(got.prec, 200)
  assert.equal(got.skos, 200)
  assert.ok(got.ids.includes('decision:zh-1'))
})

test('host tools already expose the native MCP names', () => {
  const src = readFileSync(join(root, 'tools.js'), 'utf8')
  for (const name of [
    'record_decision', 'find_precedents', 'get_causal_chain', 'run_reasoning', 'query_graph',
    'extract_entities', 'extract_relations', 'add_entity', 'add_relationship',
    'get_graph_analytics', 'export_graph', 'get_graph_summary', 'search_text',
    'lineage', 'list_memory_cards', 'query_decisions',
  ]) {
    assert.match(src, new RegExp(`name: '${name}'`))
  }
})
