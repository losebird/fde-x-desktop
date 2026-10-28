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

test('same attachment page is one 看见', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from sight import resolve_sight
first = resolve_sight({
  "attachment_id": "att-1",
  "page": 2,
  "nodded": True,
  "text": "发票抬头某某公司",
})
again = resolve_sight({
  "attachment_id": "att-1",
  "page": 2,
  "nodded": True,
  "text": "又看了一遍",
}, existing=[{"id": first["id"]}])
print(json.dumps({"first": first, "again": again}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.first.error, undefined)
  assert.equal(got.first.status, '看见')
  assert.equal(got.first.source, 'eyes')
  assert.match(got.first.id, /att-1/)
  assert.equal(got.again.error, 'ALREADY_SEEN')
  assert.equal(got.again.id, got.first.id)
})

test('a failed look is 未看见, not a skip', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from sight import resolve_sight
print(json.dumps(resolve_sight({
  "attachment_id": "att-2",
  "page": 1,
  "nodded": True,
  "text": "",
}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.error, undefined)
  assert.equal(got.status, '未看见')
  assert.equal(got.source, 'eyes')
  assert.match(got.id, /att-2/)
})

test('an un-nodded attachment is not a 看见', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from sight import resolve_sight
print(json.dumps(resolve_sight({
  "attachment_id": "att-3",
  "page": 1,
  "text": "合同全文不该自己爬进来",
}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.error, 'NOT_NODDED')
})

test('directory ingest without a nod or chosen path does not read file bodies', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from sight import may_read_file_body
print(json.dumps({
  "auto": may_read_file_body({}),
  "paths": may_read_file_body({"paths": ["/ws/合同.pdf"]}),
  "nodded": may_read_file_body({"nodded": True}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.auto, false)
  assert.equal(got.paths, true)
  assert.equal(got.nodded, true)
})

test('chosen ledger projection is ingested even if .dsh is gitignored', () => {
  const out = py(`
import json, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, "python")
from bootstrap import list_ingest_files
root = Path(tempfile.mkdtemp())
(root / ".gitignore").write_text(".dsh/\\n", encoding="utf-8")
ledger = root / ".dsh" / "lan-assist"
ledger.mkdir(parents=True)
target = ledger / "mail.projection.md"
target.write_text("- 出自 req_1:v1\\n", encoding="utf-8")
(root / "notes.md").write_text("keep\\n", encoding="utf-8")
chosen = list_ingest_files(str(root), [str(target)])
walk = list_ingest_files(str(root), None)
print(json.dumps({
  "chosen": [str(p) for p in chosen],
  "walk_has_ledger": any(p.name == "mail.projection.md" for p in walk),
  "walk_has_notes": any(p.name == "notes.md" for p in walk),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.chosen.some((p) => p.endsWith('mail.projection.md')), true)
  assert.equal(got.walk_has_ledger, false)
  assert.equal(got.walk_has_notes, true)
})
