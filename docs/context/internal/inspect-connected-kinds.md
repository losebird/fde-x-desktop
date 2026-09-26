---
cursor.subagentId: inspect-connected-kinds
---

# Live lan-assist / biz kinds inspection (fdex测试)

Inspected: 2026-09-20T13:29:49Z (local Mac scene-39). Read-only.

## Sources

- `GET http://127.0.0.1:4318/api/v1/biz/kinds?cwd=/Users/zxz/Documents/ai-project/fdex测试` → **21** kinds, `catalogVersion: ["schema:ccf68f509408"]`.
- Without `cwd` (or cwd=`fdex` non-测试): **0** kinds.
- `GET http://127.0.0.1:4318/api/v1/biz/catalog?cwd=…` → `{ items: [] }` (BFF catalog list empty; kinds payload still populated via internal `lanAssist(/catalog)` + memory merge).
- Direct `GET http://127.0.0.1:18528/catalog?workspace=…` → `{ ok:false, error:"NOT_FOUND" }`.
- `GET http://127.0.0.1:4319/api/v1/biz/kinds?cwd=fdex测试` → peer stack **1** kind (`测试单`, no `resource`).

## Connector vs graph-only (live merged payload)

`biz/kinds` runs `mapKindsFromCatalog` then `mergeConnectedKindCatalog` + `collapseKindsToConnectedTables` (`runtime/biz/connected-kind.mjs`). **All 21 returned rows have a non-empty `resource`.** None are graph-only in the API response.

Graph-only **labels** still appear as relation endpoints (85 relations) but not as separate kind rows, e.g.: `BOM明细`, `仓库`, `付款单`, `供应商`, `商品分类`, `固定资产`, `客户`, `岗位`, `工单`, `库存`, `收货明细`, `生产工单`, `销售订单`

## Per-kind table

