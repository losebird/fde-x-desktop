# Records-close tube @ `dcaf2d7` (scene-39 daily `main`)

**Checkout:** `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**Branch:** `main` · **SHA:** `dcaf2d7e0f2cadda42cf8dd82ce272c152da3ca7` · clean tree

## 1. Git

| Item | Value |
|------|--------|
| `git status` | On branch `main`, nothing to commit, working tree clean |
| `git branch --show-current` | `main` |
| HEAD | `dcaf2d7` — fix(biz): close remaining records valves on one pending tube |

### BO commits (`aa20391`…`dcaf2d7`, `src/` + `runtime/` only)

| SHA | Subject | `src/` / `runtime/` touch |
|-----|---------|---------------------------|
| `aa20391` | close left question after hit-set pick | `RecordsPanel.tsx`, `biz-hit-set-pick-cancel.ts`, test |
| `98af488` | query bound hop step, not unfiltered parent page | `biz-list-query.ts`, `biz-session-sheet.ts`, `RecordsPanel.tsx`, `write.js`, gate overlay, tests |
| `2d62b28` | graph-only kinds; covering GET cannot replace sheet | `connected-kind.ts/.mjs`, `biz.mjs`, tests |
| `19e256f` | only connected tables are preview targets | `connected-kind` (new), `memory-vocab.mjs`, `biz.mjs`, `RecordsPanel`, `biz-list-query`, `runtime-api`, tests |
| `2d4bbac` | empty hop-side view must not hold populated pending | `biz-list-query.ts` (`shouldHoldSideKindView`), test |
| `d7655ee` | connected kinds without in-graph literals; batch words not kinds | `connected-kind.mjs`, `biz.mjs`, `slots.js`, spoken.json, tests |
| `455e6e5` | canonicalize pending sheet kind onto connected table | `connected-kind`, `biz.mjs`, `RecordsPanel`, `runtime-api`, tests |
| `bb12a33` | preview only connector-backed kinds; keep this sheet | `lookup.js`, `gate.js`, `write.js`, `RecordsPanel`, tests |
| `5721789` | cancel write preview restores list sheet | `dismissed-previews.mjs`, `gate.js`, `biz.mjs`, `RecordsPanel`, tests |
| `8096470` | cancel write preview keeps hop list | `connected-kind`, `dismissed-previews`, `gate.js`, `biz.mjs`, `RecordsPanel`, tests |
| `02083e4` | batch 过审 lands on connected matching set | `gate.js`, `lookup.js`, `slots.js`, `write.js`, tests |
| `598f8d7` | write-preview chrome follows this action | `RecordsPanel.tsx` (1 line) |
| `e8ac09f` | kind-label prefix clues do not steal where | `slots.js`, test |
| `dcaf2d7` | close remaining records valves on one pending tube | `biz.mjs`, `lookup.js`, `catalog.js`, `gate.js`, `write.js`, `RecordsPanel`, `biz-session-sheet`, `biz-sheet-display`, `PreviewChangesList`, `BizPreviewDrawer`, tests |

## Tube shape (one pending)

```
Speech → write.preview (enrichStructuredSlots + previewStructured)
      → gate.previewBiz → store.pendingSheet
      → GET /api/v1/biz/pending-sheet (+ canonicalize, sheetAfterCancelCover)
      → RecordsPanel.applyPendingSheet → applySheet
