---
cursor:
  subagentId: "bc-96197564-840e-522f-a13e-6e7c92b94d1f"
---

# Wave 1 审查裁决（Ace Mac checkout）

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`（`main`，审查时 HEAD `84691f9` 及更早 Wave 1 提交）  
**审查时间**：2026-09-17  
**审查方式**：只读代码 + 本机命令；未改产品文件、未 commit。4318/4319 未重启（`pnpm dev` / `dev:peer` 未动）。

## 总览裁决

| 规格 | 裁决 | 一句话 |
|------|------|--------|
| **01** 事件总线 | **需小修** | BFF SSE/核心 `emit` 已落地，但规格 §2/§6/§9 要求的 emit 源与 IM/Briefing 迁移未做；id 非 ULID；`events.test.mjs` 在默认并行 `node --test` 下间歇失败。 |
| **03** 计划 SQLite | **需小修** | CRUD/水合/IM 摘待办/⌘K/周视图等主路径在代码与单测/smoke 上成立；`整理待办` 按波次 1 正确跳过；`task.changed` 未走事件总线实时广播，前端未订阅；人工验收未做。 |
| **08** preset + MCP | **需小修** | 路由/抽屉/MCP 两区 UI 与自动化测试、smoke 通过；`fde-*` preset 与规格人工清单依赖 02/现网实操，本轮无截图证据。 |

**不符合「合并保留」**：`docs/specs/README.md` 完成定义要求验收清单人工项有截图证据，且三份规格均有未闭合的规格正文项（见下表 must-fix）。  
**无一档建议「回滚重做」**：主干能力可保留，缺口以补提交/补验收为主。

---

## 自动化验证（本机实测）

| 项 | 命令 | 结果 |
|----|------|------|
| TS | `npx tsc -b --pretty false` | 退出 0 |
| Smoke | `node runtime/smoke.mjs` | `status: ok`（迁移含 4、6） |
| 单测（并行，默认） | `node --test runtime/tests/events.test.mjs runtime/tests/plan.test.mjs runtime/tests/presets.test.mjs runtime/tests/mcp.test.mjs` | **间歇失败**：`since replay order and workspace filter`（约 3/5 轮失败） |
| 单测（串行） | 同上 + `--test-concurrency=1` | 12/12 通过 |
| 4318 health | `curl http://127.0.0.1:4318/health` | 200 |
| 4319 health | `curl http://127.0.0.1:4319/health` | 200 |
| SSE 4319 | `GET /api/v1/events?workspace=/tmp/ws`，`Origin: http://127.0.0.1:5175` | `text/event-stream`，首包含 `id:` / `event:` / `data:` |
| SSE 4318 | 同上，`Origin: http://127.0.0.1:5174` | 同上（**`curl -I` 为 404**，GET 正常；HEAD 未实现） |
| Plan | `GET /api/v1/plan/tasks?workspaceId=test` | `{ ok: true, data: [] }` |
| Presets | `GET /api/v1/ai/presets` | 4 条 `source: shipped` |
| MCP v2 | `GET /api/v1/mcp/servers` | `{ mcp: [], connectors: [...] }` |

5174 / 5175 Vite 在听（`lsof`）；**未跑** Playwright 逐步截图，亦未在 UI 内新建任务/导入 preset/触发 AI 工具流（避免编造业务数据）。

---

## 01 · 事件总线 — **需小修**

### 已对（代码证据）

- `runtime/events.mjs`：`emit` / `subscribe`、outbox 扩展列（`runtime/migrations/004_events.sql`）。
- `runtime/routes/events.mjs`：SSE、`/recent`、Origin 403、32 连接 429（单测覆盖）。
- `src/lib/events.ts`：`useEvents` / `getEventStream` / 降级轮询 / `useEventStreamStatus`。
- `main` 提交：`475cef3`、`cf8ae85`、`84691f9`（缺规格 §9 第 3、5 条对应提交）。

### 仍差 / 未对（规格正文，非报告）

