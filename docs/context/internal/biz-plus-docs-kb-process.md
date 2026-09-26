---
cursor:
  subagentId: "bc-5db0b7ba-db59-5365-b8f0-d16ca9552b6a"
---

# 业务 CRUD 与文档 / 知识 / 流程能否「合在一起」— 现网只读结论

**结论：部分能。** 同一 AI 会话里模型可以依次调用语义工具（`route_intent`、`search_text`、`brief_for_decision` 等）与业务闸（`biz_preview` → 人审 → `biz_write`），词表与关系图也会进过账解析；但**没有**产品级「先读工作区手册 / 知识库 / 流程，再按规章权威写业务库」的单条流水线，业务写闸也不认手册条文为真值来源。

**一句话根因：** 业务真值与写路径锁在 **lan-assist 闸 + 连接器词表/图（决策 15）**；文件、语义图、记忆检索是 **并行模块/Host 工具**，只在会话里由模型自行串联，runtime 未做合一编排，且规格明确 **图/search_text 是「当时」、现况必须 biz_preview**。

---

## 1. 现在能不能结合

| 维度 | 判定 |
|------|------|
| 与规章制度 / 用户手册 / 业务手册（工作区 cwd 文件） | **不能（产品合一）**；**部分能（会话内）** — 文件页可把正文 attach 进 DSH 会话，模型可读后再调 `biz_*`，闸不读文件 |
| 与公司知识库 | **部分能** — 顶栏无独立「知识库」模块；能力在 **「记忆」**（semantic-os 六画布 + `/find`）；与业务闸分轨 |
| 与流程管理 | **部分能** — 源码无「流程管理」顶栏模块；决策/摄取/词表治理在 **记忆** 子画布（决策、知识分类、管理/摄取）；不与 `biz_write` 绑死 |
| 业务增删改查审 | **能** — `biz_preview` / `biz_write` + BFF `/api/v1/biz/preview`；浮现与确认在业务应用/操作记录 UI |

---

## 2. 哪条路真实存在

### 2.1 同一回合里「先语义、后业务」— 仅 AI 会话工具链，无 runtime 编排

- **`route_intent`**：semantic-os Host 工具，实现 `~/.dsh-fde-x/vendor/dsh-semantic-os/python/bootstrap.py` 注册 `route_intent` → `intent.route_intent`；工具白名单见同包 `gate.js` 的 `PLUGIN_TOOLS`（含 `route_intent`，**不含** `biz_preview`）。
- **`search_text`**：同上 Host；catalog 明示只查当时（`runtime/vendor-overlays/dsh-lan-assist/catalog.js` 的 `buildCatalog` / `briefFollowup`：`search_text 只查当时…有单号或在问现在库里怎样时，不要先 search_text，直接 biz_preview`）。
- **`biz_preview` / `biz_write`**：lan-assist overlay `runtime/vendor-overlays/dsh-lan-assist/tools.js` 注册；写闸 `runtime/vendor-overlays/dsh-lan-assist/gate.js` + `write.js`（`vocabFor` → `opts.loadVocab`）。
- **关系**：`route_intent` 只建议下一工具（如 `search_text` 或 `brief_for_decision`），**不会**自动拉工作区文件、也不会自动触发 `biz_preview`；项目内会话日志已多次出现「建议 search_text 但未调用 / 或查了图再改打 biz_preview」——属于模型串联，不是产品「合一处理」。

### 2.2 词表 + 图 → 业务闸（结构绑定，非手册权威）

- Host 读词表：`runtime/vendor-overlays/dsh-lan-assist/index.js` 的 `loadWorkspaceVocab` → `semantic.vocab` → `list_graph_nodes`（`semantic.js` L238–245）。
- BFF 合并 catalog + 图：`runtime/routes/biz.mjs` 的 `loadWorkspaceKinds`、`loadMemoryWorkspaceVocab`（`runtime/biz/memory-vocab.mjs`）→ `mergeConnectedKindCatalog`；`translateBizIntent` / `mergeVocabExtra` 把 **kind / can / from·steps** 交给 `/preview`。
- 口语与 leftover：`runtime/vendor-overlays/dsh-lan-assist/slots.js` 的 `leftoverNameIdentity`、`leftoverKindMissingFromCatalog`；回合 `session-round.js` 的 leftover 取消逻辑——均属 **闸上解析**，不读 markdown 手册正文。
- **权威边界**：图给 **型、动作槽、关系 hop**；**不给**「手册第 X 条所以 patch 字段 Y」的写闸校验。业务行真值仍在连接器（决策 1 / `project-context.md` 铁律）。

### 2.3 工作区文件 → AI（不进写闸）

- 顶栏 **「文件」**：`src/store/app.ts` `defaultPanels`（无知识库/流程管理 id）。
- 发给 AI：`src/pages/Files.tsx` 派发 `fde-x-attach-file` → `src/pages/AI.tsx` `attachDroppedFile` → BFF `/api/v1/files/raw` → DSH `attachFiles`。**不**调用 `runtime/routes/biz.mjs` 的 preview/write。

