# 工作区读写入口

这张表替代 Store 里的 `ws-guard-decisions.tsv`。每一行是一个读写入口。已收住表示这个入口只碰当前工作区的行。红、绿是该入口对应的提交。白名单在 `runtime/workspace-scope-allow.mjs`。每一条是文件加调用名，或文件加表名，外加理由。没有一条正则放过全部调用。r4 之后只留一行，`workflow_runs` 按 run id 更新。

简报里的 `getBusinessApp` 没有这个函数名。按主键读应用的函数是 `getAppById`。`app_documents` 没有 `workspace_id` 列。`getDocument` 和 `putDocument` 先调用 `getAppById(db, appId, workspaceId)`，应用不属于该工作区就返回空。

结构测试是 `runtime/tests/ws-guard-r3.test.mjs` 的 `primary key access passes workspaceId`。它扫描生产代码里主键函数的调用点。`workspaceId` 族的参数里必须出现标识符 `workspaceId`。cwd 族必须出现 `workspaceCwd`。它也扫描 `business_apps`、`operations`、`tasks`、`calendar_events`、`workflows`、`business_connections`、`operation_steps`、`workflow_runs` 上 `WHERE id = ?` 的语句，匹配文本里必须有 `workspace_id =`。`briefings` 和 `biz_write_audit` 必须有 `workspace_cwd =`。测试目录、`node_modules`、`vendor-overlays`、`dist`、`.git` 不扫。r4 把早报、审计、连接灯、操作步骤、工作流 run 读取、记录和上述表加进这次扫描。红 `25be63ae` 在旧代码上失败。绿 `6e6fcf97` 之后只剩白名单那一行。

## 提交

| 短名 | 完整 sha | 内容 |
| --- | --- | --- |
| r4 红 | `25be63aef1f692dfa642c02043552d44e6ab12c5` | 早报、语料早报、审计按 trace、连接灯跨区，以及扩大后的结构测试，都红 |
| r4 绿 | `6e6fcf976a116ec02dea5828ccdb966c508fc172` | 早报和审计按 cwd 过滤。连接灯只改请求工作区。监视器只改 `ws_personal`。操作步骤先确认父操作属于该工作区。工作流 run 读取按 `workspace_id` 连接 |
| r3 红 | `357581184c3f92844292e57dd853640d85bfa4d6` | 跨区读、跨区 task-proposal、未登记 workflow、catalog stream 未登记、结构测试，五条都红 |
| r3 绿 | `d2ca959c138b7869b80627d3e59d4ba9a601ea13` | 主键函数带 `workspaceId`，SQL 为 `WHERE workspace_id = ? AND id = ?`，workflow 创建改 404，catalog stream 登记 |
| r3 工作流加载 | `7599e9b661412565d299cb0148c589624b5cf276` | `startWorkflowRun` 的 SELECT 改成 `WHERE workspace_id = ? AND id = ?`。结构测试因为列名单里已有 `workspace_id` 而没有把这一行判红 |
| r2 红 | `354abcf97e4e476464d2fd098f038bf5e4bdf0fa` | store、record proposal、approve、execute、plan 行写入跨区仍成功 |
| P0 红 / 绿 | `855370914b0424d2672814319e922ca336ffa1c8` / `b92a73ddc64d08af2f2c905c3cf4b5cdb664c921` | 别的工作区改 business app |
| 状态码红 / 绿 | `1efef0c3897ec97581da959cf92d83ef77d23a64` / `539744b6ce951768533df659ecba9066384423ec` | 未登记 id 从空列表改成 404 `missing_workspace` |
| 路径精确红 / 绿 | `30898a31c72aeb3f222893fa95f9ee093f430295` / `c6c2d1f5d00f0f613f54f7cbf7bedb0efafdc8d7` | 子路径不再被父路径认走 |
| 读口调用红 / 绿 | `712b54b4f6f1665621a1324797d66b37c2195bae` / `355a84ed5c0d54f8ff7a3ea4cc63ba86ba3ee48e` | 登记过的读口必须调用 `resolveHttpWorkspace` |

## 数据层主键函数

这些函数的红是 r3 红，绿是 r3 绿，除非另注。

