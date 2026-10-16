---
cursor:
  subagentId: "bc-9de4d3d1-0119-5e5e-9d56-aab00b340fdb"
---

# Left-rail session audit (2026-09-20 ~19:08–19:14, +8)

**Store:** `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/` (+ `GET http://127.0.0.1:4318/api/v1/ai/sessions`, host up).

**Correlate:** `internal/verify-records-bind-pipe-bi.json` (`sessionId` = hop session), script `verify-records-bind-pipe-bi.mjs` (POST session L349, 问AI click L577–580 on `LEDGER_ID`).

## 19:00–19:20 (+8) API rows (title ∩ 抄表|问|停用)

| time (updatedAt) | title | sessionId |
|---|---|---|
| 19:14:31 | 小区水电抄表 · 问 | session-579c0d28-5782-4a3f-9ad6-9746956d8fae |
| 19:13:08 | 停用客户还有哪些没关的工单 | session-29041d8a-544f-4eed-88ca-c6feaa264778 |

No `未命名` / `blank:true` in live list (2026-09-20 ~19:31 curl).

## Strict 19:08–19:14:59 updatedAt

Only `session-29041…` (19:13:08). `session-579c…` created **19:14:31** (Decision 22 问AI step, just after window).

## Per-row evidence

**停用客户…** — createdAt `1789902537793` → 19:08:57; first user text = hop speech; title `session/title` source `fallback` (DSH from first message). Creator: **verify-records-bind-pipe-bi.mjs** `fetch POST /api/v1/ai/sessions` (L349–357), not `createAiSession` TS.

**小区水电抄表 · 问** — createdAt `1789902871134` → 19:14:31; title `session/title` source `user`; first prompt = `我正在用应用「小区水电抄表」。…请根据这个应用里已有的记录帮我。不要写外部业务系统。` Creator: **`runDeclaredPlatformUse('ai', …)`** `src/lib/app-platform.ts:166–176`, invoked from **`AppCapabilityBar`** `data-app-use="ai"` click; verify L572–580 opens ledger `app_9de6038b…` then clicks 问AI.

## Cause (proven)

`verify-records-bind-pipe-bi.mjs` keeps hop session `29041…` for hops 1–3 + 过审/取消/短名, then **adds** a second session via 问AI on 小区水电抄表 without teardown → extra `· 问` row on left rail. Older duplicate `小区水电抄表 · 问` rows are from earlier runs (e.g. updatedAt 18:15–18:17), not created in 19:08–19:14.

graphify: CLI has no `query` subcommand; not run.
