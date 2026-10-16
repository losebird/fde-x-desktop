# 07 · 记忆连接层：上下文包 + 记忆写入器 + 各模块互通

依赖：01（事件）、02（bridge `fde_context_get` / `fde_memory_draft`）。被依赖：03/04/05/06 的「交给 AI」与写入钩子。协议：`00-agent-protocol.md`。

## 1. 目标

让 semantic-os 成为模块之间的连接层：
- **读侧**：每次「交给 AI」自动附上相关记忆、先例、当前工作区状态、来源实体（上下文包），前端可见可裁剪。
- **写侧**：重要动作后自动**起草**记忆卡（人点头才入档），高价值决策 `record_decision` 进图；非会话文本可被检索但不复制原文。
- **互通**：IM 先例真搜、记忆卡可跳回来源、文件目录可摄取、任务/记录/早报条目互相跳转。

## 2. 范围与禁区

- 做：`buildContextPack` BFF 路由 + 前端 hook + 「相关记忆」芯片；记忆写入器（事件驱动）；corpus 回读端点；IM「先例」改真搜；文件页「摄取此目录」；记忆卡「打开来源」；semantic-os 白名单放行所需 op。
- 不做：改 semantic-os 源码；自研向量库；把 IM/业务原文复制进 FAISS 侧车文件；自动入档。
- 禁区：`Memory.tsx` 六画布不动；铁律 §2.9。

## 3. 现有代码接点

| 接点 | 位置 |
|---|---|
| semantic-os HTTP | `/semantic-os/find`（`search_text`+`search_passages`）、`/python {op}`（`list_memory_cards`、`draft_memory_card`、`nod_memory_card`、`record_decision`、`add_entity`、`index_passages`、`find_precedents`、`brief_for_decision`、`query_decisions`、`lineage`）— `product.js` L41–462 |
| **工具签名（已核实，`~/.dsh/vendor/dsh-semantic-os/tools.js`）** | `find_precedents(scenario: string 必填, max_results?: int=5)` L348–353；`brief_for_decision(scenario 必填, category?)` L483–488；`record_decision({category, scenario, reasoning, outcome, confidence} 必填 + 可选 because[], leads_to[], status, receipt_id, tenant_cwd, trace_id, system, kind, …)` L236–259；`index_passages` **不是 Host 工具**，是 `/python` op（`args.rows`/`args.texts`，Python `passages.py` L210 `index_passages(cwd, rows)`） |
| BFF 白名单 | `dsh-core.mjs` `semanticOs` L730–780：`/python` 仅放 `list_memory_cards`、`draft_memory_card`；`/find` 放行（`server.mjs` `memory/search` L1792+ → `semanticOs('/find')`） |
| BFF 记忆路由 | `server.mjs` L977–1000、L1318–1359、L1773–1800 |
| FAISS id 与回读 | `passages.py` L1（id 前缀 `session:`/`file:`/`mail:`）、`index_passages`；`session-corpus.js` L205–224 `openCorpus` 只会读 `session:` |
| 前端已用 | `Memory.tsx`（首页、画布、抽屉搜索 L622–647）；`CommandPalette.tsx` L107–115；`IMWorkspace.tsx` L1123 `draftMemoryCard`；`im-ai.ts` L134–136「先例」只提示 AI |
| 各模块 promptAi | `IMWorkspace.tsx` L1008–1020；`Briefing.tsx` L95–100；`Data.tsx` L307–310、L361–363；`Files.tsx` L377；`Skills.tsx` |
| 事件 | 规格 01：`biz.write.done`、`app.record.changed`、`task.changed`、`briefing.ready`、`ai.session.changed` |
| 隔离 | 索引/图按 cwd（`{cwd}/.dsh/semantic-os/`）；跨 cwd `across_bridges` |

## 4. 上下文包（Context Pack）

### 4.1 结构

