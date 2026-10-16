---
cursor:
  subagentId: "bc-7df8a787-a804-5118-b12d-6b749548e9dc"
---

# Live verify · post Ace `pnpm dev` restart (5174 / 4318)

**When**: 2026-09-17 (read-only curl)  
**Workspace**: `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**Origin**: `http://127.0.0.1:5174`  
**Refs**: [wave-fix-biz-catalog.md](./wave-fix-biz-catalog.md), [wave-fix-memory-pack.md](./wave-fix-memory-pack.md)

## Verdict

**FAIL** — BFF/health up, but **DSH / AI runtime not connected** (`connected: false`). Biz and memory paths return 503; pack lacks `data.memory`.

## Curl matrix

| # | Request | HTTP | Body facts |
|---|---------|------|------------|
| 1 | `GET :4318/health` | **200** | `state: healthy`; adapters `ai-runtime`, `im-business-adapter`, `semantic-memory` all **degraded** (“运行时调用尚未接通”) |
| 2 | `GET :5174/api/v1/biz/kinds?workspace=…` + Origin 5174 | **503** | `error.code`: **`lan_assist_unavailable`**; `message`: **「核心 AI 运行时尚未连接」** |
| 3 | `GET :5174/api/v1/biz/traces?workspace=…&limit=50` + Origin 5174 | **503** | Same as kinds |
| 4 | `POST :4318/api/v1/context/pack` `{ workspaceCwd, scopes:["memory"] }` + Origin 5174 | **200** | `ok: true`; `data` keys: `generatedAt`, `workspace` only — **no `data.memory`**; `warnings`: **`memory_engine_not_ready`**; **no** `memory_query_missing` |
| 5a | `GET :4318/api/v1/memory/ready?workspace=…` | **503** | `error.code`: **`ai/not-connected`**; message: 核心 AI 运行时尚未连接 |
| 5b | `GET :5174/api/v1/memory/ready?workspace=…` (proxy) | **503** | Same as 5a |
| 6a | `GET :4318/api/v1/memory/search?q=scene&workspace=…` | **503** | **`ai/not-connected`** (not `CWD_NOT_AUTHORIZED`) |
| 6b | `GET :5174/api/v1/memory/search?q=scene&workspace=…` | **503** | Same as 6a |

## Pass criteria vs observed

| Criterion | Result |
|-----------|--------|
| kinds + traces **200**, not `lan_assist_unavailable` | **FAIL** — 503 + `lan_assist_unavailable` |
| pack has **`data.memory`**, no **`memory_query_missing`** | **FAIL** — no `data.memory`; warning is `memory_engine_not_ready`; `memory_query_missing` absent |
| `memory/ready` **true/false** as JSON | **FAIL** — 503 `ai/not-connected`, no `ready` field |
| `memory/search` record exact error | **503** `ai/not-connected` (expected `CWD_NOT_AUTHORIZED` only when semantic connected per prior triage) |

## Corroboration

`GET :5174/api/v1/ai/status` → **200**, `data.connected`: **false**, `data.workspace`: scene-39 path, `lanPort`: `"19527"`, `lastError`: null.

## Screenshot

**Skipped** — optional `media/verify-restart-biz.png` not taken (curl-only verify; UI would not exercise biz/memory success while AI disconnected).

## Interpretation (no code changes)

Restart loaded dev servers, but **core AI session is not attached** to this BFF instance. Until `connected: true`, lan-assist-backed biz routes and semantic memory routes stay on the disconnected error path; pack cannot fill memory (`memory_engine_not_ready`). Re-run this sheet after DSH connect without recycling 5174/4318 unless Ace chooses to.

## 对照（本 run）

| 项 | 期望（wave-fix 文档） | 实测 |
|----|----------------------|------|
| `/biz/kinds` workspace 修复 | 200 + kinds | **仍差** — 503 disconnected |
| pack 目录名 query / 无 `memory_query_missing` | `data.memory` + 无该 warning | **部分** — 无 `memory_query_missing`，但无 `data.memory` |
| `memory/ready` | true/false | **未测** ready 布尔（503） |
| `memory/search` | 可能 `CWD_NOT_AUTHORIZED` | **未对** — 未到授权层（503） |
