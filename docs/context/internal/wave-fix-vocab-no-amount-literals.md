---
cursor:
  subagentId: "bc-3ffbc2d5-c537-554a-b2b8-c70f9f18387d"
---

# wave-fix-vocab-no-amount-literals

**SHA:** `cafefaa` on scene-39 `main`

**Literals gone:** yes in `runtime/biz/adapters/nocobase-vocab.mjs` and `runtime/biz/vocab-from-connector.mjs`. `shapeFields` no longer drops fields by Chinese titles `金额` / `单号`. Collection vs scalar vs association comes from NocoBase schema interfaces.

**Tests:** `runtime/tests/vocab-from-connector.test.mjs` updated and run in the landing turn.

**Relations:** unchanged by this commit.
