---
cursor:
  subagentId: "bc-c4dc08fa-561c-5448-b51a-14c63a50c1ad"
---

# 语义图关系与业务查写

只读。家目录 `~/.dsh-fde-x`，图库 `semantic-os/falkordb/graph.db`。物理边只有 `Entity -[:LINK {edge_type}]-> Entity`（`stores.py:_create_edge`）。业务外键不另起一种 Cypher 边。

## 跨表 / 跨系统的基础

跨表基础是 `skos:Concept` 上的属性 `relations`，不是 `LINK.edge_type`。写入形状是 `{from, to, field}`（`kind.py:_pack_relations`）。读出挂在型上（`write.js:kindsFromGraphNodes`）。`resource` 把型绑到一张集合名。

同一库里的现数据：

| 图 | 工作区 | `relations` |
|---|---|---|
| `dsh_b4a6d421c8cf76fd` | `fdex测试` | 有。例：`客户 → 工单 (customer)`，`销售订单 → 销售订单明细 (salesOrder)`，`采购订单 → 采购订单明细 (purchaseOrder)` |
| `dsh_0471075cc12fe1fd` | `dsh-lan-assist` | 有。例：`客户 → 工单 (customerId)`，`供应商 → 采购单 (supplierId)` |
| `dsh_145f2b7508aed94f` | 本仓库 | 型上有 `resource`，`relations` 为 0 |

本仓库图上的 `LINK` 是 `skos:exactMatch`、`hasTopConcept`、`rdfs:domain`、`rdfs:range`、`rdfs:subClassOf`、`narrower`、`broader`。`skos:exactMatch` 是类和概念的镜像（`bootstrap.py:ensure_workspace_owl`），不是两套 ERP 的外键。

跨系统对齐名在 `align.py:RELATIONS`（`owl:equivalentClass`、`skos:exactMatch`、`skos:closeMatch` 等），文件是工作区 `.dsh/semantic-os/alignments.json`（`align.py:_path`）。本仓库和 `fdex测试` 都没有这份文件。检索扩词只用其中三个（`world.py:ALIGN_EXPAND`）。`biz_preview` 的 `system` 是调用方参数（`tools.js` 工具定义），跳查用连接器的一个 `baseUrl`（`write.js` 选连接器处）。

记忆因果边 `supports`、`leads_to`、`belongs_to`、`made_by` 不连业务表。

## 查库和写预览哪一步读到

现查和写预览同一条：`write.js:preview` → `vocabFor` → `semantic.js:vocab`（`list_graph_nodes`，`type=skos:Concept`）。

读关系的两步：

1. 补槽：`slots.js:relationsFromVocab` 读 `from` / `to` / `field`（`preview` 里 `enrichStructuredSlots`，`replay` 跳过）。
2. 多跳：`previewStructured` 在 `steps.length > 1` 时调用 `hopLinkIds` → `lookup.js:relatedField`，再按 `related.ids` / `related.field` 打下一张表。改、建、删、过审走同一段。

单步只有 `kind` + `where` 时，主探不走 `relatedField`。

工作台 HTTP `POST /api/v1/biz/preview`（`biz.mjs`）先 `memory-vocab.mjs:loadMemoryWorkspaceVocab` 扫出 `relations`，交给 `translateBizIntent` 的只有 `kinds` 和 `aliases`。调用方自己带的 `from` / `steps` / `relation` 原样传进闸。闸内再读一遍图。

`catalog.js:listExecutableRelations` 只给 `secretary.js:describeBiz`（工具 `biz_describe`），不打库。右栏 `biz-list-query.ts` 读的是已经生成的 `hopWhere`。

## 绕过图直接 biz_preview

模型工具 `biz_preview`（`tools.js` `execute` → `gate.js:previewBiz`）。`intent.py:route_intent` 只映射到 `search_text`、`lineage`、`brief_for_decision`、`list_memory_cards` 或空，没有 `biz_preview`。语义闸 `gate.js:registerGate` 只拦 `PLUGIN_TOOLS`，`biz_preview` 不在里面，直接 `next()`。

提示写明可以跳过图：`catalog.js:briefFollowup`「有单号或在问现在库里怎样时，不要先 search_text，直接 biz_preview」。

调用到达之后，`preview` 仍会 `vocabFor`。绕过的是「先调图工具」这一步，不是闸内不再装词表。本仓库图上没有 `relations` 时，单表现查不靠一条跨表关系也能进闸。

## 手册、知识库、流程

代码里没有名为手册、知识库、流程的三种节点。现有三截都不把正文写进预览体，也不用 `relations` 决定查哪张表。

**手册（工作区文件 + 目录）。** `.md` / `docs` 归到标签「文档」（`bootstrap.py:classify_path_label`）。点头分类后，`file:` 节点用边 `属于` 接到概念（`bootstrap.py:run_classify_existing_files`）。`preview` / `hopLinkIds` 不读 `属于`。模型侧目录是 `biz_describe` → `describeBiz` → `listExecutableRelations`，读的是概念上的 `relations`，不打库，也不是预览的必经参数。业务行「发给 AI」（`RecordsPanel.askAiForRow`）走 `context-pack.mjs:fillMemory` → `renderContextForPrompt` → `promptAi`，字符串进提示，不进 `runtime-api.ts:bizPreview` 的 body。

**知识库（图检索）。** `bootstrap.py:run_search_text` 扫节点正文；扩词走 `world.py:expand_query`（口语别名 + `ALIGN_EXPAND`），不读 `relations`。工作台同一条是 `fillMemory` 的 `/find` 和 `find_precedents`。命中盖 `world.py:knowledge_grade`，`is_live` 为假。`briefFollowup` 允许现况问题不先 `search_text`。现查结算后 `session-round.js:notePostSettledHopTool` 只认 `search_text`，用来停工具环，不把摘录送进探库。

**流程。** 计划页工作流在 SQLite（`Plan.tsx` 工作流、`runtime-api.ts` 的 `/api/v1/plan/workflows`），不进 `previewBiz`，也不在图里。拍板链是 `brief_for_decision` 和边 `supports` / `leads_to`；`route_intent` 把「业务动作」送到 `brief_for_decision`，不送到 `biz_preview`。`fillMemory` 只在 `intentKind === 'decision'` 时拉简报；业务行发给 AI 不传这个参数。`write.js` 里的 `workflowStatus` 是列名判断，不是流程边。

三截都可以留在会话里当「当时」。今天接到查库/写预览之前的，是模型自己的下一枪 `biz_preview`，或人在右栏另调 `POST /api/v1/biz/preview`。闸不读手册正文、检索摘录、计划工作流。
