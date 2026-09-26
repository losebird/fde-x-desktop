---
cursor:
  subagentId: "bc-4c30f9f8-fd4f-5c47-ae7d-5efcf313b76e"
---

# Wave 1 · 01 事件总线 — 交付报告

## 改动

| 提交 | 说明 | 文件 |
|---|---|---|
| `475cef3` | event bus core + outbox 持久化 + 单测 | `runtime/events.mjs`, `runtime/migrations/004_events.sql`, `runtime/tests/events.test.mjs` |
| `cf8ae85` | SSE `/api/v1/events` + `/recent` | `runtime/routes/events.mjs` |
| `84691f9` | 前端 `useEvents` / `EventSource` 单例 | `src/lib/events.ts` |

- **`runtime/server.mjs` 未改**（main 上已有 `handleEventsRoutes` import + dispatch，与 03/08 的 plan/presets/mcp 挂载并存）。
- 禁区文件未碰：`presets.mjs`、`mcp.mjs`、`MCP.tsx`、`PresetImportDrawer.tsx`、`CoreSettings.tsx`、`IMScreen.tsx`、`Briefing.tsx`、`ai-stream.mjs`、`db.mjs`。

### 实现要点

- `emit` / `subscribe`：`runtime/events.mjs`；落库复用 `outbox_events`，`004_events.sql` 仅 `ADD COLUMN`（`ts`、`workspace_cwd`、`session_id`、`source`、`delivered`）+ 索引。
- SSE：`GET /api/v1/events`（`since` 回放 ≤500、工作区过滤、25s `: ping`、Origin 403、连接数 32 → 429）；`GET /api/v1/events/recent` JSON。
- 修复：SSE 在 `writeHead` 后立刻 `response.write(': connected\n\n')`，否则客户端在首包前不收 headers；去掉对 `response.req` 的赋值（会卡住响应）。

## 验证

| 命令 | 结果 |
|---|---|
| `npx tsc -b --pretty false` | 退出 0 |
| `node --check runtime/events.mjs` / `runtime/routes/events.mjs` | 通过 |
| `node --test runtime/tests/events.test.mjs` | 3/3 通过（emit+subscribe、since 回放+工作区过滤、Origin 403 + 32 连接 429） |
| `node runtime/smoke.mjs` | `status: ok`（含迁移 004） |

**未做（规格 8 人工 / 现网）**：5175 Playwright、`ai.tool.*` 实流、IM 红点实时、断 4319 重连 — 依赖后续 emit 源与 `IMScreen`/`Briefing` 迁移，本轮文件所有权未包含。

## 未做到 / 偏离规格

| 项 | 状态 |
|---|---|
| `ai-stream.mjs` 发射 `ai.tool.called` / `ai.tool.finished` | **未做**（非 01 本轮 owned 文件） |
| lan-assist state 指纹 → `biz.*` / `im.*` emit | **未做**（同上） |
| `IMScreen.tsx` / `Briefing.tsx` 轮询 → `useEvents` | **未做**（同上） |
| `biz.write.done` 等于 `POST /api/v1/biz/write` 成功 | **未做**（未改 server 写路由） |
| 事件 id 规格写 ulid | **仍差**：沿用仓库 `createId('evt')`（uuid 风格），非 ULID 库 |
| `runtime-api.ts` 未加 events 封装 | 规格 00 惯例；01 契约在 `src/lib/events.ts` 直连 `/api/v1/events` |

## 需要 Ace / 协调

1. **换新 4318 / 4319**：已改 `runtime/*.mjs`（含新路由模块）。未杀 `pnpm dev` / `dev:peer`；若 4319 是 tmux 手起 `node runtime/server.mjs`，请在该会话里重启 runtime 后再 `curl http://127.0.0.1:4319/health` 与打开 `http://127.0.0.1:5175/ai` 看 Network 里 `events` 长连接。
2. 后续 agent 可在 `configureEventBus(db)` 已随首条 events 请求执行的前提下，在 `ai-stream.mjs` / IM state 轮询处 `import { emit } from './events.mjs'`（或 `routes/events.mjs` 再导出）。

## 开放问题

无（规格 10）。
