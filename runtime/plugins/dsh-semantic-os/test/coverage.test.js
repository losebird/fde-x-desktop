import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const py = join(root, 'python')

test('product exposes coverage and roster sync', () => {
  const src = readFileSync(join(root, 'product.js'), 'utf8')
  assert.match(src, /api\/coverage/)
  assert.match(src, /op: 'workspace_coverage'/)
  assert.match(src, /op: 'sync_roster'/)
  const host = readFileSync(join(root, 'index.js'), 'utf8')
  assert.match(host, /onRoster/)
})

test('coverage buckets follow graph ids and types', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-cover-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'session:s1:1', type: 'Document', content: 'hi' },
        { id: 'alice', type: 'Person', content: 'Alice' },
        { id: 'https://ex/ont#C', type: 'owl:Class', content: 'C' },
        { id: 'ref:PO-1', type: '业务引用', content: 'PO-1' },
      ],
      edges: [],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_workspace_coverage, run_sync_roster',
      `cwd = ${JSON.stringify(cwd)}`,
      'cover = run_workspace_coverage(cwd, {})',
      'sync = run_sync_roster(cwd, {"people": [{"id": "bob", "displayName": "Bob", "status": "active"}]})',
      'by = {row["id"]: row["n"] for row in cover.get("buckets") or []}',
      'print(json.dumps({"by": by, "written": sync.get("written"), "ok": sync.get("ok")}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.ok(got.by.chat >= 1)
    assert.ok(got.by.people >= 1)
    assert.ok(got.by.ontology >= 1)
    assert.ok(got.by.ticket >= 1)
    assert.equal(got.ok, true)
    assert.ok(got.written === 0 || got.written === 1)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
