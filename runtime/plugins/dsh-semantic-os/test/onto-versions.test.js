import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const py = join(root, 'python')

test('product compare route is POST and create goes through sidecar', () => {
  const src = readFileSync(join(root, 'product.js'), 'utf8')
  assert.match(src, /endsWith\('\/compare'\) && req.method === 'POST'/)
  assert.match(src, /op: 'create_ontology_version'/)
  assert.match(src, /op: 'compare_ontology_versions'/)
  assert.match(src, /op: 'list_ontology_versions'/)
})

test('snapshot, create, compare ontology versions without hard-coded kinds', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-ontover-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'https://ex/ont#Thing', type: 'owl:Class', content: 'Thing', properties: { ontology_uri: 'https://ex/ont' } },
        { id: 'https://ex/ont#name', type: 'owl:DatatypeProperty', content: 'name', properties: { ontology_uri: 'https://ex/ont' } },
        { id: 'https://ex/ont#Invoice', type: 'skos:Concept', content: '单据', properties: { scheme_uri: 'https://ex/ont' } },
      ],
      edges: [],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from onto_versions import snapshot_structure, create_version, compare_versions, list_versions',
      `cwd = ${JSON.stringify(cwd)}`,
      'uri = "https://ex/ont"',
      'snap = snapshot_structure(cwd)',
      'first = create_version(cwd, {"uri": uri, "version": "v1"})',
      'second = create_version(cwd, {"uri": uri, "version": "v2"})',
      'dup = create_version(cwd, {"uri": uri, "version": "v1"})',
      'listed = list_versions(cwd, uri)',
      'diff = compare_versions(cwd, {"uri": uri, "version1": "v1", "version2": "v2"})',
      'print(json.dumps({"classes": snap.get("classes"), "concepts": snap.get("concepts"), "ok": first.get("ok"), "n": len(listed), "dup": dup.get("error"), "diff_ok": diff.get("ok"), "via": diff.get("via")}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.ok(got.classes.includes('https://ex/ont#Thing'))
    assert.ok(got.concepts.includes('https://ex/ont#Invoice'))
    assert.equal(got.ok, true)
    assert.equal(got.n, 2)
    assert.equal(got.dup, 'VERSION_EXISTS')
    assert.equal(got.diff_ok, true)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
