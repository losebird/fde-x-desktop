import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('skos inspector carries gate fields from the node, not a kind-name if', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from unittest.mock import patch
from bootstrap import run_skos_concept, run_skos_hierarchy
uri = "https://dsh.local/vocab/ws/x#sales-receipt"
row = {
  "id": uri,
  "type": "skos:Concept",
  "content": "回款单",
  "properties": {"fields": ["单号", "状态"], "can": ["现查"], "resource": "biz_receipts", "ticketField": "code", "catalogVersion": "v3", "relations": [{"from": "客户", "to": "回款单", "field": "customerId"}]},
}
edges = [{"source": "https://dsh.local/vocab/ws/x#scheme", "target": uri, "type": "hasTopConcept"}]
with patch("bootstrap.read_node_rows", return_value=([row], {"ok": True})):
  with patch("bootstrap.read_edge_rows", return_value=edges):
    concept = run_skos_concept("/ws", {"uri": uri})
    tree = run_skos_hierarchy("/ws", {"scheme": "https://dsh.local/vocab/ws/x#scheme"})
print(json.dumps({"concept": concept, "tree": tree}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.deepEqual(got.concept.fields, ['单号', '状态'])
  assert.deepEqual(got.concept.can, ['现查'])
  assert.equal(got.concept.resource, 'biz_receipts')
  assert.equal(got.concept.catalogVersion, 'v3')
  assert.deepEqual(got.concept.relations, [{ from: '客户', to: '回款单', field: 'customerId' }])
  assert.equal(got.tree[0].fields[0], '单号')
  assert.deepEqual(got.tree[0].can, ['现查'])
  assert.equal(got.tree[0].catalogVersion, 'v3')
})

test('ontology inspector draws gate chips from concept fields, not a kind-name if', async () => {
  const src = readFileSync(new URL('../dist/ontology/ontology.js', import.meta.url), 'utf8')
  assert.match(src, /闸字段/)
  assert.match(src, /能做/)
  assert.match(src, /\/api\/vocabulary\/concepts/)
  assert.equal(src.includes('if (kind === "采购单")'), false)
  assert.equal(src.includes('if(e==="采购单")'), false)
  const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(client, /ontology\.js\?v=' \+ ASSET_V/)
  assert.match(client, /const ASSET_V = '/)
})

test('词表 accepts a 型 and refuses a 行', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from kind import accept_kind
print(json.dumps({
  "type": accept_kind({"label": "采购单", "fields": ["单号", "状态"], "can": ["过审"]}),
  "row": accept_kind({"label": "PO-12", "ticket": "PO-12", "amount": "12800"}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.type.ok, true)
  assert.equal(got.type.kind, '采购单')
  assert.equal(got.row.ok, false)
  assert.equal(got.row.error, 'NOT_A_KIND')
})

test('词表 refuses 采购单行 and 金额 as a 型', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from kind import accept_kind
print(json.dumps({
  "row": accept_kind({"label": "采购单行", "fields": ["金额"]}),
  "money": accept_kind({"label": "采购单", "fields": ["金额"]}),
  "ok": accept_kind({"label": "采购单", "fields": ["单号", "状态"]}),
  "bank": accept_kind({"label": "银行", "fields": ["单号"]}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.row.ok, false)
  assert.equal(got.money.ok, false)
  assert.equal(got.ok.ok, true)
  assert.equal(got.bank.ok, true)
})

test('a 采购单 without 单号 is rejected by the 型', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from kind import check_shape
vocab = [{"kind": "采购单", "fields": ["单号", "状态"]}]
print(json.dumps({
  "miss": check_shape({"kind": "采购单", "status": "待审"}, vocab),
  "ok": check_shape({"kind": "采购单", "ticket": "PO-12", "status": "待审"}, vocab),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.miss.ok, false)
  assert.equal(got.miss.error, 'MISSING_FIELD')
  assert.equal(got.miss.field, '单号')
  assert.equal(got.ok.ok, true)
})

test('a kind not in the 词表 is not shaped', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from kind import check_shape
print(json.dumps(check_shape({"kind": "便签", "text": "随便记"}, [{"kind": "采购单", "fields": ["单号"]}]), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.ok, true)
})

test('shape check only runs on a 业务引用 write', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from kind import should_shape, check_shape
vocab = [{"kind": "客户", "fields": ["单号", "状态"]}, {"kind": "采购明细", "fields": ["单号", "行号"]}]
print(json.dumps({
  "chat": should_shape({"type": "客户", "label": "张三"}),
  "ref": should_shape({"system": "采购", "environment": "测试", "kind": "采购单", "ticket": "PO-12"}),
  "line": check_shape({"kind": "采购明细", "ticket": "PO-12", "行号": "3"}, vocab),
  "noline": check_shape({"kind": "采购明细", "ticket": "PO-12"}, vocab),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.chat, false)
  assert.equal(got.ref, true)
  assert.equal(got.line.ok, true)
  assert.equal(got.noline.ok, false)
  assert.equal(got.noline.field, '行号')
})

test('upsert_workspace_vocab is a registered host tool', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../tools.js', import.meta.url), 'utf8')
  assert.match(src, /name: 'upsert_workspace_vocab'/)
  assert.match(src, /Do not POST \/semantic-os\/python/)
  assert.match(src, /additionalProperties: false/)
  assert.match(src, /resource/)
  assert.match(src, /ticketField/)
  assert.match(src, /clues/)
  assert.match(src, /catalogVersion/)
  assert.match(src, /relations/)
  assert.match(src, /Do not use add_entity to patch/)
})

test('vocabulary editor source can save catalogVersion, aliases and relations', () => {
  const src = readFileSync(new URL('../ui/src/workspaces/VocabularyWorkspace/PropertyPanel.tsx', import.meta.url), 'utf8')
  assert.match(src, /目录版本/)
  assert.match(src, /catalogVersion/)
  assert.match(src, /角色，型=别名/)
  assert.match(src, /可执行关系/)
  assert.match(src, /draftToRelations/)
})

test('connector extras stay on a 型 and junk is dropped', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from kind import accept_kind, pack_kind_connector
print(json.dumps({
  "ok": accept_kind({
    "label": "客户",
    "fields": ["单号", "状态"],
    "can": ["现查"],
    "resource": "biz_customers",
    "ticketField": "code",
    "clues": [{"say": ["处理中"], "keys": ["status"], "values": ["processing"]}],
  }),
  "junk": pack_kind_connector({"resource": "客户表", "ticketField": "PO-12", "clues": "处理中"}),
  "row": accept_kind({"label": "客户", "ticket": "CUST-1"}),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.ok.ok, true)
  assert.equal(got.ok.resource, 'biz_customers')
  assert.equal(got.ok.ticketField, 'code')
  assert.equal(got.ok.clues[0].say[0], '处理中')
  assert.deepEqual(got.junk, {})
  assert.equal(got.row.ok, false)
})

test('kind pack keeps catalogVersion, relations, and clue role/not', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from kind import pack_kind_connector
print(json.dumps(pack_kind_connector({
  "resource": "biz_tickets",
  "ticketField": "ticketNo",
  "catalogVersion": "v3",
  "relations": [{"from": "客户", "to": "工单", "field": "customerId"}],
  "clues": [{"role": "型", "say": ["工单"], "not": True, "keys": ["status"], "values": ["closed"]}],
}), ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.catalogVersion, 'v3')
  assert.deepEqual(got.relations, [{ from: '客户', to: '工单', field: 'customerId' }])
  assert.equal(got.clues[0].role, '型')
  assert.equal(got.clues[0].not, true)
})

test('existing 型 merge keeps fields/can and patches extras', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from kind import merge_kind_props
base = {"fields": ["单号", "状态"], "can": ["现查"], "scheme": "keep-me"}
print(json.dumps({
  "patch": merge_kind_props(base, {
    "fields": [],
    "can": [],
    "resource": "biz_customers",
    "ticketField": "code",
    "clues": [{"say": ["处理中"], "keys": ["status"]}],
  }),
  "wipe": merge_kind_props(base, {"fields": [], "can": [], "resource": "", "clues": []}),
  "same": merge_kind_props({**base, "resource": "biz_customers"}, {"resource": "biz_customers"}),
  "replace": merge_kind_props(base, {"fields": [], "can": ["过审"]}, True),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.patch.resource, 'biz_customers')
  assert.equal(got.patch.ticketField, 'code')
  assert.equal(got.patch.clues[0].say[0], '处理中')
  assert.equal('fields' in got.patch, false)
  assert.equal('can' in got.patch, false)
  assert.deepEqual(got.wipe, {})
  assert.deepEqual(got.same, {})
  assert.deepEqual(got.replace.fields, [])
  assert.deepEqual(got.replace.can, ['过审'])
})

test('kind_patch updates label and keeps empty batch from wiping', () => {
  const out = py(`
import json, sys
sys.path.insert(0, "python")
from kind import kind_patch
base = {"fields": ["单号"], "can": ["现查"]}
print(json.dumps({
  "rename": kind_patch(base, {"fields": ["单号"]}, label="采购订单", current_label="采购单"),
  "batch": kind_patch(base, {"fields": [], "can": []}, label="采购单", current_label="采购单"),
  "edit": kind_patch(base, {"fields": ["单号", "状态"]}, label="采购单", current_label="采购单", replace_empty=True),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.rename.content, '采购订单')
  assert.deepEqual(got.batch, {})
  assert.deepEqual(got.edit.fields, ['单号', '状态'])
})

test('add_entity on a skos:Concept patches instead of replacing', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../python/bootstrap.py', import.meta.url), 'utf8')
  assert.match(src, /node_type_of\(existing\) == "skos:Concept"/)
  assert.match(src, /status": "patched"/)
  assert.match(src, /merge_kind_props/)
  assert.match(src, /"patched": patched/)
})
