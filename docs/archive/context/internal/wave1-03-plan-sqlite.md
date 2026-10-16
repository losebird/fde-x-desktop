---
cursor:
  subagentId: "bc-e7e22044-1b86-53ec-bc0b-d3c033781f59"
---

# Wave 1 · Spec 03 计划 SQLite 实施报告

## 改动

| 提交 | 说明 | 主要文件 |
|------|------|----------|
| `fdbfae6` | feat(runtime): plan tasks/events/workflows CRUD routes | `runtime/migrations/006_plan_columns.sql`, `runtime/routes/plan.mjs`, `runtime/tests/plan.test.mjs`, `runtime/server.mjs` |
| `f9a66b2` | feat(web): hydrate plan from API; drop persisted in-memory plan | `src/lib/types.ts`, `src/lib/runtime-api.ts`, `src/store/app.ts` |
| `c4fc81d` | feat(palette): search tasks（含 Plan 周视图/工作流修正，原 commit 3 因 index.lock 与 palette 合并） | `src/pages/Plan.tsx`, `src/components/CommandPalette.tsx` |
| `2ffbec5` | feat(im): 摘成待办 persists via plan API | `src/components/IMWorkspace.tsx` |

**未做提交 6**：`feat(plan): 整理待办 via askAiForResult` — 仓库内无 `askAiForResult`（规格 02 未落地），按规格跳过。

### 实现摘要

- BFF：`/api/v1/plan/tasks|events|workflows` CRUD；`calendar_events` / `tasks` / `workflows` 表名与列名按 `002_modules.sql` + `006_plan_columns.sql`；写操作 `task.changed` 进 outbox。
- 前端：`hydratePlan(workspaceId)` 拉三列表；`tasks/events/workflows` 仅内存缓存；失败黄条「计划服务未就绪」；无工作区 Empty。
- 周视图：本周一～日真实日期（`Intl.DateTimeFormat('zh-CN')`），按日过滤 events，无事件显示「暂无日程」。
- 工作流：启用/暂停可调 API；运行 disabled，tooltip/抽屉文案「本版不自动运行」；移除 `runWorkflow`。
- IM：`createTask` + `sourceRef: im:<messageId>`；成功/失败黄条/红条。
- ⌘K：`useCurrentTasks()` + `selectTask` 高亮。

### 偏离 / 风险

1. **`fdbfae6` 中 `runtime/server.mjs`**：提交时工作区已含其它 Wave 路由挂载（`events.mjs` / `presets.mjs` / `mcp.mjs` 的 import 与 `handleEventsRoutes` 等），与本次 plan 的 `handlePlanRequest` 一并进入该提交。本 agent 仅应增加 plan 两行；合并后需协调器与其它 agent 核对 server 归属。
2. **规格拆分**：`fix(plan): real week dates…` 未单独提交，合入 `c4fc81d`（index.lock 重试期间 palette 提交带上 `Plan.tsx`）。

## 验证

| 步骤 | 命令 | 结果 |
|------|------|------|
| TS | `npx tsc -b --pretty false` | 退出 0 |
| plan 路由语法 | `node --check runtime/routes/plan.mjs` | 通过 |
| server 语法 | `node --check runtime/server.mjs` | 通过 |
| 计划 API 单测 | `node --test runtime/tests/plan.test.mjs` | 1 pass（CRUD、双工作区隔离、`invalid_status`、`completed_at`） |
| 合约 smoke | `node runtime/smoke.mjs` | **失败**：`file delete should be 200, got 500`（文件模块，非 plan 路由；可能与并行 spec 02 有关） |
| 5175/5174 UI 人工验收 | — | **现网未测**（本 worker 未跑 peer 栈 Playwright） |

**Ace 侧**：改动了 `runtime/*.mjs`，需重启 peer 栈（4319）后主栈/peer 各测一次计划验收清单；勿杀 `pnpm dev`。

## 未做到 / 仍差

- 未对：`整理待办` AI 入口（依赖规格 02 `askAiForResult`）。
- 未对：`task.changed` 前端 SSE 订阅（规格 01 事件总线前端未接；仅 BFF outbox emit）。
- 未对：规格 §8 人工 1–8 逐步截图（现网未测）。
- 仍差：smoke 文件删除 500（待 files/events 相关 agent 修）。

## 需要 Ace 决定

- 无（除非要强制把 `server.mjs` 的 fdbfae6 拆成仅 plan 的 minimal diff）。
