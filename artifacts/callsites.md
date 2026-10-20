# 工作区调用点

核对基准是 `1e7cdb50`。路径解析集中在 `resolveHttpWorkspace`（`runtime/http-workspace.mjs`）。登记与 id 对照集中在 `resolveWorkspaceIdOrFail`（`runtime/briefing/workspace.mjs`）。下表只列还在取工作区的路由和函数。已经只走这两个函数、并且不在本次九项里的格子，归在「已收口」。

## 本次要改

| 项 | 位置 | 现在怎么取 | 问题 |
| --- | --- | --- | --- |
| 1 | `GET /api/v1/business/apps` `runtime/server.mjs` | `resolveHttpWorkspace` 读 `workspaceCwd`，再 `resolveWorkspaceIdOrFail`。只有路径、没有 id 时，列表改用 `workspaceId: 'ws_personal'` | 个人区整表经 `listBusinessApps` 的 `workspace_id = ?` OR 进来 |
| 1 | `listBusinessApps` `runtime/db.mjs` | `workspace_id = ? OR _workspaceCwd = ?` | 调用方把 id 设成 `ws_personal` 时，没有 cwd 标记的个人应用也会命中 |
| 2 | `listRecentEvents` `runtime/events.mjs` | `workspace_cwd IS NULL OR canonical(workspace_cwd) = ?` | 带过滤时 NULL 行仍返回 |
| 2 | `listEventsAfter`、`matchesWorkspaceFilter` `runtime/events.mjs` | `workspaceCwd == null` 视为命中 | SSE 回放和推送同样放行 NULL |
| 2 | `GET /api/v1/events/recent`、`GET /api/v1/events` `runtime/routes/events.mjs` | `resolveHttpWorkspace`，`whenAbsent: 'omit'` | 路由本身不放行 NULL，放行发生在上面两个函数 |
| 3 | `GET /api/v1/events/pending` `runtime/server.mjs` | 不读 workspace。`listPendingEvents(db, limit)` | 豁免表写明不按工作区过滤。未发布事件全部返回 |
| 3 | `listPendingEvents` `runtime/db.mjs` | 只看 `published_at IS NULL` | 没有 workspace 参数 |
| 4 | `GET/POST /api/v1/catalog` `runtime/routes/catalog.mjs` | `resolveHttpWorkspace` 得到 cwd，不调用 `resolveWorkspaceIdOrFail` | 未登记路径仍去读目录，不是 404 |
| 4 | `GET /api/v1/business/connections` `runtime/server.mjs` | 只读 `workspaceId`，缺省 `ws_personal` | 不认路径，未登记路径不会 404 |
| 4 | `GET /api/v1/biz/connections` `runtime/routes/biz.mjs` | `workspace` 查询当工作区 id。cwd 走 `bizWorkspace` → `resolveHttpWorkspace` | 未登记路径不 404。`workspace` 这个名字仍是 id，不是路径 |
| 5 | `POST /api/v1/context/pack` `runtime/routes/context.mjs` | `resolveHttpWorkspace` 只取路径。`buildContextPack` 不收 id | body 里的 `workspaceId` 被丢掉 |
| 5 | `buildContextPack` `runtime/context-pack.mjs` | `resolveWorkspaceIdOrFail(db, { cwd, source })` | 调用处没有 id，对不上的 id 不会变成 `workspace_mismatch` |
| 5 | `POST /api/v1/bridge/context` `runtime/routes/bridge.mjs` | 路径走 `resolveWorkspaceIdOrFail`，pack 同样不传 id | 与 context pack 同一处丢掉 id |
| 6 | briefing 四条 `runtime/routes/briefing.mjs` | 路径走 `resolveHttpWorkspace`。未登记由 `getOrCreateDefinition` 抛 `missing_workspace`，路由回 400 | apps 对同一状态回 404 `not_found`「工作区未登记」 |
| 6 | `rejectAppWorkspace` `runtime/routes/apps.mjs`，business apps `runtime/server.mjs` | `missing_workspace` → 404 `not_found` | 与 briefing 的 400 不是同一条规则 |
| 7 | `http workspace readers are registered` `runtime/tests/http-workspace-matrix.test.mjs` | 正则只认 `cwd` / `workspace` / `workspaceCwd`。`pathRegistered` 用路径前缀互认。`helperOwns` 往上 50 行见到帮手函数就放过 | `workspacePath`、`workingDirectory`、`picked.get('cwd')`、只出现 `/api/v1/`、帮手函数外面的读取都能过守卫 |
| 8 | `pickLocalDirectory` `runtime/server.mjs` | `path.startsWith('/')` | `C:\...` 和 `\\server\share` 被丢掉。`canonicalWorkspaceCwd` 已经认识这两种 |
| 9 | `tickBriefingScheduler` `runtime/briefing/scheduler.mjs` | `storedWorkspaceCwd` 用 `canonicalWorkspaceCwd` | `1e7cdb50` 上已经没有 `startsWith('/')`。本项核对后不改 |

