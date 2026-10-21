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

test('same ticket in 测试 and 生产 are different 业务引用', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from reference import resolve_reference
prod = resolve_reference({"system": "采购", "environment": "生产", "kind": "采购单", "ticket": "PO-12"})
lab = resolve_reference({"system": "采购", "environment": "测试", "kind": "采购单", "ticket": "PO-12"})
print(json.dumps({"prod": prod, "lab": lab}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.prod.error, undefined)
  assert.equal(got.lab.error, undefined)
  assert.notEqual(got.prod.id, got.lab.id)
  assert.match(got.prod.id, /PO-12/)
  assert.match(got.lab.id, /PO-12/)
})

test('业务引用 without 系统 or 环境 is incomplete', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from reference import resolve_reference
print(json.dumps(resolve_reference({"kind": "采购单", "ticket": "PO-12"}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.error, 'INCOMPLETE_REFERENCE')
})

test('采购明细 reference uses 父单号 and 行号', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from reference import resolve_reference
print(json.dumps(resolve_reference({
  "system": "采购", "environment": "生产", "kind": "采购明细",
  "ticket": "PO-12", "行号": "3",
}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.error, undefined)
  assert.equal(got.ticket, 'PO-12:3')
  assert.match(got.id, /采购明细:PO-12:3/)
})

test('离开 drops 持有 and voids the 业务引用', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from reference import hold_reference, leave_person
held = hold_reference({"person": "林督", "reference_id": "ref:采购:生产:采购单:PO-12"})
left = leave_person({"person": "林督"}, holdings=[held])
print(json.dumps({"held": held, "left": left}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.held.edge, 'holds')
  assert.equal(got.held.source, '林督')
  assert.equal(got.held.target, 'ref:采购:生产:采购单:PO-12')
  assert.equal(got.left.dropped, 1)
  assert.deepEqual(got.left.voided, ['ref:采购:生产:采购单:PO-12'])
  assert.equal(got.left.deleted, false)
})

test('drop_edge removes holds when graph.edges is a list', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import drop_edge

class G:
    def __init__(self):
        self.edges = [
            {"id": "e1", "source": "林督", "target": "ref:采购:生产:采购单:PO-12", "type": "holds"},
            {"id": "e2", "source": "Ace", "target": "ref:采购:生产:采购单:PO-99", "type": "holds"},
        ]

g = G()
n = drop_edge(g, "林督", "ref:采购:生产:采购单:PO-12", "holds")
print(json.dumps({"dropped": n, "left": [e["id"] for e in g.edges]}))
`)
  const got = JSON.parse(out)
  assert.equal(got.dropped, 1)
  assert.deepEqual(got.left, ['e2'])
})