```

Covering valves (same utterance / populated list): `shouldKeepPopulatedListSheet` (gate), `shouldSkipCoveringPending` (BFF + remember), `shouldRejectIncomingCovering` / `shouldRejectEmptyIncomingSheet` (UI).

---

## Case 1 — jitter: 「停用客户还有哪些没关的工单？」→ 工单·现查·21 vs 客户·现查·0

### Intended mid-hop (gate)

- Slot build: `enrichStructuredSlots` adds `from.kind=客户` + 工单 `where` with `not` (`slots-enrich.test.mjs` L131–140).
- Hop start: `firstBoundStepIndex` → first step with `where`/`no` (客户·停用) (`write.js` L280–284, L757–758).
- Forward hop: probe 客户 → link → probe 工单 (`write.js` L820–883).
- Success landing: `finishStructured(..., targetRows, ..., target.kind)` (`write.js` L910–911, L954–969).

### Apply / BFF paths

| Valve | Location |
|-------|----------|
| Gate pending write | `gate.js` L229–243 (`shouldKeepPopulatedListSheet`) |
| BFF GET pending | `biz.mjs` L839–862 (`canonicalizeSheetKind`, `sheetAfterCancelCover`) |
| UI apply fork | `RecordsPanel.tsx` L787–857 (`applyPendingSheet` → `applySheet` L689–741) |
| Empty hold | `biz-list-query.ts` L205–231 (`shouldRejectEmptyIncomingSheet`) |
| Side kind hold | `biz-list-query.ts` L189–201 (`shouldHoldSideKindView`) |

### Why 客户·0 instead of 工单 matching set (still unheld)

1. **Plan sometimes never becomes a 2-step hop** before probe: `preview()` always runs `enrichStructuredSlots` (`write.js` L1118–1142), but model/BFF can supply structured `kind`/`where`/`steps` that collapse to a **single bound step** or target **客户** only → `previewStructured` probes `start.kind` (客户) and `finishStructured` uses that kind with **0 rows** (`write.js` L820–839, L913).
2. **Hop cache can return a partial sheet**: `hopXianchaCache` only checks `hopSheetHasKindHits` via `from.rows` presence (`write.js` L421–426, L1200–1215) — a cached result can omit ticket rows while still being reused.
3. **Backward re-probe can empty ancestor** without aborting to target set: `hitsByKind.set(ancestorKind, [])` (`write.js` L892–894) then `targetRows = hitsByKind.get(target.kind) \|\| matches` (`write.js` L910) — inconsistent rows vs kind if forward hop partially failed.
4. **UI race before kind catalog**: `applyPendingSheet` skips `resolveConnectedKind` when `kindCatalog.length === 0` (`RecordsPanel.tsx` L788–794) — early polls can paint a non-canonical/empty sheet; later catalog load reapplies (`RecordsPanel.tsx` L860–864).

BO tried: bound hop start (`98af488`), connected kind canonicalization (`19e256f`, `455e6e5`, `dcaf2d7`), empty side hold fix (`2d4bbac`). **Still fails** when upstream plan/cache delivers **客户-only 0-row pending** and UI has no “must reach target kind row count” gate.

---

## Closed set 1 — graph-only kinds still previewable

| Mechanism | Cite |
|-----------|------|
| Graph → vocab kinds | `kindsFromGraphNodes` (`write.js` L578–616); loaded via `loadMemoryWorkspaceVocab` (`memory-vocab.mjs` L18–29) |
| Collapse drops non-table resources | `resource: '(in graph)'` not connected (`connected-kind.test.mjs` L20–27) |
| Preview allow when **no** connector catalog | `connectorCatalogPresent` false → `registeredKinds` lists all vocab names (`lookup.js` L278–284, L289–300); `resolveConnectedKind(name, [])` passes name through (`connected-kind.ts` L144–146) |
| Gate refuse when catalog present | `leftoverKindMissingFromCatalog` / `NO_CONNECTOR` (`write.js` L1185–1189); test `empty-resource kind cannot preview` (`leftover-catalog-refuse.test.mjs` L141–157) |
| UI without catalog | `applyPendingSheet` does not reject unknown kinds if `kindCatalog` empty (`RecordsPanel.tsx` L788–794) |

**How graph-only enters preview:** semantic graph nodes become vocab rows (often `resource: '(in graph)'` in fixtures); without live collection stems they stay in gate vocab and can preview when `connectorCatalogPresent` is false; alias fold only when a connected table shares oral/graph alias (`collapseKindsToConnectedTables`, `lookup.js` L115–131).

BO tried: connected-table collapse (`19e256f`, `d7655ee`, `bb12a33`, `dcaf2d7` catalog). **Still fails** when memory graph vocab loads without collection overlay but gate still previews graph concepts.

---

## Closed set 3 — already-at-target 过审 → empty drawer

| Stage | Cite |
|-------|------|
| Gate packs `alreadyAtTarget`, `canWrite: false`, empty `changes` | `write.js` packSheet L192–195, L235; `canWrite` L193–194 |
| UI summary | `buildPreviewSummary` L333–345 (`biz-sheet-display.ts`) |
| Drawer open rule | `shouldOpenWritePreviewDrawer`: opens when **no** confirmable changes if not history-pinned (`RecordsPanel.tsx` L151–158, `sheetHasConfirmablePreviewChanges` → `buildPreviewSummary().changes.length`) |
| Empty UI copy | `BizPreviewDrawer.tsx` L55; `PreviewChangesList.tsx` L10–11 |

**Failure:** drawer still opens on already-at-target (`shouldOpenWritePreviewDrawer` returns true when `!historyPinned` even with 0 changes). `applySheet` still runs for write preview path (`RecordsPanel.tsx` L847, L1086) — list chrome can flip to **过审** while drawer shows empty hint, not “stay on matching-set 现查”.

BO tried: explicit `alreadyAtTarget` + `canWrite false` (`dcaf2d7`, `write-opening.test.mjs` L641–647). **Still fails** on drawer/list coupling, not on token packing.

---

## Closed set 8 — reopen session keeps old kind sheet

| Path | Cite |
|------|------|
| Session-scoped peek (BO) | `peekActivePending` → `peekBizPendingSheet(sid)` (`RecordsPanel.tsx` L306–309, L887–897) |
| Session switch effect | `useEffect` on `activeAiSessionId` (`RecordsPanel.tsx` L885–915) — applies cached pending for new sid or fetches GET with `sessionId`; clears display only when **no** pending and sid mismatch |
| Gate hall | `pendingSheet` in lan-assist store (session on sheet fields, not isolated per-session store in overlay) |
| BFF GET | `biz.mjs` L841–859 |
| Float restore | `displayBeforeWriteRef` + `applyDisplayedSnapshot` (`RecordsPanel.tsx` L298, L583–625, L654–687) |

**Failure:** reopen can still apply **previous session’s** sheet from gate hall / lastEmitted if `getBizPendingSheet` returns a sheet whose `sessionId` does not match but row fingerprint passes; `operationKindViewRef` not reset on session change (`RecordsPanel.tsx` L913 — only cleared in empty branch). `rememberBizPendingSheet` keyed by sheet’s `sessionId` (`biz-session-sheet.ts` L84–94) — stale global gate pending repopulates wrong sid on hydrate (`RecordsPanel.tsx` L931–958).

BO tried: session-scoped peek/clear (`dcaf2d7`). **Still fails** while gate remains single hall + hydrate order applies hall before strict sid guard on every path.

---

## Closed set 9 — empty 现查 / empty 过审 paints over good sheet

### Apply fork (UI vs gate vs BFF)

| Layer | Same speech empty | Different speech empty |
|-------|-------------------|------------------------|
| Gate `shouldKeepPopulatedListSheet` | keep (`gate.js` L167–169) | **replace** 现查 (`gate.js` L172–173) |
| UI `shouldRejectEmptyIncomingSheet` | reject (`biz-list-query.ts` L230–231) | **allow** if `!operationBundlesAlign` (L230) |
| BFF `shouldSkipCoveringPending` | skip emit (`biz.mjs` L923–927) | skip when empty + not catalog dump (`connected-kind.mjs` L284–290) |

Empty **过审** without `preview_id`: UI rejects via L228–229; gate keeps (`gate.js` L165–166). Empty **过审** with token but 0 changes: may still open drawer (set 3).

Direct `applySheet` from manual preview bypasses `shouldRejectIncomingCovering` (`RecordsPanel.tsx` L1086).

BO tried: aligned skip/cover tests (`write-opening.test.mjs` L380–410, L412+), `shouldSkipCoveringPending` (`2d62b28`, `dcaf2d7`). **Still fails** when speech differs slightly or write empty sheet hits gate L172–173 while UI already showed good list.

---

## 7. Architecture constraints in code

- **DSH structured path:** `write.preview` → `recoverWriteIntent` + `enrichStructuredSlots` + `normalizePlan` + `previewStructured` (`write.js` L1062–1204) — not a separate UI parser.
- **BFF bind:** `translateBizIntent` normalizes kind/where/from/steps against collapsed connector kinds (`biz.mjs` L216–270) — refuses disconnected kinds when `vocabExtra.kinds` present (L245–247).
- **Catalog/vocab/graph:** gate `vocabFor` + memory `kindsFromGraphNodes`; `registeredKinds` / `kindPreviewableInCatalog` gate mention parsing (`lookup.js` L250–300).
- **Second recovery path:** `recoverWriteIntent` (`write.js` L1118) alongside model structured slots — same tube, extra enrichment.
- **Hardcoded product heuristics (not schema-driven):** `contactKind` / `orderLike` / `kindForFkName` / `resourceStemOf` (`write.js` L1638–1664); FK stem matching in `slots.js` related kinds.
- **`(in graph)` predicate:** test/fixture resource string only (`connected-kind.test.mjs` L20, `biz-where.test.mjs` L139); production rule is **`isCollectionStem(resource)`** (`lookup.js` L133–135) + `collapseKindsToConnectedTables` — no runtime string match on “(in graph)”.

---

## 8. Smallest generic valve files (rewrite targets, not comment patches)

1. `runtime/vendor-overlays/dsh-lan-assist/write.js` — hop execution, `packSheet`, preview entry, cache  
2. `runtime/vendor-overlays/dsh-lan-assist/gate.js` — `pendingSheet` write, `shouldKeepPopulatedListSheet`  
3. `runtime/vendor-overlays/dsh-lan-assist/lookup.js` — `mapKind`, `registeredKinds`, `kindPreviewableInCatalog`  
4. `runtime/vendor-overlays/dsh-lan-assist/slots.js` — `enrichStructuredSlots`, leftover/catalog bind  
5. `runtime/routes/biz.mjs` — `translateBizIntent`, pending-sheet GET, preview emit skip  
6. `runtime/biz/connected-kind.mjs` + `src/lib/connected-kind.ts` — collapse, skip-covering  
7. `src/lib/biz-list-query.ts` — hold/reject incoming  
8. `src/lib/biz-session-sheet.ts` — remember pending per session  
9. `src/components/biz/RecordsPanel.tsx` — `applyPendingSheet` / session lifecycle  
10. `src/lib/biz-sheet-display.ts` — drawer confirmability vs already-at-target  

---

## BO vs still unheld (summary)

| Item | BO attempted | Still fails because |
|------|----------------|---------------------|
| 1 jitter | Hop bind, canonical kind, session peek | Plan/cache/UI race still lands **客户 0-row** pending; no “target kind must have matching-set rows” invariant |
| 1 graph-only | Connected collapse, leftover refuse, catalog describe | Graph vocab without collection stems still previewable; UI skips kind gate until catalog loads |
| 3 already-at-target | `alreadyAtTarget`, `canWrite false`, empty changes in sheet | Drawer/list still opens **过审** chrome with empty confirm body |
| 8 session reopen | Session-scoped `peekBizPendingSheet`, GET `sessionId` | Single gate hall + hydrate/float paths still apply foreign session sheets |
| 9 empty cover | Gate/BFF/UI skip-covering tests | **Misaligned** empty+speech rules; manual `applySheet`; empty 过审 drawer path |
