---
cursor:
  subagentId: "bc-132bf3d9-3ec2-5cc3-bd46-edece40c0bb3"
---

# Wave 4 · 规格 05 业务记录

源码根：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`（`main`）。

## 改动

### 提交（规格 §9 关切；`server.mjs` 分派/execute live 在早报栈提交 `84a6990` 已含，未回滚 06/08）

| Hash | 说明 |
|---|---|
| `0b69af5` | `refactor(runtime): move biz routes to runtime/routes/biz.mjs` |
| `4d635fb` | `feat(runtime): biz kinds/traces/surfaces + pendingSheet events`（`010_biz_surface.sql`、`/catalog`+`/traces` 白名单、state watch 写 surface） |
| `2141f24` | `feat(runtime): operations execute live via biz_write; plan_json + steps`（`biz.test.mjs`、smoke 409） |
| `ecae357` | `feat(web): RecordsPanel`（芯片、浮现区、行内 preview→抽屉→write、本地应用 SpecTable、`buildContextPack`+`ContextChips`） |
| `036afa2` | `feat(web): OperationControlPanel` + `Data.tsx` 三 Tab 接线 |

`git diff --stat`（`0b69af5^..036afa2`）：约 +1481 / −306 行，见上表文件列表。

### 未改（按约束）

- `Briefing.tsx`、`mcp.mjs`、`MCP.tsx`、`SpecTable`/`SpecDetail`（04 agent 动作）、`Memory.tsx`、`IMWorkspace.tsx`
- `runtime-api.ts` 仅追加 `BizSurfaceRecord` / `BizConnectionWithHealth` 与 `listBiz*` / `biz*` 调用；早报方法保留

## 验证

| 步骤 | 做了什么 | 看到什么 |
|---|---|---|
| `npx tsc -b --pretty false` | 收工前复跑 | 退出 **0** |
| `node --test runtime/tests/biz.test.mjs` | 白名单、surface、live 状态机、approve step | **6/6** 通过 |
| `node runtime/smoke.mjs` | 自起 BFF | 绿（live execute 期望 **409** `preview_expired`） |
| `curl 4319/health` | peer BFF | **200** |
| `GET /api/v1/biz/surfaces?workspace=/tmp`（Origin 5173） | peer | **200** |
| `GET /api/v1/biz/traces` | peer（无 lan-assist 时） | **503**（符合降级，非路由缺失） |
| 规格 §8 人工 1–7 + Playwright | 未跑 | **未对**（`media/wave4-05/` 目录已建，无截图） |
| 5174 回归截图 | 未测 | **现网未测** |

## 对照（规格要点）

| 项 | 状态 | 证据 |
|---|---|---|
| biz 路由迁入 `routes/biz.mjs` | 已对 | `runtime/routes/biz.mjs`，`server.mjs` `handleBizRoutes` |
| `/biz/kinds` `/traces` `/surfaces` `/connections` | 已对 | `biz.mjs`；`dsh-core.mjs` `'/catalog'`,`'/traces'` |
| `biz_surfaces` + `biz.sheet.pending`（UI/AI） | 已对 | `010_biz_surface.sql`，preview + `lan-assist-state-watch` |
| operations **live** → `biz_write` + steps | 已对 | `db.mjs` `executeOperationLive`；`server.mjs` execute 分支 |
| RecordsPanel + 07 交给 AI | 已对 | `RecordsPanel.tsx` `buildContextPack(['workspace','biz','memory'], entity)` |
| OperationControl 中文动作 + 分组 | 已对 | `OperationControlPanel.tsx` |
| 业务行不进 SQLite（仅 surface 元数据） | 已对 | 表无行 JSON 缓存 |

## 未做到 / 偏离规格

- 提交条数：行内 preview/抽屉与 RecordsPanel 合并为 `ecae357`（未单独 commit 5/7）；能力已含。
- 迁移文件名规格写 `007_biz_surface.sql`，仓库已有 `007_app_revisions_ddl.sql`，实际为 **`010_biz_surface.sql`**。
- 人工验收与 Playwright：**未对**。
- peer 需重启后 `kinds`/`traces` 才走新路由（改 `runtime/*.mjs`）；本次 curl 未重启 peer，surfaces 200、traces 503。

## 需要 Ace 决定

- 无（peer 重启与 UI 人工验收可由主栈/协调器排期）。
