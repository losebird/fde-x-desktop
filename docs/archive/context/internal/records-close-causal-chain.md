---
cursor:
  subagentId: "bc-41293846-e0c1-578b-ad3b-fac83a7baa04"
---

# Records-close causal chain: slowness + hop in complex context

Read-only. Product SHA `451889f`. No prompt/turn id exists on the pending tube.

## 1. Skip vs replace — keyed on model-emitted sheet fields, not human prompt/turn

There is **no** prompt id or turn id in skip/replace. Compare two sheets' `speech` / `kind` / `action` / `rows` / `preview_id` / `picked`.

`speech` on the sheet is whatever the gate stamped from `spec.speech` (tool arg after `pickHopSpeech`, else last user line), not a FDE prompt identity.

### Gate (hall write)

`runtime/vendor-overlays/dsh-lan-assist/gate.js`

- `shouldKeepPopulatedListSheet` **177–235**: leftover 现查 covering write **211**; `newUtterance` **212–221** (new `speech` string, or new `kind`/`action` with `nextRows > 0`, not catalog dump); empty cover **222**; picked-write cover **223–225**; waiting-hit unpicked preview **226**.
- Apply points: 现查/miss/waitingPick **298**; write **323**. Incoming speech stamped **286 / 319** from `sheetSrc.speech || spec.speech || spec.quote`.

### BFF + UI (same predicate)

`runtime/biz/connected-kind.mjs`

- `leftoverQueryCoveringWrite` **312–327** (prev write + incoming 现查, same kind, nos overlap or speech contains prev no).
- `isNewSpokenUtterance` **330–342** (dump/empty excluded; else new speech string **or** kind/action changed with rows).
- `shouldSkipCoveringPending` **344–367**: leftover 现查 first; new utterance → do not skip; leftover same-speech / dump / empty otherwise.
- GET composition: `sheetAfterCancelCover` **370–379**; `sheetForPendingGet` **394–408** (`shouldSkipCoveringPending(namedLast, covered)` **405**).

Callers:

- emit skip `runtime/routes/biz.mjs` **312 / 314**
- POST `/preview` `skipEmit` **923–926**
- UI `src/components/biz/RecordsPanel.tsx` `applyPendingSheet` **831**
- remember `src/lib/biz-session-sheet.ts` **98**
- TS twin `src/lib/connected-kind.ts` `isNewSpokenUtterance` **257**; `shouldSkipCoveringPending` **275**

`lastEmitted` is keyed by **sessionId** (`lastEmittedSessionKey` `runtime/routes/biz.mjs` **297–300**, map **295**), not turn.

**Causal for complex context:** a leftover 现查 with rows + a different `kind`/`action` (or a different `speech` string the gate stamped) is classified as `newUtterance` and **replaces** pending. A catalog page of 20 (`PAGE_SIZE` `runtime/vendor-overlays/dsh-lan-assist/plan.js` **8**) with stamped speech is not `isConnectorCatalogDump` (`connected-kind.mjs` **260–274** requires empty speech). That is how a hop 工单 can lose to 供应商×20 without any human-turn key.

## 2. Hop leaf — speech string after pickHopSpeech, then model `spec.kind`

Hop does **not** read the last preview sheet as the hop target. It builds `plan.steps` from **this preview spec**. The speech used for mentions is **not guaranteed to be this human utterance**.

### Speech that hop sees

`runtime/vendor-overlays/dsh-lan-assist/tools.js` `biz_preview` **193–224**:

- `speech: args.speech || args.quote || lastUserSpeech(exec)` **222**
- `userSpeech: lastUserSpeech(exec)` **223**
- empty speech → **会话上一句** (`lastUserSpeech` **22–52**: `recalledUserSpeech(sessionId)` then walk `session.events` last `user/message`; cache `rememberUserSpeech` `slots.js` **576–589**, one string per session, cap 32)

`runtime/vendor-overlays/dsh-lan-assist/write.js` `preview` **1104–1106**: `pickHopSpeech(spec.speech, userSpeech, vocab, extra)` (`slots.js` **561–571**). Picks **user** only if user has **more** `relatedMentionedKinds(...).related` than the model string; else **model speech**.

Hop-cache speech `write.js` **1202–1211**: if `plan.speech` has ≥2 related mentions, use it; else fall back to `userSpeech` / remembered hop. Cache key `sessionId \0 workspace \0 speech \0 现查` **24–26**. `hopSheetHasKindHits` **422–427** is **any rows > 0** (does not require the hop leaf kind). Same session + same speech returns the leftover 现查.

