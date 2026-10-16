---
cursor:
  subagentId: "bc-2682fa82-bed6-5dad-9c30-788d4c15bb79"
---

# Wave 1 · EventSource `/api/v1/events` 403（5175）

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**修复提交**：`b2d1a1a` `fix(web): EventSource events 403 on 5175`  
**未动**：`Plan.tsx`、`plan.mjs`、`runtime-api.ts`、`src/lib/events.ts`（已是同源 URL）

## 根因

| 假设 | 结论 | 证据 |
|------|------|------|
| EventSource 直连 4319 | **否** | `src/lib/events.ts` L166：`new EventSource(\`/api/v1/events?…\`)`，经 5175 Vite `/api` 代理 |
| localhost vs 127.0.0.1 白名单 | **否** | `parseAllowedOrigins` 同时含两者；带 `Origin: http://127.0.0.1:5175` 的 curl **200** |
| Vite 代理弄坏 SSE | **否** | `Referer: http://127.0.0.1:5175/ai` 经 5175 代理 **200** |
| 同源 GET 无 `Origin` | **是** | `curl` 无 `Origin` → **403**；Playwright 请求头无 `origin`，仅有 `referer: http://127.0.0.1:5175/ai`；`events.mjs` 原逻辑要求 `request.headers.origin` 为字符串且在白名单 |

与 `4a9879f`（plan 直连 `VITE_FDE_RUNTIME_URL` 缺 CORS）是不同路径：SSE 从未打 4319，而是 BFF 对「无 Origin」过严。

## 改动

- `runtime/config.mjs`：`resolveAllowedRequestOrigin(request, allowedOrigins)` — 先校验 `Origin`；缺失时用 `Referer` 解析出的 origin（须在白名单）。显式非法 `Origin` 仍 403。
- `runtime/routes/events.mjs`：SSE + `/events/recent` 共用上述解析；`Access-Control-Allow-Origin` 仍回显已允许的 origin。
- `runtime/tests/events.test.mjs`：无 `Origin`、有允许 `Referer` → 200。

## Before / After

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| `curl` 5175/4319 `/events` 无头 | 403 | 403（无 Referer，预期） |
| `curl` + `Origin: http://127.0.0.1:5175` | 200 | 200 |
| `curl` + `Referer: http://127.0.0.1:5175/ai`（4319） | 403 | **200** |
| Playwright 5175 `/ai` EventSource | readyState **2**，Network **403** | readyState **1**，Network **200**，请求无 `Origin`、有 `Referer` |

Playwright 日志：`files/media/wave1-sse-fix/sse-probe-log.json`  
截图：`files/media/wave1-sse-fix/01-ai-events-page.png`

## 验证

| 命令 | 结果 |
|------|------|
| `npx tsc -b --pretty false` | 0 |
| `node --test runtime/tests/events.test.mjs` ×2 | 3/3 + 3/3 |
| `node runtime/smoke.mjs` | ok |

**peer 4319**：验收中曾 SIGTERM 后 `nohup node runtime/server.mjs`（peer env）拉起以加载新 BFF；未停 5175 `pnpm dev`。

## 提交

`b2d1a1aeeabe83993b7f2fd9c2e6c2011181155a` — `fix(web): EventSource events 403 on 5175`
