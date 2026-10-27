import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

function pythonBin() {
  const bundled = new URL('../runtime-dist/darwin-arm64/python/bin/python3', import.meta.url).pathname
  if (existsSync(bundled)) return bundled
  return 'python3'
}

function py(code) {
  const r = spawnSync(pythonBin(), ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('rebuild writes sparse matrix and never densifies into FAISS', () => {
  const out = py(`
import inspect, json, sys, tempfile
from pathlib import Path
sys.path.insert(0, "python")
from stores import VECTOR_ALGO, rebuild_vectors, search_vectors, vector_dir
import stores

src = inspect.getsource(stores._write_sparse_index) + inspect.getsource(stores.rebuild_vectors) + inspect.getsource(stores.search_vectors)
print(json.dumps({
  "toarray": ".toarray()" in inspect.getsource(stores._write_sparse_index),
  "flat": "IndexFlatIP" in src,
  "faiss_write": "faiss.write_index" in src,
  "faiss_read": "faiss.read_index" in src,
  "min_df": "min_df=1" in inspect.getsource(stores._write_sparse_index),
  "max_features": "max_features" in inspect.getsource(stores._write_sparse_index),
}))
`)
  const got = JSON.parse(out)
  assert.equal(got.toarray, false)
  assert.equal(got.flat, false)
  assert.equal(got.faiss_write, false)
  assert.equal(got.faiss_read, false)
  assert.equal(got.min_df, true)
  assert.equal(got.max_features, false)
})

test('legacy index.faiss is ignored and sparse search matches CSR cosine', () => {
  const out = py(`
import json, sys, tempfile
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, "python")
from stores import rebuild_vectors, search_vectors, vector_dir

cwd = tempfile.mkdtemp(prefix="dsos-vec-")
graph = SimpleNamespace(nodes={
  "n-clean": {"content": "洗净这一站是 semantica normalize，不是脱敏"},
  "n-board": {"content": "型进语义，行走连接器现查，不镜像权限内数据"},
  "n-ticket": {"content": "采购单 PO-12 只是单号引用"},
})
built = rebuild_vectors(cwd, graph)
dest = vector_dir(cwd)
no_faiss = not (dest / "index.faiss").is_file()
(dest / "index.faiss").write_bytes(b"not-a-real-faiss-index" * 100)
hits = search_vectors(cwd, "不镜像权限内数据", 3)
print(json.dumps({
  "algo": built.get("algo"),
  "count": built.get("count"),
  "has_matrix": (dest / "matrix.npz").is_file(),
  "no_faiss_after_rebuild": no_faiss,
  "top": (hits[0]["id"] if hits else ""),
  "ids": [row["id"] for row in hits],
  "search_empty_query": search_vectors(cwd, "   "),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.algo, 'tfidf-charwb-24-sparse-v1')
  assert.equal(got.count, 3)
  assert.equal(got.has_matrix, true)
  assert.equal(got.no_faiss_after_rebuild, true)
  assert.equal(got.top, 'n-board')
  assert.ok(got.ids.includes('n-board'))
  assert.deepEqual(got.search_empty_query, [])
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

test('schedule merges later writes and save_session survives rebuild failure', () => {
  const out = py(`
import json, sys, tempfile, time
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, "python")
import stores
from stores import schedule_rebuild_vectors, wait_vector_rebuild, vector_index_status, vector_dir, search_vectors

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
waited = wait_vector_rebuild(cwd, 20)
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
}))
`)
  const got = JSON.parse(out)
  assert.equal(got.calls_search_vectors, true)
  assert.equal(got.no_early_skip, true)
  assert.equal(got.score_id, true)
  assert.equal(got.score_prefix, true)
  assert.equal(got.score_sub, true)
})
