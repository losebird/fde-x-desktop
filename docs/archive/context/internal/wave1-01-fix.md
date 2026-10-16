---
cursor:
  subagentId: "bc-510c661b-8cf3-592f-8a91-f602c0d86a6e"
---

# Wave 1 · 01 must-fix 补修

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`（`main`）  
**未改**：`runtime/routes/plan.mjs`、`src/pages/Plan.tsx`（03 已在 `86f5136` / `0c1a6f4`）

## 改动（提交）

| SHA | 信息 |
|-----|------|
| `96fe7db` | `feat(runtime): emit ai.tool.* and im/biz events from existing sources` |
| `5f94271` | `refactor(web): IM unread via events` |
| `5981ef5` | `fix(runtime): stable event ordering` |

- `runtime/ai-stream.mjs`：`tool/call` / `tool/result` 帧经 `emit` 发 `ai.tool.called` / `ai.tool.finished`（仅 live `event` 帧，不 replay snapshot）。
- `runtime/lan-assist-state-watch.mjs`（新）：3s 轮询 `lanAssist('/state')`，`pendingSheet` 指纹 → `biz.sheet.pending`；未读指纹 → `im.unread.changed`；新 incoming id → `im.message.received`（首包 bootstrap 不刷历史）。
- `runtime/server.mjs`：`configureEventBus(db)`；`POST /api/v1/biz/write` 成功一条 `biz.write.done`；`listen` 回调 `startLanAssistStateWatch`。
- `src/components/IMScreen.tsx` / `src/pages/Briefing.tsx`：挂载一次 `imState`；`useEvents` 订阅 `im.unread.changed`（Briefing 另订 `im.message.received`）；去掉 4s/8s 主路径轮询。
- `runtime/events.mjs`：单调 `evt_<ts36>_<seq36>`，同毫秒按 emit 序 `listEventsAfter` 稳定。
- `runtime/tests/events.test.mjs`：去掉 `describe` 的 `concurrency: 1`。

**事件 id 与 §4.1**：未引入 ULID 库；用时间+进程内单调序的 `evt_*`，保证回放序，非规格字面 ULID。

## 验证

| 命令 | 结果 |
|------|------|
| `npx tsc -b --pretty false` | 退出 0（每提交后） |
| `node --check`（改动的 `runtime/*.mjs`） | 退出 0 |
| `node --test runtime/tests/events.test.mjs` ×2（默认并行） | 3/3 + 3/3 |
| `node runtime/smoke.mjs` | `status: ok` |
| Peer 回收 | 结束旧 4319 进程（pid 31748），拉起新 `node runtime/server.mjs`（pid 32385）；`curl http://127.0.0.1:4319/health` → **200** |
| `GET /api/v1/events` SSE（`Origin: http://127.0.0.1:5175`） | `text/event-stream`，首包 `: connected` + `id:`/`event:`/`data:` |
| Playwright 5175 §8 | **未对**：`/tmp/node_modules/playwright` 无 chromium 可执行体（需 `npx playwright install`） |
| §8.2 `biz_describe` 实流 `ai.tool.*` | **未对**：无 live AI 工具回合实测 |
| §8.3 IM 跨栈红点 / §8.4 断 4319 重连 | **未对**：无 Playwright + 无跨栈 IM 实操 |
| §8.5 5174 回归截图 | **未对** |

## 仍差 / 未对（规格 01）

| 项 | 说明 |
|----|------|
| 事件 id ULID | **仍差**：单调 `evt_*`，非 `evt_01J8…` ULID |
| `ai.tool.*` 端到端 | 代码在 `ai-stream.mjs`，BFF `follow` 仍 409；依赖 DSH 侧走 normalizer 才有 SSE（**未对**现网 AI 流） |
| 人工验收 §8 | 上表 Playwright / IM / 重连均未测 |
| `git push` | 本 checkout 无 `origin` remote |

## 需要 Ace

- 主栈 **4318** 若长期未重启：改 `runtime/*.mjs` 后需自行重启 BFF 才加载 `96fe7db`+（peer 4319 已在本轮回收后 200）。

## 对照（must-fix 闭合）

| must-fix | 状态 |
|----------|------|
| ai-stream emit | **已对**（代码） |
| lan-assist 指纹 emit | **已对**（`lan-assist-state-watch.mjs`） |
| biz.write.done | **已对** |
| IMScreen / Briefing 事件 | **已对** |
| listEventsAfter 并行单测 | **已对** |
| ULID | **仍差**（见上） |
| §8 人工 | **未对** |
