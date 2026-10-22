import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

function pythonBin() {
  const bundled = new URL('../runtime-dist/darwin-arm64/python/bin/python3', import.meta.url).pathname
  if (existsSync(bundled)) return bundled
  return 'python3'
}

function py(code, extraEnv = {}) {
  const r = spawnSync(pythonBin(), ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python', ...extraEnv },
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('FAISS passage index finds a log chunk by nearby wording', () => {
  const out = py(`
import json, sys, tempfile
sys.path.insert(0, "python")
from passages import faiss_status, index_passages, search_passages, passage_dir
st = faiss_status()
if not st.get("ok"):
    print(json.dumps({"skip": True, "detail": st.get("detail")}))
    raise SystemExit
cwd = tempfile.mkdtemp(prefix="dsos-pass-")
built = index_passages(cwd, [
    {"id": "session:s1:3", "text": "要不要只发 darwin-arm64 这一包"},
    {"id": "session:s1:9", "text": "词表在线改，不要整文件上传"},
])
hits = search_passages(cwd, "darwin 包怎么发", 3)
print(json.dumps({
    "skip": False,
    "count": built.get("count"),
    "has_index": (passage_dir(cwd) / "index.faiss").is_file(),
    "top": (hits[0]["id"] if hits else ""),
    "ids": [row["id"] for row in hits],
    "empty": search_passages(cwd, "   "),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  if (got.skip) return
  assert.equal(got.count, 2)
  assert.equal(got.has_index, true)
  assert.equal(got.top, 'session:s1:3')
  assert.deepEqual(got.empty, [])
})

test('passage index drops oldest rows when over cap', () => {
  const out = py(`
import json, os, sys, tempfile
os.environ["DSH_SEMANTIC_OS_PASSAGE_MAX"] = "2"
sys.path.insert(0, "python")
from passages import faiss_status, index_passages, search_passages
st = faiss_status()
if not st.get("ok"):
    print(json.dumps({"skip": True}))
    raise SystemExit
cwd = tempfile.mkdtemp(prefix="dsos-pass-cap-")
built = index_passages(cwd, [
    {"id": "session:s1:1", "text": "第一条很旧的话"},
    {"id": "session:s1:2", "text": "第二条还在"},
    {"id": "session:s1:3", "text": "第三条最新"},
])
hits = search_passages(cwd, "第一条很旧的话", 8)
print(json.dumps({
    "skip": False,
    "count": built.get("count"),
    "cap": built.get("cap"),
    "old": [row["id"] for row in hits],
}))
`, { DSH_SEMANTIC_OS_PASSAGE_MAX: '2' })
  const got = JSON.parse(out)
  if (got.skip) return
  assert.equal(got.count, 2)
  assert.equal(got.cap, 2)
  assert.equal(got.old.includes('session:s1:1'), false)
})
