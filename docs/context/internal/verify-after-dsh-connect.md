---
cursor:
  subagentId: "bc-8ee3c082-9590-506c-ade4-2abb38d7b315"
---

# Live verify · after DSH attach (5174 / 4318)

**When**: 2026-09-17  
**Workspace**: `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**Origin**: `http://127.0.0.1:5174`  
**Prior**: [verify-restart-biz-memory.md](./verify-restart-biz-memory.md)  
**Refs**: [wave-fix-biz-catalog.md](./wave-fix-biz-catalog.md), [wave-fix-memory-pack.md](./wave-fix-memory-pack.md)

## DSH poll (`GET :5174/api/v1/ai/status`, Origin 5174)

| Poll | Time (UTC+8) | `connected` | `lastError` | `lanPort` |
|------|----------------|-------------|-------------|-----------|
| 1 | 18:42:43 | false | null | 19527 |
| 2 | 18:42:58 | false | null | 19527 |
| 3 | 18:43:13 | false | null | 19527 |
| 4 | 18:43:28 | false | null | 19527 |
| 5 | 18:43:43 | **true** | null | 19527 |

`workspace` on all polls: scene-39 absolute path (matches stack cwd).

**Outcome**: Connected within ~60s of first poll; no extra DSH processes started by this verify.

## Verdict

**PASS (wave-fix curl scope)** — Biz catalog/traces and memory pack/ready behave as post-fix expectations once AI is connected. **仍差**: `memory/search` (and pack warnings) at **cwd authorization** layer (`CWD_NOT_AUTHORIZED`), same as [wave-fix-memory-pack.md](./wave-fix-memory-pack.md) triage — not a regression from disconnected stack.

## Curl matrix (same as verify-restart-biz-memory)

| # | Request | HTTP | Body facts |
|---|---------|------|------------|
| 1 | `GET :4318/health` | **200** | `state: healthy`; `ai-runtime` **healthy** (“核心 AI 运行时已接通”); `semantic-memory` **healthy**; `im-business-adapter` still **degraded** (plugin, runtime call not wired) |
| 2 | `GET :5174/api/v1/biz/kinds?workspace=…` + Origin 5174 | **200** | `data.kinds` non-empty array; **no** `lan_assist_unavailable` |
| 3 | `GET :5174/api/v1/biz/traces?workspace=…&limit=50` + Origin 5174 | **200** | `data.rows: []`; **no** `lan_assist_unavailable` |
| 4 | `POST :4318/api/v1/context/pack` memory-only + Origin 5174 | **200** | `ok: true`; **`data.memory`** present (`hits`, `precedents`); **no** `memory_query_missing`; `warnings`: **`memory_find_failed`**, **`memory_precedents_failed`** |
| 5a | `GET :4318/api/v1/memory/ready?workspace=…` | **200** | `data.ready`: **true** |
| 5b | `GET :5174/api/v1/memory/ready?workspace=…` | **200** | same as 5a |
| 6a | `GET :4318/api/v1/memory/search?q=scene&workspace=…` | **502** | `error.code`: **`CWD_NOT_AUTHORIZED`** |
| 6b | `GET :5174/api/v1/memory/search?q=scene&workspace=…` | **502** | same as 6a |

## Pass criteria vs wave-fix docs

### wave-fix-biz-catalog.md

| Criterion | Result |
|-----------|--------|
| Restart后 `kinds` / `traces` → **200**, `lan_assist_unavailable` 消失 | **PASS** |
| `resolveBizWorkspace` + `search.workspace` 现网 | **PASS**（curl 200 + kinds） |
| RecordsPanel UI | **未测**（本 run curl-only） |

### wave-fix-memory-pack.md

| Criterion | Result |
|-----------|--------|
| Pack **`data.memory`**, **无** `memory_query_missing` | **PASS** |
| `memory/ready` → JSON **ready** 布尔 | **PASS** (`ready: true`) |
| `memory/search` 记录精确错误 | **PASS** — **502** `CWD_NOT_AUTHORIZED`（semantic 已连；未到修前 `ai/not-connected`） |
| `/find` cwd 授权 / `memory_find_failed` | **仍差**（环境/DSH `workspaceAuthority`；与文档一致，非本票代码缺口） |

## 对照（本 run）

| 项 | 期望（wave-fix） | 实测 |
|----|------------------|------|
| `/biz/kinds` workspace 修复 | 200 + kinds | **已对** — 200，41 kinds |
| `/biz/traces` | 200 + rows | **已对** — 200，空 rows |
| pack 目录名 query / 无 `memory_query_missing` | `data.memory` + 无该 warning | **已对** — 有 `data.memory`；warnings 为 find/precedents failed |
| `memory/ready` | true/false | **已对** — `ready: true` |
| `memory/search` | 连上后可能 `CWD_NOT_AUTHORIZED` | **已对** — 502 `CWD_NOT_AUTHORIZED` |

## Notes

- No stack recycle, no code edits, no packaging in this run.
- Screenshot skipped (curl-only).
