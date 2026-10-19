import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

function py(code) {
  const r = spawnSync('python3', ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('memory hits map into search_text rows as live 已入档', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from agent_mem import memory_hits_as_search
rows = [
  {"memory_id": "memory:a", "content": "只发 darwin-arm64", "score": 0.8},
  {"memory_id": "memory:b", "content": "只发 darwin-arm64", "score": 0.2},
  {"memory_id": "x", "content": "另一条", "score": 0.1},
]
hits = memory_hits_as_search(rows, "darwin")
print(json.dumps({"n": len(hits), "ids": [h["node"]["id"] for h in hits], "via": hits[0]["via"], "status": hits[0]["node"]["properties"]["status"]}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.n, 3)
  assert.ok(got.ids.includes('memory:a'))
  assert.ok(got.ids.includes('memory:x'))
  assert.equal(got.via, 'agent-memory')
  assert.equal(got.status, '已入档')
})

test('store uses official vectors when AgentMemory has a vector_store', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-amem-'))
  try {
    const out = py(`
import json, sys
sys.path.insert(0, "python")
import agent_mem

class FakeMem:
    def __init__(self):
        self.vector_store = object()
        self.opts = None
        self.memory_items = {}
    def load(self, path):
        return None
    def store(self, content, metadata=None, **opts):
        self.opts = opts
        return "memory:vec"
    def save(self, path):
        return None

holder = {'mem': FakeMem()}
agent_mem._new_memory = lambda: holder['mem']
agent_mem._CACHE.clear()
agent_mem.store_agent_memory(${JSON.stringify(cwd)}, "只发 darwin-arm64", memory_id="memory:vec")
print(json.dumps({"skip_vector": holder['mem'].opts.get("skip_vector"), "skip_graph": holder['mem'].opts.get("skip_graph")}))
`)
    const got = JSON.parse(out)
    assert.equal(got.skip_vector, false)
    assert.equal(got.skip_graph, false)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('store_agent_memory uses Semantica AgentMemory when present', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-amem-'))
  try {
    const out = py(`
import json, sys
sys.path.insert(0, "python")
from types import SimpleNamespace
import agent_mem

class FakeItem:
    def __init__(self, content, metadata, memory_id):
        self.content = content
        self.metadata = metadata
        self.memory_id = memory_id
        self.entities = []
        self.relationships = []
        from datetime import datetime, timezone
        self.timestamp = datetime.now(timezone.utc)
    def to_dict(self):
        return {"content": self.content, "timestamp": self.timestamp.isoformat(), "metadata": self.metadata, "entities": [], "relationships": [], "memory_id": self.memory_id}

class FakeMem:
    def __init__(self):
        self.memory_items = {}
        self.saved = None
    def load(self, path):
        return None
    def store(self, content, metadata=None, entities=None, **opts):
        mid = opts.get("memory_id") or "memory:fake"
        self.memory_items[mid] = FakeItem(content, metadata or {}, mid)
        return mid
    def retrieve(self, query, max_results=8, **filters):
        return [{"memory_id": k, "content": v.content, "score": 1.0} for k, v in self.memory_items.items() if query in v.content]
    def save(self, path):
        self.saved = path

holder = {'mem': FakeMem()}
agent_mem._new_memory = lambda: holder['mem']
agent_mem._CACHE.clear()
cwd = ${JSON.stringify(cwd)}
stored = agent_mem.store_agent_memory(cwd, "只发 darwin-arm64", memory_id="memory:live")
hits = agent_mem.retrieve_agent_memory(cwd, "darwin")
print(json.dumps({"stored": stored, "n": len(hits), "id": hits[0]["memory_id"] if hits else ""}, ensure_ascii=False))
`)
    const got = JSON.parse(out)
    assert.equal(got.stored.ok, true)
    assert.equal(got.n, 1)
    assert.equal(got.id, 'memory:live')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('retrieve skips expired AgentMemory items and forget drops them', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-amem-'))
  try {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
import agent_mem

class Item:
    def __init__(self, content, metadata, memory_id):
        self.content = content
        self.metadata = metadata
        self.memory_id = memory_id

class FakeMem:
    def __init__(self):
        self.memory_items = {
            "memory:live": Item("还算数", {}, "memory:live"),
            "memory:dead": Item("已过期", {"valid_until": "2020-01-01T00:00:00+00:00"}, "memory:dead"),
        }
    def load(self, path):
        return None
    def retrieve(self, query, max_results=8, **filters):
        return [{"memory_id": k, "content": v.content, "score": 1.0, "metadata": v.metadata} for k, v in self.memory_items.items()]
    def forget(self, mid):
        self.memory_items.pop(mid, None)
        return True
    def save(self, path):
        return None

holder = {'mem': FakeMem()}
agent_mem._new_memory = lambda: holder['mem']
agent_mem._CACHE.clear()
cwd = ${JSON.stringify(cwd)}
hits = agent_mem.retrieve_agent_memory(cwd, "算")
dropped = agent_mem.forget_agent_memory(cwd, "memory:live")
after = agent_mem.retrieve_agent_memory(cwd, "算")
print(json.dumps({"ids": [h["memory_id"] for h in hits], "forgot": dropped.get("ok"), "after": [h["memory_id"] for h in after]}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.ids, ['memory:live'])
  assert.equal(got.forgot, true)
  assert.deepEqual(got.after, [])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('已生效 still needs a receipt after AgentMemory hook', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from board import resolve_board
print(json.dumps(resolve_board({
  "status": "已生效",
  "nod_kind": "业务过账",
  "because": ["n1"],
  "leads_to": ["n2"],
}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.error, 'NO_RECEIPT')
})
