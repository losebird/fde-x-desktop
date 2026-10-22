import assert from 'node:assert/strict'
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

test('台账导出 is decisions only, not the whole graph', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from ledger import export_ledger
rows = [
  {"id": "dec-1", "type": "decision", "properties": {"status": "已生效", "outcome": "过了", "scenario": "PO-12"}},
  {"id": "session:s1:1", "type": "Document", "content": "请过 PO-12，电话 13800138000"},
  {"id": "file:/ws/合同.pdf", "type": "Document", "content": "合同正文"},
]
print(json.dumps(export_ledger(rows), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.ok, true)
  assert.equal(got.kind, '台账')
  assert.equal(got.decisions.length, 1)
  assert.equal(got.decisions[0].id, 'dec-1')
  assert.equal(got.total, 1)
})

test('backup dest must stay in this workspace', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from ledger import may_backup
print(json.dumps({
  "in": may_backup({"dest": "/ws/.dsh/semantic-os/graph-2026.json"}, "/ws"),
  "out": may_backup({"dest": "/tmp/graph.json"}, "/ws"),
  "empty": may_backup({}, "/ws"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.in.ok, true)
  assert.equal(got.out.error, 'OUTSIDE_CWD')
  assert.equal(got.empty.error, 'NO_DEST')
})

test('relative backup dest stays inside cwd', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from ledger import may_backup
print(json.dumps({
  "rel": may_backup({"dest": "graph-bak.json"}, "/ws"),
  "nested": may_backup({"dest": ".dsh/semantic-os/bak.json"}, "/ws"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.rel.ok, true)
  assert.match(String(got.rel.dest), /graph-bak\.json$/)
  assert.equal(got.nested.ok, true)
})

test('擦除 is not 冲正 and needs a nod', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from ledger import may_erase
print(json.dumps({
  "no": may_erase({"kind": "pii"}),
  "yes": may_erase({"kind": "pii", "confirm": True}),
  "void": may_erase({"kind": "冲正", "confirm": True}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.no.error, 'NOT_NODDED')
  assert.equal(got.yes.ok, true)
  assert.equal(got.yes.kind, 'pii')
  assert.equal(got.void.error, 'NOT_ERASE')
})
