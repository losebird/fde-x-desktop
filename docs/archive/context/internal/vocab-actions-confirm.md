---
cursor:
  subagentId: "bc-4e010e66-7b1f-5b57-ac77-2875557cf61f"
---

# Vocab actions confirm (Ace correction · Decision 15)

**Scope:** workspace cwd `/Users/zxz/Documents/ai-project/fdex测试` (fdex测试1), code tree `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`. Read-only disk + live probes on 2026-09-17 (4318 catalog OK; 5174 semantic-os ready).

## Short answers

| Question | Answer |
|----------|--------|
| Vocab contains actions? | **Yes** — two layers (see below) |
| FDE uses vocab actions? | **Partial** — gate/catalog honor `can` + spoken clues; FDE BFF + Records UI hardcode the five Chinese action tokens |
| Code vs Decision 15 (actions from vocab) | **Hardcodes actions in FDE layer**; lan-assist overlay **partially** honors vocab with frozen whitelists |

---

## 1. Live / disk vocab for cwd

### Disk (authoritative for this workspace)

| Artifact | Path | Role for actions |
|----------|------|------------------|
| Workspace graph | `/Users/zxz/Documents/ai-project/fdex测试/.dsh/semantic-os/graph.json` | skos:Concept **`can`** per kind; **`#spoken`** concept holds NL→action clues |
| No `semantic.vocab` file | — | **`semantic.vocab(workspace)`** is a **runtime API** on the semantic bridge (`dsh-lan-assist/semantic.js` → `list_graph_nodes` + `kindsFromGraphNodes`), not a filename on disk |
| Package seed (not loaded in prod) | `/Users/zxz/Documents/ai-project/dsh-lan-assist/vocab/spoken.json` | Documents schema; production `spoken.js` explicitly does **not** load this JSON |
| `fdex测试/lan-assist` | empty / no overlay vocab JSON in tree | Overlay lives in FDE vendor copy under scene-39 |

### Schema naming (what the vocab calls “actions”)

1. **Per-kind permitted operations:** property **`can`** on `skos:Concept` kind nodes (string list). Example disk: 测试单 `"can": ["现查"]` (`graph.json` ~L60–62).
2. **Spoken / plan slot:** clue entries with **`keys: ["action"]`** (resolver maps this to role **`动作`**). Canonical **`values`** are the action **names** (not UI copy). Same five on disk in `#spoken` clues and in package `spoken.json` (`role: "动作"` + `keys: ["action"]`).

**Action names from vocab (canonical `values` / `can` tokens, not invented):**

From `#spoken` clues in workspace `graph.json` (disk parse):

`现查`, `改行`, `新建`, `删除`, `过审`

From live **`GET http://127.0.0.1:4318/lan-assist/catalog?workspace=…fdex测试`** (2026-09-17):

- **Distinct values appearing in any kind’s `can`:** `现查`, `过审`, `新建` only (42 kinds; e.g. 审批单 `can: ["现查","过审"]`, 工单 `can: ["现查","新建"]`).
- **`口语` kind is omitted from `/catalog`** (`describeKindCatalog` skips `kind === '口语'`) but remains in graph for clue resolution inside the gate.

**Note:** `改行` / `删除` appear as **spoken action values** in graph `#spoken` and in gate whitelists; this cwd’s published **`can`** on kinds does not currently include `改行` or `删除` (live catalog), so write actions would be denied per-kind until `can` is published on those kinds.

---

## 2. FDE biz path: vocab vs hardcode

### lan-assist overlay (plan / lookup / write) — **partial vocab**

| Concern | From vocab? | Evidence |
|---------|-------------|----------|
| Which actions a **kind** may run | **Yes** | `actionAllowed(action, row)` checks `row.can` from loaded vocab (`runtime/vendor-overlays/dsh-lan-assist/write.js`); default `can` `['现查']` if missing in graph |
| NL “查一下” → `现查` etc. | **Yes (graph clues)** | `parseWriteAction` → `actionClues(extra)` reads clues with role **`动作`** / `keys: ['action']` from vocab rows (includes graph **`口语`** concept); `resolve.js` L275–286, L115–122 |
| Plan normalization | **Hardcoded whitelist** | `PLAN_ACTIONS = ['现查','改行','删除','新建','过审']` (`plan.js` L10); unknown action falls back to `'现查'` |
| Publish / validate `can` | **Hardcoded whitelist** | `KIND_CAN = new Set(['现查','改行','删除','新建','过审'])` (`dsh-lan-assist/catalog.js` L49–58) |
| Resolve priority | **Hardcoded** | `WRITE_CODES` order in `resolve.js` L10, L21–29 |

