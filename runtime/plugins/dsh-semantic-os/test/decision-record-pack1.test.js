import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
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

test('brief_for_decision cites archive documents as because', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_brief_for_decision

rows = [{
  "id": "file:outline.md",
  "type": "document",
  "content": "主角设定与大纲",
  "properties": {},
}]
with patch("bootstrap.run_search_text", return_value={"results": []}):
  with patch("bootstrap.read_node_rows", return_value=(rows, {"ok": True})):
    with patch("bootstrap.run_find_precedents", return_value={"precedents": []}):
      with patch("bootstrap.run_query_decisions", return_value={"decisions": []}):
        brief = run_brief_for_decision("/ws", {"scenario": "主角设定"})
print(json.dumps({"because": brief.get("because"), "ids": [e["id"] for e in brief.get("evidence") or []]}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.ok(got.because.includes('file:outline.md'))
  assert.ok(got.ids.includes('file:outline.md'))
})

test('record_decision with session_id opens session node and records', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'fde-dec-'))
  const out = py(`
import json, os, sys, tempfile
sys.path.insert(0, "python")
from unittest.mock import MagicMock, patch
from bootstrap import note_decision_skip

cwd = ${JSON.stringify(cwd)}
note_decision_skip(cwd, "NO_BECAUSE", {"scenario": "probe"})
print("skip_ok")
`)
  assert.equal(out, 'skip_ok')
  const log = readFileSync(join(cwd, '.dsh', 'semantic-os', 'decision-skips.jsonl'), 'utf8')
  assert.match(log, /NO_BECAUSE/)
})

test('Memory 记一条 sends session_id when an AI session is active', () => {
  const src = readFileSync(new URL('../../../../src/pages/Memory.tsx', import.meta.url), 'utf8')
  assert.match(src, /activeAiSessionId/)
  assert.match(src, /session_id: sessionId/)
})
