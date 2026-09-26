# 03 · 计划模块接 SQLite（待办 / 日程 / 工作流）

依赖：01（事件，可选）。被依赖：06（早报读待办）、07（记忆写入）。协议：`00-agent-protocol.md`。

## 1. 目标

计划模块的数据真正落 SQLite（HANDOFF §4.5 承诺但未实现），按工作区隔离，刷新不丢；IM「摘成待办」落库；周视图用真日期；⌘K 能搜到任务；加一个「整理待办」的 AI 入口。

## 2. 范围与禁区

- 做：BFF CRUD API、前端 store 水合、`Plan.tsx` 接 API、`IMWorkspace.tsx` `addTask` 改走 API、周视图真日期、`CommandPalette` 读任务、「整理待办」按钮（用 `askAiForResult`，规格 02）。
- 不做：DSH plan-mode 集成、工作流自动执行（保持 disabled，文案改一致）、日历外部同步、拖拽排序。
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
| 运行记录 | `workflow_runs` / `workflow_run_steps`（L163–187） | 本版只读不写 |

规则：**沿用现有表与列名**，不重命名。工作区键是 `workspace_id`（对应 Zustand `workspaces[].id`，其 `cwd` 由 workspaces 表/store 解析），API 用 `workspaceId`。需要但缺的列用 `006_plan_columns.sql` 只 `ALTER TABLE ADD COLUMN`：
- `tasks`: `source_ref TEXT`（如 `im:<requestId>`）、`tags_json TEXT DEFAULT '[]'`；`status` 取值约定 `todo|doing|done|paused`（应用层校验，不加 CHECK 以免与现有数据冲突）；`completed_at` 即规格里的 `done_at`。
- `calendar_events`: `source_ref TEXT`、`all_day INTEGER DEFAULT 0`、`note TEXT`（若 `metadata_json` 已承载则不加，用 metadata）。
- `workflows`: `status` 约定 `active|paused`；`definition_json` 即 steps。

索引：`(workspace_id, status)`、`(workspace_id, start_at)`（不存在才建）。

## 5. API 契约（`runtime/routes/plan.mjs`）

所有路由带 `?workspaceId=`（GET）或 body `workspaceId`（写）。写操作走 Origin 闸。

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

错误：404 `not_found`、422 `invalid_status`、400 缺 `workspaceId`。

`runtime-api.ts` 新增：`listTasks/createTask/updateTask/deleteTask/listEvents/…/listWorkflows/…`，类型 `Task/PlanEvent/Workflow` 放 `src/lib/types.ts`。

## 6. 前端契约

- `app.ts`（`buildInitial` tasks L262；`partialize` L872–883；migrate L904）：`tasks/events/workflows` 改为**缓存**，不 persist；新增 `hydratePlan(workspaceId)` 拉三个列表；`addTask/updateTask/…` 改为「先调 API，成功后更新缓存」（乐观更新可选，失败回滚 + 黄条）。
- `Plan.tsx`：挂载与工作区切换时 `hydratePlan`；订阅 `task.changed` 事件刷新（规格 01 可用时）。
- **周视图**（L365–387）：以本周一为起点生成 7 天真日期（`Intl.DateTimeFormat('zh-CN')`），每格显示落在当天的 `events`；无事件显示现有空态文案，不凑格。
- **工作流**：`paused` 时「启用」可点（→ `active`），`active` 时「暂停」可点；「运行」保持 `disabled`，tooltip 与抽屉文案统一为「本版不自动运行」。删除 `runWorkflow` 死代码与未用 import。
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
5. 工作流：新建（paused）→「启用」可点变 active →「暂停」可点；「运行」灰且 tooltip 一致。
6. ⌘K 输入「验收」→ 任务分组出现「验收 A」→ 回车打开计划并高亮。
7. 「整理待办」→ 左栏当前会话收到 prompt → 建议抽屉出现 →「应用」一条 → 任务变更。
8. 5174 回归：计划页可打开（首次会空，因为之前只在内存）。

自动化：`runtime/tests/plan.test.mjs`：CRUD、工作区隔离、状态校验、completed_at 自动填。

## 9. 提交拆分

1. `feat(runtime): plan tasks/events/workflows CRUD routes`
2. `feat(web): hydrate plan from API; drop persisted in-memory plan`
3. `fix(plan): real week dates; workflow toggle consistency; remove dead code`
4. `feat(im): 摘成待办 persists via plan API`
5. `feat(palette): search tasks`
6. `feat(plan): 整理待办 via askAiForResult`（依赖规格 02 落地，否则跳过并在报告注明）

## 10. 开放问题

已关闭：真实表名与列见 §4；`events` 在 store 里的字段名保留，映射到 `calendar_events`。