### Leaf + graph

`slots.js`:

- `relatedMentionedKinds` **510–558**: `kindMentions(speech)` then largest undirected component via `graphNeighbors`.
- `relationsFromVocab` **368–382**: `vocab[i].relations` **and** `extra.relations`.
- `graphNeighbors` **391–413**: those relations plus collection FK (`schemaRelatedField`) if `extra.collections` exists.
- `relatedMentionedHopLeaf` **257–299**: needs `related.length >= 2`; DAG leaf among mentions (else deepest `relatedKindChain`).
- `enrichStructuredSlots` **984–1026**: requires **both** `speech` and `spec.kind` **988**; `targetKind = hopLeaf || remapEnrichTargetKind(spec.kind, speech)` **997–998**; chain → `steps`. If hopLeaf empty, **model `kind` stays**.
- `relatedKindChain` **420–507**: mentions ∪ target, topo toward target.

`write.js` enrich bag **1098–1103** is `{ vocab, collections? }` — **does not pass catalog `data.relations`**. Edges used in hop are **vocab row `.relations`** (graph concepts `kindsFromGraphNodes` **611–612**) plus **collection FK**. BFF catalog `data.relations` (`runtime/routes/biz.mjs` **556 / 589–591**, `memory-vocab.mjs` **30–33**) is a parallel slice, not the hop extra.

Plan comment: `plan.js` **2** 「speech is evidence only」. Probe uses `plan.steps`, and hop probes pass `speech: ''` (`write.js` **833, 870, 904**).

### Where the walk starts

`firstBoundStepIndex` `write.js` **282–286**: first step with `no` or non-empty `where`, else **0**.

`previewStructured` **757–919**: `start = steps[probeIndex]`, `target = steps[targetIndex]` (collapsed last step **1185**). Probe start kind **828**. Multi-step hop **850–917**; miss → empty sheet of **hopKind** **878–882**. `targetIndex` last after collapse **1169–1186**. If enrich never built ≥2 steps, single-kind probe of **model kind** → unfiltered `:list?pageSize=20` (`lookup.js` **659**, `plan.js` **8**).

**Causal for hop errors in complex context:** one DSH session accumulates user lines + leftover `biz_preview` (`isConcurrencySafe: true` `tools.js` **214**). Hop leaf is computed on `pickHopSpeech(model speech, last user line)`, not on “this prompt id”. Model `kind` wins when mentions < 2. Cache can replay a previous 现查 for the same session+speech even if this call’s `kind` differed. Gate then treats that 20-row other-kind 现查 as a new utterance (section 1) and the right table is not the hop leaf.

## 3. 「深度求索中」— DSH open turn on that session

Not FDE-X copy. DSH chat i18n `chat.deepDiving` = `深度求索中...`  
`~/.dsh/profiles/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js` **2641**.

Shown when **this session** `useSession(s => s.running)` is true (**2081**, render **2553–2556**). Clock after 15s **2050**. `runningTurnStartTime` uses `timeline.turns` with `status === "open"` **2030–2033**.

So the iframe shows 深度求索中 for the **whole open model turn** (first token, tools, stream) until the turn closes. Product does not key this on pending-sheet skip.

What keeps the turn open / slow in this tube:

1. **Session reuse** — one `sessionId` for the whole records-close run; `lastSpeechBySession` and `hopXianchaCache` are per session (`slots.js` **574–581**, `write.js` **21–26, 1200–1225**). Next human line does not start a new hop cache or skip key.
2. **Leftover tool retries** — `biz_preview` concurrent (`tools.js` **214**). Skip/keep at gate **298/323** still returns 200 with the **old** hall sheet (`gate.js` **325–326**), so the model keeps calling. Hit-set cancel only aborts DSH after a **write** preview (`src/lib/biz-hit-set-pick-cancel.ts` **1–12**; `RecordsPanel.tsx` **855**). 现查 leftovers do not cancel the running turn.
3. **Catalog dump each shot** — unfiltered list is `pageSize=20` (`plan.js` **8**, `lookup.js` **659**). Dump detector (`connected-kind.mjs` **260–274**) is 现查, no preview_id, **no speech**, no where/hop/from/steps. Gate stamps speech **286**, so many dumps are **not** dumps; skipCover then either keeps (leftover covering write) or **replaces** (new kind+action with 20 rows). Each such preview is another tool on the still-`running` turn.

Harness only **observes** the string (`verify-records-close-bu.mjs` `iframeBlob` / `still-thinking` when `/深度求索中/` and pending identity unchanged).
