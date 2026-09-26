---
cursor:
  subagentId: "bc-f0ff42ec-3d62-5f47-a67e-4b7fbd099cba"
---

# Why live BFF has 0 `客户↔工单` rows in `data.relations`

**Workspace:** `/Users/zxz/Documents/ai-project/fdex测试`  
**Prior:** [`records-close-customer-zero-cause.md`](records-close-customer-zero-cause.md) (hop gates off when `related.length < 2`)  
**Measured:** `GET http://127.0.0.1:4318/api/v1/biz/kinds?cwd=…` (2026-09-21); parse `fdex测试/.dsh/semantic-os/graph.json`; BO ticket row blobs in `verify-records-close-bo.json`.

## Causal chain

1. **Runtime rows** on collection **`biz_tickets`** (kind **`工单`**) carry association payload **`customer`** + **`customerId`** on live probes (e.g. `TK20260105702` blob in `verify-records-close-bo.json`) — data behaves like ticket → customer FK.
2. **Published graph** stores join metadata only on `skos:Concept.properties.relations[]`, not on OWL `edges[]`. The **`#ticket`** concept (`resource: biz_tickets`) has **`relations: null`** and a trimmed **`fields`** list (`单号`, `状态` only); **`#customer`** (`biz_customers`) also has **`relations: null`** (`graph.json` parse).
3. **`loadMemoryWorkspaceVocab`** flattens those embedded arrays into top-level **`relations`** (`memory-vocab.mjs:30–43`, `63`) — **no filter** that would drop a 客户–工单 pair if it were on disk.
4. Across **85** deduped concept relations in `graph.json`, the only ticket/customer-adjacent hops are **`客户 → {销售商机,销售合同,销售回款}`** (`field: customer`) and **`工单 → 工单处理记录`** (`field: ticket`). **Zero** rows with endpoints **`客户`↔`工单`** or **`客户`↔`工单处理记录`** (live BFF count + graph scan agree).
5. **`GET /api/v1/biz/kinds`** sets **`data.relations`** from **memory** when non-empty (`biz.mjs:589–591`, `dcaf2d7` same). **`collapseKindsToConnectedTables`** affects **`kinds`** / aliases only — **not** the relations list (`memory-vocab.mjs:59–63`). So BFF is **faithfully replaying a missing publish fact**, not collapsing it away.
6. **OWL / skos graph edges** (`skos:exactMatch` `#class-工单`→`#ticket`, `#class-客户`→`#customer`; `hasTopConcept`) do **not** feed `data.relations` — only **`properties.relations`** on concepts do (`memory-vocab.mjs:32–43`).
7. **Intended producer** for those arrays is **`buildVocabFromNocoCollections`** (`nocobase-vocab.mjs:144–163`) via **`generateWorkspaceVocabFromConnector`** → semantic graph persist (`vocab-from-connector.mjs`; see `internal/wave-fix-vocab-relations-gen.md`). That path emits `{ from: parentTitle, to: childTitle, field }` only when a collection field’s **`interface`** matches **`m2o|belongsTo|…`** and **`target`** resolves in the collection map (`nocobase-vocab.mjs:6–7`, `144–162`).
8. **Fixture tests** bypass publish: `slots-enrich.test.mjs` **hand-embeds** `{ from: '客户', to: '工单', field: 'customer' }` on the **`工单`** vocab row (`L67–78`) — that edge **never appears** in live `graph.json`, hence **not** in BFF `data.relations`.

---

## 1. Schema / connector (measured + graph cite)

| Item | Evidence |
|------|----------|
| Ticket collection | `skos:Concept` `…#ticket` · `resource: "biz_tickets"` · label/content **工单** (`graph.json` ~L260–268) |
| Customer collection | `…#customer` · `resource: "biz_customers"` · **客户** (`graph.json` ~L3641–3649) |
| Row-level FK shape | Live `biz_write` / lookup blobs: `fields.customer` (name) + `fields.customerId` (id) on **`biz_tickets`** rows (`verify-records-close-bo.json`, case 2 tool blobs) |
| Published vocab field list | Graph concept **`#ticket`** only lists **`单号`, `状态`** — association columns not in published `fields` (`graph.json` ~L548–551) |
| Direct Noco `collections:list` | `http://127.0.0.1:13000` → **401** in this environment — **no** live schema JSON quoted here |