## 已收口

这些格子在 `httpWorkspaceRoutes` 里，请求路径经 `resolveHttpWorkspace`。未登记路径要 404 的，再经 `resolveWorkspaceIdOrFail`。本次不改它们的解析方式。

| 路由 | 文件 | 参数 |
| --- | --- | --- |
| `GET /api/v1/biz/surfaces` | `runtime/routes/biz.mjs` | query `workspace` |
| `GET /api/v1/biz/kinds` | 同上 | query `cwd` |
| `GET /api/v1/biz/traces` | 同上 | query `workspace` |
| `GET /api/v1/biz/pending-sheet` | 同上 | query `cwd` |
| `POST /api/v1/biz/rollback/preview` | 同上 | body `workspace` |
| `POST /api/v1/biz/focus-kind` | 同上 | body `workspace` |
| `POST /api/v1/biz/preview` | 同上 | body `workspace` |
| `POST /api/v1/biz/catalog` | 同上 | body `workspace` |
| `POST /api/v1/biz/lookup` | 同上 | body `workspace` |
| `POST /api/v1/biz/preview/dismiss` | 同上 | body `workspace` |
| `POST /api/v1/biz/write` | 同上 | body `workspace` |
| `GET /api/v1/files` | `runtime/server.mjs` | query `cwd` |
| `GET /api/v1/memory/search` | 同上 | query `cwd` |
| `GET /api/v1/memory/deps` | 同上 | query `cwd` |
| `GET /api/v1/memory/cards` | 同上 | query `cwd` |
| `POST /api/v1/memory/cards` | 同上 | body `cwd` |
| `POST /api/v1/memory/cards/:id/nod` | 同上 | body `cwd` |
| `GET /api/v1/memory/health` | 同上 | query `cwd` |
| `POST /api/v1/memory/health/act` | 同上 | body `cwd` |
| `GET /semantic-os/api/coverage` | 同上 | query `cwd` |
| `POST /api/v1/ai/workspaces` | 同上 | body `path` |
| `GET /api/v1/apps` | `runtime/routes/apps.mjs` | query `workspace` |
| `POST /api/v1/apps` | 同上 | body `workspaceCwd` |
| `GET /api/v1/apps/:slug/:entity` | 同上 | query `workspace` |
| `POST /api/v1/bridge/plan-task-propose` | `runtime/routes/bridge.mjs` | body `workspaceCwd` + `workspaceId` |
| `POST /api/v1/bridge/submit-result` | 同上 | body `workspaceCwd` |
| `GET /api/v1/corpus/:id` | `runtime/routes/corpus.mjs` | query `cwd` |
| `GET /api/v1/mcp/projection` | `runtime/routes/mcp.mjs` | query `cwd` |
| `POST /api/v1/mcp/servers` | 同上 | body `cwd` |
| `POST /api/v1/ai/presets/import-dir` | `runtime/routes/presets.mjs` | body `path` |
| `POST /api/v1/ai/presets/import-dir/confirm` | 同上 | body `path` |
| `POST /api/v1/ai/presets/import-git/confirm` | 同上 | body `tempPath` |
| `GET /api/v1/search` | `runtime/routes/search.mjs` | query `cwd` |
| skills 九条 | `runtime/routes/skills.mjs` | query 或 body `cwd` |

`GET /api/v1/catalog` 已在表里，但只解析路径，没有 404。算第 4 项，不重复记进已收口。

## 故意不按路径解析

| 位置 | 原因 |
| --- | --- |
| `runtime/session-bind.mjs` | 创建会话的 cwd 与 workspaceId 二选一 |
| `runtime/routes/plan.mjs` | `workspaceId` 是工作区 id |
| `GET /api/v1/biz/connections` 的 `workspace` 查询 | 这个参数是工作区 id，不是路径。路径走别的参数 |
| `runtime/vendor-overlays` | 本轮不改 |
| 运行时 connect、shutdown、reload、disconnect、创建会话审计 | 固定写在个人区 |

## 统一规则

请求给了工作区 id 或绝对路径，库里没有对应工作区行：HTTP 404，code `missing_workspace`，message `工作区未登记`。路径不是绝对路径：400 `workspace_invalid`。id 和路径不是同一行：400 `workspace_mismatch`。没带路径也没带 id：维持各路由现有的缺省（个人区或运行时 cwd）。

上表「问题」列里的 `not_found` 是改之前的记录。这些 404 现在的 code 是 `missing_workspace`。`runtime/routes/plan.mjs` 仍对缺少的工作区 id 返回 404 `not_found`「工作区不存在」，不在这九项里。
