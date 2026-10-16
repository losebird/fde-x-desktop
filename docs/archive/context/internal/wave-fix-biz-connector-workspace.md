---
cursor:
  subagentId: "bc-69d3c7ee-b2d5-5158-b06d-66e8736377de"
---

# Wave: biz connector workspace scope（lan-assist）

**Repo**: `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**Commit**: `ab19d26` — `fix(biz): attach lan-assist connector to active workspace`

## 根因

| 项 | 出处 |
|----|------|
| `conn_lan_assist` 写入 `workspace_id = ws_personal` | `runtime/db.mjs` → `seedRuntime()`，`insertBusinessConnection` 硬编码 `'ws_personal'`（`INSERT OR IGNORE`，仅首次建库） |
| UI/API 按顶栏 UUID 列表 | `GET /api/v1/business/connections?workspaceId=1985293d-…` → `listBusinessConnections(db, { workspaceId })` 原 SQL 仅 `WHERE workspace_id = ?` |
| MCP lookup 与 SQLite 行无关 | `runtime/routes/mcp.mjs` `buildConnectors` 用 `listBusinessConnections(db)` 无参 → 仍见 `ws_personal` 行；Settings「已登记 lookup」≠ Records 工作区过滤 |

**未改**: memory cwd、Electron、设置登记流程、样式、打包；未 recycle 4318。

## 改动（最小）

`listBusinessConnections`：当 `workspaceId !== 'ws_personal'` 时，合并 `ws_personal` 下 `provider = 'lan-assist'` 的种子行；按 `id` 去重时优先保留当前工作区副本（若将来有）。

影响路径（同一函数）：

- `runtime/server.mjs` `/api/v1/business/connections`
- `runtime/routes/biz.mjs` `/api/v1/biz/connections`
- `runtime/context-pack.mjs` `fillBiz`

## 验证

- `node --test runtime/tests/biz.test.mjs` — 8/8 pass（含新用例：UUID 工作区能列出 `conn_lan_assist`）
- **现网未测**：Ace 机 BFF 需热加载/进程已拾取新 `db.mjs` 后，再 `curl …/business/connections?workspaceId=1985293d-03bb-496f-ad69-5c7f2ac23149` 应非 `[]`

## 对照（本票范围）

| 单元 | 母体/事实 | fdex 改后 | 状态 |
|------|-----------|-----------|------|
| 连接器列表（fdex测试1） | SQLite 行在 `ws_personal`；GET 按 UUID 曾为 `[]` | list 合并 lan-assist | **仍差：现网未测** |
| 重新 Settings 登记 | 行已存在 | 不需要 | **已对**（逻辑） |
| Empty「先在设置登记业务连接器」 | Spec 05：无 connection 才 Empty | 有 connector option 时应退出 Empty | **仍差：现网未测** |

## Ace

无需再点 lookup 登记；刷新业务记录页（或等 BFF 加载新代码）后应看到「局域网业务协作适配器」。
