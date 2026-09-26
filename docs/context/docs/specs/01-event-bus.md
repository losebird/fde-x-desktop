# 01 · 事件总线（BFF → 前端 SSE）

依赖：无。被依赖：02、04、05、06、07。协议：`00-agent-protocol.md`。

## 1. 目标

一条从 BFF 到所有前端模块的实时事件通道，替代各模块对 `/api/v1/im/state` 的重复轮询和 `window` 上的 `fde-x-*` CustomEvent。使「AI 调了什么工具、业务表有什么变化、应用 spec 生成了、早报好了」能被任意模块订阅。

## 2. 范围与禁区

- 做：BFF 内存事件发布器 + `outbox_events` 落库 + SSE 端点 + 前端 `useEvents()` hook + 把现有 `imState` 轮询（`IMScreen.tsx` L68–87、`Briefing.tsx` L38–64）迁到事件。
- 不做：跨进程消息队列、WebSocket、事件回放 UI、删除现有 `fde-x-*` 事件（保留，后续规格逐个替换）。
- 禁区：不动 `src/store/app.ts` 的 panels/floating 结构。

## 3. 现有代码接点

| 接点 | 位置 | 用途 |
|---|---|---|
| `outbox_events` 表 | `runtime/migrations/001_core.sql` L66–80；`db.mjs` L228 `listPendingEvents`；现有路由 `GET /api/v1/events/pending`（`server.mjs` L2305–2308） | 只列不发，复用为持久化；`/events/pending` 保留 |
| AI 工具调用流 | `runtime/ai-stream.mjs`（L46–85 是 trace 文案映射，**尚无**工具事件发射） | 在解析 `tool/call` / `tool/result` 处新增 `emit` |
| lan-assist state | `server.mjs` L1824–1827 `GET /api/v1/im/state` → `lanAssist('/state')`（含 `pendingSheet`、`pendingWrite`、`unread`、顶层 `catalog`） | `biz.sheet.pending`、`im.unread.changed` 事件源 |
| Origin 白名单 | `runtime/config.mjs` L93–111 `parseAllowedOrigins`；`server.mjs` L210 `allowedOrigins`，CORS 闸 L868+、L900+ | SSE 是 GET，但要校验 Origin 防跨站读 |
| 路由挂载 | `server.mjs` L862 `createServer`（内联巨型 handler，**尚无** `runtime/routes/` 目录） | 新建 `runtime/routes/` 目录并在 handler 顶部按前缀分派到 `events.mjs` |

## 4. 数据模型

### 4.1 事件信封（JSON）

```json
{
  "id": "evt_01J8…",           // ulid
  "ts": 1758000000000,          // ms
  "type": "biz.sheet.pending",  // 见 4.2
  "workspaceCwd": "/Users/…",   // 事件所属工作区；全局事件为 null
  "sessionId": "session-…",     // 可选，来源会话
  "source": "lan-assist|dsh|bff|ui",
  "payload": { }                // 按 type 定义
}
```

### 4.2 事件类型（v1 闭集，新增须改本规格）

| type | payload | 触发点 |
|---|---|---|
| `ai.tool.called` | `{ tool, argsSummary, runId }` | `ai-stream.mjs` 收到 `tool/call` |
| `ai.tool.finished` | `{ tool, ok, runId }` | `tool/result` |
| `ai.session.changed` | `{ sessionId, title?, kind:'created|renamed|restored|deleted' }` | 会话 create/rename/restore/delete 路由 |
| `biz.sheet.pending` | `{ kind, action, previewId?, rows, columns, canWrite }` | 轮询 lan-assist `/state`，`pendingSheet` 指纹变化时 |
| `biz.write.done` | `{ kind, action, traceId, receiptId }` | `POST /api/v1/biz/write` 成功 |
| `im.message.received` | `{ peerId, requestId, hasHandoff }` | lan-assist state 中新 incoming |
| `im.unread.changed` | `{ total, byPeer }` | 同上 |
| `app.spec.submitted` | `{ appId, revision }` | 规格 04 |
| `app.activated` | `{ appId, slug }` | 规格 04 |
| `app.record.changed` | `{ slug, entity, id, op:'insert|update|delete' }` | 规格 04 |
| `task.changed` | `{ id, op }` | 规格 03 |
| `briefing.ready` | `{ briefingId, definitionId }` | 规格 06 |
| `memory.card.drafted` | `{ cardId, sourceRef }` | 规格 07 |

