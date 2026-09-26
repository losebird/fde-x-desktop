---
cursor:
  subagentId: "bc-f0ff42ec-3d62-5f47-a67e-4b7fbd099cba"
---

# BO case 1 @ `dcaf2d7` — why pending became `客户 · 现查 · 0`

**Speech (measured):** `停用客户还有哪些没关的工单？`  
**SHA:** `dcaf2d7e0f2cadda42cf8dd82ce272c152da3ca7` · scene-39 `main` (read via `git show dcaf2d7:…`, no checkout)  
**Evidence:** `internal/verify-records-close-bo.json` case `n:1`; live replay `node` + `GET /api/v1/biz/kinds?cwd=fdex测试` (2026-09-21).

## Causal chain (ordered)

1. **DSH structured preview** enters `write.preview` → `recoverWriteIntent` + `enrichStructuredSlots` + `normalizePlan` + `previewStructured` (`write.js:1062–1204`, `plan.js:116–138`).
2. **Model/BFF slots often anchor on spoken head noun** `客户` (`kind: "客户"`, `action: "现查"`). At `dcaf2d7`, `remapEnrichTargetKind` does **not** retarget because `客户` is already in `kindMentions` (`slots.js:253–258`, `948`); there is **no** `relatedMentionedHopLeaf` yet on this SHA (contrast `21d0141`).
3. **Hop synthesis is gated off:** live BFF has **0** `客户↔工单` rows in `data.relations` and none on the kind rows; `relatedMentionedKinds` yields `mentioned: [客户, 工单]` but `related: [客户]` only (`slots.js:461–509`). Product `hopSpeech` requires `related.length >= 2` (`write.js:1195–1199`), matching BO `hopNeed: false` — **not** a script invention (`verify-records-close-bo.mjs:970–972` mirrors `slots.js`).
4. **`relatedKindChain` stays singleton** (`[客户]` or `[工单]` only; live replay), so `enrichStructuredSlots` never builds `steps.length >= 2` (`slots.js:950–977`). `normalizePlan` collapses to **one step** `{ kind: 客户 }` unless the model supplies `steps`/`from` (`plan.js:66–110`, `116–122`). Case 1 pending has `steps: []`, `hopWhere: false` — **no hop metadata** on the packed sheet (`packSheet` `write.js:228–231`).
5. **`previewStructured` non-hop branch** probes only `start.kind` (客户) via `firstBoundStepIndex` (`write.js:280–284`, `757–758`, `820–830`, **913**). It does **not** walk to `工单` without `plan.steps.length > 1` (`write.js:844–911`). Spoken `工单` is **not** a `kindMentions` token for connected table `工单处理记录` (`inspect-connected-kinds.md`); utterance hits graph kind row `工单`, not the log table alias.
6. **Empty sheet packing:** probe returns **0** `matches` (or `NOT_FOUND` with `sheet` — `missSheet` path). `finishStructured` / refuse wrapper calls `withSheet` → **`packSheet`** with `matches: []` → `rows: []`, and `sheetWhereFromPlan` emits **no** `where` when the single plan step has no bound terms (`write.js:72–97`, `296–305`, `831–838`, `954–965`; measured pending `where: []`). This is **structured filtered probe**, not `listAll` / catalog page-1 (~20 rows). **Not** `NO_CONNECTOR` on this run (`preview_id: null`, both kinds map to `biz_customers` / `biz_tickets` in live kinds). **Not** UI `applyPendingSheet` emptying a good sheet first — gate hall write happens before UI (`gate.js:224–243`).
7. **Pending author:** `gate.previewBiz` always materializes `现查` / `missSheet` into **`s.pendingSheet`** from `preview.sheet` unless `shouldKeepPopulatedListSheet` blocks an empty cover (`gate.js:219–243`, `161–165`). Case 1 is **empty-on-empty** (or first paint), so the valve opens and the hall holds `客户 · 0`.
8. **Same-SHA jitter `工单·21` ↔ `客户·0` (valve, not flake):** alternate **model structured `kind`** (`工单` → single-step `biz_tickets` probe ≈21 rows) vs **`客户`** (step 6). When the model **does** emit `steps: [客户, 工单]`, `plan.steps.length >= 2` enables hop + **`hopXianchaCache`** (`write.js:1200–1215`, key `write.js:24–25`, weak hit test `hopSheetHasKindHits` `421–426`). BO case 2 same run shows catalog did not drop `工单` (8-row hop). `shouldKeepPopulatedListSheet` / `shouldRejectEmptyIncomingSheet` only block **empty-over-populated**, not wrong-kind landing (`gate.js:161–165`; `biz-list-query.ts:205–229`).

## 1. Why target kind became `客户`

