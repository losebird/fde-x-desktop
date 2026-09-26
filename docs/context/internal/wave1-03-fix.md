---
cursor:
  subagentId: "bc-42397f9b-e00f-5916-9320-046651f49642"
---

# Wave 1 · Spec 03 must-fix（task.changed 总线 + Plan 订阅）

## 改动

| SHA | 提交信息 |
|-----|----------|
| `86f5136` | `feat(runtime): task.changed via event bus emit` |
| `0c1a6f4` | `feat(web): Plan subscribes to task.changed` |

- `runtime/routes/plan.mjs`：`emitTaskChanged` 改为 `emit('task.changed', { id, op }, { workspaceCwd })`（`../events.mjs`）；`workspaceCwd` 从 `workspaces.metadata_json` 的 `cwd`/`path` 解析（绝对路径才写入）；`ts` 由 `emit` 信封自带。CRUD 逻辑未改；`handlePlanRequest` 仍接收 `enqueueEvent`（未改 `server.mjs`）。
- `src/pages/Plan.tsx`：`useEvents(['task.changed'], …)` 触发 `hydratePlan(activeWorkspaceId)`；可选 `workspace` 过滤为当前工作区 `cwd`。三 Tab / 样式未动。

## 验证命令与结果

| 命令 | 结果 |
|------|------|
| `npx tsc -b --pretty false`（两次提交前） | exit 0 |
| `node --check runtime/routes/plan.mjs` | exit 0 |
| `node --test runtime/tests/plan.test.mjs` | 1/1 pass |
| `node runtime/smoke.mjs` | `status: ok` |
| `curl http://127.0.0.1:4319/health` | **未对** — peer BFF 未响应（未重启 4319，按指派跳过 live CRUD + `/api/v1/events/recent` 抽检） |

## 仍差 / 未对

| 项 | 说明 |
|----|------|
| 03 §8 人工 1–8 | **现网未测**（5175 Playwright / sqlite 行 / IM `source_ref` 等） |
| `整理待办` | 仍 defer 规格 02；本回合未加 |
| peer 栈 live `task.changed` | 4319 down，未 curl 验证 `events/recent` |
| `workspaceCwd` 与测试工作区 | plan 单测创建的 workspace 无 metadata `cwd` → 事件 `workspaceCwd: null`（SSE 全局可见，与 `matchesWorkspaceFilter` 一致）；有 cwd 的顶栏工作区会带过滤字段 |
| Git remote | 本地 `main` 无 `origin`，未 push |

## Must-fix 对照（本回合范围）

1. `plan.mjs` → `emit` + `workspaceCwd`/`ts`：**已对**（代码 + 单测/smoke）
2. `Plan.tsx` → `useEvents`：**已对**（代码 + tsc）
3. §8 人工验收：**未对**