```ts
type ContextPack = {
  workspace: { cwd: string; name: string; activeSessionId?: string; activeSessionTitle?: string };
  tasks?:   { today: { id; title; status; dueAt? }[]; overdue: number };
  im?:      { unread: number; recent: { peer; excerpt; requestId }[] };   // 最多 3
  biz?:     { connections: { id; name; online }[]; recentOps: { kind; action; at }[] }; // 最多 3
  apps?:    { slug; name; entities: string[] }[];
  memory?:  { hits: { id; score; excerpt; sourceRef; at }[];            // find，最多 5
              precedents: { id; title; excerpt; at }[];                 // find_precedents，最多 3
              decisionBrief?: string };                                  // brief_for_decision，仅 intent 为决策类
  entity?:  { kind: 'task'|'im'|'biz-row'|'app-record'|'memory-card'|'file'; ref: string; fields: Record<string, unknown> };
  generatedAt: number;
};
type ContextScope = 'workspace'|'tasks'|'im'|'biz'|'apps'|'memory';
```

### 4.2 API

`POST /api/v1/context/pack` `{ workspaceCwd, scopes: ContextScope[], query?: string, entity?: ContextPack['entity'], intentKind?: 'decision'|'draft'|'lookup' }` → `ContextPack`。
- `memory` 需要 `query`（用 intent + entity 摘要拼）；调 `/find`（`cwd` 走 `?cwd=`），`find_precedents`；`intentKind==='decision'` 才调 `brief_for_decision`。
- 每个 scope 独立 try/catch；semantic 未就绪 → `memory` 省略并在 `warnings` 说明。
- 超时 3s 总预算；超时的 scope 省略。
- `POST /api/v1/bridge/context`（规格 02 的 `fde_context_get` 后端）复用同一函数。

### 4.3 前端

`src/lib/context-pack.ts`：
```ts
export async function buildContextPack(opts: { scopes; query?; entity?; intentKind? }): Promise<ContextPack>
export function renderContextForPrompt(pack: ContextPack, omit: Set<string>): string   // ≤ 1500 字，中文标题分段
```
`src/components/ai/ContextChips.tsx`：在「交给 AI」按钮旁显示「附带：5 条相关记忆 · 2 条先例 · 今日 3 待办」芯片，点开可逐项取消（`omit`）。**不新增面板**，芯片嵌在现有按钮行。

接入点（每处一行改动，把原 prompt 换成 `renderContextForPrompt(pack) + 原 prompt`）：IM 拟回/采纳/先例（scopes `['workspace','im','memory']`，`entity` 为当前消息）、业务记录「交给 AI」（`['workspace','biz','memory']`，`entity` 为行）、计划「整理待办」（规格 03）、应用向导（规格 04 已列）、早报生成（规格 06）。`askAiForResult` 内部默认走 `buildContextPack`。

## 5. 记忆写入器（`runtime/memory/writer.mjs`）

订阅事件（规格 01 `subscribe`），按规则起草：

| 事件 | 条件 | 动作 |
|---|---|---|
| `biz.write.done` | 总是 | `draft_memory_card({ layer:'project', title:'过账 <kind> <action>', body: 摘要(rows≤3, receipt), refs:['biz:<traceId>'] })` + `index_passages([{ id:'biz:<traceId>', text: 摘要 }])` |
| `app.record.changed` | 应用 `memory.onWrite==='draft-card'` 且 op≠delete | 卡 + `index_passages` id `app:<slug>:<entity>:<rid>` |
| `task.changed` | `op==='update' && status==='done'` | 卡 `layer:'daily'`，id `task:<id>` |
| `briefing.ready` | 总是 | 卡 `layer:'daily'`，正文 = ai 块，id `briefing:<id>` |
| IM 采纳发送成功（`im.message.sent` — 规格 01 v1 未含，本规格加入该事件类型，由 `imSend` 路由发） | 总是 | 卡 `layer:'project'`，id `im:<requestId>` |
| operations `approved` + 执行成功 | 总是 | 额外 `record_decision({ title, rationale: plan_json 摘要, refs })` |

约束：
- `index_passages` 只传 **摘要文本**（≤500 字）用于向量化；semantic-os 落盘 `meta.json` 只有 id/时间，符合「FAISS 只留向量+id」。原文由 §6 回读。
- 去重：同 `refs` 24h 内不重复起草（`memory_write_log` 表）。
- 失败只 `warn`，不阻断业务。

```sql
-- 009_memory_write_log.sql
CREATE TABLE IF NOT EXISTS memory_write_log (ref TEXT PRIMARY KEY, card_id TEXT, written_at INTEGER NOT NULL);
```

`dsh-core.mjs` `semanticOs` 白名单（L730–780）放行 `/python` op：`nod_memory_card`、`record_decision`、`index_passages`、`find_precedents`、`brief_for_decision`、`query_decisions`、`lineage`（仍拒绝其它 op）。

