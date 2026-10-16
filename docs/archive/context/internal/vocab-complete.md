---
cursor:
  subagentId: "bc-561b244d-f0b0-50bc-a767-00d1802ca15e"
---

# 词表补齐（Decision 15 · fdex测试）

**Workspace:** `/Users/zxz/Documents/ai-project/fdex测试`  
**Graph:** `/Users/zxz/Documents/ai-project/fdex测试/.dsh/semantic-os/graph.json`  
**Verified:** `GET http://127.0.0.1:4318/lan-assist/catalog?workspace=…` (URL-encoded cwd), 2026-09-17.

## How it was written

| Step | Mechanism | Notes |
|------|-----------|--------|
| Read kinds | `POST http://127.0.0.1:5174/semantic-os/python` `op=list_graph_nodes`, `type=skos:Concept` | `Origin: http://127.0.0.1:5174` |
| Patch `can` | **`POST http://127.0.0.1:5174/semantic-os/api/vocabulary/concepts`** | Official vocab write API (`serveVocabPatch` → `upsert_workspace_vocab`). **Not** hand-edited `graph.json`. |
| Rejected paths | `POST …/lan-assist/catalog/publish` → `USE_HOST_TOOL`; `POST …/semantic-os/python` with `op=upsert_workspace_vocab` → `403 USE_HOST_TOOL` | Host blocks direct python upsert; vocabulary concepts route is the supported path. |
| Batches | 40 concepts in 3 batches (16+16+8) | API limit 16 concepts per request. |

**Rule applied (per assignment):** For each `skos:Concept` with a real **`resource`** (table-backed), start from existing `can`, add **`改行`** and **`删除`** if missing. Kept existing **`过审`** (6 kinds) and **`新建`** (工单 only). No special-case on the string 工单. No new kinds, fields, or Noco tables. FDE shell untouched.

## Counts after (catalog + graph)

Source: live catalog + second `list_graph_nodes` after patch.

| Action | Kinds (resource-backed skos) | Catalog `kinds[]` (all registered) |
|--------|------------------------------|-------------------------------------|
| 现查 | 41 | 42 |
| 改行 | 41 | 41 |
| 删除 | 41 | 41 |
| 过审 | 6 | 6 |
| 新建 | 1 (工单) | 1 |

**Before (assignment baseline):** 现查 ~43, 过审 ~6, 新建 only 工单, 改行/删除 on zero kinds.

**Verification:** 41 catalog kinds include **`改行`**; 工单 is **not** the only kind with 改行 (e.g. 客户, 供应商, 采购单, …).

## `relations[]`

| Target | Result |
|--------|--------|
| Per-kind `relations` in catalog | **0 rows** (all `[]`) |
| Top-level catalog `relations` | **[]** |

**Why left empty:** OWL object properties 属于 / 包含 / 出自 exist, but `rdfs:domain` / `rdfs:range` only tie **Document** / **分类概念** / datatypes — not business `skos:Concept` pairs. **Zero** `skos:Concept`↔`skos:Concept` edges in `graph.json` (excluding scheme / `skos:exactMatch` / broader). No FK-shaped edges to copy without inventing a business model.

## Leftover gaps

1. **测试单** — catalog still `can: ["现查"]` only; graph `#smoke-ticket` has **no `resource`** (smoke concept). Did not add 改行/删除 (not table-backed).
2. **~59 skos nodes without `resource`** in graph (OWL classes, Document, scheme meta, etc.) — unchanged; not in biz catalog as writable table kinds.
3. **`relations[]`** — still empty until graph has real inter-kind object-property instances between business concepts.
4. **`catalog/publish`** on 4318 remains `USE_HOST_TOOL` for HTTP clients; use **`/semantic-os/api/vocabulary/concepts`** (or host tool) for writes.
5. **新建** — only 工单; other header kinds were not given 新建 (no separate “create” clue beyond status literals like「新建」in status value lists).

## Evidence snippets

- Catalog sample after patch: 客户 `["现查","改行","删除"]`; 工单 `["现查","改行","删除","新建"]`; 采购单 `["现查","改行","删除","过审"]`.
- Disk `graph.json` updated by semantic-os persist (timestamps refreshed on OWL block); valid JSON, reload-safe via same APIs.
