# fde-app-spec

生成 **fde-app/v1** 声明式应用 spec，并通过 `fde_app_spec_submit` 提交到工作台。

目标：按用户需求铺**产品页**（栏目 / 卡片或流水 / 概览数字 / 记一笔 / 图），数据进 SQLite。不是同一套 table+form+kanban+stat 后台脚手架，也不是一层 HTML。

## 输出契约

- `spec` 必须为 `fde-app/v1`
- 必填：`slug`（`^[a-z][a-z0-9-]{1,30}$`）、`name`（≤40）、`entities`（1–12）、`views`（1–20）
- 字段类型：`text|longtext|number|bool|date|datetime|enum|ref|json`
- 视图类型：`table|form|detail|kanban|stat|cards|chart|compose|feed`
- `pages`：栏目。每栏 `blocks` 只放这个需求需要的块：`stats` / `compose` / `chart` / `feed` / `cards`
- `uses`：只声明真正要接的平台能力 `ai|files|float|memory|im|briefing|biz`。没接上的不要写，前端不会画假按钮
- `ref:entity:x` 必须引用已声明实体；`ref:biz:<型>` 只记录外部业务引用
- `kind:biz` 动作必须带 `biz.kind` + `biz.action`（现查/改行/新建/删除/过审），校验器会强制 `approval:required`
- `kind:set` 只能修改本实体字段，值类型须匹配
- 禁止保留字段名：`id`、`created_at`、`updated_at`、`workspace_cwd`
- `chart` / 看板 `groupBy` 必须是 `enum` 字段
- 每个 `pages[].blocks[].view`（及 stats 的 `views[]`）必须是已有视图 `id`

## 怎么铺页面（按字段形状，不准套品类模板）

根据**这个需求里的对象和字段**决定 blocks，不要永远输出同一套视图：

- 有数字或要计数 → `stat` 视图，放进 `stats` 概览
- 要往里记一条 → `compose`（或 form）块
- 有 enum → `chart`（groupBy 该 enum）
- 流水/明细 → `feed`（可指向 table 视图）
- 条目本身像卡片（标题 + 长文、没有数量字段）→ `cards`
- 多个实体 → 多个 `pages` 当栏目

禁止：把固定品类名单写进 spec；禁止生成代码或改 FDE 源码。

## 提交流程

1. 起草完整 spec（含 `pages` + `uses` + 被引用的 views）
2. 调用 `fde_app_spec_submit({ requestId, spec })`
3. 若返回 `errors[]`，逐条修正后再次提交，直至 `appId` + `revision` 成功

## 结构示例（占位名，不要当模板抄）

```json
{
  "spec": "fde-app/v1",
  "slug": "item-log",
  "name": "按需求取名",
  "uses": ["ai", "float"],
  "entities": [{
    "name": "item", "label": "条目", "titleField": "title",
    "fields": [
      { "name": "title", "label": "标题", "type": "text", "required": true },
      { "name": "amount", "label": "数量", "type": "number" },
      { "name": "kind", "label": "分类", "type": "enum", "options": ["甲", "乙"] },
      { "name": "happened_on", "label": "日期", "type": "date" }
    ]
  }],
  "views": [
    { "id": "stat-count", "type": "stat", "entity": "item", "label": "条数", "metric": { "fn": "count" } },
    { "id": "stat-sum", "type": "stat", "entity": "item", "label": "数量合计", "metric": { "fn": "sum", "field": "amount" } },
    { "id": "form-main", "type": "compose", "entity": "item", "label": "记下" },
    { "id": "chart-kind", "type": "chart", "entity": "item", "groupBy": "kind", "metric": { "fn": "sum", "field": "amount" } },
    { "id": "feed-main", "type": "feed", "entity": "item", "columns": ["title", "amount", "kind", "happened_on"] }
  ],
  "pages": [{
    "id": "page-item",
    "label": "记录",
    "blocks": [
      { "kind": "stats", "views": ["stat-count", "stat-sum"] },
      { "kind": "compose", "view": "form-main" },
      { "kind": "chart", "view": "chart-kind" },
      { "kind": "feed", "view": "feed-main" }
    ]
  }]
}
```

`uses` 示例：要问数/起草 → `ai`；要并排用 → `float`；稿和导出 → `files`；记住动作 → `memory`；拟回 IM → `im`；早报源 → `briefing`；引用业务对象 → `biz`。

## 命名

- 用户可见 `label` / `name` 跟用户需求走；`slug` / 实体 `name` 用英文

## 查询工具

- 只读：`fde_app_records_query({ slug, entity, filter?, limit? })`
- 提案不写库：`fde_app_records_propose({ slug, entity, op, rows })`
