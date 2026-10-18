# 03 · 计划模块接 SQLite（待办 / 日程 / 工作流）

依赖：01（事件，可选）。被依赖：06（早报读待办）、07（记忆写入）。协议：`00-agent-protocol.md`。

## 1. 目标

计划模块的数据真正落 SQLite（HANDOFF §4.5 承诺但未实现），按工作区隔离，刷新不丢；IM「摘成待办」落库；周视图用真日期；⌘K 能搜到任务；加一个「整理待办」的 AI 入口。

## 2. 范围与禁区

- 做：BFF CRUD API、前端 store 水合、`Plan.tsx` 接 API、`IMWorkspace.tsx` `addTask` 改走 API、周视图真日期、`CommandPalette` 读任务、「整理待办」按钮（用 `askAiForResult`，规格 02）、工作流最小执行器（4.1，待实现）。
- 不做：DSH plan-mode 集成、日历外部同步、拖拽排序、关键字 trigger 的执行、事件 trigger 的执行、绕过人工确认的 AI 写通道、把页面令牌交给 Host、AI 或模型。
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

人通过外部 HTTP 触发 run。入口是 `POST /api/v1/plan/workflows/:id/run`。被运行的是一条已保存的本地工作流。这个请求必须带安全方案 S1 的页面令牌。没有页面令牌时返回 401。只带 Origin、没有页面令牌时也返回 401。

页面令牌和 `bridge.token` 是两把不同的密钥。Host 现在能读 `bridge.token`。AI、模型和 Host 都读不到页面令牌。页面令牌永远不交给 Host、AI 或模型。fde-x server 在 HTTP 层核对该令牌。核对通过后，这条 HTTP 路由自己开始这次人工运行。它不调用调度器专用的内部 run 函数，也不把页面令牌传给 AI 会话、模型或 Host。

`trigger.kind` 为 `cron` 时，到点由 fde-x server 进程内的调度器调用只属于它的内部 run 函数。cron 不经过需要页面令牌的 HTTP 入口，也不携带页面令牌。该调度器待实现。没有 S3 时不上线。Host schedule 现在只有目录的 list 和 delete，不会 POST run。cron 因此不走 Host schedule。

关键字 trigger 只写入 `trigger_json`，不执行。事件 trigger 只保存，不执行。卡片写明这两种 trigger 未执行。以后若要执行这两种 trigger，改变它们到点或触发时会跑什么的写入，也按下面的到点写入原则。

人工 HTTP 路由和调度器的内部 run 函数各自写入运行记录，互不调用。两者都只接受本地 workflow id，都不拿 Host job 的空 `steps` 去跑。两者都向 `workflow_runs` 插入一行，`state` 为 `queued`。步骤可以是 `kind` 为 `ai` 的一步。这一步有提示。`sourceRef` 可选，用来点名一条业务记录。插入之后打开一个已有的 AI 会话来跑这一步。步骤开始后，把会话 id 写入该行的 `output_json`。会话结束后，把输出写回同一行的 `output_json`，并保留会话 id。每个步骤另写 `workflow_run_steps` 一行。该行的 `state`、`output_json` 和 `error_json` 分别记下状态、输出和错误。插入时写满这两张表已有的 NOT NULL 列。不新增列。

这个内部 run 函数不对外暴露。不挂 MCP，不挂 bridge，不挂 HTTP。唯一调用者是进程内调度器。人工 HTTP 路由不是它的调用者。

AI 发起的写一律先提案，再等人确认。提案生成时向 `audit_entries` 记一条 `awaiting_approval`。人确认时再记一条。人拒绝时再记一条。`tasks` 和业务记录只在确认成功后才写。拒绝不写这些表。确认人是持有页面令牌的人类用户。确认或拒绝的请求从页面发出，带的是页面令牌，不是 `bridge.token`。没有页面令牌时返回 401。AI、模型和 Host 读不到这把页面令牌。`audit_entries.outcome` 的现有 CHECK 还没有 `awaiting_approval` 时，由 S2 补上这个取值。不另造第二张审计表。

cron 触发的运行适用同一条规则。AI 在这次运行里的任何写入都只生成提案。提案时记 `awaiting_approval`。确认或拒绝时各再记一条。业务表只在确认后才写。

