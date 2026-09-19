# 声明式应用运行时（fde-app/v1）

## 流程

1. AI（`fde-app-builder`）生成 spec → `fde_app_spec_submit` / `POST /api/v1/apps`
2. 校验失败 → 422 + `errors[{path,message}]`
3. `POST /api/v1/apps/:id/activate` 物化 SQLite 表（`app_<slug>__<entity>`）
4. 前端 `AppRuntime`：有 `pages` 时按栏目铺产品页（概览/记一笔/图/流水或卡片）；没有 `pages` 的旧应用仍是 table/form/kanban/stat 切换
5. 新草稿在 `createAppDraft` 里用 `withProductLayout` 补 `pages` + `uses`（不覆盖已声明的）
6. CRUD：`GET|POST /api/v1/apps/:slug/:entity`，`PATCH|DELETE …/:rid`

## 关键路径

| 能力 | 位置 |
|---|---|
| 校验 | `runtime/apps/spec.mjs` |
| DDL | `runtime/apps/materialize.mjs` + `db.execControlledDdl` |
| API | `runtime/routes/apps.mjs` |
| 桥接 | `handleAppsBridge` ← DSH `fde_app_*` 工具 |
| UI | `src/components/apps/*` |

## 动作

- `set`：直接 PATCH 行；`approval:required` → `operations` 待批
- `biz`：返回 preview intents，前端走 `biz/preview` → `biz/write`
- `agent`：BFF 返回 `{ step:'agent', jobs }`；前端 `askAiForResult` + 可选 `writeBack` 人确认写入

## 修订

- `PUT …/spec` 新修订；active 时拒绝删字段/改类型（`breaking_change`）
- `POST …/rollback` 指回旧修订定义（表只增不减）

## 数据隔离

行表含 `workspace_cwd`；列表 API 必带 `workspace` 查询参数（cwd 路径）。
