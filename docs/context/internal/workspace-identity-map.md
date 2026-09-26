---
cursor:
  subagentId: "bc-e4184fa7-9485-523d-9f20-330a12901f91"
---

# 「fdex测试1」工作区身份对照（Ace）

**时间**：2026-09-17 (UTC+8)  
**模式**：只读 · 未改代码 · 未停 pnpm  
**栈**：`http://127.0.0.1:5174` BFF · `FDE_DSH_HOME=~/.dsh-fde-x` · DB `runtime/data/fde-workstation.sqlite`

## 四路 ID 实测值（顶栏 = fdex测试1 时）

| # | 字段 | 值 |
|---|------|-----|
| 1 | **工作区 id**（非 `ws_` 种子 id） | `1985293d-03bb-496f-ad69-5c7f2ac23149` |
| 2 | **顶栏 cwd**（DSH `path` / `workspace.cwd`） | `/Users/zxz/Documents/ai-project/fdex测试` |
| 3 | **DSH 会话 `identity.cwd`**（`~/.dsh-fde-x/storages/session_projcache/sessions/*.json`） | 同上路径；本工作区 **7** 条会话（含侧栏「测试一下」「【拟回】请只写出给…」对应的 `session-bfe75b24…` / `session-d57ff91f…`） |
| 4 | **`business_connections`（SQLite）** | 全库 **仅 1 行**：`conn_lan_assist` → **`workspace_id = ws_personal`**（不是 `1985293d-…`） |

**出处**：`GET /api/v1/ai/workspaces` · `GET /api/v1/ai/sessions?includeBlank=true` · `sqlite3 … business_connections` · `curl …/business/connections?workspaceId=1985293d-03bb-496f-ad69-5c7f2ac23149` → `items: []`

**对比（易混，不是顶栏 cwd）**：BFF `GET /api/v1/ai/status` 里 `workspace` 仍是 **`…/scene-39-personal-workstation`**（进程默认 `FDE_AI_WORKSPACE`）；`~/.dsh-fde-x/lan-assist/state.json` 的 `workspace` 也是 scene-39。**这两条不参与** `workspaceAuthority`，也**不是**「fdex测试1」顶栏目录。

---

## Ace 对照表：他已经有的 vs 页面实际在读的

| 维度 | Ace 已经有的（本机实测） | 页面 / API 实际在读的 | 是否一致 |
|------|--------------------------|------------------------|----------|
| 工作区名 **fdex测试1** | DSH + SQLite 均指向 id **`1985293d-03bb-496f-ad69-5c7f2ac23149`** | 顶栏选中时 `activeWorkspaceId` 应为同一 UUID（`Data.tsx` / `RecordsPanel` 走 store） | **一致** |
| 本机目录 | **`/Users/zxz/Documents/ai-project/fdex测试`**（`GET /api/v1/ai/workspaces` 的 `path`；SQLite `workspaces.description` 同路径） | `runtime-api` 的 `currentWorkspaceCwd()` / `?cwd=` / `listBizSurfaces(workspaceCwd)` 读顶栏 **`workspace.cwd`** | **一致**（前提：顶栏未丢 `cwd`；AI 页 bootstrap 会用 DSH `path` 写回 `cwd`） |
| DSH 会话 | **有**（7 条 session，`identity.cwd` = fdex测试 路径） | AI 侧栏 `listAiSessions` 按 **顶栏 cwd** 过滤（`AI.tsx` `visibleSessions`） | **一致** |
| 「业务连接器」登记 | **有**：`GET /api/v1/mcp/servers` → `connectors[0].lookupRegistered: true`（lan-assist **全局** lookup） | **业务记录** Empty 看的是 **`GET /api/v1/business/connections?workspaceId=<当前顶栏 id>`** → 对 `1985293d-…` 为 **`[]`**（`RecordsPanel` `connectorOptions`） | **不一致**：**`workspaceId` 字段** — 连接器行挂在 **`ws_personal`**，不在 **`1985293d-03bb-496f-ad69-5c7f2ac23149`** |
| `/biz/connections` | 同上：SQLite 无 `1985293d-…` 行 | `GET /api/v1/biz/connections?workspaceId=1985293d-03bb-496f-ad69-5c7f2ac23149` → **`items: []`**（`biz.mjs` 的 `workspace` 参数语义是 **workspaceId**，不是绝对路径） | **不一致**（与上同一根因） |
| Memory `CWD_NOT_AUTHORIZED` | 用 **fdex测试 cwd** 调 `GET /api/v1/memory/search?cwd=…/fdex测试` → **200**（非 `CWD_NOT_AUTHORIZED`） | 若用 **`…/scene-39-personal-workstation`** 作 cwd → 仍会 **未授权**（fde-x 会话表无该 cwd） | **不一致**：之前话术若按 **scene-39** 验收，与 Ace **当前顶栏工作区 cwd** 不是同一条路径 |

---

## 给 Ace 的一句话

- **会话和顶栏 cwd 没丢**：id、`path`、DSH `identity.cwd` 三条对齐在 **`fdex测试`** 目录。  
- **RecordsPanel Empty 不是因为「完全没登记」**：库里 **有** `conn_lan_assist`，但 **`workspace_id` 是 `ws_personal`**；你在 **fdex测试1** 时 UI 只查 **`1985293d-…`**，所以连接器列表为空。Settings 里的 **lookup 已登记** 也不等于 SQLite 里给当前工作区挂一行。  
- **不必为「缺会话」去 scene-39 开 DSH**（那是另一套默认进程目录）。若仍看到 **memory** 的 `CWD_NOT_AUTHORIZED`，先确认请求里的 **`cwd` 是不是顶栏的 fdex测试 路径**，而不是 scene-39。  
- **不需要** 因为「没有连接器行」而重新做 lookup 登记（行存在，只是 **工作区 id 不对**）；本票未改数据。

## 旁证（截图 `ace-session-not-found.png`）

主区 JSON **`not_found` / 「接口不存在」** 与 BFF 兜底 404 同形（例如误打不存在的 `/api/v1/…`）。侧栏仍列出 fdex测试 cwd 下的会话 → **不是「DSH 里没有会话」**，更像 **iframe/请求 URL 打错路由**（本对照未追具体 URL）。

## 相关内部票

- [verify-recordspanel-kinds.md](./verify-recordspanel-kinds.md)  
- [wave-fix-memory-cwd.md](./wave-fix-memory-cwd.md)（针对 **scene-39** cwd，非 fdex测试1 顶栏）
