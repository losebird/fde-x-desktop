# 工作区读写入口

这张表替代 Store 里的 `ws-guard-decisions.tsv`。每一行是一个读写入口。已收住表示这个入口只碰当前工作区的行。红、绿是该入口对应的提交。白名单在 `runtime/workspace-scope-allow.mjs`，当前是空数组，没有一条正则放过全部调用。

简报里的 `getBusinessApp` 没有这个函数名。按主键读应用的函数是 `getAppById`。`app_documents` 没有 `workspace_id` 列。`getDocument` 和 `putDocument` 先调用 `getAppById(db, appId, workspaceId)`，应用不属于该工作区就返回空。

结构测试是 `runtime/tests/ws-guard-r3.test.mjs` 的 `primary key access passes workspaceId`。它扫描生产代码里下列函数的调用点，参数里必须出现标识符 `workspaceId`。它也扫描 `business_apps`、`operations`、`tasks`、`calendar_events`、`workflows` 上 `WHERE id = ?` 的语句，匹配文本里必须已经出现 `workspace_id`。测试目录、`node_modules`、`vendor-overlays`、`dist` 不扫。

## 提交

| 短名 | 完整 sha | 内容 |
| --- | --- | --- |
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

## 本轮没有收进 workspace_id 过滤

这些函数仍按主键或其它键读写。结构扫描的表名单和调用名单都不包含它们。本轮没有给它们红测试，也没有改它们。红绿留空。

| 函数 | 文件 | 已收住 | 红 | 绿 | 现状 |
| --- | --- | --- | --- | --- | --- |
| `getRecord` | `runtime/apps/records.mjs` | 按 cwd，不是 `workspace_id` |  |  | `WHERE id = ?` 后面还有 workspace cwd 条件 |
| `patchRecord` | 同上 | 按 cwd，不是 `workspace_id` |  |  | 同上 |
| `deleteRecord` | 同上 | 按 cwd，不是 `workspace_id` |  |  | 同上 |
| `insertOperationStep` | `runtime/db.mjs` | 否 |  |  | 按 operation id 插入步骤，没有 `workspace_id` |
| `getBizWriteAuditByTraceId` | `runtime/db.mjs` | 否 |  |  | 按 trace id |
| `updateBusinessConnectionStatusByProvider` | `runtime/db.mjs` | 否 |  |  | 先按 provider 选出连接，再按连接 id 更新，会碰到每个工作区里同名 provider |
| `getBriefing` | `runtime/briefing/store.mjs` | 否 |  |  | `briefings WHERE id = ?` |
| `updateBriefingContent` | 同上 | 否 |  |  | 按 briefing id 更新 |
| `resolveBriefing` | `runtime/routes/corpus.mjs` | 否 |  |  | `briefings WHERE id = ?` |
| `readWorkflowRuns` | `runtime/plan/workflow-run.mjs` | 否 |  |  | `workflow_runs` 按 `workflow_id IN (...)` |
| `readLatestRunCards` | 同上 | 否 |  |  | 同上 |
| `markRunFailed` 及同文件的 run、step 更新 | 同上 | 否 |  |  | `workflow_runs`、`workflow_run_steps` 按 run id 或 step id |
| `getWorkspace` | `runtime/db.mjs` | 登记表 |  |  | `workspaces.id` 就是工作区 id |
| `listWorkspaces` | 同上 | 登记表 |  |  | 列出工作区本身 |

AI 会话、模型、凭证、provider 这些口不在 `httpWorkspaceRoutes` 里，也不在上面的主键族里。本轮没有逐条重测。