| Mechanism | `dcaf2d7` cite |
|-----------|----------------|
| Greedy `kindMentions` | `slots.js:177–226` — hits `客户` + graph kind `工单` on live vocab (40 kinds). |
| `remapEnrichTargetKind` | `slots.js:253–274` — **no remap** when `specKind` is already mentioned (`258`). |
| `enrichStructuredSlots` target | `slots.js:935–948` — keeps model `kind` when chain hop not built. |
| `normalizePlan` | `plan.js:116–122` — `defaultSteps` one row when no `from`/`steps`. |
| BFF collapse | `write.js:1150–1179` — `resolveConnectedKindName` keeps `客户` on `biz_customers` (not ticket log). |

**Worker guess vs measured:** Measured pending `kind: "客户"` + BO `mentioned` includes both labels. **Guess (unproven for this exact tool payload):** model structured slot `kind: "客户"` on ancestor-first phrasing; would need `ai.tool.*` envelope capture to cite.

## 2. Why hop did not emit `客户 → 工单`

| Mechanism | Cite |
|-----------|------|
| `relatedMentionedKinds` component size | `slots.js:461–509` — `工单` mentioned but not in largest **edge-connected** mention component without `客户↔工单` relation (live: **0** edges). |
| `hopSpeech` / cache eligibility | `write.js:1195–1199` — requires `related.length >= 2`. |
| `relatedKindChain` | `slots.js:420–458` — BFS only through co-mentioned neighbors; stays length 1 live. |
| `工单` token vs catalog | `inspect-connected-kinds.md` — short `工单` ∉ `工单处理记录` suffix/alias tokens; hop FK uses kind row `工单` when model supplies steps (case 2). |
| BO `hopNeed` | `verify-records-close-bo.mjs:970–972` — **product-side rule**, script re-exports `relatedMentionedKinds`. |

Fixture contrast: `slots-enrich.test.mjs:67–90` embeds `relations: [{ from: '客户', to: '工单' }]` — tests pass; **live BFF relation list does not**.

## 3. Why `rows=0`, `where=[]` (not ~20 directory rows)

| Ruled out | Why |
|-----------|-----|
| `NO_CONNECTOR` refuse | Live `mapKind('客户')` → `biz_customers`; case 1 not connector-refused. |
| `listAll` / catalog dump | `previewStructured` uses `probe` with `structured: true` (`write.js:820–829`), not unpaged catalog. |
| `hopXianchaCache` reuse | Case 1 sheet has no hop; cache only set when `plan.steps.length >= 2` (`write.js:1205–1215`). |
| UI apply emptied good sheet | Pending written in `gate.previewBiz` (`gate.js:229–243`); case 1 `rows:0` already in hall. |

**Pack writer:** `packSheet` (`write.js:72–97`, `212–231`) from `withSheet` (`write.js:429–441`) inside `previewStructured` / `finishStructured` (`write.js:916–969`). Empty `matches` → `rows: []`; missing plan `where` → `where` omitted (`write.js:229`).

## 4. Jitter valve (same SHA)

| Outcome | Valve |
|---------|--------|
| `工单 · 21` | Model/enrich target `工单` + ticket `where` (口语 `没关` → `not` on status) → single-step `biz_tickets` probe (`write.js:913`, `slots-enrich.test.mjs:93–100`). |
| `客户 · 0` | Model target `客户` + no 2-step plan → customer probe with no/effective-empty row set (`write.js:913`, `831–838`). |
| Case 2 same run | Model supplied hop `steps: [客户, 工单]` (`verify-records-close-bo.json` `n:2`) — hop path (`write.js:844–911`). |
| Cache | `hopXianchaCache` + `hopSheetHasKindHits` (`write.js:22–33`, `421–426`, `1200–1215`) — can reuse partial hop sheets when multi-step path runs; does not explain case 1 single-step pending. |
| Cover | `shouldKeepPopulatedListSheet` (`gate.js:161–165`) — blocks empty replace only when prior pending had rows. |

## 5. Script vs product (`related` / `mentioned` / `hopNeed`)

- **`mentioned` / `related` / `hopNeed` in BO JSON:** computed in `verify-records-close-bo.mjs` with the same `kindMentions` / `relatedMentionedKinds` imports as gate (`mjs:15–18`, `1439–1449`, `970–972`) on BFF `kinds` + `relations` — **diagnostic mirror**, not a second hop engine.
- **Separate script heuristic:** `connectedKindForSpeech` token fallback (`mjs:470–483`) — used for drift helpers, **not** for `hopNeed`.

## Replay (read-only, no product writes)

```text
# Live kinds + slots.js @ scene-39 tree (behavior matches dcaf2d7 hop gates; hopLeaf added later)
mentions → [ '客户', '工单' ]
relatedMentionedKinds → { mentioned: [ '客户', '工单' ], related: [ '客户' ] }
relatedKindChain('客户') → [ '客户' ]
enrichStructuredSlots({ kind: '客户', ... }) → kind 客户, no steps[] (chain < 2)
BFF relations 客户↔工单 → 0 rows
```

## Cross-links

- Tube map: `internal/records-close-tube-dcaf2d7-audit.md` § Case 1  
- Kinds/relations: `internal/inspect-connected-kinds.md`  
- Measured BO: `internal/verify-records-close-bo.json` `cases[0]`
