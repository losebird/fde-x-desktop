import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const py = join(root, 'python')

test('graph_path walks the workbench and ignores diary nodes', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-path-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'a', type: 'Person', content: '甲' },
        { id: 'b', type: 'Person', content: '乙' },
        { id: 'session:s1:1', type: 'Document', content: '日记' },
      ],
      edges: [
        { source: 'a', target: 'b', type: '认识' },
        { source: 'a', target: 'session:s1:1', type: '出自' },
      ],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_graph_path, run_graph_stats',
      `cwd = ${JSON.stringify(cwd)}`,
      'path = run_graph_path(cwd, {"source": "a", "target": "b"})',
      'stats = run_graph_stats(cwd, {})',
      'print(json.dumps({"path": path.get("path"), "n": stats.get("node_count"), "e": stats.get("edge_count")}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.deepEqual(got.path, ['a', 'b'])
    assert.equal(got.n, 2)
    assert.equal(got.e, 1)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('query_graph resolves a person by label', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-qg-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'person:zhang', type: '人员', content: '张三', properties: { label: '张三' } },
        { id: 'session:s1:1', type: 'Document', content: '拍板' },
      ],
      edges: [
        { source: 'person:zhang', target: 'session:s1:1', type: '出自' },
      ],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_query_graph',
      `cwd = ${JSON.stringify(cwd)}`,
      'got = run_query_graph(cwd, {"start": "张三", "hops": 2})',
      'print(json.dumps({"resolved": got.get("resolved"), "n": len(got.get("nodes") or []), "empty": got.get("empty")}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.equal(got.resolved, 'person:zhang')
    assert.equal(got.empty, false)
    assert.ok(got.n >= 1)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('export_skos dumps schemes without OWL extras', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-skos-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'https://dsh.local/vocab#scheme', type: 'skos:ConceptScheme', content: '本仓分类' },
        { id: 'https://dsh.local/vocab#plugin', type: 'skos:Concept', content: '插件' },
      ],
      edges: [
        { source: 'https://dsh.local/vocab#scheme', target: 'https://dsh.local/vocab#plugin', type: 'hasTopConcept' },
      ],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_export_skos',
      `cwd = ${JSON.stringify(cwd)}`,
      'got = run_export_skos(cwd, {})',
      'body = json.loads(got.get("data") or "{}")',
      'print(json.dumps({"ok": got.get("ok"), "fmt": got.get("format"), "schemes": len(body.get("schemes") or [])}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.equal(got.ok, true)
    assert.equal(got.fmt, 'skos-json')
    assert.equal(got.schemes, 1)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('export_owl writes owl:Class labels not an empty shell', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-owl-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'https://dsh.local/vocab#class-plugin', type: 'owl:Class', content: '插件' },
        { id: 'https://dsh.local/vocab#plugin', type: 'skos:Concept', content: '插件' },
      ],
      edges: [],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_export_owl',
      `cwd = ${JSON.stringify(cwd)}`,
      'got = run_export_owl(cwd, {})',
      'data = got.get("data") or ""',
      'print(json.dumps({"ok": got.get("ok"), "fmt": got.get("format"), "hasClass": "owl:Class" in data, "hasLabel": "插件" in data, "len": len(data)}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.equal(got.ok, true)
    assert.equal(got.hasClass, true)
    assert.equal(got.hasLabel, true)
    assert.ok(got.len > 80)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('generate_shacl writes one NodeShape per owl:Class', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-shacl-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'https://dsh.local/vocab#class-plugin', type: 'owl:Class', content: '插件' },
        { id: 'session:abc:1', type: 'Document', content: '日记不进形状' },
      ],
      edges: [],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_generate_shacl',
      `cwd = ${JSON.stringify(cwd)}`,
      'got = run_generate_shacl(cwd, {})',
      'print(json.dumps({"ok": got.get("ok"), "n": got.get("shape_count"), "hasPlugin": "插件" in (got.get("shacl_turtle") or ""), "hasDiary": "日记不进形状" in (got.get("shacl_turtle") or "")}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.equal(got.ok, true)
    assert.equal(got.n, 1)
    assert.equal(got.hasPlugin, true)
    assert.equal(got.hasDiary, false)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('workbench reason derives WorkType from owl:Class not diary', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-reason-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        { id: 'https://dsh.local/vocab#class-plugin', type: 'owl:Class', content: '插件' },
        { id: 'session:abc:1', type: 'Document', content: '日记' },
      ],
      edges: [],
    }))
    const script = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import run_workbench_reason',
      `cwd = ${JSON.stringify(cwd)}`,
      'got = run_workbench_reason(cwd, {})',
      'print(json.dumps({"ok": got.get("ok"), "n": got.get("n_derived"), "facts": got.get("facts"), "derived": got.get("derived_facts")}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.equal(got.ok, true)
    assert.equal(got.n, 1)
    assert.deepEqual(got.facts, ['Class(插件)'])
    assert.deepEqual(got.derived, ['WorkType(插件)'])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('workbench stamp uses file mtime not now', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-stamp-'))
  try {
    const src = join(cwd, 'old.py')
    writeFileSync(src, 'print(1)\n')
    const script = [
      'import json,sys,os',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import _stamp_from_path_or_source, file_mtime_iso',
      `src = ${JSON.stringify(src)}`,
      'row = {"id": "search_text", "type": "源码", "properties": {"path": src, "source": src}}',
      'iso = _stamp_from_path_or_source(row, {})',
      'print(json.dumps({"iso": iso, "mtime": file_mtime_iso(src), "emptyAuto": _stamp_from_path_or_source({"properties": {"source": "auto-workspace-owl"}}, {})}))',
    ].join('\n')
    const got = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    assert.equal(got.iso, got.mtime)
    assert.ok(got.iso)
    assert.equal(got.emptyAuto, '')
    const owlScript = [
      'import json,sys',
      `sys.path.insert(0, ${JSON.stringify(py)})`,
      'from bootstrap import event_fields',
      'got = event_fields(extra={"valid_from": "2026-08-20T00:00:00+00:00"})',
      'print(json.dumps({"fromExtra": got.get("valid_from"), "hasNow": bool(event_fields().get("valid_from"))}))',
    ].join('\n')
    const owl = JSON.parse(execFileSync('python3', ['-c', owlScript], { encoding: 'utf8' }))
    assert.equal(owl.fromExtra, '2026-08-20T00:00:00+00:00')
    assert.equal(owl.hasNow, true)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
