---
cursor:
  subagentId: "bc-c3923d7a-47e6-5b61-8d0f-bc0ac8859b83"
---

# Decision 15 — live vocab + graph vs biz hardcoding

**Scope checked:** workspace `fdex测试1`, cwd `/Users/zxz/Documents/ai-project/fdex测试`, DSH home `~/.dsh-fde-x`, BFF `http://127.0.0.1:4318`, semantic bridge `http://127.0.0.1:5174/semantic-os/python` (2026-09-17, services already up).

## Ace right? **Mostly yes on data model; no on “biz already fully driven by vocab/graph”.**

| Claim | Live verdict |
| --- | --- |
| 词表 ≠ only fields + generic where; **actions live in 词表 too** | **Yes** — per-kind `can` on `skos:Concept` nodes |
| **Relations + attributes** live in **graph** | **Yes** — OWL props + `graph.json` edges; kind **fields** on concepts; per-kind `relations[]` on concepts **empty** in this workspace |
| Preview/write/lookup must use those, not hardcoded 工单/2026/field/table names | **Partial** — kinds/fields/`resource`/ticketField/clues/`can` come from live graph; **gate action lexicon** and several UI/BFF paths still hardcode the five 闸动作 |

---

## Live 词表 (`semantic.vocab` path)

Implementation: `dsh-lan-assist/semantic.js` → `POST /semantic-os/python` op `list_graph_nodes` with `type: skos:Concept`, then `kindsFromGraphNodes` (`write.js`).

### Kinds (live count **45** `skos:Concept`, catalog **42** kinds after filter)

Examples from live graph + `GET /lan-assist/catalog?workspace=…fdex测试`:

| kind | `can` (actions) | `fields` (sample) | `resource` (table stem) |
| --- | --- | --- | --- |
| 审批单 | 现查, 过审 | requestNo, 单号, 状态 | `biz_leave_requests` |
| 报销单 | 现查, 过审 | expenseNo, 单号, 状态 | (in graph) |
| 工单 | 现查, **新建** | 单号, 状态 | `biz_tickets` |
| 测试单 | 现查 | 单号, 状态 | *(none)* |
| 资产领用 | 现查 | assignmentNo, 单号, 状态 | `biz_asset_assignments` |

Also on concepts: `ticketField`, `dateField`, `clues` (say/keys/values), `catalogVersion`, optional `relations[]` (all **[]** here).

### Actions-in-vocab? **Yes**

- Distinct `can` values on live fdex测试 concepts: **`现查` (43 kinds), `过审` (6), `新建` (1 → 工单)**.
- **`改行` / `删除` do not appear in any live `can` array** (0 kinds).
- Default when `can` missing/empty in mapper: `kindsFromGraphNodes` sets `can: ['现查']` (`write.js:kindsFromGraphNodes`).

### BFF `/api/v1/biz/kinds`

- Source: `lanAssist('/catalog')` first; fallback `loadMemoryWorkspaceVocab` (`memory-vocab.mjs`).
- Live response: **42 kinds**, **`relations: []`**, **`catalogVersion: []`**.
- **`mapKindsFromCatalog` drops `can`** — UI only gets `{ kind, label, fields }` (`biz.mjs:mapKindsFromCatalog`). Lan-assist `/catalog` **does** include `can`.

---

## Live graph (semantic-os)

File: `/Users/zxz/Documents/ai-project/fdex测试/.dsh/semantic-os/graph.json` (consistent with live python API).

### Relations-in-graph? **Yes (ontology + edges); not wired into catalog `relations` today**

**OWL nodes (live `list_graph_nodes`):**

- `owl:ObjectProperty` (**3**): 属于, 包含, 出自
- `owl:DatatypeProperty` (**2**): 路径, 来源
- `owl:Class` (**47**): BOM, 订单, Document, 分类概念, …

**Edges (top types in `graph.json`):**

- `hasTopConcept` (45), `skos:exactMatch` (45) — scheme ↔ concepts
- `rdfs:domain` / `rdfs:range` — property typing
- Instance edges e.g. 张三 —**负责**→ semantic-os, —**同事**→ 李四

