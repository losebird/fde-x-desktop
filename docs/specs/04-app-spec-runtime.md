# 04 · 声明式应用：App Spec + SQLite 运行时 + 通用渲染器 + Builder

依赖：01（事件）、02（bridge 工具、`askAiForResult`、preset 骨架）。被依赖：05（业务记录展示本地实体）、06（早报 stat 区块）、07（记忆写入）。协议：`00-agent-protocol.md`。

## 1. 目标

用户在业务应用模块描述需求 → AI（`fde-app-builder` preset）生成 `fde-app/v1` spec → 校验 → 预览 → 人「采纳并激活」→ SQLite 建表 → 通用渲染器提供表格/表单/详情/看板 → 能增删改查、能跑声明的动作。应用自有数据在 SQLite；引用外部业务数据只存 id + 快照；写外部系统走闸。

## 2. 范围与禁区

- 做：Spec JSON Schema、校验器、物化器（受控 DDL）、通用 CRUD API、动作执行器（`set` / `biz` / `agent`）、前端渲染器五件（table / form / detail / kanban / stat）、创建向导（描述 → preset → 生成 → 预览 → 采纳）、spec 编辑抽屉、版本回滚。
- 不做（本版）：代码级应用（L2）、calendar 视图、文件类型字段上传、跨应用关联查询、多用户权限、实时协作。
- 禁区：不改业务应用三 Tab 结构与顶栏；不动 lan-assist 闸语义；`server.mjs` 只挂路由。

## 3. 现有代码接点

| 接点 | 位置 |
|---|---|
| 表 | `003_business_operations.sql`：`business_apps` L18–29（`app_kind` CHECK `generated|connected|system`，`status`，`definition_json`，`current_revision`）、`business_app_revisions` L31–40、`operations` L42–68、`operation_steps` L74–87（无 INSERT 路径）、`approvals` L89–98、`compensations` L121–133 |
| 现有 API | `server.mjs` L2292–2342 `business/*`（create 接受任意 object L2310–2317；`db.mjs` L306–308 固定 `generated/draft`） |
| 前端 | `Data.tsx`：应用 Tab L137–148、创建 L342–366（`promptAi` 后即止）、`AppDraftEditor` L216–318（`updateBusinessApp` L241–255）、选中渲染 L425–431、`appKind` 展示 L414–418 |
| 类型 | `runtime-api.ts` L192–199 `definition: JsonValue`；`types.ts` 无 definition 结构 |
| 业务闸 | `server.mjs` L1682–1770 `biz/preview|write|catalog|lookup`；`translateBizIntent` L132–173 |
| operations | `server.mjs` L2419–2508 plan（`plan_json='{}'`）、L2374–2391 approve、L2394–2416 execute（live 501） |
| DB 层 | `db.mjs` 仅迁移 + DML `prepare`，无运行时 DDL |
| 渲染 | 无通用表格/表单组件；`RecordBrowser` L477–549、`OperationControl` L552–673 为页面内专用 |

