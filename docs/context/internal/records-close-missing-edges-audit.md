---
cursor:
  subagentId: "bc-4cf596a8-c0b0-5434-96a1-8e9d1d758372"
---

# Live associations vs graph/BFF relations (fdex测试)

**Git toplevel used:** `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**SHA:** `bca5c093989e357b8e572d555d3127da983611da` · branch `cursor/generic-schema-edges-8372`  
**Workspace:** `/Users/zxz/Documents/ai-project/fdex测试`  
**Connector:** NocoBase `127.0.0.1:13000` (one adapter). Product code not given a 客户-工单 / `biz_tickets` map.

## Live schema (postgres `collections` + `fields`, 2026-09-21)

| Item | Count |
|------|-------|
| Collections in catalog | **40** |
| Association-like fields (`target` or relation type/interface) | **237** |
| Skip `createdBy`/`updatedBy` | **78** |
| Target not in the 40-collection catalog (`uiSchemas`, `desktopRoutes`, `aiEmployees`, …) | **6** |
| Resolvable catalog associations → unique `{from,to,field}` | **153** |

**客户↔工单 (real column names):**

- `biz_tickets.customer` · interface `m2o` · type `belongsTo` · target `biz_customers`
- `biz_customers.tickets` · interface `o2m` · type `hasMany` · target `biz_tickets`

No live field with a resolvable `target` was dropped for lacking `m2o`/`belongsTo` in an allowlist (`no-iface` = 0).

## Graph vs BFF after re-publish

| Store | Relations | 客户↔工单 |
|-------|-----------|-----------|
| Prior audit (`records-close-missing-customer-ticket-edge.md`) | 85 | **0** |
| `GET :4318/api/v1/biz/kinds` before this persist | 153 | 2 (`customer`, `tickets`) |
| New adapter generate (`relationCount`) | 153 | 2 (`customer`, `tickets`) |
| BFF after persist | **153** | **2** (`customer`, `tickets`) |
| `graph.json` unique flatten | 153 | same 2; `#biz-tickets.customer` + `#biz-customers.tickets` |

**missing → present:** catalog-resolvable pairs **0 missing** (153/153). Spoken pair **客户↔工单 0 → 2** vs the prior BFF measurement (this workspace already had both after an earlier generate; this pass kept them and wrote through the generic valve). Duplicate leftover concepts `#ticket` / `#customer` still exist; canonical `#biz-*` rows carry the full `relations[]`.

## Valve fix (scene-39 only)

- `runtime/biz/adapters/nocobase-vocab.mjs`: publish when `field.target` or `options.target` resolves in the connected catalog. Type/interface only pick direction.
- `runtime/biz/vocab-from-connector.mjs`: on `NOT_A_KIND`, retry keeping ticketField + association column names (no `金额` literal strip list).
- Tests: `node --test runtime/tests/vocab-from-connector.test.mjs` → **9 pass**.

**4318 process caveat:** `POST /api/v1/biz/vocab/generate` on the already-running 4318 still returned **503 `NOT_A_KIND`** (old module graph). Re-publish used current checkout `generateWorkspaceVocabFromConnector` + persist through `4318 /semantic-os/api/vocabulary/concepts`. Hop reads the graph, so 4318 preview is current. Reload 4318 later to pick up generate.

## Preview-only hop

Speech: `停用客户还有哪些没关的工单？` · `POST /api/v1/biz/preview` · **no `biz_write`**.

| Check | Result |
|-------|--------|
| `relatedMentionedKinds` | `{ related: [客户, 工单] }`, hopNeed true |
| enrich | kind **工单**, steps `[客户, 工单]`, from 客户 `status=inactive/停用`, 工单 `status not closed…` |
| pending | kind **工单** · 现查 · **21** rows · `canWrite: false` · no preview_id |
| FK | hop field **`customer`** (ticket column), parent rows all `inactive` |

## Hardcode proof

`rg '客户|工单|biz_tickets|biz_customers' runtime/biz/adapters/nocobase-vocab.mjs runtime/biz/vocab-from-connector.mjs` → **no matches**. Overlay was not given a pair/kind map.

Human path (save connector / 知识分类 / graph.json) unchanged; `docs/records-close-human-edge-patch.md` only dropped the “must be m2o allowlist” prerequisite.