**现查 / 改行 / 增删改审:** operation **names** flowing through preview/write are these Chinese tokens. **Permission** for a kind comes from vocab **`can`**. **Recognition** of speech → action uses vocab **clues** on the **`口语`** concept. **Allowed set** and plan parsing still assume the fixed five names in code.

### FDE BFF — **`runtime/routes/biz.mjs`** — **hardcoded actions**

- `translateBizIntent`: fixed `actionMap` for `record.read|create|update|delete` and the five Chinese names (`biz.mjs` L17–31). Error string lists the same closed set.
- `GET /api/v1/biz/kinds`: `mapKindsFromCatalog` maps **`kind`, `label`, `fields` only** — **`can` dropped** before UI (`biz.mjs` L143–151), even though live `/lan-assist/catalog` returns `can`.

### FDE UI — **hardcoded actions**

| Location | Hardcoded |
|----------|-----------|
| `RecordsPanel.tsx` | Comparisons and defaults: `'现查'`, `'改行'`, `'过审'`, `'新建'`; row buttons call `runPreview('改行'|…)` literally (~L301, 548–559, 1048–1054) |
| `OperationControlPanel.tsx` | `ACTION_OPTIONS` five pairs (`L60–66`); maps to `record.*` in submit handler |
| `biz-session-sheet.ts`, `biz-kind-list-cache.ts`, `biz-sheet-display.ts` | Branch on same five strings |

Pending sheet path: **`/api/v1/biz/pending-sheet`** proxies lan-assist state; **`action` on sheet** is whatever the gate emitted (vocab-shaped token), but UI logic still compares to hardcoded literals.

### Memory fallback vocab — **includes `can`**

`runtime/biz/memory-vocab.mjs` passes through `can` from graph (`L37`) when lan-assist catalog is empty; does **not** add a separate action list.

---

## 3. Decision 15 verdict (actions)

**Decision 15** (`docs/project-context.md`): business structure including **动作** must come from vocab + graph; no hardcoded action names in 现查/预览/过账 paths.

| Layer | Honors Decision 15 for actions? |
|-------|----------------------------------|
| Workspace vocab (graph) | **Yes** — defines `can` + spoken `action` clues |
| lan-assist gate | **Partial** — enforces per-kind `can` and spoken clues, but **`PLAN_ACTIONS` / `WRITE_CODES` / `KIND_CAN`** freeze the five names |
| FDE BFF + Records / Operation UI | **No** — **`translateBizIntent` actionMap**, UI buttons, and **`mapKindsFromCatalog` omitting `can`** hardcode / hide vocab-driven actions |

**Conclusion for coordinator:** Ace is right that **actions belong in vocab** (`can` + `#spoken` / `keys:action`). **FDE does not fully honor that for the shell**; it treats the five Chinese verbs as a fixed protocol while lan-assist partially binds them to graph data.

---

## 4. What is hardcoded today (checklist)

1. **`runtime/routes/biz.mjs`** — `translateBizIntent` `actionMap` and error message closed set (现查/改行/新建/删除/过审).
2. **`runtime/routes/biz.mjs`** — `mapKindsFromCatalog` strips **`can`** (UI cannot derive allowed actions from vocab via BFF).
3. **`src/components/biz/OperationControlPanel.tsx`** — `ACTION_OPTIONS`.
4. **`src/components/biz/RecordsPanel.tsx`** — action string literals, `runPreview('改行'|'过审'|…)`, 现查 refresh paths.
5. **`src/lib/biz-session-sheet.ts`**, **`biz-kind-list-cache.ts`**, **`biz-sheet-display.ts`** — 现查 / 过审 / 改行 branches.
6. **Vendor overlay (lan-assist)** — `plan.js` `PLAN_ACTIONS`; `resolve.js` `WRITE_CODES`; `catalog.js` `KIND_CAN`; `write.js` `actionAllowed` explicit checks for 改行/删除/新建/现查; default `can: ['现查']` when absent.
7. **Spec lock (intentional, not changed here):** `docs/specs/05-business-records.md` still documents closed `translateBizIntent` action set.

**Not hardcoded (vocab-backed):** per-kind **`can`** on graph concepts; spoken **`keys: ["action"]`** clues on `#spoken`; live catalog **`can`** arrays (4318); gate **`actionAllowed`** against row **`can`**.

---

## 5. Live probes (read-only)

- `4318` `/api/v1/biz/kinds?workspace=…fdex测试` — kinds returned **without** `can` (BFF mapping).
- `4318` `/lan-assist/catalog?workspace=…` — kinds **with** `can`; distinct **`can`** values: 现查, 过审, 新建.
- `5174` `/semantic-os/ready` — `ready: true`.
- Disk `#spoken` action values — five names above (matches package `spoken.json` action clues).

No code changes in this task.
