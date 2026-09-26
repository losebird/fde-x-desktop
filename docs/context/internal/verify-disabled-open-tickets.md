---
cursor:
  subagentId: "bc-11e36666-bd72-558c-9371-cfed2fc02dd2"
---

# Verify: 停用客户 + 没关工单 现查 vs 业务记录

**hardcoded literals none** (no utterance-specific maps for 停用 / 没关 / 工单 / 客户 / 状态 / 22 / 70 in bind or UI paths).

## Diagnosis (Ace: 右侧 ≠ AI 现查)

| Layer | Finding |
|--------|---------|
| DSH `pendingSheet` (workspace fdex测试) | `kind=工单`, **165 rows**, `speech` = 停用客户还有哪些没关的工单？, emitted `where` = one term: `status/state/stage/状态` **not** ∈ closed set (没关 bound **yes**). **停用 bound no** (no `from`/parent where on sheet). `hopWhere` null. **relation used no** on emitted sheet. |
| Stale UI (70 processing) | `RecordsPanel` kept `kind:工单` snapshot from prior 现查 (`processing` where → **70** rows). `selectKind` / `loadSurface` preferred `sheetSnapshots.kind:工单` over newer `peekBizPendingSheet()`. `ai.tool.finished` only called `rememberBizPendingSheet` + focus — **did not** `applyPendingSheet`. `lan-assist-state-watch` fingerprint ignored **where**, so identical rowCount/firstNo could skip re-emit. |
| Unfiltered / baselines (API `POST /api/v1/biz/preview`, same workspace) | Unfiltered 工单 list response **20 rows** in probe (listed cap in sheet). Explicit `status=processing` → **70**. `客户 status=inactive` → **37**. Intent speech-only preview → **20** rows in probe (not 70; not 165 full list in JSON). |

## Fixes (commit `fbbc1f8f4de2defce72c620fca52ce058fdb31ae`)

1. **`runtime/biz/sheet-fingerprint.mjs`** + **`lan-assist-state-watch`**: pending watch fingerprint includes **list query** (kind, action, where/hopWhere), row bounds, speech slice — generic.
2. **`RecordsPanel`**: on `biz.sheet.pending` remember + apply; on **`ai.tool.finished`** (biz tools) apply `peekBizPendingSheet()` or hydrate; **`selectKind` / `loadSurface`** prefer current pending over same-kind cache; reset applied fingerprint when **query fingerprint** changes.
3. **`dsh-lan-assist/slots.js`** (vocab clues + kind proximity + relations/schema FK): enrich structured preview slots from speech without utterance literals; **`lookup.relatedField`** falls back to collection m2o; **`write.previewStructured`** allows multi-parent **现查** hop (not only single parent).

Overlay copied to `~/.dsh/vendor/dsh-lan-assist/` (runtime `FDE_VENDOR_DIR`).

## Bind status for test utterance (still partial at DSH sheet)

| Slot | Bound on last pending sheet? |
|------|------------------------------|
| 停用 (parent) | **no** — not on sheet; needs `from.kind` + parent where from vocab/graph (enrich path needs full vocab clues in `loadVocab`, not bare `biz/kinds`) |
| 没关 (child) | **yes** — `not: true` on closed enum values |
| 客户↔工单 relation | **no** on emitted sheet (hop not in pending payload) |

## Live proof (automated)

- Unit: `runtime/tests/sheet-fingerprint.test.mjs`, `runtime/tests/slots-enrich.test.mjs` (vendor tree).
- API probe script: `scripts/verify-disabled-open-tickets-live.mjs` — `processingOnly.rows === 70`; intent speech-only **≠** 70 when only processing filter is applied with explicit where.
- **业务记录 panel vs latest 现查**: code path fixed; **现网未测** full Ace flow after deploy (Vite must load `fbbc1f8` RecordsPanel). Reshoot `media/disabled-open-tickets.png`: right panel count must match **current** pending 现查, not previous **70** chip.

## Ace reference screenshot

Store: `media/ace-ai-vs-records.png` (AI narrative vs 工单 70 chip) — documents the bug this commit targets.
