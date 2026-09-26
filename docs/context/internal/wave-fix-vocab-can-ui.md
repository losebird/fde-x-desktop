---
cursor:
  subagentId: "bc-bdc0140f-aaf0-5a2b-9c47-6910ece09b39"
---

# Wave fix · vocab `can` → FDE shell actions (Decision 15)

**Repo:** `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**Commit:** `c4e152c193378c5a5ef3e34a654bcb1a12843047` (main)  
**Workspace cwd (user):** `/Users/zxz/Documents/ai-project/fdex测试` · UI 顶栏 **fdex测试1**

## Code changes (smallest slice)

| Area | Change |
|------|--------|
| `runtime/routes/biz.mjs` | `mapKindsFromCatalog` passes `can` / per-kind `relations`; `translateBizIntent` maps `record.*` aliases then **passes through** other gate action strings; where/patch branches use known list-query vs patch verbs, not a frozen five-name gate map |
| `RecordsPanel` | Loads `/api/v1/biz/kinds`, `rowActions` + toolbar **新建** from current kind `can`; write-preview vs list uses `isBizListQueryAction` (现查-only) |
| `OperationControlPanel` | Action `<Select>` from target kind’s `can` (fallback to legacy five only if catalog row missing) |
| `dsh-lan-assist/plan.js` | `normalizePlan` keeps requested action (no `PLAN_ACTIONS` clamp to 现查) |
| `dsh-lan-assist/write.js` | `actionAllowed` → `can.includes(act)` |
| `dsh-lan-assist/resolve.js` | `parseWriteAction` matches clue values against union of vocab `can` + spoken action clues |

## Verify matrix

| Check | Code / static | Live (5174 + browser session, 2026-09-17 ~22:47) |
|-------|----------------|-----------------------------------------------------|
| `GET /api/v1/biz/kinds` includes `can` on kinds | **yes** — `mapKindsFromCatalog` + `biz.test.mjs` asserts `row.can` | **no (this session)** — browser `fetch('/api/v1/biz/kinds')` → `lan_assist_unavailable` / `CWD_NOT_AUTHORIZED`, `kinds: 0`. Restart runtime if BFF still on pre-`c4e152c` build. |
| Records / OperationControl buttons from kind `can` | **yes** — no `ACTION_OPTIONS` / literal `runPreview('改行')` in row loop | **blocked on catalog** — with `CWD_NOT_AUTHORIZED`, `currentKindCan` is `[]` → row **操作** column empty (strict Decision 15). When catalog returns 工单 `can` including 改行/删除/新建, buttons render those tokens only. |
| Screenshot | — | [vocab-can-actions.png](../media/vocab-can-actions.png) (业务应用 · 业务记录 · 工单 chip; taken during gate cwd error — row actions empty until `/biz/kinds` succeeds) |

## Tests run

- `node --test runtime/tests/biz-where.test.mjs` — pass (4)  
- `node --test runtime/tests/biz.test.mjs` — pass (10)

## 仍差 / follow-up

- **锁外：** live `/biz/kinds` + row toolbar need authorized workspace cwd on lan-assist (same class of failure as [vocab-actions-confirm.md](./vocab-actions-confirm.md)); not fixed in this diff.  
- **未对：** `catalog.js` `KIND_CAN` publish whitelist (separate vocab wave; out of scope here).  
- After runtime reload on `c4e152c`, re-hit `/biz/kinds` and confirm 工单 shows 改行 from `can` (user catalog: 41 kinds with 改行, 6 with 过审, 新建 only 工单).
