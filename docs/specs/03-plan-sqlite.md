# 03 · 计划模块接 SQLite（待办 / 日程 / 工作流）

依赖：01（事件，可选）。被依赖：06（早报读待办）、07（记忆写入）。协议：`00-agent-protocol.md`。

## 1. 目标

计划模块的数据真正落 SQLite（HANDOFF §4.5 承诺但未实现），按工作区隔离，刷新不丢；IM「摘成待办」落库；周视图用真日期；⌘K 能搜到任务；加一个「整理待办」的 AI 入口。

## 2. 范围与禁区

- 做：BFF CRUD API、前端 store 水合、`Plan.tsx` 接 API、`IMWorkspace.tsx` `addTask` 改走 API、周视图真日期、`CommandPalette` 读任务、「整理待办」按钮（用 `askAiForResult`，规格 02）、工作流最小执行器（4.1，待实现）。
- 不做：DSH plan-mode 集成、日历外部同步、拖拽排序、关键字 trigger 的执行、事件 trigger 的执行、新的定时调度器、绕过人工确认的 AI 写通道。
- 禁区：不改 `Plan.tsx` 三 Tab 结构与样式。

## 3. 现有代码接点

| 接点 | 位置 |
|---|---|
| 表 | `runtime/migrations/002_modules.sql` L111–174（tasks / events / workflows 相关表，字段以文件为准） |
| store | `src/store/app.ts` L490–501 `tasks`，L257–274 `buildInitial` 空数组，L798–834 `partialize` 不持久化 |
| 页面 | `src/pages/Plan.tsx`：待办 L85–249；日程 L264–442（周视图假日期 L365–387）；工作流 L450–691（按钮 L593–600 vs 文案 L681–683） |
| IM 摘成待办 | `IMWorkspace.tsx` L1517–1522 `addTask` |
| ⌘K | `CommandPalette.tsx` L77–78 硬编码 `[]` |
| 早报读任务 | `Briefing.tsx` L27–71 |
| 死代码 | `app.ts` L670–684 `runWorkflow`；`Plan.tsx` L4–5 未用 import |

## 4. 数据模型（已核实 `002_modules.sql` 真实表）

| 逻辑名 | 真实表 | 现有列 |
|---|---|---|
| 待办 | `tasks` | `id, workspace_id, title, notes, status, priority, due_at, completed_at, metadata_json, created_at, updated_at` |
| 日程 | **`calendar_events`**（L125–138） | `id, workspace_id, title, start_at, end_at, timezone, location, event_kind, metadata_json, created_at, updated_at` |
| 工作流 | `workflows` | `id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at` |
| 运行记录 | `workflow_runs` / `workflow_run_steps`（L163–187） | 待实现。按 4.1 写入已有列，不新增列 |

规则：**沿用现有表与列名**，不重命名。工作区键是 `workspace_id`（对应 Zustand `workspaces[].id`，其 `cwd` 由 workspaces 表/store 解析），API 用 `workspaceId`。需要但缺的列用 `006_plan_columns.sql` 只 `ALTER TABLE ADD COLUMN`：
- `tasks`: `source_ref TEXT`（如 `im:<requestId>`）、`tags_json TEXT DEFAULT '[]'`；`status` 取值约定 `todo|doing|done|paused`（应用层校验，不加 CHECK 以免与现有数据冲突）；`completed_at` 即规格里的 `done_at`。
- `calendar_events`: `source_ref TEXT`、`all_day INTEGER DEFAULT 0`、`note TEXT`（若 `metadata_json` 已承载则不加，用 metadata）。
- `workflows`: `status` 约定 `active|paused`；`definition_json` 即 steps。

索引：`(workspace_id, status)`、`(workspace_id, start_at)`（不存在才建）。

### 4.1 工作流最小执行器，待实现

下列行为都还没有实现。后续 PR 单独做，不放进第 9 节的前六条提交。

人可以触发 run。cron 到点也可以触发 run。两条路调用同一个 run。人要持有安全方案 S1 的页面令牌。被运行的是一条已保存的本地工作流。入口是 `POST /api/v1/plan/workflows/:id/run`。请求没有页面令牌时返回 401。`trigger.kind` 为 `cron` 时，到点由已有的 Host schedule 调用这个 run。cron 调用同样要带 S1 页面令牌。没有令牌就不跑。不新做调度器。关键字 trigger 只写入 `trigger_json`，不执行。事件 trigger 只保存，不执行。卡片写明这两种 trigger 未执行。

