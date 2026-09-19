# fde-app-spec

生成 **fde-app/v1** 声明式应用 spec，并通过 `fde_app_spec_submit` 提交到工作台。

目标：按用户需求铺**产品页**（栏目 / 卡片或流水 / 概览数字 / 记一笔 / 图），数据进 SQLite。不是同一套 table+form+kanban+stat 后台脚手架，也不是一层 HTML。

## 输出契约

- `spec` 必须为 `fde-app/v1`
- 必填：`slug`（`^[a-z][a-z0-9-]{1,30}$`）、`name`（≤40）、`entities`（1–12）、`views`（1–20）
- 字段类型：`text|longtext|number|bool|date|datetime|enum|ref|json`
- 视图类型：`table|form|detail|kanban|stat|cards|chart|compose|feed`
- `pages`：栏目。每栏 `blocks` 只放这个需求需要的块：`stats` / `compose` / `chart` / `feed` / `cards`
- `uses`：只声明真正要接的平台能力 `ai|files|float|memory|im|briefing|biz|plan`。没接上的不要写，前端不会画假按钮。入口按这个应用的栏目和字段放：`float` 在工作面顶栏「浮窗」，文件/业务引用在对应字段，其余在记下栏。不要在产品页顶上永远压一排按钮。

## 数据与能力（先分清再写 uses）

生成 spec 前必须按用户选择分清数据放哪，**不要默认铺满 uses**：

- **本地台账**：数据进 SQLite；`uses` 只写用户或需求**点名**的能力，未点名的不要写。
- **邮箱**：走早报 / briefing MCP，已有源；`uses` 含 `briefing`。**禁止**编假 Gmail 收件箱或假邮件 API。
- **业务系统**：走过账闸、预览确认；`uses` 含 `biz`，`ref:biz:<型>` + `kind:biz` 动作。**禁止**编假外部 HTTP 接口。
- **文件**：稿、附件、路径走文件模块；`uses` 含 `files`。

仅当需求点名时才写：`ai`（问数/起草）、`float`（并排浮窗）、`memory`（动作只起草记忆卡片，并设 `memory.onWrite: "draft-card"`）、`im`（拟回进 IM 输入框）、`plan`（**摘成待办**：必须把条目写成 plan 任务，前端会调 `addTask`；不是只加按钮）。

每个对象单独一栏 `pages`：有链接/播放类字段 → 分组 `cards` + `compose`（enum 则 `groupBy`）；有数字或日期的台账 → 同一栏 `stats` + `compose` + `chart` + `feed`。不要永远同一套脚手架换列名。
- `ref:entity:x` 必须引用已声明实体；`ref:biz:<型>` 只记录外部业务引用
- `kind:biz` 动作必须带 `biz.kind` + `biz.action`（现查/改行/新建/删除/过审），校验器会强制 `approval:required`
- `kind:set` 只能修改本实体字段，值类型须匹配
- 禁止保留字段名：`id`、`created_at`、`updated_at`、`workspace_cwd`
- `chart` / 看板 `groupBy` 必须是 `enum` 字段
- 每个 `pages[].blocks[].view`（及 stats 的 `views[]`）必须是已有视图 `id`

## 怎么铺页面（按字段形状，不准套品类模板）

根据**这个需求里的对象和字段**决定 blocks，不要永远输出同一套视图：

- `titleField` 必须是人能读的业务名（名称、标题、摘要），禁止用单号 / 流水号 / 自动编号当标题
- 有数字或要计数 → `stat` 视图，放进 `stats` 概览
- 要往里记一条 → `compose`（或 form）块
- 有 enum → `chart`（groupBy 该 enum）
- 流水/明细（有数字或日期的台账）→ 同一栏同时放 `stats` + `compose` + `chart` + `feed`，不要只给卡片
- 条目本身像资源/跟练（标题 + 说明，或有链接/文件引用字段）→ `cards`，有 enum 就 `groupBy` 该字段；链接字段给人点「打开」，打开 URL 或交给文件模块，不要内嵌播放器
- 多个实体 → 多个 `pages` 当栏目

禁止：把固定品类名单写进 spec；禁止生成代码或改 FDE 源码；禁止套固定品类模板或 HTML 页。
禁止：用单号 / `甲-xxxx` / `记-xxxx` 填 `titleField`。标题必须是人能读的业务名。

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

有链接或文件引用、并按 enum 分组时，用卡片栏（占位名，不要当模板抄）：

```json
{
  "spec": "fde-app/v1",
  "slug": "item-board",
  "name": "按需求取名",
  "uses": ["ai", "float", "files"],
  "entities": [{
    "name": "item", "label": "条目", "titleField": "title",
    "fields": [
      { "name": "title", "label": "标题", "type": "text", "required": true },
      { "name": "source", "label": "分组", "type": "enum", "options": ["甲", "乙"] },
      { "name": "blurb", "label": "说明", "type": "longtext" },
      { "name": "url", "label": "链接", "type": "text" }
    ]
  }],
  "views": [
    { "id": "cards-main", "type": "cards", "entity": "item", "label": "条目", "groupBy": "source" },
    { "id": "form-main", "type": "compose", "entity": "item", "label": "记下" }
  ],
  "pages": [{
    "id": "page-item",
    "label": "条目",
    "blocks": [
      { "kind": "cards", "view": "cards-main" },
      { "kind": "compose", "view": "form-main" }
    ]
  }]
}
```

`uses` 示例：要问数/起草 → `ai`；要并排用 → `float`；稿、附件、导出走文件模块 → `files`；记住动作只起草卡片、人点头才入档 → `memory`（并设 `memory.onWrite: "draft-card"`）；拟回 IM 放进输入框、人点发送 → `im`；早报/MCP 已有源 → `briefing`；引用业务对象 `ref:biz:<型>` 且写外部走预览确认 → `biz`；摘成待办、写入 plan 任务 → `plan`。需求点名这些能力就必须写进 `uses`；没接到的不要写，前端不会画假按钮。

## 命名

- 用户可见 `label` / `name` 跟用户需求走；`slug` / 实体 `name` 用英文

## 查询工具

- 只读：`fde_app_records_query({ slug, entity, filter?, limit? })`
- 提案不写库：`fde_app_records_propose({ slug, entity, op, rows })`
