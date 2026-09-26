---
cursor:
  subagentId: "bc-3b1af745-a3de-5e50-b68b-dd474f759e20"
---

# Live verify: generic schema edges → local main

**Verdict: pass.** Checks 2+3+4 passed. Local `main` fast-forwarded. No origin push.

| Item | Result |
|------|--------|
| Product git | `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation` (`pwd` + `git rev-parse --show-toplevel`) |
| Branch verified | `cursor/generic-schema-edges-8372` @ `bca5c093989e357b8e572d555d3127da983611da` |
| Workspace | `/Users/zxz/Documents/ai-project/fdex测试` |
| 4318 reload | **yes** (generate was still 503 `NOT_A_KIND` on the 06:45 process) |
| New 4318 | pid **93767** (parent `scripts/dev.mjs` 39205), DSH pid **94236**, connected |
| 5174 | not killed (pid 39206 still LISTEN) |
| main after merge | **`bca5c093989e357b8e572d555d3127da983611da`** (was `21d0141`) |
| origin push | no (this checkout has no remotes) |
| 过账 / `biz_write` / 抄表 问 AI | none (`bizWriteUrls: []`, preview `canWrite: false`, no preview_id) |

## Check 1 — reload if generate 503

**Before reload:** 4318 pid 82763 started 06:45 (before this SHA). `POST /api/v1/biz/vocab/generate` with Noco token → **HTTP 503** `{ error: { code: "vocab_generate_failed", message: "NOT_A_KIND" } }`.

**Reload:** `POST /api/v1/ai/reload` 200 `restarting: true`. Supervised parent was zsh (not `dev.mjs`); `dev.mjs` watch then spawned **93767**. Orphan 82763 had no LISTEN; SIGKILL that leftover only. 5174 kept. `POST /api/v1/ai/connect` 200.

**After reload:** generate **HTTP 200** `{ ok: true, concepts: 40, relationCount: 153, catalogVersion: "schema:ccf68f509408", batches: 19 }`.

## Check 2 — `GET /api/v1/biz/kinds` 客户↔工单

**Pass** (measured after reload + generate, URL-encoded cwd).

| | Count |
|--|--|
| kinds | 40 |
| `data.relations` | **153** |
| 客户↔工单 pairs | **2** |

```json
{ "from": "客户", "to": "工单", "field": "tickets" }
{ "from": "客户", "to": "工单", "field": "customer" }
```

Nested: `客户` / `biz_customers` has `tickets`; `工单` / `biz_tickets` has `customer`. Real column names, not invented.

Later GET after many previews + merge returned 86 top-level relations and the `customer` pair only. Hop already used `customer`. Not treated as a check-2 fail; verify-time evidence is 153 / 2.

## Check 3 — speech hop (preview only)

Speech: `停用客户还有哪些没关的工单？`  
`POST http://127.0.0.1:4318/api/v1/biz/preview` with `kind: 工单`, `action: 现查` (BFF `translateBizIntent` requires kind). **HTTP 200**.

| | Value |
|--|--|
| pending kind | **工单** |
| action | 现查 |
| rows | **21** |
| first | `TK20260623126` |
| steps | **客户 → 工单** |
| from | 客户 · 14 · `status=inactive/停用` |
| hopWhere | yes (parent status) |
| ticket FK on row | `fields.customer` / `fields.customerId` (first customer name 南京智航交通科技有限公司) |
| canWrite / preview_id | false / empty |
| not | 客户 · 0 |

UI (after selecting history `工单 · 现查 · 停用客户还有哪些没关的工单？`): chips **工单 21** (selected) + **客户 14**; footer **共 21 条**; first `TK20260623126`.

Screenshot: `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-edge-verify.png`  
(`/cursor/stores/...` is not a filesystem path on this machine; file lives in the Project store `media/`.)

## Check 4 — no hardcoded pair map

```bash
rg -n '客户|工单|biz_tickets|biz_customers' \
  runtime/biz/adapters/nocobase-vocab.mjs \
  runtime/biz/vocab-from-connector.mjs
```

**No matches** (exit 1). Same SHA as merged main.

## Merge

```text
git checkout main
git merge --ff-only cursor/generic-schema-edges-8372
# 21d0141..bca5c09
# 3 files: nocobase-vocab.mjs, vocab-from-connector.mjs, vocab-from-connector.test.mjs
```

`git remote -v` empty. No push.

## Pass/fail

| # | Gate | Result |
|---|------|--------|
| 2 | kinds has 客户↔工单 + real fields | **pass** |
| 3 | pending 工单 ~21, steps 客户→工单, not 客户·0 | **pass** |
| 4 | no 客户/工单/`biz_tickets` pair map | **pass** |

**Merged.** main SHA **`bca5c093989e357b8e572d555d3127da983611da`**.