任何会改变到点自动执行什么、何时执行、或是否执行的写入，都必须带页面令牌，或者走提案由人确认。只带 Origin 返回 401。新建 cron 工作流、置为 active、改 trigger、改 `definition_json`、改步骤、改 prompt，都只是例子，不是完整清单。一个请求里只要有一项落入这条原则，整个请求都按它处理。不能只留下其中不敏感的字段。AI 读不到页面令牌，所以 AI 只能走提案。持有页面令牌的人可以直接写。这类提案的审计与上面相同。走提案时，确认前不改会进入到点运行的定义、trigger 和是否执行。这条原则待实现，并且依赖 S3。S3 是计划写接口加固。只有 S1 和 S2 时，不提供这类写路径，进程内调度器也不上线。

复制、导入、以及从另一条工作流生成新行，都按这条原则。把 `paused` 改回 `active` 也按这条原则。暂停和删除同样改变是否执行，也按这条原则。工作流写接口不改 `workspace_id`。以后若要改，也按这条原则。

工作流步骤可以点名一条计划任务或业务记录。改那条任务或记录不在本规格另开写路径。任务写入按 S3。业务记录写入按 S1 和 S2。到点发给模型的提示只包含人已确认的定义。某个字段一旦会进入这份提示，改它就落入上面的原则。

调度器上线时，库里已经存在的 active 且 `trigger.kind` 为 `cron` 的行先不跑。人用页面令牌重新确认一次之后，该行才按 cron 跑。只带 Origin 的请求不能完成这次确认。确认记在该工作流行上。现有列不够时，由第 8 条那个 PR 增加一列，不新造表。

AI 改记录要等 S2 的提案工具。没有该提案工具时，不提供改记录的写路径。S3 把计划写接口纳入同一把页面令牌。步骤里改任务要等 S3。没有 S3 时，不提供改任务的写路径。会话里的写工具只有提案。不允许另开一条绕过确认的写通道。调度器写入的 `workflow_runs` 不是 AI 写任务或业务记录的通道。没有记忆 M1 时，要写记忆的步骤只留提案。失败原因写入该步骤的 `error_json`。该 run 的 `state` 不写成 `succeeded`。

人触发的 HTTP run 和计划页「运行」按钮待实现。它们依赖安全方案 S1 的页面令牌函数和 S2。进程内 cron 调度器另待实现，依赖 S3，不能只靠 S1 和 S2 上线。步骤里改任务的确认另等 S3。关键字 trigger 和事件 trigger 不纳入这些后续 PR。

## 5. API 契约（`runtime/routes/plan.mjs`）

所有路由带 `?workspaceId=`（GET）或 body `workspaceId`（写）。写操作走 Origin 闸。会改变到点自动执行什么、何时执行或是否执行的写入见 4.1。只带 Origin 返回 401。这类写入待实现，依赖 S3。外部 HTTP 的 `POST /api/v1/plan/workflows/:id/run` 还必须带安全方案 S1 的页面令牌。这把页面令牌不是 `bridge.token`。只带 Origin、没有页面令牌时返回 401。cron 到点不走这条 HTTP 路由。调度器的内部 run 函数不挂在这条路由上，也不挂 MCP 或 bridge。AI、模型和 Host 读不到这把页面令牌。

| 路由 | 入参 | 返回 |
|---|---|---|
| `GET /api/v1/plan/tasks` | `workspaceId, status?, q?` | `{ ok, data: Task[] }` |
| `POST /api/v1/plan/tasks` | `{ workspaceId, title, priority?, dueAt?, tags?, sourceRef? }` | `{ ok, data: Task }` + `emit('task.changed',{id,op:'insert'})` |
| `PATCH /api/v1/plan/tasks/:id` | 任意可改字段；`status:'done'` 自动填 `completed_at` | `{ ok, data }` + emit |
| `DELETE /api/v1/plan/tasks/:id` | — | `{ ok }` + emit |
| `GET /api/v1/plan/events?workspaceId&from&to`（读 `calendar_events`） | 时间窗（ms） | `{ ok, data: Event[] }` |
| `POST/PATCH/DELETE /api/v1/plan/events[/:id]` | 同 tasks 模式 | |
| `GET /api/v1/plan/workflows?workspaceId` | | `{ ok, data }` |
| `POST/PATCH/DELETE /api/v1/plan/workflows[/:id]` | `status` 只能 `active|paused`。会改变到点执行内容、时间或是否执行的写入见 4.1。只带 Origin 返回 401。待实现，依赖 S3 | |
| `POST /api/v1/plan/workflows/:id/run` | 外部 HTTP。页面令牌，不是 `bridge.token`。见 4.1。待实现 | 200，新建行 `workflow_runs.state` 为 `queued`。无令牌或只带 Origin 时 401 |