| kind | resource | catalogVersion | 型槽 / aliases (live) | can |
| --- | --- | --- | --- | --- |
| BOM物料清单 | `biz_boms` | schema:ccf68f509408 | aliases=['BOM'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| {{t("Departments")}} | `departments` | schema:ccf68f509408 | aliases=[] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建 |
| {{t("Roles")}} | `roles` | schema:ccf68f509408 | aliases=[] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建 |
| {{t("Users")}} | `users` | schema:ccf68f509408 | aliases=[] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建 |
| 出入库流水 | `biz_stock_movements` | schema:ccf68f509408 | aliases=['出入库单'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建 |
| 员工档案 | `biz_employees` | schema:ccf68f509408 | aliases=['员工'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 商品物料 | `biz_products` | schema:ccf68f509408 | aliases=['商品'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 工单处理记录 | `biz_ticket_logs` | schema:ccf68f509408 | aliases=['工单日志'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建 |
| 生产领料单 | `biz_material_issues` | schema:ccf68f509408 | aliases=['领料单'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建 |
| 考勤记录 | `biz_attendance_records` | schema:ccf68f509408 | aliases=['考勤'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 请假申请 | `biz_leave_requests` | schema:ccf68f509408 | aliases=['审批单', '请假单'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 费用报销 | `biz_expenses` | schema:ccf68f509408 | aliases=['报销单'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 资产领用归还 | `biz_asset_assignments` | schema:ccf68f509408 | aliases=['资产领用'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 采购收货单 | `biz_purchase_receipts` | schema:ccf68f509408 | aliases=['收货单'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 采购订单 | `biz_purchase_orders` | schema:ccf68f509408 | aliases=['采购单', '请购单'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 采购订单明细 | `biz_purchase_order_items` | schema:ccf68f509408 | aliases=['采购明细'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建 |
| 销售合同 | `biz_contracts` | schema:ccf68f509408 | aliases=['合同'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 销售商机 | `biz_opportunities` | schema:ccf68f509408 | aliases=['商机'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建 |
| 销售回款 | `biz_payments` | schema:ccf68f509408 | aliases=['回款单'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 销售线索 | `biz_leads` | schema:ccf68f509408 | aliases=['线索'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建、过审 |
| 销售订单明细 | `biz_sales_order_items` | schema:ccf68f509408 | aliases=['销售明细'] (BFF collapsed; role=型 source in catalog publish / graph clues) | 现查、改行、删除、新建 |

**Empty / non-stem `resource`:** 0 empty; all resources are simple collection stems (`biz_*`, `users`, `roles`, `departments`). `{{t("…")}}` kinds map to `users` / `roles` / `departments`.

## Short spoken name on connected table vs separate graph kind

Structural observations on this workspace (no recommended mapping table):

1. **请假申请** (`biz_leave_requests`) carries spoken aliases **`审批单`**, **`请假单`** on the connected row. There is **no** separate kind row named `审批单` with empty `resource` in the merged API — collapse treats spoken/graph names as aliases on the canonical connected concept.
2. **工单处理记录** (`biz_ticket_logs`) aliases **`工单日志`** only — **not** the short label `工单`. Relations elsewhere still name **`工单`** as a graph endpoint (e.g. BOM → 生产工单), so long connected ticket name and short graph label coexist in the **relation graph**, but the short `工单` is **not** folded into this table’s alias list in the live kinds payload.
3. No live example of “connected table 型槽 includes short X” **and** a second merged kind row “X” with empty `resource`” — empty-resource rows are removed by collapse when a connector resource exists.

## `mapKind` (lookup.js)

Resolution order: vocab rows → connector `kinds`/`maps` → live `collections` title/name match. Row mapping **skips empty `resource`**:

```javascript
export function mapKind(kind, extra = {}) {
  const name = String(kind || '').trim()
  if (!name) return null
  const fromVocab = mapFromRows(name, extra.vocab)
  if (fromVocab) return fromVocab
  const fromConn = mapFromRows(name, extra.kinds || extra.maps)
  if (fromConn) return fromConn
  const fromLive = mapFromCollections(name, extra.collections)
  if (fromLive) return fromLive
  return null
}

function mapFromRows(name, rows) {
  ...
    const resource = String(row.resource || row.collection || row.name || '').trim()
    if (!resource) continue
  ...
}

function mapFromCollections(name, collections) {
  ...
    if (title !== name && resource !== name) continue
  ...
}
```

**Empty-resource graph kind + collection title equals kind:** `mapFromRows` does not match (empty `resource` skipped), but **`mapFromCollections`** can still resolve if a live collection’s `title` (or `name`) equals the kind string. Simulated: `mapKind("工单", { vocab:[{kind:"工单",resource:""}], collections:[{title:"工单",name:"biz_work_orders"}] })` → `{ resource: "biz_work_orders", … }`.

## `registeredKinds`

Builds from `vocab`, `kinds`, `maps`, and **`collections`** (`listKindRows`), drops `口语` / `spoken`, sorts longest-first. On **live merged `biz/kinds` only** (21 rows): **21** labels, **no** graph-only names like `工单` / `生产工单` / `审批单` unless they appear as their own kind row. Relation-only graph labels are **not** registered.

If graph-only kind rows were present in `vocab`/`kinds` (pre-collapse memory), `registeredKinds` **would** include them (simulation added `工单`, `审批单`, `生产工单`).

## Hop / `kindMentions` — 工单 vs 审批单

Token sources per label (`slots.js`): full label (len≥2), **`titleSuffixTokens`** (suffixes of the kind **title**, end-aligned substrings only), and with `extra.vocab`: `spokenAliasTokens` (**`clue.role === "型"`** only) plus `graphAliasTokens` (`row.aliases`, relation alias fields).

Greedy match: sort candidates by **longer token**, graph-neighbor score, deprioritize `isLeftoverShortKind`, prefer exact `token === kind`, then longer kind name; mark character ranges taken.

**Live catalog (21 kinds):**

| speech | `kindMentions` kinds |
| --- | --- |
| `查一下工单` | *(none)* — no kind emits token `工单` (`工单处理记录` suffixes do not include `工单`; alias is `工单日志`) |
| `工单和审批单` | `请假申请` only — via alias **`审批单`** |
| `审批单状态` | `请假申请` |
| `工单日志` | `工单处理记录` |

**Cross-hit risk:** On the **live** merged payload, utterances containing **`工单`** do **not** also mention-hit **`审批单`** as a separate kind; `审批单` is an alias on **`请假申请`**, and `工单` is not a substring of `审批单`. They are not confused by suffix overlap.

**If** separate graph kind rows `工单` and `审批单` were still in `registeredKinds`, speech `工单和审批单` would mention-hit **both** graph kinds (simulation), not the connected `请假申请` row — separate failure mode from alias-on-connected-table.
