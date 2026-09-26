---
cursor:
  subagentId: "bc-241c6293-dec2-5f06-895a-5422a9cf87a3"
---

# Commit `ac3f281` — sheet merge-back audit (read-only)

Repo at `ac3f281be43163320d980a629259df2558015257`. Compared parent GET/SSE/emit paths to resulting code.

## MERGE_BACK

**no** — This commit **removes** multi-source GET/SSE merge paths (parent had `peekLastEmittedPending`, `sheetForPendingGet` hall fallback, `projectWriteConfirm` on served sheet, `lastEmittedPendingBySession` in `emitBizSheetPending`, and post-SSE `hydrateFromPending`). It does not reintroduce them.

## Forbidden items (resulting tree)

| Item | Status | Decisive location |
|------|--------|-------------------|
| GET `/api/v1/biz/pending-sheet` merging `officialRoundSheet` + `lastEmitted` / hall via `sheetForOfficialGet` / `sheetForPendingGet` | **GONE** | `runtime/routes/biz.mjs` `handleBizRoutes` GET branch: `const served = sheetForOfficialGet(handed, null, querySessionId)` (L886); no `state.pendingSheet` fallback, no `peekLastEmittedPending`. Merge helpers remain unused by routes: `sheetForPendingGet` only in `runtime/biz/connected-kind.mjs:412` + tests. |
| `projectWriteConfirm` merged into right-rail `data.sheet` | **GONE** | `runtime/routes/biz.mjs:emitBizSheetPending` L318–337: `payloadSheet` is normalized sheet only; `writePreview` on event separately. `runtime/lan-assist-state-watch.mjs:officialFromState` L66 returns dismissed official only (no `projectWriteConfirm`). Symbol lives in `runtime/biz/write-confirm.mjs:33` (tests only). |
| `emitBizSheetPending` using `lastEmitted` map / hall merge | **GONE** | `runtime/routes/biz.mjs:emitBizSheetPending` L305–343: no `lastEmittedPendingBySession`, no `shouldSkipCoveringPending` vs hall/last. Dead arg: `recordSurfaceFromPreview` L367 still passes `hallSheet` but emit ignores it. |
| RecordsPanel: after SSE `biz.sheet.pending`, `hydrateFromPending` GET overwrites SSE sheet | **GONE** | `src/components/biz/RecordsPanel.tsx` SSE handler L1256–1263: `applyPendingSheet(stamped)` only; parent had `void hydrateFromPendingRef.current(incomingSurfaceId)` at ~L1249 (removed). |
| `rememberBizPendingSheet` holding side-kind as second sheet alongside main | **PARTIAL** | Single map `src/lib/biz-session-sheet.ts:rememberBizPendingSheet` L87–108. SSE L1256 calls `rememberBizPendingSheet` before `applyPendingSheet`; L1038–1044 `shouldHoldSideKindView` can block paint but cache may still take incoming side kind. Display still split: `listSheetMeta` + `operationKindViewRef` (L390, L1038). Commit stopped remembering on hold path (L1044 `return false` vs parent remember+return true). |
| `peekLastEmittedPending`, `lastEmittedPendingBySession`, `releaseLastEmittedConfirm` as authority | **GONE** | Absent from `runtime/routes/biz.mjs` and all `*.mjs`/`*.ts`/`*.tsx` runtime+src (only `lastEmitted` param names in `connected-kind.mjs` helpers + docs). |

## Symbols still in repo (not route authority)

- `shouldSkipCoveringPending`: `runtime/biz/connected-kind.mjs:357`, `src/lib/connected-kind.ts:291`, frontend apply/cache (`RecordsPanel.tsx:1032`, `biz-session-sheet.ts:100`).
- `sheetAfterCancelCover` / `sheetForPendingGet` / `sheetForOfficialGet`: `connected-kind.mjs` L388–462; GET uses official + `lastEmitted=null` only.
- `hydrateFromPending`: `RecordsPanel.tsx:1121` — cache then GET (mount/surfaces/empty SSE), not after full-sheet SSE.

## Functions that still combine two sheet-related sources for the right rail

1. **`hydrateFromPending`** (`RecordsPanel.tsx:1130–1139`) — `peekBizPendingSheet` then `getBizPendingSheet`; may `rememberBizPendingSheet` + `tryApply` GET sheet (sequential authorities, not official+lastEmitted merge).
2. **Session mount effect** (`RecordsPanel.tsx:1175–1196`) — apply cache then async GET + `applyPendingSheetRef`.
3. **`coalesceKnownHitTotal`** (`src/lib/biz-list-query.ts:279`) — merges hit-total metadata from anchor/peers into view rows for footer; not BFF dual-sheet merge.
4. **`runPreview` `bindSheet`** (`RecordsPanel.tsx:1307–1309`) — `{ ...pendingSheet, ...listSheetMeta }` for preview request body, not GET/SSE merge.

No production caller passes non-null `lastEmitted` into `sheetForOfficialGet` after this commit.

---

## Q2: semantic / handbook / KB / workflow modules

**UNTOUCHED** — Commit name-status is only the 11 biz/lan-assist/records files listed in the assignment. No paths under semantic graph, handbook/manual, knowledge base, or workflow/process product modules.

Diff keyword scan: only incidental identifiers `processOfficialSheet` (`runtime/lan-assist-state-watch.mjs:97`) and `process: true` (`runtime/vendor-overlays/dsh-lan-assist/session-round.js` round flags), not workflow/knowledge/semantic product code.

| Area | Status |
|------|--------|
| Semantic graph | UNTOUCHED (no matching files in commit) |
| Handbook / manual | UNTOUCHED |
| Knowledge base | UNTOUCHED |
| Workflow / process modules | UNTOUCHED (incidental `process*` names in lan-assist watch/round only) |
