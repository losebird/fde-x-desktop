# 声明式应用运行时（fde-app/v1）

## 流程

1. AI（`fde-app-builder`）生成 **台账 `fde-app/v1` 或托管 Web `fde-web/v1`** → `fde_app_spec_submit`（Web 包用 `files[{path,content}]`）/ `POST /api/v1/apps`
2. 校验失败 → 422 + `errors[{path,message}]`
3. `POST /api/v1/apps/:id/activate`：台账物化 SQLite 表；Web 应用检查包入口存在
4. 前端 `AppRuntime`：台账铺产品页；`fde-web/v1` 用 iframe 跑包（`/api/v1/apps/:id/live/`）
5. Web 包在工作区 `apps/<slug>/`。`localStorage` 与 `window.fdeApp` 写入 `app_documents`
6. CRUD：`GET|POST /api/v1/apps/:slug/:entity`；Web 文档 `GET|PUT /api/v1/apps/:id/store/:key`
7. 分享同一份实例。台账公开页仍是 FDE `PublicApp`；Web 应用的 `/a/:shareId` **就是这个网站**（包的 index.html），不再套工作台 SPA

## 关键路径

| 能力 | 位置 |
|---|---|
| 校验 | `runtime/apps/spec.mjs` |
| DDL | `runtime/apps/materialize.mjs` + `db.execControlledDdl` |
| API | `runtime/routes/apps.mjs` |
| 公开分享 | `runtime/apps/share.mjs` + `runtime/routes/app-share.mjs`；台账页 `src/pages/PublicApp.tsx`；Web 包 `handlePublicWebBundle` |
| Web 宿主 | `runtime/apps/bundle.mjs` + `web-host.mjs` + `documents.mjs`；UI `AppWebRuntime.tsx` |
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
