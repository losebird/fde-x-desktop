import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

function pythonBin() {
  if (process.env.DSH_RUNTIME_PYTHON) return process.env.DSH_RUNTIME_PYTHON
  const bundled = new URL('../runtime-dist/darwin-arm64/python/bin/python3', import.meta.url).pathname
  if (existsSync(bundled)) return bundled
  return 'python3'
}

function py(code) {
  const r = spawnSync(pythonBin(), ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
    timeout: 180000,
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('rebuild uses VectorStore with parallel=False and Chinese model', () => {
  const out = py(`
import inspect, json, sys
sys.path.insert(0, "python")
import stores
src = inspect.getsource(stores._rebuild_from_texts) + inspect.getsource(stores.search_vectors) + inspect.getsource(stores.make_vector_store)
print(json.dumps({
  "vectorstore": "VectorStore" in src,
  "parallel": "parallel=False" in inspect.getsource(stores._rebuild_from_texts),
  "model": stores.VEC_MODEL == "BAAI/bge-small-zh-v1.5",
  "set_text_model": "set_text_model" in inspect.getsource(stores.make_vector_store),
  "tfidf": "TfidfVectorizer" in src,
  "algo": stores.VECTOR_ALGO,
}))
`)
  const got = JSON.parse(out)
  assert.equal(got.vectorstore, true)
  assert.equal(got.parallel, true)
  assert.equal(got.model, true)
  assert.equal(got.set_text_model, true)
  assert.equal(got.tfidf, false)
  assert.equal(got.algo, 'faiss-bge-small-zh-v1.5')
})

test('native VectorStore search matches Chinese node text', { timeout: 180000 }, () => {
  const out = py(`
import json, sys, tempfile
from types import SimpleNamespace
sys.path.insert(0, "python")
from stores import rebuild_vectors, search_vectors, vector_dir, VECTOR_ALGO

cwd = tempfile.mkdtemp(prefix="dsos-vec-")
graph = SimpleNamespace(nodes={
  "n-clean": {"content": "洗净这一站是 semantica normalize，不是脱敏"},
  "n-board": {"content": "型进语义，行走连接器现查，不镜像权限内数据"},
  "n-ticket": {"content": "采购单 PO-12 只是单号引用"},
})
built = rebuild_vectors(cwd, graph)
dest = vector_dir(cwd)
hits = search_vectors(cwd, "不镜像权限内数据", 3)
print(json.dumps({
  "algo": built.get("algo"),
  "count": built.get("count"),
  "has_index": (dest / "index.bin").is_file(),
  "has_store": (dest / "store_data.json").is_file(),
  "no_matrix": not (dest / "matrix.npz").is_file(),
  "top": (hits[0]["id"] if hits else ""),
  "ids": [row["id"] for row in hits],
  "search_empty_query": search_vectors(cwd, "   "),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.algo, 'faiss-bge-small-zh-v1.5')
  assert.equal(got.count, 3)
  assert.equal(got.has_index, true)
  assert.equal(got.has_store, true)
  assert.equal(got.no_matrix, true)
  assert.equal(got.top, 'n-board')
  assert.ok(got.ids.includes('n-board'))
  assert.deepEqual(got.search_empty_query, [])
})

test('six Chinese rewrite queries hit top-1', { timeout: 180000 }, () => {
  const out = py(`
import json, sys, tempfile
from types import SimpleNamespace
sys.path.insert(0, "python")
from stores import rebuild_vectors, search_vectors

cwd = tempfile.mkdtemp(prefix="dsos-vec-zh-")
graph = SimpleNamespace(nodes={
  "n-clean": {"content": "洗净这一站是 semantica normalize，不是脱敏"},
  "n-board": {"content": "型进语义，行走连接器现查，不镜像权限内数据"},
  "n-ticket": {"content": "采购单 PO-12 只是单号引用"},
  "n-zhang": {"content": "张三在杭州的阿里巴巴集团上班"},
  "n-vocab": {"content": "词表在线改，不要整文件上传"},
  "n-darwin": {"content": "要不要只发 darwin-arm64 这一包"},
})
rebuild_vectors(cwd, graph)
qs = [
  ("n-clean", "规范化而不是脱敏"),
  ("n-board", "不把权限内数据镜像出来"),
  ("n-ticket", "PO-12 采购单号"),
  ("n-zhang", "杭州阿里巴巴的张三"),
  ("n-vocab", "在线改词表"),
  ("n-darwin", "只发 darwin-arm64 包"),
]
hits = []
for want, q in qs:
  row = search_vectors(cwd, q, 1)
  hits.append({"want": want, "got": (row[0]["id"] if row else ""), "q": q})
print(json.dumps({"hits": hits, "ok": sum(1 for row in hits if row["want"] == row["got"])}))
`)
  const got = JSON.parse(out)
  assert.equal(got.ok, 6)
})

test('legacy-only vectors directory returns no complement hits', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-legacy-'))
  const dest = join(cwd, '.dsh', 'semantic-os', 'vectors')
  mkdirSync(dest, { recursive: true })
  writeFileSync(join(dest, 'index.faiss'), 'x'.repeat(1024))
  writeFileSync(join(dest, 'ids.json'), JSON.stringify({ ids: ['n1'] }))
  writeFileSync(join(dest, 'tfidf.pkl'), 'not-a-pickle')
  writeFileSync(join(dest, 'meta.json'), JSON.stringify({ fp: 'old', count: 1 }))
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from stores import search_vectors
print(json.dumps(search_vectors(${JSON.stringify(cwd)}, "洗净")))
`)
  assert.equal(existsSync(join(dest, 'index.faiss')), true)
  assert.deepEqual(JSON.parse(out), [])
})

test('schedule merges later writes and save_session survives rebuild failure', { timeout: 180000 }, () => {
  const out = py(`
import json, sys, tempfile, time
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, "python")
import stores
from stores import schedule_rebuild_vectors, wait_vector_rebuild, vector_index_status, search_vectors

cwd = tempfile.mkdtemp(prefix="dsos-async-")
first = SimpleNamespace(nodes={"n1": {"content": "型进语义，行走连接器现查"}})
second = SimpleNamespace(nodes={
  "n1": {"content": "型进语义，行走连接器现查"},
  "n2": {"content": "不镜像权限内数据"},
})
orig_rebuild = stores._rebuild_from_texts
def slow_rebuild(cwd, ids, texts):
  time.sleep(0.15)
  return orig_rebuild(cwd, ids, texts)
stores._rebuild_from_texts = slow_rebuild
one = schedule_rebuild_vectors(cwd, first)
two = schedule_rebuild_vectors(cwd, second)
waited = wait_vector_rebuild(cwd, 60)
stores._rebuild_from_texts = orig_rebuild
status = vector_index_status(cwd)
hits = search_vectors(cwd, "不镜像权限内数据", 3)

class Broken(Exception):
  pass

def boom(*args, **kwargs):
  raise Broken("rebuild exploded")

orig = stores._rebuild_from_texts
stores._rebuild_from_texts = boom
from bootstrap import save_session
session = SimpleNamespace(graph=SimpleNamespace(
  save_to_file=lambda path: Path(path).write_text("{}", encoding="utf-8"),
  nodes={"ok": {"content": "graph still writes"}},
))
graph_dir = Path(cwd) / ".dsh" / "semantic-os"
graph_dir.mkdir(parents=True, exist_ok=True)
graph_path = graph_dir / "graph.json"
save_session(session, graph_path)
stores._rebuild_from_texts = orig
from stores import read_node_rows
rows, _st = read_node_rows(cwd)
print(json.dumps({
  "first_queued": one.get("queued"),
  "second_merged": two.get("merged") or two.get("queued"),
  "waited": waited,
  "state": status.get("state"),
  "count": status.get("count"),
  "legacy": status.get("legacy_faiss"),
  "top": (hits[0]["id"] if hits else ""),
  "graph_written": any(str(row.get("id") or "") == "ok" for row in rows),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.first_queued, true)
  assert.equal(got.second_merged, true)
  assert.equal(got.waited, true)
  assert.equal(got.state, 'ready')
  assert.equal(got.count, 2)
  assert.equal(got.legacy, false)
  assert.equal(got.top, 'n2')
  assert.equal(got.graph_written, true)
})

test('vector_index_status reports ignored legacy FAISS', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-status-'))
  const dest = join(cwd, '.dsh', 'semantic-os', 'vectors')
  mkdirSync(dest, { recursive: true })
  writeFileSync(join(dest, 'index.faiss'), 'x'.repeat(1024))
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from stores import vector_index_status
print(json.dumps(vector_index_status(${JSON.stringify(cwd)})))
`)
  const got = JSON.parse(out)
  assert.equal(got.state, 'ignored_faiss')
  assert.equal(got.legacy_faiss, true)
  assert.match(String(got.detail || ''), /FAISS|忽略/)
})

test('search_text always asks the complement and keeps original scores', () => {
  const out = py(`
import inspect, json, sys
sys.path.insert(0, "python")
import bootstrap
src = inspect.getsource(bootstrap.run_search_text)
print(json.dumps({
  "calls_search_vectors": "search_vectors(cwd, q)" in src,
  "no_early_skip": "if len(hits)" not in src and "skip vector" not in src.lower(),
  "score_id": "200 if q == nid" in src,
  "score_prefix": "160 if raw_content.startswith(q)" in src,
  "score_sub": "else 120" in src,
  "graph_session": "GraphSession" in src,
}))
`)
  const got = JSON.parse(out)
  assert.equal(got.calls_search_vectors, true)
  assert.equal(got.no_early_skip, true)
  assert.equal(got.score_id, true)
  assert.equal(got.score_prefix, true)
  assert.equal(got.score_sub, true)
  assert.equal(got.graph_session, true)
})