run 只接受本地 workflow id。不拿 Host job 的空 `steps` 去跑。接口向 `workflow_runs` 插入一行，`state` 为 `queued`。步骤可以是 `kind` 为 `ai` 的一步。这一步有提示。`sourceRef` 可选，用来点名一条业务记录。插入之后打开一个已有的 AI 会话来跑这一步。步骤开始后，把会话 id 写入该行的 `output_json`。会话结束后，把输出写回同一行的 `output_json`，并保留会话 id。每个步骤另写 `workflow_run_steps` 一行。该行的 `state`、`output_json` 和 `error_json` 分别记下状态、输出和错误。插入时写满这两张表已有的 NOT NULL 列。不新增列。

AI 发起的写一律先提案，再等人确认。确认前不改 `tasks`，也不改业务记录。提案写入 `audit_entries`。确认依赖安全方案里的 S1、S2、S3 页面令牌。run 和人的确认请求都必须带 S1 页面令牌。没有令牌时返回 401。人确认成功后才改任务或业务记录。AI 改记录要等 S2 的提案工具。没有该提案工具时，不提供改记录的写路径。S3 把计划写接口纳入同一令牌。步骤里改任务要等 S3。没有 S3 时，不提供改任务的写路径。会话里的写工具只有提案。不允许另开一条绕过确认的写通道。没有记忆 M1 时，要写记忆的步骤只留提案。失败原因写入该步骤的 `error_json`。该 run 的 `state` 不写成 `succeeded`。

人触发的 run、cron 到点调用和计划页「运行」按钮都待实现。后续 PR 做这个最小执行器。该 PR 依赖安全方案 S1 的页面令牌函数和 S2。步骤里改任务的确认另等 S3。cron 到点与后续的日程 Host schedule 共用同一次 run 调用。执行器 PR 不新做调度器。关键字 trigger 和事件 trigger 不纳入这些后续 PR。

## 5. API 契约（`runtime/routes/plan.mjs`）

所有路由带 `?workspaceId=`（GET）或 body `workspaceId`（写）。写操作走 Origin 闸。4.1 的 run 还要以页面令牌为准。只带 Origin、没有页面令牌时返回 401。

| 路由 | 入参 | 返回 |
|---|---|---|
| `GET /api/v1/plan/tasks` | `workspaceId, status?, q?` | `{ ok, data: Task[] }` |
| `POST /api/v1/plan/tasks` | `{ workspaceId, title, priority?, dueAt?, tags?, sourceRef? }` | `{ ok, data: Task }` + `emit('task.changed',{id,op:'insert'})` |
| `PATCH /api/v1/plan/tasks/:id` | 任意可改字段；`status:'done'` 自动填 `completed_at` | `{ ok, data }` + emit |
| `DELETE /api/v1/plan/tasks/:id` | — | `{ ok }` + emit |
| `GET /api/v1/plan/events?workspaceId&from&to`（读 `calendar_events`） | 时间窗（ms） | `{ ok, data: Event[] }` |
| `POST/PATCH/DELETE /api/v1/plan/events[/:id]` | 同 tasks 模式 | |
| `GET /api/v1/plan/workflows?workspaceId` | | `{ ok, data }` |
| `POST/PATCH/DELETE /api/v1/plan/workflows[/:id]` | `status` 只能 `active|paused` | |
| `POST /api/v1/plan/workflows/:id/run` | 页面令牌。行为见 4.1。待实现 | 200，新建行 `workflow_runs.state` 为 `queued`。无令牌 401 |

错误：404 `not_found`、422 `invalid_status`、400 缺 `workspaceId`。

`runtime-api.ts` 新增：`listTasks/createTask/updateTask/deleteTask/listEvents/…/listWorkflows/…`，类型 `Task/PlanEvent/Workflow` 放 `src/lib/types.ts`。

## 6. 前端契约