| 函数 | 文件 | 已收住 | 红 | 绿 |
| --- | --- | --- | --- | --- |
| `getAppById` | `runtime/apps/repository.mjs` | 是 | `35758118` | `d2ca959c` |
| `putAppSpec` | 同上 | 是 | `35758118` | `d2ca959c` |
| `activateApp` | 同上 | 是 | `35758118` | `d2ca959c` |
| `trashApp` | 同上 | 是 | `35758118` | `d2ca959c` |
| `restoreApp` | 同上 | 是 | `35758118` | `d2ca959c` |
| `purgeApp` | 同上 | 是 | `35758118` | `d2ca959c` |
| `rollbackApp` | 同上 | 是 | `35758118` | `d2ca959c` |
| `deleteAppMetadata` | 同上，内部 | 是 | `35758118` | `d2ca959c` |
| `updateBusinessApp` | `runtime/db.mjs` | 是 | `85537091` 行为，`35758118` 数据层 | `b92a73dd` 行为，`d2ca959c` 数据层 |
| `getOperation` | `runtime/db.mjs` | 是 | `35758118` | `d2ca959c` |
| `getOperationTrace` | 同上 | 是 | `35758118` | `d2ca959c` |
| `listOperations` | 同上。省略 `workspaceId` 时绑定 null，不再列出全部工作区 | 是 | `35758118` | `d2ca959c` |
| `approveOperation` | 同上 | 是 | `354abcf9` 行为，`35758118` 数据层 | `ca3a4cd0` 行为，`d2ca959c` 数据层 |
| `executeDryRun` | 同上 | 是 | `354abcf9` 行为，`35758118` 数据层 | `ca3a4cd0` 行为，`d2ca959c` 数据层 |
| `executeOperationLive` | 同上 | 是 | `354abcf9` 行为，`35758118` 数据层 | `ca3a4cd0` 行为，`d2ca959c` 数据层 |
| `getTask` | `runtime/plan/task-store.mjs` | 是 | `35758118` | `d2ca959c` |
| `updateTask` | 同上 | 是 | `354abcf9` 行为，`35758118` 数据层 | `471f39a6` 行为，`d2ca959c` 数据层 |
| `deleteTask` | 同上 | 是 | `354abcf9` 行为，`35758118` 数据层 | `471f39a6` 行为，`d2ca959c` 数据层 |
| `insertTask` | 同上。插入后按 `input.workspaceId` 读回 | 是 | `35758118` | `d2ca959c` |
| `listTasks` | 同上。列表条件带 `workspace_id` | 是 | `1efef0c3` | `539744b6` |
| `decidePlanTask` | `runtime/plan/task-proposals.mjs` | 是 | `35758118` | `d2ca959c` |
| `proposePlanTask` | 同上。按 `workspaceId` 读任务。未登记 id 仍返回 `not_found`「工作区不存在」，这是帮手，不是 HTTP 口 | 是 | `35758118` | `d2ca959c` |
| `listOpenPlanTaskProposals` | 同上。参数就是 `workspaceId` | 是 | `1efef0c3` | `539744b6` |
| `markState` | `runtime/proposals/commit.mjs`，内部 | 是 | `354abcf9` 行为，`35758118` 数据层 | `5d3978f4` 行为，`d2ca959c` 数据层 |
| `getDocument` | `runtime/apps/documents.mjs` | 是。先确认应用属于该工作区，再按 `app_id`、cwd、key 取行 | `35758118` | `d2ca959c` |
| `putDocument` | 同上。更新语句按刚查到的文档 id 写，查找本身带应用和工作区路径 | 是 | `354abcf9` 行为，`35758118` 数据层 | `fb257bff` 行为，`d2ca959c` 数据层 |
| `serveWebAppAsset` | `runtime/apps/web-host.mjs`。本地存储读取把 `workspaceId` 传给 `getDocument` | 是 | `35758118` | `d2ca959c` |
| `resolveTask` | `runtime/routes/corpus.mjs` | 是 | `35758118` | `d2ca959c` |
| `startWorkflowRun` | `runtime/plan/workflow-run.mjs` | 是 | `35758118` 没有单独把这一行扫红 | `7599e9b6` |

`listTasks` 和 `listOpenPlanTaskProposals` 的红绿是状态码收口那一对，因为列表本来就按工作区过滤。本轮没有给它们单独的跨区红测。

## HTTP 主键口

缺省工作区是 `ws_personal`。别的工作区的行返回 404 `not_found` 和对应的「不存在」文案。未登记 id 在创建口返回 404 `missing_workspace`「工作区未登记」。