**Conclusion (measured):** Business data uses a **customer association on `biz_tickets`**, but the **published skos concept for tickets does not include a `relations[]` entry** (nor full field metadata) for that link. We did **not** invent a `{ from, to, field }` edge in BFF.

---

## 2. Graph / vocab triples

| Store | 客户 ↔ 工单? |
|-------|----------------|
| `skos:Concept.properties.relations` | **No** pair. Ticket concept: **none**. Customer concept: **none**. |
| Same file, other concepts | `销售商机` / `销售合同` / `销售回款` each embed `{ from: "客户", to: <kind>, field: "customer" }` (`graph.json` ~L8194–8198, ~L8582–8634) |
| Ticket log bridge | `{ from: "工单", to: "工单处理记录", field: "ticket" }` on **`#biz-ticket-logs`** (~L9183–9187) — **not** 客户 |
| `graph.json` `edges[]` | **OWL/SKOS wiring** (`hasTopConcept`, `skos:exactMatch`, `rdfs:domain`/`range`) — **not** copied into BFF `relations` |

There is **no** stored triple of the form **`客户 —[customer]→ 工单`** in the vocab relation arrays that BFF reads.

---

## 3. Publish path (who builds `data.relations`)

```
GET /api/v1/biz/kinds
  → lanAssist('/catalog') → mapKindsFromCatalog (catalog relations usually [])
  → loadMemoryWorkspaceVocab → list_graph_nodes(skos:Concept)
       → kindsFromGraphNodes (write.js:577–615) copies properties.relations per concept
       → dedupe → relations[]
  → mergeConnectedKindCatalog (biz.mjs:561–593)
       → kinds: collapseKindsToConnectedTables
       → relations: memoryData.relations if length (else catalog)
```

| Question | Answer |
|----------|--------|
| Drop when endpoint not in 21 connected kinds? | **No** for `data.relations` — list is **not** re-filtered by collapse; live payload has **40** kinds and **85** relations. |
| Drop `工单` vs `工单处理记录`? | **Rename/collapse** applies to **kind rows** (`工单处理记录` table keeps alias **工单日志**, not short **工单** — `inspect-connected-kinds.md`). Relations use label **工单** only on **`工单→工单处理记录`**, not on customer link. |
| Overlay | Gate/runtime **`slots.js`** reads `extra.relations` from BFF payload; it does not add missing publish edges. |

---

## 4. Live counts and neighbors (2026-09-21)

**`data.relations`:** 85 total.

| Endpoint | Neighbors (unique `from`/`to` other end) |
|----------|------------------------------------------|
| **客户** | 销售合同, 销售商机, 销售回款 |
| **工单** | 工单处理记录 |
| **工单处理记录** | {{t("Users")}}, 工单 |

**Pairs involving (客户, 工单) or (客户, 工单处理记录):** **0**.

**Per-kind `relations` on BFF row:** `客户` → `[]`, `工单` → `[]` (embedded arrays not re-attached on collapsed kind rows).

---

## 5. Fixture vs live

| | Fixture (`slots-enrich.test.mjs`) | Live (`graph.json` + BFF) |
|--|-----------------------------------|---------------------------|
| Edge | Manual `relations: [{ from: '客户', to: '工单', field: 'customer' }]` on vocab row | **Absent** from all concept `relations` |
| Mechanism | In-memory test `vocab` array | `generateWorkspaceVocabFromConnector` / graph persist + `memory-vocab` flatten |
| Gap type | **Generation / publish omission** (ticket concept never got the Noco-derived relation), **not** BFF dropping an existing 客户–工单 row | |
| Related rename | Tests use short kind **工单** aligned with `biz_tickets` | Live has separate **工单处理记录** (`biz_ticket_logs`) with **工单→工单处理记录** only |

**Not claimed:** exact Noco `interface` string for the ticket `customer` field (schema API unauthenticated here). **Claimed:** publish artifact lacks the relation; connector row shape + other collections’ `customer` relations show the generator **does** emit `客户` parent links for some tables, but **not** for **`biz_tickets`**.

---

## Cross-links

- Hop impact: [`records-close-customer-zero-cause.md`](records-close-customer-zero-cause.md) §2–3  
- Connector generate entry: `internal/wave-fix-vocab-relations-gen.md`  
- Kind/alias split: `internal/inspect-connected-kinds.md`