- `app.ts`（`buildInitial` tasks L262；`partialize` L872–883；migrate L904）：`tasks/events/workflows` 改为**缓存**，不 persist；新增 `hydratePlan(workspaceId)` 拉三个列表；`addTask/updateTask/…` 改为「先调 API，成功后更新缓存」（乐观更新可选，失败回滚 + 黄条）。
- `Plan.tsx`：挂载与工作区切换时 `hydratePlan`；订阅 `task.changed` 事件刷新（规格 01 可用时）。
- **周视图**（L365–387）：以本周一为起点生成 7 天真日期（`Intl.DateTimeFormat('zh-CN')`），每格显示落在当天的 `events`；无事件显示现有空态文案，不凑格。
- **工作流**：`paused` 时「启用」可点，`status` 改为 `active`。`active` 时「暂停」可点。删除内存里的 `runWorkflow` 和未用 import。运行只走 4.1 的接口。「运行」按钮待实现。手动 trigger 和 cron trigger 可以运行。关键字 trigger 和事件 trigger 保持不可运行，文案写明未执行。
- **IM 摘成待办**（`IMWorkspace.tsx` L1517–1522）：`createTask({ workspaceId: activeWorkspaceId, title, sourceRef:'im:'+requestId })`，成功黄条「已加入计划」，失败红条。
- **⌘K**：`tasks` 分组读 store 缓存（已水合），命中后打开计划面板并高亮该任务（现有 `togglePanel('plan')` + `selectTask` 若无则加最小 state）。
- **「整理待办」按钮**（待办 Tab 顶栏，复用现有按钮样式）：`askAiForResult({ intent:'整理待办', prompt:'根据以下待办给出去重/合并/优先级建议，用 fde_submit_result 提交', schema: TaskAdviceSchema, context:['tasks'] })` → 结果以「建议」列表弹在抽屉里，人点「应用」逐条 PATCH。**不自动改**。

## 7. 错误与降级

- API 不可用（4318 未起）→ 计划页顶部黄条「计划服务未就绪」，列表保留上次缓存（只读）。
- 无工作区 → Empty「先在顶栏选择工作区」。

## 8. 验收清单

人工（5175）：
1. 计划 → 新建任务「验收 A」→ 刷新页面 → 仍在；`sqlite3 runtime/data/fde-workstation-peer.sqlite 'select title from tasks'` 有它。
2. 切换顶栏工作区 → 列表按工作区变化；切回 → 「验收 A」回来。
3. IM 任一消息 → 摘成待办 → 计划里出现，`source_ref` 为 `im:<id>`。
4. 日程周视图表头为本周真实日期；新建一个明天的事件 → 出现在对应格。
5. 工作流启用和暂停。新建为 paused。「启用」后 `status` 为 `active`。「暂停」后 `status` 为 `paused`。
6. ⌘K 输入「验收」→ 任务分组出现「验收 A」→ 回车打开计划并高亮。
7. 「整理待办」→ 左栏当前会话收到 prompt → 建议抽屉出现 →「应用」一条 → 任务变更。
8. 5174 回归：计划页可打开（首次会空，因为之前只在内存）。
9. 工作流 run，待实现，后续 PR。带页面令牌时返回 200，新行 `workflow_runs.state` 为 `queued`。步骤开始后，该行 `output_json` 含会话 id。会话若改任务，只增加待确认提案，并写入 `audit_entries`，不改 `tasks`。无令牌时返回 401。关键字 trigger 和事件 trigger 在卡片上显示未执行。

自动化：`runtime/tests/plan.test.mjs`：CRUD、工作区隔离、状态校验、completed_at 自动填。工作流 run 的自动化留在后续 PR，见 4.1。

## 9. 提交拆分

1. `feat(runtime): plan tasks/events/workflows CRUD routes`
2. `feat(web): hydrate plan from API; drop persisted in-memory plan`
3. `fix(plan): real week dates; workflow enable and pause; remove dead run`
4. `feat(im): 摘成待办 persists via plan API`
5. `feat(palette): search tasks`
6. `feat(plan): 整理待办 via askAiForResult`（依赖规格 02 落地，否则跳过并在报告注明）
7. 不在本拆分。后续 PR 实现 4.1 的工作流最小执行器。

## 10. 开放问题

已关闭：真实表名与列见 §4；`events` 在 store 里的字段名保留，映射到 `calendar_events`。
