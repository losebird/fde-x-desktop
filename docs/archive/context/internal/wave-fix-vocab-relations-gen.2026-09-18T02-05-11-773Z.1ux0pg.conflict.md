---
cursor:
  subagentId: "bc-a6a99fcc-185e-5301-a46b-5924939621a0"
---

# wave-fix-vocab-relations-gen

## SHA (scene-39 `main`)

`3d51815` — `feat(biz): generate workspace vocab and relations from connector schema` (local commit; no `origin` remote in this checkout).

## Generic entrypoint

| Surface | What to call |
|---|---|
| **Library** | `generateWorkspaceVocabFromConnector(spec)` in `runtime/biz/vocab-from-connector.mjs` — `persistBatch` writes SKOS concepts via `aiRuntime.patchWorkspaceVocab`. |
| **HTTP** | `POST /api/v1/biz/vocab/generate` — body: `cwd` or `workspace` (absolute path), `baseUrl`, `token`, optional `dialect` (`nocobase`), optional `catalogVersion`. Requires BFF Origin + connected DSH. |
| **On connector connect** | `POST /api/v1/biz/lookup` runs the same generator by default after `/lookup/config` unless `generateVocab: false` or `syncVocab: false`. Response may include `vocabGenerate`. |

Adapter: `runtime/biz/adapters/nocobase-vocab.mjs` — `fetchNocoBaseCollections` + `buildVocabFromNocoCollections` (m2o/o2o/o2m/m2m/belongsToMany → `relations[]` on concepts + deduped global list). Action slots `现查` / `改行` / etc. come from field interfaces, not fdex测试 copy-paste.

## fdex测试 `relations` filled?

**Yes** — live NocoBase at `http://127.0.0.1:13000` has **159** association fields on **40** collections; generator produced **153** top-level relations (not zero associations).

**Evidence (2026-09-18):**

1. `POST http://127.0.0.1:4318/api/v1/biz/vocab/generate` with `cwd`=`/Users/zxz/Documents/ai-project/fdex测试`, Noco token from `~/.dsh-fde-x/lan-assist/secrets.json` → `{"ok":true,"concepts":40,"relationCount":153,...}`.
2. `GET /api/v1/biz/kinds?cwd=…fdex测试` → `relations.length` **153**, **40** kinds with per-kind `relations`.
3. `/Users/zxz/Documents/ai-project/fdex测试/.dsh/semantic-os/graph.json` — `skos:Concept` nodes now carry `"relations": [...]` properties (was empty before run).

**Fix applied mid-run:** Noco line-item kinds included field title `金额`, which semantic-os rejects as `NOT_A_KIND`; adapter now omits `金额`/`单号` from shaped `fields` so batches persist. **`workspace` in JSON body** is honored via `resolveActiveBizCwd` (still pass `cwd` for semantic-os authorize on Chinese paths).

## Tests

`node --test runtime/tests/vocab-from-connector.test.mjs` — 4/4 pass.
