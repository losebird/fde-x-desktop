---
cursor:
  subagentId: "bc-4f5ab491-5c9e-5074-8f54-8f52ede4ff6d"
---

# wave-fix-records-back-onerow

## Answers

| Question | Answer |
|----------|--------|
| 1-row 改行 shows 返回 | **yes** — `共 1 条` table + 改行确认 drawer; chrome `← 返回` readable ([records-back-visible.png](../media/records-back-visible.png)) |
| After 返回, list restored and 返回 hidden | **yes** — drawer closed; `返回` count 0; multi-row list (`共 166 条`, 10 rows on page 1) ([records-back-restored.png](../media/records-back-restored.png)) |
| SHA | **`fb73993`** (`fix(web): show write-preview row in records table`; parent `5a02033`) |

## Code

`RecordsPanel.tsx`: `tableRows` prefers `drawer.sheet` rows when a write preview is open, so the table is **1-row** while `listRestore` still targets the prior 现查 list. Fixes rejected proof where the table stayed at 20 rows with drawer + 返回.

Prior commit `5a02033` (session kind cache / surface hydrate for `listRestore`) unchanged in intent; this commit fixes **display** only.

## Proof

- Path: `http://127.0.0.1:5174/data` → **业务记录** (fdex测试1, pending 改行 + session list restore).
- Script: `node scripts/records-back-proof.mjs` (local helper, not committed).

## Reviewer reject (addressed)

- Old `records-back-visible.png`: 20-row table + drawer — **wrong screen**.
- Old `records-back-restored.png`: 返回 still visible — **wrong**; proof now asserts hidden + drawer closed.
