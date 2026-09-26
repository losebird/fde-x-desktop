---
cursor:
  subagentId: "bc-a6a99fcc-185e-5301-a46b-5924939621a0"
---

# wave-fix-vocab-relations-gen

**Repo:** scene-39 `main` **`3d51815`**  
**Acceptance workspace:** `/Users/zxz/Documents/ai-project/fdex测试` (not a template)

## Generic entrypoint

- `generateWorkspaceVocabFromConnector` — `runtime/biz/vocab-from-connector.mjs`
- `POST /api/v1/biz/vocab/generate` (`cwd` + `workspace`)
- `POST /api/v1/biz/lookup` runs generate by default (`generateVocab: false` to skip)
- NocoBase adapter: `runtime/biz/adapters/nocobase-vocab.mjs` (schema collections + association fields → kinds / `can` / `relations[]`)

New install / new connector: same functions. Swap adapter for another system; do not copy fdex测试 graph.

## fdex测试 relations filled?

**Yes.** Live NocoBase (`127.0.0.1:13000`) had **159** association fields; generate returned **153** relations / **40** concepts. `GET /api/v1/biz/kinds` showed 153 top-level relations and per-kind `relations`. Graph concepts on disk received `relations`.

## Leftover (Decision 15)

`isVocabRow` / field-strip used hardcoded `金额`、`单号`、`单行`、`明细行` to dodge semantic-os `NOT_A_KIND`. Must classify collection vs field from schema, not those literals.

## Tests

`node --test runtime/tests/vocab-from-connector.test.mjs` passed in the landing turn.
