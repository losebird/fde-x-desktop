---
cursor:
  subagentId: "bc-f4362cb3-f75d-509c-b317-f0ae0ab8224e"
---

# wave-fix-records-back-prove

## Answers

| Question | Answer |
|----------|--------|
| 返回 visible in the screenshot (`records-back-visible.png`) | **yes** — header shows `← 返回` beside `来源：…现查` while **改行确认** drawer is open |
| 返回 restores prior list (`records-back-restored.png`) | **yes** — drawer closed; multi-row 工单 table (20 条 · 现查) remains |
| SHA | `5a02033` (`fix(web): hydrate listRestore from session kind cache and surfaces`) |

## What changed (code)

- `src/lib/biz-kind-list-cache.ts` — sessionStorage cache for multi-row `现查` sheets (survives pending-sheet overwrite by 改行).
- `src/lib/biz-session-sheet.ts` — on `rememberBizPendingSheet`, persist multi-row `现查` into kind cache.
- `src/components/biz/RecordsPanel.tsx` — `ensureListRestoreBeforeWritePreview` reads session kind cache; when surfaces show prior `现查` with `rowCount > 1` but no rows in memory, one-shot `bizPreview` `现查` seeds `listRestore` on AI hydrate; drawer **取消** dismisses without list restore (distinct from **返回**).

## Proof media

- [records-back-visible.png](../media/records-back-visible.png)
- [records-back-restored.png](../media/records-back-restored.png)

Captured via `node scripts/records-back-proof.mjs` against `http://127.0.0.1:5174/data` → **业务记录** (workspace fdex测试1).

## 74b3005 gap

`74b3005` only consulted in-memory `sheetSnapshots` / `surfaces` cache; AI hydrate straight to 1-row 改行 left those empty. Session kind cache + surface-guided `现查` preload fixes that path.