| 入口 | 文件 | 已收住 | 红 | 绿 |
| --- | --- | --- | --- | --- |
| `GET /api/v1/apps/:id` | `runtime/routes/apps.mjs` | 是 | `35758118` | `d2ca959c` |
| `DELETE /api/v1/apps/:id` | 同上 | 是 | `85537091` | `b92a73dd`，数据层 `d2ca959c` |
| `GET /api/v1/apps/:id/live` | 同上 | 是 | `35758118` | `d2ca959c` |
| `GET /api/v1/apps/:id/store/:key` | 同上 | 是 | `35758118` | `d2ca959c` |
| `PUT /api/v1/apps/:id/store/:key` | 同上 | 是 | `354abcf9` | `fb257bff`，数据层 `d2ca959c` |
| `POST /api/v1/apps/:id/store/:key` | 同上 | 是 | `354abcf9` | `fb257bff`，数据层 `d2ca959c` |
| `PUT /api/v1/apps/:id/spec` | 同上 | 是 | `35758118` | `d2ca959c` |
| `POST /api/v1/apps/:id/activate` | 同上 | 是 | `35758118` | `d2ca959c` |
| `POST /api/v1/apps/:id/restore` | 同上 | 是 | `35758118` | `d2ca959c` |
| `POST /api/v1/apps/:id/purge` | 同上 | 是 | `35758118` | `d2ca959c` |
| `POST /api/v1/apps/:id/rollback` | 同上 | 是 | `35758118` | `d2ca959c` |
| `GET /api/v1/apps/:id/share` | 同上 | 是 | `35758118` | `d2ca959c` |
| `POST /api/v1/apps/record-proposals/:id/confirm` | 同上 | 是 | `354abcf9` | `5d3978f4`，数据层 `d2ca959c` |
| `POST /api/v1/apps/record-proposals/:id/reject` | 同上 | 是 | `354abcf9` | `5d3978f4`，数据层 `d2ca959c` |
| `GET /api/v1/apps` | 同上 | 是 | `781ac8b2` | `f59b3ea1` |
| `POST /api/v1/apps` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/apps/:slug/:entity` | 同上。实体行见下面 `getRecord`。别名参数那一对只改了应用列表 | 是 | `1efef0c3` | `539744b6` |
| `PUT /api/v1/business/apps/:id` | `runtime/server.mjs` | 是 | `85537091` | `b92a73dd`，数据层 `d2ca959c` |
| `GET /api/v1/business/apps` | 同上 | 是 | `781ac8b2` | `f59b3ea1` |
| `POST /api/v1/business/apps` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/operations` | 同上。不带 `workspaceId` 时只列 `ws_personal` | 是 | `35758118` | `d2ca959c` |
| `GET /api/v1/operations/:id` | 同上 | 是 | `35758118` | `d2ca959c` |
| `GET /api/v1/operations/:id/trace` | 同上 | 是 | `35758118` | `d2ca959c` |
| `POST /api/v1/operations/:id/approve` | 同上 | 是 | `354abcf9` | `ca3a4cd0`，数据层 `d2ca959c` |
| `POST /api/v1/operations/:id/execute` | 同上 | 是 | `354abcf9` | `ca3a4cd0`，数据层 `d2ca959c` |
| `POST /api/v1/operations` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `PATCH /api/v1/plan/tasks/:id` | `runtime/routes/plan.mjs` | 是 | `354abcf9` | `471f39a6`，数据层 `d2ca959c` |
| `DELETE /api/v1/plan/tasks/:id` | 同上 | 是 | `354abcf9` | `471f39a6`，数据层 `d2ca959c` |
| `POST /api/v1/plan/tasks` | 同上。未登记 id 为 404 `missing_workspace` | 是 | `354abcf9` | `6909d583` |
| `GET /api/v1/plan/tasks` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/plan/task-proposals/:id/confirm` | 同上 | 是 | `35758118` | `d2ca959c` |
| `POST /api/v1/plan/task-proposals/:id/reject` | 同上 | 是 | `35758118` | `d2ca959c` |
| `GET /api/v1/plan/task-proposals` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `PATCH /api/v1/plan/events/:id` | 同上。令牌检查在按工作区读到行之后 | 是 | `354abcf9` | `471f39a6`，数据层 `d2ca959c` |
| `DELETE /api/v1/plan/events/:id` | 同上 | 是 | `354abcf9` | `471f39a6`，数据层 `d2ca959c` |
| `POST /api/v1/plan/events` | 同上。未登记 id 为 404 `missing_workspace` | 是 | `354abcf9` | `6909d583` |
| `GET /api/v1/plan/events` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/plan/workflows` | 同上。未登记 id 从 500 `internal_error` 改为 404 `missing_workspace`，插入 0 行 | 是 | `35758118` | `d2ca959c` |
| `PATCH /api/v1/plan/workflows/:id` | 同上 | 是 | `354abcf9` | `471f39a6`，数据层 `d2ca959c` |
| `DELETE /api/v1/plan/workflows/:id` | 同上 | 是 | `354abcf9` | `471f39a6`，数据层 `d2ca959c` |
| `GET /api/v1/plan/workflows` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /a/:shareId` | `runtime/routes/app-share.mjs`。先按分享 id 找到应用，再传该应用的 `workspaceId` | 是 | `35758118` | `d2ca959c` |
| `GET /api/v1/app-share/:shareId/store/:key` | 同上 | 是 | `35758118` | `d2ca959c` |
| `PUT /api/v1/app-share/:shareId/store/:key` | 同上 | 是 | `35758118` | `d2ca959c` |
| `POST /api/v1/app-share/:shareId/store/:key` | 同上 | 是 | `35758118` | `d2ca959c` |
| `GET /api/v1/corpus/:id` 的任务前缀 | `runtime/routes/corpus.mjs` | 是 | `35758118` | `d2ca959c` |

页面调用点也收进结构测试。`src/pages/Data.tsx` 的 `updateBusinessApp`、`src/pages/Plan.tsx` 和 `src/store/app.ts` 的 `updateTask` 都带上 `workspaceId`。红 `35758118`，绿 `d2ca959c`。

记忆写入 `runtime/memory/writer.mjs` 的 `onOperationExecuted` 先把事件 cwd 解成工作区，再调用 `getOperation`。没有放进白名单。

## 路径登记口

这些路由在 `httpWorkspaceRoutes`。未登记路径或未登记 id 返回 404 `missing_workspace`。精确匹配的红绿是 `30898a31` / `c6c2d1f5`。每个读口必须调用 `resolveHttpWorkspace` 的红绿是 `712b54b4` / `355a84ed`。下表写的是该路由自己的过滤或登记提交。没有单独红测的，红绿用状态码那一对 `1efef0c3` / `539744b6`。

| 入口 | 文件 | 已收住 | 红 | 绿 |
| --- | --- | --- | --- | --- |
| `GET /api/v1/biz/surfaces` | `runtime/routes/biz.mjs` | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/biz/kinds` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/biz/traces` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/biz/pending-sheet` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/biz/rollback/preview` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/biz/focus-kind` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/biz/preview` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/biz/catalog` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/biz/lookup` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/biz/preview/dismiss` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/biz/write` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/biz/vocab/generate` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/biz/connections` | 同上。`workspace` 查询是连接 id，路径参数另走解析 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/files` | `runtime/server.mjs` | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/briefing/latest` | `runtime/routes/briefing.mjs` | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/briefing/definition` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `PUT /api/v1/briefing/definition` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/briefing/run` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/events/recent` | `runtime/routes/events.mjs` | 是 | `3584eb90` | `54967ee8` |
| `GET /api/v1/events` | 同上 | 是 | `3584eb90` | `54967ee8` |
| `GET /api/v1/events/pending` | `runtime/server.mjs` | 是 | `60ea4068` | `3b17aa2a` |
| `GET /api/v1/search` | `runtime/routes/search.mjs` | 是 | `3584eb90` | `54967ee8` |
| `GET /api/v1/memory/search` | `runtime/server.mjs` | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/memory/deps` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/memory/cards` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/memory/cards` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/memory/cards/:id/nod` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/memory/health` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/memory/health/act` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/catalog` | `runtime/routes/catalog.mjs` | 是 | `5c8d2edd` | `835347b2` |
| `POST /api/v1/catalog` | 同上 | 是 | `5c8d2edd` | `835347b2` |
| `GET /api/v1/catalog/stream` | 同上。处理函数在打开 SSE 前已经 404。本轮补的是登记进 `httpWorkspaceRoutes` | 是 | `35758118`。处理函数另有 `db2b9b8d` | `d2ca959c`。处理函数另有 `583dcddd` |
| `GET /api/v1/business/connections` | `runtime/server.mjs` | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/corpus/:id` | `runtime/routes/corpus.mjs` | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/mcp/projection` | `runtime/routes/mcp.mjs` | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/mcp/servers` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/skills/roots` | `runtime/routes/skills.mjs` | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/skills/bundle/files` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /api/v1/skills/bundle/file` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `PUT /api/v1/skills/bundle/file` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `DELETE /api/v1/skills/bundle/file` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/skills/model-invocable` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/skills/install` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `DELETE /api/v1/skills/bundle` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/context/pack` | `runtime/routes/context.mjs` | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/bridge/` | `runtime/routes/bridge.mjs` | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/bridge/context` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/bridge/plan-task-propose` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/bridge/submit-result` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `GET /semantic-os/api/coverage` | `runtime/server.mjs` | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/ai/workspaces` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/ai/presets/import-dir` | `runtime/routes/presets.mjs` | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/ai/presets/import-dir/confirm` | 同上 | 是 | `1efef0c3` | `539744b6` |
| `POST /api/v1/ai/presets/import-git/confirm` | 同上 | 是 | `1efef0c3` | `539744b6` |

空凭证的 lan-assist 连接留在个人区。红 `bea44099`，绿 `69ba1c65`。这不是一条 HTTP 路由。

## r4 入口

红提交 `25be63aef1f692dfa642c02043552d44e6ab12c5`。绿提交 `6e6fcf976a116ec02dea5828ccdb966c508fc172`。状态码是 `runtime/tests/ws-guard-r4.test.mjs` 实测。没有写成失败测试的行，红绿栏写明原因。

| 入口 | HTTP 路由或调用链 | 红的结果 | 绿的结果 | 处置 |
| --- | --- | --- | --- | --- |
| `getBriefing` | `GET /api/v1/briefing/:id` 在 `runtime/routes/briefing.mjs` 先 `requireWorkspaceQuery`，再 `getBriefing(db, id, workspaceCwd)`。SQL 是 `canonical(workspace_cwd) = ? AND id = ?` | A 区路径读 B 区早报 `brf_b`，状态 200，正文含「早报秘密」 | 404，正文没有「早报秘密」 | 已收住 |
| `resolveBriefing` | `GET /api/v1/corpus/briefing%3A:id` 到 `loadOrigin`，再 `resolveBriefing(db, id, workspaceCwd)`。SQL 是 `WHERE workspace_cwd = ? AND id = ?` | 同一条红测，语料口状态 200，正文含「早报秘密」 | 404，正文没有「早报秘密」 | 已收住 |
| `updateBriefingContent` | 没有路由接受客户端传来的早报 id。`POST /api/v1/briefing/run` 和 `GET /api/v1/briefing/latest` 失败记录先按该 cwd 创建或找到早报，再把这个 id 交给 `updateBriefingContent`。`mergeBriefingSubmit` 用 `findBriefingByAgentRequest` 找到行之后，用该行自己的 `workspaceCwd` 更新。函数本身仍按 cwd 过滤，因为结构扫描要求调用点带 `workspaceCwd` | 没有单独的 HTTP 状态码。扩大后的结构测试在旧代码上把这些调用判红 | 结构测试通过。更新语句带 `workspace_cwd = ? AND id = ?` | 已收住。HTTP 不能拿别的工作区的早报 id 来写 |
| `getBizWriteAuditByTraceId` | `GET /api/v1/biz/traces?traceId=`、`POST /api/v1/biz/rollback/preview`、`POST /api/v1/biz/write` 把请求 cwd 传进查找。`setBizWriteAuditRollbackState` 用同一 cwd，别的工作区的 trace 改不到行。语料 `biz:` 走 `resolveBizCorpusOrigin`。请求查询里的 cwd 优先。没有查询时，`loadOrigin` 把已经解析的 cwd 传进去，事件写入用的是信封里的 `workspaceCwd`。`originHref` 只有调用方传入 `workspaceCwd` 才查审计 | A 区路径加 B 区 `trace_b`，状态 200，正文含「审计秘密」 | 404，正文没有「审计秘密」。回滚标记同样带 cwd，找不到就不改行 | 已收住 |
| `updateBusinessConnectionStatusByProvider` | `GET /api/v1/business/connections` 和 `GET /api/v1/biz/connections`，以及 preview、write 里的灯刷新，都把请求的 `workspaceId` 传进去。SELECT 和 UPDATE 都是 `workspace_id = ?`。`runtime/lan-assist-state-watch.mjs` 只对 `ws_personal` 调 `reconcileLanAssistConnectionLamp` | A 区刷新连接后，B 区 `lan-assist` 行的 status 从 `error` 变成 `pending` | 同一行保持 `error` | 已收住 |
| `insertOperationStep` | 批准、现场执行、`POST /api/v1/operations` 都先在请求工作区里解析出 operation id，再插入步骤。函数先查 `operations WHERE workspace_id = ? AND id = ?`，对不上就不插入 | 没有单独的 HTTP 跨区状态码。结构测试在旧代码上把缺 `workspaceId` 的调用判红 | 结构测试通过。外区 operation id 插不进行 | 已收住 |
| `readWorkflowRuns` | 只从 `GET /api/v1/plan/workflows` 调用。工作流 id 已经来自 `workflows WHERE workspace_id = ?`。读取再 `JOIN workflows ON workspace_id = ?` | 没有测到 HTTP 200 泄漏。结构测试因为调用缺 `workspaceId` 而红 | 结构测试通过。JOIN 带上 `workspaceId` | 已收住 |
| `readLatestRunCards` | 同上，同一条 GET | 同上，结构测试红 | 同上，JOIN 带上 `workspaceId` | 已收住 |
| `workflow_runs` 按 run id 更新 | `POST /api/v1/plan/workflows/:id/run` 先走 `startWorkflowRun`。别的工作区的工作流在插入 run 之前就是 404，提交 `7599e9b6`。之后按刚插入的 run id 改状态。没有另一条 HTTP 口接受外来 run id。启动时 `failInterruptedRuns` 收的是本进程未完成的 run | 结构测试把按 run id 的 UPDATE 判红 | 白名单一行。文件 `runtime/plan/workflow-run.mjs`，表 `workflow_runs`。读取 JOIN 已收住，更新语句仍按 run id | 白名单。理由写在 `runtime/workspace-scope-allow.mjs` |
| `getRecord` | `GET /api/v1/apps/:slug/:entity/:id`。`appIdentity` 先定工作区，`requireActiveApp` 取该区应用，`appRecordCwd` 得到 cwd，再 `getRecord(..., workspaceCwd, rid)`。SQL 是 `WHERE id = ? AND cwdMatch` | 旧代码已经带 cwd。预期会失败的红测在旧代码上会通过，所以没有写。这是读代码，没有跑跨区探测 | 调用点仍带 `workspaceCwd`。结构扫描把缺这个词的调用判红 | 已按 cwd 收住 |
| `patchRecord` | `PATCH /api/v1/apps/:slug/:entity/:id`，同一条解析，然后 `patchRecord(..., workspaceCwd, rid, body)` | 同上。读代码，没有跨区探测 | 同上 | 已按 cwd 收住 |
| `deleteRecord` | `DELETE /api/v1/apps/:slug/:entity/:id`，同一条解析，然后 `deleteRecord(..., workspaceCwd, rid)` | 同上。读代码，没有跨区探测 | 同上 | 已按 cwd 收住 |
| AI 会话 | `GET /api/v1/ai/sessions` 和 `GET /api/v1/ai/sessions/:id` 调 `aiRuntime.call('session/list')`。`toAiSessionSummary` 可以带上 host 行的 `cwd`。列表不按 fde 工作区过滤。`POST /api/v1/ai/sessions` 用 `parseSessionBind`，创建时带 workspaceId 或 cwd，审计仍写 `ws_personal`。这是一个 Host 会话表，不是按工作区分开的 sqlite 行 | 本轮没有写跨区红测 | 没有改 | 后续 |
| AI 模型 | `GET /api/v1/ai/models` 调 `session/modelCatalog`。`GET/POST /api/v1/ai/models-settings` 及其 mutate、credential、apply 走 Host settings RPC | 本轮没有写跨区红测 | 没有改 | 后续 |
| AI 凭证 | `GET/POST /api/v1/ai/credentials` 读写 `join(aiRuntime.dshHome, '.credentials.yaml')`。一个运行时目录一份文件，不按工作区分 | 本轮没有写跨区红测 | 没有改 | 后续 |
| AI provider | `GET /api/v1/ai/providers` 调 `llm/listProviders` 和 `llm/listConfigurableProviders`，再读 `settings.yaml`。`POST /api/v1/ai/providers` 和 custom、discover 也是 Host 目录 | 本轮没有写跨区红测 | 没有改 | 后续 |

`getWorkspace` 和 `listWorkspaces` 读的是工作区登记表。`workspaces.id` 就是工作区 id。它们不在这张收口表里。

结构扫描没有扫 `server.mjs` 里的 AI 路由正文。上面四行是读路由得出的调用链，不是扫描器的输出。
