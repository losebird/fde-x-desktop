---
cursor:
  subagentId: "bc-4a95c592-58f8-5f42-891a-c146816327fe"
---

# BFF 仅重启（4318）— 探测记录

对照：[write-audit-bff.md](./write-audit-bff.md)。**未改产品代码**；**未** `POST /api/v1/ai/reload`；**未**动 Vite **5174** / **42443**；**未**点过账、未写业务库、未推远程。

## 进程

| 项 | 旧 | 新 |
|---|---|---|
| BFF PID | **90180**（`node runtime/server.mjs`，启动 **2026-09-23 23:09:09**） | **10640**（启动 **2026-09-24 16:51:51 +0800**） |
| 停止方式 | `SIGTERM` 约 30s 未退出 → **`SIGKILL`** | — |
| 拉起方式 | — | tmux 会话 `bff-runtime-4318`，cwd `scene-39-personal-workstation`，`node runtime/server.mjs`（日志 `/tmp/bff-4318-restart.log`） |
| `4318` LISTEN | 仅 90180 | 仅 **10640**（`lsof -iTCP:4318 -sTCP:LISTEN` 一行） |

## 未动 / 副作用

| 组件 | 结果 |
|---|---|
| Vite **5174** | **42443** 仍在听，未重启 |
| DSH overlay（vendor） | 未 `disconnect`、未重拷 overlay |
| DSH 子进程 | BFF **SIGKILL** 带走旧子进程 **274**；重启后 BFF 内 `connected:false`。**为完成闸层假令牌探测**，在**未** `disconnect` 的前提下执行了一次 `POST /api/v1/ai/connect`（`Origin: http://127.0.0.1:5174`）→ 新 DSH **PID 11136**，`connected:true`（非 overlay 重连流程） |

## `POST /api/v1/biz/write`（`preview_id: pv_nonexistent_probe`，`Origin: http://127.0.0.1:5174`）

### 重启前（90180，与审计一致）

| 请求体 | HTTP | `error.code` | `error.message` |
|---|---|---|---|
| 无 `source` | 400 | `NEED_WORKSTATION_CONFIRM` | 请在右侧确认过账 |
| `source: workstation` | 400 | `NEED_WORKSTATION_CONFIRM` | 请在右侧确认过账 |
| `source: ai` | 400 | `NEED_WORKSTATION_CONFIRM` | 请在右侧确认过账 |

### 重启后（10640，DSH 已 connect）

| 请求体 | HTTP | `error.code` | `error.message` |
|---|---|---|---|
| 无 `source` | **403** | `biz_write_forbidden` | 请在右侧确认过账 |
| `source: workstation` | **400** | **`NEED_PREVIEW`** | 先预览。没有这张令牌，不能写。 |
| `source: ai` | **403** | `biz_write_forbidden` | 请在右侧确认过账 |

**结论：** 不再三种皆 `NEED_WORKSTATION_CONFIRM`；无 `source` / `source: ai` 在 BFF 层 **403**；`source=workstation` 已进入闸（假令牌 → **`NEED_PREVIEW`**），与磁盘 `biz.mjs` / `1bf8b675` 语义一致。

## 健康

- `GET http://127.0.0.1:4318/health` → `state: healthy`（重启后）
- `GET /api/v1/ai/status` → 最终 `connected: true`，`pid: 11136`