## 4. App Spec `fde-app/v1`（JSON Schema 原文）

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "fde-app/v1",
  "type": "object",
  "required": ["spec", "slug", "name", "entities", "views"],
  "additionalProperties": false,
  "properties": {
    "spec": { "const": "fde-app/v1" },
    "slug": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,30}$" },
    "name": { "type": "string", "minLength": 1, "maxLength": 40 },
    "description": { "type": "string", "maxLength": 400 },
    "entities": {
      "type": "array", "minItems": 1, "maxItems": 12,
      "items": {
        "type": "object", "required": ["name", "label", "fields"], "additionalProperties": false,
        "properties": {
          "name": { "type": "string", "pattern": "^[a-z][a-z0-9_]{0,30}$" },
          "label": { "type": "string", "maxLength": 20 },
          "titleField": { "type": "string" },
          "fields": {
            "type": "array", "minItems": 1, "maxItems": 40,
            "items": {
              "type": "object", "required": ["name", "type"], "additionalProperties": false,
              "properties": {
                "name": { "type": "string", "pattern": "^[a-z][a-z0-9_]{0,30}$" },
                "label": { "type": "string", "maxLength": 20 },
                "type": { "enum": ["text", "longtext", "number", "bool", "date", "datetime", "enum", "ref", "json"] },
                "required": { "type": "boolean" },
                "options": { "type": "array", "items": { "type": "string" }, "maxItems": 30 },
                "ref": { "type": "string", "pattern": "^(entity:[a-z][a-z0-9_]*|biz:[^\\s]{1,40})$" },
                "default": {},
                "unique": { "type": "boolean" }
              }
            }
          }
        }
      }
    },
    "views": {
      "type": "array", "minItems": 1, "maxItems": 20,
      "items": {
        "type": "object", "required": ["type", "entity"], "additionalProperties": false,
        "properties": {
          "id": { "type": "string" },
          "type": { "enum": ["table", "form", "detail", "kanban", "stat"] },
          "entity": { "type": "string" },
          "label": { "type": "string" },
          "columns": { "type": "array", "items": { "type": "string" } },
          "filters": { "type": "array", "items": { "type": "string" } },
          "sort": { "type": "object", "properties": { "field": { "type": "string" }, "dir": { "enum": ["asc", "desc"] } } },
          "groupBy": { "type": "string" },
          "metric": { "type": "object", "properties": { "fn": { "enum": ["count", "sum", "avg"] }, "field": { "type": "string" }, "where": { "type": "object" } } }
        }
      }
    },
    "actions": {
      "type": "array", "maxItems": 20,
      "items": {
        "type": "object", "required": ["name", "label", "entity", "kind"], "additionalProperties": false,
        "properties": {
          "name": { "type": "string", "pattern": "^[a-z][a-z0-9-]{0,30}$" },
          "label": { "type": "string", "maxLength": 12 },
          "entity": { "type": "string" },
          "kind": { "enum": ["set", "biz", "agent"] },
          "set": { "type": "object" },
          "biz": { "type": "object", "required": ["kind", "action"], "properties": { "kind": { "type": "string" }, "action": { "enum": ["现查", "改行", "新建", "删除", "过审"] }, "map": { "type": "object" } } },
          "agent": { "type": "object", "required": ["preset", "prompt"], "properties": { "preset": { "type": "string" }, "prompt": { "type": "string" }, "writeBack": { "type": "string" } } },
          "approval": { "enum": ["none", "required"] }
        }
      }
    },
    "permissions": {
      "type": "object", "additionalProperties": false,
      "properties": { "read": { "enum": ["workspace"] }, "write": { "enum": ["owner", "workspace"] }, "approve": { "enum": ["owner"] } }
    },
    "memory": { "type": "object", "properties": { "onWrite": { "enum": ["none", "draft-card"] } } }
  }
}
```

**语义校验（Schema 之外，`runtime/apps/spec.mjs` 实现）**：
- `views[].entity`、`actions[].entity`、`titleField`、`columns`、`filters`、`groupBy`、`sort.field`、`metric.field` 必须引用存在的实体/字段；`groupBy` 字段必须是 `enum`。
- `ref: entity:x` 必须存在；`ref: biz:<型>` 只记录，不校验（运行时 `biz_describe` 现查）。
- `kind: biz` 的动作强制 `approval: 'required'`（校验器自动补，不报错）。
- `kind: set` 只能 set 本实体字段，值类型要匹配。
- `slug` 在同工作区唯一（激活时检查，409 `slug_taken`）。
- 保留字：表名前缀 `app_`；字段名不能是 `id/created_at/updated_at/workspace_cwd`。

## 5. 物化（SQLite 受控 DDL，`runtime/apps/materialize.mjs`）

- 表名：`app_<slug>__<entity>`；系统列：`id TEXT PK`（ulid）、`workspace_cwd TEXT NOT NULL`、`created_at INTEGER`、`updated_at INTEGER`。
- 类型映射：`text/longtext/enum/ref/date/datetime → TEXT`（date 存 `YYYY-MM-DD`，datetime 存 ISO），`number → REAL`，`bool → INTEGER(0/1)`，`json → TEXT`。`unique` → `CREATE UNIQUE INDEX`。`required` 只在应用层校验（SQLite 不加 NOT NULL，避免迁移地狱）。
- 修订（新 revision）：只允许 **加字段**（`ALTER TABLE ADD COLUMN`）、**加实体**（`CREATE TABLE`）、改 label/views/actions（无 DDL）。删字段/改类型 → 422 `breaking_change`，提示「新建实体或保留旧字段」。
- 所有 DDL 由物化器生成，`db.mjs` 新增 `execControlledDdl(sql, { allowPrefix:'app_' })`：正则校验语句只含 `CREATE TABLE IF NOT EXISTS app_…`、`ALTER TABLE app_… ADD COLUMN`、`CREATE UNIQUE INDEX … ON app_…`，否则抛错。
- 每次物化写 `business_app_revisions`（`definition_json`、`ddl_applied_json`、`created_at`），`business_apps.current_revision` 前进。回滚 = 把 `current_revision` 指回旧修订（表结构只增不减，所以安全）。

## 6. API 契约（`runtime/routes/apps.mjs`）

复用 `business_apps`；`definition_json` 存 spec。

| 路由 | 说明 |
|---|---|
| `GET /api/v1/apps?workspace` | 列表（含 status、slug、revision） |
| `POST /api/v1/apps` | `{ workspaceCwd, spec }` → 校验 → 存 `draft`；返回 `{ ok, data:{ appId, revision }, errors?: [{ path, message }] }`（422 时 errors 非空） |
| `GET /api/v1/apps/:id` | 含 spec、revisions 摘要 |
| `PUT /api/v1/apps/:id/spec` | 新 spec → 校验 → 若 `active` 则做 breaking 检查 → 新 revision（不物化）|
| `POST /api/v1/apps/:id/activate` | 物化当前 revision → `status='active'` → `emit('app.activated')`；409 `slug_taken`、422 校验 |
| `POST /api/v1/apps/:id/archive` | `status='archived'`（表保留） |
| `POST /api/v1/apps/:id/rollback` | `{ revision }` |
| `GET /api/v1/apps/:slug/:entity?workspace&filter=<json>&sort=&page=&size=` | 行列表 `{ rows, columns, total }`；`ref: biz:*` 字段附 `display` 快照 |
| `GET /api/v1/apps/:slug/:entity/:rid` | 单行 |
| `POST /api/v1/apps/:slug/:entity` | 插入（应用层 required/enum/type 校验）→ `emit('app.record.changed')` → 若 `memory.onWrite='draft-card'` 走规格 07 |
| `PATCH /api/v1/apps/:slug/:entity/:rid` | 更新 |
| `DELETE /api/v1/apps/:slug/:entity/:rid` | 软删（加 `deleted_at` 系统列） |
| `POST /api/v1/apps/:slug/actions/:name` | `{ rids: [] }` → 见 §7 |
| `GET /api/v1/apps/:slug/stats/:viewId` | stat 视图数值 |
| `POST /api/v1/bridge/app-spec-submit` | 规格 02 工具后端：`{ requestId, spec }` → 同 `POST /apps` 逻辑，返回 errors 给 AI |
| `POST /api/v1/bridge/app-records-query` / `-propose` | 只读查询 / 生成 operations 提案（不写） |

所有写路由：Origin 闸 + 记 `operations`（`kind:'app.record'`，`plan_json` 含 diff；`operation_steps` 补 INSERT）。

## 7. 动作执行器（`runtime/apps/actions.mjs`）

| kind | 行为 |
|---|---|
| `set` | 对选中行 PATCH `set` 字段；`approval:'required'` 时先建 `operations(awaiting_approval)`，人在操作控制批准后执行 |
| `biz` | 对每行按 `map` 组装参数 → `POST /api/v1/biz/preview {kind, action, …}` → 返回 `previewId + sheet` 给前端 →「确认过账」→ `POST /api/v1/biz/write {preview_id}`；**永远**两步；写成功 `emit('biz.write.done')` 并在行上记 `biz_ref` 快照 |
| `agent` | `askAiForResult({ preset, prompt: 模板渲染(row), schema: writeBack? })`（规格 02）；`writeBack` 给出字段名时，结果先显示为「AI 建议」，人点「写入」才 PATCH |

## 8. 前端契约（`src/components/apps/`）

| 组件 | props | 说明 |
|---|---|---|
| `AppRuntime` | `{ app }` | 顶部视图切换（views 标签，复用现有 Tab 样式）+ 渲染当前视图；右上「编辑 spec」「版本」「归档」 |
| `SpecTable` | `{ app, view }` | 列 = `view.columns`（默认全部）；筛选 = `view.filters`（enum 下拉、text 搜索、date 范围）；排序；分页 20；行选中；行内动作菜单（来自 `actions`）；`ref:biz` 显示快照 + 「现查」小按钮 |
| `SpecForm` | `{ app, entity, rid? , onDone }` | 按字段类型渲染控件（text/longtext/number/bool/date/datetime/enum/ref 选择器/json 文本）；required 校验；提交 POST/PATCH；错误 422 逐字段显示 |
| `SpecDetail` | `{ app, entity, rid }` | 只读字段 + 动作按钮 + 「编辑」切 form |
| `SpecKanban` | `{ app, view }` | 按 `groupBy` enum 分列；拖拽改值 = PATCH（拖放用 pointer events，无新依赖） |
| `SpecStat` | `{ app, view }` | 一个数字 + 标签；供早报复用（规格 06） |
| `AppCreateWizard` | `{ onCreated }` | 步骤：① 描述需求（textarea）+ 选 preset（默认 `fde-app-builder`）+ 可选勾外部型（`biz_describe` 列表）② 生成中（左栏出现新会话）③ 预览（`AppRuntime` 用 3 行假数据渲染 draft）+ 校验错误列表 ④「采纳并激活」/「让 AI 改」（把错误或用户修改意见再发同会话） |
| `SpecEditor` | `{ app }` | 现有 `AppDraftEditor` 改造：JSON 编辑 + 校验结果 + 「保存为新修订」 |

放置：业务应用「应用」Tab 选中 `active` 应用 → `AppRuntime`；`draft` → 预览 + 激活按钮；`archived` → 只读。所有样式复用现有 token 与 className。

Builder 流程（前端）：

```
AppCreateWizard.submit →
  askAiForResult({
    intent: '创建业务应用',
    preset: userPreset ?? 'fde-app-builder',
    title: `应用构建 · ${简述}`,
    context: ['workspace','apps','biz'],
    prompt: `需求：${描述}\n可用外部型：${kinds}\n请生成 fde-app/v1 spec 并调用 fde_app_spec_submit(requestId, spec)。若返回 errors，修正后重新提交。`,
    schema: { type:'object', required:['appId','revision'] }
  })