错误：404 `not_found`、422 `invalid_status`、400 缺 `workspaceId`。

`runtime-api.ts` 新增：`listTasks/createTask/updateTask/deleteTask/listEvents/…/listWorkflows/…`，类型 `Task/PlanEvent/Workflow` 放 `src/lib/types.ts`。

## 6. 前端契约

- `app.ts`（`buildInitial` tasks L262；`partialize` L872–883；migrate L904）：`tasks/events/workflows` 改为**缓存**，不 persist；新增 `hydratePlan(workspaceId)` 拉三个列表；`addTask/updateTask/…` 改为「先调 API，成功后更新缓存」（乐观更新可选，失败回滚 + 黄条）。
- `Plan.tsx`：挂载与工作区切换时 `hydratePlan`；订阅 `task.changed` 事件刷新（规格 01 可用时）。
- **周视图**（L365–387）：以本周一为起点生成 7 天真日期（`Intl.DateTimeFormat('zh-CN')`），每格显示落在当天的 `events`；无事件显示现有空态文案，不凑格。
- **工作流**：删除内存里的 `runWorkflow` 和未用 import。暂停、重新启用、改定义和改步骤，凡会改变到点执行内容、时间或是否执行的保存，都见 4.1。待实现，依赖 S3。没有 S3 时，这类保存不能使工作流到点跑起来。「运行」按钮待实现。人点「运行」时调用 `POST /api/v1/plan/workflows/:id/run`，请求带页面令牌。cron 由 4.1 的进程内调度器触发。调度器的内部 run 函数不挂 MCP、bridge 或 HTTP。关键字 trigger 和事件 trigger 保持不可运行，文案写明未执行。
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
5. 工作流新建为 paused。暂停、重新启用，以及其它会改变到点执行内容、时间或是否执行的写入，见第 9 条。
6. ⌘K 输入「验收」→ 任务分组出现「验收 A」→ 回车打开计划并高亮。
7. 「整理待办」→ 左栏当前会话收到 prompt → 建议抽屉出现 →「应用」一条 → 任务变更。
8. 5174 回归：计划页可打开（首次会空，因为之前只在内存）。
9. 工作流 run，待实现，后续 PR。外部 HTTP 带页面令牌时返回 200，新行 `workflow_runs.state` 为 `queued`。步骤开始后，该行 `output_json` 含会话 id。只带 Origin 或没有页面令牌时返回 401。cron 不经过这条 HTTP。内部 run 函数不挂 MCP、bridge 或 HTTP，只给进程内调度器。调度器待实现，依赖 S3。只有 S1 和 S2 时不上线。会改变到点自动执行什么、何时执行或是否执行的写入，只带 Origin 返回 401。例子包括新建 cron、置为 active、改 trigger、改定义、改步骤、改 prompt，以及复制、导入、暂停、删除和重新启用。持有页面令牌的人可以直接写。AI 只能提案。提案时 `audit_entries` 记 `awaiting_approval`。确认或拒绝时各再记一条。走提案时，确认前不改会进入到点运行的定义。调度器上线前已存在的 active cron 行，人重新确认前不跑。关键字 trigger 和事件 trigger 在卡片上显示未执行。

自动化：`runtime/tests/plan.test.mjs`：CRUD、工作区隔离、状态校验、completed_at 自动填。工作流 run 的自动化留在后续 PR，见 4.1。

## 9. 提交拆分

1. `feat(runtime): plan tasks/events/workflows CRUD routes`
2. `feat(web): hydrate plan from API; drop persisted in-memory plan`
3. `fix(plan): real week dates; workflow pause; remove dead run`。到点写入原则不在这条。
4. `feat(im): 摘成待办 persists via plan API`
5. `feat(palette): search tasks`
6. `feat(plan): 整理待办 via askAiForResult`（依赖规格 02 落地，否则跳过并在报告注明）
7. 不在前六条。后续 PR 做人工 HTTP run 和「运行」按钮。依赖安全方案 S1 的页面令牌函数和 S2。
8. 不在前六条。后续 PR 做进程内 cron 调度器，以及 4.1 的到点写入原则。依赖 S3。只有 S1 和 S2 时不上线。上线时已存在的 active cron 行要等人重新确认。

## 10. 开放问题

已关闭：真实表名与列见 §4；`events` 在 store 里的字段名保留，映射到 `calendar_events`。
