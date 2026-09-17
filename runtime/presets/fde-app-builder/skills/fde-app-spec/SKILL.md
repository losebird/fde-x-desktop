# fde-app-spec

生成 **fde-app/v1** 声明式业务应用 spec，并通过 `fde_app_spec_submit` 提交到工作台。

## 输出契约

- `spec` 必须为 `fde-app/v1`
- 必填：`slug`（`^[a-z][a-z0-9-]{1,30}$`）、`name`（≤40）、`entities`（1–12）、`views`（1–20）
- 字段类型：`text|longtext|number|bool|date|datetime|enum|ref|json`
- `ref:entity:x` 必须引用已声明实体；`ref:biz:<型>` 只记录外部业务引用
- `kind:biz` 动作必须带 `biz.kind` + `biz.action`（现查/改行/新建/删除/过审），校验器会强制 `approval:required`
- `kind:set` 只能修改本实体字段，值类型须匹配
- 禁止保留字段名：`id`、`created_at`、`updated_at`、`workspace_cwd`
- 看板 `groupBy` 必须是 `enum` 字段

## 提交流程

1. 根据用户需求起草完整 spec（含 table + form + 常用 kanban/stat）
2. 调用 `fde_app_spec_submit({ requestId, spec })`
3. 若返回 `errors[]`，逐条修正后再次提交，直至 `appId` + `revision` 成功
4. **禁止**生成 Cordis 插件、React 源码或修改 FDE 仓库

## 示例：台账

```json
{
  "spec": "fde-app/v1",
  "slug": "supplier-visits",
  "name": "供应商拜访台账",
  "entities": [{
    "name": "visit", "label": "拜访", "titleField": "summary",
    "fields": [
      { "name": "supplier", "label": "供应商", "type": "text", "required": true },
      { "name": "visit_date", "label": "日期", "type": "date", "required": true },
      { "name": "summary", "label": "摘要", "type": "longtext" },
      { "name": "status", "label": "状态", "type": "enum", "required": true,
        "options": ["计划", "已拜访", "需跟进"] }
    ]
  }],
  "views": [
    { "id": "t1", "type": "table", "entity": "visit", "columns": ["supplier","visit_date","summary","status"] },
    { "id": "f1", "type": "form", "entity": "visit" },
    { "id": "k1", "type": "kanban", "entity": "visit", "groupBy": "status" }
  ],
  "actions": [
    { "name": "mark-follow", "label": "标记跟进", "entity": "visit", "kind": "set", "set": { "status": "需跟进" } }
  ]
}
```

## 示例：带业务过账

```json
{
  "name": "sync-customer", "label": "同步客户", "entity": "visit", "kind": "biz",
  "approval": "required",
  "biz": { "kind": "客户", "action": "改行", "map": { "id": "$supplier" } }
}
```

## 示例：看板 + 统计

- kanban：`groupBy` 指向状态 enum
- stat：`metric: { "fn": "count" }` 或 `sum`/`avg` + `field`

## 命名

- 用户可见 `label` 用中文；`name`/`slug` 用英文 snake/kebab

## 查询工具

- 只读：`fde_app_records_query({ slug, entity, filter?, limit? })`
- 提案不写库：`fde_app_records_propose({ slug, entity, op, rows })`
