import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const py = join(root, 'python')

test('product owns ontology alignments and health', () => {
  const src = readFileSync(join(root, 'product.js'), 'utf8')
  assert.match(src, /api\/ontology\/alignments/)
  assert.match(src, /op: 'save_alignment'/)
  assert.match(src, /serveOntologyHealth/)
  assert.match(src, /ontology\/proposals/)
})

test('alignments save, list, delete, and suggest by label', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-align-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'https://a/x#one', type: 'skos:Concept', content: '发货单', properties: { label: '发货单', scheme_uri: 'https://a/x' } },
        { id: 'https://b/y#two', type: 'skos:Concept', content: '发货单副本', properties: { label: '发货单副本', scheme_uri: 'https://b/y' } },
      ],
      edges: [],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_save_alignment, run_list_alignments, run_delete_alignment, run_suggest_alignments',
      `cwd = ${JSON.stringify(cwd)}`,
      'saved = run_save_alignment(cwd, {"source_uri": "https://a/x#one", "target_uri": "https://b/y#two", "relation": "skos:closeMatch", "source_label": "发货单", "target_label": "发货单副本"})',
      'listed = run_list_alignments(cwd, {})',
      'suggest = run_suggest_alignments(cwd, {"threshold": 0.2, "limit": 10})',
      'deleted = run_delete_alignment(cwd, {"id": saved.get("id")})',
      'after = run_list_alignments(cwd, {})',
      'print(json.dumps({"id": saved.get("id"), "n": len(listed), "suggest": len(suggest), "deleted": deleted.get("ok"), "after": len(after)}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.ok(got.id)
    assert.equal(got.n, 1)
    assert.ok(got.suggest >= 1)
    assert.equal(got.deleted, true)
    assert.equal(got.after, 0)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
