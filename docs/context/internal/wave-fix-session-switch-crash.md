---
cursor:
  subagentId: "bc-e5dfe21b-ee9c-5dbf-9fca-f1097f852736"
---

# Session switch crash (`not_found` + EPIPE)

## 症状（Ace 截图）

- 工作区 **fdex测试1**，横幅「已连接本地核心」。
- 切会话后主区出现 Chrome JSON 视图：`{"error":{"code":"not_found","message":"接口不存在"},"correlationId":"corr_…"}`。
- 终端：`Unhandled 'error' event` → `Error: write EPIPE`（`node:net` / `Socket._write`），主栈 Node 进程退出。

## `接口不存在` 是哪条路径

| 项 | 证据 |
|---|---|
| JSON 形状 | `runtime/server.mjs` `sendError` → `{ error: { code, message }, correlationId }`（约 L292–296） |
| 兜底文案 | 仅 `server.mjs` 末段 `sendError(..., 'not_found', '接口不存在', …)`（约 L2516） |
| 非 plan 路由 | `runtime/routes/plan.mjs` 也有同文案，但 AI 页不走 plan |

**已对（curl，修前 4318 进程）**

1. `GET http://127.0.0.1:4318/api/v1/missing` → `not_found` / `接口不存在`（对照兜底格式）。
2. `GET http://127.0.0.1:4318/api/v1/ai/sessions/<sessionId>`（列表里真实 id）→ **同上 `接口不存在`** — BFF **未实现** `GET /api/v1/ai/sessions/:id`（仅有 list / 子资源 export 等）。

**已对（机制，代码）**

3. `shouldProxyDsh` 在 `!aiRuntime.origin` 时为 **false**（修前 L496–502）。此时 `GET /dsh-app/` **不进** `proxyDsh`，落到兜底 → iframe 整页显示 `接口不存在` JSON（与截图一致）。核心短暂断开或 BFF 刚崩后重载 iframe 会触发。

**未对**

- 未能从 DSH 前端 bundle 里钉死「切会话时谁 `location` 到 `/api/v1/ai/sessions/:id`」；现网未用 CDP 抓切会话 Network。

## EPIPE 谁抛、为何拖死 4318

| 项 | 证据 |
|---|---|
| 栈特征 | `Socket.ondata` → 对端 `Writable.write` → 无 `'error'` 监听 → `throw er` |
| 代码 | `server.on('upgrade', …)` 在 101 后对 `upSocket`/`socket` **双向 `pipe` 且无 `error` 处理**（修前约 L2585–2586）；`proxyDsh` / `proxySemanticOs` 的 `incoming.pipe(response)`、`request.pipe(up)` 同样缺销毁链 |
| 触发场景 | 切会话时 `AI.tsx` 用 `key={dshFrameSrc}` + 每次改 hash **整页重载 iframe** → DSH WebSocket 大量断开；代理一端已 `destroy` 另一端仍写 → **EPIPE** → 未处理则 **整个 BFF 进程退出** |

## 改动（最小）

**`runtime/server.mjs`**

- `pipeProxyStreams` / `duplexProxySockets`：pipe 两端 `error` → `destroy`，避免 EPIPE 冒泡为 `uncaughtException`。
- `shouldProxyDsh`：`/dsh-app` 始终走代理；`proxyDsh` 在无 `origin`/`cookie` 时 **503 `ai/not-connected`**，不再掉进 `接口不存在`。
- `GET /api/v1/ai/sessions/:sessionId`：`session/list` 查找 + `toAiSessionSummary`。

**`src/pages/AI.tsx`**

- 去掉 `iframe key={dshFrameSrc}`；`dshFrameSrc` 仅在首次或 BFF origin 变时设置，**切会话只靠** 既有 `tellDsh('select')` / `postMessage`，避免每次切换重载 DSH。

## 验证（本 worker）

| 检查 | 结果 |
|---|---|
| 修前 `GET …/ai/sessions/:id` | `接口不存在` |
| 修后 | 需 Ace 主栈加载新 `runtime/server.mjs` 后再 curl / 5174 切会话 |
| 未杀 `pnpm dev` | 是 |

## Commit

`fix(ai): handle session switch without EPIPE crash` — `runtime/server.mjs`, `src/pages/AI.tsx`（未 `git add -A`）。
