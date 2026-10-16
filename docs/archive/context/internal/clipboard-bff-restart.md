---
cursor:
  subagentId: "bc-6cb3fc6f-0f36-55ae-908e-930841cc91c2"
---

# BFF 仅重启（4318）— clipboard 注入

对照：[chat-copy-fix.md](./chat-copy-fix.md)。**未改产品代码**；**未** `POST /api/v1/ai/reload`；**未** `disconnect`；**未**动 Vite **5174** / **42443**；**未**点过账、未推远程。

## 进程

| 项 | 旧 | 新 |
|---|---|---|
| BFF PID | **10640**（`node runtime/server.mjs`，约 **16:51 +0800**） | **26724**（tmux `bff-4318-restart`，`FDE_RUNTIME_PORT=4318`，日志 `/tmp/bff-4318-restart.log`） |
| 停止方式 | `SIGTERM` → **4318** 释放（约 1.5s） | — |
| `4318` LISTEN | 仅 10640 | 仅 **26724**（`lsof -iTCP:4318 -sTCP:LISTEN` 一行 node） |

## DSH / connect

| 项 | 结果 |
|---|---|
| 重启后 `GET /api/v1/ai/status` | `connected: false`（BFF 进程换新，核心未自动挂回） |
| 恢复 | 单次 `POST /api/v1/ai/connect`，`Origin: http://127.0.0.1:5174`，body `{}` |
| 最终状态 | `connected: true`，DSH 子进程 **PID 26865**，`origin: http://127.0.0.1:51899` |

## `/dsh-app` clipboard 注入

重启前（10640，核心仍在线）：`GET /dsh-app` 响应 HTML **无** `data-fde-clipboard-patch`（旧进程未加载磁盘 `server.mjs` 注入逻辑）。

重启 + connect 后：

```bash
curl -sS -H 'Origin: http://127.0.0.1:5174' 'http://127.0.0.1:4318/dsh-app' | rg 'data-fde-clipboard-patch'
```

→ `<head>` 内出现 **`<script data-fde-clipboard-patch>`**（`runtime/fde-x-dsh-bridge/lib/clipboard-patch.js` 内联）及既有 `data-fde-dsh-hook` / `wrapFactory` 剪贴板 patch 路径。

未连接时 `GET /dsh-app` → **503** `ai/not-connected`（预期，未为此单独 disconnect）。

## 未动

| 组件 | PID / 说明 |
|---|---|
| Vite **5174** | **42442** / **42443** 未重启 |
| 其它 `runtime/server.mjs` | 20250、18301、14216 等仍存在，**均未**监听 **4318** |

## 健康

- `GET http://127.0.0.1:4318/api/v1/ai/status` → `connected: true`，`bffOrigin: http://127.0.0.1:4318`
