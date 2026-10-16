---
cursor:
  subagentId: "bc-057a233f-4360-5804-987d-e5c0f65e3fa7"
---

## 改动

- 提交：`91c4ec6` — `feat(plan): 整理待办 via askAiForResult`
- `git diff --stat`：`src/pages/Plan.tsx` | +159 −1

### 行为（对照 03 §6 commit 6）

- 待办 Tab 顶栏新增 `btn`「整理待办」（`Sparkles` 图标，与早报同类，未改 className 集合）。
- 点击调用 `askAiForResult({ intent:'整理待办', prompt: 规格原文, schema: TaskAdviceSchema, context:['tasks'] })`。
- `TaskAdviceSchema` 定义在 `Plan.tsx`（规格仅引用名、仓库内无独立文件）：`{ summary?, suggestions: [{ taskId, reason, patch }] }`，`patch` 字段对齐 `updateTask` 可 PATCH 的 Task 子集。
- 结果在既有 `RightDrawer`「整理建议」中列表展示；每条单独「应用」→ `updateTask`；已应用项禁用；**不批量、不自动改**。
- 超时 / 无结构化结果：抽屉内黄条「AI 没有提交结构化结果…」（与 `ask-ai` timeout 文案一致）；`schema_mismatch` 时展示 `raw` 并提示谨慎应用。

## 验证

| 步骤 | 做了什么 | 看到什么 | 截图 |
|---|---|---|---|
| 类型 | `npx tsc -b --pretty false` | 退出 0 | — |
| UI 顶栏 | Playwright @5175/plan，localStorage 注入 `ws_personal` + plan `full` | 「整理待办」按钮可见 | `media/wave4-03-tail/01-plan-todo-toolbar.png` |
| 点击整理 | 点击按钮 | 抽屉打开、「已向当前 AI 会话发送…」 | `02-organize-drawer-session.png` |
| 等待结果 | ~30s（peer 左栏「核心未连接」） | 抽屉内超时/失败文案（无 AI 会话时 `loadCurrentAiTarget` 失败路径） | `03-organize-drawer-timeout-banner.png` |

说明：5175 peer 栈左栏显示「本地核心还没接通」，未能走完「左栏收到 prompt → fde_submit_result」全链路；按钮 + 抽屉 + ask 调用路径已实测。主栈 5174 未在本任务中重跑验收项 7。

## 未做到 / 偏离规格

- 未实测：AI 返回合法 `suggestions` 后逐条 PATCH 改任务（依赖已连接 DSH + 当前会话）。
- 未加 `ContextChips`（可选，本版省略）。
- `TaskAdviceSchema` 形状由规格 §6 语义推导，非独立规格文档。

## 需要 Ace 决定

- 无