### 4.3 持久化

复用 `001_core.sql` 的 `outbox_events`；列与下表不一致处用 `004_events.sql` 只 `ALTER TABLE ADD COLUMN`（不改现有列名）：

```sql
CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  workspace_cwd TEXT,
  session_id TEXT,
  source TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_outbox_ts ON outbox_events(ts);
CREATE INDEX IF NOT EXISTS idx_outbox_ws ON outbox_events(workspace_cwd, ts);
```

保留策略：7 天或 10000 条，启动时清理。

## 5. API 契约

### `GET /api/v1/events?workspace=<cwd>&since=<evt_id>`
- SSE（`text/event-stream`）。`since` 给出时先回放该 id 之后的持久化事件（最多 500 条），再实时推送。
- 每条：`id: <evt_id>\nevent: <type>\ndata: <信封 JSON>\n\n`。每 25s 一条 `: ping`。
- 过滤：`workspace` 给出时只推该 cwd 与 `workspaceCwd=null` 的事件。
- Origin 不在白名单 → 403。
- 连接数上限 32，超出返回 429。

### `GET /api/v1/events/recent?workspace=&type=&limit=50`
- 普通 JSON，用于非流式场景（早报聚合、调试）。

### BFF 内部 API（`runtime/events.mjs`）

```js
export function emit(type, payload, { workspaceCwd, sessionId, source }) // 落库 + 广播，返回 id
export function subscribe(fn) // 进程内订阅，返回 unsubscribe
```

## 6. 前端契约

`src/lib/events.ts`：

```ts
export type FdeEvent<T = unknown> = { id; ts; type; workspaceCwd; sessionId?; source; payload: T }
export function useEvents(types: string[] | '*', handler: (e: FdeEvent) => void, opts?: { workspace?: string }): void
export function getEventStream(): EventSource // 单例，按 activeWorkspace cwd 重连
```

- 单例 `EventSource`，工作区切换时重连并带 `since`（上次 id 存 sessionStorage）。
- 断线自动重连（指数退避 1s→30s）；连接状态暴露 `useEventStreamStatus()` 供顶栏小圆点用（不新增 UI，本规格只暴露 hook）。

### 迁移现有轮询
- `IMScreen.tsx` L68–87 未读轮询 → 订阅 `im.unread.changed`；保留首次挂载时一次 `imState` 拉取作为初值。
- `Briefing.tsx` L38–64 → 同上。
- `Data.tsx` 业务记录 → 规格 05 处理。

## 7. 错误与降级

- SSE 不可用（403/429/网络）→ hook 内退回 15s 一次的 `/events/recent` 轮询，并 `console.warn` 一次。
- BFF 落库失败不阻断广播（`warnings` 记日志）。
- lan-assist 不在线 → 不产生 `biz.*`/`im.*` 事件，不报错。

## 8. 验收清单

人工（Playwright，5175）：
1. 打开 `/ai`，DevTools Network 里有一条 `events` 长连接，`ping` 每 25s。
2. 在 AI 会话里让 AI 调一次 `biz_describe` → `events` 流出现 `ai.tool.called` + `ai.tool.finished`。
3. 从 5174 给测试甲发一条 IM → 5175 流出现 `im.message.received`、`im.unread.changed`，IM 缩略图红点更新**无需等 15s 轮询**。
4. 断开 4319（停 peer 栈）→ 前端不报错，重启后 5s 内自动重连并回放漏掉的事件。
5. 5174 回归：IM 红点仍正常。

自动化（`runtime/tests/events.test.mjs`，`node --test`）：
- `emit` 落库并被 `subscribe` 收到；`since` 回放顺序正确；工作区过滤正确；非白名单 Origin 403；超 32 连接 429。

## 9. 提交拆分

1. `feat(runtime): event bus core + outbox persistence`（`runtime/events.mjs`、迁移、tests）
2. `feat(runtime): SSE /api/v1/events route`（`runtime/routes/events.mjs`、挂载）
3. `feat(runtime): emit ai.tool.* and im/biz events from existing sources`（`ai-stream.mjs`、state 轮询指纹）
4. `feat(web): useEvents hook + EventSource singleton`（`src/lib/events.ts`）
5. `refactor(web): IM unread via events`（`IMScreen.tsx`、`Briefing.tsx`）

## 10. 开放问题（无则写「无」）

无。