### 2.4 「公司知识库 / 流程管理」在 UI 上的对应

- **记忆** `src/pages/Memory.tsx`：semantic-os 画布 — 探索、分析、**决策**、导入导出、**知识分类（词表）**、**管理（摄取/血缘）**；COVER_LABEL 含 `ontology: '制度'`。
- 文档进图：`runtime/vendor-overlays/dsh-lan-assist/semantic.js` `ingestPaths` → `POST /semantic-os/ingest/start`（cwd + paths）。摄取后检索走 `search_text` / `/find`，**不是** biz 现查。
- BFF 上下文包（**仅 prompt 拼装，不接闸**）：`runtime/context-pack.mjs` 的 `fillMemory`（semantic `/find` + `find_precedents`）；`RecordsPanel.tsx` `askAiForRow` 使用 `scopes: ['workspace','biz','memory']` 后 `promptAi` — **不**自动 `biz_preview`。

### 2.5 IM / 先例与记忆的弱结合

- `src/lib/im-ai.ts`：先例动作提示可 `search_text`；`IMWorkspace.tsx` 拟回/先例时 `buildContextPack` 含 `memory` scope — 仍 **不是** 业务过账路径。

### 2.6 有无「手册说了所以按手册写」的权威

- **无。** `biz_write` 只吃有效 `preview_id` 令牌（`gate.js` / `write.js`）；预览认 **词表 can + 连接器字段 + hop**，不认规章 PDF/MD 引用。`brief_for_decision` / `record_decision` 是 **决策台账**（semantic-os），不是 ERP 字段级写穿。

---

## 3. 哪条路不存在（模型碰巧连用不算）

| 不存在的产品能力 | 依据 |
|------------------|------|
| runtime 编排：固定顺序「读工作区手册 → 查知识库 → 走流程 → biz_preview/write」 | `biz.mjs` preview 路径无 `context-pack`、无 `files/raw`、无 ingest 调用 |
| `route_intent` 与 `biz_preview` 的合一路由 | 两插件分轨：semantic-os `gate.js` vs lan-assist `tools.js` |
| 顶栏独立「知识库」「流程管理」与业务闸联动 | `defaultPanels` 仅 IM/早报/计划/文件/业务应用/MCP/Skills/记忆/设置 |
| 手册/制度文本作为写闸校验源 | `write.js` `recognize` / `vocabRow` 仅词表行；无规章 parser |
| `search_text` 结果驱动 `biz_write` 字段 | `catalog.js`：图不是现况；现查/写必须 `biz_preview` |
| 业务记录页默认拉手册再浮现 | `RecordsPanel.tsx` Empty 文案：仅 AI 现查/改行后浮现，不整表、不读文档库 |
| BFF `context-pack` 注入 lan-assist `/preview` body | `grep` 业务路由无 `buildContextPack` |

---

## 4. 证据索引（路径 + 符号 / 模块）

| 主题 | 位置 |
|------|------|
| 顶栏模块集合 | `src/store/app.ts` — `defaultPanels()` |
| 业务 preview/write BFF | `runtime/routes/biz.mjs` — `translateBizIntent`, `POST /api/v1/biz/preview`, `lanAssist('/preview')` |
| 图词表进闸 | `runtime/vendor-overlays/dsh-lan-assist/index.js` — `loadWorkspaceVocab`; `runtime/biz/memory-vocab.mjs` — `loadMemoryWorkspaceVocab` |
| leftover / 口语 | `runtime/vendor-overlays/dsh-lan-assist/slots.js` — `leftoverNameIdentity`, `leftoverKindMissingFromCatalog`; `session-round.js` — `closeRound(..., 'leftover')` |
| search_text vs biz 分工 | `runtime/vendor-overlays/dsh-lan-assist/catalog.js` — `briefFollowup` |
| biz 工具注册 | `runtime/vendor-overlays/dsh-lan-assist/tools.js` — `biz_preview` |
| route_intent Host | `~/.dsh-fde-x/vendor/dsh-semantic-os/gate.js` — `PLUGIN_TOOLS`; `python/bootstrap.py` — `"route_intent"` op |
| 记忆/知识 UI | `src/pages/Memory.tsx` — `CANVASES`, `COVER_LABEL` |
| 文件 → 会话 | `src/pages/Files.tsx` — `fde-x-attach-file`; `src/pages/AI.tsx` — `attachDroppedFile` |
| 上下文包（非闸） | `runtime/context-pack.mjs` — `ALLOWED_SCOPES`, `fillMemory`; `src/components/biz/RecordsPanel.tsx` — `askAiForRow` |
| 规格铁律（业务 vs 记忆） | 仓库 `PRODUCTION-SPEC.md` — 业务 `biz_preview`/`biz_write`；记忆 `search_text`；图不当现况 |

---

*只读勘察：未改代码、未推远程、未切换 `FDE_DSH_HOME`（仍为 `~/.dsh-fde-x`）。*
