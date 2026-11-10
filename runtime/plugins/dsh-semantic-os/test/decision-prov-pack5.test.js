import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const python = process.env.DSH_RUNTIME_PYTHON || process.env.DSH_SEMANTICA_PYTHON || 'python3'

function py(code) {
  const r = spawnSync(python, ['-c', code], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: join(root, 'python') },
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('empty graph lineage/prov returns empty hops, not errors', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'fde-di-prov-empty-'))
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from bootstrap import run_lineage, run_decision_prov, is_fast_read_op
cwd = ${JSON.stringify(cwd)}
lin = run_lineage(cwd, {"id": "decision:missing", "format": "turtle"})
prov = run_decision_prov(cwd, {"decision_id": "decision:missing"})
print(json.dumps({
  "lin_ok": lin.get("ok"),
  "lin_hops": lin.get("hops"),
  "lin_used": lin.get("used"),
  "lin_prov": lin.get("prov") or "",
  "prov_used": prov.get("used"),
  "prov_gen": prov.get("generated"),
  "turtle": prov.get("prov") or "",
  "fast": is_fast_read_op("export_decision_prov"),
  "fast_lin": is_fast_read_op("lineage"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.lin_ok, true)
  assert.equal(got.lin_hops[0].id, 'decision:missing')
  assert.deepEqual(got.lin_used, [])
  assert.match(got.lin_prov, /prov:/)
  assert.deepEqual(got.prov_used, [])
  assert.deepEqual(got.prov_gen, [])
  assert.match(got.turtle, /prov:Entity/)
  assert.equal(got.fast, true)
  assert.equal(got.fast_lin, true)
})

test('已生效 board PROV includes 依据 and CAUSED', () => {
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from semantica.context.context_graph import ContextGraph
from stores import write_primary
from bootstrap import run_decision_prov, run_lineage, attach_decision_causal_edges
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = tempfile.mkdtemp()
g = ContextGraph()
g.add_node("cite:note", "document", content="依据正文")
first = g.record_decision("rel", "只发 darwin-arm64", "先例", "只发", 0.9, metadata={"status": "已生效", "decision_maker": "user"})
second = g.record_decision("rel", "沿用只发", "跟着先例", "仍只发", 0.9, metadata={"status": "已生效"})
attach_decision_causal_edges(g, first, {"because": ["cite:note"], "leads_to": []})
g.add_causal_relationship(first, second, "CAUSED")
write_primary(g, cwd)
got = run_decision_prov(cwd, {"decision_id": first})
lin = run_lineage(cwd, {"id": first, "format": "turtle"})
print(json.dumps({
  "first": first, "second": second,
  "used": got.get("used"),
  "generated": got.get("generated"),
  "prov": got.get("prov") or "",
  "hop_types": [h.get("type") for h in lin.get("hops") or []],
  "lin_prov": lin.get("prov") or "",
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.used.includes('cite:note'), JSON.stringify(got.used))
  assert.ok(got.generated.includes(got.second), JSON.stringify(got.generated))
  assert.match(got.prov, /prov:wasDerivedFrom/)
  assert.match(got.prov, /prov:wasGeneratedBy/)
  assert.match(got.prov, /cite%3Anote/)
  assert.match(got.lin_prov, /prov:wasDerivedFrom/)
  assert.ok(got.hop_types.includes('supports') || got.hop_types.includes('CAUSED') || got.hop_types.includes('self'))
})

test('REST and tools sit on lineage/export, not a new page', () => {
  const tools = readFileSync(join(root, 'tools.js'), 'utf8')
  const product = readFileSync(join(root, 'product.js'), 'utf8')
  const skill = readFileSync(join(root, 'skills/project-memory/SKILL.md'), 'utf8')
  assert.match(tools, /format=turtle/)
  assert.match(tools, /W3C PROV-O/)
  assert.match(product, /pathname.endsWith\('\/prov'\)/)
  assert.match(product, /op: 'export_decision_prov'/)
  assert.match(skill, /W3C PROV-O/)
  assert.equal(product.includes('src/pages/'), false)
})