| 项 | 规格 | 代码现状 |
|----|------|----------|
| `ai.tool.called` / `ai.tool.finished` | §4.2、§9 提交 3 | `runtime/ai-stream.mjs` **无** `emit` |
| lan-assist 指纹 → `biz.*` / `im.*` | §2、§9 提交 3 | **未做**（仍只靠 `GET /api/v1/im/state`） |
| `biz.write.done` | §4.2 | `POST /api/v1/biz/write`（`server.mjs` ~L1763）**未**接 `emit` |
| IM/Briefing 轮询 → `useEvents` | §6 | `IMScreen.tsx` ~L83 `setInterval` 4s；`Briefing.tsx` ~L60 8s；全仓 **无** `useEvents` 引用 |
| 事件 `id` ULID | §4.1 | `runtime/events.mjs` L77 `createId('evt')` |
| 提交拆分完整 | §9 | 缺 `emit ai.tool.* and im/biz…`、`refactor(web): IM unread via events` |

### Must-fix（建议下一波补提交）

1. `runtime/ai-stream.mjs` — 在 tool/call、tool/result 路径 `emit` `ai.tool.*`。
2. `runtime/server.mjs`（或独立模块）— lan-assist `/state` 指纹变化时 `emit` `biz.sheet.pending` / `im.*`（规格触发点表）。
3. `runtime/server.mjs` — `POST /api/v1/biz/write` 成功路径 `emit` `biz.write.done`。
4. `src/components/IMScreen.tsx` — 未读：首次 `imState` + 订阅 `im.unread.changed`（删/缩 4s 轮询为主路径）。
5. `src/pages/Briefing.tsx` — 同上模式迁到事件。
6. `runtime/events.mjs` + `runtime/tests/events.test.mjs` — 同毫秒多事件时 `listEventsAfter` 与 `id` 字典序不稳定导致**并行全量 `node --test`  flaky**（需单调序或测试隔离/串行约定）。
7. （可选一致化）`runtime/events.mjs` L77 — ULID 与规格 §4.1 对齐，或规格勘误写死 `createId`。

---

## 03 · 计划 SQLite — **需小修**

### 已对

- BFF：`runtime/routes/plan.mjs` + `runtime/migrations/006_plan_columns.sql` + `runtime/tests/plan.test.mjs`（CRUD、隔离、`invalid_status`、`completed_at`）。
- 前端：`src/store/app.ts` `hydratePlan`、任务/日程/工作流 API；`src/pages/Plan.tsx` 水合；`src/components/IMWorkspace.tsx` 摘待办走 API；`src/components/CommandPalette.tsx` 搜任务。
- 提交：`fdbfae6`、`f9a66b2`、`c4fc81d`、`2ffbec5`；**无** `整理待办` 提交 — **符合**波次 1 说明与 §9 第 6 条（依赖规格 02 `askAiForResult`）；全仓 **无** `整理待办` / `askAiForResult` 字符串。

### 仍差 / 未对

| 项 | 说明 |
|----|------|
| `task.changed` 实时 | `runtime/routes/plan.mjs` `emitTaskChanged` 调 `enqueueEvent`（`db.mjs` L135），**不**调 `events.mjs` `emit` → SSE 订阅端收不到即时推送（仅落库旧 outbox 形状，且无 `ts`/`workspace_cwd` 列）。 |
| 前端刷新 | `src/pages/Plan.tsx` 仅 `hydratePlan`，**未** `useEvents(['task.changed'], …)`（规格 §6）。 |
| 人工 §8 1–8 | **现网未测**（无 sqlite 行级截图、无 IM 摘待办 walk、无整理待办 — 后一项属 02）。 |
| Git 卫生 | `fdbfae6` 的 `runtime/server.mjs` 同时挂载 events/plan/presets/mcp（03 报告已承认）；功能上当前 `server.mjs` L70–75、L912、L1274、L2460 分派存在。 |
| 提交 3 独立 | 周视图/工作流修正合入 `c4fc81d` 而非单独 `fix(plan):…` 提交。 |

### Must-fix

1. `runtime/routes/plan.mjs` — `task.changed` 应走 `emit`（或统一 `enqueueEvent` → 事件总线桥接），并带 `workspaceCwd`/`ts` 供 SSE 过滤。
2. `src/pages/Plan.tsx` — 在 01 源补齐后订阅 `task.changed` 刷新缓存。
3. 验收 — 按 §8 在 5175 补人工步骤与截图（尤其持久化、工作区隔离、IM `source_ref`）。

