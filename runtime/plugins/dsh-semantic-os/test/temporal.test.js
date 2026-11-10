import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const pyBin = process.env.DSH_RUNTIME_PYTHON || 'python3'
const pyDir = join(import.meta.dirname, '../python')

function py(code) {
  const proc = spawnSync(pyBin, ['-c', code], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: pyDir },
  })
  if (proc.status !== 0) {
    throw new Error(proc.stderr || proc.stdout || `python ${proc.status}`)
  }
  return (proc.stdout || '').trim()
}

test('Allen before / overlaps / during via Semantica engine', () => {
  const out = py(`
import json, sys
sys.path.insert(0, ${JSON.stringify(pyDir)})
from temporal import allen_relation
print(json.dumps({
  "before": allen_relation("2020-01-01/2020-02-01", "2020-03-01/2020-04-01")["relation"],
  "overlaps": allen_relation("2020-01-01/2020-03-01", "2020-02-01/2020-04-01")["relation"],
  "during": allen_relation("2020-02-01/2020-03-01", "2020-01-01/2020-04-01")["relation"],
}))
`)
  const got = JSON.parse(out)
  assert.equal(got.before, 'before')
  assert.equal(got.overlaps, 'overlaps')
  assert.equal(got.during, 'during')
})

test('time travel snapshot uses valid interval; bitemporal recorded_as_of hides later writes', () => {
  const out = py(`
import json, sys
sys.path.insert(0, ${JSON.stringify(pyDir)})
from temporal import snapshot_rows, stamp_bitemporal
early = stamp_bitemporal({
  "id": "job-a",
  "type": "Role",
  "valid_from": "2020-01-01",
  "valid_until": "2022-01-01",
  "recorded_at": "2020-01-01T00:00:00Z",
  "superseded_at": "OPEN",
}, keep_recorded=True)
late = stamp_bitemporal({
  "id": "job-b",
  "type": "Role",
  "valid_from": "2022-01-01",
  "valid_until": None,
  "recorded_at": "2024-06-01T00:00:00Z",
  "superseded_at": "OPEN",
}, keep_recorded=True)
rows = [early, late]
now = snapshot_rows(rows, "2021-06-01")
then = snapshot_rows(rows, "2021-06-01", "2019-01-01")
after = snapshot_rows(rows, "2023-01-01")
print(json.dumps({
  "now": now["active_node_ids"],
  "then": then["active_node_ids"],
  "after": after["active_node_ids"],
  "recorded_a": early.get("recorded_at"),
}))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.now, ['job-a'])
  assert.deepEqual(got.then, [])
  assert.ok(got.after.includes('job-b'))
  assert.ok(got.recorded_a)
})

test('put_node archives superseded version instead of overwriting history', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-ver-'))
  const home = mkdtempSync(join(tmpdir(), 'dsos-home-'))
  try {
    const out = py(`
import json, os, sys
sys.path.insert(0, ${JSON.stringify(pyDir)})
os.environ["DSH_HOME"] = ${JSON.stringify(home)}
import graph_store
from temporal import snapshot_rows
cwd = ${JSON.stringify(cwd)}
graph_store.put_node(cwd, {"id": "job", "type": "Role", "content": "经理", "valid_from": "2020-01-01", "valid_until": "2022-01-01", "recorded_at": "2020-01-01T00:00:00Z"})
graph_store.put_node(cwd, {"id": "job", "type": "Role", "content": "总监", "valid_from": "2022-01-01", "valid_until": None})
live, _ = graph_store.read_all(cwd)
vers, _ = graph_store.read_all_versions(cwd)
rows = [graph_store.row_of(n) for n in vers.values()]
past = snapshot_rows(rows, "2021-06-01", "2021-06-01")
now = snapshot_rows(rows, "2023-01-01")
print(json.dumps({
  "live": live.get("job", {}).get("content"),
  "live_n": len(live),
  "ver_n": len(vers),
  "ver_ids": list(vers),
  "past": past["active_node_ids"],
  "now": now["active_node_ids"],
}))
`)
    const got = JSON.parse(out)
    assert.equal(got.live, '总监')
    assert.ok(got.ver_n >= 2, JSON.stringify(got.ver_ids))
    assert.deepEqual(got.past, ['job'])
    assert.deepEqual(got.now, ['job'])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
    rmSync(home, { recursive: true, force: true })
  }
})

test('put_node stamps recorded_at and keeps it on rewrite', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-temp-'))
  const home = mkdtempSync(join(tmpdir(), 'dsos-home-'))
  try {
    const out = py(`
import json, os, sys
sys.path.insert(0, ${JSON.stringify(pyDir)})
os.environ["DSH_HOME"] = ${JSON.stringify(home)}
import graph_store
cwd = ${JSON.stringify(cwd)}
graph_store.put_node(cwd, {"id": "n1", "type": "Person", "content": "张三", "valid_from": "2021-03-01"})
first = graph_store.read_one(cwd, "n1") or {}
rec1 = first.get("recorded_at") or (first.get("properties") or {}).get("recorded_at")
graph_store.put_node(cwd, {"id": "n1", "type": "Person", "content": "张三", "valid_from": "2021-03-01"})
second = graph_store.read_one(cwd, "n1") or {}
rec2 = second.get("recorded_at") or (second.get("properties") or {}).get("recorded_at")
print(json.dumps({"rec1": rec1, "rec2": rec2, "content": second.get("content"), "from": second.get("valid_from") or (second.get("properties") or {}).get("valid_from")}))
`)
    const got = JSON.parse(out)
    assert.ok(got.rec1)
    assert.equal(got.rec1, got.rec2)
    assert.equal(got.content, '张三')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
    rmSync(home, { recursive: true, force: true })
  }
})