→ 拿 appId → GET /apps/:id → 预览
```

## 9. Skill `fde-app-spec`（放 `runtime/presets/fde-app-builder/skills/fde-app-spec/SKILL.md`）

内容要点（agent 写时按此展开，≤200 行）：spec 全文 schema（§4）、语义规则、三个完整示例（台账 / 审批流 / 看板）、命名规范（中文 label、英文 name）、何时用 `ref:biz`、`kind:biz` 动作必须 `approval:required`、提交流程与错误重试、**禁止**生成代码或建议改 FDE 源码。

## 10. 错误与降级

- 校验失败：前端逐条显示 `path: message`，「让 AI 改」把 errors 原文回发。
- 物化失败（DDL 异常）：事务回滚，`status` 保持 `draft`，红条含错误码；`revisions` 记 `failed`。
- DSH 未连：向导第 ① 步禁用「生成」，提示连接核心；已激活应用的 CRUD 不依赖 DSH，照常可用。
- `ref:biz` 现查失败：显示快照 + 灰色「未能刷新」。
- 大表：分页 + `LIMIT`；`total` 用 `COUNT(*)`，>10 万行时显示「约」。

## 11. 验收清单

人工（5175，按顺序）：
1. 业务应用 → 应用 → AI 创建 → 描述「供应商拜访台账：供应商、日期、摘要、状态（计划/已拜访/需跟进）」→ 生成 → 左栏出现「应用构建 · 供应商拜访台账」会话 → 预览出现 table/form/kanban 三个视图 → 采纳并激活。
2. `sqlite3 …-peer.sqlite '.tables'` 有 `app_supplier-visits__visit`（或 AI 取的 slug）；`business_app_revisions` 1 条。
3. 表格视图新建 2 行（表单校验：状态必须是 enum；日期控件）→ 列表出现 → 刷新仍在。
4. 看板按状态分列；拖一张卡到「需跟进」→ 表格里该行状态变了。
5. 行内动作「标记跟进」（`set`）→ 状态变；动作里若有 `biz` 类型 → 弹出 preview sheet → 确认 → `biz_write` 成功（无 NocoBase 时显示闸返回的错误，不崩）。
6. 编辑 spec 加一个字段 `phone` → 保存新修订 → 激活 → 表格多一列；尝试删字段 → 422 `breaking_change` 提示。
7. 版本 → 回滚到修订 1 → 列消失但数据保留。
8. 归档 → 应用只读；表仍在。
9. 给 AI 发一条会调 `fde_app_records_query` 的 prompt → 轨迹里返回行数据。
10. 5174 回归：业务应用页原有三 Tab 与 seed 应用显示不变。

自动化：`runtime/tests/apps.spec.test.mjs`（schema + 语义校验用例 ≥ 20 条，含每类错误）、`apps.materialize.test.mjs`（建表、加列、拒绝 breaking、DDL 白名单拒绝 `DROP`）、`apps.crud.test.mjs`（增删改查、enum/required 校验、软删、分页、工作区隔离）、`apps.actions.test.mjs`（set 直接执行、biz 两步、approval 走 operations）。

## 12. 提交拆分

1. `feat(apps): fde-app/v1 schema + semantic validator + tests`
2. `feat(apps): controlled DDL materializer + revisions + tests`
3. `feat(apps): CRUD routes + operations audit + events`
4. `feat(apps): action executor (set/biz/agent)`
5. `feat(apps): bridge endpoints app-spec-submit / records-query / records-propose`
6. `feat(web): SpecTable/SpecForm/SpecDetail`
7. `feat(web): SpecKanban/SpecStat`
8. `feat(web): AppRuntime + SpecEditor replace AppDraftEditor`
9. `feat(web): AppCreateWizard via askAiForResult`
10. `feat(presets): fde-app-builder skill fde-app-spec`
11. `docs: apps runtime reference`（仓库 `docs/APPS.md`，≤80 行）

## 13. 开放问题

- `business_apps.app_kind` 对声明式应用统一用 `generated`；`connected` 暂不用。
- `ref:biz` 显示快照的字段：默认取 `biz_preview` 返回行的 `columns[0]` 作为显示值；若词表有 `titleField` 则用它。