### 03「整理待办」defer

**正确**：规格 §9 第 6 条与 README 波次 1 明确不含「整理待办」；依赖规格 02，当前跳过合理，**不算** Wave 1 缺陷。

---

## 08 · preset 导入 + MCP — **需小修**

### 已对

- 路由：`runtime/routes/presets.mjs`、`runtime/routes/mcp.mjs`；单测 8/8；smoke 绿。
- UI：`src/components/settings/PresetImportDrawer.tsx` + `CoreSettings.tsx` 扩展（导入按钮、来源 Tag、用户删）；`src/pages/MCP.tsx` MCP/连接器两区、`streamable-http`、重载文案、错误条（非 `catch→[]`）。
- 顶栏：`defaultPanels` 仅在 `src/store/app.ts`，未见 Wave 1 新增顶栏模块。
- `src/lib/runtime-api.ts`：preset/MCP 客户端（部分类型在 `f9a66b2` plan 提交中，行为与 §5 一致）。

### 仍差 / 未对

| 项 | 说明 |
|----|------|
| 人工 §7 1–7 | **现网未测**（无 Playwright `/tmp/fdex-08-*.png`）。 |
| `fde-app-builder` / `fde-briefing` | `GET /api/v1/ai/presets` 仅 4 条 shipped；规格 §7.1 依赖 **02 `ensurePresets()`**。 |
| Git 导入实测 | 未在本审查中跑 `FDE_ALLOW_GIT_IMPORT=1` + clone。 |
| `runtime/server.mjs` | 08 四提交无 diff；挂载在 `fdbfae6`（与 03 交叉）。 |

### Must-fix

1. 规格 §7 人工清单 — 5175 逐步 + 截图（导入目录、删 user preset、MCP streamable-http 保存与重载文案）。
2. （依赖 02）补齐 `source: fde` preset 后再验 §7.1。
3. （协调）若要求提交历史严格对应 §8 四条，需接受 `runtime-api.ts` 落在 `f9a66b2` 或文档化例外。

---

## 交叉风险（用户点名）

| 风险 | 结论 |
|------|------|
| 01 emit 源 / IM 轮询 | **仍为真**（见上表） |
| `fdbfae6` 混合 `server.mjs` 挂载 | **仍为真**；当前树上一致、可运行 |
| `runtime-api.ts` 03/08 共享 | **仍为真**；`f9a66b2` 含 plan + preset/MCP 客户端 |
| 03 整理待办 → 02 | **defer 正确** |
| 08 UI vs 规格 | 结构符合（Drawer、连接器区、无新顶栏）；缺人工证据 |
| ULID vs `createId` | **仍差** |
| 4318/4319 陈旧 runtime | 本审查 **未** 杀进程重启；4318/4319 GET SSE 与 health **可用**；主栈若长期未重启，Ace 仍应按协议在改 `runtime/*.mjs` 后自行重启 BFF |

---

## 人工清单（5174/5175）本审查可 walk 范围

**已摸过（轻量）**：端口存活；BFF JSON/SSE 抽样 curl；代码阅读 CoreSettings/MCP/Plan 接点。

**未对（需真实工作区/会话/数据或 Playwright）**：

- 01：AI `biz_describe` 工具流事件、IM 红点免轮询、断 4319 重连回放。
- 03：新建「验收 A」刷新持久化、sqlite 行、IM 摘待办、周视图明天事件、⌘K 高亮、整理待办（02）。
- 08：完整导入/删除 preset  UI、git 导入、MCP 重载后在线与工具列表、5174 回归截图。

---

## 协调建议（非 patch）

1. 先闭合 **01** emit 源 + IM/Briefing 迁移 + 稳定 `events.test.mjs`，再让 **03** 接 `task.changed` SSE。
2. Wave 1 三份规格统一标 **需小修**；补一轮人工验收后再议是否单项升为「合并保留」。
3. CI/协议写明：跑 Wave 1 单测时 `node --test --test-concurrency=1 …` 或修 `listEventsAfter` 同毫秒序。

---

## 参考

- Agent 报告：`internal/wave1-01-event-bus.md`、`internal/wave1-03-plan-sqlite.md`、`internal/wave1-08-preset-import.md`
- 完成定义：`docs/specs/README.md` §完成定义
