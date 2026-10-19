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

test('slim workbench save must not delete session diaries', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from stores import is_archive_node
print(json.dumps({
  "session": is_archive_node("session:abc:1", "Document"),
  "file": is_archive_node("file:/ws/a.pdf", ""),
  "mail": is_archive_node("mail:req.send", "Document"),
  "kind": is_archive_node("https://dsh.local/vocab/ws/x#purchase-order", "skos:Concept"),
  "decision": is_archive_node("dec-1", "decision"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.session, true)
  assert.equal(got.file, true)
  assert.equal(got.mail, true)
  assert.equal(got.kind, false)
  assert.equal(got.decision, false)
})