## 6. Corpus 回读（让非会话 id 的摘录能显示原文）

`GET /api/v1/corpus/:id`（`runtime/routes/corpus.mjs`）：按前缀分派 — `biz:<traceId>` → lan-assist `/traces` 回执；`app:<slug>:<entity>:<rid>` → 该行 JSON；`task:<id>` → 任务；`im:<requestId>` → lan-assist thread 该消息正文；`briefing:<id>` → 该早报 ai 块。返回 `{ ok, id, title, text, href }`（`href` 为前端跳转描述，如 `{ panel:'data', tab:'records', kind, rowId }`）。
前端：记忆搜索结果（`Memory.tsx` 抽屉、⌘K）遇到非 `session:` id 时调此端点取摘录与「打开来源」跳转。

## 7. 互通清单（本规格实现的部分）

| 从 → 到 | 实现 |
|---|---|
| IM 先例 | `im-ai.ts` L134–136 改为：先 `buildContextPack({scopes:['memory'], query: 消息正文, intentKind:'lookup'})`，把 `precedents` 渲染进 prompt 与芯片；AI 仍可自己再搜 |
| 记忆卡 → 来源 | 卡片/搜索结果「打开来源」用 §6 `href` 跳转（复用现有 `togglePanel` + 各面板的选中 state） |
| 文件 → 记忆 | `Files.tsx` 目录工具栏加「摄取此目录到记忆」→ `POST /semantic-os/ingest {cwd, path}`（现有路径，已在 `Memory.tsx` 用）→ 进度用现有 `ingest/progress` |
| 记忆 → AI | 记忆搜索结果「问 AI」= `promptAi(target, 摘录 + 问题)`（⌘K 与抽屉都加） |
| 早报 → 各处 | 规格 06 的 item `href` 走同一跳转函数 `openRef(href)`（`src/lib/open-ref.ts`，本规格提供） |

## 8. 错误与降级

- semantic 未就绪：上下文包无 `memory`，芯片显示「记忆引擎未就绪」灰字；写入器跳过并计数。
- `/find` 超 3s：省略，芯片「记忆检索超时」。
- 中文 cwd：所有 semantic 调用用 `?cwd=`，禁 `x-dsh-cwd`。

## 9. 验收清单

人工（5175）：
1. IM 选一条含「采购」的消息 → 拟回按钮旁出现芯片「附带 N 条相关记忆」→ 点开可取消一条 → 发出的 prompt（AI 页可见）含「相关记忆」段。
2. 业务记录选行 → 交给 AI → 芯片含行字段摘要。
3. 完成一条任务 → 记忆页「起草」列表出现「完成：<任务名>」卡，未入档；点头后入档。
4. 记录 Tab 过账成功 → 起草卡 + 决策进图（记忆页决策画布可见）。
5. ⌘K 搜刚过账的单号 → 命中 `biz:` 摘录 →「打开来源」跳到记录 Tab 对应型。
6. 文件页「摄取此目录」→ 进度条 → 记忆搜索能搜到目录里 md 的内容。
7. 停 semantic（设置里停用语义引擎）→ 拟回仍可用，芯片灰字。
8. 5174 回归：IM 拟回照常。

自动化：`runtime/tests/context-pack.test.mjs`（scope 独立失败、预算超时、`renderContextForPrompt` 长度上限）、`memory-writer.test.mjs`（事件 → 起草调用参数、24h 去重、失败不抛）、`corpus.test.mjs`（各前缀分派）。

## 10. 提交拆分

1. `feat(runtime): context pack route + bridge context`
2. `feat(web): buildContextPack + ContextChips; wire IM/biz/plan prompts`
3. `feat(runtime): memory writer on events + write log + whitelist ops`
4. `feat(runtime): corpus read-back route`
5. `feat(web): open-ref jumps; memory results 打开来源/问 AI`
6. `feat(files): ingest directory to memory`
7. `fix(im): 先例 uses real precedent search`

## 11. 开放问题

已关闭：签名见 §3。写入器调 `record_decision` 时 `category` 用 `biz|app|plan|briefing|im`，`scenario` = 卡标题，`reasoning` = plan_json 摘要，`outcome` = receipt/结果，`confidence` = 1.0（人已批准）。