**Per-kind join metadata:** `relations` property on `skos:Concept` → **0** concepts with non-empty `relations` in live catalog. `lookup.js:relatedField` reads **`row.relations` from vocab**, else falls back to `selfFk` stem heuristics.

### Attributes

- **Kind field lists** on `skos:Concept.properties.fields` (+ `ticketField` injected into fields list in mapper).
- **Graph datatype attrs** as OWL properties (路径, 来源), separate from Noco field names.

---

## Code paths that already follow vocab/graph

| Area | Behavior |
| --- | --- |
| `semantic.js:vocab` | Loads kinds from workspace graph (`skos:Concept`) |
| `write.js` gate | `vocabFor` → `loadWorkspaceVocab`; `vocabRow`, `actionAllowed(row.can)`, `mapKind` → `resource` |
| `lookup.js` | `mapKind` / `resource` from vocab; `bindWhereKeys` via `where-pass.js` + schema + vocab `dateField` |
| `where-pass.js` | Resolves Chinese field labels via vocab row + collection schema; year `2026` → date range generically (`yearBounds`) — **not** hardcoded year |
| `biz.mjs` preview | Delegates to lan-assist with translated payload; `where` via `normalizePreviewWhere` (generic aliases only) |
| `memory-vocab.mjs` | Same graph slice as Memory explore; includes `can` when used as fallback |

---

## Hardcoded leftovers (file:symbol)

**Global gate action set (not read from graph as a scheme):**

- `plan.js:PLAN_ACTIONS` — `['现查','改行','删除','新建','过审']`
- `resolve.js:WRITE_CODES` — same five
- `biz.mjs:translateBizIntent` — `actionMap` + error string listing 现查/改行/新建/删除/过审
- `write.js:actionAllowed` — compares against fixed action names; treats 改行/删除/新建/现查 with special OR rules vs `can`
- `apps/spec.mjs` — `allowedActions` same five

**UI / product copy (Chinese action labels, not kind names):**

- `RecordsPanel.tsx` — `runPreview('改行'|'过审')`, strings 现查/改行/过审
- `OperationControlPanel.tsx` — action dropdown hardcoded list

**Kind / table names in runtime (excluding tests):**

- No production `kind: '工单'` string in `runtime/` grep; **工单** appears only in **tests** (`biz-where.test.mjs`).
- Table names appear on **live vocab nodes** as `resource: biz_*` (data), not as hardcoded lookup keys in overlay code — lookup uses `mapKind` from loaded vocab.

**BFF shape loss:**

- `biz.mjs:mapKindsFromCatalog` — strips `can`, `resource`, `relations` from `/biz/kinds` response (frontend cannot show per-kind allowed actions from BFF alone).

**Mapper default:**

- `write.js:kindsFromGraphNodes` — `can: can.length ? can : ['现查']` (implicit action not authored in graph).

---

## Plain summary

1. **Ace on 词表:** Correct — live fdex测试 词表 is `skos:Concept` nodes with **fields + per-kind `can` actions + `resource`/clues**, not just where-clauses.
2. **Ace on graph:** Correct — **relations** (OWL + edges) and **attributes** (fields on concepts, OWL datatype props) live in semantic-os graph; this workspace has **no populated `relations[]` on kinds**, so joins still use FK heuristics when relations absent.
3. **Ace on “must not hardcode”:** **Not yet** — the **five 闸动作** are a fixed product lexicon in plan/resolve/BFF/UI; only **which actions each kind may use** comes from vocab `can`. **`改行`/`删除` are enforced in code but absent from live `can` lists.** Kind/table names for fdex测试 are **in graph**, not scattered as literals in biz overlay (except tests).

**Evidence anchors:**

- Live catalog: `curl 'http://127.0.0.1:4318/lan-assist/catalog?workspace=/Users/zxz/Documents/ai-project/fdex测试'`
- Live kinds BFF: `curl 'http://127.0.0.1:4318/api/v1/biz/kinds?workspace=…'`
- Live graph slice: `POST http://127.0.0.1:5174/semantic-os/python` `{ op: list_graph_nodes, cwd, args: { type: skos:Concept } }`
- On-disk graph: `fdex测试/.dsh/semantic-os/graph.json`
